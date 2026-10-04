# How to Think in Architecture — Making Decisions You Won't Regret

## Why This Tutorial Exists

Architecture is decision-making. Every day, you choose: SQL or NoSQL? REST or gRPC? Redis or Memcached? AWS or GCP? Most tutorials tell you WHAT each technology does. This tutorial teaches you HOW to evaluate trade-offs and make decisions that hold up under real-world pressure.

---

## The Architecture Decision Framework

Every technology decision follows the same pattern:

```mermaid
flowchart TB
    A["1. What PROBLEM am I solving?"] --> B["2. What are my CONSTRAINTS?"]
    B --> C["3. What are my OPTIONS?"]
    C --> D["4. What are the TRADE-OFFS?"]
    D --> E["5. What's REVERSIBLE vs IRREVERSIBLE?"]
    E --> F["6. DECIDE and DOCUMENT why"]
```

### The Most Important Rule

> **Understand the problem before evaluating solutions. Most bad architecture decisions come from solving the wrong problem.**

<div class="callout-scenario">

**Scenario**: Team says "We need Redis for caching." Ask: "What problem are we solving?" Answer: "The product page loads in 3 seconds." Better question: "WHY does it take 3 seconds?" Investigation reveals: 5 unoptimized SQL queries with missing indexes. Fix: Add indexes → page loads in 200ms. No Redis needed.

**Lesson**: The solution to "it's slow" isn't always "add cache." Sometimes it's "fix the query." Always diagnose before prescribing.

</div>

---

## Framework 1: Database Decisions

```mermaid
flowchart TB
    A["I need a database"] --> B{"What's the access pattern?"}
    B -->|"Complex queries, JOINs,<br/>transactions, relationships"| C["Relational (SQL)<br/>PostgreSQL / MySQL"]
    B -->|"Simple key-value lookups,<br/>massive scale"| D["Key-Value / Document<br/>DynamoDB / MongoDB"]
    B -->|"Time-series data<br/>(logs, metrics, IoT)"| E["Time-Series<br/>InfluxDB / TimescaleDB"]
    B -->|"Graph relationships<br/>(social network, recommendations)"| F["Graph DB<br/>Neo4j / Neptune"]
    B -->|"Full-text search"| G["Search Engine<br/>Elasticsearch / OpenSearch"]
    B -->|"Need multiple patterns"| H["Polyglot Persistence<br/>Use MULTIPLE databases"]
```

### The "When NOT to Use" Guide

| Technology | When NOT to use it | Common mistake |
|-----------|-------------------|----------------|
| **PostgreSQL** | When you need 100K+ writes/sec with simple key lookups | Using SQL for everything because "it's safe" |
| **MongoDB** | When you need complex JOINs or ACID transactions across collections | Using it because "schema-less is flexible" (you still need a schema — it's just implicit) |
| **DynamoDB** | When you don't know your access patterns upfront | Choosing it for "scalability" then struggling with query limitations |
| **Redis** | As your primary database (it's in-memory — data loss risk) | Using it as a database instead of a cache |
| **Elasticsearch** | As your primary database for writes | It's optimized for search, not for transactional writes |

<div class="callout-tip">

**Applying this** — In real projects, use polyglot persistence. An e-commerce system might use: PostgreSQL for orders (ACID transactions), DynamoDB for product catalog (fast reads, simple key lookups), Redis for session cache (fast, ephemeral), Elasticsearch for product search (full-text). Each database does what it's best at. The mistake is forcing one database to do everything.

</div>

---

## Framework 2: Communication Decisions

| I need to... | Use | Why not the alternative |
|-------------|-----|----------------------|
| Expose API to external clients | **REST** | gRPC requires protobuf — external clients expect JSON |
| Internal service-to-service, high performance | **gRPC** | REST has JSON serialization overhead, no streaming |
| Decouple services, handle spikes | **Message Queue (Kafka/SQS)** | Sync calls create tight coupling and cascading failures |
| Real-time bidirectional communication | **WebSocket** | REST is request-response only, no server push |
| Notify multiple services of an event | **Event Bus (SNS/EventBridge)** | Direct API calls create N point-to-point connections |

### The Decision: REST vs gRPC vs Messaging

```mermaid
flowchart TB
    A["Service A needs to talk to Service B"] --> B{"Who initiates?"}
    B -->|"A needs something from B NOW"| C{"External or internal?"}
    C -->|External| D["REST<br/>Universal, simple, cacheable"]
    C -->|Internal| E{"Need streaming or high throughput?"}
    E -->|Yes| F["gRPC<br/>Binary, fast, bidirectional streaming"]
    E -->|No| G["REST<br/>Simpler, good enough"]
    B -->|"A tells B something happened<br/>(B processes when ready)"| H["Async Messaging<br/>Kafka / SQS"]
```

---

## Framework 3: Caching Decisions

### Should I Cache This?

```mermaid
flowchart TB
    A["Should I cache this data?"] --> B{"Read:Write ratio > 10:1?"}
    B -->|No, mostly writes| C["DON'T cache<br/>Cache invalidation overhead > benefit"]
    B -->|Yes, read-heavy| D{"Can users tolerate stale data?"}
    D -->|"No — must be real-time<br/>(stock prices, inventory count)"| E["DON'T cache<br/>Or cache with very short TTL (1-5 sec)"]
    D -->|"Yes — slightly stale is OK<br/>(product catalog, user profile)"| F["CACHE IT ✅"]
    F --> G{"How often does it change?"}
    G -->|"Rarely (hours/days)"| H["Long TTL (1-24 hours)"]
    G -->|"Frequently (minutes)"| I["Short TTL (30-300 sec)<br/>+ stale-while-revalidate"]
```

### Cache Invalidation — The Hardest Problem

| Strategy | How it works | When to use |
|----------|-------------|-------------|
| **TTL (Time-To-Live)** | Data expires after X seconds | When slightly stale data is acceptable |
| **Write-through** | Update cache AND database together | When you need cache to always be fresh |
| **Write-behind** | Update cache immediately, database later (async) | When write performance matters more than consistency |
| **Cache-aside** | App checks cache → miss → query DB → populate cache | Most common, simplest to implement |
| **Event-based invalidation** | Database change triggers cache delete | When you need fresh data but can't use write-through |

<div class="callout-warn">

**Warning**: The most dangerous cache bug is serving stale data that LOOKS correct. A user updates their email, but the cached profile still shows the old email. They think the update failed and contact support. Always invalidate cache on writes, or use short TTLs for user-facing data.

</div>

---

## Framework 4: The Reversibility Test

Before making any architecture decision, ask: **"How hard is it to change this later?"**

| Decision | Reversibility | Implication |
|----------|--------------|-------------|
| Choosing a programming language | **Very hard** — rewrite everything | Spend more time deciding |
| Choosing a database | **Hard** — data migration is painful | Spend more time deciding |
| Choosing a message queue | **Medium** — abstraction layer helps | Decide reasonably, abstract the interface |
| Choosing a cache | **Easy** — swap Redis for Memcached with minimal code change | Decide quickly, optimize later |
| Choosing an API format | **Easy** — add a new endpoint, deprecate old | Decide quickly |
| Choosing a cloud provider | **Very hard** — vendor lock-in | Evaluate carefully, use abstractions where possible |

<div class="callout-tip">

**Applying this** — For reversible decisions, decide fast and move on. For irreversible decisions, invest time in evaluation. Jeff Bezos calls these "one-way doors" vs "two-way doors." Most decisions are two-way doors — you can change them later. Don't spend a week debating Redis vs Memcached. Spend that week on database choice — that's a one-way door.

</div>

---

## Framework 5: The "What Happens When It Fails" Test

For EVERY technology choice, ask: "What happens when this component is down for 5 minutes?"

| Component down | Impact | Your design should... |
|---------------|--------|---------------------|
| Cache (Redis) | Requests hit database directly | DB should handle the load (maybe slower) — fail-open |
| Database | Nothing works | Read replica failover, connection retry, circuit breaker |
| Message queue | Events are lost or delayed | Producer retries, consumer idempotency, dead letter queue |
| External API | Your feature is broken | Circuit breaker, fallback response, cached last-known-good |
| CDN | Static assets don't load | Origin server serves directly (slower but works) |
| Auth service | Nobody can log in | Cache auth tokens locally, allow existing sessions to continue |

<div class="callout-interview">

🎯 **Interview Ready** — After presenting your architecture, proactively say: "Let me walk through failure modes. If Redis goes down, the app falls back to database queries — slower but functional. If the payment service is down, the circuit breaker returns 'payment processing' and we retry via a queue. If the database goes down, we have a read replica that promotes automatically. No single component failure takes down the entire system." This shows you think about production reality, not just happy-path design.

</div>

---

<!-- practice-pack -->

## 🏢 More Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A team adopts a graph database for "flexibility" in a new product. Eighteen months later, nobody on the team can operate it well, backups are fragile, and 90% of queries are simple lookups that PostgreSQL would have handled. Migrating out takes a quarter. **Decision**: The decision was made without the questions this tutorial teaches — no access-pattern analysis, no reversibility check, no team-skill check, and no written record of the reasoning. An **Architecture Decision Record (ADR)** with context, options, trade-offs, and "what would make us revisit this" would have surfaced the risk in an hour of review.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Classify as one-way door (hard to reverse) or two-way door (easy to reverse): (a) choosing a logging library, (b) choosing the primary database for core transactions, (c) public API URL structure, (d) an internal service's thread-pool size, (e) event schema for a topic consumed by 12 teams.

<details>
<summary>Show answer</summary>

Two-way: (a), (d). One-way (or expensive): (b) data migration is costly, (c) external clients depend on it, (e) many consumers depend on the contract. Spend design time proportional to the cost of reversal; decide two-way doors fast.

</details>

**L2.** Write the five sections of a minimal ADR.

<details>
<summary>Show answer</summary>

**Title and status** (proposed / accepted / superseded), **Context** (the problem, constraints, forces), **Options considered** (with pros and cons), **Decision** (what and why), **Consequences** (what becomes easier or harder, risks, and triggers to revisit). Keep it to one page and store it in the repository next to the code.

</details>

**L3.** For "service A needs data from service B", list three communication options and when each fits.

<details>
<summary>Show answer</summary>

**Synchronous call** (REST/gRPC) — A needs the answer now and B is reliable; couples availability. **Asynchronous events** — A reacts to B's changes and can tolerate delay; decouples availability, adds eventual consistency. **Local replica** (A keeps a copy built from B's events) — A reads B's data often with low latency; costs storage and staleness handling.

</details>

### 🟡 Medium — Apply it

**M1.** Your team wants to introduce Kafka for one feature. Run the "what happens when it fails" test.

<details>
<summary>Show answer</summary>

Ask: if Kafka is unavailable, do producers block, drop, or buffer (and for how long)? Are messages lost on producer crash (acks, idempotence, outbox)? If consumers fall behind, what's the user impact and how do we see lag? If a message is poison, where does it go (DLQ)? If a bad event is published, how do we replay or correct? Who operates Kafka (managed vs self-hosted), and does the team have the skills? If the honest answers are weak and the feature needs one queue, a simpler option (a DB outbox table polled by a worker, or a managed queue) may be better.

</details>

**M2.** Two senior engineers disagree: one wants microservices, one wants a modular monolith. How do you resolve it?

<details>
<summary>Show answer</summary>

Move from opinions to criteria: team size and structure, deployment independence needs, scaling differences between modules, operational maturity (CI/CD, observability, on-call), and domain boundary clarity. Write both options in an ADR with these criteria, timebox a spike if a key unknown exists, and choose the more reversible option when evidence is equal — usually a modular monolith with enforced module boundaries, which can be split later along those boundaries. Agree on the trigger that would change the decision.

</details>

**M3.** Evaluate adding Redis caching to a slow product page. What questions come before "yes"?

<details>
<summary>Show answer</summary>

Why is it slow — have we profiled (missing index? N+1 queries?) — caching can hide a fixable problem. What's the read/write ratio and acceptable staleness? How will we invalidate (TTL, events)? What happens on cache failure (fallback to DB — can it handle full load?) and on a cold start (stampede protection)? Memory size and cost? Who operates it? Caching is right when reads dominate, staleness is acceptable, and the underlying query is already reasonable.

</details>

### 🔴 High — Think like a senior

**H1.** You join a company with 40 microservices and no ADRs. How do you introduce architecture governance without slowing teams down?

<details>
<summary>Show answer</summary>

Lightweight and pull-based: an ADR template in each repo, required only for decisions above a threshold (new datastore, new public API, cross-team contracts, new infrastructure). A weekly 30-minute architecture forum where teams bring decisions for feedback (advisory, not approval, except for a short list of guardrails like security and data residency). Paved roads (service templates with logging, metrics, auth, CI preconfigured) so the easy path is the right one. Retroactively document the 5-10 most important existing decisions. Measure success by fewer production surprises and faster onboarding, not by document count.

</details>

**H2.** A decision made two years ago (MongoDB for orders) is now causing pain. Make the case for or against migrating.

<details>
<summary>Show answer</summary>

Quantify the pain: incidents caused, developer time lost to workarounds (e.g., multi-document transactions, reporting joins), and performance or cost issues. Estimate migration cost and risk: data volume, dual-write or CDC strategy, downtime tolerance, team capacity. Consider intermediate options: fix the schema/indexes, add a relational read model for reporting via CDC, or migrate only the transactional core. Recommend with numbers ("we lose ~3 engineer-weeks per quarter; migration costs ~10 weeks with a strangler approach; payback in under a year") and a phased plan with rollback points. Without numbers, it's just preference.

</details>

## 🛠️ Mini Project — ADR Practice Repository

**Goal**: Practice writing decisions that hold up to review. 1 week, 30 minutes a day.

**Build**

1. Pick a system you know (your current product, or a design from this site) and write 6 ADRs: primary database, sync vs async communication between two services, caching strategy, authentication approach, deployment platform, and one decision you'd reverse today.
2. Each ADR includes options, trade-offs, the failure test, the reversibility rating, and revisit triggers.
3. Ask a peer to review two of them with the questions from this tutorial; record their challenges and your responses.
4. Add a `docs/adr/` folder and an index to a real repository you work on.

**Acceptance criteria**: six one-page ADRs, each naming at least two rejected options and one condition that would change the decision.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you make architecture decisions in your team?"**

I use a structured approach: (1) **Write an ADR (Architecture Decision Record)** — a short document with: Context (what's the problem), Options (what are the alternatives), Decision (what we chose), Consequences (trade-offs). (2) **Evaluate against constraints** — budget, timeline, team expertise, scale requirements. (3) **Prototype if uncertain** — for irreversible decisions, build a small proof-of-concept before committing. (4) **Get peer review** — share the ADR with the team, incorporate feedback. (5) **Document the "why not"** — future engineers will ask "why didn't we use X?" The ADR answers that. The key is making the decision EXPLICIT and DOCUMENTED, not just "we chose Kafka because someone suggested it in a meeting."

**Follow-up trap**: "What if the team disagrees?" → Disagree and commit. Discuss thoroughly, hear all perspectives, but someone (tech lead/architect) makes the final call. Endless debate is worse than a slightly suboptimal decision. You can always revisit if the decision proves wrong — that's why reversibility matters.

</div>

<div class="callout-interview">

**Q: "How do you evaluate a new technology you've never used?"**

Five-step evaluation: (1) **What problem does it solve?** If I don't have that problem, I don't need it. (2) **What are the trade-offs?** Every technology optimizes for something at the cost of something else. (3) **Who else uses it at similar scale?** If only startups with 100 users use it, it's unproven at my scale. (4) **What's the operational cost?** Can my team run it? Is there managed service? What's the learning curve? (5) **What's the exit strategy?** If it doesn't work out, how hard is it to migrate away? I never adopt technology because it's "trending." I adopt it because it solves a specific problem better than my current solution, and the migration cost is justified.

</div>

<div class="callout-interview">

**Q: "Tell me about an architecture decision you got wrong. What did you learn?"**

Interviewers want reflection, not perfection. Use a real story in this shape: the context and the constraints at the time; the decision and why it seemed right; the signal that showed it was wrong (incidents, cost, delivery speed); how you corrected course, ideally incrementally, such as a strangler migration or adding a read model; and what changed in how you decide now. For example: "Now I write the failure test and reversibility into every ADR", or "Now I prototype with production-like data volumes before choosing a datastore". Own the mistake without blaming others, and show that you changed your process, not just the system.

</div>

---

## Quick Reference — The Architecture Decision Cheat Sheet

| Decision area | Key question | Decision driver |
|--------------|-------------|-----------------|
| Database | What's the access pattern? | Queries → SQL. Key-value → NoSQL. Both → Polyglot |
| Communication | Does the caller need an immediate response? | Yes → Sync. No → Async |
| Caching | Read:Write ratio > 10:1? Stale data OK? | Both yes → Cache. Either no → Don't cache |
| Scaling | Where's the bottleneck? | DB → Cache/Shard. App → Horizontal scale. Network → CDN |
| Consistency | Financial/inventory data? | Yes → Strong consistency. No → Eventual is fine |
| Reversibility | One-way door or two-way door? | One-way → Invest time. Two-way → Decide fast |

---

> **The best architects don't know the most technologies. They ask the best questions. "What problem are we solving?" eliminates 80% of bad decisions before they're made.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's architecture decision records (number of services, cart storage, reserve-before-pay) follow this framework.

**Continue the story:** [Chapter 2 · System Design (HLD)](/tutorials/journey-02-system-design) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
