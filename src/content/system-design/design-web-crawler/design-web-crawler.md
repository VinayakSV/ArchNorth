# Design Web Crawler — The Library Cataloger Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Development — services & events** · Extra case study for [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices)

</div>
<!-- sdlc-stage:end -->

## The Library Cataloger Analogy

Imagine you're hired to catalog every book in every library in the world. You start at one library, note every book, then follow references in those books to find other libraries. You visit those libraries, catalog their books, follow more references — and so on. But you must be polite (don't overwhelm any library), avoid revisiting libraries you've already cataloged, and prioritize important libraries first.

**That's a web crawler** — it systematically browses the internet, downloading web pages, extracting links, and following them to discover new pages.

---

## 1. Requirements

### Functional
- Start from a set of seed URLs
- Download web pages and extract content
- Extract links from pages and add to crawl queue
- Store crawled content for indexing
- Respect `robots.txt` (politeness)
- Handle different content types (HTML, PDF, images)

### Non-Functional
- **Scale**: Crawl 1 billion pages per month (~400 pages/second)
- **Politeness**: Don't overwhelm any single website
- **Freshness**: Re-crawl important pages frequently
- **Deduplication**: Don't crawl the same page twice
- **Fault tolerance**: Resume from where it stopped after crashes

### Back-of-envelope math
- 1B pages/month = ~400 pages/sec
- Average page size: 500KB
- Storage: 1B × 500KB = 500TB/month
- Bandwidth: 400 × 500KB = 200MB/sec

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Frontier["URL Frontier"]
        SQ[Seed URLs]
        PQ[Priority Queue]
        PL[Politeness Queue<br/>per-host rate limiting]
    end

    subgraph Fetcher["Fetcher Cluster"]
        F1[Fetcher 1]
        F2[Fetcher 2]
        F3[Fetcher N]
    end

    subgraph Processing
        RP[Robots.txt Parser]
        CP[Content Parser]
        LE[Link Extractor]
        DD[Deduplicator]
    end

    subgraph Storage
        CS[(Content Store<br/>S3 / HDFS)]
        US[(URL Store<br/>Visited URLs)]
        IDX[Search Index]
    end

    SQ --> PQ
    PQ --> PL
    PL --> F1
    PL --> F2
    PL --> F3
    F1 --> RP
    RP -->|Allowed| CP
    RP -->|Blocked| PQ
    CP --> CS
    CP --> LE
    LE --> DD
    DD -->|New URL| PQ
    DD -->|Already seen| X[Discard]
    CS --> IDX
```

---

## 3. URL Frontier — The Brain of the Crawler

The URL Frontier decides **what to crawl next**. It has two responsibilities:

### Priority Queue — What's Important?

```mermaid
flowchart TB
    A[New URL discovered] --> B{Calculate Priority}
    B --> C[PageRank score]
    B --> D[Domain authority]
    B --> E[Freshness - when last crawled]
    B --> F[Update frequency - how often it changes]
    C --> G[Priority Score: 0.0 - 1.0]
    D --> G
    E --> G
    F --> G
    G --> H[Insert into Priority Queue]
```

### Politeness Queue — Don't Be a Jerk

```
❌ Bad: Crawl 1000 pages from example.com in 1 second
✅ Good: Crawl 1 page from example.com every 2 seconds
```

```java
// Per-host rate limiter
public class PolitenessEnforcer {
    private final Map<String, Long> lastCrawlTime = new ConcurrentHashMap<>();
    private final long minDelayMs = 2000; // 2 seconds between requests to same host

    public boolean canCrawl(String host) {
        Long lastTime = lastCrawlTime.get(host);
        if (lastTime == null) return true;
        return System.currentTimeMillis() - lastTime >= minDelayMs;
    }

    public void recordCrawl(String host) {
        lastCrawlTime.put(host, System.currentTimeMillis());
    }
}
```

<div class="callout-warn">

**Warning**: Always check `robots.txt` before crawling ANY page. It's not just politeness — ignoring it can get your crawler's IP banned or even lead to legal issues. Google respects `robots.txt` religiously.

</div>

---

## 4. Deduplication — The Billion-URL Problem

With billions of URLs, how do you check "have I seen this URL before?" efficiently?

### URL Deduplication — Bloom Filter

```mermaid
flowchart LR
    A[New URL] --> B[Hash with k functions]
    B --> C{All bits set in Bloom Filter?}
    C -->|Yes| D[Probably seen - SKIP]
    C -->|No| E[Definitely new - CRAWL]
    E --> F[Add to Bloom Filter]
```

**Bloom Filter**: A probabilistic data structure that can tell you:
- "Definitely NOT seen" (100% accurate)
- "Probably seen" (small false positive rate ~1%)

For 1 billion URLs with 1% false positive rate: **~1.2 GB memory**. Compare to storing all URLs in a HashSet: **~50 GB memory**.

### Content Deduplication — SimHash

Different URLs can have the same content (mirrors, duplicates). Use SimHash to detect near-duplicate content:

```java
// SimHash fingerprint — similar content produces similar hashes
long hash1 = simHash(page1Content); // 0x1A2B3C4D5E6F7080
long hash2 = simHash(page2Content); // 0x1A2B3C4D5E6F7081
int hammingDistance = Long.bitCount(hash1 ^ hash2);
boolean isDuplicate = hammingDistance <= 3; // threshold
```

<div class="callout-tip">

**Applying this** — Use Bloom Filter for URL dedup (fast, memory-efficient) and SimHash for content dedup (catches mirrors and near-duplicates). This two-layer approach catches 99%+ of duplicates.

</div>

---

## 5. Distributed Crawling — Scaling to Billions

A single machine can crawl ~50 pages/sec. For 400 pages/sec, you need a cluster:

```mermaid
graph TB
    subgraph Coordinator
        UF[URL Frontier]
        HA[Host Assigner]
    end

    subgraph Workers["Crawler Workers"]
        W1["Worker 1<br/>Handles: a-f domains"]
        W2["Worker 2<br/>Handles: g-m domains"]
        W3["Worker 3<br/>Handles: n-s domains"]
        W4["Worker 4<br/>Handles: t-z domains"]
    end

    UF --> HA
    HA -->|"hash(hostname)"| W1
    HA -->|"hash(hostname)"| W2
    HA -->|"hash(hostname)"| W3
    HA -->|"hash(hostname)"| W4
```

<div class="callout-scenario">

**Scenario**: You have 10 crawler workers. `amazon.com` has millions of pages. If all workers crawl Amazon simultaneously, you'll overwhelm their servers and get banned. **Decision**: Use consistent hashing on hostname — ALL Amazon URLs go to Worker 3 only. Worker 3 enforces the politeness delay. This guarantees per-host rate limiting even in a distributed system.

</div>

---

## 6. Handling Dynamic Content (JavaScript-Rendered Pages)

Modern websites render content with JavaScript. A simple HTTP GET returns an empty HTML shell.

```mermaid
flowchart TB
    A[Fetch URL] --> B{Content type?}
    B -->|Static HTML| C[Parse directly]
    B -->|JS-rendered SPA| D[Headless Browser<br/>Puppeteer / Playwright]
    D --> E[Wait for JS execution]
    E --> F[Extract rendered DOM]
    F --> C
    C --> G[Extract links + content]
```

<div class="callout-scenario">

**Scenario**: You need to crawl a React SPA where all content loads via JavaScript. A simple `curl` returns `<div id="root"></div>`. **Decision**: Use a headless browser (Puppeteer) for JS-heavy sites. But headless browsers are 10x slower and use 10x more memory. So classify URLs: use simple HTTP fetch for 90% of sites, headless browser only for known SPAs. This hybrid approach balances coverage and performance.

</div>

---

## 7. Crawl Freshness — Re-crawling Strategy

Not all pages need re-crawling at the same frequency:

| Page Type | Re-crawl Frequency | Why |
|-----------|-------------------|-----|
| News homepage | Every 15 minutes | Content changes constantly |
| Product page | Every 24 hours | Prices/availability change daily |
| Wikipedia article | Every 7 days | Changes occasionally |
| Government archive | Every 30 days | Rarely changes |

```java
// Adaptive re-crawl scheduling
public Duration calculateRecrawlInterval(PageMetadata page) {
    if (page.getChangeFrequency() > 10) return Duration.ofMinutes(15);  // changes often
    if (page.getChangeFrequency() > 2)  return Duration.ofHours(24);    // changes daily
    if (page.getChangeFrequency() > 0)  return Duration.ofDays(7);      // changes weekly
    return Duration.ofDays(30);                                          // static
}
```

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A price-comparison company's crawler hammers a small retailer's site with 200 requests/second; the site goes down, and the retailer blocks the crawler's IP range and sends a legal notice. **Decision**: Politeness is a core requirement, not an afterthought. Enforce per-host rate limits in the URL frontier (one queue per host, with a minimum delay between fetches), honor `robots.txt` including `Crawl-delay`, back off on 429/503 responses, identify the crawler with a clear User-Agent and contact URL, and prefer official feeds or APIs where available.

</div>

<div class="callout-scenario">

**Scenario**: The crawler's frontier grows by 50 million URLs a day, mostly from one site whose calendar widget generates infinite links (`/calendar?month=2087-04`, `/calendar?month=2087-05`, ...). **Decision**: Detect **crawler traps**: cap URLs per host and per path pattern, limit URL length and query-parameter combinations, normalize and deduplicate URLs, and track the "new content ratio" per host — if a host keeps producing pages whose content fingerprints are near-duplicates, lower its crawl budget automatically.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Normalize these to one canonical URL: `HTTP://Example.com:80/a/../b/?utm_source=x&id=7#top` and `http://example.com/b?id=7`.

<details>
<summary>Show answer</summary>

Lowercase scheme and host, drop the default port (80 for http), resolve `..` path segments, remove fragments (`#top`), remove tracking parameters (`utm_*`), sort remaining query parameters, and apply consistent trailing-slash handling for your crawler → both become `http://example.com/b?id=7` (assuming `/b/` and `/b` are treated the same, which many sites do but you should verify with canonical tags).

</details>

**L2.** Why use a Bloom filter for "have we seen this URL?", and what's its downside?

<details>
<summary>Show answer</summary>

Billions of URLs won't fit in memory as a hash set; a Bloom filter answers "definitely not seen" or "probably seen" using a few bits per item. Downside: false positives — some new URLs are wrongly treated as seen and skipped (tunable via size and hash count), and you can't delete entries. Acceptable for crawling; pair it with a persistent store for exact checks where needed.

</details>

**L3.** What does `robots.txt` control, and what doesn't it guarantee?

<details>
<summary>Show answer</summary>

It tells crawlers which paths they may fetch (per User-Agent) and can suggest a crawl delay and sitemap locations. It's a convention, not access control — it doesn't secure content, and pages blocked from crawling may still be indexed by URL if linked elsewhere. A responsible crawler caches it per host (refreshing periodically) and obeys it.

</details>

### 🟡 Medium — Apply it

**M1.** Design the URL frontier to support both priority and politeness.

<details>
<summary>Show answer</summary>

Two layers (the Mercator design): **front queues** by priority (e.g., PageRank-like importance, freshness need, seed lists), and **back queues** — one per host — that enforce politeness. A selector moves URLs from front queues into the right host queue; a min-heap of "next allowed fetch time per host" tells fetcher threads which host queue is ready. Persist queues on disk/Kafka with in-memory buffers, since the frontier is far larger than RAM.

</details>

**M2.** How do you detect near-duplicate pages (same article on two URLs with different ads)?

<details>
<summary>Show answer</summary>

Exact hashes (MD5 of the HTML) miss near-duplicates. Extract main text, then compute **SimHash** (or MinHash over shingles): similar documents produce fingerprints with small Hamming distance (e.g., ≤ 3 bits of 64). Index fingerprints in tables keyed by bit blocks to find candidates quickly. Also honor `<link rel="canonical">`.

</details>

**M3.** Some sites render content with JavaScript. How do you crawl them without making the whole crawler 10x slower?

<details>
<summary>Show answer</summary>

Fetch raw HTML first for everything; detect pages that need rendering (empty body shell, known SPA frameworks, low text-to-markup ratio, host-level flags learned from previous crawls). Send only those to a separate **rendering tier** of headless browsers (Chromium pool) with strict timeouts, resource blocking (images, fonts, ads), and its own capacity limits. Cache rendering decisions per host.

</details>

### 🔴 High — Think like a senior

**H1.** Plan capacity: crawl 1 billion pages per month with an average page of 100 KB.

<details>
<summary>Show answer</summary>

1B / (30 × 86,400) ≈ **385 pages/second** average (plan ~1,000/s for peaks and retries). Bandwidth ≈ 385 × 100 KB ≈ 38.5 MB/s ≈ **310 Mbps** average. Storage ≈ 100 TB/month raw, ~20-30 TB compressed. With ~1 s per fetch and async I/O, a few machines with thousands of concurrent connections each can handle it; DNS resolution needs a local caching resolver (DNS often becomes the bottleneck). Parsing and dedup scale horizontally behind Kafka.

</details>

**H2.** How do you decide when to re-crawl a page?

<details>
<summary>Show answer</summary>

Estimate each page's change rate from history (how often content fingerprints changed on previous visits), weight by importance (traffic, links), and schedule re-crawls so the expected staleness is minimized within the crawl budget. Use HTTP conditional requests (`If-Modified-Since`, `ETag`) to make unchanged revisits cheap (304), sitemaps' `lastmod` hints, and RSS/push notifications (WebSub/IndexNow) where available. News homepages: minutes; static docs: weeks.

</details>

## 🛠️ Mini Project — Polite Distributed Crawler

**Goal**: A crawler you'd be comfortable running against real sites. 1 week of evenings.

**Build**

1. Java (virtual threads or an async HTTP client) or Python (asyncio + aiohttp): seed URLs → fetch → parse links → normalize → dedup (Bloom filter + Redis set) → frontier.
2. Frontier: per-host queues with a min-heap of next-allowed-fetch times, `robots.txt` cache and obedience, `Crawl-delay`, 429/503 back-off.
3. Content: extract title and main text, SimHash fingerprints, near-duplicate detection.
4. Trap defenses: max depth, max URLs per host, max URL length, and a query-parameter limit.
5. Distribute with Kafka: URLs partitioned by host hash so each host is crawled by one worker (makes politeness simple).
6. Crawl a sandbox (e.g., `books.toscrape.com`, which is built for scraping practice) and report pages/second, duplicates found, and politeness compliance.

**Acceptance criteria**: no host ever receives more than 1 request/second; restart-safe (frontier persisted); README with metrics and the normalization rules you implemented.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How would you design a web crawler that can crawl 1 billion pages per month?"**

I'd design it as a distributed system with these components: (1) **URL Frontier** — a priority queue backed by Kafka, with per-host politeness queues. (2) **Fetcher cluster** — 10-20 workers, each handling specific hostname ranges via consistent hashing. Each worker fetches ~40 pages/sec. (3) **Deduplication** — Bloom filter for URL dedup (1.2GB for 1B URLs), SimHash for content dedup. (4) **Storage** — S3 for raw HTML, Elasticsearch for indexing. (5) **Coordinator** — assigns URLs to workers, tracks crawl progress. The key bottleneck is network I/O, not CPU. I'd use async HTTP clients (Netty) with connection pooling. For robots.txt, cache it per domain with 24h TTL.

**Follow-up trap**: "How do you handle crawler traps (infinite URLs)?" → Limit crawl depth per domain (e.g., max 1000 pages per domain per crawl cycle). Detect URL patterns that generate infinite variations (e.g., calendar pages with `?date=2024-01-01`, `?date=2024-01-02`...). Use URL normalization to collapse equivalent URLs.

</div>

<div class="callout-interview">

**Q: "How is crawling different from scraping?"**

Crawling is about **discovery** — systematically following links to find all pages on the web. Scraping is about **extraction** — pulling specific data from known pages (prices, reviews, etc.). A crawler doesn't care about the content structure; it just downloads and indexes. A scraper has page-specific parsers that extract structured data. Google is a crawler. A price comparison site is a scraper. Legally, crawling public pages is generally accepted (if you respect robots.txt). Scraping can be legally gray, especially if it violates ToS or extracts copyrighted data.

</div>

<div class="callout-interview">

**Q: "Your crawler is getting blocked by websites. How do you handle it?"**

Several strategies: (1) **Respect robots.txt** — the #1 reason for blocking. (2) **Rotate User-Agents** — use realistic browser User-Agent strings. (3) **Rate limiting** — don't hit the same host more than once every 2-5 seconds. (4) **IP rotation** — use a pool of IPs across different subnets. (5) **Respect HTTP 429 (Too Many Requests)** — back off exponentially. (6) **Use residential proxies** for sites that block datacenter IPs. But ethically, if a site clearly doesn't want to be crawled, respect that. The goal is to be a good citizen of the web.

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| URL Frontier | Queue that decides what to crawl next |
| Politeness | Rate-limit requests per host to avoid overwhelming servers |
| robots.txt | File that tells crawlers what they can/can't crawl |
| Bloom Filter | Memory-efficient probabilistic set for URL dedup |
| SimHash | Fingerprint for detecting near-duplicate content |
| Consistent Hashing | Assign hostname ranges to specific crawler workers |
| Headless Browser | Browser without UI for rendering JavaScript pages |
| Crawl Depth | How many links deep from seed URL to follow |
| Adaptive Re-crawl | Frequently changing pages get crawled more often |

---

> **A good web crawler is like a good journalist — thorough, respectful, efficient, and never visits the same source twice without reason.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Extra case study — its queues, deduplication, and retry ideas reappear in ShopNorth's Kafka consumers and dead-letter topics.

**Continue the story:** [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
