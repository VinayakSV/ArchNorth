# Design WhatsApp / Messenger — The Post Office Analogy

## The Post Office Analogy

Imagine a post office that delivers letters instantly. You write a letter, hand it to the postman, and your friend receives it in milliseconds — even if they're on the other side of the world. If your friend isn't home, the letter waits at their local post office until they pick it up. If both of you are home, you can have a real-time conversation through letters. Now scale this to 2 billion people sending 100 billion messages per day. That's WhatsApp.

---

## 1. Requirements

### Functional
- One-on-one messaging (text, image, video, audio)
- Group chat (up to 1024 members)
- Message delivery status (sent ✓, delivered ✓✓, read 🔵)
- Online/offline presence indicator
- End-to-end encryption
- Push notifications for offline users
- Message history and search

### Non-Functional
- **Scale**: 2B users, 100B messages/day (~1.2M messages/sec)
- **Latency**: Message delivered in < 100ms (both online)
- **Reliability**: No message loss — every message must be delivered
- **Ordering**: Messages appear in the order they were sent
- **Security**: End-to-end encryption — even the server can't read messages

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        C1[User A - Phone]
        C2[User B - Phone]
        C3[User C - Web]
    end

    subgraph Gateway["Connection Layer"]
        WS1[WebSocket Server 1]
        WS2[WebSocket Server 2]
        WS3[WebSocket Server N]
    end

    subgraph Services
        MS[Message Service]
        GS[Group Service]
        PS[Presence Service]
        NS[Notification Service]
    end

    subgraph Data
        MQ[Kafka - Message Queue]
        DB[(Cassandra - Messages)]
        RD[(Redis - Sessions, Presence)]
        S3[(S3 - Media Files)]
    end

    C1 -->|WebSocket| WS1
    C2 -->|WebSocket| WS2
    C3 -->|WebSocket| WS3
    WS1 --> MS
    MS --> MQ
    MQ --> DB
    MS --> RD
    MS --> NS
    GS --> MQ
```

---

## 3. Message Delivery — The Core Flow

```mermaid
sequenceDiagram
    participant A as User A
    participant WSA as WS Server (A's)
    participant MS as Message Service
    participant Redis as Redis
    participant WSB as WS Server (B's)
    participant B as User B
    participant Kafka as Kafka
    participant DB as Cassandra

    A->>WSA: Send message to B
    WSA->>MS: Route message
    MS->>Kafka: Persist to queue
    MS->>Redis: Which WS server is B connected to?
    Redis->>MS: B is on WS Server 2

    alt B is online
        MS->>WSB: Forward message
        WSB->>B: Deliver message
        B->>WSB: ACK (delivered ✓✓)
        WSB->>MS: Delivery confirmed
        MS->>WSA: Delivery receipt ✓✓
        WSA->>A: Show ✓✓
    else B is offline
        MS->>Kafka: Store in B's offline queue
        MS->>NS: Send push notification
        NS->>B: Push: "New message from A"
        Note over B: When B comes online...
        B->>WSB: Connect + fetch pending messages
        WSB->>Kafka: Get B's offline queue
        Kafka->>WSB: [Message 1, Message 2, ...]
        WSB->>B: Deliver all pending messages
    end

    Kafka->>DB: Async persist for history
```

<div class="callout-info">

**Key insight**: Messages are stored in Kafka first (durable queue), then asynchronously written to Cassandra (long-term storage). This ensures no message is lost even if Cassandra is temporarily down. The WebSocket connection is for real-time delivery; Kafka is the reliability backbone.

</div>

---

## 4. Connection Management — Session Registry

With 500M concurrent connections, you need to know which WebSocket server each user is connected to:

```java
// Redis session registry
// When user connects:
redis.set("session:userB", "ws-server-2", Duration.ofMinutes(30));

// When sending a message to userB:
String wsServer = redis.get("session:userB");
if (wsServer != null) {
    // Route message to that specific WS server
    routeToServer(wsServer, message);
} else {
    // User is offline — queue message + send push notification
    queueOfflineMessage(message);
    sendPushNotification(message);
}
```

<div class="callout-scenario">

**Scenario**: User B has WhatsApp open on both phone and web. Both devices have active WebSocket connections to different servers. **Decision**: Store multiple sessions per user in Redis: `session:userB → [ws-server-2, ws-server-7]`. Deliver the message to ALL active sessions. The first device to send a "read" receipt marks it as read across all devices.

</div>

---

## 5. Group Messaging

```mermaid
sequenceDiagram
    participant A as User A
    participant GS as Group Service
    participant MS as Message Service
    participant B as User B
    participant C as User C
    participant D as User D (offline)

    A->>GS: Send to Group (100 members)
    GS->>GS: Get member list from cache
    GS->>MS: Fan-out to 99 members
    MS->>B: Deliver (online) ✅
    MS->>C: Deliver (online) ✅
    MS->>D: Queue + Push notification (offline)
```

For a group with 1000 members, sending one message = 999 deliveries. This is write amplification.

<div class="callout-tip">

**Applying this** — For small groups (< 100 members), fan-out immediately. For large groups (100+), use a pull model — store the message once with the group ID. When members open the group, they pull recent messages. This avoids 999 individual deliveries. WhatsApp limits groups to 1024 members partly for this reason.

</div>

---

## 6. End-to-End Encryption

```mermaid
sequenceDiagram
    participant A as User A
    participant Server
    participant B as User B

    Note over A,B: Key Exchange (one-time setup)
    A->>Server: A's public key
    Server->>B: A's public key
    B->>Server: B's public key
    Server->>A: B's public key

    Note over A,B: Sending a message
    A->>A: Encrypt with B's public key
    A->>Server: Encrypted message (server can't read)
    Server->>B: Forward encrypted message
    B->>B: Decrypt with B's private key
```

<div class="callout-info">

**Key insight**: With E2E encryption, the server is just a relay — it stores and forwards encrypted blobs. It cannot read message content. This means server-side search is impossible. WhatsApp search works only on the device (local database). This is a deliberate trade-off: privacy over server-side features.

</div>

---

## 7. Message Ordering

Messages must appear in the order they were sent. But in a distributed system, clocks aren't synchronized.

**Solution**: Use **Lamport timestamps** or **server-assigned sequence numbers** per conversation.

```java
// Server assigns monotonically increasing sequence per conversation
public long getNextSequence(String conversationId) {
    return redis.incr("seq:" + conversationId);
}
```

Each message gets a sequence number within its conversation. Clients display messages sorted by sequence number, not by local clock time.

---

## 8. Database Choice — Why Cassandra?

| Requirement | Why Cassandra |
|-------------|--------------|
| Write-heavy (100B messages/day) | Cassandra excels at writes |
| Time-series data | Messages are naturally time-ordered |
| Partition by conversation | `PRIMARY KEY (conversation_id, message_id)` |
| No complex joins needed | Messages are always queried by conversation |
| Global distribution | Multi-datacenter replication built-in |

```sql
CREATE TABLE messages (
    conversation_id UUID,
    message_id TIMEUUID,
    sender_id UUID,
    content BLOB,  -- encrypted
    content_type TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY (conversation_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: Users on flaky mobile networks see messages sent twice, and sometimes a reply appears before the message it answers. **Decision**: Clients generate a **client message ID** (UUID) for every send and retry with the same ID; the server deduplicates on `(conversationId, clientMessageId)`. Ordering comes from a **per-conversation sequence number** assigned by the server (not device timestamps, which drift), and clients sort by it and fill gaps by fetching missing sequence ranges after reconnecting.

</div>

<div class="callout-scenario">

**Scenario**: After a deploy, every chat gateway server restarts at once and 2 million WebSocket clients reconnect within seconds, overwhelming authentication and the session registry. **Decision**: A **reconnect storm**. Roll out gateway updates gradually with connection draining, have clients reconnect with exponential backoff plus random jitter, make reconnection cheap (resumable session tokens, validated locally instead of a full login), and rate-limit connection establishment per server. Treat connection count and connect rate as first-class capacity metrics.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why WebSockets for chat rather than plain HTTP polling?

<details>
<summary>Show answer</summary>

WebSockets keep a persistent, bidirectional connection, so the server can push messages instantly with little overhead per message. Polling either delays messages (long intervals) or wastes resources (frequent requests, mostly empty). Long polling and SSE are fallbacks; mobile apps also use push notifications (FCM/APNs) when the app isn't connected.

</details>

**L2.** What are "sent", "delivered", and "read" receipts, and who generates each?

<details>
<summary>Show answer</summary>

**Sent** (✓): the server durably stored the message (server acknowledgment to the sender). **Delivered** (✓✓): the recipient's device received it (the device acks to the server, which notifies the sender). **Read** (blue ✓✓): the recipient opened the conversation (the client sends a read marker, usually "read up to sequence N", not per message).

</details>

**L3.** Why is a wide-column store like Cassandra a common fit for chat history?

<details>
<summary>Show answer</summary>

Chat is write-heavy and read by conversation in time order. Partitioning by `conversation_id` (often bucketed by time) with clustering by message sequence makes "latest N messages" and "messages before X" efficient sequential reads, and the store scales writes horizontally. (Discord famously used Cassandra, later moving to ScyllaDB for the same data model.)

</details>

### 🟡 Medium — Apply it

**M1.** Design the message send path end to end, including offline recipients.

<details>
<summary>Show answer</summary>

Client sends `{conversationId, clientMessageId, body}` over its WebSocket → the gateway forwards to the chat service → dedupe on client ID, assign the next per-conversation sequence number, persist the message (the durability point) → ack "sent" to the sender → look up each recipient's active connections in the session registry (Redis: userId → gateway servers) → push via those gateways (pub/sub or direct RPC) → if a recipient has no live connection, send a push notification (FCM/APNs) and the message is fetched on the next sync → recipients' devices ack delivery → sender gets "delivered". Reconnecting clients sync by requesting messages after their last known sequence number per conversation.

</details>

**M2.** Design the schema for messages with efficient pagination.

<details>
<summary>Show answer</summary>

```sql
-- Cassandra-style table (CQL)
CREATE TABLE messages (
  conversation_id uuid,
  bucket          int,          -- e.g., month number, keeps partitions bounded
  seq             bigint,       -- per-conversation sequence
  sender_id       uuid,
  client_msg_id   uuid,
  body            text,
  created_at      timestamp,
  PRIMARY KEY ((conversation_id, bucket), seq)
) WITH CLUSTERING ORDER BY (seq DESC);
```

Pagination uses keyset: "messages where seq < :lastSeenSeq limit 50" (never OFFSET), walking to older buckets when a bucket is exhausted. Dedupe of client IDs happens in the write path (a separate table or cache keyed by conversation + client ID with a TTL).

</details>

**M3.** How would you implement typing indicators and online presence without overloading the system?

<details>
<summary>Show answer</summary>

They're ephemeral, lossy signals: never persisted in the message store. Typing: clients send throttled "typing" events (at most one every few seconds), forwarded only to currently connected participants; recipients show "typing…" with a short expiry. Presence: heartbeats update a Redis key with a TTL (online while it exists); broadcast presence changes only to users who are viewing that contact/conversation, and debounce flapping connections. For large groups, aggregate or skip presence entirely.

</details>

### 🔴 High — Think like a senior

**H1.** Support groups of up to 200K members (broadcast channels). What changes from 1:1 and small-group chat?

<details>
<summary>Show answer</summary>

Fan-out on write to 200K inboxes per message is too expensive; switch to **fan-out on read** for large groups: store the message once per channel; members read the channel's timeline when they open it. Real-time delivery only to members currently connected and viewing (subscribe to a channel topic on the gateways they're connected to), with push notifications sampled/batched or limited to mentions and admins. Read receipts become aggregate counts rather than per-user; permissions (who can post) are restricted; rate limits per channel. Use the hybrid threshold: small groups fan out on write, large channels fan out on read.

</details>

**H2.** A regulator requires message retention for 7 years for business accounts, while consumer chats must be end-to-end encrypted. Reconcile these.

<details>
<summary>Show answer</summary>

They're different products with different architectures: consumer chats use end-to-end encryption (Signal protocol) where the server stores only ciphertext it can't read — no server-side retention of plaintext is possible, and that's the promise to users. Business accounts (compliance-mode) either don't use E2EE or use a design where the business's own archiving endpoint is an explicit participant with disclosed keys (the organization controls the keys and archives messages to compliant storage with retention policies, legal hold, and eDiscovery). Make the mode explicit to users, separate storage and key management per mode, and involve legal review — never add hidden server-side access to an E2EE product.

</details>

## 🛠️ Mini Project — Real-Time Chat with Delivery Guarantees

**Goal**: A working chat backend that survives flaky networks. 1 week of evenings.

**Build**

1. Spring Boot WebSocket (STOMP or raw) gateway, 2+ instances behind a load balancer; Redis for the session registry and cross-instance pub/sub; Postgres (or Cassandra/ScyllaDB in Docker) for messages.
2. Send path with client message IDs (dedupe), per-conversation sequence numbers (e.g., a Postgres counter row per conversation updated atomically), sent/delivered/read receipts.
3. Offline handling: messages stored and synced on reconnect via "give me messages after seq N"; a fake push-notification sender for offline users.
4. Typing indicators and presence with Redis TTLs (never persisted).
5. A simple web client (plain JS) that retries sends and reconnects with exponential backoff + jitter.
6. Chaos tests: kill a gateway mid-conversation, drop 20% of client messages at the network level (a proxy like Toxiproxy), restart all gateways at once.

**Acceptance criteria**: no duplicate or missing messages after chaos tests (verify by comparing client-side and server-side sequences), and a README with the message state diagram.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you ensure no message is ever lost?"**

Multiple layers of reliability: (1) **Client-side**: Message is persisted to local SQLite before sending. Retry with exponential backoff if no server ACK within 5 seconds. (2) **Server-side**: Message is written to Kafka (durable, replicated) before attempting delivery. Even if the WebSocket server crashes, the message is in Kafka. (3) **Delivery ACK**: The recipient's device sends an ACK back to the server. Only after receiving the ACK does the server mark the message as delivered. If no ACK within 30 seconds, the server retries delivery. (4) **Offline queue**: If the recipient is offline, messages accumulate in Kafka. When they reconnect, all pending messages are delivered in order. The message lifecycle: Sent → Queued (Kafka) → Delivered (ACK) → Read (read receipt).

**Follow-up trap**: "What if Kafka itself goes down?" → Kafka is deployed with replication factor 3 across different AZs. For Kafka to lose a message, 3 brokers in different data centers must fail simultaneously — practically impossible. If the Kafka cluster is unreachable, the WebSocket server buffers messages in memory (bounded queue) and retries. If the buffer fills up, the client gets a "message not sent" error and retries.

</div>

<div class="callout-interview">

**Q: "How does the read receipt (blue ticks) work?"**

When User B reads a message, their client sends a "read" event to the server: `{messageId: X, readAt: timestamp}`. The server forwards this to User A's WebSocket connection. User A's client updates the UI from ✓✓ to blue. For group chats, the server tracks read receipts per member. The message shows blue ticks only when ALL members have read it (WhatsApp) or shows "Seen by 15 of 20" (Messenger). Read receipts are fire-and-forget — if the delivery fails, it's not critical. They're sent as lightweight events, not stored permanently.

</div>

<div class="callout-interview">

**Q: "How do you handle 500 million concurrent WebSocket connections?"**

No single server can handle this. Distribute across thousands of WebSocket servers. Each server handles ~50K-100K connections. Use a session registry (Redis) to map user → server. When a message needs to be delivered, the message service looks up the target user's server and routes the message there. For the WebSocket servers themselves, use epoll/kqueue for efficient connection handling (not one thread per connection). Each server uses ~10GB RAM for 100K connections. 500M connections ÷ 100K per server = 5,000 WebSocket servers. Load balance new connections using consistent hashing on user ID.

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| WebSocket | Persistent bidirectional connection for real-time messaging |
| Session Registry | Redis map of user → WebSocket server |
| Offline Queue | Kafka stores messages for offline users |
| E2E Encryption | Only sender and receiver can read messages |
| Read Receipt | Client sends "read" event, server forwards to sender |
| Fan-out | Deliver group message to all members individually |
| Sequence Number | Server-assigned ordering per conversation |
| Push Notification | FCM/APNs alert for offline users |

---

> **A chat system's job is simple: get this message from A to B, no matter what. The complexity is in the "no matter what" — offline, bad network, multiple devices, encrypted, at scale, in order, without losing a single message.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Extra case study — delivery guarantees and duplicate handling are exactly what ShopNorth's idempotent event consumers solve.

**Continue the story:** [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
