# Design Uber / Ola / Lyft — The Matchmaking Service Analogy

## The Matchmaking Analogy

Think of a wedding matchmaker in a small town. People come to her saying "I need a partner." She knows everyone in town — who's available, where they live, what they're looking for. She matches people based on proximity, compatibility, and availability. Now scale that to a city with 10 million people, all looking for matches in real-time, and the "partners" (drivers) are constantly moving.

**That's Uber** — a real-time matchmaking system between riders and drivers, where the "partners" are on the move, and the match must happen in seconds.

---

## 1. Requirements — What Are We Building?

### Functional Requirements
- Rider requests a ride from location A to location B
- System finds the nearest available driver and assigns the ride
- Real-time tracking of driver location (before and during ride)
- ETA calculation — when will driver arrive? When will ride end?
- Fare calculation based on distance, time, surge pricing
- Payment processing after ride completion
- Rating system for both riders and drivers

### Non-Functional Requirements
- **Low latency**: Match rider to driver in < 5 seconds
- **High availability**: 99.99% uptime — people depend on this for transportation
- **Scalability**: Handle millions of concurrent rides globally
- **Real-time**: Driver location updates every 3-5 seconds
- **Consistency**: A driver can only be assigned to ONE ride at a time

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        R[Rider App]
        D[Driver App]
    end

    subgraph Gateway["API Gateway + LB"]
        AG[API Gateway]
    end

    subgraph Services
        RS[Ride Service]
        LS[Location Service]
        MS[Matching Service]
        FS[Fare Service]
        PS[Payment Service]
        NS[Notification Service]
        ETA[ETA Service]
    end

    subgraph Data
        PG[(PostgreSQL - Rides, Users)]
        RD[(Redis - Driver Locations)]
        KF[Kafka - Events]
        ES[(ElasticSearch - Geospatial)]
    end

    R --> AG
    D --> AG
    AG --> RS
    AG --> LS
    RS --> MS
    RS --> FS
    RS --> PS
    RS --> ETA
    MS --> LS
    LS --> RD
    LS --> ES
    RS --> KF
    KF --> NS
    RS --> PG
```

---

## 3. The Core Problem — Geospatial Indexing

The hardest part of Uber isn't the app — it's answering: **"Which drivers are within 3 km of this rider, right now?"**

### Approach 1: Naive — Query All Drivers

```sql
-- ❌ Terrible — scans ALL drivers
SELECT * FROM drivers
WHERE is_available = true
AND calculate_distance(driver_lat, driver_lng, rider_lat, rider_lng) < 3.0;
```

With 500K active drivers, this query takes seconds. Unacceptable.

### Approach 2: Geohashing — The Smart Way

Divide the world into a grid. Each cell gets a unique hash. Drivers in the same cell share the same geohash prefix.

```mermaid
graph TB
    subgraph World Grid
        C1["Cell: 9q8yyk<br/>3 drivers"]
        C2["Cell: 9q8yym<br/>5 drivers"]
        C3["Cell: 9q8yyn<br/>2 drivers"]
        C4["Cell: 9q8yyp<br/>0 drivers"]
    end

    R[Rider at 9q8yym] -->|Search this cell + neighbors| C1
    R --> C2
    R --> C3
```

```java
// Geohash-based driver lookup
public List<Driver> findNearbyDrivers(double lat, double lng, double radiusKm) {
    String riderGeohash = Geohash.encode(lat, lng, 6); // precision 6 = ~1.2km cell
    Set<String> neighborCells = Geohash.neighbors(riderGeohash);
    neighborCells.add(riderGeohash);

    List<Driver> candidates = new ArrayList<>();
    for (String cell : neighborCells) {
        // Redis: each cell is a key, drivers are in a sorted set
        candidates.addAll(redis.smembers("drivers:" + cell));
    }

    // Filter by exact distance and availability
    return candidates.stream()
        .filter(Driver::isAvailable)
        .filter(d -> haversineDistance(lat, lng, d.getLat(), d.getLng()) <= radiusKm)
        .sorted(Comparator.comparingDouble(d -> haversineDistance(lat, lng, d.getLat(), d.getLng())))
        .collect(Collectors.toList());
}
```

<div class="callout-info">

**Why Geohash?** Instead of scanning 500K drivers, you only scan drivers in 9 cells (~50-100 drivers). That's a 5000x reduction in search space. Redis lookup is O(1) per cell.

</div>

### Approach 3: QuadTree — Uber's Actual Approach

```mermaid
graph TB
    Root["World"] --> NW["Northwest"]
    Root --> NE["Northeast"]
    Root --> SW["Southwest"]
    Root --> SE["Southeast"]
    NW --> NW1["NW-NW<br/>2 drivers"]
    NW --> NW2["NW-NE<br/>0 drivers"]
    NW --> NW3["NW-SW<br/>15 drivers"]
    NW --> NW4["NW-SE<br/>3 drivers"]
```

QuadTree recursively divides space into 4 quadrants. Dense areas (city centers) get subdivided more. Sparse areas (rural) stay as large cells. This adapts to driver density automatically.

<div class="callout-scenario">

**Scenario**: Mumbai city center has 10,000 drivers in a 5km radius. Rural Maharashtra has 50 drivers in 100km. **Decision**: QuadTree adapts — city center cells are tiny (100m), rural cells are huge (10km). Geohash with fixed precision can't do this. For Uber-scale, QuadTree wins.

</div>

---

## 4. Driver Location Updates — The Firehose

Every driver sends location every 3-5 seconds. With 1 million active drivers:

**1M drivers × 1 update/4 sec = 250,000 location updates per second**

```mermaid
sequenceDiagram
    participant Driver as Driver App
    participant WS as WebSocket Gateway
    participant Kafka as Kafka
    participant LS as Location Service
    participant Redis as Redis
    participant QT as QuadTree

    Driver->>WS: {lat: 19.07, lng: 72.87, ts: ...}
    WS->>Kafka: Publish to "driver-locations" topic
    Kafka->>LS: Consume batch
    LS->>Redis: Update driver position
    LS->>QT: Move driver to new cell (if changed)
```

<div class="callout-tip">

**Applying this** — Don't update the QuadTree on every location ping. Only update when the driver crosses a cell boundary. Most updates are within the same cell (driver moved 50 meters). This reduces QuadTree writes by ~90%.

</div>

---

## 5. Ride Matching — The Dispatch Algorithm

```mermaid
sequenceDiagram
    participant Rider
    participant RS as Ride Service
    participant MS as Matching Service
    participant LS as Location Service
    participant ETA as ETA Service
    participant Driver

    Rider->>RS: Request ride (pickup, dropoff)
    RS->>MS: Find best driver
    MS->>LS: Get nearby available drivers (3km radius)
    LS->>MS: [Driver A: 1.2km, Driver B: 0.8km, Driver C: 2.1km]
    MS->>ETA: Calculate ETA for top 3 drivers
    ETA->>MS: [A: 4min, B: 6min, C: 8min]
    Note over MS: Driver B is closer but stuck in traffic<br/>Driver A has better ETA
    MS->>Driver: Send ride request to Driver A
    Driver->>MS: Accept ✅
    MS->>RS: Match confirmed
    RS->>Rider: Driver assigned! ETA: 4 min
```

**Matching factors (not just distance):**
- ETA (road distance, not straight line)
- Driver rating
- Driver's heading direction (already driving toward rider?)
- Vehicle type match (rider requested SUV)
- Driver acceptance rate history

<div class="callout-warn">

**Warning**: Never assign based on straight-line distance alone. A driver 500m away across a river might take 20 minutes. A driver 2km away on the same road might take 3 minutes. Always use road-network ETA.

</div>

---

## 6. ETA Calculation

```mermaid
flowchart LR
    A[Driver Location] --> B[Road Network Graph]
    B --> C[Dijkstra / A* Algorithm]
    C --> D[Base ETA: 12 min]
    D --> E{Apply Real-Time Factors}
    E --> F[Traffic: +3 min]
    E --> G[Weather: +1 min]
    E --> H[Time of day: +2 min]
    F --> I[Final ETA: 18 min]
    G --> I
    H --> I
```

**How Uber calculates ETA:**
1. **Road network graph** — map data from OpenStreetMap or HERE Maps
2. **Historical travel times** — "This road segment takes 5 min at 8 AM on Monday"
3. **Real-time GPS traces** — aggregate speed from all active drivers on that road
4. **ML model** — trained on billions of past trips to predict ETA

<div class="callout-interview">

**Q: "How would you calculate ETA?"**

I'd use a graph-based approach with road segments as edges and intersections as nodes. Edge weights are travel times, not distances. Base weights come from historical data, adjusted in real-time using GPS traces from active drivers. For the shortest path, I'd use A* (faster than Dijkstra for point-to-point). The ML layer on top adjusts for time-of-day, weather, and events. Uber's actual system (DeepETA) uses a transformer model trained on billions of trips.

</div>

---

## 7. Surge Pricing — Supply and Demand

```mermaid
flowchart TB
    A[High Demand Area] --> B{Supply vs Demand}
    B -->|Demand >> Supply| C[Surge Multiplier: 2.5x]
    B -->|Demand ≈ Supply| D[Normal Pricing: 1.0x]
    B -->|Supply >> Demand| E[Discount: 0.8x]
    C --> F[Higher fare attracts more drivers to area]
    F --> G[Supply increases, surge drops]
```

<div class="callout-scenario">

**Scenario**: Concert ends at 11 PM. 5,000 people request rides simultaneously in a 1km area. Only 200 drivers nearby. **Decision**: Surge pricing kicks in at 3x. This does two things: (1) discourages non-urgent riders, (2) attracts drivers from nearby areas who see higher earnings. Within 15 minutes, supply catches up and surge drops to 1.5x.

</div>

---

## 8. Database Design

```mermaid
erDiagram
    RIDER {
        uuid id PK
        string name
        string phone
        string email
        float rating
    }

    DRIVER {
        uuid id PK
        string name
        string phone
        string license_number
        string vehicle_type
        float rating
        boolean is_available
        float current_lat
        float current_lng
    }

    RIDE {
        uuid id PK
        uuid rider_id FK
        uuid driver_id FK
        float pickup_lat
        float pickup_lng
        float dropoff_lat
        float dropoff_lng
        string status
        float fare
        float surge_multiplier
        timestamp requested_at
        timestamp started_at
        timestamp completed_at
    }

    RIDER ||--o{ RIDE : requests
    DRIVER ||--o{ RIDE : accepts
```

**Storage decisions:**
| Data | Store | Why |
|------|-------|-----|
| User profiles, ride history | PostgreSQL | Relational, ACID, complex queries |
| Driver real-time locations | Redis (Geospatial) | Ultra-fast reads, `GEORADIUS` command |
| Location history (analytics) | Cassandra / S3 | Write-heavy, time-series, append-only |
| Ride events | Kafka | Event streaming, decoupling |
| Geospatial search | QuadTree in memory | Fastest spatial queries |

---

## 9. Handling Failures

| Failure | Impact | Solution |
|---------|--------|----------|
| Driver app crashes mid-ride | Rider stranded | Server-side ride state machine. If no driver heartbeat for 60s, alert rider + assign new driver |
| Payment fails | Ride completed but unpaid | Queue payment retry. Don't block ride completion for payment |
| Matching service down | No new rides | Circuit breaker + fallback to simple nearest-driver matching |
| Location service lag | Stale driver positions | TTL on location data. If location > 30s old, mark driver as "uncertain" |

<div class="callout-tip">

**Applying this** — Always design ride state as a state machine: `REQUESTED → MATCHED → DRIVER_EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED → PAID`. Each transition is an event in Kafka. If any service crashes, you can rebuild state from the event log.

</div>

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: On New Year's Eve, ride requests near a stadium jump 30x in ten minutes. The matching service queries the geo index for every request, the hottest geohash cell becomes a single overloaded Redis key, and match latency climbs from 300 ms to 20 s. **Decision**: Split hot cells (finer-grained cells or H3 resolution where density is high), batch matching per cell every 1-2 seconds instead of per-request greedy matching (better global assignments and fewer index reads), and shed load gracefully — queue requests with an honest ETA and enable surge pricing to balance demand and supply. Pre-scale for known events.

</div>

<div class="callout-scenario">

**Scenario**: A driver's app loses connectivity in an underground parking lot mid-trip; the rider's app shows the car frozen for 4 minutes and the fare calculation jumps when it reconnects. **Decision**: Treat location as an unreliable stream. The driver app buffers GPS points offline and uploads them in order on reconnect (with device timestamps); the server smooths the path with map matching (snapping to roads) and computes the fare from the reconstructed route; the rider app shows "last updated 2 min ago" instead of a frozen car pretending to be live.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** 1M active drivers send their location every 4 seconds. What's the write rate, and should every update go to the main database?

<details>
<summary>Show answer</summary>

1M / 4 = **250K updates/second**. No — the current location is ephemeral, hot data: keep it in an in-memory geo index (Redis GEO / sharded in-memory service) and publish updates to Kafka for consumers (trip tracking, ETA, analytics). Persist trip routes (sampled points) to cheaper storage for billing and disputes, not every ping to a relational database.

</details>

**L2.** What problem do geohash/H3 cells solve?

<details>
<summary>Show answer</summary>

"Find drivers near this point" over a 2D space. Encoding locations into cells turns a radius search into lookups of a few cell IDs (the rider's cell plus neighbors) — fast with key-value stores and easy to shard by cell. H3 (hexagons) gives uniform neighbor distances; geohash (rectangles) is simple and prefix-based.

</details>

**L3.** Why is ETA computed from road-network routing rather than straight-line distance?

<details>
<summary>Show answer</summary>

Rivers, one-way streets, highways, and traffic make straight-line distance a poor predictor. A driver 800 m away across a river may be 15 minutes out, while one 2 km away on the same road is 4 minutes. Matching on routing ETA (with live traffic) gives better pickups and more accurate rider expectations.

</details>

### 🟡 Medium — Apply it

**M1.** Two riders get matched to the same driver at the same moment. How do you prevent it?

<details>
<summary>Show answer</summary>

Make the driver assignment an atomic state transition: driver state `AVAILABLE → OFFERED(trip_id)` via a conditional write (Redis Lua/`SET NX` on a driver lock key with a TTL, or a DB update with `WHERE state = 'AVAILABLE'`). The second matcher's attempt fails and it picks the next candidate. Offers expire after ~15 seconds if the driver doesn't accept, returning the driver to `AVAILABLE`. Matching per geo cell in one worker (cell-sharded matching) also avoids most contention.

</details>

**M2.** Design the trip state machine and say which transitions need strong consistency.

<details>
<summary>Show answer</summary>

`REQUESTED → MATCHING → DRIVER_ASSIGNED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED → PAID`, plus `CANCELLED_BY_RIDER`, `CANCELLED_BY_DRIVER`, `NO_DRIVERS_FOUND`. Strong consistency (single source of truth, conditional updates, idempotent commands) for assignment, start, completion, cancellation, and payment — they affect money and driver availability. Location updates and ETAs are eventually consistent and can be lost without harm.

</details>

**M3.** How would you compute surge pricing?

<details>
<summary>Show answer</summary>

Per geo cell and short window (e.g., every minute), compute demand (open requests, app opens) vs supply (available drivers, drivers finishing trips nearby) with stream processing. Map the ratio to a multiplier with smoothing (avoid flapping), caps, and neighbor-cell blending (avoid sharp boundaries). Lock the quoted price in the rider's request for a few minutes (price quote ID) so the charge matches what they accepted. Log everything for regulatory review and audits.

</details>

### 🔴 High — Think like a senior

**H1.** Design the location service for 5M drivers across 300 cities with a < 100 ms "nearby drivers" query.

<details>
<summary>Show answer</summary>

Shard by city/region first (traffic rarely crosses), then by geo cell inside large cities. Each shard is an in-memory index (cell → set of driver IDs with last location and status) held by a stateful service or Redis Cluster, replicated for failover. Driver updates arrive via WebSocket gateways → Kafka (partitioned by driver ID) → shard consumers update cell membership (remove from old cell, add to new). Entries expire if no update in ~30 s. Queries read the rider's cell + ring of neighbors from the right shard, filter by status and vehicle type, then rank candidates by routing ETA. Handle boundary cells between shards by querying both.

</details>

**H2.** The payment provider is down when a trip completes. What happens?

<details>
<summary>Show answer</summary>

Trip completion must not depend on payment succeeding. Mark the trip `COMPLETED` with a fare, write a payment-request event (outbox) and let a payment worker retry with an idempotency key (trip ID) and exponential backoff. The rider gets a receipt marked "payment pending"; the driver's earnings are recorded from the trip, independent of the charge. After retries are exhausted, move to a dunning flow (retry another card, block new requests until settled). Reconcile daily with the provider's reports.

</details>

## 🛠️ Mini Project — Mini Ride-Matching Service

**Goal**: Real geo-indexing and concurrency-safe matching in a weekend.

**Build**

1. A Spring Boot service with Redis: `POST /drivers/{id}/location` (stores in Redis GEO with status in a hash), `POST /rides` (rider requests a ride at lat/lng).
2. Matching: query nearby drivers with `GEOSEARCH ... BYRADIUS 3 km ASC`, filter `AVAILABLE`, lock the driver atomically with a Lua script, and send an offer that expires in 15 s.
3. A simulator that moves 2,000 drivers along random streets (or random walks) every 4 seconds, plus 50 ride requests per second.
4. Trip state machine with conditional updates; WebSocket stream of driver location to the rider.
5. Concurrency test: 100 simultaneous requests around 10 drivers — prove no driver is double-assigned.

**Acceptance criteria**: zero double assignments; p95 matching latency printed; README explaining how you'd shard by city and cell at real scale.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How would you store and query driver locations efficiently?"**

I'd use a two-layer approach. **Layer 1: Redis** with geospatial commands — `GEOADD` to update driver positions, `GEORADIUS` to find drivers within X km. This gives O(log N) performance. **Layer 2: In-memory QuadTree** for the matching service — it adapts cell sizes to driver density (small cells in cities, large in rural). Drivers update Redis every 3-5 seconds. The QuadTree only updates when a driver crosses a cell boundary. For 1M active drivers, Redis handles 250K writes/sec easily. The QuadTree search returns candidates in microseconds.

**Follow-up trap**: "What about consistency between Redis and QuadTree?" → They're eventually consistent, which is fine. A driver's position being 5 seconds stale doesn't matter — the matching service recalculates ETA using the latest position anyway.

</div>

<div class="callout-interview">

**Q: "How do you prevent two riders from being matched to the same driver?"**

Distributed locking. When the matching service selects a driver, it acquires a Redis lock on that driver's ID with a short TTL (10 seconds). If another matching request tries the same driver, the lock fails and it picks the next best driver. After the driver accepts/rejects, the lock is released. I'd use Redis `SET NX EX` (set if not exists, with expiry) for atomic lock acquisition. This is simpler and faster than database-level locking.

**Follow-up trap**: "What if the lock expires before the driver responds?" → Set TTL slightly longer than the driver response timeout (e.g., lock TTL = 15s, driver timeout = 10s). If the driver doesn't respond in 10s, the ride is re-queued and the lock expires naturally.

</div>

<div class="callout-interview">

**Q: "How would you handle a city-wide event where demand spikes 10x?"**

Three things: (1) **Auto-scaling** — matching service and ride service scale horizontally based on request queue depth. (2) **Surge pricing** — automatically kicks in to balance supply/demand. Higher fares attract drivers from neighboring areas. (3) **Request queuing** — instead of rejecting requests, queue them with estimated wait times. Process in order as drivers become available. I'd also pre-position drivers near the event venue based on historical data (e.g., we know a cricket match at Wankhede ends at 10 PM every time). Proactive supply positioning is better than reactive surge.

</div>

<div class="callout-interview">

**Q: "Design the ride state machine and handle edge cases."**

States: `REQUESTED → MATCHING → DRIVER_ASSIGNED → DRIVER_EN_ROUTE → DRIVER_ARRIVED → RIDE_IN_PROGRESS → RIDE_COMPLETED → PAYMENT_PROCESSED`. Edge cases: (1) **Driver cancels after accepting** — move back to MATCHING, find new driver, penalize driver's acceptance score. (2) **Rider cancels after driver is en route** — charge cancellation fee if driver is within 2 min of pickup. (3) **Driver goes offline mid-ride** — server detects missing heartbeat, alerts rider, attempts to contact driver, if no response in 2 min, assign rescue driver. (4) **GPS signal lost** — use last known position + estimated speed to interpolate. Resume tracking when signal returns. Each state transition is an event in Kafka for audit trail and analytics.

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| Geohash | Encode lat/lng into a string, nearby locations share prefix |
| QuadTree | Recursive spatial index, adapts to density |
| GEORADIUS | Redis command to find points within radius |
| Surge Pricing | Dynamic pricing based on supply/demand ratio |
| Dispatch | Algorithm to match riders with optimal drivers |
| ETA | Estimated time using road network + real-time traffic |
| Haversine | Formula to calculate distance between two lat/lng points |
| State Machine | Ride lifecycle managed as state transitions |
| Heartbeat | Periodic signal from driver app to confirm connectivity |

---

> **Uber isn't a taxi company — it's a real-time matching engine. The magic isn't in the car, it's in the algorithm that connects the right driver to the right rider in seconds.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Extra case study — its demand spikes and surge handling mirror ShopNorth's 8 PM sale spike and waiting room.

**Continue the story:** [Chapter 14 · Launch Day & Incidents](/tutorials/journey-14-launch-day) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
