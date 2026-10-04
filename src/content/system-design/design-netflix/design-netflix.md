# Design Netflix — The Movie Theater Chain Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Design — architecture** · Extra case study for [Chapter 2 · System Design (HLD)](/tutorials/journey-02-system-design)

</div>
<!-- sdlc-stage:end -->

## The Movie Theater Chain Analogy

Imagine a movie theater chain with 200 million members. Every member wants to watch a different movie, at any time, on any device, with zero buffering. You can't have one giant theater — you need thousands of screens worldwide, each pre-loaded with popular movies, adapting quality based on the viewer's seat (device/bandwidth). That's Netflix — a global video streaming platform.

---

## 1. Requirements

### Functional
- Upload and transcode videos (content team)
- Stream videos on-demand with adaptive quality
- Search and browse content catalog
- Personalized recommendations
- User profiles, watchlist, continue watching
- Likes, reviews, ratings

### Non-Functional
- **Scale**: 200M+ subscribers, 15M+ concurrent streams
- **Availability**: 99.99% — downtime = millions in lost revenue
- **Latency**: Video should start playing in < 2 seconds
- **Global**: Available in 190+ countries
- **Adaptive**: Adjust quality based on bandwidth in real-time

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        TV[Smart TV]
        MB[Mobile]
        WB[Web Browser]
    end

    subgraph CDN["Open Connect CDN"]
        OCA1[OCA Server - Mumbai]
        OCA2[OCA Server - London]
        OCA3[OCA Server - New York]
    end

    subgraph Backend["Netflix Backend (AWS)"]
        AG[API Gateway - Zuul]
        CS[Content Service]
        US[User Service]
        RS[Recommendation Service]
        SS[Search Service]
        PS[Playback Service]
    end

    subgraph Pipeline["Content Pipeline"]
        UP[Upload]
        TC[Transcoding]
        QC[Quality Check]
        DIST[Distribution to CDN]
    end

    subgraph Data
        CA[(Cassandra - User Data)]
        ES[(Elasticsearch - Search)]
        S3[(S3 - Master Videos)]
        RD[(Redis - Sessions)]
    end

    TV --> OCA1
    MB --> OCA2
    WB --> OCA3
    TV --> AG
    AG --> CS
    AG --> US
    AG --> RS
    AG --> SS
    AG --> PS
    UP --> TC --> QC --> DIST
    DIST --> OCA1
    DIST --> OCA2
    DIST --> OCA3
```

---

## 3. Video Transcoding — The Most Expensive Part

A single movie uploaded in 4K must be converted into **hundreds of versions**:

```mermaid
flowchart LR
    A[Original 4K Video<br/>50 GB] --> B[Transcoding Pipeline]
    B --> C["4K HDR - 16 Mbps"]
    B --> D["1080p - 5 Mbps"]
    B --> E["720p - 3 Mbps"]
    B --> F["480p - 1.5 Mbps"]
    B --> G["360p - 0.5 Mbps"]
    B --> H["Audio: English, Hindi,<br/>Spanish, French..."]
```

**Why so many versions?**
- Different devices have different screen sizes
- Different networks have different bandwidth
- Different regions need different audio/subtitle tracks
- A single title can have **1,200+ encoded files**

<div class="callout-info">

**Key insight**: Netflix spends ~$1 billion/year on AWS, and a huge chunk goes to transcoding. They use a technique called **per-title encoding** — each title gets its own encoding ladder optimized for its content. An animated movie compresses better than an action movie, so it gets lower bitrates at the same quality.

</div>

### Chunked Encoding

Videos are split into small chunks (2-10 seconds each):

```
movie.mp4 → chunk_001.mp4 (0:00-0:04)
           → chunk_002.mp4 (0:04-0:08)
           → chunk_003.mp4 (0:08-0:12)
           → ... (each chunk in multiple qualities)
```

**Why chunks?** Adaptive Bitrate Streaming (ABR) — the player can switch quality mid-stream. If bandwidth drops, the next chunk loads in 480p instead of 1080p. Seamless to the user.

---

## 4. Adaptive Bitrate Streaming (ABR)

```mermaid
sequenceDiagram
    participant Player
    participant CDN

    Player->>CDN: Request manifest.m3u8
    CDN->>Player: Manifest (list of chunks + quality levels)

    Player->>CDN: GET chunk_001_1080p.mp4
    CDN->>Player: Chunk 1 (1080p, fast download)
    Note over Player: Bandwidth: 8 Mbps ✅

    Player->>CDN: GET chunk_002_1080p.mp4
    CDN->>Player: Chunk 2 (1080p, slow download)
    Note over Player: Bandwidth dropped to 2 Mbps ⚠️

    Player->>CDN: GET chunk_003_480p.mp4
    CDN->>Player: Chunk 3 (480p, fast download)
    Note over Player: Switched to lower quality automatically
```

<div class="callout-scenario">

**Scenario**: User is watching on a train. Network fluctuates between 4G and 2G. **Decision**: ABR handles this automatically. The player's buffer algorithm monitors download speed and switches quality per-chunk. The user sees a brief quality drop but never experiences buffering. Netflix's ABR algorithm also considers device screen size — no point streaming 4K to a phone.

</div>

---

## 5. Netflix's CDN — Open Connect

Netflix doesn't use CloudFront or Akamai for video. They built their own CDN called **Open Connect**:

```mermaid
graph TB
    subgraph ISP["ISP Data Center (Jio, Airtel, etc.)"]
        OCA[Open Connect Appliance<br/>100TB+ storage<br/>Pre-loaded with popular content]
    end

    subgraph Netflix["Netflix Backend"]
        CP[Content Pipeline]
        ST[Steering Service]
    end

    subgraph User
        U[User Device]
    end

    CP -->|Push popular content overnight| OCA
    U -->|"What server should I use?"| ST
    ST -->|"Use OCA at your ISP"| U
    U -->|Stream video| OCA
```

**Why build their own CDN?**
- Netflix is 15% of global internet traffic
- Placing servers INSIDE ISP data centers = zero transit costs
- Content is pre-positioned based on popularity predictions
- A single OCA box can serve 100 Gbps of video

<div class="callout-interview">

**Q: "How does Netflix handle 15 million concurrent streams?"**

They don't stream from AWS. Video comes from Open Connect Appliances placed inside ISP data centers worldwide. AWS handles only the control plane (user auth, recommendations, search). The data plane (actual video bytes) is served from OCAs. This separation is key — the most bandwidth-intensive part is handled at the edge, closest to users.

</div>

---

## 6. Recommendation Engine

```mermaid
flowchart TB
    A[User Data] --> B[Collaborative Filtering<br/>Users who watched X also watched Y]
    A --> C[Content-Based<br/>Similar genre, actors, director]
    A --> D[Trending<br/>Popular in your region right now]
    B --> E[Ranking Model]
    C --> E
    D --> E
    E --> F[Personalized Homepage]
```

Netflix's recommendation system drives **80% of content watched**. It's not just "you might like this" — it even personalizes the **thumbnail image** shown for each title based on your viewing history.

<div class="callout-tip">

**Applying this** — In system design interviews, mention that recommendations are computed offline (batch processing) and cached. Real-time personalization happens at the API layer by combining pre-computed scores with real-time signals (time of day, device, recent watches). Don't try to compute recommendations in real-time for 200M users — that's impossibly expensive.

</div>

---

## 7. Database Choices

| Data | Database | Why |
|------|----------|-----|
| User profiles, viewing history | Cassandra | Write-heavy, globally distributed, no single point of failure |
| Search index | Elasticsearch | Full-text search, faceted filtering |
| Session data | Redis | Ultra-fast reads, TTL-based expiry |
| Video metadata | MySQL/PostgreSQL | Relational, complex queries for content catalog |
| Recommendations | Cassandra + S3 | Pre-computed, read-heavy |
| Analytics | Spark + S3 | Batch processing of viewing data |

---

<!-- practice-pack -->

## 🏢 More Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A streaming service releases the finale of its biggest series at 12:30 PM. Within minutes, playback-start failures spike: the CDN is fine, but the **playback API** (license check, entitlement, manifest generation) is overwhelmed because every client also retries aggressively. **Decision**: The control plane needs the same scaling care as video delivery. Pre-scale for known premieres, cache manifests and entitlement results, issue DRM licenses with sensible durations, make clients retry with jittered exponential backoff, and use load shedding that prioritizes playback starts over less critical calls (recommendation rows, artwork personalization).

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why is each title transcoded into many files instead of one?

<details>
<summary>Show answer</summary>

Devices and networks differ: a phone on 4G needs a low-bitrate 480p stream, a 4K TV on fibre needs 15+ Mbps HEVC/AV1. Each title is encoded into a ladder of resolutions/bitrates and codecs, split into short segments (2-6 seconds), so the player can switch quality between segments (adaptive bitrate) and each device gets a codec it supports.

</details>

**L2.** What's in an HLS/DASH manifest?

<details>
<summary>Show answer</summary>

A list of available renditions (bitrate, resolution, codec) and, for each, the sequence of segment URLs (or a template to build them) with durations — plus audio tracks, subtitles, and DRM information. The player downloads the manifest first, then fetches segments, choosing the rendition based on measured bandwidth and buffer level.

</details>

**L3.** Why does Netflix put caching servers *inside* ISPs?

<details>
<summary>Show answer</summary>

Video is enormous and highly repetitive (the same popular titles watched by many). Caches inside ISP networks (Open Connect appliances) serve most bytes from a few network hops away: lower latency and rebuffering for users, much less transit traffic for both ISP and Netflix. Popular content is pre-positioned during off-peak hours based on predicted demand.

</details>

### 🟡 Medium — Apply it

**M1.** Design the transcoding pipeline for 1,000 new hours of content per day.

<details>
<summary>Show answer</summary>

Upload the mezzanine (high-quality master) to object storage → a workflow orchestrator splits it into chunks (e.g., per scene or per few minutes) → many parallel workers encode each chunk × each rendition × codec → validation (quality checks like VMAF, sync, artefacts) → package into HLS/DASH segments with DRM encryption → publish manifests and push to CDN origin. The work is embarrassingly parallel; use spot/preemptible instances with retries per chunk, and per-title (or per-shot) encoding to choose bitrates based on content complexity.

</details>

**M2.** Store "continue watching" positions for 250M members. What datastore and write pattern?

<details>
<summary>Show answer</summary>

Clients report position every ~10-30 seconds; that's high write volume with simple key access (`member_id + profile_id` → titles with position and timestamp). A wide-column/key-value store (Cassandra, DynamoDB) partitioned by profile fits well — last-write-wins per title is acceptable. Reduce writes by batching on the client and only persisting on pause/stop or every N seconds. Reads come from the same partition for the "Continue Watching" row, cached per session.

</details>

**M3.** How does the player decide when to switch to a lower bitrate?

<details>
<summary>Show answer</summary>

ABR algorithms combine **throughput estimates** (recent segment download speeds, smoothed) and **buffer level**. With a healthy buffer (e.g., > 30 s), the player can afford higher quality even if bandwidth dips; with a low buffer, it drops quality quickly to avoid rebuffering. Buffer-based approaches (like BOLA) reduce oscillation. Switching happens at segment boundaries; startup typically begins at a moderate bitrate and ramps up.

</details>

### 🔴 High — Think like a senior

**H1.** Design A/B testing of artwork (thumbnail) personalization across the catalog.

<details>
<summary>Show answer</summary>

Assign members to test cells deterministically (hash of member ID + test ID) via an experimentation service. For each title, candidate images are stored with IDs; the personalization service picks an image per member using a model (or a bandit for exploration). Log impressions (which image was shown, where) and outcomes (play within N minutes, watch time, abandonment). Analyze per cell with guardrail metrics (overall streaming hours, not just click-through — clickbait images raise clicks but lower satisfaction). Ensure image-selection logic is fast (precomputed per member) and cached with the homepage.

</details>

**H2.** An entire AWS region fails. How does the streaming service keep working?

<details>
<summary>Show answer</summary>

Video bytes come from the CDN/ISP caches, so playback of cached content continues even if a control-plane region fails — but new playback needs the control plane (auth, entitlements, manifests, licenses). Run the control plane **active-active in multiple regions** with data replicated across them (e.g., Cassandra multi-region), stateless services, and traffic steering (DNS/edge gateways) that can move all users to healthy regions within minutes. Regularly practice region evacuation and keep enough headroom (or fast autoscaling) in surviving regions to absorb the load.

</details>

## 🛠️ Mini Project — Build a Mini Streaming Service

**Goal**: Experience transcoding and adaptive streaming end to end. A weekend.

**Build**

1. Use FFmpeg to transcode a public-domain or Creative Commons video (e.g., Big Buck Bunny) into an HLS ladder: 240p, 480p, 720p, 1080p with 4-second segments and a master playlist.
2. Serve segments from MinIO or S3 behind NGINX as a caching proxy (or a CDN).
3. A small Spring Boot API: catalog, `GET /play/{titleId}` returning a signed, expiring manifest URL, and `PUT /progress` for continue-watching (stored in Redis or Cassandra).
4. A web player using `hls.js`; throttle bandwidth in the browser DevTools and watch quality switches.
5. Measure startup time and rebuffering for each throttle profile.

**Acceptance criteria**: playback adapts within a few segments when bandwidth changes; signed URLs expire; resume works across browsers; README with your bitrate ladder and measurements.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How would you handle millions of users watching the same live event (like a boxing match) on Netflix?"**

Live streaming is fundamentally different from on-demand. For live: (1) **Ingest** — receive the live feed via RTMP from the venue. (2) **Transcode in real-time** — encode into multiple qualities with ultra-low latency (2-5 second delay). (3) **Chunk and distribute** — push 2-second chunks to all OCA servers simultaneously. (4) **Client pulls** — players request chunks as they become available. The challenge is the "thundering herd" — all users request the same chunk at the same time. Solution: CDN edge caching handles this naturally. The first request fetches from origin, all subsequent requests in that region get the cached chunk. For 10M concurrent viewers, each OCA serves its local users.

**Follow-up trap**: "What about the 2-5 second delay?" → For most live content, 5 seconds is acceptable. For sports betting or interactive content, you need WebRTC or LL-HLS (Low-Latency HLS) which can achieve < 2 second delay, but at higher infrastructure cost.

</div>

<div class="callout-interview">

**Q: "How does Netflix ensure a video starts playing in under 2 seconds?"**

Multiple optimizations: (1) **Predictive pre-fetching** — when you hover over a title, the player pre-loads the first few chunks. (2) **Start at low quality** — begin with 480p (small chunks, fast download), then upgrade to 1080p/4K within 5-10 seconds. (3) **CDN proximity** — OCA servers inside your ISP mean < 5ms latency. (4) **Manifest caching** — the playlist file is cached at the edge. (5) **TCP optimization** — Netflix uses custom congestion control algorithms optimized for video delivery. The perceived start time is the time to download the first chunk + decode it. At 480p with a 2-second chunk, that's ~375KB — downloadable in < 500ms on most connections.

</div>

<div class="callout-interview">

**Q: "What happens if many users access the same video concurrently?"**

This is actually the EASY case for a CDN. The first user triggers a cache miss — the OCA fetches the chunk from the origin. Every subsequent user in that region gets a cache hit. For popular content (new releases), Netflix pre-positions it on OCAs before launch — so there's no cache miss at all. The OCA can serve the same chunk to thousands of concurrent users from its local storage. The hard case is the "long tail" — obscure content that's rarely watched. For this, OCAs only cache popular content; rare content is fetched from a regional hub or directly from S3.

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| Transcoding | Converting video into multiple quality levels and formats |
| ABR | Adaptive Bitrate Streaming — switch quality based on bandwidth |
| HLS/DASH | Streaming protocols that serve video as small chunks |
| Open Connect | Netflix's custom CDN with servers inside ISP data centers |
| Per-title encoding | Optimize encoding settings per video based on content complexity |
| Manifest | Playlist file listing all available chunks and quality levels |
| Collaborative Filtering | Recommend based on similar users' behavior |
| Long Tail | Rarely watched content that's expensive to cache everywhere |

---

> **Netflix's genius isn't in making great shows — it's in delivering them to 200 million people simultaneously without a single buffer. The best technology is the one you never notice.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Extra case study — CDN-heavy delivery at planet scale; ShopNorth uses the same CDN idea for images and pages.

**Continue the story:** [Chapter 2 · System Design (HLD)](/tutorials/journey-02-system-design) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
