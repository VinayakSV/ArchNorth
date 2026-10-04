# Chapter 1 · Requirements & Planning

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 1 of 15 · Phase: **Plan & Design** · SDLC stage: **Requirements & planning**

**Previously:** You joined ShopNorth, a fictional online store that must launch its own website before the Diwali sale in 12 weeks ([Start Here](/tutorials/journey-start)).

**In this chapter:** Before anyone writes code, the team turns a one-paragraph idea into user stories, measurable requirements, estimates, and a plan everyone can commit to.

</div>

## The Situation

Monday, 10 AM. Ananya (Product Manager) shares the product brief in the kickoff meeting:

> "We want customers to browse our catalog, search, add to cart, pay by UPI, card, or netbanking, and track their orders. Our ops team needs to manage products and stock. We launch before Diwali, and during the sale we expect about ten times our normal traffic."

Priya (Tech Lead) turns to you: "That's a good start for a product brief, but it's not a requirement yet. Nobody can design, test, or monitor 'customers can pay'. Let's make it concrete."

That's this chapter: making things concrete enough to build, test, and measure.

## Step 1 — Ask Before You Build

Every vague word in a brief hides a design decision. The team spends the first two days asking questions like these:

| Question | Why it matters | Ananya's answer |
|----------|----------------|-----------------|
| How many products at launch, and in a year? | Search and catalog design, storage | 5,000 SKUs at launch, ~50,000 in a year |
| How many visitors normally, and during the sale? | Capacity, cost, architecture | ~200K daily visitors; 2 million on sale day |
| Do we allow guest checkout? | Auth design, abandoned carts | No — login required (Google or OTP) |
| Cash on delivery? | Order states, fraud, operations | Not for launch; maybe after |
| What if an item sells out while it's in someone's cart? | Inventory model | Reserve stock at checkout for 15 minutes |
| Do we store card numbers? | PCI DSS scope, security cost | No — use the payment provider's hosted checkout |
| Which channels for notifications? | Integrations, cost | Email + SMS for order confirmation and shipping |
| Who are the admin users? | Roles and permissions | ~10 ops staff; 2 can change prices |

<div class="callout-tip">

**Ask "what happens when…" questions.** "What happens when payment succeeds but our server crashes before saving the order?" is the kind of question that saves you from double charges in production. Ask them now, when the answer costs a whiteboard discussion, not a hotfix.

</div>

## Step 2 — Epics, User Stories, and Acceptance Criteria

Ananya and the team group the work into **epics**, then break them into **user stories** small enough to finish in a few days.

| Epic | Example stories |
|------|-----------------|
| Browse & Search | As a shopper, I want to search products by name so I can find what I want quickly |
| Cart | As a shopper, I want my cart saved across devices so I can continue on my phone |
| Checkout & Payment | As a shopper, I want to pay by UPI so I can finish without entering card details |
| Orders | As a shopper, I want to see my order status so I know when it will arrive |
| Admin | As an ops manager, I want to update stock levels so we don't sell items we don't have |
| Notifications | As a shopper, I want an email and SMS when my order is confirmed |

A story isn't ready until it has **acceptance criteria** — the conditions that make it "done". Meera (QA) insists they're written in a form she can turn directly into automated tests:

```gherkin
Feature: Checkout

  Scenario: Successful UPI payment
    Given Riya is logged in with 2 in-stock items in her cart
    When she places the order and the UPI payment succeeds
    Then her order status is "PAID"
    And the stock of both items is reduced
    And she receives a confirmation email and SMS within 1 minute

  Scenario: Item sells out during checkout
    Given only 1 unit of "Noise-cancelling headphones" is left
    And Riya and Karan both have it in their carts
    When both place their orders at the same time
    Then exactly one order is created for that unit
    And the other shopper sees "This item just sold out" before paying

  Scenario: Customer double-clicks "Place order"
    Given Riya clicks "Place order" twice within one second
    Then exactly one order is created
    And she is charged exactly once
```

Look at the last two scenarios. They aren't about the happy path; they're about **concurrency** and **duplicate requests**. Those two acceptance criteria will drive design decisions in Chapters 3, 4, and 5 (inventory reservation, database constraints, idempotency keys).

<div class="callout-info">

**INVEST** is a quick quality check for stories: **I**ndependent, **N**egotiable, **V**aluable, **E**stimable, **S**mall, **T**estable. "As a user I want a great checkout" fails Estimable and Testable; the Gherkin scenarios above pass.

</div>

## Step 3 — Non-Functional Requirements, With Numbers

Functional requirements say *what* the system does. **Non-functional requirements (NFRs)** say *how well*. They drive most architecture decisions, and they're useless without numbers.

| Quality | ShopNorth target | How it will be verified |
|---------|------------------|-------------------------|
| **Availability** | 99.9% per month for browse + checkout (≈ 43 min downtime/month) | Datadog SLO (Ch 13) |
| **Latency** | p95 product page < 300 ms (server); search < 200 ms; place order < 800 ms excluding the payment provider | k6 load test (Ch 8, 14) + APM monitors (Ch 13) |
| **Throughput** | Sale peak: 3,000 requests/s and 150 orders/s | Load test before the sale (Ch 14) |
| **Correctness** | Never oversell stock; never charge twice; never lose a paid order | Concurrency tests (Ch 8), constraints (Ch 4), idempotency (Ch 5) |
| **Recovery** | Orders: RPO 0 (no data loss), RTO 30 min | Managed DB with Multi-AZ, restore drills |
| **Security** | No card data stored; customer data protected; admin actions audited | Hosted checkout (Ch 7), scans (Ch 9) |
| **Privacy** | Collect only needed personal data; delete on request (India's DPDP Act) | Data inventory, retention jobs |
| **Operability** | Every service has dashboards, alerts, and a runbook before launch | Launch checklist (Ch 14) |

Notice the third column. **Every NFR names how it will be checked.** That's the thread that runs through the whole journey: a requirement written today becomes a test in Chapter 8, a pipeline gate in Chapter 11, and a monitor in Chapter 13.

<div class="callout-warn">

**"The site must be fast" is not a requirement.** Without a number and a percentile, nobody can design for it or know if it's met. Write "p95 under 300 ms at 3,000 requests/second" and every team member knows the target.

</div>

## Step 4 — Back-of-the-Envelope Estimates

Priya asks you to sanity-check the scale numbers before anyone designs anything.

**Sale-day traffic**
- 2 million visitors × ~25 API requests each ≈ **50 million requests** in the day.
- Ananya expects ~40% of traffic in the 2 hours after the 8 PM sale start: 50M × 0.4 ÷ 7,200 s ≈ **2,800 requests/s**. Plan for **3,000/s sustained**, with short bursts above that in the first minutes.

**Orders**
- 3% conversion × 2M visitors ≈ **60,000 orders** on sale day.
- Flash deals concentrate orders: if a quarter of them land in the first 10 minutes, that's 15,000 ÷ 600 s = 25 orders/s *on average*, with peaks several times higher in the first minute. Plan for **150 orders/s**.

**Storage**
- Orders: ~2 million in the first year × ~2 KB (order + items + payment rows) ≈ **4 GB/year**. Small — a single PostgreSQL instance handles this easily.
- Product images: 50,000 products × 6 images × ~300 KB ≈ **90 GB**. Too big and too hot for the database → **object storage + CDN** (Chapter 2).

<div class="callout-tip">

**Estimates are for decisions, not precision.** "4 GB of orders per year" tells you sharding is unnecessary; "90 GB of images served millions of times" tells you a CDN is essential. Being within 2-3x is enough.

</div>

## Step 5 — Scope the MVP (MoSCoW)

With 12 weeks and 6 people, everything can't make it. The team uses **MoSCoW**:

| Must have (launch) | Should have (soon after) | Could have (later) | Won't have (this year) |
|--------------------|--------------------------|--------------------|------------------------|
| Browse, search, product pages | Coupons | Wishlist | Marketplace sellers |
| Cart (saved across devices) | Cash on delivery | Reviews & ratings | International shipping |
| Checkout with UPI, card, netbanking | Returns & refunds self-service | Recommendations | Native mobile apps |
| Order history & status | | | |
| Admin: products, prices, stock | | | |
| Email + SMS confirmations | | | |

The non-functional must-haves (handle the sale peak, no overselling, no double charges, monitoring) are **in** the MVP. A store that crashes at 8 PM on sale day is worse than a store without a wishlist.

## Step 6 — Risks and Assumptions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Payment provider integration takes longer than expected | Can't take money at launch | Start integration in Sprint 1 with the provider's sandbox |
| Sale traffic exceeds estimates | Outage on the most important day | Load test at 2x the estimate (Ch 14); CDN + caching; waiting room as a fallback |
| Overselling hot items in flash deals | Angry customers, cancellations | Atomic stock reservation (Ch 4); concurrency tests (Ch 8) |
| Small team, one SRE | Burnout, slow incident response | Managed services where possible; runbooks; shared on-call |

## Step 7 — The Plan

Six two-week sprints. Each sprint ends with working software deployed to staging — not "design documents only".

| Sprint | Weeks | Goal | Chapters |
|--------|-------|------|----------|
| 1 | 1-2 | Requirements done, architecture + data model agreed, CI pipeline skeleton, payment sandbox access | 1, 2, 3, 4 |
| 2 | 3-4 | Catalog, search, and cart working end to end in staging | 5, 6 |
| 3 | 5-6 | Checkout + payments + inventory reservation; login with Auth0 | 5, 6, 7 |
| 4 | 7-8 | Notifications, admin pages, full regression suite, quality gates enforced | 8, 9 |
| 5 | 9-10 | Production environment on Kubernetes, dashboards, alerts, runbooks | 10, 11, 12, 13 |
| 6 | 11-12 | Load testing, game day, bug fixing, code freeze, launch | 14 |

**Definition of Done** (agreed by the whole team — it applies to every story):

- [ ] Code reviewed and merged to `main`
- [ ] Unit and integration tests pass; coverage on new code ≥ 80%
- [ ] SonarQube quality gate green; no new critical security findings
- [ ] Deployed to staging; smoke tests pass
- [ ] Acceptance criteria verified (automated where possible)
- [ ] Logs, metrics, and alerts exist for new endpoints
- [ ] Product owner has accepted it

The Definition of Done is where the SDLC becomes real: every item on that list is a later chapter.

<!-- aws-section:start -->

## ☁️ ShopNorth on AWS — Requirements That Shape the Cloud

Some requirements decide cloud choices before any code exists. Ananya and Priya agree on these with Kabir in week 1:

| Requirement | Cloud decision | Learn it |
|-------------|---------------|----------|
| Customers are in India; customer data stays in India | Run in AWS **Mumbai (`ap-south-1`)** and keep backups in **Hyderabad (`ap-south-2`)** | [AWS for Developers](/tutorials/aws-start-here) |
| 99.9% availability for checkout | Every tier spread across **3 availability zones**; Multi-AZ databases | [High Availability & DR](/tutorials/high-availability) |
| Survive a regional disaster | A written DR plan: **RTO 4 hours, RPO 15 minutes**, signed off by Ananya | [High Availability & DR](/tutorials/high-availability) |
| 3,000 requests/s at the sale peak | A capacity plan, load tests at 2×, and EC2 quotas raised in advance | [Scalability](/tutorials/scalability), [EC2 & Auto Scaling](/tutorials/aws-ec2-autoscaling) |
| A fixed monthly budget | AWS Budgets with alerts on every account from day one | [AWS for Developers](/tutorials/aws-start-here) |

<!-- aws-section:end -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A retail team's requirement said "checkout should handle high traffic". Development tested with 50 users. On launch day, 4,000 concurrent shoppers arrived; the database connection pool ran out within minutes and the site returned errors for 40 minutes. **Decision**: Write throughput and latency NFRs as numbers derived from business forecasts ("3,000 requests/s, p95 < 800 ms"), attach a load test to each, and make passing it part of the launch checklist. The cost of the estimate is an hour; the cost of skipping it was the launch.

</div>

<div class="callout-scenario">

**Scenario**: A story said "reduce stock when an order is placed". Two developers read it differently: one reduced stock when the customer clicked "Place order", the other after payment succeeded. In testing, abandoned payments left products showing "out of stock" for hours. **Decision**: Acceptance criteria must cover the state transitions explicitly: stock is *reserved* at checkout for 15 minutes, *committed* on payment success, and *released* on failure or timeout. Writing the edge cases as Gherkin scenarios exposed the ambiguity before any code was written.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [How to Think in System Design](/tutorials/thinking-system-design) | The requirements → estimates → design framework | Clarifying questions and the sale-day estimates |
| [How to Think in Architecture](/tutorials/thinking-architecture) | Reversible vs irreversible decisions, ADRs | Deciding what to plan up front vs iterate on |
| [AI-SDLC](/tutorials/ai-sdlc) | Specs and guardrails for AI-assisted delivery | Acceptance criteria written so humans *and* AI assistants can build from them |
| [Scalability](/tutorials/scalability) | Little's law, the read ladder, capacity planning | Turning 3,000 requests/s into a capacity plan |
| [AWS for Developers](/tutorials/aws-start-here) | Regions, accounts, costs | Choosing Mumbai; budgets from day one |

## 📚 Extra Case Studies

The same requirements thinking in other domains: [Payment Gateway](/tutorials/payment-gateway) (requirements where money is involved), [Notification System](/tutorials/notification-system) (channels, priorities, and volumes), and [Design Uber / Ola / Lyft](/tutorials/design-ride-sharing) (estimating a location firehose).

## 🛠️ Mini Project — Build ShopNorth, Step 1: Write the Requirements

**Goal**: A `docs/requirements.md` good enough that someone else could design from it. 1-2 evenings.

**Build**

1. Write 10 user stories across the six epics, each with 2-3 Gherkin acceptance criteria — include at least two concurrency or failure scenarios.
2. Write an NFR table with numbers and a "how it will be verified" column.
3. Do the sale-day estimates for your own assumptions (visitors, conversion, peak window) and show the math.
4. Write a MoSCoW scope table and a risk table with mitigations.
5. Turn the Must-have stories into issues on your project board, each linked to its acceptance criteria.

**Acceptance criteria**: every NFR has a number and a verification method; at least one story covers duplicate requests and one covers running out of stock.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Rewrite these as measurable NFRs: (a) "Search should be fast." (b) "The site should always be up." (c) "It should handle the sale."

<details>
<summary>Show answer</summary>

(a) "Search returns results with p95 latency under 200 ms at 1,000 searches/second." (b) "Browse and checkout are available 99.9% of each month, measured by synthetic checks every minute from 3 regions." (c) "The system sustains 3,000 requests/second and 150 orders/second for 2 hours with p95 checkout latency under 800 ms and error rate under 0.5%." Each now has a metric, a threshold, and a load or measurement condition.

</details>

**L2.** Write Gherkin acceptance criteria for "As a shopper, I want to apply a coupon at checkout".

<details>
<summary>Show answer</summary>

```gherkin
Scenario: Valid coupon
  Given Riya's cart total is ₹2,000
  And coupon "DIWALI10" gives 10% off orders above ₹1,500, capped at ₹300
  When she applies "DIWALI10"
  Then her order total is ₹1,800

Scenario: Cart below the minimum
  Given Riya's cart total is ₹1,000
  When she applies "DIWALI10"
  Then she sees "Add ₹500 more to use this coupon"
  And the total is unchanged

Scenario: Expired coupon
  Given "DIWALI10" expired yesterday
  When Riya applies it
  Then she sees "This coupon has expired"
```

Good criteria cover the happy path, the boundary (minimum, cap), and failures (expired, already used).

</details>

### 🟡 Medium — Apply it

**M1.** ShopNorth expects 2 million orders in year one, growing 3x per year. Estimate order storage after 3 years, including indexes, and say whether it changes the database decision.

<details>
<summary>Show answer</summary>

Year 1: 2M, year 2: 6M, year 3: 18M → ~26M orders. At ~2 KB of row data per order (order, items, payment) ≈ 52 GB; indexes often add 50-100% → roughly **80-100 GB**. That still fits comfortably on one PostgreSQL primary with read replicas. The decision doesn't change; what changes is that you plan **partitioning by month** for the orders table around year 2-3 so old data can be archived and queries on recent orders stay fast (Chapter 4).

</details>

**M2.** Midway through Sprint 3, the founders ask for cash on delivery (COD) for the sale. Do an impact analysis before saying yes or no.

<details>
<summary>Show answer</summary>

COD touches: order states (a new path without online payment: `PLACED → SHIPPED → DELIVERED → PAID_ON_DELIVERY`), inventory (stock reserved without payment — reservation can't time out after 15 minutes), fraud (fake orders tie up stock; needs limits per customer and pincode), operations (courier cash reconciliation), notifications, admin screens, and tests (new regression scenarios). Estimate it, then present the trade-off: "COD takes ~2 sprint-weeks; to fit it, we drop coupons or self-service returns, or accept launching COD a week after the sale." Product owners choose; engineers make the cost visible. Never silently absorb it.

</details>

### 🔴 High — Think like a senior

**H1.** A founder says: "We need 100% uptime — zero downtime, ever." How do you respond?

<details>
<summary>Show answer</summary>

Explain that 100% isn't achievable or affordable: dependencies (cloud, payment provider, DNS) fail, and each extra "nine" multiplies cost and complexity. Translate targets into minutes: 99.9% ≈ 43 minutes/month, 99.99% ≈ 4 minutes/month — the second needs multi-region active-active infrastructure and a much larger team. Then tie it to business impact: during the sale, every minute down costs X in orders, so invest where it matters (checkout reliability, zero-downtime deployments, fast detection and rollback) and set an SLO of 99.9% with an error budget. Offer "zero *planned* downtime" (rolling deployments, online migrations) as an achievable promise.

</details>

**H2.** How would you make requirements traceable through the SDLC so that a missed NFR is caught before launch, not after?

<details>
<summary>Show answer</summary>

Give each requirement an ID (e.g., `NFR-07: place order p95 < 800 ms at 150 orders/s`) and link it everywhere: the stories that implement it, the tests that verify it (a k6 scenario tagged `NFR-07`), the pipeline gate that runs those tests before release, and the Datadog monitor or SLO that watches it in production. Keep a simple matrix (requirement → story → test → monitor) in the repo and review it at the launch readiness review: any requirement without a test and a monitor is a launch risk. This is how regulated industries do it, and it's cheap to adopt in a lightweight form.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you handle vague requirements from product managers?"**

I treat a vague requirement as the start of a conversation, not a spec. I ask clarifying questions that expose decisions: scale, failure cases, edge cases like duplicate clicks or items selling out, and what "done" means. Then I write it back as user stories with acceptance criteria and NFRs with numbers, and get the product owner to confirm. For example, "checkout should be fast" became "place order p95 under 800 ms at 150 orders per second". When something truly can't be known yet, I state the assumption explicitly and design so it's cheap to change.

</div>

<div class="callout-interview">

**Q: "What's the difference between functional and non-functional requirements? Give examples."**

Functional requirements describe behavior: a customer can pay by UPI; ops can update stock. Non-functional requirements describe qualities: availability, latency, throughput, security, recoverability. For example: 99.9% monthly availability, p95 under 300 ms for product pages, no card data stored. NFRs usually drive the architecture more than features do. Supporting 150 orders per second without overselling shapes the database design, the inventory model, and the testing strategy. I always write NFRs with numbers and say how each will be verified.

**Follow-up trap**: "Which is more important?" → Neither by itself. A store that's fast but can't take payments fails, and so does a store that takes payments but crashes at the sale peak. The MVP needs the must-have functions *and* the must-have qualities.

</div>

<div class="callout-interview">

**Q: "A new requirement arrives in the middle of a sprint. What do you do?"**

I don't silently absorb it or reject it outright. First I do a quick impact analysis: which components, data, tests, and operations it touches, and a rough estimate. Then I give the product owner the trade-off. We can swap it for something of similar size in the sprint, add it to the next sprint, or, if it's truly urgent, accept that something else slips. The team decides together, and the change is visible on the board. Hidden scope changes are how deadlines get missed without anyone noticing until the end.

</div>

> **Golden rule: if a requirement can't be tested, it can't be built reliably. Write every requirement so that someone could prove it's done.**

<div class="callout-journey">

➡️ **Next: [Chapter 2 · System Design (HLD)](/tutorials/journey-02-system-design)** — With requirements and numbers agreed, Priya runs the architecture session: which services, which databases, where to cache, and how payments flow. Every decision traces back to a number from this chapter.

</div>
