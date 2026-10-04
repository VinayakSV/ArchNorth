# Chapter 7 · Security & Login

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 7 of 15 · Phase: **Build**

**Previously:** ShopNorth's services work together through one gateway and Kafka events, and the checkout saga survives failures and duplicates ([Chapter 6](/tutorials/journey-06-microservices)).

**In this chapter:** You lock it down. Customers log in through Auth0, admins get least-privilege roles, every service checks *who* is asking and *what they may touch*, payment webhooks prove they're genuine, and secrets leave the code.

</div>

## The Situation

End of Sprint 3. Priya books a one-hour "how would we attack ourselves?" session. She writes three questions on the board:

1. Could a customer see someone else's orders or address?
2. Could someone get products without paying?
3. If a laptop is stolen or a repo is leaked, what could an attacker do?

"Security isn't a feature we add at the end," she says. "It's a property of everything we've already built. Let's check it piece by piece."

## Step 1 — A Lightweight Threat Model

| Threat | Example at ShopNorth | Defense (this chapter) |
|--------|---------------------|------------------------|
| Account takeover | Leaked passwords tried in bulk (credential stuffing) | Auth0 with Google / OTP login, breached-password detection, rate limits |
| Seeing others' data (IDOR) | Changing `/orders/123` to `/orders/124` | Ownership check in every service, on every object |
| Price tampering | Client sends `"price": 1` | Server-side pricing only (Chapter 5) |
| Fake payment confirmation | Attacker posts "payment succeeded" to the webhook | Signature verification + provider status check |
| Admin abuse or mistakes | A compromised admin changes prices to ₹1 | MFA, least privilege, audit log, alerts |
| Leaked secrets | DB password committed to Git | Secrets manager, secret scanning in CI (Chapter 9) |
| Bots and scalpers | Scripts grabbing all flash-deal stock | Per-customer limits, rate limiting, bot protection (Chapter 14) |
| Vulnerable libraries | A known CVE in a dependency | Dependency scanning (Chapter 9) |

## Step 2 — Login With Auth0

ShopNorth doesn't build login itself. Auth0 handles passwords, social login, OTP, MFA, and breached-password detection, and issues tokens.

| Auth0 setup | ShopNorth value |
|-------------|-----------------|
| Applications | `shopnorth-web` (single-page app), `shopnorth-admin` (single-page app), `shopnorth-jobs` (machine-to-machine) |
| API (audience) | `https://api.shopnorth.example` |
| Login methods | Google, passwordless SMS OTP |
| Roles → permissions | **customer** (default, no extra permissions) · **support**: `read:orders:any` · **ops-admin**: `write:stock` · **price-admin**: `write:prices` |
| Token lifetime | Access token 15 minutes; refresh token rotation enabled |
| Admin rule | A post-login Action requires MFA for anyone with an admin role |

The React app uses the **Authorization Code flow with PKCE** through the Auth0 SDK. It keeps tokens in memory (never `localStorage`) and sends the access token as `Authorization: Bearer …` on API calls.

## Step 3 — Every Service Verifies the Token

The gateway rejects requests without a valid token early, but **each service verifies it again**. If someone reaches a service directly (a misconfigured route, a compromised pod), it still refuses.

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://shopnorth.eu.auth0.com/     # signature keys discovered from the issuer
          audiences: https://api.shopnorth.example        # reject tokens issued for other APIs
```

```java
@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**").permitAll()          // probes only, nothing else
                .requestMatchers("/admin/stock/**").hasAuthority("PERM_write:stock")
                .requestMatchers("/admin/prices/**").hasAuthority("PERM_write:prices")
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(permissions())))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.disable());   // stateless bearer-token API: no cookies, so no CSRF risk
        return http.build();
    }

    private JwtAuthenticationConverter permissions() {
        JwtGrantedAuthoritiesConverter perms = new JwtGrantedAuthoritiesConverter();
        perms.setAuthoritiesClaimName("permissions");   // Auth0 RBAC puts permissions in this claim
        perms.setAuthorityPrefix("PERM_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(perms);
        return converter;
    }
}
```

The service validates the signature, issuer, audience, and expiry **locally** using Auth0's public keys (cached) — no call to Auth0 per request.

## Step 4 — Object-Level Authorization: "Is This *Your* Order?"

Route rules like `authenticated()` answer "is this a logged-in user?" They don't answer "may *this* user see *this* order?" That second check is where most real breaches happen (**Broken Access Control** — number one in the OWASP Top 10, 2021 edition).

```java
@GetMapping("/{id}")
OrderResponse get(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
    Optional<Order> order = canReadAnyOrder(jwt)
            ? orders.findById(id)                                   // support staff
            : orders.findByIdAndCustomerId(id, jwt.getSubject());   // customers: only their own
    return order.map(OrderResponse::from)
                .orElseThrow(() -> new OrderNotFoundException(id)); // 404 either way
}

private static boolean canReadAnyOrder(Jwt jwt) {
    List<String> permissions = jwt.getClaimAsStringList("permissions");
    return permissions != null && permissions.contains("read:orders:any");
}
```

Two details matter:

- The **ownership condition is in the query** (`findByIdAndCustomerId`), so forgetting a check in Java can't leak data.
- Someone else's order returns **404, not 403**. A 403 would confirm that order ID exists.

<div class="callout-warn">

**Random UUIDs don't replace authorization.** They make IDs hard to guess, which helps, but IDs leak through URLs, logs, emails, and support tickets. Only an ownership check makes access safe. Meera adds an automated test for every endpoint: customer A requests customer B's resource and must get 404.

</div>

## Step 5 — Proving a Payment Webhook Is Real

The payment provider calls `POST /payments/webhooks/provider` when a payment succeeds. Anyone on the internet can call that URL, so the Payment service trusts nothing until it's verified:

```java
@Component
class WebhookVerifier {

    private final byte[] secret;          // from the secrets manager, never from code

    WebhookVerifier(PaymentProviderProperties props) {
        this.secret = props.webhookSecret().getBytes(StandardCharsets.UTF_8);
    }

    boolean isGenuine(byte[] rawBody, String signatureHex, Instant sentAt, Instant now) {
        if (Duration.between(sentAt, now).abs().compareTo(Duration.ofMinutes(5)) > 0) {
            return false;                                     // too old or from the future: possible replay
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] expected = mac.doFinal(rawBody);           // sign the raw bytes, not re-serialized JSON
            byte[] given = HexFormat.of().parseHex(signatureHex);
            return MessageDigest.isEqual(expected, given);    // constant-time comparison
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            return false;
        }
    }
}
```

The exact signing scheme (header names, what's signed, whether a timestamp is included) comes from your provider's documentation. The principles don't change:

1. **Verify the signature** over the raw request body, with a constant-time comparison.
2. **Reject replays**: a timestamp tolerance, plus storing each provider event ID with a unique constraint.
3. **Double-check high-value or unusual cases** with the provider's API ("what's the status of payment `pay_9Q2x`?") before marking an order paid.
4. **Check the amount and currency** match the order — a genuine webhook for ₹1 must not pay for a ₹24,999 order.

## Step 6 — Card Data Never Touches ShopNorth

Because customers pay on the provider's **hosted checkout page**, card numbers never pass through ShopNorth's servers or logs. That keeps ShopNorth's PCI DSS scope small; a merchant with fully outsourced card entry typically qualifies for the simplest self-assessment. Building your own card form would bring the servers, networks, and people who touch card data into scope — a large, ongoing compliance cost a six-person team shouldn't take on.

## Step 7 — Secrets Live in a Vault, Not in Code

| Secret | Where it lives | How the app gets it |
|--------|----------------|---------------------|
| Database passwords | AWS Secrets Manager (rotated automatically) | External Secrets Operator → Kubernetes Secret → environment variable |
| Payment webhook secret | AWS Secrets Manager | Same path |
| Auth0 machine-to-machine client secret | AWS Secrets Manager | Same path |
| Local development values | Each developer's untracked `.env` file | Docker Compose (Chapter 10) |

The pipeline runs **secret scanning** on every pull request (Chapter 9), so a committed key is blocked before merge. If one ever leaks, the runbook says: rotate first, investigate second.

## Step 8 — Personal Data and Admin Actions

**Personal data** (names, phone numbers, addresses, emails) is protected at every layer: encrypted at rest (managed database and object storage encryption), TLS everywhere, and **masked in logs**. Logs carry the customer ID, never the phone number or address. Under India's Digital Personal Data Protection Act, 2023, ShopNorth collects only what it needs for orders and delivery, says why, and supports deletion requests. Order records needed for tax and accounting are kept for the legally required period with personal fields minimized.

**Admin actions** are where one compromised account does the most damage. Admins need MFA, permissions are split (stock vs prices), and every change writes an **audit record**:

```sql
CREATE TABLE admin_audit_log (
    id          BIGSERIAL   PRIMARY KEY,
    actor_id    TEXT        NOT NULL,        -- Auth0 user ID from the token
    action      TEXT        NOT NULL,        -- 'PRICE_CHANGED', 'STOCK_ADJUSTED', ...
    target      TEXT        NOT NULL,        -- e.g. the SKU
    before_json JSONB,
    after_json  JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A Datadog monitor (Chapter 13) alerts on unusual admin activity, such as more than 50 price changes in 10 minutes, or any price cut over 80%.

## Step 9 — The OWASP Top 10 Checklist for ShopNorth

| OWASP Top 10 (2021) | Where ShopNorth handles it |
|---------------------|----------------------------|
| A01 Broken Access Control | Ownership in queries, 404 for others' objects, cross-customer tests |
| A02 Cryptographic Failures | TLS everywhere, encryption at rest, no card data |
| A03 Injection | JPA and parameterized queries only; no string-built SQL; output encoding in React |
| A04 Insecure Design | This threat model; reviews in Chapter 9 |
| A05 Security Misconfiguration | Only health probes are public; no default credentials; hardened images (Chapter 10) |
| A06 Vulnerable and Outdated Components | Dependency scanning and automated update PRs (Chapter 9) |
| A07 Identification and Authentication Failures | Auth0, MFA for admins, rate limits on login |
| A08 Software and Data Integrity Failures | Signed webhooks, signed images, reviewed pipeline (Chapter 11) |
| A09 Security Logging and Monitoring Failures | Audit logs, security alerts (Chapter 13) |
| A10 Server-Side Request Forgery | No fetching of user-supplied URLs; the admin image import accepts only approved domains |

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: An online retailer used sequential order IDs, and its order API checked only that the caller was logged in. A curious customer changed `/orders/58210` to `/orders/58209` and saw another customer's name, phone number, and delivery address — then wrote a script that downloaded thousands. **Decision**: Every query that loads a customer-owned object includes the owner in its `WHERE` clause; responses for others' objects are 404; and an automated test suite tries cross-customer access on every endpoint in every build. Random IDs were added too, but as a second layer, not the fix.

</div>

<div class="callout-scenario">

**Scenario**: A small store's payment webhook accepted any JSON with `"status": "captured"`. Someone discovered the endpoint and posted fake confirmations for dozens of orders, which shipped without payment. **Decision**: Verify the provider's signature on the raw body, reject old timestamps and repeated event IDs, check the amount and currency against the order, and confirm status with the provider's API before shipping high-value orders. A daily reconciliation job compares ShopNorth's paid orders with the provider's settlement report and flags any mismatch.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [Auth0 — Zero to Industry Implementation](/tutorials/auth0-deep-dive) | OAuth2, OIDC, PKCE, RBAC, Actions | Login, roles, permissions, MFA for admins |
| [Auth & Security Decisions](/tutorials/auth-security-decisions) | Sessions vs tokens, where to authorize | Gateway + service verification, object-level checks |
| [API Gateway Pattern](/tutorials/api-gateway-pattern) | Edge authentication | Rejecting bad tokens early |
| [Rate Limiter](/tutorials/rate-limiter) · [Distributed Rate Limiter](/tutorials/design-rate-limiter-distributed) | Protecting endpoints from abuse | Login and checkout limits |
| [Config, Secrets & Storage](/tutorials/k8s-config-storage) | Kubernetes Secrets and external secret stores | Secrets Manager → Kubernetes Secret → env var |
| [Cloud & Infrastructure Decisions](/tutorials/cloud-infra-decisions) | Managing secrets and IAM on AWS | Secrets Manager with rotation |

## 📚 Extra Case Studies

Security in other domains: [Payment Gateway](/tutorials/payment-gateway) (money-moving APIs), [Fraud Detection System](/tutorials/fraud-detection-system) (spotting abuse with rules and models), and [Design ATM](/tutorials/design-atm) (hardware, PINs, and defense in depth).

## 🛠️ Mini Project — Build ShopNorth, Step 7: Secure the Order Service

**Goal**: Real login and authorization on your service. 2-3 evenings (Auth0 free tier).

**Build**

1. Create an Auth0 tenant with an API (audience), a single-page app (or use Postman's OAuth2 support), and roles `customer`, `support`, `ops-admin` with permissions.
2. Turn `order-service` into a resource server: issuer + audience validation, `permissions` mapped to authorities, stateless, health probes public.
3. Replace the `X-Customer-Id` header from Chapter 5 with `jwt.getSubject()`; enforce ownership in queries.
4. Add HMAC signature verification with a timestamp tolerance to your payment simulator's webhook, and an amount check.
5. Move every secret into environment variables loaded from an untracked file; add `.env` to `.gitignore`.
6. Tests: customer A reading customer B's order gets 404; an expired token gets 401; a missing permission on an admin endpoint gets 403; a forged webhook is rejected.

**Acceptance criteria**: all negative tests pass; no secrets in Git; every customer-owned query includes the owner.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Which status code for each: (a) no token, (b) expired token, (c) valid customer token calling an admin endpoint, (d) valid token requesting another customer's order?

<details>
<summary>Show answer</summary>

(a) **401** Unauthorized (not authenticated). (b) **401** (the token is no longer valid; the client should refresh and retry). (c) **403** Forbidden (authenticated, but lacks the permission — admin endpoints are known to exist, so 403 reveals nothing new). (d) **404** Not Found (hide whether that order exists). A common bug is returning 403 for (d), which confirms valid IDs to an attacker.

</details>

**L2.** The gateway already validates tokens. Why does every service validate them again?

<details>
<summary>Show answer</summary>

Defense in depth. Services can be reached without the gateway: a misconfigured ingress route, another compromised service inside the cluster, or a debugging port-forward left open. Validating locally is cheap (signature check with cached public keys, no network call), and each service needs the verified identity anyway to make its own authorization decisions, such as ownership checks. Trusting a header like `X-User-Id` set by the gateway is the classic mistake — anyone who reaches the service directly can set it.

</details>

### 🟡 Medium — Apply it

**M1.** The webhook signing secret leaked in a screenshot. Rotate it without missing any real webhooks.

<details>
<summary>Show answer</summary>

Support **two secrets at once** during the rotation: (1) generate a new secret at the provider (most providers allow multiple active secrets or a rollover window); (2) deploy the Payment service accepting a signature from *either* the old or the new secret; (3) switch the provider to sign with the new secret; (4) after the provider's retry window passes, remove the old secret from the service and revoke it at the provider. Meanwhile, check recent webhooks against the reconciliation report for anything forged with the leaked secret. The same "accept old and new, then remove old" pattern works for API keys and database credentials.

</details>

**M2.** Design the permissions and audit trail for the admin panel so that one compromised ops account can't wreck the sale.

<details>
<summary>Show answer</summary>

**Least privilege:** separate `write:stock`, `write:prices`, `write:catalog`, `read:orders:any`, `refund:orders`, assigned to different roles; nobody gets all of them by default. **Strong login:** MFA required for every admin role, enforced in an Auth0 Action, and admin sessions expire quickly. **Guardrails in code:** price changes over a threshold (e.g., more than 50% down) need a second person's approval; bulk changes go through a reviewed CSV import with a preview. **Audit and detection:** every change is written to the audit log with before/after values; monitors alert on unusual volume or size of changes; and a one-click revert exists for price changes. **Separation:** the admin app is a separate application with its own audience, reachable only through the corporate VPN or an allowlist.

</details>

### 🔴 High — Think like a senior

**H1.** The night before the sale, the login endpoint gets 200,000 attempts per hour from thousands of IPs using leaked email/password lists. What do you do?

<details>
<summary>Show answer</summary>

This is **credential stuffing**. Because login is in Auth0, turn on and tune its protections: brute-force protection per account, suspicious IP throttling, breached password detection (force a reset for accounts using leaked passwords), and bot detection / CAPTCHA on the login page when risk is high. At ShopNorth's edge, apply WAF rules and rate limits on authentication routes. Encourage passwordless and Google login (no reusable password to stuff), and offer MFA for customers. Monitor the success ratio: a successful login from a new device followed by an address change and a high-value order is a takeover signal; step up verification (OTP) before shipping to a new address. Tell support what to expect.

</details>

**H2.** A customer asks ShopNorth to delete all their personal data, but tax law requires keeping invoices for years. How do you satisfy both?

<details>
<summary>Show answer</summary>

Separate **what must be kept** from **what identifies the person**. Delete or anonymize everything not legally required: account profile, saved addresses, marketing preferences, cart, browsing data, support chat transcripts (after any open issues close). For orders needed for tax and accounting, keep the financial record (invoice number, amounts, tax, date, items) and minimize personal fields to what the law requires on an invoice. Restrict access to these records, and delete them when the retention period ends. Delete in every copy: replicas and caches (immediately), search indexes, analytics stores, logs (which shouldn't contain PII in the first place), and backups (which age out on their schedule; document that). Record the request and its completion. Design for this early: a data inventory, PII-free logs, and customer data keyed by ID make deletion a job, not a project.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you secure a REST API with JWTs?"**

An identity provider like Auth0 issues short-lived access tokens through a standard flow. For a browser app, that's Authorization Code with PKCE. Every service acts as a resource server and validates the token locally: the signature against the issuer's published keys, plus issuer, audience, and expiry. Permissions from the token map to authorities for route-level checks. Then, inside the business logic, I enforce object-level authorization, for example that this order belongs to this customer, ideally in the query itself. Tokens are never trusted just because the gateway saw them. Each service verifies, and identity comes from the token, never from request parameters or headers the client controls.

</div>

<div class="callout-interview">

**Q: "What is IDOR, and how do you prevent it?"**

Insecure Direct Object Reference: the API uses an identifier from the request to load an object without checking that the caller may access it. Changing an order ID in the URL then shows someone else's order. Prevention: every query for a user-owned resource includes the owner condition, like findByIdAndCustomerId. Responses for objects you don't own are 404, so existence isn't revealed. Automated tests try cross-user access on every endpoint. Hard-to-guess IDs help as a second layer but are never the fix, because IDs leak through URLs, logs, and emails.

</div>

<div class="callout-interview">

**Q: "How do you handle payment provider webhooks securely?"**

I treat the webhook as untrusted input until it's proven genuine. I verify the provider's HMAC signature over the raw request body with a constant-time comparison, and reject old timestamps and repeated event IDs, which are stored with a unique constraint, to stop replays. Then I check the payload matches what we expect, meaning the right order, amount, and currency. For high-value or unusual cases, I confirm the payment status through the provider's API. Processing is idempotent, so legitimate retries are safe. A daily reconciliation against the provider's settlement report catches anything that slipped through.

</div>

> **Golden rule: authenticate at the edge, authorize at the data — and never trust anything the client or the internet sends you until it's verified.**

<div class="callout-journey">

➡️ **Next: [Chapter 8 · Testing — Unit to Regression](/tutorials/journey-08-testing)** — ShopNorth is built and secured, but nobody has *proven* it works. Meera takes over: unit tests, integration tests with real databases, contract tests, end-to-end tests, smoke tests, the regression suite, and a load test for the sale.

</div>
