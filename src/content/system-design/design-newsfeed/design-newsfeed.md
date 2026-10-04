# Design Facebook Newsfeed — The Newspaper Editor Analogy

## The Newspaper Editor Analogy

Imagine a newspaper editor who creates a personalized edition for each of 3 billion readers. Each edition contains stories from the reader's friends, pages they follow, and groups they're in — ranked by relevance, not just time. Some stories are text, some photos, some videos. And the edition updates in real-time as new stories come in. That's Facebook's Newsfeed.

---

## 1. Requirements

### Functional
- Generate personalized feed from friends' posts, pages, groups
- Support text, image, video, link posts
- Real-time updates (new posts appear without refresh)
- Like, comment, share interactions
- Ranking by relevance (not just chronological)

### Non-Functional
- **Scale**: 3B users, 500K posts/second
- **Latency**: Feed loads in < 500ms
- **Freshness**: New posts appear within seconds
- **Availability**: 99.99%

---

## 2. The Core Problem — Fanout

When User A creates a post, how do their 500 friends see it?

### Fanout-on-Write (Push Model)

```mermaid
sequenceDiagram
    participant UserA as User A (posts)
    participant FO as Fanout Service
    participant Cache1 as Friend 1's Feed Cache
    participant Cache2 as Friend 2's Feed Cache
    participant Cache500 as Friend 500's Feed Cache

    UserA->>FO: New post created
    FO->>Cache1: Push post to feed
    FO->>Cache2: Push post to feed
    FO->>Cache500: Push post to feed
    Note over FO: 500 writes for 1 post
```

### Fanout-on-Read (Pull Model)

```mermaid
sequenceDiagram
    participant User as User B (reads feed)
    participant FS as Feed Service
    participant DB as Posts DB

    User->>FS: GET /feed
    FS->>DB: Get User B's friends list
    FS->>DB: Get latest posts from each friend
    FS->>FS: Merge + Rank
    FS->>User: Personalized feed
    Note over FS: Expensive at read time<br/>but no pre-computation
```

### Hybrid Approach (What Facebook Actually Does)

```mermaid
flowchart TB
    A[New Post Created] --> B{Author has > 10K followers?}
    B -->|No: Regular user| C[Fanout-on-Write<br/>Push to all friends' caches]
    B -->|Yes: Celebrity/Page| D[Fanout-on-Read<br/>Fetch at read time]
```

<div class="callout-scenario">

**Scenario**: A celebrity with 50 million followers posts a photo. Fanout-on-write would mean 50 million cache writes for ONE post. **Decision**: Use fanout-on-read for celebrities. When a user opens their feed, the service fetches celebrity posts on-demand and merges with the pre-computed friend posts. This is the "celebrity problem" — the most famous interview question about newsfeed design.

</div>

---

## 3. Feed Ranking — Not Just Chronological

```mermaid
flowchart LR
    A[Candidate Posts<br/>~1000 from friends] --> B[Feature Extraction]
    B --> C[ML Ranking Model]
    C --> D[Ranked Feed<br/>Top 50 shown]

    B --> B1[Post age]
    B --> B2[Author relationship strength]
    B --> B3[Post type - video > text]
    B --> B4[Engagement - likes, comments]
    B --> B5[User's past interaction pattern]
```

**Ranking signals:**
- How often you interact with this friend
- Post type (video > photo > link > text in engagement)
- How many others engaged with this post
- Recency (newer posts score higher)
- Content type preference (you watch more videos → show more videos)

<div class="callout-interview">

**Q: "How does Facebook rank the newsfeed?"**

It's a multi-stage pipeline. Stage 1: Candidate generation — collect ~1000 recent posts from friends, pages, groups. Stage 2: Feature extraction — compute 1000+ features per post (author affinity, post type, engagement velocity, recency). Stage 3: ML ranking — a neural network scores each post. Stage 4: Policy filters — remove duplicates, enforce diversity (don't show 5 posts from same person), apply content policies. The final feed shows ~50 posts ranked by predicted engagement.

</div>

---

## 4. Architecture

```mermaid
graph TB
    subgraph Write Path
        UP[User Posts] --> PS[Post Service]
        PS --> DB[(Posts DB - MySQL)]
        PS --> KF[Kafka]
        KF --> FO[Fanout Service]
        FO --> FC[(Feed Cache - Redis)]
    end

    subgraph Read Path
        UR[User Reads Feed] --> FS[Feed Service]
        FS --> FC
        FS --> RK[Ranking Service]
        RK --> ML[ML Model]
        FS --> UR2[Personalized Feed]
    end
```

**Storage:**
| Data | Store | Why |
|------|-------|-----|
| Posts | MySQL (sharded by user_id) | Relational, strong consistency |
| Feed cache | Redis (sorted set per user) | Fast reads, sorted by score |
| Social graph | TAO (Facebook's graph DB) | Friend relationships, efficient traversal |
| Media | S3 + CDN | Images, videos served from edge |
| Engagement counts | Redis + async DB write | Real-time like/comment counts |

---

## 5. Real-Time Updates — Long Polling vs WebSocket

```mermaid
sequenceDiagram
    participant Client
    participant Server

    Note over Client,Server: Long Polling
    Client->>Server: Any new posts? (hangs for 30s)
    Server->>Client: Yes! 3 new posts (after 12s)
    Client->>Server: Any new posts? (hangs again)

    Note over Client,Server: WebSocket
    Client->>Server: Open persistent connection
    Server->>Client: New post from Alice!
    Server->>Client: New post from Bob!
    Server->>Client: Alice's post got 50 likes!
```

<div class="callout-tip">

**Applying this** — Facebook uses long polling for the newsfeed (not WebSocket). Why? With 2 billion concurrent users, maintaining 2 billion WebSocket connections is expensive. Long polling is stateless — any server can handle the response. For chat (Messenger), they DO use WebSocket because real-time latency matters more there.

</div>

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A cricket celebrity with 30 million followers posts during a match. The fan-out-on-write workers must insert the post into 30M timelines; the queue backs up for 40 minutes, and ordinary users' posts are delayed too. **Decision**: Use the **hybrid** model: fan-out on write for normal accounts (fast reads), but for accounts above a follower threshold, don't fan out — merge their recent posts into followers' feeds **at read time**. Also isolate fan-out work into priority lanes so celebrity traffic can't starve everyone else.

</div>

<div class="callout-scenario">

**Scenario**: A user deletes a post they regret, but it keeps appearing in followers' feeds for hours, because precomputed timelines still contain the post ID and caches hold rendered feed pages. **Decision**: Feeds should store **post IDs**, hydrated from the post store at read time, where deleted/hidden posts are filtered out immediately. Also publish a deletion event that removes the ID from timelines asynchronously and purges cached pages. Privacy-related removals (deletions, blocks) must take effect on read, not eventually.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Fan-out on write vs fan-out on read — one strength and one weakness of each.

<details>
<summary>Show answer</summary>

**On write (push)**: fast feed reads (precomputed timeline); expensive for users with many followers and wasteful for inactive followers. **On read (pull)**: cheap writes, always fresh; slow reads because every feed load must gather and merge posts from all followed accounts.

</details>

**L2.** Why paginate a feed with a cursor instead of page numbers?

<details>
<summary>Show answer</summary>

New posts arrive constantly; with `page=2` (offset), items shift between requests, causing duplicates or skipped posts, and deep offsets are slow. A cursor (e.g., "items ranked below this score/ID") gives stable, efficient pagination.

</details>

**L3.** What should a timeline store — full post objects or post IDs? Why?

<details>
<summary>Show answer</summary>

**Post IDs** (plus minimal ranking metadata). Posts are hydrated from the post store/cache at read time, so edits, deletions, and privacy changes apply immediately, and memory per timeline stays small (many timelines contain the same post).

</details>

### 🟡 Medium — Apply it

**M1.** Estimate the fan-out write load: 50M daily active users, each posts 0.5 times a day on average, average 300 followers, fan-out on write for everyone.

<details>
<summary>Show answer</summary>

Posts/day = 25M → timeline inserts = 25M × 300 = **7.5B inserts/day** ≈ 87K/second on average, several times that at peak. Feasible with Redis/Cassandra timelines and many workers, but the average hides the long tail: a few accounts with millions of followers dominate — which is why the hybrid model exists. Also, inserting into inactive users' timelines is wasted work (skip users inactive for 30+ days and build their feed on demand when they return).

</details>

**M2.** Design the timeline storage in Redis with a cap and ranking.

<details>
<summary>Show answer</summary>

One sorted set per user: `feed:{userId}` with member = post ID, score = ranking score (or timestamp for chronological). On fan-out: `ZADD feed:{u} score postId`, then `ZREMRANGEBYRANK feed:{u} 0 -801` to keep only the newest 800 entries. Reads: `ZREVRANGEBYSCORE` with a cursor (last score + post ID for ties) and a limit. Expire feeds of inactive users; rebuild from the follow graph + posts on demand. Persist durable data (posts, follows) elsewhere — timelines are a rebuildable cache.

</details>

**M3.** Move from chronological to ranked feeds. What pipeline do you need?

<details>
<summary>Show answer</summary>

Candidate generation (recent posts from followed accounts via timelines, plus celebrity posts merged at read time, plus maybe recommended content), feature fetching (author affinity, post engagement so far, content type, freshness, user preferences), a ranking model predicting engagement (with negative signals like hides), and re-ranking for diversity, freshness, and policies. Log impressions and engagement for training; evaluate with A/B tests on time spent and retention, not just clicks. Keep a latency budget (e.g., 200 ms) with fallbacks to chronological order when ranking is slow (see `design-recommendation`).

</details>

### 🔴 High — Think like a senior

**H1.** Design the feed read path for p99 < 200 ms at 500K feed requests per second.

<details>
<summary>Show answer</summary>

Read precomputed timeline IDs from Redis (sharded by user), merge with recent posts from followed high-follower accounts (cached per celebrity: their last N post IDs, shared across millions of readers), rank the top ~500 candidates with a fast model, hydrate the top 20 posts via a multi-get from a post cache (and author/profile caches), filter deleted/blocked content, and return with a cursor. Everything read from caches in batches, with parallel fetches and strict per-call timeouts; degrade gracefully (chronological order if ranking times out). Pre-warm caches for active users; autoscale feed and ranking services; measure per-stage latency.

</details>

**H2.** A user blocks another user. Enumerate everything the system must update, and in what time frame.

<details>
<summary>Show answer</summary>

Immediately (read-time enforcement): feeds and comment/post rendering filter content from blocked users using a block list checked at hydration; profile visibility and DMs are denied; search excludes them. Asynchronously: remove the blocked user's post IDs from the blocker's timeline (and vice versa, per product rules), remove the follow relationships in both directions, purge cached feed pages, update recommendations ("people you may know") and notification eligibility. Block checks must be in the read path because async cleanup can lag; privacy and safety actions can't wait for eventual consistency.

</details>

## 🛠️ Mini Project — Hybrid-Fan-Out News Feed

**Goal**: Implement and measure the hybrid model. 1 week of evenings.

**Build**

1. Spring Boot services: `post-service` (Postgres), `follow-service` (Postgres, follower lists), `feed-service` (Redis sorted sets), with Kafka between them.
2. Generate a social graph: 100K users, power-law follower counts (a few users with 50K+ followers).
3. Fan-out worker: on `PostCreated`, if the author has fewer than 10K followers, push to followers' timelines (capped at 500); otherwise mark as a "celebrity" post.
4. Feed read: timeline IDs + recent celebrity posts from followed celebrities, merged and ordered by time (then a simple ranking: freshness + author affinity), hydrated via multi-get, cursor pagination.
5. Deletion and block handling enforced at read time.
6. Measure: fan-out lag for normal vs celebrity posts, feed p99 latency, Redis memory; compare with pure fan-out-on-write.

**Acceptance criteria**: a celebrity post appears in followers' feeds within 1 second without a fan-out backlog; deleted posts never appear after deletion; README with measurements and the chosen threshold's rationale.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you handle the celebrity problem in newsfeed?"**

The celebrity problem: a user with 50M followers posts → fanout-on-write means 50M cache writes. Solution: hybrid fanout. For regular users (< 10K friends), use fanout-on-write — push posts to friends' feed caches. For celebrities/pages (> 10K followers), use fanout-on-read — don't pre-compute. When a user opens their feed, the service merges: (1) pre-computed friend posts from cache + (2) on-demand celebrity/page posts fetched at read time. The merge is fast because celebrity posts are few (user follows maybe 50 pages) vs friend posts (hundreds). This reduces write amplification from billions to millions.

**Follow-up trap**: "What about a celebrity who is also your friend?" → Treat them as celebrity for fanout purposes. The friendship doesn't change the scaling problem. Their posts are fetched on-read regardless.

</div>

<div class="callout-interview">

**Q: "How would you shard the posts database?"**

Shard by `user_id` (author). All posts by User A are on the same shard. This makes writes fast (single shard) and "get all posts by user" queries efficient. For the newsfeed, the feed service queries multiple shards (one per friend) in parallel and merges results. The fan-out read is parallelized — 500 friends across maybe 50 shards, each query takes 5ms, total ~10ms with parallel execution. Alternative: shard by `post_id` — distributes writes evenly but makes "get all posts by user" expensive (scatter-gather across all shards). For social networks, shard by user_id is standard.

</div>

<div class="callout-interview">

**Q: "How do you handle a post going viral — millions of likes in minutes?"**

Don't update the database on every like. Use a write-behind pattern: (1) Increment a Redis counter atomically (`INCR post:123:likes`). (2) Periodically flush Redis counts to the database (every 5-10 seconds). (3) The feed shows the Redis count (real-time) while the database has a slightly stale count (acceptable). For the notification "Your post got 1M likes", batch notifications — don't send 1M individual notifications. Show "1M people liked your post" as a single aggregated notification. For the post author's feed, cache the viral post's engagement metrics separately to avoid hot-key issues in Redis (use local caching on feed servers).

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| Fanout-on-Write | Push post to all friends' caches at write time |
| Fanout-on-Read | Fetch friends' posts at read time |
| Celebrity Problem | High-follower users cause write amplification |
| Feed Ranking | ML model scores posts by predicted engagement |
| Social Graph | Data structure storing friend/follow relationships |
| Write-Behind | Buffer writes in Redis, flush to DB periodically |

---

> **The newsfeed isn't just a list of posts — it's a personalized newspaper generated in real-time for 3 billion people. The algorithm decides what you see, and what you see shapes what you think.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Extra case study — read-heavy, cache-first design, the same shape as ShopNorth's browse traffic (85% of all requests).

**Continue the story:** [Chapter 2 · System Design (HLD)](/tutorials/journey-02-system-design) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
