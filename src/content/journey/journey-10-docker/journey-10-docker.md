# Chapter 10 · Containerizing with Docker

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 10 of 15 · Phase: **Ship** · SDLC stage: **Deployment — packaging**

**Previously:** ShopNorth's code is tested (Chapter 8) and guarded by review, SonarQube, Coverity, and dependency and secret scanning ([Chapter 9](/tutorials/journey-09-code-quality)).

**In this chapter:** Sprint 5. Kabir packages every service as a small, secure Docker image that runs the same way on a laptop, in CI, and in production — and gives the team the whole ShopNorth stack with one command.

</div>

## The Situation

A new contractor joins to help with the admin pages. Setting up her laptop takes a day and a half: the wrong Java version, PostgreSQL 14 instead of 16, a Kafka install that wouldn't start, and a Redis config copied from a wiki page that was out of date. On her second day, an integration test passes on her machine and fails in CI.

Kabir decides: "From today, the environment is code. If it isn't in the Dockerfile or the Compose file, it doesn't exist."

## Step 1 — A Production-Grade Image for the Order Service

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Build stage: full JDK + Maven, thrown away afterwards ----------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
# Download dependencies first: this layer is cached until pom.xml changes
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -DskipTests \
 && java -Djarmode=tools -jar target/order-service.jar extract --layers --launcher --destination extracted

# ---------- Runtime stage: JRE only, non-root, layered for fast rebuilds ----------
FROM eclipse-temurin:21-jre
RUN groupadd --system app && useradd --system --gid app --no-create-home app
WORKDIR /app
COPY --from=build /src/extracted/dependencies/ ./
COPY --from=build /src/extracted/spring-boot-loader/ ./
COPY --from=build /src/extracted/snapshot-dependencies/ ./
COPY --from=build /src/extracted/application/ ./
USER app
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

Every line has a reason:

| Choice | Why |
|--------|-----|
| **Multi-stage build** | The JDK, Maven, and source code stay in the build stage; the shipped image contains only a JRE and the app (~210 MB instead of ~680 MB) |
| **Dependencies before source** | Changing one Java file rebuilds only the last layers; the dependency download is cached |
| **Layered jar extraction** (Spring Boot 3.3+ `jarmode=tools`) | Libraries (big, rarely change) and your classes (small, change every build) are separate layers, so pushes and pulls move only a few MB |
| **Pinned base image tag** (`21-jre`) | Predictable; the pipeline pins by digest for production builds |
| **Non-root user** | If the app is compromised, the attacker isn't root inside the container |
| **`MaxRAMPercentage=70`** | The JVM sizes its heap from the container's memory limit, leaving room for metaspace, threads, and buffers |
| **`ExitOnOutOfMemoryError`** | A JVM in a broken state exits, and Kubernetes restarts it, instead of limping along |
| **Exec-form `ENTRYPOINT`** | Java is PID 1 and receives `SIGTERM` directly, so Spring's graceful shutdown runs on deploys (Chapter 12) |

And a `.dockerignore`, so the build context stays small and secrets never enter it:

```text
target/
.git/
.idea/
*.iml
.env
*.log
```

## Step 2 — Build, Tag, Scan

```bash
GIT_SHA=$(git rev-parse --short HEAD)

docker build -t shopnorth/order-service:"$GIT_SHA" \
  --label org.opencontainers.image.revision="$GIT_SHA" \
  --label org.opencontainers.image.source="https://github.com/shopnorth/order-service" .

# Fail if the image has HIGH or CRITICAL vulnerabilities that have a fix available
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 shopnorth/order-service:"$GIT_SHA"
```

Images are tagged with the **Git commit SHA** — immutable and traceable. "Which code is running in production?" is answered by reading the image tag. Nobody deploys `latest`.

## Step 3 — The Whole Stack With One Command

```yaml
# docker-compose.yml (in the platform repository)
name: shopnorth

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shopnorth
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-localdev}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro   # creates orders, inventory, catalog DBs
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shopnorth"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  kafka:
    image: apache/kafka:3.8.0
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093,HOST://:29092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,HOST://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT,HOST:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    ports: ["29092:29092"]          # apps in your IDE connect to localhost:29092
    healthcheck:
      test: ["CMD-SHELL", "/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 > /dev/null 2>&1"]
      interval: 10s
      retries: 10

  mailpit:                           # catches every email the app sends; web UI on :8025
    image: axllent/mailpit
    ports: ["8025:8025", "1025:1025"]

  payment-sandbox:                   # WireMock playing the payment provider, with recorded responses
    image: wiremock/wiremock:3.9.1
    volumes:
      - ./infra/payment-sandbox:/home/wiremock:ro
    ports: ["8089:8080"]

  order-service:
    build: ../order-service
    profiles: ["full"]               # only started with --profile full
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/orders
      DB_USERNAME: shopnorth
      DB_PASSWORD: ${POSTGRES_PASSWORD:-localdev}
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:9092
      INVENTORY_URL: http://inventory-service:8080
    ports: ["8081:8080"]
    depends_on:
      postgres: { condition: service_healthy }
      kafka:    { condition: service_healthy }

  inventory-service:
    build: ../inventory-service
    profiles: ["full"]
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/inventory
      DB_USERNAME: shopnorth
      DB_PASSWORD: ${POSTGRES_PASSWORD:-localdev}
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:9092
    ports: ["8082:8080"]
    depends_on:
      postgres: { condition: service_healthy }
      kafka:    { condition: service_healthy }

volumes:
  pgdata:
```

Two ways the team uses it:

```bash
# 1. Infrastructure only — run the service you're working on in your IDE, with debugging
docker compose up -d postgres redis kafka mailpit payment-sandbox

# 2. Everything in containers — e.g., to try the whole checkout flow, or for the frontend team
docker compose --profile full up -d --build

docker compose logs -f order-service    # follow one service's logs
docker compose down                     # stop (data kept in the pgdata volume)
docker compose down -v                  # stop and wipe all data — a fresh start
```

The contractor's next laptop setup takes 20 minutes: install Docker and a JDK, clone, `docker compose up`.

<div class="callout-tip">

**`depends_on` with `condition: service_healthy`** waits for PostgreSQL and Kafka to actually accept connections, not just for their containers to start. Without the health conditions, services race their databases on every startup and fail randomly.

</div>

## Step 4 — The Same Images Everywhere

| Environment | How ShopNorth runs |
|-------------|--------------------|
| Laptop | Docker Compose (this chapter) |
| Integration tests | Testcontainers starts the same PostgreSQL and Kafka images per test run (Chapter 8) |
| CI pipeline | Builds the image once, scans it, pushes it with the commit SHA tag (Chapter 11) |
| Staging and production | Kubernetes runs *that same image* — only configuration differs (Chapter 12) |

**Build once, deploy many.** The image that passed the tests in staging is byte-for-byte the image that runs in production. Rebuilding per environment would mean shipping something that was never tested.

<!-- aws-section:start -->

## ☁️ ShopNorth on AWS — Where the Images Live

The images built in this chapter are pushed to **Amazon ECR** in the `shared` account: one repository per service, **immutable tags** (the commit SHA), enhanced vulnerability scanning, a lifecycle policy that keeps the last 50 images, a **pull-through cache** for base images (no Docker Hub rate limits during scale-out), and replication to Hyderabad for disaster recovery. Staging and production pull with read-only permissions ([Containers on AWS](/tutorials/aws-containers)).

<!-- aws-section:end -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A team's integration tests passed on developers' laptops but failed in CI about once a week. Laptops had PostgreSQL 14 installed natively; CI used 16; a query relied on behavior that differed between them. Days were lost to "works on my machine" debugging. **Decision**: Every dependency version is pinned in code — the Compose file for local work and Testcontainers images for tests — and matches production's major version. The environment is reviewed in pull requests like any other change.

</div>

<div class="callout-scenario">

**Scenario**: A developer's Dockerfile used `COPY . .` and the repository folder contained a `.env` file with a production database password. The image was pushed to a registry that was accidentally public; anyone could pull it and read the password from the image layers — deleting the file in a later layer doesn't remove it. **Decision**: A `.dockerignore` excludes `.env` and other local files; secrets are never part of an image and are injected at runtime (Chapter 12); registries are private by default; and Trivy's secret scanning runs on every image. The leaked password was rotated immediately.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [Docker Fundamentals](/tutorials/docker-fundamentals) | Images, layers, caching, networking, security | Layer ordering, non-root user, scanning |
| [Dockerizing a Spring Boot App](/tutorials/docker-spring-boot) | Layered jars, JVM memory, graceful shutdown | The order-service Dockerfile |
| [Docker Compose](/tutorials/docker-compose) | Multi-container apps, health checks, profiles | The one-command ShopNorth stack |
| [Apache Kafka Deep Dive](/tutorials/kafka-deep-dive) | Brokers, listeners, KRaft | The single-node Kafka for local development |
| [Containers on AWS](/tutorials/aws-containers) | ECR, ECS, EKS, Fargate | ECR repositories, immutable SHA tags, pull-through cache |

## 📚 Extra Case Studies

Containers in other systems: [Data Ingestion Platform](/tutorials/data-ingestion-platform) (worker containers scaled by queue depth) and [Live Streaming Platform](/tutorials/live-streaming-platform) (large container fleets that must start fast at a known time).

## 🛠️ Mini Project — Build ShopNorth, Step 10: Containers

**Goal**: Your mini ShopNorth starts with one command on any machine. 2 evenings.

**Build**

1. Write the multi-stage Dockerfile for your order service; add `.dockerignore`.
2. Measure: image size, rebuild time after changing one Java file, and startup time. Compare against a naive single-stage Dockerfile.
3. Write a Compose file with PostgreSQL, Kafka, Mailpit, a WireMock payment sandbox, and your services under a `full` profile, with health-check conditions.
4. Scan your image with Trivy and fix any HIGH/CRITICAL findings that have fixes.
5. Clone your repo into a new folder (or ask a friend) and time "clone to running checkout".

**Acceptance criteria**: `docker compose --profile full up` brings everything up healthy; the image runs as non-root; a one-line code change rebuilds in seconds, not minutes.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why does the Dockerfile copy `pom.xml` and download dependencies *before* copying `src`?

<details>
<summary>Show answer</summary>

Docker caches each layer and reuses it until something it depends on changes. Dependencies change rarely; source code changes on every commit. Copying `pom.xml` first and downloading dependencies creates a layer that stays cached across code changes, so a typical rebuild skips the slow download and only recompiles. If `src` were copied first, every code change would invalidate the cache and re-download everything.

</details>

**L2.** Why tag images with the Git commit SHA instead of `latest`?

<details>
<summary>Show answer</summary>

`latest` is a moving pointer: two deployments of `latest` can run different code, rollbacks are ambiguous, and you can't tell what's running. A SHA tag is immutable and traceable: it points to exactly one build of exactly one commit, so you can see what's deployed, roll back to a known version, and link any production issue to the code that caused it. Production deployments go further and pin the image **digest**.

</details>

### 🟡 Medium — Apply it

**M1.** In Kubernetes, the order-service pod has a 1 GiB memory limit and keeps getting `OOMKilled`, while the Java heap graphs look fine. What's happening, and how do you fix it?

<details>
<summary>Show answer</summary>

The container's limit covers **all** memory the process uses: heap, plus metaspace, thread stacks (each thread ~1 MB), direct buffers (Netty, Kafka clients), code cache, and GC overhead. If the heap is sized close to the limit (e.g., `-Xmx1g`, or a percentage that's too high), the total exceeds 1 GiB and the kernel kills the process — the heap graph never shows it. Fix: size the heap as a percentage of the limit (`MaxRAMPercentage` around 60-75%), measure resident memory (RSS) under load, limit thread pools, and raise the limit if the real working set needs it. Keep `ExitOnOutOfMemoryError` so true heap exhaustion restarts cleanly.

</details>

**M2.** Should CI run the API regression tests against Docker Compose, or should each test use Testcontainers?

<details>
<summary>Show answer</summary>

Both have a place. **Testcontainers** suits integration tests inside one service's build: each test class controls its own containers, they start fresh, and they run anywhere JUnit runs. **Docker Compose** suits multi-service API tests in CI: build all images once, start the stack, run the API regression suite against it, then tear down — closer to how services interact for real. Many teams use Testcontainers for per-service tests and a Compose (or ephemeral Kubernetes namespace) environment for cross-service regression.

</details>

### 🔴 High — Think like a senior

**H1.** The security team requires that production images contain no shell and as few packages as possible. How do you get there, and what do you lose?

<details>
<summary>Show answer</summary>

Switch the runtime stage to a **distroless** or minimal base (e.g., a distroless Java image, or a Chainguard-style minimal JRE image): no shell, no package manager, far fewer CVEs. Alternatively, build a custom runtime with `jlink` containing only the JDK modules the app needs. **What you lose:** `docker exec … sh` and `kubectl exec` debugging — so prepare alternatives: Kubernetes ephemeral debug containers (`kubectl debug`), good logs, metrics, traces, and JFR (Java Flight Recorder) recordings triggered remotely. Health checks can't use `curl` inside the image; Kubernetes HTTP probes don't need it. Test startup, TLS certificates, and time zone data, which minimal images sometimes omit.

</details>

**H2.** Builds take 12 minutes in CI even though they take 2 minutes on a laptop. Find and fix the causes.

<details>
<summary>Show answer</summary>

CI runners usually start with an **empty cache**, so every build re-downloads dependencies and rebuilds every layer. Fixes: (1) use BuildKit with a **registry-backed cache** (`--cache-from`/`--cache-to type=registry`) or the CI system's cache for Docker layers; (2) keep the Maven repository cache between runs (cache mount or CI cache keyed on `pom.xml`); (3) make sure layer order is right (dependencies before source); (4) don't run tests inside `docker build` if CI already ran them — build the image from the tested artifact; (5) build images for multiple services in parallel; (6) check runner size — CPU-starved runners make compilation slow. Measure each step's time before and after.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How would you containerize a Spring Boot service for production?"**

I use a multi-stage Dockerfile. A JDK build stage downloads dependencies first, for caching, then builds the jar. The runtime stage uses only a pinned JRE base image and copies the extracted layered jar, so dependencies and application classes are separate layers and code changes ship as small layers. The app runs as a non-root user with an exec-form entrypoint, so Java receives SIGTERM and graceful shutdown works. The heap is sized as a percentage of the container memory limit. Secrets are never baked in; they come at runtime. Images are tagged with the commit SHA, scanned with Trivy in CI, and the same image is promoted from staging to production.

</div>

<div class="callout-interview">

**Q: "What's the role of Docker Compose if production runs on Kubernetes?"**

Compose is the developer and CI tool, not the production one. It gives every developer the full dependency stack, with databases, Kafka, Redis, a fake payment provider, and a mail catcher, at pinned versions, with one command and health-checked startup order. That removes laptop setup time and works-on-my-machine bugs. In CI, it can run a multi-service stack for API regression tests. Production uses Kubernetes for scheduling, scaling, rolling updates, and self-healing, but it runs the same images.

</div>

<div class="callout-interview">

**Q: "What does build once, deploy many mean, and why does it matter?"**

You build an artifact, here a container image, exactly once per commit, test it, and then promote that same immutable artifact through staging to production, changing only configuration such as environment variables, config maps, and secrets. If you rebuild for each environment, the thing in production was never actually tested. Dependency versions, base image patches, or build flags could differ. Immutable SHA-tagged images make deployments reproducible and rollbacks trivial: redeploy the previous tag.

</div>

> **Golden rule: if the environment isn't defined in code, every machine is a different environment. Package the app and its world once, and run that same package everywhere.**

<div class="callout-journey">

➡️ **Next: [Chapter 11 · CI/CD Pipeline](/tutorials/journey-11-cicd)** — Kabir connects everything you've built so far — tests, quality gates, scans, images — into one pipeline that takes a pull request all the way to production, with smoke tests, a regression run, approval, and a canary release.

</div>
