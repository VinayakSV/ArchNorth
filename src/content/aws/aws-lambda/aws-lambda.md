# AWS Lambda & Serverless — The On-Call Electrician Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Development — services & events** · ShopNorth uses this in [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices)

</div>
<!-- sdlc-stage:end -->

## The On-Call Electrician Analogy

A building management company doesn't keep electricians sitting in every building. It has an agency on call:

- When a resident reports a fault, the agency **sends an electrician** for that one job. You pay only for the minutes they work. That's a **Lambda invocation**, billed by duration.
- The **first call of the morning takes longer**: the electrician has to drive in and unpack tools. Later calls in the same area start immediately. That's a **cold start** versus a **warm start**.
- The agency won't take a job longer than **15 minutes** — bigger jobs need a contractor with a van. That's Lambda's **maximum timeout**.
- Your contract allows at most **20 electricians at once**; the 21st call waits or gets turned away. That's **concurrency** and **throttling**.
- Each job comes with a **ticket** describing the fault: building, flat, what's broken. That's the **event**.

You never hire, house, or manage the electricians. You only describe the job and pay for the work done. That's the promise of serverless.

## 1. What Lambda Is

A **Lambda function** is code plus configuration that AWS runs in response to events. You don't manage servers, operating systems, or scaling.

| Setting | Range | Notes |
|---------|-------|-------|
| Memory | 128 MB to 10,240 MB | **CPU scales with memory** — more memory often makes Java faster and cheaper |
| Timeout | Up to 15 minutes | Set it slightly above the real worst case, never the maximum "just in case" |
| Temporary disk (`/tmp`) | 512 MB up to 10,240 MB | Lost when the environment is recycled |
| Package | ZIP (with layers) or container image up to 10 GB | Container images let you reuse Docker tooling |
| Pricing | Per request + per GB-second (billed per millisecond) | Free when idle |

Lambda runs your handler inside an **execution environment** that AWS creates on demand and reuses for later invocations. Anything you create *outside* the handler (SDK clients, connection pools, parsed config) survives between invocations in the same environment.

## 2. Three Ways a Function Gets Invoked

| Model | Who calls | Retries | Examples |
|-------|-----------|---------|----------|
| **Synchronous** | The caller waits for the result | Caller's job | API Gateway, ALB, Function URLs, SDK `invoke` |
| **Asynchronous** | Lambda queues the event and returns immediately | Lambda retries twice by default, then sends the event to an **on-failure destination** or DLQ | S3 notifications, SNS, EventBridge, EventBridge Scheduler |
| **Event source mapping** (polling) | Lambda polls a queue or stream and invokes your function with batches | Depends on the source: SQS messages become visible again; streams retry the batch in order | SQS, Kinesis, DynamoDB Streams, MSK |

<div class="callout-info">

**Payload limits went up.** Older material says asynchronous invocations, SQS messages, and EventBridge events are limited to 256 KB. Since late 2025 and early 2026, asynchronous Lambda invocations, SQS, and EventBridge accept payloads up to **1 MB**. Large data still belongs in S3, with the event carrying the object key.

</div>

For SQS batches, report **partial failures** so one bad message doesn't make the whole batch retry:

```java
public class EmailJobHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {
    @Override
    public SQSBatchResponse handleRequest(SQSEvent event, Context context) {
        List<SQSBatchResponse.BatchItemFailure> failures = new ArrayList<>();
        for (SQSEvent.SQSMessage message : event.getRecords()) {
            try {
                process(message);                              // must be idempotent: SQS is at-least-once
            } catch (Exception e) {
                failures.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
            }
        }
        return new SQSBatchResponse(failures);                 // only these messages are retried
    }
}
```

(The event source mapping needs `ReportBatchItemFailures` enabled for this response to count.)

## 3. Cold Starts and Java

A **cold start** happens when Lambda must create a new execution environment: download the code, start the JVM, load classes, and run your initialization. For a plain Java handler that's often under a second; for a function that boots a full Spring context, it can be several seconds.

| Technique | What it does | Cost |
|-----------|-------------|------|
| **SnapStart** (Java, also Python and .NET) | Lambda runs your initialization once at publish time, snapshots the memory, and restores from the snapshot on cold starts — typically sub-second | No extra charge for Java; restore hooks needed for uniqueness and connections |
| **Provisioned concurrency** | Keeps N environments initialized and ready | You pay for them all the time |
| **Smaller init** | Plain Java or a light framework instead of a full Spring Boot context; lazy loading | Engineering effort |
| **More memory** | More CPU for the JVM and JIT | Higher per-ms price, often offset by shorter duration |

<div class="callout-warn">

**SnapStart restores the same snapshot many times.** Anything that should be unique per environment — random seeds, generated IDs, temporary credentials cached in fields — must be refreshed after restore (CRaC `afterRestore` hooks). SDK clients and connection pools should tolerate their network connections having been dropped. Test SnapStart functions with real restores, not just local runs.

</div>

## 4. Concurrency and Scaling

```
concurrent executions = requests per second × average duration (seconds)
200 uploads/s × 1.5 s = 300 concurrent executions
```

| Concept | Meaning |
|---------|---------|
| **Account concurrency limit** | Shared by all functions in a region; defaults to 1,000 (a soft limit you can raise) |
| **Scaling rate** | Each function can add up to 1,000 concurrent executions every 10 seconds |
| **Reserved concurrency** | Guarantees capacity for a function *and* caps it — a throttle for protecting downstreams |
| **Provisioned concurrency** | Pre-initialized environments for latency-sensitive paths |
| **Throttling** | Over the limit: synchronous callers get a 429; async events are retried for hours |

<div class="callout-scenario">

**Scenario**: A team's Lambda API scaled from 50 to 900 concurrent executions during a marketing push. Each execution opened its own database connection, the PostgreSQL instance hit `max_connections`, and every other application using that database started failing. **Decision**: Put **RDS Proxy** between Lambda and the database (it pools and shares connections), set **reserved concurrency** to cap the function at what the database can serve, and move bulk writes behind an SQS queue so they're processed at a controlled rate.

</div>

## 5. ShopNorth's Three Functions

ShopNorth's core services run on EKS, but three jobs are a natural fit for Lambda — **event-driven, bursty, and short**:

| Function | Trigger | What it does | Why Lambda |
|----------|---------|-------------|------------|
| `image-resizer` | A new object in `shopnorth-product-images-prod/originals/` (an S3 event routed through [EventBridge](/tutorials/aws-eventbridge)) | Creates 200, 600, and 1,200 px versions under `resized/`, served by CloudFront | Catalog onboarding uploads 500 photos at once, then nothing for days |
| `security-alerts` | Auth0 log events on an EventBridge partner bus, filtered to failed-login bursts and breached-password detections | Posts to Slack and creates a Datadog event | A few events a day, must never be missed |
| `sales-report` | EventBridge Scheduler, 1:00 AM IST daily | Reads yesterday's orders from the read replica, writes a CSV to S3, emails a presigned link | One run a day; reserved concurrency = 1 so runs never overlap |

The resizer's handler:

```java
public class ImageResizer implements RequestHandler<Map<String, Object>, Void> {

    // Created during initialization (captured by SnapStart) and reused across invocations
    private static final S3Client S3 = S3Client.builder().region(Region.AP_SOUTH_1).build();
    private static final int[] WIDTHS = {200, 600, 1200};

    @Override
    @SuppressWarnings("unchecked")
    public Void handleRequest(Map<String, Object> event, Context context) {
        var detail = (Map<String, Object>) event.get("detail");                       // EventBridge "Object Created"
        String bucket = (String) ((Map<String, Object>) detail.get("bucket")).get("name");
        String key = (String) ((Map<String, Object>) detail.get("object")).get("key");  // originals/SKU-123/front.jpg

        byte[] original = S3.getObjectAsBytes(b -> b.bucket(bucket).key(key)).asByteArray();
        for (int width : WIDTHS) {
            byte[] resized = Images.resizeToJpeg(original, width);                    // e.g., with Thumbnailator
            String target = key.replaceFirst("^originals/", "resized/" + width + "/"); // same input → same output key
            S3.putObject(b -> b.bucket(bucket).key(target).contentType("image/jpeg"),
                         RequestBody.fromBytes(resized));
        }
        context.getLogger().log("resized " + key);
        return null;
    }
}
```

Design choices that keep it safe:

- **Idempotent by construction.** The output key depends only on the input key, so a retry overwrites the same objects.
- **No infinite loop.** It reads `originals/` and writes `resized/`; its IAM role can't write to `originals/`, and the trigger only matches that prefix (see [IAM](/tutorials/aws-iam)).
- **Failures are kept.** Asynchronous retries (2), then an on-failure destination SQS queue, with an alarm when it's not empty.
- **Outside the VPC.** It only needs S3, so no VPC configuration, no NAT, faster starts. Only `sales-report` runs in the VPC, because it reads the database.

## 6. Lambda Behind an API: API Gateway and Function URLs

| Front door | Use it when | Notes |
|-----------|-------------|-------|
| **API Gateway — HTTP API** | Most new serverless APIs | Cheaper and simpler; JWT authorizers built in |
| **API Gateway — REST API** | You need usage plans and API keys, request validation, caching, or private APIs | More features, more cost; default integration timeout 29 s |
| **ALB → Lambda** | You already have an ALB and want to add a few function routes | Path-based routing to functions |
| **Function URL** | A simple HTTPS endpoint for one function (webhooks) | Built-in, with IAM or no auth — validate signatures yourself |

ShopNorth's API is a Spring Cloud Gateway on EKS (Chapter 6), so it doesn't use API Gateway — but many companies build entire APIs as API Gateway + Lambda, and you'll likely work on one.

## 7. Orchestrating Functions: Step Functions

When a process has several steps, retries, waits, or human approvals, chaining Lambdas by having each call the next becomes fragile. **AWS Step Functions** runs a state machine that calls each step, handles retries and timeouts, and shows every execution visually. **Standard** workflows can run for up to a year with exactly-once step execution; **Express** workflows are for high-volume, short (up to 5 minutes) flows at lower cost. A return-and-refund flow — wait for the courier pickup, inspect, refund, notify — is a classic fit.

## 8. Best Practices and Pitfalls

| Practice | Why |
|----------|-----|
| Make handlers idempotent | Async and polling sources deliver at least once (Powertools for AWS Lambda has an idempotency utility backed by DynamoDB) |
| Set timeouts below the caller's timeout | Otherwise the caller gives up while the function keeps working |
| Always configure a DLQ or on-failure destination for async triggers | Failed events otherwise disappear after the retries |
| Initialize clients outside the handler | Reused across warm invocations |
| Put Lambdas in a VPC only when they need private resources | VPC functions need NAT or endpoints for everything else |
| Cap concurrency for anything that touches a database | Lambda scales faster than databases do |
| Structured JSON logs with a correlation ID | Logs go to CloudWatch Logs; Datadog or OpenTelemetry for traces |
| Watch the bill for steady high traffic | At sustained load, containers are usually cheaper ([Cloud & Infrastructure Decisions](/tutorials/cloud-infra-decisions)) |

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A thumbnail function was triggered by every new object in a bucket and wrote its thumbnails into the same bucket. Each thumbnail triggered the function again, which created a thumbnail of the thumbnail — an infinite loop that ran up a large bill over a weekend. **Decision**: Separate prefixes (or buckets) for input and output, triggers filtered to the input prefix, an IAM role that can't write to the input prefix, reserved concurrency as a fuse, and a budget alarm.

</div>

<div class="callout-scenario">

**Scenario**: A payment webhook handler built as a Lambda with a full Spring Boot context had cold starts of 6-8 seconds. The payment provider's webhook timeout was 5 seconds, so after quiet periods the first webhooks failed and were retried — sometimes processed twice. **Decision**: SnapStart brought cold starts under a second; the handler now stores the webhook and returns `200` immediately, processing it asynchronously with idempotency on the provider's event ID.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** For each, say whether Lambda is a good fit and why: (a) resizing uploaded images, (b) a WebSocket chat server, (c) a nightly 3-hour data migration, (d) processing messages from an SQS queue, (e) ShopNorth's checkout API at 150 orders/s all evening.

<details>
<summary>Show answer</summary>

(a) **Yes** — event-driven, bursty, short. (b) **Not directly** — long-lived connections don't fit; API Gateway WebSocket APIs can front Lambda, but a container service is often simpler. (c) **No** — exceeds the 15-minute limit; use ECS/Fargate, AWS Batch, or Step Functions to split the work. (d) **Yes** — an event source mapping with batching and partial failures. (e) **Possible but usually not ideal** — steady, high, latency-sensitive traffic is cheaper and more predictable on containers, and it would need RDS Proxy and careful cold-start handling.

</details>

**L2.** A function averages 400 ms and receives 1,500 requests/s at peak. How many concurrent executions does it need, and what limit might it hit?

<details>
<summary>Show answer</summary>

1,500 × 0.4 = **600 concurrent executions**. That fits under the default 1,000 account-level limit — but that limit is shared by *all* functions in the region, so other functions could be throttled. Reserve concurrency for critical functions, or raise the account limit through Service Quotas well before the event.

</details>

### 🟡 Medium — Apply it

**M1.** ShopNorth's `image-resizer` sometimes fails on corrupt uploads. Design the failure handling end to end.

<details>
<summary>Show answer</summary>

The function validates the image and throws a clear error for corrupt files. As an asynchronous invocation, Lambda retries twice, then sends the event to an **on-failure destination** (an SQS queue `image-resizer-failures`), with the original event and error details. A CloudWatch alarm on that queue's visible messages notifies the catalog team. The admin UI shows "processing failed — please re-upload" for products whose resized images don't exist after a few minutes. Set a **maximum event age** so very old events aren't retried after an outage, and make sure retries are harmless (idempotent output keys).

</details>

**M2.** A Java Lambda behind API Gateway has p99 latency of 4 s caused by cold starts. List your options in order of effort.

<details>
<summary>Show answer</summary>

(1) Increase memory (more CPU speeds JVM startup and JIT) and measure. (2) Enable **SnapStart** with restore hooks — usually the biggest win for Java. (3) Trim initialization: avoid classpath scanning and heavy frameworks, use lazy initialization, smaller dependencies. (4) **Provisioned concurrency** for the baseline traffic, possibly scheduled for business hours. (5) If traffic is steady and latency-critical, move the endpoint to a container service. Measure the cold start rate first — if it's 0.5% of requests, fixing p99 may be cheap; if traffic is very spiky, cold starts are frequent.

</details>

### 🔴 High — Think like a senior

**H1.** A colleague proposes rebuilding all of ShopNorth's services as Lambda functions to "eliminate Kubernetes operations". Give a balanced assessment.

<details>
<summary>Show answer</summary>

**Gains:** no cluster or node management, scale to zero, per-request cost for spiky services, simpler operations for small event handlers. **Costs and risks for ShopNorth:** steady sale-night load (3,000 requests/s) is cheaper on containers; Spring Boot services would need rework for cold starts (SnapStart helps); database connections need RDS Proxy and concurrency caps; long-lived Kafka consumers become event source mappings with different semantics; local development and testing change; existing investments (Argo Rollouts canaries, Datadog setup, Helm charts) would be redone. **Recommendation:** keep the core services on EKS, use Lambda where it shines (event glue, scheduled jobs, spiky background work), and revisit if operational cost becomes the bottleneck — maybe ECS Fargate is the middle ground. Decide with numbers in an ADR.

</details>

**H2.** Design the `sales-report` Lambda so it's secure, never runs twice in parallel, and tells someone when it fails.

<details>
<summary>Show answer</summary>

**Trigger:** EventBridge Scheduler at 01:00 IST with a retry policy and a DLQ. **Concurrency:** reserved concurrency = 1, so overlapping runs are throttled; plus an idempotency record ("report for 2026-11-07 done") in S3 or DynamoDB so a retry after success doesn't send twice. **Network and data access:** VPC-attached in private subnets with a security group allowed only to the read replica on 5432; credentials for a read-only database user from Secrets Manager; the IAM role can write only to `shopnorth-reports-prod/daily/` and send email through SES from one address. **Output:** the CSV in S3 (SSE-KMS), with a presigned URL valid for 24 hours in the email. **Failure visibility:** alarms on the function's `Errors` metric, on the Scheduler DLQ, and a "report not produced by 2 AM" check (a missing-data alarm on a custom metric the function emits on success).

</details>

## 🛠️ Mini Project — Serverless Image Pipeline

**Goal**: Build ShopNorth's image pipeline in miniature. 1 weekend (free-tier friendly).

**Build**

1. Create an S3 bucket with `originals/` and `resized/` prefixes and enable EventBridge notifications on it.
2. Write the `ImageResizer` handler in Java 21 (Thumbnailator for resizing), package it, and deploy it with AWS SAM (or the console for a first try), 1,024 MB memory, 30 s timeout.
3. Add an EventBridge rule for `Object Created` events whose key starts with `originals/`, targeting the function, with an on-failure destination SQS queue.
4. Enable **SnapStart** on a published version; compare cold start durations (the `Init Duration` / `Restore Duration` in the logs) with and without it.
5. Upload 50 images at once; check concurrency and duration metrics in CloudWatch.
6. Upload a corrupt file and confirm the event lands in the failure queue.

**Acceptance criteria**: resized images for every original, a measured cold-start comparison, and a failure that ends up in the queue rather than disappearing.

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "When would you choose Lambda, and when would you avoid it?"**

I choose Lambda for event-driven, short, and bursty work: reacting to uploads, queue messages, scheduled jobs, glue between services, and low or spiky-traffic APIs, where scale-to-zero and no servers to manage are worth the most. I avoid it for long-running work over 15 minutes, long-lived connections, steady high-throughput services where containers are cheaper and more predictable, and latency-critical paths where cold starts can't be engineered away. I also check the downstream limits, because Lambda can scale to hundreds of concurrent executions in seconds and overwhelm a database without RDS Proxy and concurrency caps.

</div>

<div class="callout-interview">

**Q: "What is a cold start, and how do you reduce it for Java?"**

A cold start is the extra latency when Lambda creates a new execution environment: downloading code, starting the runtime, and running initialization. For Java with a heavy framework, that can be several seconds. To reduce it, I use SnapStart, which snapshots the initialized environment and restores it, with hooks for anything that must be unique per environment. I keep initialization light by avoiding heavy dependency injection and classpath scanning, give the function more memory, since CPU scales with it, and use provisioned concurrency where steady low latency matters. I always measure how often cold starts actually happen first.

</div>

<div class="callout-interview">

**Q: "How do retries work for asynchronous Lambda invocations, and how do you avoid losing events?"**

For asynchronous sources like S3, SNS, or EventBridge, Lambda queues the event and retries a failed invocation twice by default, with delays, within a configurable maximum event age. After that, the event goes to an on-failure destination or a dead-letter queue, if one is configured; otherwise it's dropped. So I always configure a failure destination with an alarm on it, and make the handler idempotent, because retries and at-least-once delivery mean the same event can arrive more than once. For SQS sources, I use partial batch responses, so one bad message doesn't retry the whole batch, and a redrive policy to a DLQ.

</div>

<div class="callout-interview">

**Q: "How do you stop a Lambda function from overloading a relational database?"**

Lambda scales by adding concurrent environments, each potentially with its own connection, so a burst can exhaust the database's connection limit. I'd put RDS Proxy in front of the database to pool connections, set reserved concurrency to cap the function at what the database can handle, and keep connections outside the handler so warm invocations reuse them. For write-heavy bursts, I'd buffer the work in SQS and process it with controlled batch sizes and concurrency. Then I'd monitor database connections and throttles together.

</div>

## Quick Reference

| Concept | Remember |
|---------|----------|
| Limits | 15 min timeout; 128 MB-10 GB memory (CPU scales with it); payloads up to 1 MB for async, SQS, EventBridge |
| Invocation | Sync (caller waits) · async (2 retries → destination) · polling (event source mappings) |
| Concurrency | Requests/s × duration; account default 1,000; reserved = guarantee + cap |
| Cold starts (Java) | SnapStart, light init, more memory, provisioned concurrency |
| SQS batches | Partial batch responses, DLQ via redrive |
| Databases | RDS Proxy + concurrency caps |
| VPC | Only when private resources are needed |
| Fits | Event glue, schedules, bursty work |
| Doesn't fit | Long jobs, long connections, steady high load |

> **Golden rule: Lambda is perfect for work that arrives in bursts and finishes quickly — make every handler idempotent and cap anything that touches a database.**

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's core services stay on EKS, but three jobs run on Lambda: resizing product images when they're uploaded, alerting on suspicious logins from Auth0, and the nightly sales report. Chapter 6 shows the event-driven design they plug into.

**Continue the story:** [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
