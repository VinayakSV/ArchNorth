# Load Balancing — The Complete Guide — The Airport Security Analogy

## The Airport Security Analogy

Imagine an airport with 10 security check lanes but only 1 is open. The queue stretches for hours. Now open all 10 lanes and put a coordinator at the entrance who directs passengers to the shortest queue. That coordinator is your **load balancer** — it distributes incoming traffic across multiple servers so no single server gets overwhelmed.

But here's the twist — some lanes have faster scanners, some passengers have priority boarding, and some lanes handle only carry-on. A smart coordinator considers all of this. That's what makes load balancing interesting.

---

## 1. Why Load Balancing? — The Problem

```mermaid
graph LR
    subgraph Without LB
        U1[1M Users] --> S1[Single Server]
        S1 -->|Crashes| X[💀 502 Bad Gateway]
    end
```

```mermaid
graph LR
    subgraph With LB
        U2[1M Users] --> LB[Load Balancer]
        LB --> S2[Server 1 - 250K]
        LB --> S3[Server 2 - 250K]
        LB --> S4[Server 3 - 250K]
        LB --> S5[Server 4 - 250K]
    end
```

<div class="callout-info">

**Key insight**: Load balancing isn't just about distributing traffic — it's about **high availability**. If Server 2 dies, the load balancer stops sending traffic to it. Users never notice. Zero downtime.

</div>

---

## 2. L4 vs L7 Load Balancing — The Fundamental Split

This is the most important concept to understand:

| Feature | L4 (Transport Layer) | L7 (Application Layer) |
|---------|---------------------|----------------------|
| **Operates at** | TCP/UDP level | HTTP/HTTPS level |
| **Sees** | IP addresses, ports | URLs, headers, cookies, body |
| **Speed** | Faster (no payload inspection) | Slower (inspects content) |
| **Routing decisions** | Based on IP/port only | Based on URL path, headers, cookies |
| **SSL termination** | No (passes through) | Yes (decrypts, inspects, re-encrypts) |
| **Use case** | Database connections, gaming, IoT | Web apps, APIs, microservices |
| **AWS equivalent** | NLB (Network Load Balancer) | ALB (Application Load Balancer) |

```mermaid
flowchart TB
    subgraph L4["L4 Load Balancer (NLB)"]
        direction LR
        A1[Packet arrives] --> A2{Check IP + Port}
        A2 --> A3[Forward entire TCP stream to backend]
    end

    subgraph L7["L7 Load Balancer (ALB)"]
        direction LR
        B1[Request arrives] --> B2[Terminate SSL]
        B2 --> B3{Inspect URL, Headers}
        B3 -->|/api/*| B4[API Servers]
        B3 -->|/static/*| B5[CDN/Static Servers]
        B3 -->|/ws/*| B6[WebSocket Servers]
    end
```

<div class="callout-scenario">

**Scenario**: You have a microservices app with separate services for users, orders, and payments. You need to route `/api/users/*` to user-service, `/api/orders/*` to order-service. **Decision**: Use L7 (ALB) — only L7 can inspect the URL path and route accordingly. L4 can't see the URL.

</div>

<div class="callout-scenario">

**Scenario**: You're running a multiplayer game server that uses raw TCP connections with millions of concurrent players. **Decision**: Use L4 (NLB) — it's faster, handles raw TCP, and you don't need URL-based routing. L7 would add unnecessary overhead.

</div>

---

## 3. Load Balancing Algorithms — How Traffic Gets Distributed

### Round Robin — The Simplest

```
Request 1 → Server A
Request 2 → Server B
Request 3 → Server C
Request 4 → Server A  (back to start)
```

**Problem**: What if Server A is a powerful machine and Server C is weak? They get equal traffic but unequal capacity.

### Weighted Round Robin

```
Server A (weight: 5) → Gets 5 out of 8 requests
Server B (weight: 2) → Gets 2 out of 8 requests
Server C (weight: 1) → Gets 1 out of 8 requests
```

### Least Connections

```
Server A: 150 active connections
Server B: 80 active connections   ← Next request goes here
Server C: 200 active connections
```

**Best for**: Long-lived connections (WebSocket, database pools) where some requests take much longer than others.

### IP Hash

```
hash(client_IP) % num_servers = target_server
```

**Best for**: When you need the same client to always hit the same server (poor man's sticky sessions).

### Comparison Table

| Algorithm | Best for | Drawback |
|-----------|---------|----------|
| **Round Robin** | Equal servers, stateless apps | Ignores server load |
| **Weighted Round Robin** | Mixed server capacities | Manual weight configuration |
| **Least Connections** | Long-lived connections, varying request times | Slightly more overhead |
| **IP Hash** | Session affinity without cookies | Uneven distribution if IP ranges cluster |
| **Least Response Time** | Performance-critical APIs | Requires health monitoring |
| **Random** | Simple, surprisingly effective at scale | Can be uneven with few servers |

<div class="callout-interview">

**Q: "Which algorithm would you pick for a stateless REST API?"**

Round Robin or Least Connections. Since the API is stateless, any server can handle any request. Least Connections is slightly better because it accounts for slow requests that tie up a server. But for most cases, Round Robin with health checks is perfectly fine.

</div>

---

## 4. Health Checks — How LB Knows a Server is Alive

```mermaid
sequenceDiagram
    participant LB as Load Balancer
    participant S1 as Server 1
    participant S2 as Server 2
    participant S3 as Server 3

    loop Every 10 seconds
        LB->>S1: GET /health
        S1->>LB: 200 OK ✅
        LB->>S2: GET /health
        S2->>LB: 200 OK ✅
        LB->>S3: GET /health
        S3--xLB: Timeout ❌
    end

    Note over LB,S3: S3 marked unhealthy after 3 consecutive failures
    Note over LB: Traffic only goes to S1 and S2
```

**Health check types:**

| Type | What it checks | Example |
|------|---------------|---------|
| **TCP** | Can I connect to the port? | Port 8080 open? |
| **HTTP** | Does the endpoint return 200? | `GET /health` → 200 |
| **Deep health** | Is the app actually working? | Check DB connection, cache, dependencies |

```java
// ✅ Good health check endpoint
@GetMapping("/health")
public ResponseEntity<Map<String, String>> health() {
    Map<String, String> status = new HashMap<>();
    status.put("status", "UP");
    status.put("db", checkDatabase() ? "OK" : "FAIL");
    status.put("cache", checkRedis() ? "OK" : "FAIL");

    boolean healthy = status.values().stream().allMatch(v -> !"FAIL".equals(v));
    return healthy
        ? ResponseEntity.ok(status)
        : ResponseEntity.status(503).body(status);
}
```

<div class="callout-warn">

**Warning**: Don't make health checks too expensive. If your health endpoint queries the database on every call and you have 50 servers checked every 10 seconds, that's 300 DB queries/minute just for health checks. Use connection pool validation, not full queries.

</div>

---

## 5. Sticky Sessions — When Statelessness Isn't an Option

Sometimes a user MUST hit the same server (e.g., shopping cart stored in server memory, WebSocket connections):

```mermaid
sequenceDiagram
    participant User
    participant LB as Load Balancer
    participant S1 as Server 1
    participant S2 as Server 2

    User->>LB: First request
    LB->>S1: Route to Server 1
    S1->>LB: Response + Set-Cookie: SERVERID=s1
    LB->>User: Response with cookie

    User->>LB: Second request (Cookie: SERVERID=s1)
    LB->>S1: Route to Server 1 (sticky!)
```

<div class="callout-warn">

**Warning**: Sticky sessions break horizontal scaling. If Server 1 dies, all its sticky users lose their sessions. **Better approach**: Store sessions in Redis/Memcached so any server can serve any user. Then you don't need sticky sessions at all.

</div>

<div class="callout-tip">

**Applying this** — In production, avoid sticky sessions. Use externalized session stores (Redis, DynamoDB). This lets you scale servers up/down freely and handle server failures gracefully. The only exception is WebSocket connections which are inherently sticky.

</div>

---

## 6. SSL/TLS Termination

```mermaid
flowchart LR
    subgraph Termination["SSL Termination at LB"]
        U[User] -->|HTTPS encrypted| LB[Load Balancer]
        LB -->|HTTP plain| S1[Server 1]
        LB -->|HTTP plain| S2[Server 2]
    end
```

| Approach | Pros | Cons |
|----------|------|------|
| **Terminate at LB** | Offloads CPU from servers, easier cert management | Traffic between LB and servers is unencrypted |
| **SSL Passthrough** | End-to-end encryption | Servers handle SSL (CPU overhead), LB can't inspect traffic |
| **Re-encryption** | End-to-end encryption + LB can inspect | Double encryption overhead |

<div class="callout-tip">

**Applying this** — For most apps, terminate SSL at the load balancer. Use internal network security (VPC, security groups) to protect LB-to-server traffic. Only use re-encryption if compliance requires end-to-end encryption (PCI-DSS, HIPAA).

</div>

---

## 7. AWS Load Balancers — ALB vs NLB vs CLB

| Feature | ALB | NLB | CLB (Legacy) |
|---------|-----|-----|-------------|
| **Layer** | L7 (HTTP/HTTPS) | L4 (TCP/UDP) | L4 + L7 |
| **Routing** | Path, host, header, query string | Port-based only | Basic |
| **WebSocket** | ✅ | ✅ | ❌ |
| **Static IP** | ❌ (use Global Accelerator) | ✅ | ❌ |
| **Performance** | Good | Millions of RPS, ultra-low latency | Moderate |
| **Cost** | Per LCU (request-based) | Per NLCU (connection-based) | Per hour |
| **Best for** | Web apps, microservices, APIs | Gaming, IoT, gRPC, extreme performance | Don't use (legacy) |

```mermaid
flowchart TB
    Q1{Need URL/header-based routing?}
    Q1 -->|Yes| ALB[Use ALB]
    Q1 -->|No| Q2{Need static IP or extreme performance?}
    Q2 -->|Yes| NLB[Use NLB]
    Q2 -->|No| Q3{Need both?}
    Q3 -->|Yes| BOTH[NLB → ALB chain]
    Q3 -->|No| ALB2[Default: ALB]
```

<div class="callout-scenario">

**Scenario**: Your API needs to be whitelisted by a partner using a static IP, but you also need path-based routing. **Decision**: Put NLB in front (gives static IP) → routes to ALB (gives path-based routing). This is a common pattern in enterprise integrations.

</div>

---

## 8. Global Load Balancing — Multi-Region

```mermaid
graph TB
    subgraph DNS["DNS-Based Global LB"]
        GDNS[Route 53 / Global Accelerator]
    end

    subgraph US["US-East Region"]
        ALB1[ALB] --> US1[Server 1]
        ALB1 --> US2[Server 2]
    end

    subgraph EU["EU-West Region"]
        ALB2[ALB] --> EU1[Server 1]
        ALB2 --> EU2[Server 2]
    end

    subgraph AP["AP-South Region"]
        ALB3[ALB] --> AP1[Server 1]
        ALB3 --> AP2[Server 2]
    end

    GDNS -->|US users| ALB1
    GDNS -->|EU users| ALB2
    GDNS -->|Asia users| ALB3
```

**Routing policies:**
- **Latency-based**: Route to region with lowest latency
- **Geolocation**: Route based on user's country
- **Failover**: Primary region → secondary if primary is down
- **Weighted**: 80% to US, 20% to EU (for gradual migration)

<div class="callout-interview">

**Q: "How do you handle a region going down?"**

Use Route 53 health checks with failover routing. If US-East health check fails, DNS automatically routes all traffic to EU-West. Combine with database replication (Aurora Global Database or DynamoDB Global Tables) so the failover region has up-to-date data. RTO can be under 60 seconds.

</div>

---

## 9. Load Balancer as Single Point of Failure?

"If everything goes through the load balancer, isn't IT the single point of failure?"

```mermaid
flowchart TB
    subgraph HA["High Availability LB Setup"]
        VIP[Virtual IP / Floating IP]
        VIP --> LB1[Active LB]
        VIP -.->|Failover| LB2[Standby LB]
        LB1 --> S1[Server 1]
        LB1 --> S2[Server 2]
        LB2 --> S1
        LB2 --> S2
    end
```

**How it's solved:**
- **Active-Passive**: Two LBs, standby takes over if active dies (VRRP protocol)
- **Active-Active**: Both LBs handle traffic, DNS returns both IPs
- **Managed services**: AWS ALB/NLB are inherently HA — AWS manages redundancy across AZs

<div class="callout-tip">

**Applying this** — If you're on AWS, use ALB/NLB — they're automatically deployed across multiple AZs. You never manage LB redundancy yourself. If self-hosting (HAProxy/Nginx), always deploy in active-passive pairs with keepalived for failover.

</div>

---

<!-- practice-pack -->

## 🏢 More Real-World Scenarios

<div class="callout-scenario">

**Scenario**: Each instance's health check calls the database and Redis. During a brief Redis blip, every instance fails its health check at once, the load balancer marks all targets unhealthy, and the whole site returns 503 — far worse than the Redis blip itself. **Decision**: Health checks deciding *traffic* should reflect whether this instance can serve requests, not the health of shared dependencies. Keep load balancer checks shallow (process up, can accept requests), handle dependency failures with timeouts, circuit breakers, and graceful degradation, and alert on dependency health separately.

</div>

<div class="callout-scenario">

**Scenario**: After a deployment, new instances receive a full share of traffic immediately while their JVMs are still cold; latency spikes and some requests time out. **Decision**: Use **slow start / warm-up** (the ALB "slow start duration" or a weighted ramp) so new targets receive gradually increasing traffic, plus readiness checks that pass only after warm-up (caches loaded, connection pools initialized), and connection draining (deregistration delay) for instances being removed.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** L4 or L7 load balancer for: (a) routing `/api/*` and `/images/*` to different services, (b) a TCP game server, (c) TLS termination with host-based routing for 20 domains, (d) millions of long-lived IoT connections with minimal latency.

<details>
<summary>Show answer</summary>

(a) L7 (path-based routing — ALB). (b) L4 (NLB) — not HTTP. (c) L7 (ALB with SNI and host rules). (d) L4 (NLB) — high connection counts, low overhead; TLS can be terminated at the NLB or the targets.

</details>

**L2.** Which algorithm fits: (a) identical stateless servers with similar request costs, (b) requests with very different durations, (c) cache servers where the same key should hit the same node?

<details>
<summary>Show answer</summary>

(a) Round robin (or random). (b) Least connections / least outstanding requests (ALB's "least outstanding requests"). (c) Consistent hashing on the key.

</details>

**L3.** Why are sticky sessions problematic, and what's the usual alternative?

<details>
<summary>Show answer</summary>

They break even load distribution (heavy users stick to one server), complicate scaling down and deployments (sessions lost when an instance goes away), and reduce fault tolerance. Alternative: stateless services with session state in a shared store (Redis) or self-contained tokens, so any instance can serve any request.

</details>

### 🟡 Medium — Apply it

**M1.** Design zero-downtime deployments behind an ALB for a Spring Boot service.

<details>
<summary>Show answer</summary>

Rolling or blue/green deployment with: readiness-based target registration (the target group health check hits `/actuator/health/readiness`), slow start for new targets, a **deregistration delay** (e.g., 30 s) so in-flight requests complete, Spring graceful shutdown (`server.shutdown=graceful`) with a shutdown timeout below the deregistration delay, and keep-alive timeouts on the app longer than the ALB's idle timeout to avoid reset connections. Verify with a load test during deployment: zero 5xx.

</details>

**M2.** Your service sees uneven load: one of 6 instances runs at 90% CPU while others sit at 30%. Investigate.

<details>
<summary>Show answer</summary>

Possible causes: sticky sessions or source-IP hashing concentrating heavy clients; long-lived connections (HTTP/2, gRPC, WebSockets) that were balanced at connect time and never rebalanced; one instance in a different AZ with cross-zone load balancing disabled; a client with its own connection pool hitting one instance; or that instance is slower (noisy neighbor) and the algorithm doesn't adapt. Fixes: least-outstanding-requests algorithm, enable cross-zone balancing, periodic connection recycling for long-lived connections, client-side load balancing for gRPC, and remove stickiness.

</details>

**M3.** Design global load balancing for an app deployed in Mumbai and Frankfurt.

<details>
<summary>Show answer</summary>

DNS-based geo/latency routing (Route 53 latency or geolocation records, or a global anycast load balancer such as AWS Global Accelerator / Cloudflare) with health checks per region, so users go to the nearest healthy region and fail over automatically. Data layer decides what's possible: read-mostly data replicated to both regions; writes either routed to a home region per user/tenant or handled with multi-region databases and conflict rules. Keep DNS TTLs low (e.g., 60 s) and test failover regularly.

</details>

### 🔴 High — Think like a senior

**H1.** Is the load balancer a single point of failure? Design the entry point for 99.99% availability.

<details>
<summary>Show answer</summary>

Managed cloud load balancers are themselves distributed across zones with redundant nodes (an ALB spans multiple AZs; NLB has per-AZ static IPs), so the bigger risks are configuration errors, regional outages, and dependencies like DNS and certificates. For 99.99%: multi-AZ targets with enough capacity to lose one AZ (N+1), health-checked targets, infrastructure as code with reviewed changes and canaried config, certificate expiry monitoring, and for regional failure a second region behind global routing with tested failover. Self-managed LBs (HAProxy/NGINX) need active-passive pairs with a floating IP (keepalived/VRRP) or anycast/ECMP — usually not worth it versus managed services.

</details>

**H2.** gRPC calls between services are unevenly distributed behind a Kubernetes Service. Explain why and design a fix.

<details>
<summary>Show answer</summary>

gRPC uses long-lived HTTP/2 connections that multiplex many requests; kube-proxy balances **connections** at L4, so each client sticks to the backend it connected to first, and new pods get no traffic until clients reconnect. Fixes: client-side load balancing (headless Service so DNS returns all pod IPs, gRPC `round_robin` policy, with periodic re-resolution), an L7 proxy/service mesh (Envoy/Linkerd/Istio) that balances per request, or server-side `MaxConnectionAge` to force periodic reconnection. Verify with per-pod request rate metrics.

</details>

## 🛠️ Mini Project — Load Balancer Lab with NGINX

**Goal**: See algorithms, health checks, and draining behave under load. 1-2 evenings.

**Build**

1. Docker Compose: NGINX (or HAProxy) in front of 3 Spring Boot instances; one instance configured to be 3x slower.
2. Compare round robin vs least connections under a k6 load test; record per-instance request counts and p95 latency.
3. Add active health checks (HAProxy) or passive failure handling (NGINX `max_fails`/`fail_timeout`); kill an instance mid-test and measure errors.
4. Implement graceful deployment: drain one instance, restart it with Spring graceful shutdown, and show zero failed requests.
5. Add a WebSocket endpoint and show how connection-based balancing behaves when instances are added.

**Acceptance criteria**: README with graphs per scenario and a recommendation for which algorithm and health-check design you'd use in production.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "You're designing a system that handles 100K requests per second. How do you set up load balancing?"**

First, I'd use a multi-tier approach: DNS-level load balancing (Route 53) for global distribution across regions. Within each region, an NLB for raw TCP performance at the entry point, routing to an ALB for HTTP-level routing to different microservices. Each service has an auto-scaling group behind the ALB target group. For 100K RPS, a single ALB can handle this — ALB scales automatically. I'd enable cross-zone load balancing so traffic is evenly distributed across AZs. Health checks every 10 seconds with a 3-failure threshold. Connection draining enabled so in-flight requests complete during deployments.

**Follow-up trap**: "What about WebSocket connections at this scale?" → WebSockets are long-lived, so Least Connections algorithm is better than Round Robin. ALB supports WebSocket natively. But at 100K concurrent WebSocket connections, consider NLB for lower latency and static IPs.

</div>

<div class="callout-interview">

**Q: "What's the difference between load balancing and reverse proxy?"**

A reverse proxy (Nginx, Envoy) sits in front of servers and can do many things: SSL termination, caching, compression, rate limiting, AND load balancing. A load balancer is specifically focused on distributing traffic. In practice, Nginx IS both a reverse proxy and a load balancer. AWS ALB is primarily a load balancer with some reverse proxy features (SSL termination, header manipulation). The distinction matters architecturally: you might use Nginx as a reverse proxy on each server for local concerns (compression, caching) while using ALB as the load balancer for traffic distribution.

</div>

<div class="callout-interview">

**Q: "How do you do zero-downtime deployments with a load balancer?"**

Two approaches: (1) **Rolling deployment** — update servers one at a time. LB health check detects the server going down, stops sending traffic, server updates, comes back healthy, LB resumes traffic. (2) **Blue-Green** — spin up entirely new set of servers (green), point LB target group to green, drain connections from blue, terminate blue. ALB supports this natively with weighted target groups — you can shift 10% traffic to green, validate, then shift 100%. The key is **connection draining** — ALB waits for in-flight requests to complete (default 300s) before removing a server from rotation.

**Follow-up trap**: "What if the new version has a bug?" → With blue-green, instant rollback — just point LB back to blue. With rolling, you need to detect the issue fast (health checks, error rate monitoring) and halt the rollout.

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| L4 LB | Routes based on IP/port, doesn't inspect content |
| L7 LB | Routes based on URL, headers, cookies — full HTTP awareness |
| Round Robin | Distribute equally, one by one |
| Least Connections | Send to server with fewest active connections |
| Health Check | Periodic probe to verify server is alive |
| Sticky Session | Same user always hits same server (avoid if possible) |
| SSL Termination | Decrypt HTTPS at LB, forward HTTP to servers |
| Connection Draining | Let in-flight requests finish before removing server |
| Cross-Zone LB | Distribute traffic evenly across all AZs |
| ALB | AWS L7 load balancer for HTTP/HTTPS |
| NLB | AWS L4 load balancer for TCP/UDP, ultra-fast |

---

> **The best load balancer is invisible — users never know it exists, servers never feel overwhelmed, and when something fails, nobody notices.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's only public entry point is an AWS load balancer in front of the API gateway; health checks and graceful shutdown decide which pods get traffic during deploys.

**Continue the story:** [Chapter 12 · Deploying on Kubernetes](/tutorials/journey-12-kubernetes) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
