# Chapter 14 · Launch Day & Incidents

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 14 of 15 · Phase: **Operate & Evolve** · SDLC stage: **Operations — release & incidents**

**Previously:** ShopNorth is observable: traces, logs, and metrics tied together, SLOs from the NFRs, monitors with runbooks, synthetic tests every minute, and an automated canary check ([Chapter 13](/tutorials/journey-13-observability)).

**In this chapter:** Twelve weeks of work meet reality. You'll prepare for the Diwali sale, watch the 8 PM spike from the war room, live through a payment incident minute by minute, and write the postmortem that turns it into improvements.

</div>

## The Situation

Week 12. The sale starts Saturday at **8:00 PM**, with a flash deal: noise-cancelling headphones at 70% off, 1,000 units. Marketing has sent push notifications to 1.5 million customers.

Priya opens the launch readiness review: "Every risk from Chapter 1's register gets a status today: done, mitigated, or accepted — by name."

## Step 1 — Launch Readiness Review

| Area | Check | Status |
|------|-------|--------|
| **Capacity** | Load test at 2× the forecast (6,000 req/s, 300 orders/s) passed in staging | ✅ After fixes (Step 2) |
| **Spike** | 0 → 3,000 req/s in 60 s test passed with pre-scaling | ✅ |
| **Pre-scaling** | GitOps change ready: `minReplicas` raised at 6 PM, lowered Sunday 10 AM | ✅ Merged, scheduled |
| **Flash deal** | Waiting room + per-customer limit + Redis stock counter | ✅ |
| **Kill switches** | Feature flags to disable recommendations, reviews widget, non-essential emails; degrade search to category browse | ✅ Tested in staging |
| **Payments** | Backup payment provider integrated behind a flag (Chapter 1 risk register) | ✅ Tested with sandbox |
| **Rollback** | Canary abort and GitOps revert rehearsed this week | ✅ |
| **Runbooks** | Payment degraded, DB failover, Kafka down, zone failure, hot SKU | ✅ Rehearsed in game day |
| **People** | On-call: Kabir (primary), Arjun (secondary); incident commander: Priya; comms: Ananya | ✅ |
| **Freeze** | Code freeze since Monday; fixes only, through the pipeline | ✅ |
| **Partners** | Payment providers and SMS provider told the expected volumes | ✅ |
| **Customers** | Status page ready; support briefed with macros for known issues | ✅ |

## Step 2 — What the Load Tests Found

The first full-scale load test two weeks earlier *failed*, which is exactly why you run them early:

| Finding | Cause | Fix |
|---------|-------|-----|
| Flash-deal checkout p95 at 9 s | Thousands of reservations waiting on one `stock` row lock (the hot SKU) | Redis counter in front of the DB for deal SKUs; waiting room limits arrival rate |
| DB connection errors at 8 pods | Pool of 20 × pods + other services exceeded the limit | Pools to 10; `maxReplicas` capped; PgBouncer for the catalog DB |
| Catalog DB CPU spike at minute 5 | Thousands of product cache entries expired at the same moment (cache stampede) | TTL jitter (±20%), cache pre-warming before 8 PM, single-flight loading for misses |
| Order confirmation emails delayed 25 min | Notification consumer had 1 partition's worth of parallelism | Topic re-partitioned to 12; consumer concurrency raised |

## Step 3 — Protecting the Core During the Spike

**Rate limiting at the gateway** (Spring Cloud Gateway with Redis, per customer, so bots and retry storms can't starve real shoppers):

```yaml
- id: orders
  uri: http://order-service
  predicates:
    - Path=/api/orders/**
  filters:
    - StripPrefix=1
    - name: RequestRateLimiter
      args:
        redis-rate-limiter.replenishRate: 2       # sustained: 2 order requests per second per customer
        redis-rate-limiter.burstCapacity: 5
        key-resolver: "#{@customerKeyResolver}"   # bean that returns the JWT subject
```

**The flash deal** gets three layers:

1. A **waiting room** in front of the deal page admits customers at a rate checkout can handle and shows everyone else their place in the queue — fair, and honest.
2. A **Redis counter** holds the 1,000 deal units. An atomic script decrements it before the database is touched, so 99% of "sold out" answers never reach PostgreSQL:

```lua
-- KEYS[1] = deal stock key, ARGV[1] = quantity requested
local left = tonumber(redis.call('GET', KEYS[1]) or '0')
if left < tonumber(ARGV[1]) then
  return -1                                   -- sold out: no DB work at all
end
return redis.call('DECRBY', KEYS[1], ARGV[1]) -- then the normal DB reservation runs
```

3. **One unit per customer**, enforced in the reservation (a unique row per customer per deal).

The database reservation (Chapter 4) is still the source of truth; Redis just filters the flood in front of it. If a DB reservation fails after the Redis decrement, the unit is returned to the counter.

**Kill switches** (feature flags) let the team shed non-essential work in seconds: recommendations, the reviews widget, and "you might also like" emails. Customers barely notice; checkout gets the capacity.

## Step 4 — Sale Night: The War Room

At 6:00 PM, the pre-scaling change merges; Argo CD scales every service up, and Karpenter adds nodes. At 7:30 PM, synthetic traffic warms caches and JIT compilers. Ananya, Priya, Kabir, Arjun, Meera, and you sit in front of the checkout funnel dashboard.

**8:00 PM.** Traffic goes from 400 to 2,900 requests/s in 70 seconds. The waiting room holds 41,000 people for the flash deal and lets them in at 120 per second. The 1,000 headphones sell out in 6 minutes, with zero oversold. Checkout p95: 520 ms. The room exhales.

## Step 5 — 8:12 PM: The Incident

This is how ShopNorth's first serious incident unfolds, minute by minute.

| Time | What happened |
|------|---------------|
| **20:12** | Datadog monitor **"Payment success rate below normal — UPI"** fires: 96% → 61%. PagerDuty pages Kabir. |
| 20:13 | Kabir acknowledges. Priya takes the **incident commander** role and declares SEV-1 in `#inc-sale-upi`. Roles: Kabir investigates, Arjun supports, Ananya handles communication. |
| 20:14 | Dashboard: cards and netbanking are fine; only UPI is failing. Errors started at 20:11 on all pods and all versions — not a deploy. |
| 20:15 | Traces from the Payment service: calls to the provider's UPI endpoint take 9-10 s and time out. The provider's status page now says "UPI degraded". **Root cause is external.** |
| 20:16 | Arjun spots a second-order risk: thousands of orders are piling up in `PENDING_PAYMENT`. At 20:27, the 15-minute timeout job will start **cancelling orders whose UPI payment may still succeed late**, releasing their stock and leading to refunds and angry customers. |
| 20:17 | **Mitigation 1:** flag `order.timeout-cancellation.enabled` → off (the runbook's step 3). Holds are extended to 45 minutes. |
| 20:19 | **Mitigation 2:** flag `payments.upi.provider` → `backup`. New UPI payment sessions go to the backup provider, integrated in Sprint 5 because of a Chapter 1 risk. |
| 20:22 | Ananya publishes a status page note and an in-app banner: *"UPI payments may be slow right now. Cards and netbanking work normally."* Support gets a macro. |
| 20:24 | UPI success rate back to 94% (through the backup). Checkout SLO burn rate returns to normal. |
| 20:40 | Late webhooks from the primary provider arrive for earlier attempts; the normal flow marks those orders paid. A one-off job checks every remaining stuck order **with the provider's API** before cancelling. |
| 21:10 | The primary provider reports recovery. The team keeps the backup active until the sale's peak is over. |
| 21:15 | Incident resolved; monitoring continues. Timeout cancellation re-enabled at 23:00, now checking payment status first (a quick fix that went through the pipeline and canary). |

**Impact:** about 1,900 UPI attempts failed between 20:11 and 20:24; about 70% of those customers retried and completed their purchase. **Zero paid orders cancelled. Zero double charges.** Time to detect: 1 minute. Time to mitigate: 12 minutes.

Look at what made those 12 minutes possible — every one of them is an earlier chapter:

- The risk was written down in **Chapter 1**, so a backup provider existed.
- **Chapter 3's** state machine and **Chapter 6's** idempotent consumers made late webhooks safe.
- **Chapter 13's** business monitor caught it in one minute; traces found the cause in three.
- **Feature flags** (Chapter 11) meant mitigation without a deployment, during a code freeze.
- **Chapter 6, H2** had warned that the timeout job is dangerous when payments are delayed; the runbook included pausing it.

## Step 6 — The Blameless Postmortem

Monday morning. The postmortem focuses on **systems and decisions, not people**. Nobody is blamed for the provider's outage or for the timeout job's original design; the question is how to make the system safer.

```markdown
# Postmortem: UPI payment failures during the Diwali sale (SEV-1)

## Summary
From 20:11 to 20:24, 39% of UPI payments failed because the primary payment provider's UPI
service degraded. Mitigated by switching UPI to the backup provider.

## Impact
~1,900 failed UPI attempts; ~570 customers did not complete a purchase (estimated lost revenue: ₹X).
No paid orders cancelled; no double charges. Checkout SLO error budget: 18% consumed.

## Timeline
(see the incident log)

## Root cause and contributing factors
- Primary provider UPI degradation (external).
- Our payment client's 10 s timeout tied up threads during the degradation; retries amplified load.
- Failover to the backup provider was manual (a flag) and depended on a human noticing.
- The order timeout job would have cancelled orders with late payments; we caught it by luck and
  experience, not by design.

## What went well
- Detection in 1 minute via the business monitor; root cause found in 3 minutes with traces.
- Backup provider integrated and rehearsed in advance.
- Clear roles; customer communication within 10 minutes.

## What went wrong / where we got lucky
- The timeout-job risk was known but not fixed before the sale.
- No provider-latency monitor: we alerted on success rate only after customers failed.

## Action items
| # | Action | Owner | Due | Priority |
|---|--------|-------|-----|----------|
| 1 | Timeout job queries the provider for payment status before cancelling | Arjun | Nov 15 | P1 |
| 2 | Automatic UPI failover when the provider's success rate drops below 85% for 2 min | Kabir + you | Nov 30 | P1 |
| 3 | Monitor provider p95 latency per method (earlier warning than success rate) | Kabir | Nov 10 | P2 |
| 4 | Lower the payment client timeout to 4 s with a circuit breaker per provider | You | Nov 15 | P2 |
| 5 | Add "primary provider down" to the quarterly game day | Meera | Dec 1 | P3 |
```

<div class="callout-tip">

**"Where we got lucky" is the most valuable section.** Things that *almost* went wrong — like the timeout job — are free lessons. Teams that only fix what actually broke keep getting surprised by its near-misses.

</div>

## Step 7 — After the Sale: Close the Loop

| Forecast (Chapter 1) | Actual |
|----------------------|--------|
| 3,000 requests/s peak | 3,400 requests/s (pre-scaling had headroom) |
| 60,000 orders | 71,500 orders |
| Checkout p95 < 800 ms | 610 ms at peak |
| 99.9% availability | 99.97% for the day (the UPI incident hit payments, not checkout) |

Sunday morning, the GitOps change scales everything back down, and Kabir reviews the cloud bill. Monday, the postmortem actions become stories in the backlog, next to Ananya's new requirements from what customers did during the sale. **That's the SDLC loop:** operations feed requirements, and the cycle starts again — this time with real data instead of estimates.

<!-- aws-section:start -->

## ☁️ ShopNorth on AWS — The Sale, Seen From the Cloud

| Before the sale | Why |
|-----------------|-----|
| EC2 vCPU quota raised two weeks ahead; On-Demand Capacity Reservations in all 3 zones for the sale window | Scaling can't be blocked by AWS limits or a capacity shortage ([EC2 & Auto Scaling](/tutorials/aws-ec2-autoscaling)) |
| Route 53 TTLs lowered to 60 s | Any DNS change takes effect quickly ([Networking & VPC](/tutorials/aws-networking-vpc)) |
| WAF rate rules and Bot Control at the edge | Bots on the flash deal never reach checkout ([CloudFront & Edge](/tutorials/aws-cloudfront)) |
| RDS failover rehearsed in the game day | The "DB failover" runbook is real, not theoretical ([High Availability & DR](/tutorials/high-availability)) |

During the night, CloudFront served images, assets, and sale pages with a 97% cache hit ratio, so the S3 origins barely noticed the spike. On Sunday morning, Kabir released the capacity reservations along with the scale-down.

<!-- aws-section:end -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A retailer had a documented runbook for failing over to a backup payment provider, but nobody had ever run it. During a real outage, the failover script referenced an expired API credential and a renamed configuration key; the "five-minute failover" took 70 minutes. **Decision**: Rehearse runbooks in **game days** — scheduled exercises where a dependency is deliberately broken in staging (or carefully in production) and the on-call team follows the runbook. Every step that fails or confuses someone gets fixed. A runbook that hasn't been executed recently is a draft, not a plan.

</div>

<div class="callout-scenario">

**Scenario**: At a sale start, a site's product cache entries had all been written by the same warm-up job with the same 10-minute TTL. Ten minutes into the sale, they expired together, and thousands of requests hit the database at once for the same products. The database saturated and product pages failed for several minutes. **Decision**: Add random jitter to TTLs so entries expire at different times, refresh hot entries in the background before they expire, and use single-flight loading (one request rebuilds an entry while the others wait or get the stale value). Cache stampede tests are now part of the spike load test.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [Design Distributed Rate Limiter](/tutorials/design-rate-limiter-distributed) · [Rate Limiter](/tutorials/rate-limiter) | Token buckets, Redis-based limits | Per-customer limits at the gateway |
| [Sliding Window Pattern](/tutorials/dsa-sliding-window) | The algorithm behind many rate limiters | Counting requests in time windows |
| [Distributed Cache](/tutorials/cache-system) · [Caching Strategy](/tutorials/caching-strategy) | Stampedes, TTLs, warming | Jittered TTLs and pre-warming |
| [CDN Deep Dive](/tutorials/cdn-deep-dive) | Edge caching | Sale landing pages from the CDN |
| [Payment Gateway](/tutorials/payment-gateway) | Provider failures, reconciliation | Backup provider, status checks before cancelling |
| [Load Balancing](/tutorials/load-balancing) | Health checks, slow start | New pods joining during the spike |
| [Live Streaming Platform](/tutorials/live-streaming-platform) | Thundering herds at a known start time | Pre-scaling and warming for 8 PM |
| [Scalability](/tutorials/scalability) | Capacity planning, back-pressure, waiting rooms | Pre-scaling, the waiting room, load tests at 2× |
| [High Availability & DR](/tutorials/high-availability) | Failover, game days, degradation | The runbooks rehearsed before the sale |
| [CloudFront & Edge](/tutorials/aws-cloudfront) | Edge caching, WAF, Bot Control | A 97% cache hit ratio and bots kept off the flash deal |
| [EC2, Load Balancers & Auto Scaling](/tutorials/aws-ec2-autoscaling) | Quotas, capacity reservations, scaling | Making sure EC2 capacity existed at 8 PM |

## 📚 Extra Case Studies

The same launch-day problems elsewhere: [Design BookMyShow](/tutorials/lld-bookmyshow) (flash ticket sales and holds), [Stock Trading Platform](/tutorials/stock-trading-platform) (hot symbols and market-open spikes), and [Design Uber / Ola / Lyft](/tutorials/design-ride-sharing) (New Year's Eve demand spikes and surge).

## 🛠️ Mini Project — Build ShopNorth, Step 14: Your Own Game Day

**Goal**: Practice an incident before you need to. 1 weekend.

**Build**

1. Add a kill-switch flag (e.g., a property refreshed from a config map or a simple flags table) that disables a non-essential feature.
2. Add per-customer rate limiting (gateway or a filter with Redis).
3. Write two runbooks: "payment provider degraded" and "database failover".
4. Run a game day: start a k6 spike test, then (a) make your payment fake time out, and (b) restart PostgreSQL. Follow your runbooks; one person plays incident commander, keeping a timeline.
5. Write a blameless postmortem with at least three action items, then implement one of them.

**Acceptance criteria**: a written timeline, a postmortem in your repo, and at least one runbook step you discovered was wrong and fixed.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Name the incident roles ShopNorth used and what each one does.

<details>
<summary>Show answer</summary>

**Incident commander** (Priya): coordinates, decides, keeps the timeline, makes sure the team isn't all debugging the same thing; doesn't debug herself. **Investigators / operations** (Kabir, Arjun): diagnose and apply mitigations. **Communications** (Ananya): status page, in-app banner, support, and stakeholders, so engineers aren't interrupted. Clear roles prevent the two classic failures: everyone debugging while no one communicates, and no one deciding.

</details>

**L2.** What makes a postmortem "blameless", and why does it matter?

<details>
<summary>Show answer</summary>

It assumes people acted reasonably given what they knew at the time, and looks for the **system** conditions that made the failure possible: missing alerts, unsafe defaults, untested runbooks, unclear ownership. It matters because blame makes people hide mistakes and near-misses, and those hidden details are exactly what you need to prevent the next incident. Accountability still exists: it shows up as owned action items with due dates, not as finger-pointing.

</details>

### 🟡 Medium — Apply it

**M1.** Write the runbook for "Payment provider degraded".

<details>
<summary>Show answer</summary>

**Detect:** the payment-success-rate monitor per method, or the provider latency monitor; confirm on the checkout funnel dashboard which methods are affected. **Triage:** is it all methods or one? All pods? Since a deploy? Check the provider's status page. **Protect orders:** pause timeout cancellation (`order.timeout-cancellation.enabled=false`) so late payments aren't cancelled; confirm the outbox and consumers are healthy. **Mitigate:** switch the affected method to the backup provider (`payments.<method>.provider=backup`), or temporarily hide the failing method in checkout. **Communicate:** status page and in-app banner using the template; brief support. **Verify:** success rate recovers; error-budget burn normal. **Recover:** when the primary recovers, switch back gradually; re-enable timeouts once stuck orders are reconciled with the provider's API. **Follow up:** postmortem within 3 business days.

</details>

**M2.** List three techniques to prevent a cache stampede and when each fits.

<details>
<summary>Show answer</summary>

(1) **TTL jitter** — add randomness (±10-20%) to expiry so entries written together don't expire together; cheap, always worth it. (2) **Single-flight / request coalescing** — on a miss, one request rebuilds the entry while concurrent requests wait for it (or receive the stale value); fits hot keys with expensive rebuilds. (3) **Background refresh / pre-warming** — refresh hot entries before they expire, and warm the cache before a known event; fits predictable hot sets like a sale catalog. Often combined with **stale-while-revalidate**: serve the slightly old value while refreshing.

</details>

### 🔴 High — Think like a senior

**H1.** Design the waiting room for the flash deal.

<details>
<summary>Show answer</summary>

When the deal opens, visitors to the deal page get a **queue token** (signed, containing an arrival sequence number and expiry) and see their position. A small admission service (backed by Redis) admits tokens in order at a configured rate matched to checkout's tested capacity (e.g., 120/s), marking them "admitted" for 10 minutes. The gateway only lets requests with an admitted token reach the deal's add-to-cart and checkout endpoints. When stock sells out (the Redis counter hits zero), the waiting room immediately tells everyone still queued, so they don't wait for nothing. Protect fairness: one token per logged-in customer, bot detection at token issue, tokens can't be transferred. Serve the waiting page itself from the CDN so the queue doesn't overload the origin. Load test it with the expected crowd.

</details>

**H2.** Postmortem action #1: "the timeout job queries the provider before cancelling". Design it so it's correct even when the provider is slow or down.

<details>
<summary>Show answer</summary>

For each expired `PENDING_PAYMENT` order: call the provider's status API with a short timeout. **Paid** → apply the same transition as a webhook would (idempotently; the webhook may arrive later and is ignored). **Definitely failed or not started** → cancel and release stock. **Unknown** (timeout, provider error, circuit open) → **don't cancel**; extend the hold by 15 minutes, up to a maximum (e.g., 2 hours), then cancel and rely on the refund path if a late payment arrives (Chapter 3, H2). Run it in batches with `SKIP LOCKED`, rate-limit calls to the provider, and alert when the unknown count grows (the provider may be down). Add metrics for each outcome so the next incident shows what the job is doing.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "Tell me about a production incident you handled."**

Use a STAR structure with specifics. Situation: during a sale, UPI payment success dropped from 96% to 61% at the peak. Task: restore payments without corrupting orders. Action: a business monitor paged us within a minute, and traces showed the provider's UPI endpoint timing out. We spotted that our timeout job would soon cancel orders whose payments might succeed late, so we paused it with a flag, then switched UPI to a pre-integrated backup provider, also via a flag, during a code freeze. Communication went out within 10 minutes. Result: mitigated in 12 minutes, no paid orders cancelled, no double charges. The postmortem produced automatic failover and a safer timeout job.

</div>

<div class="callout-interview">

**Q: "How would you prepare a system for a big, known traffic event like a sale?"**

Start from a forecast and test at twice the expected peak, including a realistic spike shape, hot items, and cold caches, early enough to fix what breaks. Pre-scale before the event rather than relying on autoscaling, and warm caches and JVMs. Protect the core with rate limiting, a waiting room for flash deals, and feature-flag kill switches for non-essential features. Make dependencies resilient with timeouts, circuit breakers, and backup providers. Rehearse failure runbooks in a game day. Then freeze risky changes, staff a war room with clear incident roles, watch business metrics like payment success rate, and compare the forecast with actuals afterwards.

</div>

<div class="callout-interview">

**Q: "What makes a good postmortem?"**

It's blameless and specific. It has a clear timeline, the customer impact in numbers, and the root cause plus contributing factors, which are usually several, not one. It records what went well, what went wrong, and where we got lucky, since near-misses are free lessons. Most important are the action items, each with an owner, a due date, and a priority, tracked like any other work. A postmortem whose actions never get done is just a story. I also look for patterns across postmortems: the same contributing factor appearing twice is a signal to invest in it.

</div>

> **Golden rule: incidents are inevitable; chaos isn't. Prepare the escape routes before you need them, rehearse them, and let every incident make the system stronger.**

<div class="callout-journey">

➡️ **Next: [Chapter 15 · Evolving with AI](/tutorials/journey-15-ai)** — ShopNorth survived its first big sale. Now it evolves: smarter search, an AI support assistant that can look up orders safely, and AI used across the team's own SDLC. Then we wrap up the whole journey.

</div>
