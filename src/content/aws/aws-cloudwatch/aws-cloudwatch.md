# CloudWatch & CloudTrail — Watching AWS: The Building Control Room Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Operations — monitoring** · ShopNorth uses this in [Chapter 13 · Observability with Datadog](/tutorials/journey-13-observability)

</div>
<!-- sdlc-stage:end -->

## The Building Control Room Analogy

A large office tower has a control room:

- **Sensors** everywhere report numbers every minute: temperature, lift usage, power draw. Those are **metrics**.
- **CCTV recordings** capture what actually happened, to be searched later. Those are **logs**.
- **Alarms** ring when a sensor stays out of range — not for every flicker, only when it matters. Those are **CloudWatch alarms**.
- A **wall of screens** shows the most important sensors at a glance. Those are **dashboards**.
- At the reception desk, a **visitor logbook** records who entered which room and when. That's **CloudTrail**, the audit log of every AWS API call.
- The tower also pays an **outside security company** with better tools and analysts — but it still relies on the building's own sensors and alarms if the company's phone line goes down. At ShopNorth, that company is **Datadog**, and the building's own system is **CloudWatch**.

## 1. CloudWatch in One Table

| Feature | What it does | ShopNorth uses it for |
|---------|-------------|----------------------|
| **Metrics** | Time series from AWS services and your code | RDS, MSK, ALB, SQS, Lambda, ElastiCache metrics |
| **Logs** | Log groups and streams, retention, search | Lambda logs; VPC Flow Logs; EKS control plane logs |
| **Logs Insights** | Query language for logs | Debugging Lambda functions |
| **Alarms** | Thresholds, anomaly detection, composite alarms → actions | Backup alarms independent of Datadog; DLQs; billing |
| **Dashboards** | Graphs of metrics and logs | A small "AWS health" board |
| **Metric Streams** | Push metrics continuously to a destination | Feed Datadog through Kinesis Data Firehose |
| **Synthetics, RUM, Application Signals, Container Insights** | Canaries, real-user monitoring, APM-style SLOs, container metrics | Not used — Datadog covers these (Chapter 13) |
| **CloudTrail** (separate service) | Who called which API, when, from where | Audit, security alerts, incident forensics |

## 2. How CloudWatch and Datadog Work Together at ShopNorth

Chapter 13 made Datadog ShopNorth's main observability tool: traces, logs, metrics, dashboards, SLOs, and on-call paging. CloudWatch still has four jobs:

1. **The source of AWS metrics.** Managed services like RDS, MSK, and the ALB publish metrics only to CloudWatch; Datadog's AWS integration receives them through a **Metric Stream** (near real time).
2. **Home of Lambda logs.** Lambda writes to CloudWatch Logs; a subscription forwards them to Datadog.
3. **The independent safety net.** A handful of critical alarms live in CloudWatch and page through SNS, so a Datadog outage — or a broken agent — can't hide a production fire.
4. **Billing and audit.** Billing alarms, AWS Budgets, and CloudTrail.

| Datadog-independent alarm | Metric | Fires when | Action |
|---------------------------|--------|-----------|--------|
| API 5xx rate | ALB `HTTPCode_Target_5XX_Count` / `RequestCount` | > 2% for 3 of 5 minutes | SNS `platform-alerts` → PagerDuty |
| API latency | ALB `TargetResponseTime` p99 | > 2 s for 5 minutes | Same |
| Healthy targets | ALB `HealthyHostCount` | < 2 for 3 minutes | Same |
| Order DB storage | RDS `FreeStorageSpace` | < 20% | Slack + email |
| Any DLQ | SQS `ApproximateNumberOfMessagesVisible` on DLQs | > 0 | Slack |
| Spend | `EstimatedCharges` (in `us-east-1`) + AWS Budgets | Above the monthly forecast | Email to the founders and Kabir |

## 3. Metrics: Namespaces, Dimensions, and Percentiles

A metric is identified by a **namespace** (`AWS/ApplicationELB`), a **name** (`TargetResponseTime`), and **dimensions** (`LoadBalancer=app/shopnorth-api/…`). Each unique combination of dimensions is a separate metric.

<div class="callout-warn">

**Averages hide pain.** An average latency of 120 ms can coexist with 3% of customers waiting 5 seconds. Alarm on **percentiles** (p95, p99) for latency, and on **rates** (errors per request) instead of raw counts, which rise naturally with traffic.

</div>

Standard resolution is one data point per minute; **high-resolution** custom metrics go down to one second. Custom metrics cost money per metric, so watch the cardinality: a `customerId` dimension would create a metric per customer.

### Custom metrics from Lambda, almost free

The **Embedded Metric Format (EMF)** turns a structured log line into metrics — no API calls from the function. ShopNorth's image resizer logs one line per invocation:

```json
{
  "_aws": {
    "Timestamp": 1791100000000,
    "CloudWatchMetrics": [{
      "Namespace": "ShopNorth/Images",
      "Dimensions": [["Function"]],
      "Metrics": [
        { "Name": "ImagesResized", "Unit": "Count" },
        { "Name": "ResizeMillis", "Unit": "Milliseconds" }
      ]
    }]
  },
  "Function": "image-resizer",
  "ImagesResized": 3,
  "ResizeMillis": 412
}
```

(For Spring Boot apps, Micrometer can publish to CloudWatch too, but ShopNorth's services send their metrics to Datadog.)

## 4. Logs and Logs Insights

| Practice | Why |
|----------|-----|
| **Set retention on every log group** | The default is *never expire* — a slow, silent cost |
| Log structured JSON | Logs Insights discovers fields automatically |
| Use the **Infrequent Access** log class for rarely queried logs | Cheaper ingestion, fewer features |
| **Metric filters** | Turn a log pattern (e.g., `"payment provider timeout"`) into a metric you can alarm on |
| **Subscription filters** | Stream logs to Datadog, Firehose, or Lambda |
| **Live Tail** | Watch logs arrive in real time during a deploy or an incident |

Two queries the team uses:

```
# Errors per 5 minutes in the sales-report function
fields @timestamp, @message
| filter level = "ERROR"
| stats count(*) as errors by bin(5m)
| sort errors desc
```

```
# Lambda cold starts and latency per hour (REPORT lines are written by Lambda itself)
filter @type = "REPORT"
| stats count(*) as invocations,
        count(@initDuration) as coldStarts,
        avg(@duration) as avgMs,
        pct(@duration, 99) as p99Ms
  by bin(1h)
```

## 5. Alarms That Don't Cry Wolf

| Setting | Use it to |
|---------|-----------|
| **M out of N datapoints** | Require 3 bad minutes out of 5, so one blip doesn't page anyone |
| **Missing data treatment** | Decide whether no data means "fine" (`notBreaching`), "broken" (`breaching`), or "unknown" |
| **Metric math** | Alarm on a ratio, like the error rate, instead of a raw count |
| **Anomaly detection** | Learn normal daily patterns and alarm on deviations (good for traffic drops) |
| **Composite alarms** | Combine alarms ("5xx high AND healthy hosts low") to page once, with context |

ShopNorth's 5xx-rate alarm in Terraform. The ALB is created by the AWS Load Balancer Controller in Kubernetes, so Terraform looks it up by its tags:

```hcl
data "aws_lb" "api" {
  tags = { "ingress.k8s.aws/stack" = "shopnorth/api-gateway" }   # set by the Load Balancer Controller
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "api-5xx-rate-high"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 2                    # percent
  evaluation_periods  = 5
  datapoints_to_alarm = 3                    # 3 of the last 5 minutes
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.platform_alerts.arn]
  ok_actions          = [aws_sns_topic.platform_alerts.arn]

  metric_query {
    id          = "rate"
    expression  = "IF(requests > 0, 100 * errors / requests, 0)"
    label       = "5xx rate (%)"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      dimensions  = { LoadBalancer = data.aws_lb.api.arn_suffix }
      period      = 60
      stat        = "Sum"
    }
  }
  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      dimensions  = { LoadBalancer = data.aws_lb.api.arn_suffix }
      period      = 60
      stat        = "Sum"
    }
  }
}
```

<div class="callout-tip">

**Alarm on symptoms, investigate causes.** Page people for what customers feel — errors, latency, failed checkouts, a queue whose oldest message is getting old. Causes like "CPU at 80%" belong on dashboards and in tickets, not in someone's phone at 3 AM. Chapter 13's SLO burn-rate alerts are the grown-up version of this idea.

</div>

## 6. CloudTrail: The Audit Log

Every AWS API call — from the console, CLI, SDKs, or AWS services themselves — is a **CloudTrail event**: who (identity), what (action), when, from where (IP, user agent), on which resource, and whether it succeeded.

| Feature | Detail | ShopNorth |
|---------|--------|-----------|
| **Event history** | The last 90 days of management events, free, in each account | First stop during investigations |
| **Organization trail** | All accounts' events delivered to one S3 bucket | Into the `log-archive` account, with Object Lock |
| **Data events** | Object-level S3 and Lambda invocation activity (extra cost) | On for the invoices bucket |
| **CloudTrail Lake** | SQL queries over events | For audits and incident forensics |
| **Alerts on sensitive actions** | Via EventBridge rules or metric filters | Root sign-in, `CreateAccessKey`, security group changes, `StopLogging` |

During an incident, "what changed in the last hour?" is often the fastest question to the root cause — CloudTrail answers it for AWS, and the GitOps history answers it for Kubernetes.

## 7. Keeping the Bill Sane

| Cost driver | Control |
|-------------|---------|
| Log ingestion (per GB) | Log levels, sampling, excluding health checks, the Infrequent Access class |
| Log storage | Retention on every log group |
| Custom metrics | Avoid high-cardinality dimensions; EMF only for what you'll use |
| Alarms and dashboards | Fewer, better alarms; dashboards that people actually open |
| API polling by tools | Metric Streams instead of polling (for Datadog) |

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: During a regional incident at their observability vendor, a company's dashboards went blank and no alerts arrived. At the same time, a bad configuration push was causing 15% of checkout requests to fail. They found out from customers on social media 40 minutes later. **Decision**: A small set of critical alarms — error rate, latency, healthy hosts — runs in CloudWatch, completely independent of the vendor, paging through a separate SNS → PagerDuty path. Both paths are tested in every game day.

</div>

<div class="callout-scenario">

**Scenario**: To debug an incident, an engineer switched a busy service to DEBUG logging and forgot to switch it back. Log ingestion grew 20× and the monthly CloudWatch bill tripled before anyone noticed. **Decision**: Debug logging is enabled per request (a header) or with an automatic expiry; log ingestion per log group is on a dashboard with an anomaly-detection alarm; retention is enforced on every log group by policy.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why should a latency alarm use p99 instead of the average, and an error alarm use a rate instead of a count?

<details>
<summary>Show answer</summary>

The **average** blends fast and slow requests: 97% at 50 ms and 3% at 5 s averages about 200 ms, which looks fine while thousands of customers wait. **p99** shows the slowest 1% directly. A raw **error count** grows with traffic — 500 errors could be 0.01% on sale night or 50% at 4 AM; an **error rate** (errors ÷ requests) means the same thing at any traffic level.

</details>

**L2.** Name three questions CloudTrail answers that CloudWatch metrics can't.

<details>
<summary>Show answer</summary>

(1) **Who** changed this security group (or deleted this queue), and from which IP? (2) **When** exactly was this IAM policy modified, and what were the request parameters? (3) Did anyone sign in as the root user, create access keys, or try to stop logging? CloudWatch tells you *how the system is behaving*; CloudTrail tells you *who did what to it*.

</details>

### 🟡 Medium — Apply it

**M1.** ShopNorth's on-call engineer was paged 9 times last week by an "SQS queue depth > 1,000" alarm, and every time the backlog cleared on its own within 10 minutes. Redesign the alarm.

<details>
<summary>Show answer</summary>

Queue depth is a cause-level signal that rises with every traffic burst. Alarm on the **symptom**: `ApproximateAgeOfOldestMessage` (how long the oldest notification has waited) above the business tolerance — e.g., 10 minutes for order emails — for 3 of 5 datapoints. Keep depth on a dashboard. Add a composite condition if needed (age high AND consumers healthy → scale problem; age high AND consumer errors → bug). Route it to Slack during business hours and page only if it persists past the email SLA. Review the alarm's history after a week.

</details>

**M2.** Write the plan to get Lambda logs, ALB metrics, and RDS metrics into Datadog, while keeping a safety net in CloudWatch.

<details>
<summary>Show answer</summary>

Install Datadog's AWS integration (a CloudFormation stack from Datadog that creates a read-only IAM role), and enable a **CloudWatch Metric Stream** to Datadog through Firehose for near-real-time AWS metrics (ALB, RDS, MSK, SQS, Lambda). For logs, a **subscription filter** on Lambda log groups forwards them (via Datadog's forwarder Lambda or Firehose). Set log retention in CloudWatch short (e.g., 14 days) since Datadog is the main search tool. Safety net: 5-6 CloudWatch alarms on customer-facing symptoms with SNS → PagerDuty, tested in game days, plus billing alarms and CloudTrail alerts that don't depend on Datadog.

</details>

### 🔴 High — Think like a senior

**H1.** Someone deleted a production SQS queue at 2:14 AM, breaking SMS notifications. Walk through the investigation and the prevention plan.

<details>
<summary>Show answer</summary>

**Investigate:** CloudTrail event history (or CloudTrail Lake) for `DeleteQueue` on that queue around 2:14 AM: the identity (an SSO session, a pipeline role, or an IaC deploy), source IP, user agent (console, CLI, CloudFormation), and the request. If it was a pipeline, find the Git commit and change set (maybe a renamed resource caused a replacement). If it was a person, check the session's other actions. **Recover:** recreate the queue from IaC; messages in it are lost, so republish from the source (the Notification service can re-read Kafka from an offset, or rebuild from orders paid in the window). **Prevent:** humans read-only in production; IaC protections (`DeletionPolicy`, change-set review for removals); an EventBridge rule alerting on `Delete*` actions for critical resources in production; and a postmortem focusing on the system gap, not the person.

</details>

**H2.** Design ShopNorth's monitoring for its three Lambda functions using only AWS-native tools — what you measure, alarm on, and look at.

<details>
<summary>Show answer</summary>

**Per function:** built-in metrics `Invocations`, `Errors`, `Throttles`, `Duration` (p99), `ConcurrentExecutions`; async destinations' queue depth and age; Scheduler failures and DLQ depth for `sales-report`; EventBridge `FailedInvocations` for the rules. **Business metrics via EMF:** images resized, report rows, alerts sent. **Alarms:** error rate > 1% for 3 of 5 minutes, any throttles on `sales-report`, failure queues not empty, and a **"heartbeat" alarm** — `sales-report` emits a `ReportProduced` metric, and an alarm with `treat_missing_data = breaching` fires if it's missing by 2 AM. **Logs:** structured JSON, 14-day retention, Logs Insights queries saved for cold starts and errors. **Tracing:** X-Ray or OpenTelemetry (ADOT) for the report's database and S3 calls. **Dashboard:** one row per function, linked from the runbooks.

</details>

## 🛠️ Mini Project — A Safety Net That Doesn't Depend on Anyone Else

**Goal**: Build CloudWatch monitoring for a small AWS app, with alarms you've seen fire. 1 weekend (free-tier friendly).

**Build**

1. Deploy a Lambda function behind a Function URL (or reuse your image resizer) that fails 5% of the time and logs structured JSON with an EMF metric.
2. Set 14-day retention on its log group; write Logs Insights queries for errors per 5 minutes and cold starts per hour.
3. Create an SNS topic with your email subscribed, and alarms: error rate > 2% (metric math, 3 of 5 datapoints), p99 duration, and a heartbeat alarm on your EMF metric with missing data treated as breaching.
4. Generate traffic, raise the failure rate to 20%, and watch the error-rate alarm fire and recover.
5. Create a composite alarm that combines two alarms, and a billing alarm on `EstimatedCharges` in `us-east-1`.
6. Change something in the console (e.g., the function's memory) and find the event in CloudTrail with your identity.

**Acceptance criteria**: three alarms that have fired and recovered (screenshots or alarm history), saved queries, and the CloudTrail event of your own change.

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you monitor services on AWS, and what do you alarm on?"**

I collect metrics, logs, and traces. AWS services publish metrics to CloudWatch, the applications emit structured logs and custom metrics, and traces come from X-Ray or OpenTelemetry, or a vendor like Datadog fed by CloudWatch metric streams. I alarm on customer-facing symptoms: error rate, latency percentiles against SLOs, failed key transactions, and the age of the oldest message in important queues, using M-of-N datapoints and composite alarms to avoid noise. Cause-level signals like CPU go on dashboards. I also keep a few critical alarms independent of the main observability vendor, and audit changes with CloudTrail.

</div>

<div class="callout-interview">

**Q: "What's the difference between CloudWatch and CloudTrail?"**

CloudWatch monitors how systems behave: metrics, logs, alarms, and dashboards, for performance and health. CloudTrail records what was done to AWS resources: every API call with the identity, time, source, parameters, and result, for audit, security, and troubleshooting, like who changed a security group. They work together. A CloudWatch alarm tells me something broke at 2:14, and CloudTrail tells me a deployment role deleted a queue at 2:13. CloudTrail events can also trigger EventBridge rules or CloudWatch metric filters for real-time security alerts.

</div>

<div class="callout-interview">

**Q: "How do you keep observability costs under control?"**

Logs are usually the biggest line, so I set retention on every log group, keep production at INFO with sampled or request-scoped debug logging, exclude health checks, and use cheaper log classes for rarely queried data. For metrics, I avoid high-cardinality dimensions like user IDs, and I use the embedded metric format instead of many API calls. I prefer metric streams to polling when exporting to a vendor, and I prune alarms and dashboards nobody uses. Ingestion per log group goes on a dashboard with an anomaly alarm, so a forgotten debug flag is caught in hours, not at month-end.

</div>

## Quick Reference

| Concept | Remember |
|---------|----------|
| Metric identity | Namespace + name + dimensions |
| Latency | Alarm on p95/p99, not averages |
| Errors | Alarm on rates (metric math) |
| Noise | M of N datapoints, composite alarms, missing-data treatment |
| Custom metrics | EMF from logs; mind cardinality |
| Logs | Retention on every group; Logs Insights; Live Tail |
| Vendor + CloudWatch | Metric Streams, log subscriptions, independent critical alarms |
| CloudTrail | Who did what, when; org trail to a locked bucket |
| Billing | `EstimatedCharges` in `us-east-1` + AWS Budgets |

> **Golden rule: alarm on what customers feel, keep a safety net that doesn't depend on your vendor, and make every change traceable to a person or a pipeline.**

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Datadog is ShopNorth's main observability tool, fed by CloudWatch Metric Streams and Lambda log subscriptions, while a few CloudWatch alarms on errors, latency, and healthy hosts page Kabir even if Datadog is down. CloudTrail answers "who changed what". Chapter 13 builds the rest.

**Continue the story:** [Chapter 13 · Observability with Datadog](/tutorials/journey-13-observability) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
