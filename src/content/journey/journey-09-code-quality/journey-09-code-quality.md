# Chapter 9 · Code Quality — SonarQube & Coverity

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 9 of 15 · Phase: **Quality** · SDLC stage: **Testing — code quality & review**

**Previously:** Meera built ShopNorth's test strategy: unit, integration, contract, E2E, smoke, a tagged regression suite, and load tests tied to the NFRs ([Chapter 8](/tutorials/journey-08-testing)).

**In this chapter:** Tests prove behavior. Now you add the checks tests can't do: code review, formatting, coverage, SonarQube's quality gate, Coverity's deep static analysis, and scanning of dependencies and secrets — and a clear policy for what blocks a merge.

</div>

## The Situation

Sprint 4, Thursday. All tests are green, and two problems still turned up:

- SonarQube flagged an admin product search that builds SQL by **concatenating user input** — a SQL injection waiting to be found.
- Coverity's nightly run reported a **resource leak** in the admin CSV export (a file writer that isn't closed when an exception is thrown) and a **data race** on a cached field in a singleton bean.

No test failed, because no test exercised those paths that way. "That's the point," Priya says. "Tests check what we thought of. Static analysis checks *every path*, including the ones nobody thought of."

## Step 1 — Layers of Defense

Each check runs where it's cheapest and fastest for the problem it finds:

| Where | Check | Catches |
|-------|-------|---------|
| **IDE** (as you type) | SonarQube for IDE (formerly SonarLint), formatter | Most issues before they're even committed |
| **Pre-commit hook** | Formatter, secret scan (gitleaks) | Formatting noise, accidentally committed keys |
| **Pull request pipeline** | Build, unit + integration tests, JaCoCo coverage, **SonarQube quality gate**, dependency scan, secret scan | Bugs, vulnerabilities, untested new code, known CVEs |
| **Human code review** | Teammates, CODEOWNERS | Design problems, wrong assumptions, unclear code |
| **Nightly / `main` branch** | **Coverity** deep analysis, DAST scan of staging (OWASP ZAP) | Complex defects across methods, runtime security issues |
| **Release** | SBOM, license check, image signing | Supply-chain and license risk |

## Step 2 — Code Review That Actually Helps

ShopNorth's pull request rules:

- **Small PRs** (ideally under ~400 changed lines). Reviewers find far more issues in small changes than in huge ones.
- **A template** that makes authors explain *what*, *why*, and *how it was tested*:

```markdown
## What and why
<!-- Link the story. What problem does this solve? -->

## How it was tested
- [ ] Unit / integration tests added or updated
- [ ] Ran locally against Docker Compose stack
- [ ] For bug fixes: a test that fails without this change

## Risk checklist
- [ ] Database migration is backward compatible (expand/contract)
- [ ] No secrets, no personal data in logs
- [ ] New endpoints have authorization checks and metrics
- [ ] Feature flag / rollback plan for risky changes
```

- **CODEOWNERS** puts the right people on sensitive code:

```text
# .github/CODEOWNERS
/payment-service/                  @shopnorth/payments-owners
/order-service/src/main/resources/db/migration/   @priya @arjun
/.github/workflows/                @kabir
```

- Payment code and migrations need **two approvals**. Everything else needs one.
- Reviewers comment on correctness, security, and design first; style is the formatter's job, not a human's.

<div class="callout-tip">

**AI review assistants** can do a useful first pass (missing null checks, unclear names, untested branches) before a human looks. At ShopNorth they comment but never approve; a human reviewer stays accountable for every merge. See [AI-SDLC](/tutorials/ai-sdlc).

</div>

## Step 3 — Formatting and Coverage

**Formatting** is automated so reviews never argue about it. The Spotless Maven plugin checks it in the build (`mvn spotless:check` fails the PR; `mvn spotless:apply` fixes it locally).

**Coverage** is measured with JaCoCo:

```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <executions>
    <execution><goals><goal>prepare-agent</goal></goals></execution>
    <execution>
      <id>report</id>
      <phase>verify</phase>
      <goals><goal>report</goal></goals>
    </execution>
  </executions>
</plugin>
```

SonarQube reads the JaCoCo report and gates on **coverage of new code**, not the whole codebase. Coverage tells you what code was *executed* by tests, not whether the tests checked anything. A test with no assertions gives 100% coverage and catches nothing — reviewers check the tests, too.

## Step 4 — SonarQube and the Quality Gate

SonarQube analyzes every pull request and reports:

| Category | Meaning | ShopNorth example |
|----------|---------|-------------------|
| **Bugs** (reliability) | Code that is likely wrong | `equals()` comparing unrelated types; ignored return value |
| **Vulnerabilities** | Code that is exploitable | SQL built from user input |
| **Security hotspots** | Security-sensitive code a human must review | A permissive CORS setting, a weak random generator |
| **Code smells** (maintainability) | Hard-to-change code | 200-line method, deep nesting |
| **Duplications** | Copy-pasted blocks | The same mapping code in three services |
| **Coverage** | Tested lines on new code | From JaCoCo |

The **quality gate** decides pass or fail. ShopNorth uses SonarQube's "Clean as You Code" approach: the conditions apply to **new code** in each PR, so the gate is strict without demanding a rewrite of everything that existed before.

| Quality gate condition (new code) | Threshold |
|----------------------------------|-----------|
| Reliability rating | A (no new bugs) |
| Security rating | A (no new vulnerabilities) |
| Security hotspots reviewed | 100% |
| Coverage | ≥ 80% |
| Duplicated lines | ≤ 3% |

In the pipeline, the scanner waits for the gate result and **fails the build** if it's red:

```bash
mvn -B verify org.sonarsource.scanner.maven:sonar-maven-plugin:sonar \
  -Dsonar.projectKey=shopnorth-order-service \
  -Dsonar.qualitygate.wait=true          # fail this step if the quality gate fails
# SONAR_HOST_URL and SONAR_TOKEN come from CI secrets
```

The SQL injection from this chapter's opening, and its fix:

```java
// ❌ Flagged as a vulnerability: user input concatenated into SQL
String sql = "SELECT sku, name FROM products WHERE name ILIKE '%" + term + "%'";
List<ProductRow> rows = jdbc.query(sql, PRODUCT_ROW);

// ✅ Parameterized: the term is data, never SQL
List<ProductRow> rows = jdbc.query(
        "SELECT sku, name FROM products WHERE name ILIKE ? ESCAPE '\\'",
        PRODUCT_ROW,
        "%" + escapeLikeWildcards(term) + "%");
```

## Step 5 — Coverity: Deep Static Analysis

SonarQube is fast enough to run on every PR. **Coverity** (now part of Black Duck) goes deeper: it follows values **across methods and classes**, along many execution paths, to find defects that only appear in specific combinations. It's common in enterprises, especially in regulated industries, and the free **Coverity Scan** service is available for open-source projects.

What it finds that simpler checks often miss:

| Coverity checker category | Example |
|---------------------------|---------|
| Resource leaks | A writer or connection not closed on an exception path |
| Null dereferences | A method that *can* return `null` three calls away, used without a check |
| Concurrency defects | A field read and written by many threads without consistent locking |
| Taint / injection flows | Input from an HTTP parameter reaching a SQL, shell, or path API |
| Integer issues | Overflow in a money calculation before it's checked |

Because a full analysis takes longer (tens of minutes for a service), ShopNorth runs it **nightly and on the `main` branch**, not on every PR:

```bash
# 1. Capture: build the code under Coverity's watch
cov-build --dir cov-int mvn -B -DskipTests package
# 2. Analyze: run the checkers, including web application security checks
cov-analyze --dir cov-int --all --webapp-security
# 3. Commit results to the Coverity server for triage
cov-commit-defects --dir cov-int --url "$COVERITY_URL" \
  --stream shopnorth-order-service --auth-key-file "$COVERITY_AUTH_KEY_FILE"
```

The two defects from the opening, fixed:

```java
// ❌ RESOURCE_LEAK: if writeRow throws, the writer is never closed
BufferedWriter out = Files.newBufferedWriter(exportPath);
for (Order order : orders) writeRow(out, order);
out.close();

// ✅ try-with-resources closes it on every path
try (BufferedWriter out = Files.newBufferedWriter(exportPath)) {
    for (Order order : orders) writeRow(out, order);
}
```

```java
// ❌ Data race: a singleton bean caching a value in a plain field, written by many request threads
private Map<String, Money> lastPrices = new HashMap<>();

// ✅ Thread-safe structure (or no shared mutable state at all)
private final Map<String, Money> lastPrices = new ConcurrentHashMap<>();
```

**Triage is part of the job.** Every new Coverity finding is classified in the Coverity web UI as *Bug* (fix it, with a severity and an owner), *False positive* (explain why, so the checker can be tuned), or *Intentional* (explain why it's safe). ShopNorth's policy: no new **high-impact** defects on `main`; a nightly finding becomes a ticket for the next day.

| | SonarQube | Coverity |
|--|-----------|----------|
| Speed | Fast — every PR | Slower — nightly / main |
| Depth | Rules on individual files and simple flows | Path-sensitive analysis across methods and classes |
| Best at | Maintainability, common bugs and vulnerabilities, coverage gates | Subtle reliability, concurrency, and security defects |
| Typical use | Developer feedback loop, quality gate | Safety net for critical code; compliance |

They complement each other; many enterprises run both.

## Step 6 — Dependencies, Containers, Secrets, and Runtime Scans

Most of ShopNorth's shipped code isn't written by ShopNorth — it's libraries.

- **Dependency scanning:** Dependabot alerts (or OWASP Dependency-Check / Snyk) on every PR; a new dependency with a critical known vulnerability (CVE) fails the build. Dependabot opens **update PRs** weekly, which the test suite validates.
- **SBOM (software bill of materials):** the CycloneDX Maven plugin produces a list of every library and version in each build. When the next big library vulnerability is announced, the team answers "are we affected, and where?" in minutes.
- **License policy:** shipped code may not include libraries with licenses the company hasn't approved (for example, strong copyleft licenses in a proprietary service).
- **Secret scanning:** gitleaks runs on every PR and as a pre-commit hook; GitHub push protection blocks known token formats.
- **Container image scanning:** Trivy scans every image before it's pushed (Chapter 10).
- **DAST:** an OWASP ZAP baseline scan runs against staging nightly, finding runtime issues like missing security headers.

## Step 7 — What Blocks a Merge?

| Check | Blocks the PR? |
|-------|----------------|
| Build, unit, integration, contract tests fail | ✅ Yes |
| Formatting check fails | ✅ Yes (auto-fixable) |
| SonarQube quality gate fails | ✅ Yes |
| New critical/high CVE in dependencies | ✅ Yes (or an approved, time-limited exception) |
| Secret detected | ✅ Yes — and rotate the secret |
| Missing required approvals (CODEOWNERS) | ✅ Yes |
| Coverity high-impact defect on `main` (nightly) | Not a PR block; becomes a next-day ticket and blocks the next release |
| Code smells on old code | ❌ No — fixed gradually (Boy Scout rule) |

A gate that blocks too much gets bypassed; a gate that blocks nothing gets ignored. Priya reviews the policy every quarter.

## Step 8 — Technical Debt, Deliberately

Code quality isn't zero issues; it's **controlled** issues. ShopNorth reserves about 15% of each sprint for technical debt, chosen by where the team feels pain (code that changes often and breaks often), not by the size of the SonarQube issue count. The rule for old code: leave it a little better whenever you touch it.

<!-- aws-section:start -->

## ☁️ ShopNorth on AWS — Infrastructure Code Gets Quality Gates Too

Terraform and SAM templates are code, so they go through the same pipeline: `terraform validate` and `cfn-lint` catch errors, **Trivy's misconfiguration scanner** (the same Trivy that scans images) flags risky settings like public buckets or wide-open security groups, and a `terraform plan` or CloudFormation change set is posted on the pull request for review. In ECR, enhanced scanning keeps checking images after they're pushed, so a vulnerability published next month still raises an alert ([CloudFormation, SAM & CDK](/tutorials/aws-cloudformation), [Containers on AWS](/tutorials/aws-containers)).

<!-- aws-section:end -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A company enforced "80% overall coverage" on a large legacy codebase. Teams couldn't reach it honestly, so they wrote tests that called methods without asserting anything. Coverage went up; bugs didn't go down. **Decision**: Gate on coverage of *new code* only (Clean as You Code), review test quality in code review, and run mutation testing (PIT) on the most critical modules — mutation testing changes the code slightly and checks that some test fails, which exposes assertion-free tests immediately.

</div>

<div class="callout-scenario">

**Scenario**: A critical remote-code-execution vulnerability was announced in a widely used logging library on a Friday evening. Companies without an inventory spent days grepping repositories and container images to find where it was used. **Decision**: Generate an SBOM for every build and store it with the image. When the next critical CVE appears, one query lists every affected service and version; Dependabot or a scripted update PR patches them, and the regular pipeline (tests, gates, canary) ships the fix within hours.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [Java Coding Standards](/tutorials/java-coding-standards) | Naming, structure, clean code rules | What reviewers and SonarQube enforce |
| [Exceptions](/tutorials/java-exceptions) | try-with-resources, exception handling | The resource-leak fix |
| [Multithreading](/tutorials/multithreading) · [ConcurrentHashMap](/tutorials/concurrent-hashmap) | Thread safety, safe publication | The data-race fix |
| [Auth & Security Decisions](/tutorials/auth-security-decisions) | Secure design | What security hotspots mean |
| [Docker Fundamentals](/tutorials/docker-fundamentals) | Image layers and security | Container image scanning |
| [AI-SDLC](/tutorials/ai-sdlc) | AI in reviews, with guardrails | AI first-pass review, human approval |
| [CloudFormation, SAM & CDK](/tutorials/aws-cloudformation) | Infrastructure as code, change sets, policy checks | Linting and reviewing infrastructure changes |

## 📚 Extra Case Studies

Quality practices applied to different systems: [How to Think in LLD](/tutorials/lld-thinking-framework) (designing code that stays maintainable), [Payment Gateway](/tutorials/payment-gateway) (why money code gets extra scrutiny), and [Fraud Detection System](/tutorials/fraud-detection-system) (auditability of decisions).

## 🛠️ Mini Project — Build ShopNorth, Step 9: Quality Gates

**Goal**: A repository where quality is enforced automatically. 2-3 evenings.

**Build**

1. Add Spotless (formatting) and JaCoCo (coverage) to your build.
2. Connect the repo to SonarQube (SonarCloud is free for public repositories, or run SonarQube Community Build in Docker) and set a "new code" quality gate.
3. Add a PR template and a CODEOWNERS file; protect `main` so PRs need a passing build and one approval.
4. Enable Dependabot alerts and version updates, add gitleaks to the workflow, and generate a CycloneDX SBOM in the build.
5. Optional: if your project is open source, register it with Coverity Scan and fix or triage what it finds.
6. Prove the gates: open PRs that (a) concatenate SQL, (b) add untested code, (c) commit a fake API key — each must be blocked.

**Acceptance criteria**: all three bad PRs are blocked automatically; a clean PR merges with a green gate; an SBOM is produced by the build.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Which check most likely catches each: (a) an AWS key in a commit, (b) a library with a known critical CVE, (c) a 300-line method, (d) a connection not closed on an error path three calls deep, (e) wrong business logic in a discount rule.

<details>
<summary>Show answer</summary>

(a) Secret scanning (gitleaks / push protection). (b) Dependency scanning (Dependabot, Dependency-Check, Snyk). (c) SonarQube (code smell / maintainability). (d) Coverity (path-sensitive resource leak analysis). (e) Tests and code review — static analysis can't know your business rules.

</details>

**L2.** Why does ShopNorth's quality gate apply to *new code* instead of the whole codebase?

<details>
<summary>Show answer</summary>

A whole-codebase gate on a project with existing issues either fails every PR (so people bypass it) or gets set so low it's meaningless. Gating new code means every change must meet the standard, so quality improves steadily as code is touched, without blocking work on a big cleanup. Old issues are fixed gradually where they cause pain.

</details>

### 🟡 Medium — Apply it

**M1.** Coverity reports a NULL_RETURNS defect: `catalog.findBySku()` may return `null`, and the result is used without a check. Arjun says the SKU always exists. How do you triage it?

<details>
<summary>Show answer</summary>

Check the claim against reality: can the SKU be deleted or deactivated between when it was added to the cart and now? Can an admin import create a cart line for a SKU that doesn't exist? If any path allows it, it's a real **bug**: fix it, preferably by changing the method to return `Optional<Product>` so callers must handle absence, and add a test. If it truly can't happen (e.g., a foreign key guarantees it and the method is only used on that path), mark it *Intentional* with the reasoning, and consider making the invariant explicit with an assertion or `Objects.requireNonNull` so the code documents it. Don't dismiss findings as false positives because "it never happened"; that's what Coverity is there to question.

</details>

**M2.** Write the review checklist you'd use for a pull request that adds a database migration.

<details>
<summary>Show answer</summary>

Is it backward compatible with the currently running app version (expand/contract)? Does it lock a large table (adding constraints without `NOT VALID`, indexes without `CONCURRENTLY`, column type rewrites)? Is it reversible, or is there a documented roll-forward plan? Has it been run against a production-sized copy if it touches big tables? Are backfills batched and throttled? Does the app code handle both old and new shapes during the rollout? Are new indexes justified by a named query? Is the migration file new (never editing one that already ran)? Does it need two approvals (CODEOWNERS)?

</details>

### 🔴 High — Think like a senior

**H1.** You inherit a service with 5,000 SonarQube issues and 30% coverage, and the team must keep shipping features. What's your plan?

<details>
<summary>Show answer</summary>

Don't stop to fix everything. (1) Turn on a **new code** quality gate immediately, so the numbers stop getting worse. (2) Fix all **vulnerabilities and high-severity bugs** first, as a short focused effort, because they're risk, not style. (3) Find **hotspots**: files that change often *and* break often (from git history and incident data); add characterization tests there and refactor gradually. (4) Leave cold code alone, even if it has many issues. (5) Reserve a fixed share of each sprint (~15%) for debt, and report progress in terms of incidents and delivery speed, not issue counts. (6) Add mutation testing to the most critical module so new tests are real tests.

</details>

**H2.** Three days before the sale, a critical CVE is announced in a library used by four ShopNorth services. Code freeze starts tomorrow. What do you do?

<details>
<summary>Show answer</summary>

**Assess fast:** use the SBOMs to find which services and versions are affected; read the advisory to see whether ShopNorth actually uses the vulnerable feature and whether the service is reachable by attackers (internet-facing vs internal). **Mitigate immediately** if exploitation is likely: WAF rules or configuration flags that disable the vulnerable feature. **Patch through the normal pipeline**, not around it: version bump PRs, full tests and quality gates, staging regression, canary release. Security fixes are an explicit exception to the code freeze, approved by the tech lead and product owner. **Communicate:** tell stakeholders the risk, the plan, and the timeline. **Verify:** confirm the new versions are deployed (SBOM of running images) and scan again. Then write down what slowed you down, for next time.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you ensure code quality in your team?"**

With layers, each automated where possible. Formatting and IDE analysis give instant feedback. Pull requests run the tests, JaCoCo coverage, and a SonarQube quality gate on new code: no new bugs or vulnerabilities, hotspots reviewed, at least 80% coverage on new code, and limited duplication. They also run dependency and secret scanning. Then there's human review with small PRs, a template, and CODEOWNERS for sensitive areas like payments and migrations. Deeper static analysis with Coverity runs nightly on the main branch, and findings are triaged the next day. Technical debt gets a fixed share of each sprint. The gates are strict but limited to things that matter, so nobody needs to bypass them.

</div>

<div class="callout-interview">

**Q: "What is a SonarQube quality gate, and how would you configure it?"**

A quality gate is a set of pass/fail conditions evaluated on each analysis; the CI pipeline waits for the result and fails the build if it doesn't pass. I configure it on new code. That means no new bugs or vulnerabilities, so reliability and security ratings stay at A. All new security hotspots must be reviewed, coverage on new code must be at least 80%, and duplicated lines must stay at 3% or less. Focusing on new code keeps the gate enforceable on legacy projects, and quality improves as code is touched. I also make sure the gate's result appears directly in the pull request, so developers see it where they work.

**Follow-up trap**: "Isn't 80% coverage arbitrary?" → Somewhat. It's a floor for *new* code, not a goal. What matters more is whether tests assert behavior; that's checked in review and, for critical code, with mutation testing.

</div>

<div class="callout-interview">

**Q: "Static analysis or tests — which is more important?"**

They catch different things, so you need both. Tests verify that the code does what we intended, including business rules that no analyzer can know. Static analysis examines every path without running the code. It finds what we didn't think to test: resource leaks on rare exception paths, null dereferences across methods, races on shared fields, and injection flows. Fast tools like SonarQube run on every PR; deeper ones like Coverity run nightly because they take longer. Neither replaces code review, which catches design problems and wrong assumptions.

</div>

> **Golden rule: automate every check a machine can do well, so humans can spend their review time on the things only humans can judge.**

<div class="callout-journey">

➡️ **Next: [Chapter 10 · Containerizing with Docker](/tutorials/journey-10-docker)** — The code is tested and clean. Sprint 5 begins: Kabir packages each service as a small, secure Docker image and gives every developer the whole ShopNorth stack with one command.

</div>
