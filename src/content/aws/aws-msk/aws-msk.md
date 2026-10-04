# Amazon MSK — Managed Kafka: The Leased Printing Press Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Development — services & events** · ShopNorth uses this in [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices)

</div>
<!-- sdlc-stage:end -->

## The Leased Printing Press Analogy

A newspaper can get its presses in three ways:

- **Buy its own printing press.** Full control, but the newspaper must hire technicians, stock spare parts, and fix a jammed roller at 3 AM before the morning edition. That's **running Kafka yourself**.
- **Lease a press with on-site technicians.** The leasing company keeps the machines running, replaces failed parts, and applies updates during quiet hours. The newspaper still decides the layout, the number of pages, the print run, and who may collect copies. That's **Amazon MSK (provisioned)**.
- **Pay per copy printed** at a print shop, never seeing the machines. Simplest, but with the shop's limits on paper sizes and run lengths. That's **MSK Serverless**.

Whichever you choose, the newspaper still has to design good pages. Kafka's concepts — topics, partitions, consumer groups, offsets — are covered in [Apache Kafka Deep Dive](/tutorials/kafka-deep-dive). This tutorial is about running Kafka on AWS.

## 1. What MSK Does and What You Still Own

| AWS runs (MSK) | You decide and own |
|---------------|--------------------|
| Broker provisioning across availability zones | Number and size of brokers |
| Replacing failed brokers, patching, rolling restarts | Topics, partition counts, replication factor, retention |
| The controller quorum (KRaft) or ZooKeeper | Producer and consumer configuration, including retries |
| Storage volumes and encryption at rest | Access control: who may read and write which topics |
| Metrics in CloudWatch | Capacity planning, consumer lag, alarms |
| Version upgrades when you start them | When to upgrade, and testing your clients |

## 2. Your Options for Kafka on AWS

| Option | What it is | Good for | Watch out for |
|--------|-----------|----------|---------------|
| **MSK Provisioned — Standard brokers** | Brokers you size (e.g., `kafka.m7g.large`) with EBS storage | Most workloads; full Kafka configuration | You plan capacity and partitions |
| **MSK Provisioned — Express brokers** | Brokers with AWS-managed storage, more throughput per broker, and faster scaling and recovery | High-throughput clusters that need to scale often | Fewer configuration knobs |
| **MSK Serverless** | Pay per throughput and storage; no brokers to size | Spiky or small workloads, quick starts | Service limits on partitions and retention; IAM auth only |
| **Self-managed** (EC2 or Kubernetes with Strimzi) | You run everything | Special requirements, full control | All the 3 AM work is yours |
| **Confluent Cloud** (from AWS Marketplace) | A fully managed Kafka platform | Teams wanting connectors, schema registry, governance included | Cost; another vendor |

## 3. ShopNorth's Cluster

| Setting | Value | Why |
|---------|-------|-----|
| Type | MSK Provisioned, Standard brokers | Predictable cost for steady traffic, full configuration |
| Brokers | 3 × `kafka.m7g.large`, one per availability zone | Survives a zone failure; load tests showed headroom for the sale |
| Metadata | KRaft mode (Kafka's built-in Raft quorum, no ZooKeeper) | Fewer moving parts (see [Consensus & Coordination](/tutorials/consensus-coordination)) |
| Storage | EBS with storage auto-scaling, alarm at 70% used | Disks can grow; they can't shrink |
| Authentication | **IAM access control** on port 9098 | Each service's IAM role decides its topics — no passwords to rotate |
| Encryption | TLS in transit, KMS at rest | Required for IAM auth anyway |
| Topics | `orders.events`, `payments.events`, `inventory.events`, `catalog.events` | One topic per domain, keyed by entity ID |
| Partitions | 12 for `orders.events` (after Chapter 14's load test) | Enough parallelism for consumers |
| Replication | Replication factor 3, `min.insync.replicas` = 2 | A write survives a broker loss; one broker down still accepts writes |
| Retention | 7 days | Room to replay after a bug fix |
| Network | Private data subnets; security group allows 9098 from EKS nodes only | No public access ([Networking & VPC](/tutorials/aws-networking-vpc)) |

## 4. Connecting a Spring Boot Service with IAM Auth

Add the `software.amazon.msk:aws-msk-iam-auth` library, and Spring Kafka uses the pod's IAM role (from EKS Pod Identity) to authenticate:

```yaml
spring:
  kafka:
    bootstrap-servers: ${SPRING_KAFKA_BOOTSTRAP_SERVERS}   # the three brokers, port 9098 (Chapter 12)
    properties:
      security.protocol: SASL_SSL
      sasl.mechanism: AWS_MSK_IAM
      sasl.jaas.config: software.amazon.msk.auth.iam.IAMLoginModule required;
      sasl.client.callback.handler.class: software.amazon.msk.auth.iam.IAMClientCallbackHandler
    producer:
      acks: all                          # wait for the in-sync replicas
      properties:
        enable.idempotence: true         # no duplicates from producer retries
        delivery.timeout.ms: 120000      # keep retrying through a broker restart
    consumer:
      enable-auto-commit: false          # commit offsets after processing (Spring's listener container does it)
```

The IAM policy decides what each service may do — the Order service's role can write `orders.*` topics and use its own consumer groups ([IAM](/tutorials/aws-iam)). A misconfigured service gets an authorization error instead of reading another domain's data.

<div class="callout-warn">

**MSK restarts brokers for patching — your clients must not notice.** Rolling restarts are routine. Producers need idempotence, enough retries, and a delivery timeout longer than a broker restart; consumers need to handle rebalances. Test it: trigger a broker reboot in staging while running a load test, and check that no messages were lost or duplicated in the consumers' results.

</div>

## 5. Partitions: Plan Them Like Capacity

- **Consumer parallelism is capped by partitions.** A consumer group can have at most one active consumer per partition. Chapter 14's load test found order-confirmation emails delayed by 25 minutes because the topic had too few partitions; ShopNorth moved to 12.
- **Adding partitions later changes where keys land.** Records with the same key go to the same partition only while the partition count stays the same. ShopNorth added partitions during a quiet period, after which per-order ordering continued on the new layout.
- **More partitions aren't free.** Each one costs broker memory, file handles, and recovery time. Size for the parallelism you need plus headroom, not "1,000 just in case".
- **Retention × throughput = disk.** 7 days of sale traffic must fit with room to spare; **tiered storage** moves older segments to cheaper storage when long retention is needed.

## 6. Operating MSK

| Metric (CloudWatch) | Alarm when | Meaning |
|---------------------|-----------|---------|
| Consumer lag (`MaxOffsetLag`, `SumOffsetLag`, or time-based lag) | Growing for 5+ minutes | Consumers can't keep up — the main health signal |
| `UnderReplicatedPartitions` | > 0 for 5 minutes | A broker is down or slow; durability is reduced |
| `KafkaDataLogsDiskUsed` | > 70% | Disk will fill; storage auto-scaling or retention |
| `CpuUser` + `CpuSystem` | > 60% sustained | Brokers are undersized for the load |
| `ActiveControllerCount` | Not exactly 1 | Cluster metadata problem |

Datadog collects the same metrics through its AWS integration and the consumer-lag view sits on the checkout dashboard (Chapter 13). Lag also drives autoscaling for some consumers through KEDA.

<div class="callout-tip">

**Cross-AZ traffic adds up.** MSK doesn't charge for replication between brokers, but clients reading from a broker in another zone pay normal cross-AZ data transfer. With **rack awareness** (setting `client.rack` to the consumer's AZ ID), consumers can fetch from a replica in their own zone — a cheap win for read-heavy topics.

</div>

## 7. MSK Connect: Moving Data In and Out

**MSK Connect** runs Kafka Connect connectors for you. ShopNorth uses one: an **S3 sink connector** that archives every `orders.events` record to `shopnorth-events-archive` in hourly files. The analytics team queries it with Athena, and it doubles as long-term history beyond the 7-day retention. (Change data capture with Debezium is another common connector, as an alternative to the outbox relay in Chapter 6.)

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: During a routine MSK patch, a team's order service logged `NotLeaderOrFollowerException` and dropped several hundred events. Its producer had `retries=0` and a 5-second delivery timeout from an old tuning attempt, so it gave up during the few seconds a broker was restarting. **Decision**: Producer idempotence on, retries left at the default, delivery timeout of 2 minutes, and the outbox pattern so that even a producer failure only delays events — they're re-sent from the database (Chapter 6).

</div>

<div class="callout-scenario">

**Scenario**: A marketing campaign tripled event volume, and broker disks filled within a day. Brokers stopped accepting writes, and every producer started failing. **Decision**: Storage auto-scaling with headroom, an alarm at 70% disk, retention sized from load-test throughput, tiered storage for topics that need long history, and a runbook for emergency retention reduction.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** ShopNorth uses replication factor 3 and `min.insync.replicas` = 2 with `acks=all`. What happens to writes when one broker is down? When two are down?

<details>
<summary>Show answer</summary>

**One broker down:** each partition still has 2 in-sync replicas, which meets `min.insync.replicas`, so writes succeed and no acknowledged data is lost. **Two brokers down:** partitions have only 1 in-sync replica, below the minimum, so producers with `acks=all` get errors (`NotEnoughReplicas`) and writes stop — Kafka chooses consistency over availability. Reads of existing data may still work from the remaining replica.

</details>

**L2.** Name three things MSK does for you and three that remain your job.

<details>
<summary>Show answer</summary>

**MSK:** provisions brokers across AZs, replaces failed brokers and patches them with rolling restarts, manages the controller quorum (KRaft or ZooKeeper), handles storage and encryption at rest, and publishes metrics. **Yours:** topic design (partitions, replication, retention), client configuration (idempotence, retries, consumer commits), access control policies, capacity planning, monitoring consumer lag, and choosing when to upgrade.

</details>

### 🟡 Medium — Apply it

**M1.** The search indexer's consumer lag on `catalog.events` grows every evening and recovers overnight. CPU on the indexer pods is low. Diagnose and fix.

<details>
<summary>Show answer</summary>

Low CPU with growing lag means the consumer is waiting, not working: most likely each record triggers a slow synchronous call (OpenSearch indexing one document at a time) and parallelism is capped by the partition count or by single-threaded processing. Check: partition count vs consumer instances, time per record, OpenSearch bulk-indexing latency and throttling. Fixes: **batch** (Spring Kafka batch listeners + OpenSearch bulk API), increase consumers up to the partition count and add partitions if needed (with the key-mapping caveat), scale consumers on lag with KEDA, and alarm on lag in time units (seconds behind) rather than offsets.

</details>

**M2.** ShopNorth's new analytics team wants 2 years of order events. Kafka retention is 7 days. Design it.

<details>
<summary>Show answer</summary>

Don't stretch Kafka retention to 2 years on broker disks. Options: (1) **MSK Connect S3 sink** writing events to S3 in a columnar format (Parquet), partitioned by date, queried with Athena or loaded into a warehouse — cheap and durable (ShopNorth's choice). (2) **Tiered storage** for a longer replayable window inside Kafka (months), if consumers truly need Kafka-native replay. Apply S3 lifecycle rules (to infrequent access after 90 days), remove or tokenize personal data before archiving, and document the schema versions so old events stay readable.

</details>

### 🔴 High — Think like a senior

**H1.** Compare MSK Provisioned, MSK Serverless, and Confluent Cloud for ShopNorth at today's size and at 10× growth.

<details>
<summary>Show answer</summary>

**Today (moderate, predictable traffic with a known sale peak):** MSK Provisioned with 3 brokers is cost-effective and familiar; capacity is planned around the sale. MSK Serverless would avoid sizing but has limits (partitions, retention, IAM-only auth) and per-throughput pricing that's attractive mainly for small or spiky use. Confluent Cloud adds managed connectors, schema registry, and governance at a higher price — valuable if the team lacks Kafka expertise. **At 10×:** Provisioned with Express brokers (more throughput per broker, faster scaling) or more Standard brokers with careful partition planning; Confluent becomes more attractive as connector and governance needs grow. Decide on total cost of ownership — including engineer time on upgrades, scaling, and incidents — not the broker price alone, and keep the client code portable (plain Kafka APIs).

</details>

**H2.** Design a test that proves ShopNorth's order events survive an MSK broker failure during the sale with no loss and no duplicates reaching the database.

<details>
<summary>Show answer</summary>

In staging, run a k6 load test at sale rate creating orders, so that every order produces `OrderPaid` through the outbox. During the test, **reboot one broker** (MSK supports rebooting a broker) and later simulate a zone failure for clients. Measure: producer errors (should be retried transparently), consumer rebalances, end-to-end lag. **Verify** afterwards: every order in the Order database has exactly one corresponding processed record in each consumer's store (Inventory, Notification), comparing by order ID and event ID — duplicates delivered by Kafka must be absorbed by idempotent consumers, and nothing may be missing. Repeat with a consumer pod killed mid-batch. Automate it as a game-day script and run it before every sale.

</details>

## 🛠️ Mini Project — Kafka on AWS, Done Right

**Goal**: Run a Spring Boot producer and consumer against MSK with IAM auth, and survive a broker reboot. 1 weekend (MSK Serverless or a small provisioned cluster; delete it afterwards — it bills hourly).

**Build**

1. Create an MSK Serverless cluster (simplest) in private subnets, or a 3-broker `kafka.t3.small` provisioned cluster for practice.
2. Run a small EC2 instance or ECS task in the same VPC with an IAM role that may write and read one topic; create the topic with 6 partitions.
3. Build a Spring Boot producer (idempotent, `acks=all`) that sends `OrderPaid` events keyed by order ID, and a consumer that stores processed event IDs in PostgreSQL and skips duplicates.
4. Produce 100,000 events; while running, reboot a broker (provisioned) or restart the consumer; then verify counts match exactly.
5. Create CloudWatch alarms on consumer lag and (provisioned) disk usage; make the consumer slow and watch the lag alarm fire.

**Acceptance criteria**: 100,000 events produced, 100,000 processed exactly once in the database, an alarm that fired, and IAM-only access (no passwords).

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "Why would you use Amazon MSK instead of running Kafka yourself?"**

MSK runs the undifferentiated parts of Kafka: provisioning brokers across availability zones, replacing failed brokers, patching with rolling restarts, the controller quorum, encrypted storage, and metrics. That removes a lot of on-call load for a team whose job is the business, not Kafka. I still own topic design, partitions and retention, client configuration, access control, capacity planning, and monitoring consumer lag. I'd self-manage only with a strong platform team and specific needs, like custom builds or plugins MSK doesn't support. Otherwise, the operational savings usually outweigh the price difference.

</div>

<div class="callout-interview">

**Q: "How do you configure Kafka producers and consumers to avoid losing or duplicating messages?"**

Producers use acks set to all, so every in-sync replica confirms the write, with idempotence enabled so retries don't create duplicates, and a delivery timeout long enough to ride out a broker restart. Topics have a replication factor of three and a minimum of two in-sync replicas. Consumers disable auto-commit and commit offsets only after processing succeeds, which gives at-least-once delivery, so the processing itself is idempotent, by storing processed event IDs or using unique keys. To avoid losing events when Kafka itself is unavailable, I'd write them to an outbox table in the same transaction as the business change and publish from there.

</div>

<div class="callout-interview">

**Q: "How do you decide the number of partitions for a topic?"**

From the parallelism and throughput I need: at most one consumer per partition in a group, so I size for the peak number of consumers I want, plus headroom. I check throughput per partition against measured producer and consumer rates. Ordering matters, because ordering is per partition and keys map to partitions by hash, so adding partitions later changes where keys land, and I plan it for a quiet period. Too many partitions cost broker memory, recovery time, and rebalance time. I validate with a load test at peak and watch consumer lag.

</div>

## Quick Reference

| Concept | Remember |
|---------|----------|
| MSK | AWS runs brokers, patching, quorum; you own topics, clients, access, capacity |
| Options | Provisioned (Standard / Express), Serverless, self-managed, Confluent |
| IAM auth | Port 9098, `aws-msk-iam-auth`, permissions per topic and group |
| Durability | RF 3, `min.insync.replicas` 2, `acks=all`, idempotent producer |
| Patching | Rolling restarts — clients must retry |
| Partitions | Cap consumer parallelism; adding them remaps keys |
| Key alarms | Consumer lag, under-replicated partitions, disk usage |
| Long history | MSK Connect → S3, or tiered storage |
| Cross-AZ cost | Rack-aware fetching for consumers |

> **Golden rule: MSK takes the brokers off your hands, not the design — partitions, client settings, and idempotent consumers are still yours to get right.**

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's order, payment, inventory, and catalog events flow through a 3-broker MSK cluster across three zones, with IAM auth per service, `acks=all`, and 12 partitions for orders after the sale-day load test. Chapter 6 builds the events and the outbox.

**Continue the story:** [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
