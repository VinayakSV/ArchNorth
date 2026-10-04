# Databases on AWS — RDS, Aurora, DynamoDB & ElastiCache: The Restaurant Storage Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Design — data model** · ShopNorth uses this in [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql)

</div>
<!-- sdlc-stage:end -->

## The Restaurant Storage Analogy

A busy restaurant stores food in different places for different reasons:

- **The main pantry with a strict ledger.** Every item is counted, every withdrawal recorded, and the count must always be right. That's a **relational database** — **RDS** or **Aurora**.
- **A second pantry next door, kept identical,** in case the first one floods. That's a **Multi-AZ standby**.
- **Printed copies of the inventory list** for the waiters, updated every few seconds. Handy for answering questions, but slightly behind. Those are **read replicas**.
- **A huge wall of numbered lockers.** You can open locker 4,812 instantly, but you can't ask "which lockers contain tomatoes?" unless you planned an index for it. That's **DynamoDB**, a key-value and document store.
- **The chef's countertop,** with the most-used ingredients within arm's reach. It's fast, but it's small and it's not the record of what you own. That's **ElastiCache**, an in-memory cache.

AWS runs all of these for you — hardware, patching, backups, failover — so the team can focus on the data model and queries. Choosing the right one for each job is the skill. The general decision framework is in [Database Decisions](/tutorials/database-decisions); this tutorial is about the AWS services.

## 1. The Menu and ShopNorth's Choices

| Service | Model | Strengths | ShopNorth uses it for |
|---------|-------|-----------|----------------------|
| **RDS for PostgreSQL** | Relational | SQL, transactions, constraints, mature tools | Catalog, orders, inventory (one database each) |
| **Aurora PostgreSQL** | Relational, cloud-native storage | Faster failover, up to 15 replicas, storage that grows itself, Global Database | Not yet — the planned upgrade path |
| **DynamoDB** | Key-value / document | Single-digit-millisecond access at any scale, serverless, no connections to manage | Idempotency records for Lambda functions |
| **ElastiCache (Redis OSS / Valkey)** | In-memory key-value | Sub-millisecond, rich data structures, TTLs | Carts, caches, the flash-deal counter, rate limits, the waiting room |
| **OpenSearch Service** | Search engine | Full-text search, facets, typo tolerance | Product search |

## 2. RDS for PostgreSQL in Practice

### ShopNorth's production configuration

| Setting | Value | Why |
|---------|-------|-----|
| Engine | PostgreSQL (current major version) | The team's skills, Flyway migrations (Chapter 4) |
| Instance class | `db.r7g.xlarge` (Graviton, memory-optimized) | Working set fits in memory; Graviton is fine for a managed database |
| Deployment | **Multi-AZ instance** — synchronous standby in another zone | Failover in 1-2 minutes, no data loss ([Replication & Sharding](/tutorials/replication-partitioning)) |
| Read replica | One for `orders`, for admin reports | Reports never compete with checkout |
| Storage | gp3 with **storage autoscaling** | Never run out of disk at 3 AM |
| Backups | Automated, 14-day retention, point-in-time recovery; **cross-region automated backups** to Hyderabad | DR plan: RPO of minutes |
| Encryption | KMS customer managed key; TLS required | Data at rest and in transit |
| Master password | Managed by RDS in Secrets Manager | No human knows it; apps use their own users |
| Deletion protection | On | A `terraform destroy` in the wrong account can't delete it |
| Parameter group | `log_min_duration_statement = 500ms`, `idle_in_transaction_session_timeout = 60s` | Slow-query visibility; stuck transactions can't hold locks forever |
| Maintenance window | Tuesday 03:00 IST | Minor version patches outside peak hours |

<div class="callout-info">

**Why not a Multi-AZ DB cluster with readable standbys?** It fails over faster (typically under 35 seconds) and its standbys can serve reads — but DB clusters don't support cross-region automated backups, and ShopNorth's DR plan relies on them. Reading the "limitations" page before choosing a deployment option is part of the job.

</div>

### Connections: the scarce resource

Every PostgreSQL connection is a server process using memory, and `max_connections` is finite. ShopNorth budgets connections per service (Chapter 12: 12 pods × 10), puts **PgBouncer** in front of the catalog database for bursty traffic (Chapter 14), and uses **RDS Proxy** for the Lambda sales report — Lambda can open connections faster than any database likes ([Lambda](/tutorials/aws-lambda)).

### Upgrades without drama

- **Minor versions**: applied in the maintenance window; the Multi-AZ standby is patched first and failed over to, so downtime is a short failover.
- **Major versions** (e.g., PostgreSQL 16 → 17): ShopNorth uses **RDS Blue/Green Deployments** — RDS creates a synchronized "green" copy on the new version, the team tests it, and a switchover takes about a minute, with guardrails that block it if replication isn't caught up.

## 3. Aurora: When to Upgrade

Aurora separates compute from a distributed storage layer that keeps **6 copies across 3 availability zones**:

| Capability | RDS PostgreSQL | Aurora PostgreSQL |
|-----------|----------------|-------------------|
| Failover | 1-2 min (Multi-AZ instance) | Usually under 30 s |
| Read replicas | Up to 15, each with its own storage (asynchronous) | Up to 15 sharing the cluster storage (low lag) |
| Storage | You provision; autoscaling grows it | Grows automatically, billed for what's used |
| Cross-region | Read replicas, cross-region backups | **Global Database**: typical lag under a second; promote a secondary region in minutes |
| Serverless | No | **Aurora Serverless v2** scales capacity in fine steps |
| Cost | Lower | Higher, especially for I/O-heavy workloads (I/O-Optimized pricing helps) |

ShopNorth's ADR says: move `orders` to Aurora when checkout's availability target rises above 99.95% (failover time matters), when reports need several replicas, or when the DR target needs an RPO of seconds (Global Database).

## 4. DynamoDB: Design for Your Access Patterns

DynamoDB stores **items** in **tables**, addressed by a **partition key** (and optionally a **sort key**). You design the keys from your queries — the opposite of relational modeling.

| Concept | Detail |
|---------|--------|
| Item size | Up to 400 KB |
| Capacity | **On-demand** (pay per request, instant scaling) or **provisioned** (with auto scaling, cheaper at steady load) |
| Reads | Eventually consistent by default; strongly consistent reads on request |
| Indexes | Global secondary indexes (different keys, eventually consistent) and local secondary indexes |
| Extras | Conditional writes, transactions, TTL expiry, Streams (change events), global tables (multi-region) |

If ShopNorth stored carts in DynamoDB, one cart would be a set of items under the same partition key:

| PK (partition key) | SK (sort key) | Attributes |
|--------------------|---------------|-----------|
| `CART#cust-7781` | `META` | `updatedAt`, `expiresAt` (TTL) |
| `CART#cust-7781` | `ITEM#SKU-48213` | `qty: 1`, `pricePaise: 249900` |
| `CART#cust-7781` | `ITEM#USB-C-CABLE-2M` | `qty: 2`, `pricePaise: 49900` |

A single `Query` on `PK = CART#cust-7781` returns the whole cart. What ShopNorth actually stores in DynamoDB today is **idempotency records** for its Lambda functions — a conditional write makes "run once" atomic:

```java
dynamo.putItem(b -> b
        .tableName("lambda-idempotency")
        .item(Map.of(
                "id", AttributeValue.fromS("sales-report#2026-11-07"),
                "expiresAt", AttributeValue.fromN(String.valueOf(
                        Instant.now().plus(Duration.ofDays(7)).getEpochSecond()))))   // TTL cleans it up later
        .conditionExpression("attribute_not_exists(id)"));
// ConditionalCheckFailedException → this report was already produced; skip it
```

<div class="callout-warn">

**Hot partitions are DynamoDB's version of the hot row.** All traffic for one partition key goes to one partition with its own throughput limits. A key like `DEAL#diwali-flash` that every shopper writes to will throttle no matter how much capacity the table has. Spread writes (e.g., `DEAL#diwali-flash#<0-9>`) or keep such counters in Redis, as ShopNorth does.

</div>

## 5. ElastiCache: Redis OSS and Valkey

ElastiCache runs Redis-compatible engines — **Redis OSS** or **Valkey** (the open-source fork, usually cheaper on ElastiCache).

| Option | Meaning | ShopNorth |
|--------|---------|-----------|
| Cluster mode disabled | One shard: a primary + up to 5 replicas | ✅ Primary + 1 replica in another zone |
| Cluster mode enabled | Data sharded across many primaries | Not needed yet |
| Multi-AZ with automatic failover | A replica is promoted if the primary fails | ✅ |
| Serverless | No nodes to size; scales automatically | An option for spiky workloads |
| Encryption + auth | TLS in transit, AUTH tokens or RBAC users | ✅ |

What ShopNorth keeps in Redis, and how much it can afford to lose:

| Data | TTL | If lost |
|------|-----|---------|
| Product page cache | 60 s (15 s for deal SKUs), with jitter | A cache miss — rebuilt from PostgreSQL |
| Carts | 30 days | Annoying for customers — must be protected from eviction |
| Flash-deal counter | Sale duration | Only a pre-filter; PostgreSQL's conditional update is the real check ([CAP Theorem](/tutorials/cap-theorem)) |
| Rate-limit counters | Seconds | A few extra requests get through briefly |
| Waiting-room queue | Sale duration | Customers lose their place — the gateway falls back to rate limits |

<div class="callout-warn">

**Know your eviction policy.** When Redis memory fills, `maxmemory-policy` decides what goes. With `allkeys-lru`, Redis may evict carts to make room for cache entries. ShopNorth sizes memory with 40% headroom, alarms at 70% usage, and uses `volatile-lru` so only keys with TTLs are candidates — and the H1 question below explores separating cache from state entirely.

</div>

Redis replication is asynchronous: a failover can lose the last few writes. That's why nothing in Redis is the only source of truth for money or stock.

## 6. Operating Managed Databases

| Metric (CloudWatch) | Watch for |
|---------------------|-----------|
| `CPUUtilization` | Sustained > 70% at peak — tune queries or scale up |
| `DatabaseConnections` | Approaching the connection budget |
| `FreeableMemory` | Falling steadily — the working set no longer fits |
| `FreeStorageSpace` | Even with autoscaling, alarm early |
| `ReadLatency` / `WriteLatency`, `DiskQueueDepth` | Storage is the bottleneck |
| `ReplicaLag` | Reports reading old data |
| ElastiCache `DatabaseMemoryUsagePercentage`, `Evictions` | Memory pressure — carts at risk |

**CloudWatch Database Insights / Performance Insights** show *which queries* use the database's time — the fastest path from "the database is slow" to the guilty query. And ShopNorth tests failover on purpose: "reboot with failover" in staging every month, and in the game day before each sale (Chapter 14).

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A database's storage filled up overnight after a logging table grew unexpectedly; the instance went into `storage-full` and stopped accepting writes, taking checkout down. **Decision**: Storage autoscaling with a sensible maximum, an alarm on `FreeStorageSpace` well before the limit, retention jobs for log-like tables (or moving them out of the main database), and partitioning for tables that grow forever.

</div>

<div class="callout-scenario">

**Scenario**: During a sale, a Redis instance used for both caching and carts hit its memory limit. Its eviction policy was `allkeys-lru`, so it evicted the least recently used keys — including carts of customers who had been browsing for a while. Customers returned to empty carts at checkout. **Decision**: Separate clusters for disposable cache data (eviction allowed) and state like carts (`noeviction`, memory alarms, sized for peak), so a cache surge can never destroy customer state.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** What's the difference between an RDS Multi-AZ standby and a read replica? Give a ShopNorth use for each.

<details>
<summary>Show answer</summary>

A **Multi-AZ standby** (instance deployment) is a synchronous copy in another zone used only for **failover** — it can't serve reads. ShopNorth: every production database has one, so a zone failure costs 1-2 minutes, not data. A **read replica** is an asynchronous, readable copy for **read scaling** — it may lag and can be promoted manually. ShopNorth: the `orders` read replica serves admin reports.

</details>

**L2.** Design the DynamoDB key schema for "get all items in a customer's cart" and "update one item's quantity".

<details>
<summary>Show answer</summary>

Partition key `PK = CART#<customerId>`, sort key `SK = ITEM#<sku>` (plus a `META` item for cart-level data with a TTL attribute). "All items" is one `Query` on `PK`; "update one item" is an `UpdateItem` on `(PK, SK)`, using a condition expression if it must not go negative or must match a version. The whole cart lives in one partition, which is fine because one customer's cart is small and not a hot key.

</details>

### 🟡 Medium — Apply it

**M1.** ShopNorth plans a PostgreSQL major version upgrade for the orders database. Describe a safe process on RDS.

<details>
<summary>Show answer</summary>

Check extension and driver compatibility; run the migration tests and the regression suite against the new version in staging (restore a production snapshot into staging for realistic data). In production, create an **RDS Blue/Green Deployment**: RDS builds a "green" copy on the new version kept in sync by logical replication; run read-only checks against green; plan the switchover in a low-traffic window (not near a sale), confirm replication lag is near zero, and switch over (about a minute; connections reset). Keep the blue environment for a while as a fallback. Alternatives without Blue/Green: snapshot and `ModifyDBInstance` major upgrade (longer downtime), or a logical replication cut-over you manage yourself.

</details>

**M2.** A Lambda function reading from RDS fails with "too many connections" during spikes. Fix it in two layers.

<details>
<summary>Show answer</summary>

**Connection layer:** put **RDS Proxy** between Lambda and the database — it pools connections and multiplexes many Lambda environments over fewer database connections; create connections outside the handler so warm invocations reuse them. **Concurrency layer:** set **reserved concurrency** on the function to a number the database can serve, and if the workload is bursty writes, buffer them in SQS and consume with controlled batch size. Also budget the database's `max_connections` across all clients and alarm on `DatabaseConnections`.

</details>

### 🔴 High — Think like a senior

**H1.** Redesign ShopNorth's Redis usage so a cache surge can never lose carts, and estimate the cost difference.

<details>
<summary>Show answer</summary>

Split by data value: **`shopnorth-cache`** (product cache, rate limits) with `allkeys-lru`, sized for hit ratio, no persistence needs, can even be Serverless; **`shopnorth-state`** (carts, waiting room, deal counters) with `noeviction`, Multi-AZ with a replica, memory alarms at 70%, daily snapshots, sized for peak carts plus headroom. Alternatively, move carts to **DynamoDB** (durable, no memory ceiling, on-demand pricing per request, TTL for abandoned carts) and keep Redis purely as a cache. Cost: a second small replicated Redis cluster (two `r7g.large`-class nodes) is a modest monthly line; DynamoDB on-demand for carts depends on writes per cart update — at ShopNorth's volume, likely tens of dollars a month. Either is cheap compared with customers losing carts on sale night. Record the decision in an ADR with a load test of the new setup.

</details>

**H2.** The founders ask for an RPO of 1 minute and an RTO of 15 minutes for a regional disaster. What does that change in the database layer?

<details>
<summary>Show answer</summary>

Cross-region automated backups (minutes of RPO, hours of RTO with Terraform rebuild) don't meet a 15-minute RTO. Options: **Aurora Global Database** for `orders` and `inventory` (typical replication lag under a second; promote the Hyderabad secondary in minutes), or RDS **cross-region read replicas** that can be promoted (asynchronous, RPO usually seconds to minutes, manual promotion). The rest of the stack must also be ready in 15 minutes: a warm standby EKS cluster with services deployed and scaled small, images in ECR there, secrets replicated, Redis rebuilt (carts may be lost or replicated with a global datastore), Kafka mirrored with MSK Replicator if events in flight matter, and Route 53 failover records with low TTLs. Cost roughly doubles parts of the platform — present it as a business decision with numbers, and rehearse the failover twice a year.

</details>

## 🛠️ Mini Project — Three Stores, One Feature

**Goal**: Implement "carts" three ways and compare. 1-2 weekends (use the smallest instance sizes and delete them after).

**Build**

1. Create a small RDS PostgreSQL instance (single-AZ to save cost) with a parameter group that logs queries slower than 200 ms; implement carts as tables with Flyway.
2. Create a DynamoDB table (on-demand) with `PK`/`SK` and a TTL attribute; implement the same cart operations with the Java SDK v2, including a conditional write that prevents negative quantities.
3. Create a small ElastiCache Valkey or Redis cluster (or run Redis locally) and implement carts as hashes with a TTL.
4. Write a k6 test for "add item / view cart" against each implementation; record p95 latency and errors.
5. Reboot the RDS instance and the cache node during the test; note what each implementation lost or how long it was unavailable.
6. Write a short ADR: which store you'd choose for carts at ShopNorth and why.

**Acceptance criteria**: three working implementations, a results table (latency, failure behavior, monthly cost estimate), and an ADR with a decision.

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you make an RDS database highly available, and how do you scale its reads?"**

For availability, a Multi-AZ deployment: a synchronous standby in another availability zone that RDS promotes automatically if the primary or its zone fails, typically within one to two minutes, with no committed data lost. Applications reconnect through the same endpoint, so they need retries and a short DNS cache. For reads, read replicas, which are asynchronous, so I route only lag-tolerant queries to them, like reports and analytics, and alarm on replica lag. Backups with point-in-time recovery cover logical mistakes, which replicas would copy, and cross-region backups cover regional disasters. If failover time or replica lag matters more, I'd look at Aurora.

</div>

<div class="callout-interview">

**Q: "When would you choose DynamoDB over PostgreSQL?"**

When the access patterns are known and key-based, the scale or burstiness is high, and I want no servers, connections, or capacity planning, for example sessions, carts, idempotency records, event deduplication, user preferences, or high-volume time series keyed by device. I'd stay with PostgreSQL when I need ad-hoc queries, joins, complex transactions across many entities, or constraints that enforce business rules, like an order system with reporting. DynamoDB requires designing keys and indexes from the queries up front. Changing access patterns later is harder than adding an index in SQL.

</div>

<div class="callout-interview">

**Q: "What can go wrong with ElastiCache, and how do you design around it?"**

Memory can fill up, and the eviction policy may then delete data you care about, so I size with headroom, alarm on memory and evictions, and keep disposable cache data apart from state like carts. Replication is asynchronous, so a failover can lose the latest writes. Redis must never be the only record of money or stock. Hot keys can saturate a single shard. Cache stampedes after expiry or a restart can flood the database, which I prevent with TTL jitter, single-flight loading, and pre-warming before known peaks. And connection storms from many clients need pooling and timeouts.

</div>

## Quick Reference

| Need | Service | Key setting |
|------|---------|-------------|
| Relational + HA | RDS Multi-AZ | Synchronous standby, 1-2 min failover |
| Read scaling | Read replicas | Asynchronous — route lag-tolerant reads only |
| Faster failover / many replicas / global | Aurora (Global Database) | 6 copies in 3 AZs; < 30 s failover |
| Many short connections (Lambda) | RDS Proxy | Pools and multiplexes |
| Major upgrades | RDS Blue/Green Deployments | ~1 minute switchover |
| Key-value at any scale | DynamoDB | Keys from access patterns; on-demand or provisioned |
| Sub-ms cache and state | ElastiCache (Redis OSS / Valkey) | Eviction policy, Multi-AZ, memory alarms |
| Disaster recovery | Cross-region backups / Global Database | Matches RPO and RTO |

> **Golden rule: choose each store by what losing its data would cost — the ledger gets synchronous standbys and backups; the countertop gets TTLs and nobody's money.**

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth runs three RDS PostgreSQL Multi-AZ databases with cross-region backups, a read replica for reports, ElastiCache for carts and caching, OpenSearch for search, and DynamoDB only for Lambda idempotency. Chapter 4 designs the PostgreSQL schema that makes overselling impossible.

**Continue the story:** [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
