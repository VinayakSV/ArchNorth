# CloudFront, Route 53, ACM & WAF — The Edge: The Newspaper Kiosk Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Operations — release & incidents** · ShopNorth uses this in [Chapter 14 · Launch Day & Incidents](/tutorials/journey-14-launch-day)

</div>
<!-- sdlc-stage:end -->

## The Newspaper Kiosk Analogy

A newspaper is printed at its headquarters in one city, but readers live everywhere:

- **Kiosks in every neighborhood** keep copies of today's paper, so readers don't travel to headquarters. That's **CloudFront's edge locations** caching your content.
- Each kiosk keeps a copy **until it expires** — the morning paper until evening, the weekly magazine for a week. That's the **TTL**.
- When a correction is printed, headquarters can tell every kiosk to **throw away** the old copies (slow, and every kiosk must do it), or simply print the corrected edition **with a new edition number** so nobody confuses the two. That's **invalidation** versus **versioned file names**.
- Kiosks accept deliveries **only from the newspaper's own trucks**, so nobody can slip in a fake paper. That's **Origin Access Control**.
- A **guard** at busy kiosks turns away people trying to grab 500 copies of the special edition. That's **AWS WAF** with rate limits and bot rules.
- The **city directory** tells readers where the nearest kiosk is. That's **Route 53**, and the **certificate** on the kiosk's window proving it's genuine is **ACM**.

## 1. CloudFront in One Table

| Concept | Meaning |
|---------|---------|
| **Distribution** | Your CDN configuration, with a domain like `d111abcdef8.cloudfront.net` and your own names (`www.shopnorth.example`) |
| **Edge locations / regional edge caches** | Hundreds of points of presence worldwide, including several Indian cities; regional caches sit between them and your origin |
| **Origin** | Where content comes from: an S3 bucket, an ALB, any HTTP server — or, with **VPC origins**, an ALB in private subnets |
| **Behavior** | A path pattern (`/assets/*`) → an origin + caching rules + functions |
| **Cache policy** | What forms the **cache key** (path, selected headers, cookies, query strings) and the TTLs |
| **Origin request policy** | What's forwarded to the origin without affecting the cache key |
| **Response headers policy** | Adds security headers (HSTS, CSP, X-Content-Type-Options…) |
| **Invalidation** | Remove paths from all edge caches (the first 1,000 paths per month are free) |
| **Origin Shield** | An extra caching layer that collapses requests to the origin |

## 2. ShopNorth's Distribution

`www.shopnorth.example` is one distribution with four behaviors:

| Path pattern | Origin | Caching | Why |
|-------------|--------|---------|-----|
| `/assets/*` | S3 `shopnorth-web-prod` | 1 year — file names contain a content hash (`app.3f9c1a.js`) | A new deploy produces new names, so no invalidation is ever needed |
| `/resized/*` | S3 `shopnorth-product-images-prod` | 7 days | Image keys contain a UUID, so a replaced photo is a new URL |
| `/sale/*` | S3 `shopnorth-web-prod` (pre-rendered sale pages) | 60 s | Fresh enough for price changes, absorbs the 8 PM spike |
| Default (`*`) | S3 `shopnorth-web-prod` | `index.html` not cached at the edge | Every deploy is visible immediately |

The API, `api.shopnorth.example`, is **not** behind CloudFront: responses are personalized and mostly uncacheable, so Route 53 points it straight at the ALB, protected by WAF (Chapter 12). Fronting the API with CloudFront later — for TLS at the edge and DDoS absorption, with the ALB moved to private subnets as a VPC origin — is on the roadmap.

### Single-page app routing

Customers open URLs like `/product/SKU-48213` that exist only in the React router, not as files in S3. A **CloudFront Function** on viewer requests serves the app shell for any path without a file extension:

```javascript
function handler(event) {
    var request = event.request;
    // "/product/SKU-48213" is a React route; "/assets/app.3f9c1a.js" is a real file
    if (request.uri.indexOf('.') === -1) {
        request.uri = '/index.html';
    }
    return request;
}
```

## 3. Caching Correctly

The origin's `Cache-Control` headers tell CloudFront (and browsers) what to do:

| Content | `Cache-Control` from the origin | Effect |
|---------|--------------------------------|--------|
| Hashed assets | `public, max-age=31536000, immutable` | Cached for a year at the edge and in browsers |
| `index.html` | `no-cache` | Always revalidated, so a new deploy loads immediately |
| Sale pages | `public, max-age=60, stale-while-revalidate=30` | Fast, refreshed in the background |
| Anything personalized | `private, no-store` | Never cached by CloudFront |

<div class="callout-warn">

**The cache key decides who sees what.** If a response depends on a cookie or header (logged-in user, language, currency) but the cache key ignores it, the first user's version is served to everyone. If the cache key includes things the response *doesn't* depend on (all cookies, all query strings), every request is a cache miss. Include exactly what changes the response — and keep personalized content out of shared caches.

</div>

**Versioned file names beat invalidations.** Invalidations take time to reach every edge location and cost money beyond the free tier. ShopNorth invalidates only in emergencies (a wrong price on a sale page) — normal deploys need none.

## 4. Code at the Edge

| | CloudFront Functions | Lambda@Edge |
|---|---|---|
| Runtime | Lightweight JavaScript | Node.js or Python |
| Runs on | Viewer request and response | Viewer and origin events |
| Speed | Sub-millisecond, at every edge location | Milliseconds, at regional edge caches |
| Can call the network | No | Yes |
| Use for | URL rewrites, redirects, header changes, simple auth tokens | Origin selection, calling APIs, image transforms, heavier logic |

## 5. Security at the Edge

| Layer | ShopNorth's setting |
|-------|---------------------|
| HTTPS only | HTTP redirects to HTTPS; a modern TLS security policy |
| Certificates (**ACM**) | Free, auto-renewing. The CloudFront certificate for `www` **must be in `us-east-1`**; the ALB's certificate for `api` is in `ap-south-1` |
| **Origin Access Control** | The S3 buckets accept reads only from this distribution (bucket policy in [S3](/tutorials/aws-s3)) |
| **AWS Shield Standard** | Automatic, free protection against common network-layer DDoS attacks |
| **AWS WAF** | AWS managed rule groups (common exploits, known bad inputs, bot control) plus ShopNorth's own rate-based rules |
| Security headers | A response headers policy adds HSTS, CSP, and other headers |
| Private content | Signed URLs or signed cookies (not used — invoices use S3 presigned URLs) |

A WAF rate-based rule on the ALB limits checkout calls per IP address:

```json
{
  "Name": "limit-checkout-per-ip",
  "Priority": 10,
  "Action": { "Block": {} },
  "Statement": {
    "RateBasedStatement": {
      "Limit": 300,
      "EvaluationWindowSec": 60,
      "AggregateKeyType": "IP",
      "ScopeDownStatement": {
        "ByteMatchStatement": {
          "SearchString": "/checkout",
          "FieldToMatch": { "UriPath": {} },
          "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }],
          "PositionalConstraint": "STARTS_WITH"
        }
      }
    }
  },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "limitCheckoutPerIp"
  }
}
```

<div class="callout-tip">

**Per-IP limits must be generous in India.** Mobile carriers put thousands of customers behind the same public IP address (carrier-grade NAT). A tight per-IP limit can block a whole neighborhood. ShopNorth keeps WAF limits loose — an outer layer against floods and bots — and does fair, per-customer limiting at the API gateway with the customer ID from the JWT (Chapter 14).

</div>

## 6. Sale Night at the Edge

What the edge did for ShopNorth during the Diwali spike (Chapter 14):

| Concern | What was in place |
|---------|------------------|
| Image and asset load | 97% cache hit ratio; the origin buckets barely noticed the spike |
| Sale page freshness | 60 s TTL with `stale-while-revalidate`; one emergency invalidation when a deal price was wrong |
| Bots on the flash deal | WAF Bot Control and a challenge on suspicious automation; the waiting room did the rest |
| Visibility | CloudFront metrics (requests, cache hit rate, 4xx/5xx rates) and WAF sampled requests on the war-room dashboard |
| DNS changes | Route 53 TTLs lowered to 60 s the day before, in case anything had to move |

## 7. What It Costs

CloudFront charges for data transfer to viewers and for requests — and data transfer out through CloudFront is generally cheaper than serving the same bytes directly from S3 or EC2, while being faster for users. **Price classes** limit which edge locations are used: ShopNorth uses Price Class 200, which includes India, rather than paying for every location in the world.

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: An online store started caching its product pages at the CDN to survive a sale. The pages included the logged-in customer's first name and cart count. The cache key ignored cookies, so for 20 minutes thousands of customers saw a stranger's name and cart badge — a privacy incident. **Decision**: Pages are rendered without personal data and cached; personal fragments (name, cart count) load from the API with `private, no-store`. A CI check fails any response with both `public` caching and user-specific headers.

</div>

<div class="callout-scenario">

**Scenario**: A team used CloudFront invalidations as their deploy mechanism — every release invalidated `/*`. During a busy period, deploys looked "half-done" for minutes: some edge locations served the new `index.html` that referenced JavaScript files other locations hadn't refreshed yet, causing blank pages. **Decision**: Content-hashed asset names with long TTLs, `index.html` with `no-cache`, and old assets kept in the bucket for a few days, so any version of `index.html` can still load its files. Invalidations became rare emergency tools.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why must the certificate for a CloudFront distribution be created in `us-east-1`, while the ALB's certificate lives in `ap-south-1`?

<details>
<summary>Show answer</summary>

CloudFront is a global service whose configuration is managed in `us-east-1`, so it only reads ACM certificates from that region. An ALB is a regional resource and can only use certificates from ACM in its own region. ShopNorth therefore has two certificates: `www.shopnorth.example` in `us-east-1` for CloudFront, and `api.shopnorth.example` in `ap-south-1` for the ALB — both free and auto-renewed.

</details>

**L2.** What `Cache-Control` headers would you send for (a) `app.3f9c1a.js`, (b) `index.html`, (c) `GET /api/orders/me`?

<details>
<summary>Show answer</summary>

(a) `public, max-age=31536000, immutable` — the hash in the name changes whenever the content does. (b) `no-cache` — browsers and CloudFront must revalidate, so new deploys appear immediately. (c) `private, no-store` — personal data must never be stored by shared caches (and the API isn't behind CloudFront anyway).

</details>

### 🟡 Medium — Apply it

**M1.** After a deploy, some customers see a blank storefront for a few minutes. What's likely happening, and how do you fix it permanently?

<details>
<summary>Show answer</summary>

Likely a mismatch between `index.html` and asset files: a cached old `index.html` references assets that the deploy deleted, or a new `index.html` references assets not yet uploaded (deploy order), or invalidations propagate unevenly. Fix: content-hashed asset names; upload new assets **before** the new `index.html`; keep old assets for several days (lifecycle rule to clean up later); serve `index.html` with `no-cache`; no wildcard invalidations as part of deploys. The ArchNorth site you're reading handles a similar problem — stale bundles after a deployment — by reloading once when a chunk fails to load.

</details>

**M2.** ShopNorth's CloudFront cache hit ratio for images is only 60%. Investigate and improve it.

<details>
<summary>Show answer</summary>

Check the cache key: are query strings (tracking parameters like `utm_source`), cookies, or headers being forwarded and included? Use a cache policy with only the path (and maybe a version parameter). Check TTLs and `Cache-Control` from S3 (missing headers may fall back to short defaults). Check URL variants: different sizes requested with ad-hoc parameters instead of fixed `resized/<width>/` paths. Enable **Origin Shield** in the region nearest the origin to collapse misses from many edge locations. Then watch the hit ratio and origin request count in CloudFront metrics.

</details>

### 🔴 High — Think like a senior

**H1.** Design the edge protection for a flash deal: 1,000 headphones at 8 PM, expected bot traffic, and real customers on mobile networks.

<details>
<summary>Show answer</summary>

**Layers:** (1) **WAF** on the ALB and CloudFront: AWS managed rules plus **Bot Control** (targeted inspection on the deal endpoints), challenges/CAPTCHA for suspicious clients, and *generous* per-IP rate limits because of carrier-grade NAT. (2) **Waiting room** in front of the deal page that admits customers at the rate checkout can handle (Chapter 14), with signed admission tokens so bots can't skip it. (3) **Per-customer limits** at the API gateway (one unit per customer, login required). (4) **Inventory correctness** at the database (conditional updates). (5) **Edge caching** of the deal page and assets so the spike doesn't reach the origin. Monitor WAF sampled requests and block rates in real time, with a runbook to tighten rules quickly. Test it with a bot simulation in staging before the sale.

</details>

**H2.** Should ShopNorth put its API behind CloudFront too? Make the case for and against.

<details>
<summary>Show answer</summary>

**For:** TLS terminates closer to customers (faster handshakes on mobile), CloudFront's network absorbs volumetric DDoS before it reaches the region, WAF at the edge, caching of the few cacheable GETs (category listings), and with **VPC origins** the ALB can move to private subnets so it's unreachable except through CloudFront. **Against:** another layer to configure and debug, careful cache policies so personalized responses are never cached, request costs, and timeouts/headers to align with the gateway. **Recommendation:** worth doing as the store grows — start with a "no caching" behavior for `/api/*` (pure acceleration and protection), forward the needed headers, then selectively cache public catalog endpoints with short TTLs. Roll out with a weighted Route 53 record and compare latency and errors.

</details>

## 🛠️ Mini Project — Put a React App on the Edge

**Goal**: Serve a single-page app globally, securely, and with zero-downtime deploys. 1 weekend (free-tier friendly).

**Build**

1. Build a small React app with hashed asset names (Vite does this by default).
2. Create a private S3 bucket and a CloudFront distribution with **Origin Access Control**; update the bucket policy so only the distribution can read.
3. Add behaviors: `/assets/*` cached for a year; default behavior with `index.html` revalidated; a **CloudFront Function** that rewrites extension-less paths to `/index.html`.
4. If you own a domain: request an ACM certificate in `us-east-1`, add it to the distribution, and create Route 53 alias records.
5. Attach a WAF web ACL with an AWS managed rule group and a rate-based rule; test the rate limit with a quick load script.
6. Deploy a new version (upload assets first, then `index.html`) while a browser stays open; confirm no blank pages and no invalidation needed.

**Acceptance criteria**: deep links work, the bucket isn't public, a deploy shows up immediately without invalidations, and the rate rule blocks your test script.

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How does a CDN like CloudFront speed up a website, and what should and shouldn't be cached?"**

It serves content from edge locations close to users, so most requests never travel to the origin region. That cuts latency and origin load and absorbs traffic spikes. Static assets with content-hashed names are cached for a year. HTML shells are revalidated, so deploys show up immediately. Public pages that change, like sale pages, get short TTLs with stale-while-revalidate. Anything personalized is marked private and never cached in shared caches. The cache key must include exactly what changes the response, or users see each other's content, or nothing gets cached at all.

</div>

<div class="callout-interview">

**Q: "How do you serve private S3 content through CloudFront?"**

Keep the bucket private and use Origin Access Control: CloudFront signs its requests to S3, and the bucket policy allows s3:GetObject only for the CloudFront service principal, with a condition on the distribution's ARN, so nobody can bypass the CDN. Block Public Access stays on. If the content is private per user, I'd use CloudFront signed URLs or signed cookies issued by my backend after an authorization check, or skip CloudFront and use short-lived S3 presigned URLs for downloads like invoices.

</div>

<div class="callout-interview">

**Q: "How would you protect a web application from bots and traffic floods on AWS?"**

In layers. Shield Standard covers common network-level attacks automatically. AWS WAF on CloudFront and the load balancer adds managed rule groups for common exploits and bot control, plus rate-based rules. Per-IP limits stay generous, because mobile users often share IP addresses behind carrier-grade NAT. Inside the application, I'd rate-limit fairly per authenticated user at the API gateway, protect hot features with a waiting room or queue, and make critical operations correct under contention at the database. Caching at the edge keeps floods away from the origin, and dashboards on WAF metrics and sampled requests let the team adjust rules quickly during an attack.

</div>

## Quick Reference

| Concept | Remember |
|---------|----------|
| Behaviors | Path pattern → origin + cache policy + functions |
| Cache key | Include only what changes the response |
| Hashed assets | 1-year TTL; no invalidations needed |
| `index.html` | `no-cache` |
| Personalized | `private, no-store` — never in shared caches |
| S3 origin | Origin Access Control + bucket policy on the distribution ARN |
| Certificates | CloudFront → `us-east-1`; ALB → its own region |
| Edge code | CloudFront Functions (light) vs Lambda@Edge (powerful) |
| WAF | Managed rules, bot control, rate-based rules — mind carrier-grade NAT |
| Shield | Standard is automatic and free |

> **Golden rule: cache everything public with versioned names, never cache anything personal, and let the edge take the hits before your origin ever sees them.**

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — On sale night, CloudFront served ShopNorth's images, assets, and sale pages with a 97% hit ratio, WAF and Bot Control kept scripted buyers off the flash deal, and Route 53 TTLs were lowered in advance in case anything had to move. Chapter 14 tells the whole night.

**Continue the story:** [Chapter 14 · Launch Day & Incidents](/tutorials/journey-14-launch-day) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
