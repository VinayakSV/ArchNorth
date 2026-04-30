# Vinayak's Interview Preparation Plan
**A focused, realistic plan tailored to your situation — built for steady wins, not heroic prep sessions.**

---

## 📌 About Me (Context for Any AI Assistant)

> Paste this section into Claude on your laptop whenever you start a new session — it gives the AI full context about you so the advice stays personalized.

- **Experience:** 9+ years as a Java backend engineer, currently Lead Software Engineer at Jeppesen Foreflight (formerly Boeing India).
- **Real strengths:** Java/Spring Boot, REST APIs, Auth0/OAuth 2.0/Spring Security, Redis, ETL optimization, micro-frontends (Module Federation), led PingOne→Auth0 migration, contributed to on-prem→Azure→AWS migration, Boeing IDEx Hackathon winner (2024) with XGBoost, daily AI-assisted development with Claude/Codex.
- **Weak spots I'm honest about:** DSA (close to zero), system design (only beginning), Java core fluency (rusty — I forget things under interview pressure), Docker (never used hands-on), Kubernetes (zero), AWS depth (I only know the services I touched on the job: EC2, ALB, Elastic Beanstalk, CloudWatch, CloudFormation).
- **Personal:** Married, one son. I get exhausted easily. I learn slowly when overloaded — I do best with **one topic at a time, written notes, calm focus**.
- **Current decision:** Considering a return to Boeing (referral via ex-colleague) vs. switching to a new company. Resume rejections have been ~90% — partly because the resume undersells me, partly real skill gaps.
- **My goal:** Crack interviews in 2026 — either back at Boeing or somewhere new — without burning out my family life.

---

## 🧭 How to Use This Document

1. **Don't read it all at once.** Pick one section per week.
2. **When you want any topic explained in depth**, open Claude on your laptop and say: *"Using my prep doc, expand `[topic-id]` for me with simple steps, examples, and 5 likely interview questions."* Topic IDs are listed in the [Topic Index](#-topic-index-for-claude-deep-dives).
3. **Update the [Progress Log](#-progress-log) as you finish topics** — momentum comes from seeing checkmarks, not from doing more.
4. **One rule above all:** if you can't do today's 30 minutes, do 5. Never zero. Streak > intensity.

---

## 📅 The 8-Week Plan at a Glance

| Week | Focus | Why this order | Daily target |
|------|-------|----------------|--------------|
| 1 | [SQL Reactivation](#week-1-sql-reactivation) | Fastest confidence win — fix the "second highest salary" gap | 2 LeetCode SQL easy/day |
| 2 | [Java Core Concepts](#week-2-java-core-concepts) | Reactivate what you already know; fluency, not new learning | 1 topic + write code by hand |
| 3 | [Java Concurrency](#week-3-java-concurrency) | You've used these — articulate them | 1 concept + explain out loud |
| 4 | [Spring Boot + Spring Security](#week-4-spring-boot--spring-security) | Connect your Auth0 work to the underlying framework | 1 topic + map to Auth0 work |
| 5 | [System Design — Foundations](#week-5-system-design--foundations) | hellointerview.com + your Zero-to-Architect site | 1 topic/day |
| 6 | [System Design — Real Problems](#week-6-system-design--real-problems) | Practice full designs out loud | 1 design problem/day |
| 7 | [DSA Bare Minimum](#week-7-dsa-bare-minimum) | Just enough — you're not targeting FAANG | 1 easy + 1 medium |
| 8 | [Mock Interviews + Docker/AWS Polish](#week-8-mock-interviews--dockeraws-polish) | Test under pressure, close last gaps | 3 mocks total + cloud notes |

**Total time commitment:** 30–45 minutes per day, 6 days a week. One day off (preferably Sunday).

---

## 🌅 Daily Routine (Non-Negotiable Rules)

- **30 minutes minimum, 45 maximum.** Going past 45 starts producing diminishing returns when you're tired.
- **No AI during prep time.** You're rebuilding muscle memory. Use AI all day at work — but during these 30 minutes, brain only.
- **Write code by hand or in a plain text editor.** Not in your IDE. The IDE autocomplete is what's eating your fluency.
- **Talk out loud for system design and behavioral practice.** Interview is a verbal medium. Silent reading does not transfer.
- **End every session with a 1-line note in your log:** *"What did I learn today?"* Three sentences max.
- **Sunday is rest.** Family time. No prep. This is how you avoid burnout — burnout is what's been killing your past attempts.

---

## 📄 Resume Strategy

You have two .docx files alongside this document:
- **`Vinayak_Varavate_Resume.docx`** — your polished, application-ready resume.
- **`Vinayak_Varavate_Resume_Template.docx`** — the same structure with placeholders so you can adapt for different roles later.

**Top 3 things this resume does that your previous one didn't:**
1. Surfaces the **Auth0 migration**, **AWS services you actually used**, **Spring Security**, and **AI-assisted development** — these were missing or buried before.
2. Lifts your **Boeing IDEx Hackathon win (XGBoost / ML)** into the summary — it's a major differentiator.
3. Adds a **Personal Projects** section featuring your `zero-to-architect` site — it shows initiative and modern AI fluency.

**Before sending the resume anywhere, do this:**
- Tailor the summary's last sentence to the specific role (e.g., "actively preparing system design and AWS deepening").
- For each job application, add 1 keyword from the JD into your skills list (only if you've actually touched it).
- Update LinkedIn with the same bullet points within 48 hours of editing the resume.

---

# 📚 The Detailed 8-Week Plan

---

## Week 1: SQL Reactivation
**Goal:** Never freeze on a SQL question again. By Friday you should be able to write the "Nth highest salary" query in under 2 minutes from memory.

### Topics to cover (30 min/day)
| Day | Topic | Topic ID |
|-----|-------|----------|
| Mon | SELECT, WHERE, ORDER BY, LIMIT, basic filtering | `sql-basics` |
| Tue | JOINs (INNER, LEFT, RIGHT, FULL), self-join | `sql-joins` |
| Wed | GROUP BY + aggregates (COUNT, SUM, AVG, MIN, MAX) + HAVING | `sql-aggregates` |
| Thu | Subqueries + CTEs (`WITH` clause) | `sql-subqueries-cte` |
| Fri | Window functions (`ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LAG`, `LEAD`) | `sql-window-functions` |
| Sat | Indexing & query optimization basics — connect to your ETL 40% improvement story | `sql-indexing` |

### The 12 must-know LeetCode SQL problems
1. Second Highest Salary
2. Nth Highest Salary
3. Rank Scores
4. Department Highest Salary
5. Employees Earning More Than Their Managers
6. Duplicate Emails
7. Customers Who Never Order
8. Combine Two Tables
9. Big Countries
10. Classes More Than 5 Students
11. Consecutive Numbers
12. Trips and Users

> **Use Claude later:** *"Expand `sql-window-functions` with the 5 most common interview patterns and a real-world example from ETL pipelines."*

---

## Week 2: Java Core Concepts
**Goal:** Be able to answer any "Tell me about HashMap internals" type question without freezing. You already know most of this — the goal is **fluency under pressure**.

### Topics to cover (30 min/day, one per day)
| Day | Topic | Topic ID |
|-----|-------|----------|
| Mon | OOP pillars + how Java actually implements them | `java-oop` |
| Tue | `equals()`, `hashCode()`, `==` vs `.equals()`, immutability | `java-equals-hashcode` |
| Wed | HashMap internals (buckets, hash, treeify, load factor, Java 8 changes) | `java-hashmap` |
| Thu | ArrayList vs LinkedList vs Vector — when and why | `java-collections-list` |
| Fri | String pool, `String` vs `StringBuilder` vs `StringBuffer` | `java-strings` |
| Sat | Exception handling — checked vs unchecked, try-with-resources | `java-exceptions` |
| Sun | REST | — |

### Bonus topics (if time on Sat)
- Generics, type erasure
- `final`, `static`, `transient`, `volatile` keywords
- Garbage collection basics (just enough to talk about it)

### Practice rule for the week
For each topic: **read 15 min → close everything → write a small code example by hand on paper or plain editor → explain it out loud as if to an interviewer.** This is the only thing that builds recall under interview pressure.

> **Use Claude later:** *"Expand `java-hashmap` step by step with diagrams and interview questions an interviewer at Boeing or a product company would ask."*

---

## Week 3: Java Concurrency
**Goal:** Confidently talk about the threading work you've actually done — `ThreadLocal`, `CompletableFuture`, `ExecutorService`. These are senior-level differentiators.

### Topics to cover
| Day | Topic | Topic ID |
|-----|-------|----------|
| Mon | Thread basics: `Thread`, `Runnable`, `Callable`, lifecycle | `java-thread-basics` |
| Tue | `ExecutorService`, thread pools, `Future` vs `CompletableFuture` | `java-executors` |
| Wed | `CompletableFuture` patterns — chaining, exception handling, `allOf`/`anyOf` | `java-completablefuture` |
| Thu | `ThreadLocal` — why you used it, alternatives, pitfalls | `java-threadlocal` |
| Fri | `synchronized`, `volatile`, `ReentrantLock`, atomic classes | `java-locks-atomics` |
| Sat | `ConcurrentHashMap`, `BlockingQueue`, common concurrency utilities | `java-concurrent-collections` |

### Practice rule
At the end of each day, write down **a 60-second story** about how you'd use this in production. Example for `CompletableFuture`: *"At Jeppesen, I used `CompletableFuture` to parallelize calls to multiple downstream services for the emissions API, reducing P95 latency from X to Y."* (Use real numbers if you have them, approximate if not.)

> **Use Claude later:** *"Expand `java-completablefuture` with the 7 most common patterns I should know and tie each to a backend use case."*

---

## Week 4: Spring Boot + Spring Security
**Goal:** Translate your Auth0 migration work into deep, articulate answers about Spring Security. This is where your senior experience really shines.

### Topics to cover
| Day | Topic | Topic ID |
|-----|-------|----------|
| Mon | Spring Boot auto-configuration, `@SpringBootApplication`, starters | `spring-boot-fundamentals` |
| Tue | Beans, scopes, lifecycle, `@Component`/`@Service`/`@Repository`, DI | `spring-beans-di` |
| Wed | `@Transactional`, propagation, isolation, common pitfalls | `spring-transactional` |
| Thu | Spring Security filter chain, authentication vs authorization | `spring-security-filter-chain` |
| Fri | OAuth 2.0 flows, JWT structure, JWT validation in Spring | `spring-jwt-oauth2` |
| Sat | Map your **PingOne→Auth0 migration** to every concept above. Write your "Auth0 migration story" — STAR format, 90 seconds. | [`auth0-migration-story`](./Topic_auth0-migration-story.md) |

### Your Auth0 migration story is interview gold
> 📄 **Full deep-dive document:** [Topic_auth0-migration-story.md](./Topic_auth0-migration-story.md) — 90-second answer, STAR breakdown, 8 follow-up Q&As, Spring Security code, practice drills.

By Saturday, write a **STAR-format answer** (Situation, Task, Action, Result) covering:
- **S:** PingOne was being deprecated; we had 10+ airline customers in production
- **T:** Migrate to Auth0 with zero downtime, preserve RBAC, no end-user disruption
- **A:** What you did technically — OAuth flows, Spring Security config, database-based login providers, rollout strategy, AI-assisted parts
- **R:** Zero downtime, X users migrated, [any other measurable outcome]

This single story will carry you through 80% of behavioral and technical-storytelling questions.

> **Use Claude later:** *"Help me rehearse `auth0-migration-story` — ask me 5 likely follow-up questions an interviewer would ask after this story."*

---

## Week 5: System Design — Foundations
**Goal:** Build the vocabulary. By end of week you should be able to fluently use terms like *"horizontal scaling, read replicas, eventual consistency, write-through cache, sticky sessions"* in conversation.

### Resources you're already set up with
- **Primary:** [hellointerview.com — System Design in a Hurry](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
- **Your own site:** [zero-to-architect](https://vinayaksv.github.io/zero-to-architect/) — keep improving it as you learn (it doubles as a portfolio piece)

### Topics to cover (1 per day)
| Day | Topic | Topic ID |
|-----|-------|----------|
| Mon | Scalability — vertical vs horizontal, stateless services | `sd-scalability` |
| Tue | Load balancing — L4 vs L7, ALB, sticky sessions | `sd-load-balancing` |
| Wed | Caching — read-through, write-through, write-behind, TTLs, Redis patterns | `sd-caching` |
| Thu | Database scaling — read replicas, sharding, partitioning | `sd-db-scaling` |
| Fri | Indexing & query performance — tie back to your ETL 40% improvement | `sd-indexing` |
| Sat | CAP theorem + consistency models — eventual, strong, read-your-writes | `sd-cap-consistency` |

> **Use Claude later:** *"Expand `sd-caching` with diagrams I can add to my zero-to-architect site, plus 5 interview questions."*

---

## Week 6: System Design — Real Problems
**Goal:** Solve full design problems out loud, end-to-end, in 30–35 minutes (real interview length).

### One design problem per day
| Day | Problem | Topic ID |
|-----|---------|----------|
| Mon | Design a URL shortener (bit.ly) | `sd-url-shortener` |
| Tue | Design a rate limiter | `sd-rate-limiter` |
| Wed | Design a news feed (Twitter/X home timeline) | `sd-news-feed` |
| Thu | Design a chat application (1:1 + group) | `sd-chat-app` |
| Fri | Design a notification service (email/SMS/push fanout) | `sd-notification-service` |
| Sat | Design a flight data ingestion + analytics platform (your domain advantage!) | `sd-flight-analytics` |

### How to practice each problem
1. Set a 35-minute timer.
2. Talk out loud (record yourself on phone if you can).
3. Cover: requirements → API design → data model → high-level architecture → deep dive on 1–2 components → bottlenecks & scaling.
4. After timer ends, watch the corresponding hellointerview.com walkthrough and note 3 things you missed.

> **Use Claude later:** *"Be my interviewer for `sd-url-shortener`. Ask me clarifying questions and challenge my design."*

---

## Week 7: DSA Bare Minimum
**Goal:** Stop being scared of coding rounds. You don't need LeetCode hard — you need the patterns that show up in 80% of senior backend interviews.

### Patterns to learn (1 per day, 1 easy + 1 medium each day)
| Day | Pattern | Topic ID |
|-----|---------|----------|
| Mon | Arrays + Two Pointers | `dsa-two-pointers` |
| Tue | Sliding Window | `dsa-sliding-window` |
| Wed | HashMap problems | `dsa-hashmap` |
| Thu | String manipulation | `dsa-strings` |
| Fri | Recursion + basic backtracking | `dsa-recursion` |
| Sat | BFS / DFS on Trees & Graphs (just basics) | `dsa-bfs-dfs` |

### Curated 12 problems that cover 80% of your interviews
1. Two Sum (HashMap)
2. Best Time to Buy and Sell Stock (single pass)
3. Valid Anagram (HashMap or sort)
4. Group Anagrams
5. Longest Substring Without Repeating Characters (sliding window)
6. Maximum Subarray (Kadane's)
7. Merge Intervals (sort + sweep)
8. Binary Tree Level Order Traversal (BFS)
9. Validate Binary Search Tree (DFS + bounds)
10. Number of Islands (DFS / BFS on grid)
11. Reverse Linked List
12. Merge Two Sorted Lists

### Rule
**Don't get stuck more than 25 minutes.** If stuck, read the solution, *understand* it, then re-write from scratch the next morning. Repetition > frustration.

> **Use Claude later:** *"Expand `dsa-sliding-window` with the template, the 5 most common variants, and how to recognize the pattern from a problem statement."*

---

## Week 8: Mock Interviews + Docker/AWS Polish
**Goal:** Test under real pressure. Close the last skill gaps you've been avoiding.

### Mock interview schedule
| Day | Activity | Topic ID |
|-----|----------|----------|
| Mon | Mock #1 — coding round (Pramp / interviewing.io) | `mock-coding` |
| Tue | Debrief Mock #1 + revise gaps | — |
| Wed | Mock #2 — system design round | `mock-system-design` |
| Thu | Debrief Mock #2 + revise | — |
| Fri | Mock #3 — behavioral / leadership round | `mock-behavioral` |
| Sat | Cloud + Docker polish (see below) | `cloud-docker-polish` |

### Docker — you'll learn the basics in 4 hours, one Saturday
| Concept | Topic ID |
|---------|----------|
| Images vs containers vs registries | `docker-fundamentals` |
| Writing a `Dockerfile` for a Spring Boot app | `docker-spring-boot` |
| `docker-compose` for multi-container local dev | `docker-compose` |
| Tag, push, pull workflow | `docker-registry` |

### AWS — articulate what you actually used
For each service below, prepare a **30-second answer**: *"I used [service] for [purpose] in the [project]. The reason we chose it was [X]. One challenge was [Y]."*
- EC2
- Application Load Balancer (ALB)
- Elastic Beanstalk
- CloudWatch
- CloudFormation

> **Use Claude later:** *"Quiz me on `docker-fundamentals` like an interviewer would — 10 questions in increasing difficulty."*

---

# 🎯 Behavioral Interview Prep (Run This in Parallel With Weeks 1–8)

Spend 15 minutes every Sunday writing one behavioral story in STAR format. By Week 8 you'll have 8 ready stories.

| Week | Story to write | Topic ID |
|------|---------------|----------|
| 1 | Auth0 migration (technical leadership) | [`story-auth0`](./Topic_auth0-migration-story.md) ← full doc ready |
| 2 | Boeing IDEx Hackathon win (innovation, ML) | `story-hackathon` |
| 3 | ETL 40% performance improvement (deep dive, optimization) | `story-etl-perf` |
| 4 | Cloud migration on-prem→Azure (large-scale change) | `story-azure-migration` |
| 5 | A time you mentored a junior dev | `story-mentorship` |
| 6 | A time you disagreed with a manager or PM | `story-conflict` |
| 7 | A time you used AI tools to ship something significant | `story-ai-assisted` |
| 8 | Surviving the layoff — adapting in uncertainty | `story-resilience` |

---

# 🤖 How to Talk About Gen AI in Interviews (2026 Special)

This is **the** differentiator most candidates fumble. You actually use Claude/Codex daily — own it.

### The 90-second answer template
> *"I treat AI tools as a senior pair programmer. For greenfield work, I let it scaffold then I review and harden. For complex changes, I drive the architecture decisions and use AI for boilerplate, test scaffolding, and exploring alternatives. For example, in my Auth0 migration, I used Claude to [specific task] but I made the [specific architectural decision] myself based on [specific reasoning]. The output of AI is only as good as the engineer reviewing it — I treat every AI suggestion as a PR that needs review."*

### What companies are scared of
- Engineers who blindly copy-paste AI output without reading it
- Engineers who can't debug without AI

### What companies want
- Engineers who *direct* AI confidently and review its output critically
- Engineers who use AI to ship 2–3x faster while maintaining quality

**You are already that engineer. Say it confidently.**

---

# 🏢 Boeing Return — Decision Framework

Before saying yes or no to the Boeing referral, answer these 5 questions in writing:

1. **Role substance:** Is the role hands-on engineering with growth, or pure maintenance? (If pure maintenance, similar to your current situation — pass.)
2. **Tech stack:** Is it modern (Java 17+, Spring Boot 3+, AWS, microservices) or legacy? (Legacy is fine if you're paid more and stable; not fine if you want to grow.)
3. **Team & manager:** Do you know the manager? Have you worked with them? (A known good manager is worth a lot.)
4. **Comp:** What's the salary delta vs. now? Is the bar low because they know you?
5. **Family fit:** Hours, location, on-call expectations.

**Default move:** Go to the interview anyway. You don't have to accept. Even a Boeing interview is interview practice — and it builds confidence, regardless of outcome.

**One important truth:** Returning to a former employer is **not** a step backward. It's how senior engineers compound their domain expertise. Boeing already knows you can do the work — that lowers the bar dramatically compared to interviewing cold elsewhere.

---

# 🧘 Anti-Burnout Rules (The Most Important Section)

Past attempts failed because of burnout, not lack of intelligence. These rules exist specifically to break that pattern.

1. **30 min/day max during weekdays.** Going harder doesn't work for you with a kid + full-time job. Tested and confirmed.
2. **Sundays off.** Family day. No prep. No guilt.
3. **No comparing yourself to people on LinkedIn.** They post wins, not failures. Most of them are also winging it.
4. **The "I forget things" feeling is normal.** It's anxiety, not a brain problem. Reps fix it. By Week 4 it'll be visibly better.
5. **One topic per day.** Not two. Not "let me also read about X." One.
6. **If you miss a day, restart, don't rewind.** Don't try to "make up" missed days — that's how the spiral starts.
7. **Tell your wife the plan.** Family support unlocks 2x energy. Hidden prep creates guilt.
8. **Celebrate small wins.** Crossed off Week 1? Tell someone. Got an interview? Tell someone. Self-acknowledgment matters.

---

# 📖 Resources

### Primary
- **System Design:** [hellointerview.com](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
- **Your portfolio site:** [zero-to-architect](https://vinayaksv.github.io/zero-to-architect/)
- **DSA practice:** [LeetCode](https://leetcode.com/) (free tier is enough)
- **SQL practice:** [LeetCode SQL 50](https://leetcode.com/studyplan/top-sql-50/)
- **Mock interviews:** [Pramp](https://www.pramp.com/) (free, peer-to-peer), [interviewing.io](https://interviewing.io/) (paid, real engineers)

### Secondary (use only if you have time)
- **Java:** *Effective Java* by Joshua Bloch (read items 1–20, skip the rest for interview prep)
- **Concurrency:** *Java Concurrency in Practice* (reference only — don't read cover to cover)
- **Spring:** Official Spring Boot reference (jump in only when you need a specific topic)

### What NOT to use
- ❌ "Crack the Coding Interview" — too FAANG-focused for your target
- ❌ Random YouTube playlists — too inconsistent, eats time
- ❌ Multiple courses at once — pick one source per topic, stick to it

---

# 📊 Progress Log

> Use checkboxes. Marking ✅ is the entire psychological game.

### Week 1: SQL
- [ ] Mon — `sql-basics`
- [ ] Tue — `sql-joins`
- [ ] Wed — `sql-aggregates`
- [ ] Thu — `sql-subqueries-cte`
- [ ] Fri — `sql-window-functions`
- [ ] Sat — `sql-indexing`
- [ ] LeetCode SQL 50 — first 12 problems done

### Week 2: Java Core
- [ ] Mon — `java-oop`
- [ ] Tue — `java-equals-hashcode`
- [ ] Wed — `java-hashmap`
- [ ] Thu — `java-collections-list`
- [ ] Fri — `java-strings`
- [ ] Sat — `java-exceptions`

### Week 3: Java Concurrency
- [ ] Mon — `java-thread-basics`
- [ ] Tue — `java-executors`
- [ ] Wed — `java-completablefuture`
- [ ] Thu — `java-threadlocal`
- [ ] Fri — `java-locks-atomics`
- [ ] Sat — `java-concurrent-collections`

### Week 4: Spring Boot + Security
- [ ] Mon — `spring-boot-fundamentals`
- [ ] Tue — `spring-beans-di`
- [ ] Wed — `spring-transactional`
- [ ] Thu — `spring-security-filter-chain`
- [ ] Fri — `spring-jwt-oauth2`
- [ ] Sat — [`auth0-migration-story`](./Topic_auth0-migration-story.md) (full doc exists — read, rehearse drills, fill in numbers)

### Week 5: System Design Foundations
- [ ] Mon — `sd-scalability`
- [ ] Tue — `sd-load-balancing`
- [ ] Wed — `sd-caching`
- [ ] Thu — `sd-db-scaling`
- [ ] Fri — `sd-indexing`
- [ ] Sat — `sd-cap-consistency`

### Week 6: System Design Problems
- [ ] Mon — `sd-url-shortener`
- [ ] Tue — `sd-rate-limiter`
- [ ] Wed — `sd-news-feed`
- [ ] Thu — `sd-chat-app`
- [ ] Fri — `sd-notification-service`
- [ ] Sat — `sd-flight-analytics`

### Week 7: DSA
- [ ] Mon — `dsa-two-pointers`
- [ ] Tue — `dsa-sliding-window`
- [ ] Wed — `dsa-hashmap`
- [ ] Thu — `dsa-strings`
- [ ] Fri — `dsa-recursion`
- [ ] Sat — `dsa-bfs-dfs`

### Week 8: Mocks + Polish
- [ ] Mon — `mock-coding`
- [ ] Wed — `mock-system-design`
- [ ] Fri — `mock-behavioral`
- [ ] Sat — `docker-fundamentals` + `docker-spring-boot` + `docker-compose` + AWS service stories

### Behavioral stories (write 1 per Sunday)
- [ ] [`story-auth0`](./Topic_auth0-migration-story.md) ← document already complete — do the drills
- [ ] `story-hackathon`
- [ ] `story-etl-perf`
- [ ] `story-azure-migration`
- [ ] `story-mentorship`
- [ ] `story-conflict`
- [ ] `story-ai-assisted`
- [ ] `story-resilience`

---

# 🗂 Topic Index (For Claude Deep Dives)

When you want a topic explained in detail, open Claude on your laptop and use this exact prompt:

```
I'm preparing for senior Java backend interviews. I have 9+ years experience but I learn best with simple, step-by-step explanations and real interview-style examples.

Please expand topic [TOPIC-ID] for me with:
1. A simple, intuitive explanation (assume I'm rusty, not new)
2. The 3–5 most important things to remember
3. A small code example I can run
4. The 5 most common interview questions and ideal answers
5. How this connects to my real work (Auth0 migration, ETL pipeline, Azure→AWS migration, micro-frontends, or XGBoost hackathon — pick whichever fits)

Keep it under 1500 words. I'd rather have depth on the essentials than breadth on edge cases.
```

### All topic IDs (copy-paste friendly)

**SQL:** `sql-basics` · `sql-joins` · `sql-aggregates` · `sql-subqueries-cte` · `sql-window-functions` · `sql-indexing`

**Java Core:** `java-oop` · `java-equals-hashcode` · `java-hashmap` · `java-collections-list` · `java-strings` · `java-exceptions`

**Java Concurrency:** `java-thread-basics` · `java-executors` · `java-completablefuture` · `java-threadlocal` · `java-locks-atomics` · `java-concurrent-collections`

**Spring:** `spring-boot-fundamentals` · `spring-beans-di` · `spring-transactional` · `spring-security-filter-chain` · `spring-jwt-oauth2` · [`auth0-migration-story`](./Topic_auth0-migration-story.md)

**System Design Foundations:** `sd-scalability` · `sd-load-balancing` · `sd-caching` · `sd-db-scaling` · `sd-indexing` · `sd-cap-consistency`

**System Design Problems:** `sd-url-shortener` · `sd-rate-limiter` · `sd-news-feed` · `sd-chat-app` · `sd-notification-service` · `sd-flight-analytics`

**DSA:** `dsa-two-pointers` · `dsa-sliding-window` · `dsa-hashmap` · `dsa-strings` · `dsa-recursion` · `dsa-bfs-dfs`

**Mocks & Polish:** `mock-coding` · `mock-system-design` · `mock-behavioral` · `docker-fundamentals` · `docker-spring-boot` · `docker-compose` · `docker-registry` · `cloud-docker-polish`

**Behavioral Stories:** `story-auth0` · `story-hackathon` · `story-etl-perf` · `story-azure-migration` · `story-mentorship` · `story-conflict` · `story-ai-assisted` · `story-resilience`

---

# 💬 Final Note to Yourself

You are a Lead Software Engineer with 9+ years of production experience, an Auth0 migration under your belt, an ML hackathon win, and survival through a major layoff. You are not a "waste person." The story in your head is wrong.

The reason past prep attempts failed wasn't lack of ability — it was trying to do too much, too fast, while burned out. This plan fixes that. **30 minutes a day. One topic. Six days a week. Eight weeks. That's it.**

Whether you go back to Boeing or break into a new company, the only thing that determines the outcome is whether you do today's 30 minutes.

Start with `sql-basics` tomorrow morning. Just 30 minutes. Then close the laptop and go play with your son.

You've got this.
