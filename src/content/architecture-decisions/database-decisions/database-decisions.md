# Database Decisions — When to Pick What and Why

## The Decision Framework

Every database choice comes down to 4 questions:
1. **What's your access pattern?** — Read-heavy? Write-heavy? Both?
2. **Do you need transactions?** — ACID or eventual consistency?
3. **What's your scale?** — 1K rows or 1B rows?
4. **What's your query complexity?** — Simple key-value or complex joins?

---

## SQL vs NoSQL — The Real Decision

### It's NOT about "modern vs legacy"

```
❌ "NoSQL is faster" — Wrong. PostgreSQL handles 100K+ TPS.
❌ "SQL doesn't scale" — Wrong. Vitess runs YouTube's MySQL at billions of rows.
❌ "NoSQL is schema-less" — Wrong. You just moved the schema to application code.
```

### When to pick what

| Scenario | Pick | Why |
|----------|------|-----|
| E-commerce orders, payments | PostgreSQL | ACID transactions, complex queries (joins), data integrity |
| User sessions, shopping cart | Redis / DynamoDB | Simple key-value, high throughput, TTL support |
| Product catalog (read-heavy) | DynamoDB / MongoDB | Denormalized reads, flexible schema, auto-scaling |
| Analytics, time-series | ClickHouse / TimescaleDB | Columnar storage, fast aggregations |
| Social graph (friends, followers) | Neo4j / Neptune | Relationship traversal, graph queries |
| Full-text search | Elasticsearch | Inverted index, relevance scoring |
| Chat messages | Cassandra / ScyllaDB | Write-heavy, time-ordered, partition by conversation |

<div class="callout-scenario">

**Scenario**: You're building an e-commerce platform. Product catalog is read 1000x more than written. Orders need ACID. User sessions expire after 30 min. **Answer**: PostgreSQL for orders, DynamoDB for catalog (denormalized), Redis for sessions. Three databases, each optimized for its access pattern.

</div>

---

## Schema Design — Performance First

### Normalization vs Denormalization

**Normalized** (3NF) — No data duplication, joins required
```sql
-- 3 tables, 2 joins to get order details
SELECT o.id, u.name, p.title, oi.quantity
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.id = 12345;
```

**Denormalized** — Data duplicated, no joins needed
```sql
-- 1 table, 0 joins
SELECT order_id, user_name, product_title, quantity
FROM order_details_view
WHERE order_id = 12345;
```

### When to denormalize

| Signal | Action |
|--------|--------|
| Read:Write ratio > 100:1 | Denormalize read paths |
| Join queries > 50ms at p99 | Materialize the join as a view/table |
| Same join query called > 1000 RPS | Create a read-optimized table |
| Data changes < 1x/hour | Safe to denormalize (stale data acceptable) |

<div class="callout-tip">

**Applying this** — Normalize your write path (source of truth). Denormalize your read path (optimized for queries). Use CDC (Change Data Capture) or events to keep them in sync. This is the CQRS pattern applied to database design.

</div>

---

## Indexing — The #1 Performance Lever

### How indexes work (simplified)

Without index: Database scans every row (full table scan). 10M rows = 10M comparisons.

With index: Database uses a B-tree to find the row in ~23 comparisons (log₂ of 10M).

### Index Decision Matrix

| Query Pattern | Index Type | Example |
|--------------|-----------|---------|
| `WHERE user_id = ?` | B-tree (default) | `CREATE INDEX idx_user ON orders(user_id)` |
| `WHERE email = ?` (unique) | Unique index | `CREATE UNIQUE INDEX idx_email ON users(email)` |
| `WHERE status = ? AND created_at > ?` | Composite | `CREATE INDEX idx_status_date ON orders(status, created_at)` |
| `WHERE name ILIKE '%john%'` | GIN trigram | `CREATE INDEX idx_name_trgm ON users USING gin(name gin_trgm_ops)` |
| `WHERE location <-> point(x,y) < 1000` | GiST spatial | `CREATE INDEX idx_geo ON stores USING gist(location)` |
| `WHERE tags @> '{java}'` | GIN array | `CREATE INDEX idx_tags ON posts USING gin(tags)` |

### Composite Index Column Order Matters

```sql
-- Index: (status, created_at)

-- ✅ Uses index fully
WHERE status = 'ACTIVE' AND created_at > '2024-01-01'

-- ✅ Uses index (left prefix)
WHERE status = 'ACTIVE'

-- ❌ Cannot use index (skips left column)
WHERE created_at > '2024-01-01'
```

**Rule**: Put equality columns first, range columns last.

### When NOT to index

| Situation | Why |
|-----------|-----|
| Table < 1000 rows | Full scan is faster than index lookup |
| Column with < 5 distinct values | Index selectivity too low (e.g., boolean) |
| Write-heavy table (> 80% writes) | Every write updates every index — slows inserts |
| Column rarely queried | Index wastes storage and slows writes for no benefit |

---

## Sharding — When and How

### When do you need sharding?

```
Single PostgreSQL instance:
  ✅ Up to ~500GB data
  ✅ Up to ~50K TPS (read + write)
  ✅ Up to ~500 connections

If you're below these → DON'T SHARD. Use read replicas instead.
```

### Horizontal Sharding Strategies

**1. Range-based** — Shard by date range
```
Shard 1: Jan-Mar 2024
Shard 2: Apr-Jun 2024
Shard 3: Jul-Sep 2024
```
- ✅ Simple, time-series friendly
- ❌ Hot shard problem (current month gets all writes)

**2. Hash-based** — Shard by hash of key
```
shard_id = hash(user_id) % num_shards
```
- ✅ Even distribution
- ❌ Range queries across shards are expensive
- ❌ Adding shards requires reshuffling

**3. Directory-based** — Lookup table maps key to shard
```
user_id 1-1000    → Shard A
user_id 1001-5000 → Shard B
user_id 5001+     → Shard C
```
- ✅ Flexible, can rebalance without reshuffling
- ❌ Lookup table is a single point of failure

**4. Tenant-based** (for SaaS) — One shard per tenant or group
```
Tenant: Acme Corp    → Shard 1 (dedicated, they pay for it)
Tenant: Small Co 1-50 → Shard 2 (shared)
Tenant: Small Co 51-100 → Shard 3 (shared)
```
- ✅ Perfect tenant isolation
- ✅ Can give big tenants dedicated resources
- ❌ Uneven shard sizes

<div class="callout-tip">

**Applying this** — Before sharding, exhaust these options first: (1) Add read replicas, (2) Add indexes, (3) Optimize queries, (4) Add caching layer, (5) Vertical scaling (bigger instance). Sharding adds massive operational complexity — it should be your last resort, not your first.

</div>

<div class="callout-interview">

**Q: "When would you shard a database?"**

Only when you've exhausted vertical scaling, read replicas, caching, and query optimization. Sharding is for write throughput or data size that exceeds a single node. Choose hash-based for even distribution, tenant-based for SaaS isolation. Always pick a shard key that matches your most common query pattern — you can't efficiently query across shards.

</div>

---

## PostgreSQL vs MySQL vs DynamoDB — Decision Table

| Factor | PostgreSQL | MySQL | DynamoDB |
|--------|-----------|-------|----------|
| Complex queries | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| JSON support | ⭐⭐⭐ (JSONB) | ⭐⭐ | ⭐⭐⭐ (native) |
| Transactions | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ (limited) |
| Auto-scaling | ❌ (manual) | ❌ (manual) | ⭐⭐⭐ (automatic) |
| Ops overhead | Medium | Medium | Zero |
| Cost at scale | $$ | $$ | $$$ (can be expensive) |
| Best for | General purpose, analytics | Web apps, read-heavy | Key-value, serverless |

<div class="callout-scenario">

**Scenario**: Startup with 3 engineers, building fast, don't know final access patterns yet. **Pick PostgreSQL.** It handles JSON, full-text search, geospatial, time-series, and relational — all in one. You can always extract specific workloads to specialized databases later. Don't prematurely optimize with 5 databases when one will do.

</div>

---

<!-- practice-pack -->

## 🏢 More Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A SaaS company stores each tenant's data in one shared PostgreSQL database with a `tenant_id` column. A developer forgets the `WHERE tenant_id = ?` in one new report query, and a customer sees another company's invoices. **Decision**: Tenant isolation must not depend on every developer remembering a filter. Enable PostgreSQL **Row-Level Security** with a policy on `tenant_id = current_setting('app.tenant_id')`, set per request/transaction by the application, so a forgotten filter returns nothing instead of leaking. For customers with strict requirements, offer schema-per-tenant or database-per-tenant isolation, at higher operational cost.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Pick a datastore for each and say why: (a) orders and payments, (b) user sessions with 30-minute expiry, (c) product search with typo tolerance, (d) IoT sensor readings every second from 100K devices, (e) a social graph "friends of friends" feature.

<details>
<summary>Show answer</summary>

(a) Relational (PostgreSQL/MySQL) — transactions and constraints. (b) Redis — in-memory with TTL. (c) Elasticsearch/OpenSearch — inverted index, fuzzy matching, relevance. (d) A time-series database (TimescaleDB, InfluxDB) or a wide-column store (Cassandra) — high write rate, time-range queries, retention policies. (e) A graph database (Neo4j) if multi-hop traversals are central; otherwise relational with recursive queries can be enough at modest scale.

</details>

**L2.** What's the difference between vertical scaling, read replicas, and sharding?

<details>
<summary>Show answer</summary>

**Vertical**: a bigger machine — simplest, has a ceiling. **Read replicas**: copies that serve reads — scale reads, not writes, and introduce replication lag. **Sharding**: split data across multiple primaries by a key — scales writes and storage, but complicates cross-shard queries, transactions, and operations. Apply them in that order.

</details>

**L3.** Why is `SELECT *` on a wide table with an index on `email` still slower than `SELECT id, email`?

<details>
<summary>Show answer</summary>

With `SELECT *`, the database uses the index to find matching rows and then must fetch each full row from the table (heap) to get the other columns. If the index contains all requested columns (a **covering index**, e.g., an index on `(email)` with `INCLUDE (id)` or `id` as the primary key in InnoDB secondary indexes), it can answer from the index alone (index-only scan) — fewer page reads, less I/O.

</details>

### 🟡 Medium — Apply it

**M1.** Design the schema for multi-currency orders with line items, discounts, and taxes, avoiding floating-point money errors.

<details>
<summary>Show answer</summary>

Money as integer minor units (`amount_paise BIGINT`) or `NUMERIC(19,4)` plus a `currency CHAR(3)` column — never `FLOAT`/`DOUBLE`. Tables: `orders` (id, customer_id, currency, status, totals), `order_items` (order_id, product_id, quantity, unit_price, discount, tax, line_total), `order_adjustments` (order-level discounts, shipping). Store computed totals (for history and auditing) and recompute in tests to verify consistency. Prices at order time are copied into `order_items`, not referenced from the live product table.

</details>

**M2.** Your read replica lag spikes to 30 seconds and users see their just-placed order missing. Fix the user experience and the cause.

<details>
<summary>Show answer</summary>

UX: **read-your-writes** — route a user's reads to the primary for a short window after they write (e.g., a session flag or a "last write timestamp" compared to replica lag), or return the created order from the write response and show it client-side. Cause: long-running queries on the replica, heavy write bursts (bulk jobs), undersized replica, or replication settings — investigate with lag metrics and slow-query logs, move analytics to a separate replica, and throttle bulk writes.

</details>

**M3.** When would you choose DynamoDB over PostgreSQL for a new service?

<details>
<summary>Show answer</summary>

When access patterns are well known and key-based (get/put by partition key, range queries within a partition), scale is very high or very spiky, you want zero database operations (serverless, auto-scaling), and you can live without ad-hoc queries, joins, and multi-entity transactions beyond DynamoDB's limited transactions. Choose PostgreSQL when access patterns are evolving, you need relational integrity or reporting, or the team is still discovering the domain — the default for most new services.

</details>

### 🔴 High — Think like a senior

**H1.** A 2 TB `events` table makes queries slow and vacuum painful. Design a fix without sharding.

<details>
<summary>Show answer</summary>

**Partition by time** (PostgreSQL declarative range partitioning, e.g., monthly), so queries with a time filter only touch relevant partitions (partition pruning), indexes per partition are smaller, and retention becomes `DROP PARTITION` (instant) instead of a huge `DELETE` (bloat, WAL storms). Move old partitions to cheaper storage or archive them to object storage (Parquet) for analytics. Use BRIN indexes for time-ordered columns. Review the queries: add `created_at` filters everywhere.

</details>

**H2.** Migrate a 500 GB table's column type (`INT` → `BIGINT` primary key) on a live system with no downtime.

<details>
<summary>Show answer</summary>

Avoid an in-place `ALTER` that rewrites and locks the table. Expand-contract: add a new `id_new BIGINT` column; backfill in small batches (throttled, off-peak); keep it in sync for new writes via a trigger (or application dual-write); build the new indexes concurrently; then in a short maintenance window (seconds) swap the primary key constraint and rename columns; update foreign keys similarly beforehand. Alternatively use an online schema-change tool (pg-osc, gh-ost/pt-online-schema-change for MySQL). Rehearse on a production-size copy and monitor replication lag throughout.

</details>

## 🛠️ Mini Project — Database Decision Lab

**Goal**: Feel the trade-offs with real measurements. 1 week of evenings.

**Build**

1. Generate 10M orders + 30M order items into PostgreSQL (Docker).
2. Measure 5 common queries with `EXPLAIN (ANALYZE, BUFFERS)` before and after adding the right indexes (including one covering index and one partial index).
3. Partition an `events` table by month; compare query time and retention (`DELETE` vs `DROP PARTITION`).
4. Add a read replica (Docker Compose with streaming replication); simulate lag with a heavy load and implement read-your-writes routing in a Spring Boot app.
5. Implement Row-Level Security for `tenant_id` and prove a query without a filter returns no other tenant's rows.
6. Store the same order access patterns in DynamoDB Local with a single-table design; write one page comparing modeling effort and query flexibility.

**Acceptance criteria**: a README with before/after timings for every change, and the RLS leak test passing.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "SQL or NoSQL — how do you decide for a new service?"**

I start from the access patterns and consistency needs, not the technology. If the data is relational, needs transactions or constraints, or the access patterns aren't fully known yet, I pick PostgreSQL. It covers most needs, including JSON, full-text search, and decent scale with replicas and partitioning. I choose a NoSQL store when there's a specific reason: key-based access at very high or spiky scale (DynamoDB, Cassandra), a cache with TTL (Redis), search relevance (Elasticsearch), or time series. Many systems end up with PostgreSQL as the source of truth plus specialized stores fed from it.

**Follow-up trap**: "But NoSQL scales better." → Only for the access patterns it was designed for. You pay with query flexibility and transactional guarantees, and most products never outgrow a well-tuned PostgreSQL with read replicas.

</div>

<div class="callout-interview">

**Q: "Your database CPU is at 90% at peak. Walk me through what you'd do."**

First diagnose, then scale. I'd check the top queries by total time (`pg_stat_statements`), look for missing indexes, N+1 patterns, sequential scans, and lock contention. Fixing the top 3 queries often halves the load. Then, cheap structural fixes: a cache for hot reads, read replicas for read-heavy endpoints, connection pooling (PgBouncer) if connection churn is high, and moving reporting to a replica. Next comes vertical scaling for headroom. Partitioning and archiving come if data volume is the issue. Sharding is last, when write throughput truly exceeds one primary.

</div>

<div class="callout-interview">

**Q: "How would you implement multi-tenancy at the database level?"**

There are three models. A shared schema with a `tenant_id` column is the cheapest and scales to many small tenants; I'd enforce isolation with PostgreSQL Row-Level Security, not just application filters. Schema-per-tenant gives better isolation and per-tenant backups, but migrations multiply. Database-per-tenant gives the strongest isolation and noisy-neighbor protection, at the highest cost, so it's usually reserved for enterprise customers. Many SaaS products mix them: pooled for the long tail, dedicated for large or regulated tenants. Either way, include `tenant_id` in every index's leading columns, and a natural shard key emerges if you need to scale out later.

</div>

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's database-per-service setup, constraints, read replica for reports, and partitioning plan come from these decisions.

**Continue the story:** [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
