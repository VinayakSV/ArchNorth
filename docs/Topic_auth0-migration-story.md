# Topic: `auth0-migration-story`
**Your interview gold — the PingOne → Auth0 migration, told for maximum impact.**

> This is the single most valuable story in your interview arsenal. It demonstrates: technical depth, scope of impact, leadership, working with ambiguity, real production stakes, and modern AI-assisted delivery. **Memorize the 90-second version. Internalize the deep-dive answers.**

---

## 📑 Table of Contents

1. [Why This Story Wins Interviews](#1-why-this-story-wins-interviews)
2. [The 90-Second Core Answer (Memorize This)](#2-the-90-second-core-answer-memorize-this)
3. [Full STAR Breakdown](#3-full-star-breakdown)
4. [Technical Deep-Dive: What Actually Happens in OAuth 2.0 + Auth0](#4-technical-deep-dive-what-actually-happens-in-oauth-20--auth0)
5. [Spring Security: The Pieces You Touched](#5-spring-security-the-pieces-you-touched)
6. [Likely Follow-up Questions (with Ideal Answers)](#6-likely-follow-up-questions-with-ideal-answers)
7. [The "How Did You Use AI?" Answer](#7-the-how-did-you-use-ai-answer)
8. [Common Pitfalls — What NOT to Say](#8-common-pitfalls--what-not-to-say)
9. [Adapting the Story for Different Audiences](#9-adapting-the-story-for-different-audiences)
10. [Your Personal Numbers Cheat Sheet (Fill This In)](#10-your-personal-numbers-cheat-sheet-fill-this-in)
11. [Practice Drills](#11-practice-drills)

---

## 1. Why This Story Wins Interviews

Most candidates with 9 years of experience tell stories about *features they built*. Those are forgettable. **Migrations are different.** A migration story automatically signals:

- ✅ **Production scale** — there's something real running, with users
- ✅ **Risk management** — zero-downtime requires planning, not just coding
- ✅ **Cross-team coordination** — auth touches every product
- ✅ **Security depth** — OAuth, JWT, RBAC are senior-level topics
- ✅ **Leadership without a title** — you owned a project end-to-end

When you say *"I led the migration of authentication from PingOne to Auth0 across multiple products serving 10+ global airline customers, with zero downtime"* — interviewers immediately mark you as senior. The job becomes yours to lose, not yours to win.

---

## 2. The 90-Second Core Answer (Memorize This)

> Practice this aloud until you can deliver it in 90 seconds without a script. Time yourself.

> *"At Jeppesen Foreflight — formerly Boeing — I led the end-to-end migration of our authentication system from PingOne to Auth0. The context was that PingOne was being phased out, and we had multiple products in production serving more than 10 global airline customers, all sharing the same authentication layer.*
>
> *The challenge was three-fold: we needed zero downtime because airline operations don't stop, we had to preserve our existing role-based access control across all customers, and we needed to maintain backwards compatibility for users who'd be authenticated through Auth0's database-based login providers but expected the same experience.*
>
> *I owned the technical design. I worked with Auth0's OAuth 2.0 flows, integrated them with Spring Security on the backend, mapped our existing roles into Auth0's permission model, and implemented a phased cutover so we could roll back at any point.*
>
> *I also leveraged Claude heavily during the migration — for generating boilerplate Spring Security configurations, exploring edge cases in token validation, and accelerating the test suite. But I made the architectural decisions myself — like choosing database-based login providers over social, deciding on the rollout sequence, and how to handle the role mapping.*
>
> *The result: we cut over with zero downtime, no customer-reported incidents, and the new system is more maintainable than what it replaced. The work also gave me a much deeper understanding of OAuth 2.0 and Spring Security internals — something I now use to mentor others on the team."*

**Why this works:**
- Opens with scope (10+ airlines)
- States the constraints clearly (zero downtime, RBAC preservation)
- Names specific tech (OAuth 2.0, Spring Security, Auth0)
- Demonstrates ownership ("I owned", "I made the decisions")
- Includes AI naturally — without making it the hero
- Ends with measurable result + personal growth

---

## 3. Full STAR Breakdown

### S — Situation (the *world* before you got involved)
- Multiple products in production at Jeppesen Foreflight (formerly Boeing India): Emissions Insights, FSRT, Fleet Team Digest
- Authentication powered by PingOne, which was being deprecated/phased out
- 10+ global airline customers depending on continuous availability
- Existing Role-Based Access Control mapping users to permissions across products

### T — Task (what specifically *you* were responsible for)
- Migrate authentication from PingOne to Auth0
- Achieve zero downtime
- Preserve all existing role mappings (RBAC) across all customers
- Maintain a seamless user experience — no forced password resets if avoidable
- Stay compatible with existing product code (minimize blast radius)

### A — Action (what you actually *did*)

This is where you get specific. Use this checklist when you tell the story — pick the 3 most relevant for the question:

1. **Discovery & design** — mapped existing PingOne auth flows, role models, and integration points. Documented the "as-is" before designing "to-be."
2. **OAuth 2.0 flow selection** — chose **database-based login providers** in Auth0 (instead of social/SSO) to preserve user identity continuity
3. **Spring Security integration** — configured Spring Security to validate Auth0-issued JWTs, mapped Auth0 claims to Spring `GrantedAuthority` for RBAC
4. **Role mapping** — defined how PingOne roles map to Auth0 roles + permissions, kept the application-side authorization logic unchanged
5. **Test strategy** — wrote integration tests covering each OAuth flow + token validation + role-based access. Used Claude to accelerate test scaffolding.
6. **Rollout strategy** — phased cutover so we could rollback if anything went wrong
7. **Stakeholder communication** — kept airline customer support, QA, and product owners aligned on timeline + risk
8. **AI-assisted execution** — used Claude for Spring Security boilerplate, OAuth edge case exploration, test generation. Reviewed and hardened all output.

### R — Result (what *changed* because of you)
- ✅ Zero downtime during cutover
- ✅ No customer-reported incidents post-migration
- ✅ Cleaner, more maintainable auth layer (Auth0 SDK is better-supported than PingOne)
- ✅ Set foundation for future SSO / social login if needed
- ✅ Personal: deeper Spring Security + OAuth 2.0 expertise that you now use to mentor others

---

## 4. Technical Deep-Dive: What Actually Happens in OAuth 2.0 + Auth0

You **must** be able to explain this on a whiteboard. Practice drawing it.

### The Authorization Code Flow with PKCE (the secure default)

```
┌──────────┐                                              ┌──────────┐
│   User   │                                              │  Auth0   │
│ Browser  │                                              │  Tenant  │
└────┬─────┘                                              └────┬─────┘
     │                                                         │
     │  1. Click "Login"                                       │
     ├────────────────► ┌──────────────┐                       │
     │                  │  Frontend    │                       │
     │                  │  (your app)  │                       │
     │                  └──────┬───────┘                       │
     │                         │                               │
     │   2. Redirect to Auth0  │                               │
     │ ◄───────────────────────┘                               │
     │                                                         │
     │   3. User authenticates against Auth0 (database conn.)  │
     ├────────────────────────────────────────────────────────►│
     │                                                         │
     │   4. Auth0 redirects back with `code` (one-time use)    │
     │ ◄───────────────────────────────────────────────────────┤
     │                                                         │
     │   5. Frontend posts `code` to backend                   │
     ├────────────────► ┌──────────────┐                       │
     │                  │   Backend    │                       │
     │                  │ (Spring Boot)│                       │
     │                  └──────┬───────┘                       │
     │                         │                               │
     │                         │  6. Backend exchanges         │
     │                         │     `code` for tokens         │
     │                         ├──────────────────────────────►│
     │                         │                               │
     │                         │  7. Auth0 returns:            │
     │                         │     - access_token (JWT)      │
     │                         │     - id_token (JWT)          │
     │                         │     - refresh_token           │
     │                         │ ◄─────────────────────────────┤
     │                         │                               │
     │                         │  8. Backend validates JWT     │
     │                         │     signature + claims        │
     │                         │  9. Maps roles → Spring       │
     │                         │     GrantedAuthority          │
     │                         │ 10. Returns session/cookie    │
     │ ◄───────────────────────┘                               │
```

### Key technical points to know

| Concept | What you say |
|---------|---------------|
| **Why JWT?** | Stateless, signed (HS256/RS256), self-contained — backend doesn't need to call Auth0 on every request |
| **Why RS256 over HS256?** | Asymmetric signing — backend only needs the public key (from Auth0's JWKS endpoint), the private signing key never leaves Auth0 |
| **What's in the JWT?** | Header (alg, kid) · Payload (sub, iss, aud, exp, iat, custom claims like roles) · Signature |
| **JWKS endpoint** | Auth0 publishes public keys at `/.well-known/jwks.json` — Spring Security fetches and caches these to validate signatures |
| **Token expiry** | Access token short-lived (e.g., 15 min); refresh token long-lived. Frontend uses refresh token to get new access token without re-login |
| **What did the database-based login providers give us?** | We owned the user credential store; no dependency on social SSO; consistent UX with prior PingOne setup |
| **How did you preserve RBAC?** | Mapped existing role values into Auth0 custom claims, then in Spring Security extracted those claims and converted to `GrantedAuthority` |

---

## 5. Spring Security: The Pieces You Touched

Be ready to draw or describe the Spring Security filter chain at this level:

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────┐
│  Spring Security Filter Chain               │
│                                             │
│  1. SecurityContextPersistenceFilter        │
│  2. CorsFilter                              │
│  3. CsrfFilter (or disabled for stateless)  │
│  4. BearerTokenAuthenticationFilter ◄── you │  
│        - extracts JWT from Authorization    │
│        - validates signature via JWKS       │
│        - validates exp, iss, aud claims     │
│  5. AuthorizationFilter                     │
│        - checks @PreAuthorize / hasRole()   │
│  6. ExceptionTranslationFilter              │
└─────────────────────────────────────────────┘
    │
    ▼
@RestController endpoint
```

### Code-level concepts you should be able to discuss

```java
// 1. Security configuration (Spring Security 6 / Spring Boot 3 style)
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                 // stateless API
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter())));
        return http.build();
    }

    // 2. Map Auth0 custom claim "https://yourapp/roles" → Spring authorities
    @Bean
    public Converter<Jwt, AbstractAuthenticationToken> jwtAuthConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<String> roles = jwt.getClaimAsStringList("https://yourapp/roles");
            return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .toList();
        });
        return converter;
    }
}

// 3. Use roles at the method level
@RestController
public class FlightController {
    @GetMapping("/admin/airlines")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Airline> listAirlines() { /* ... */ }
}
```

**Practice:** Without looking, write this config from scratch on paper. Then check. Repeat until you can explain every line.

---

## 6. Likely Follow-up Questions (with Ideal Answers)

### Q1: *"Why Auth0 over alternatives like Cognito, Okta, or building it yourself?"*
> *"PingOne was being phased out, so we needed a managed identity platform — building in-house was off the table given timeline and the regulatory environment around airline customer data. Between Auth0, Okta, and AWS Cognito: Auth0 had the best developer experience and Spring integration at the time, mature documentation for OAuth 2.0 flows, and supported database-based login providers which gave us continuity with our existing user model. Cognito had tighter AWS coupling that we didn't need at the time, and Okta's pricing model didn't fit our scale."*

### Q2: *"How did you achieve zero downtime?"*
> *"Three things. First, we built the new Auth0 path alongside the existing PingOne path with a feature flag — both flows could authenticate users at the same time. Second, we used a phased cutover by customer/product so any issue would only affect one segment. Third, we kept the rollback plan one config-flip away — flipping the flag back to PingOne would restore the previous flow without code redeploy."*

### Q3: *"What was the hardest technical challenge?"*
> *"Mapping the existing RBAC model into Auth0 custom claims while keeping the application-side authorization logic untouched. We had application code already coded against specific role names from PingOne, and changing every controller's `@PreAuthorize` annotations would have ballooned the blast radius. The solution was to do the role translation in the Auth0 → Spring Security `JwtAuthenticationConverter`, so application code stayed identical."*

### Q4: *"How did you test it?"*
> *"Three layers. Unit tests for the JWT converter and role mapping logic. Integration tests using `MockMvc` with stubbed JWTs covering each role permutation. End-to-end tests in a staging environment using a real Auth0 tenant with synthetic test users mirroring our customer set. I leveraged Claude to scaffold the test cases for permutations I might have missed — but I reviewed each before committing."*

### Q5: *"What's a gotcha you hit during the migration?"*
> *"Token expiry handling on the frontend. The previous PingOne setup had longer-lived access tokens, and our frontend assumed it could keep using the same token for hours. With Auth0's shorter access token + refresh token model, we had to refactor the frontend to handle token refresh transparently — otherwise users would see random 401s after 15 minutes."* (If your specifics differ, swap in your real gotcha — the structure is what matters.)

### Q6: *"How would you do this differently if you started over?"*
> *"I'd invest more upfront in observability. We had application-level logs, but no dedicated dashboard for auth-specific metrics — login success rate, token refresh latency, role-mapping errors. We added that after one customer-reported issue. If I started fresh, I'd build the metrics first."*

### Q7: *"What's the difference between authentication and authorization in your design?"*
> *"Authentication is Auth0's job — it verifies who the user is and issues a signed JWT. Authorization is Spring Security's job in our backend — it inspects the JWT's role claims, maps them to `GrantedAuthority`, and enforces method-level rules via `@PreAuthorize`. Auth0 could authenticate someone, but it's our backend that decides whether they're allowed to do anything specific."*

### Q8: *"How do you handle a stolen JWT?"*
> *"Three layers of defense. Short access token expiry — typically 15 minutes — limits exposure. The refresh token is single-use and rotates on each refresh. And Auth0 supports session revocation, so if we detect compromise, we can invalidate the user's refresh token, forcing re-authentication. We don't blacklist access tokens (that defeats statelessness) — we rely on short expiry instead."*

---

## 7. The "How Did You Use AI?" Answer

This question is now standard in 2026. Have a crisp 60-second answer:

> *"I used Claude as a senior pair programmer throughout the migration. Specifically: for generating Spring Security boilerplate — initial filter chain config, the JWT converter — I'd describe what I needed and review what came back. For exploring edge cases in token validation, I'd ask things like 'what are common JWT validation pitfalls' and use it as a checklist. And for test scaffolding, I'd describe a scenario and let it draft the test, then I'd refine and add cases it missed.*
>
> *What I did **not** delegate to AI: the architectural decisions — choosing database-based login providers, designing the role-mapping strategy, the rollout plan. Those required understanding our specific constraints, customers, and risk tolerance. I treat AI output as a PR I'm reviewing — every suggestion gets read and questioned before it lands."*

This answer demonstrates:
- ✅ You use modern tools fluently
- ✅ You review AI output (not blind trust)
- ✅ You make the human decisions
- ✅ You can articulate the boundary

---

## 8. Common Pitfalls — What NOT to Say

| ❌ Don't say | ✅ Say instead |
|-----------|--------------|
| *"It was easy because Auth0 has good docs"* | *"Auth0's documentation accelerated the work, but the real complexity was in our role-mapping and rollout strategy"* |
| *"AI did most of it"* | *"AI accelerated the boilerplate; I owned the architecture and final decisions"* |
| *"I'm not sure exactly how OAuth 2.0 works under the hood"* | If unsure, say: *"At a high level… let me draw it"* and walk through the flow chart |
| *"We had no problems"* | *"The biggest issue we hit was [X]. Here's how we solved it…"* — interviewers want to hear about challenges |
| *"I worked on the migration"* (passive) | *"I led the migration"* / *"I owned the design"* (active) |
| Naming specific user data or business sensitive info | Stay generic: *"airline customers"*, *"production users"* |

---

## 9. Adapting the Story for Different Audiences

### Technical interviewer (engineering manager, staff engineer)
- Lean into: Spring Security filter chain, JWT validation, JWKS, role-mapping code
- Show whiteboard fluency: draw the OAuth flow + the filter chain
- Mention specific Spring Security classes by name

### Behavioral interviewer (HR, hiring manager)
- Lean into: leadership, coordination with airline customers, risk management, communication
- Use phrases like: *"I owned"*, *"I led the design"*, *"I made the call to..."*
- Emphasize zero-downtime as a customer-impact outcome

### System design interviewer
- Lean into: architecture trade-offs, why JWT over session, why Auth0 over self-hosted, scaling considerations
- Be ready to extend: *"How would you scale this to 10,000 customers?"* → caching JWKS, regional Auth0 tenants, etc.

### Architect / principal interviewer
- Lean into: trade-off analysis, things you'd do differently, observability gaps you closed, mentoring junior team members through the work
- Show meta-thinking: *"In hindsight, the lesson was X"*

---

## 10. Your Personal Numbers Cheat Sheet (Fill This In)

> Print this. Keep it in your interview folder. Memorize the numbers.

| Metric | Your number |
|--------|-------------|
| Number of airline customers affected | _____ (10+, but get the real number) |
| Number of products integrated | _____ (Emissions Insights, FSRT, FTD = 3) |
| Approximate user count migrated | _____ |
| Total project duration (start to cutover) | _____ months |
| Team size on the migration | _____ (just you? plus QA? plus DevOps?) |
| Downtime during cutover | **0 minutes** ✅ |
| Customer-reported incidents post-migration | _____ (ideally 0 or 1 with mitigation story) |
| Lines of code touched (approx) | _____ |
| Number of OAuth flows implemented | _____ (likely 1 — Authorization Code with PKCE) |
| Year of completion | _____ |

**These numbers turn vague claims into concrete signals.** Even if approximate, *"around 5,000 users across 12 airline customers"* sounds 10x more credible than *"a lot of users."*

---

## 11. Practice Drills

### Drill 1: The 90-second pitch
- Set a timer
- Tell the 90-second answer out loud (record yourself on phone)
- Listen back. Cut filler. Tighten phrasing.
- Repeat until it's exactly 90 seconds and feels natural

### Drill 2: The whiteboard walk-through
- Draw the OAuth Authorization Code Flow from memory
- Draw the Spring Security filter chain from memory
- Speak the flow as you draw — not silently

### Drill 3: Anticipation
- Pick 3 random questions from [Section 6](#6-likely-follow-up-questions-with-ideal-answers)
- Answer each in 60–90 seconds, out loud, no notes
- Mark which you fumbled and re-drill those tomorrow

### Drill 4: Adapt on the fly
- Pick an audience from [Section 9](#9-adapting-the-story-for-different-audiences)
- Tell the same story tilted for that audience
- Notice which details you emphasize differently

### Drill 5: The "AI usage" pitch
- Practice the Section 7 answer until it's 60 seconds and confident
- Say it without sounding apologetic or defensive
- Own the modern workflow

---

## 🎯 When You're Done With This Topic

You should be able to:

- [ ] Deliver the 90-second core answer fluently, on cue
- [ ] Draw the OAuth Authorization Code Flow from memory
- [ ] Draw the Spring Security filter chain from memory
- [ ] Explain JWT structure, signing, and JWKS validation
- [ ] Answer all 8 follow-up questions in [Section 6](#6-likely-follow-up-questions-with-ideal-answers) without freezing
- [ ] Talk about AI usage confidently using the [Section 7](#7-the-how-did-you-use-ai-answer) frame
- [ ] Adapt the story for technical, behavioral, system design, and principal-level interviewers
- [ ] Cite at least 5 specific numbers about the project (users, customers, duration, products, etc.)

When all 8 boxes are checked, this story will carry you through 80% of senior backend interviews. ✅

---

## 🔗 Related Topics

When you're ready to deepen further, ask Claude to expand:
- `spring-security-filter-chain` — the framework details behind the migration
- `spring-jwt-oauth2` — the protocol and library specifics
- `story-ai-assisted` — your behavioral story about working with AI tools
- `sd-rate-limiter` — auth services often combine with rate limiting

---

**Final reminder:** This story isn't theoretical. You actually shipped it. The only work left is rehearsal.
