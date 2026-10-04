# Chapter 13 · Observability with Datadog

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 13 of 15 · Phase: **Operate & Evolve** · SDLC stage: **Operations — monitoring**

**Previously:** ShopNorth runs on Kubernetes with honest probes, autoscaling, graceful deploys, and a canary Rollout waiting for a health check called `canary-health` ([Chapter 12](/tutorials/journey-12-kubernetes)).

**In this chapter:** Kabir makes ShopNorth *observable*: traces, logs, and metrics tied together in Datadog, dashboards on the signals that matter, SLOs built from Chapter 1's NFRs, monitors that page the right person with a runbook, synthetic tests that check checkout every minute — and the canary analysis that decides whether a release continues.

</div>

## The Situation

Week 11. A Thursday afternoon in staging: checkout p95 latency climbed from 400 ms to 6 seconds for 20 minutes. Nobody noticed until Meera's regression run failed. Kabir spent an hour opening pod logs one by one, trying to find which service was slow.

"In five weeks, millions of people will use this," he says. "We need to know something is wrong *before* customers do, and find *where* in minutes, not hours."

## Step 1 — Three Signals, One Story

| Signal | Answers | ShopNorth example |
|--------|---------|-------------------|
| **Metrics** | *Is* something wrong? How much, since when? | Checkout error rate jumped from 0.1% to 4% at 20:03 |
| **Traces** | *Where* is it slow or failing? | 90% of checkout time is spent in `InventoryClient.reserve` |
| **Logs** | *Why*, in detail? | `Connection pool exhausted (20/20) waiting for inventory DB` |

Their power comes from being **connected**. Datadog's *unified service tagging* gives every metric, trace, and log the same three tags — `env`, `service`, `version` — so you can jump from a spike on a dashboard to the traces from those minutes, and from a slow trace to the exact log lines it produced. That's why Chapter 12's pods carry the `tags.datadoghq.com/*` labels: `version` equals the image tag, so "did the new release cause this?" is one click.

## Step 2 — Installing the Agent

The Datadog Agent runs on every node (a DaemonSet), plus a Cluster Agent for cluster-level data. Kabir installs it with Helm from the GitOps repo:

```yaml
# datadog-values.yaml (Helm chart datadog/datadog)
datadog:
  apiKeyExistingSecret: datadog-secret      # API key synced from AWS Secrets Manager
  site: datadoghq.com                       # the Datadog site your organization uses
  clusterName: shopnorth-production
  logs:
    enabled: true
    containerCollectAll: true               # collect stdout/stderr of every container
  apm:
    portEnabled: true                       # receive traces from the Java tracer
  processAgent:
    enabled: true
clusterAgent:
  enabled: true
```

## Step 3 — Traces: Following One Checkout Through Every Service

The Datadog Java tracer instruments Spring MVC, JDBC, `RestClient`, Kafka clients, and Redis automatically — no code changes. It's added to the image (pinned, never "latest"):

```dockerfile
ARG DD_TRACER_VERSION=1.42.0
ADD https://repo1.maven.org/maven2/com/datadoghq/dd-java-agent/${DD_TRACER_VERSION}/dd-java-agent-${DD_TRACER_VERSION}.jar /app/dd-java-agent.jar
ENV JAVA_TOOL_OPTIONS="-javaagent:/app/dd-java-agent.jar -XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"
```

The pod tells the tracer who it is and where the agent runs (from the Chapter 12 labels, via the downward API):

```yaml
env:
  - name: DD_ENV
    valueFrom: { fieldRef: { fieldPath: "metadata.labels['tags.datadoghq.com/env']" } }
  - name: DD_SERVICE
    valueFrom: { fieldRef: { fieldPath: "metadata.labels['tags.datadoghq.com/service']" } }
  - name: DD_VERSION
    valueFrom: { fieldRef: { fieldPath: "metadata.labels['tags.datadoghq.com/version']" } }
  - name: DD_AGENT_HOST
    valueFrom: { fieldRef: { fieldPath: status.hostIP } }
  - name: DD_LOGS_INJECTION
    value: "true"                           # put trace and span IDs into every log line
```

Now one checkout shows up as a single **distributed trace**: gateway → order-service → catalog (prices) → inventory (reserve) → PostgreSQL insert → Kafka publish — and, later, the `PaymentSucceeded` consumer, because the tracer carries the trace context in Kafka message headers. When checkout is slow, the flame graph shows exactly which span is fat.

## Step 4 — Logs: Structured and Correlated

Plain-text logs are hard to search at scale. ShopNorth logs **JSON**, one event per line, with the trace ID added automatically:

```xml
<!-- logback-spring.xml (with the logstash-logback-encoder dependency) -->
<configuration>
  <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
    <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
  </appender>
  <root level="INFO">
    <appender-ref ref="JSON"/>
  </root>
</configuration>
```

```java
MDC.put("orderId", order.id().toString());          // searchable field on every line in this request
log.info("Order placed totalPaise={} items={}", order.total().paise(), order.items().size());
```

```json
{"@timestamp":"2026-10-24T20:00:03.481Z","level":"INFO","logger_name":"c.s.order.application.PlaceOrderService",
 "message":"Order placed totalPaise=249900 items=1","orderId":"7d3c9b1e-…","dd.trace_id":"7210948127463781221",
 "dd.span_id":"481902384712","dd.service":"order-service","dd.env":"production","dd.version":"3f9c1a2b7d4e"}
```

Rules from Chapter 7 still apply: customer IDs yes, phone numbers and addresses **never**; no tokens, no secrets, no full request bodies. (Spring Boot 3.4+ also has built-in structured logging if you'd rather not add an encoder library.)

## Step 5 — Metrics: Technical *and* Business

The tracer gives request rate, errors, and latency for every endpoint automatically. The team adds **business metrics** with Micrometer, because "orders per minute" tells you about a problem that no CPU graph will:

```java
@Component
class CheckoutMetrics {

    private final MeterRegistry registry;
    private final Counter placed;

    CheckoutMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.placed = Counter.builder("shopnorth.orders.placed").register(registry);
    }

    void orderPlaced() {
        placed.increment();
    }

    void orderRejected(String reason) {                       // "out_of_stock", "price_changed", "inventory_unavailable"
        registry.counter("shopnorth.orders.rejected", "reason", reason).increment();
    }
}
```

```yaml
management:
  statsd:
    metrics:
      export:
        flavor: datadog          # DogStatsD protocol to the node's agent
        host: ${DD_AGENT_HOST}
        port: 8125
```

<div class="callout-warn">

**Watch tag cardinality.** A tag like `reason` has a handful of values. A tag like `orderId` or `customerId` creates a new time series for every order — millions of them. That makes queries slow, and with Datadog's custom-metric pricing it can multiply the bill. IDs belong in logs and traces, never in metric tags.

</div>

## Step 6 — Dashboards People Actually Use

| Dashboard | What's on it | Who watches |
|-----------|-------------|-------------|
| **Service overview** (one per service) | The **golden signals**: latency (p50/p95/p99), traffic, errors, saturation (CPU, memory, DB pool usage) — split by `version` | The owning engineers; on-call |
| **Checkout funnel** | Orders/min, revenue/min, payment success rate by method (UPI, card, netbanking), stock-outs, checkout time-outs | Ananya, Priya, on-call during the sale |
| **Dependencies** | DB connections and slow queries, Redis hit ratio, **Kafka consumer lag**, **outbox oldest-unpublished age**, payment provider latency | On-call |
| **Platform** | Pods per service, restarts, `OOMKilled`, CPU throttling, node count | Kabir |

On sale night, the checkout funnel dashboard is on the big screen in the war room.

## Step 7 — SLOs: Turning NFRs Into Promises You Can Measure

Chapter 1 said "99.9% availability for checkout" and "place order p95 < 800 ms". Datadog SLOs make them measurable:

| SLO | SLI (what's measured) | Target | Error budget (30 days) |
|-----|------------------------|--------|------------------------|
| Checkout availability | Share of `POST /orders` requests that didn't fail with a server error (5xx) | 99.9% | 0.1% of requests (≈ 43 min of full outage) |
| Checkout latency | Share of `POST /orders` requests faster than 800 ms | 95% | 5% of requests may be slower |
| Product page availability | Share of product page requests without 5xx | 99.9% | 0.1% |

The **error budget** changes how the team decides things: if checkout has used most of its budget this month, risky releases wait and reliability work goes first. If plenty remains, the team ships faster.

**Alerting on SLO burn rate** (instead of every blip): page the on-call when the budget burns about **14× faster than sustainable** over both the last hour and the last 5 minutes (a big, ongoing problem), or about **6× faster** over 6 hours and 30 minutes (a slow leak). Short blips that don't threaten the SLO don't wake anyone up.

## Step 8 — Monitors, as Code

Monitors are defined in Terraform, reviewed in pull requests, and every one links to a runbook:

```hcl
resource "datadog_monitor" "order_service_error_rate" {
  name  = "[order-service] Checkout error rate above 2% (production)"
  type  = "query alert"
  query = "sum(last_5m):sum:trace.servlet.request.errors{env:production,service:order-service}.as_count() / sum:trace.servlet.request.hits{env:production,service:order-service}.as_count() > 0.02"

  message = <<-EOT
    Checkout errors are above 2% for 5 minutes.
    Dashboard: https://app.datadoghq.com/dashboard/shopnorth-checkout
    Runbook:   https://wiki.shopnorth.example/runbooks/checkout-errors
    @pagerduty-shopnorth-oncall @slack-shopnorth-alerts
  EOT

  monitor_thresholds {
    warning  = 0.01
    critical = 0.02
  }

  tags = ["service:order-service", "env:production", "team:checkout"]
}
```

ShopNorth's starter set:

| Monitor | Why | Notifies |
|---------|-----|----------|
| Checkout SLO fast / slow burn | Customers are failing to buy | Page |
| Payment success rate below normal (per method) | A payment provider or method is failing | Page |
| Outbox oldest unpublished row > 2 min | Events aren't flowing (Chapter 6) | Page |
| Kafka consumer lag growing for 10 min | Confirmations, stock commits delayed | Slack, page if > 30 min |
| DB connection usage > 80% | About to run out (Chapter 12) | Slack |
| Pods restarting / `OOMKilled` | Memory or probe problems | Slack |
| Synthetic checkout test failing in 2+ locations | The site is broken from outside | Page |
| Unusual admin price changes | Possible compromise or mistake (Chapter 7) | Security channel |

**Pages are for things a human must act on now.** Everything else goes to Slack or a ticket.

## Step 9 — Synthetic Tests: Production Smoke Tests, Every Minute

Datadog Synthetics run scripted checks from several locations:

- **API tests** every minute: product page, search, and cart API return 200 with the expected content.
- **A browser test** every 5 minutes: log in with a test account → search → add `SMOKE-TEST-SKU` to the cart → reach the payment page (never pay).
- **After each production deploy**, the pipeline triggers the same tests and waits for them, which makes them Chapter 8's production smoke tests:

```bash
datadog-ci synthetics run-tests --public-id abc-123-def --public-id ghi-456-jkl
```

Synthetics catch what internal metrics can't: an expired TLS certificate, a broken CDN route, a JavaScript error that stops the "Place order" button working.

## Step 10 — The Canary Health Check

Chapter 12's Rollout pauses at 10% and 50% and runs this analysis. Two consecutive bad readings abort the release:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: canary-health
spec:
  args:
    - name: service
  metrics:
    - name: error-rate
      interval: 1m
      count: 5
      failureLimit: 1
      successCondition: default(result, 0) < 0.01
      provider:
        datadog:
          apiVersion: v2
          interval: 5m
          query: |
            sum:trace.servlet.request.errors{env:production,service:{{args.service}}}.as_count() /
            sum:trace.servlet.request.hits{env:production,service:{{args.service}}}.as_count()
```

A stricter version filters by the canary's `version` tag and compares it with the stable version, so a problem in the new release isn't diluted by healthy traffic on the old one.

## Step 11 — Keeping the Bill Under Control

Observability can get expensive fast. ShopNorth's habits: exclude health-check and probe logs at the agent; keep `DEBUG` logs out of production; index only the logs people search and archive the rest to S3; sample traces for high-volume, low-value endpoints while keeping 100% of errors; review custom metrics monthly for cardinality.

<!-- aws-section:start -->

## ☁️ ShopNorth on AWS — CloudWatch Behind Datadog

Datadog is where the team looks, but AWS's own monitoring still has four jobs:

- **AWS metrics** for RDS, MSK, ElastiCache, SQS, the ALB, and Lambda flow from CloudWatch into Datadog through a **Metric Stream**; Lambda logs are forwarded from CloudWatch Logs.
- **A safety net:** a few CloudWatch alarms — API error rate, p99 latency, healthy hosts — page through SNS and PagerDuty even if Datadog itself is down.
- **Audit:** CloudTrail answers "who changed what" during incidents, next to the GitOps history.
- **Cost:** retention on every CloudWatch log group, and AWS Budgets alerts on every account.

The alarm definitions are in [CloudWatch & CloudTrail](/tutorials/aws-cloudwatch).

<!-- aws-section:end -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A team had 200+ alerts a day: CPU above 70%, single 5xx errors, every pod restart. On-call engineers muted the channel. One night, a real payment outage alert sat unread for 40 minutes among the noise. **Decision**: Page only on customer impact — SLO burn rates, payment success, synthetic failures — with a runbook link in every page. Everything else goes to Slack or tickets. Each alert has an owner, and a monthly review deletes or tunes alerts that fired without anyone needing to act.

</div>

<div class="callout-scenario">

**Scenario**: A developer added `customer_id` as a tag on a checkout latency metric to "debug a customer issue". Over the sale weekend it created millions of time series; dashboards timed out, and the next observability bill was several times the usual. **Decision**: Metric tags must have small, bounded value sets (endpoint, status class, payment method, region). Per-customer investigation uses traces and logs, which are built for high-cardinality data. A CI check flags new metric tags for review.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [Kubernetes in Production](/tutorials/k8s-production) | Observability on Kubernetes, alerting | Agent setup, platform dashboards |
| [Spring Boot Fundamentals](/tutorials/spring-boot-fundamentals) | Actuator and Micrometer | Business metrics, health groups |
| [Microservices Patterns](/tutorials/microservices-patterns) | Distributed tracing, correlation IDs | One trace across services and Kafka |
| [Apache Kafka Deep Dive](/tutorials/kafka-deep-dive) | Consumer lag and why it matters | Lag monitors |
| [Distributed Transactions](/tutorials/distributed-transactions) | Sagas | Tracing the checkout saga end to end |
| [AI in Production — LLMOps](/tutorials/ai-production-llmops) | Monitoring AI features | The same ideas applied to Chapter 15's AI features |
| [CloudWatch & CloudTrail](/tutorials/aws-cloudwatch) | AWS metrics, alarms, logs, audit | The Datadog feed and the independent safety-net alarms |

## 📚 Extra Case Studies

Observability in other systems: [Fraud Detection System](/tutorials/fraud-detection-system) (monitoring decisions and model drift), [Live Streaming Platform](/tutorials/live-streaming-platform) (real-time dashboards during a live event), and [Design Netflix](/tutorials/design-netflix) (observability at very large scale).

## 🛠️ Mini Project — Build ShopNorth, Step 13: See Everything

**Goal**: Know your mini ShopNorth's health at a glance. 3-4 evenings.

**Build** (with a Datadog trial, or the free open-source path: OpenTelemetry + Prometheus + Grafana + Loki + Tempo)

1. JSON logs with trace IDs; an `orderId` MDC field; no PII.
2. Traces across your order service, inventory fake, and the Kafka consumer — one checkout = one trace.
3. Business metrics: orders placed, orders rejected by reason; check tag cardinality.
4. A service dashboard with the golden signals split by version, and a "checkout funnel" dashboard.
5. One SLO (checkout availability) and three monitors (error rate, consumer lag, outbox age), each with a short runbook in your repo.
6. A synthetic-style check every minute (Datadog Synthetics, Grafana synthetic monitoring, or a k6 script on a schedule).
7. Break things on purpose: slow down inventory, stop Kafka — and confirm the right alert fires and the dashboard shows where.

**Acceptance criteria**: from an alert, you can reach the failing span and its log lines in under 2 minutes; no alert fires without a runbook.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Which signal do you start with for each: (a) "Is checkout broken right now?", (b) "Which service makes checkout slow?", (c) "Why did order 7d3c… fail?"

<details>
<summary>Show answer</summary>

(a) **Metrics** (error rate, SLO, payment success rate) and synthetic test results. (b) **Traces** — the flame graph shows which span takes the time. (c) **Logs**, searched by `orderId`, then follow the trace ID to see the whole request across services.

</details>

**L2.** What are SLI, SLO, and SLA? Give a ShopNorth example of each.

<details>
<summary>Show answer</summary>

**SLI** (indicator): a measurement — the share of `POST /orders` requests without a 5xx. **SLO** (objective): an internal target for the SLI — 99.9% over 30 days. **SLA** (agreement): an external promise with consequences — e.g., a marketplace partner contract promising 99.5% API availability with service credits. SLOs are set stricter than SLAs so you fix problems before breaking a contract.

</details>

### 🟡 Medium — Apply it

**M1.** Design monitoring for the outbox and Kafka pipeline from Chapter 6: which metrics, which thresholds, who gets notified?

<details>
<summary>Show answer</summary>

**Outbox:** a custom gauge for the age of the oldest unpublished row (the relay reports it) — page if over 2 minutes, because it means events aren't leaving the order database. Also a gauge of unpublished row count, for dashboards. **Kafka consumer lag** per consumer group and topic (from the Kafka/MSK integration) — Slack when lag grows for 10 minutes, page when confirmations would be delayed beyond the customer promise (e.g., > 30 minutes for `OrderPaid`). **Dead-letter topic** message rate — Slack on any increase, page on a spike. **Relay errors** (failed sends) — Slack. Each monitor links to the runbook: check broker health, relay logs, consumer errors, and which jobs to pause (Chapter 6, H2).

</details>

**M2.** The checkout SLO is 99.9% over 30 days. Halfway through the month, 70% of the error budget is gone. What changes in how the team works?

<details>
<summary>Show answer</summary>

Error-budget policy kicks in: (1) **slow down risk** — only low-risk releases, smaller canary steps, no risky experiments in checkout; (2) **prioritize reliability work** — analyze what consumed the budget (one incident? a slow leak of timeouts?), and fix the top causes; (3) **review alerting** — did burn-rate alerts fire early enough? (4) **communicate** to product owners that feature work on checkout may slip. If the budget recovers next month, normal pace resumes. The budget turns "move fast vs be stable" into a data-driven agreement instead of an argument.

</details>

### 🔴 High — Think like a senior

**H1.** Walk through debugging this alert with Datadog: "Checkout p95 latency 3.2 s (normal 450 ms) since 20:04."

<details>
<summary>Show answer</summary>

(1) **Scope:** on the service dashboard, is it all versions or only the new one (a deploy at 20:00)? All pods or one zone? All payment methods? (2) **Traces:** open slow `POST /orders` traces from 20:04 onward and compare their flame graphs with fast ones from 19:50 — say the `PUT /reservations` span went from 30 ms to 2.8 s. (3) **Follow it downstream:** open the inventory service's traces; its time is in a PostgreSQL `UPDATE stock` span — lock waits. (4) **Logs and DB metrics:** inventory DB shows many waiting locks on one SKU — a flash deal started at 20:00, and thousands of reservations contend for one row. (5) **Mitigate:** enable the waiting room / per-SKU queue for that deal, or move the hot SKU's stock to a pre-allocated counter (Chapter 14); communicate. (6) **Follow up:** add a lock-wait metric and alert, and a load test of hot-SKU contention. The method: scope → trace → follow the slow span → correlate logs and metrics → mitigate → prevent.

</details>

**H2.** The observability bill grew 3x after launch. Cut it by 40% without losing the ability to debug incidents.

<details>
<summary>Show answer</summary>

Find where the money goes (usage by product: logs, APM, custom metrics, hosts). **Logs:** drop probe and health-check logs at the agent, lower noisy loggers to WARN, index only searchable logs (errors, checkout, payments) and send the rest to cheap archive storage with rehydration on demand, shorten retention for debug-level data. **APM:** sample traces for high-volume, low-value endpoints (product page GETs) while keeping 100% of errors and checkout traces. **Custom metrics:** remove unused metrics and high-cardinality tags; aggregate per-pod metrics where per-pod detail isn't needed. **Hosts/containers:** right-size the cluster (fewer, larger nodes if billing is per host). Validate by running an incident drill on the trimmed setup: if you can still find the cause quickly, the cut was safe.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you monitor a microservices system in production?"**

With the three signals tied together by consistent tags for environment, service, and version. Metrics give me the golden signals per service, latency, traffic, errors, and saturation, plus business metrics like orders per minute and payment success rate. Distributed tracing follows a request across services and message queues, so I can see which span is slow. Structured JSON logs carry the trace ID, so I can jump from a slow trace to its log lines. On top of that, I define SLOs from the NFRs and alert on error-budget burn rate rather than single blips. Synthetic tests check critical journeys from outside every minute. Every page links to a runbook.

</div>

<div class="callout-interview">

**Q: "What is an error budget, and how do you use it?"**

It's the amount of unreliability an SLO allows. With a 99.9% availability SLO over 30 days, 0.1% of requests may fail, roughly 43 minutes of full outage. It's a shared currency between product and engineering. While budget remains, the team can ship features and take reasonable risks. When it's nearly spent, releases slow down and reliability work takes priority. I also alert on how fast the budget is burning: fast burn pages someone immediately, slow burn creates a ticket. That way paging reflects real customer impact, not noise.

</div>

<div class="callout-interview">

**Q: "How do you avoid alert fatigue?"**

Page only for things that hurt customers now and need a human: SLO burn rates, payment failures, synthetic journey failures. Everything else, like a single pod restart or a CPU spike that recovers, goes to Slack, a ticket, or a dashboard. Every alert has an owner and a runbook link, and alerts that fire without anyone needing to act get tuned or deleted in a regular review. I also track pages per on-call shift as a team health metric. When engineers trust that a page always means something real, they respond quickly.

</div>

> **Golden rule: you can't fix what you can't see — but alerts that cry wolf are worse than none. Measure what customers feel, and page only when a human must act.**

<div class="callout-journey">

➡️ **Next: [Chapter 14 · Launch Day & Incidents](/tutorials/journey-14-launch-day)** — Everything comes together. The Diwali sale starts at 8 PM: load tests, pre-scaling, a waiting room for the flash deal, the war room — and at 8:17 PM, a payment incident. You'll see how it's detected, handled, and turned into a postmortem.

</div>
