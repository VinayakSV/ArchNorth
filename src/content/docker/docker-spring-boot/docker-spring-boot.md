# Dockerizing a Spring Boot App — Production Grade

> A complete, practical guide to containerizing Spring Boot applications — from choosing the right base image to production-ready multi-stage builds with optimal caching, JVM tuning, security hardening, and real-world deployment patterns.

---

## Table of Contents

1. [What "Dockerizing" Actually Means](#1-what-dockerizing-means)
2. [Choosing the Right Base Image](#2-choosing-the-right-base-image)
3. [Fat JAR vs Layered JAR](#3-fat-jar-vs-layered-jar)
4. [Building the Layered JAR](#4-building-the-layered-jar)
5. [Single-Stage Dockerfile — The Naive Approach](#5-single-stage-dockerfile)
6. [Multi-Stage Dockerfile — The Production Approach](#6-multi-stage-dockerfile)
7. [.dockerignore — What to Exclude](#7-dockerignore)
8. [JVM Memory Tuning Inside Containers](#8-jvm-memory-tuning)
9. [Environment Variables and Spring Profiles](#9-environment-variables)
10. [Health Checks — Docker and Actuator Together](#10-health-checks)
11. [Security Hardening](#11-security-hardening)
12. [Connecting to Other Services](#12-connecting-to-other-services)
13. [Running Locally — Dev Workflow](#13-dev-workflow)
14. [CI/CD — Building and Pushing in Pipelines](#14-cicd)
15. [Industry Challenges and How to Solve Them](#15-industry-challenges)
16. [Interview Questions — With Model Answers](#16-interview-questions)

---

## 1. What "Dockerizing" Actually Means

Dockerizing a Spring Boot app means packaging it so it can run consistently anywhere — developer laptop, CI server, cloud VM, Kubernetes — with zero environment setup. The goal is a Docker image that:

- Starts quickly (fast startup = fast deployment, fast autoscaling)
- Is small (fast pull = fast deployment, smaller attack surface)
- Is secure (non-root, minimal packages, no secrets in layers)
- Handles graceful shutdown (SIGTERM → Spring graceful shutdown)
- Configures itself from environment (12-factor app principle)
- Is observable (health endpoints, log to stdout)

This tutorial walks through each of these properties step by step.

---

## 2. Choosing the Right Base Image

The base image is the most consequential decision. Wrong choice = bloated images, security vulnerabilities, or subtle runtime bugs.

### The Options

```
Official Java Images (Docker Hub):

eclipse-temurin (Adoptium — recommended)
  eclipse-temurin:17-jdk-jammy     → Full JDK, Ubuntu 22.04 (600MB) — build stage
  eclipse-temurin:17-jre-jammy     → JRE only, Ubuntu 22.04  (220MB) — runtime stage
  eclipse-temurin:17-jre-alpine    → JRE only, Alpine Linux   (150MB) — smaller, musl libc
  eclipse-temurin:17-jre-focal     → JRE only, Ubuntu 20.04  (215MB)

Amazon Corretto
  amazoncorretto:17                → Amazon's OpenJDK build, Fedora-based
  amazoncorretto:17-al2023         → Amazon Linux 2023 base (good for AWS deployments)

Google Distroless
  gcr.io/distroless/java17-debian12 → Minimal: JRE + app only, no shell, no package manager

Microsoft Build of OpenJDK
  mcr.microsoft.com/openjdk/jdk:17-ubuntu → Good for Azure deployments
```

### Decision Matrix

| Base Image | Size | Shell | Package manager | Vulnerability surface | Best for |
|-----------|------|-------|-----------------|----------------------|---------|
| `eclipse-temurin:17-jre-jammy` | 220MB | ✅ bash | ✅ apt | Medium | Most apps, easy to debug |
| `eclipse-temurin:17-jre-alpine` | 150MB | ✅ sh | ✅ apk | Low | Size-sensitive, glibc compat check needed |
| `amazoncorretto:17-al2023` | 400MB | ✅ bash | ✅ dnf | Medium | AWS deployments, Amazon support |
| `gcr.io/distroless/java17` | 120MB | ❌ | ❌ | Minimal | High-security production, no live debugging |

### The Alpine Gotcha

Alpine uses **musl libc** instead of glibc. Most Java apps work fine, but some native libraries (particularly those using JNI like certain SSL/crypto libs, or Elasticsearch client) expect glibc. Always test thoroughly before deploying Alpine-based images.

```dockerfile
# If your app uses any native libraries, check compatibility:
docker run --rm eclipse-temurin:17-jre-alpine java -version
# If it prints the version, basic JVM works. Test your actual app.
```

### Pinning to Exact Versions

```dockerfile
# Bad: unpredictable — changes without warning
FROM eclipse-temurin:17-jre

# Better: predictable
FROM eclipse-temurin:17-jre-jammy

# Best: fully pinned (use in production, update deliberately)
FROM eclipse-temurin:17.0.11_9-jre-jammy

# Ultimate: pin to digest (immune to tag mutation)
FROM eclipse-temurin:17.0.11_9-jre-jammy@sha256:abc123...
```

---

## 3. Fat JAR vs Layered JAR

### The Fat JAR

Spring Boot's default packaging is a **fat JAR** (also called "uber JAR") — a single self-contained JAR that includes your application code AND all dependencies (hundreds of libraries) packaged together.

```
my-app-1.0.jar (45MB total)
├── BOOT-INF/
│   ├── classes/           ← your compiled .class files (~1MB)
│   │   └── com/example/...
│   └── lib/               ← all dependencies (~44MB)
│       ├── spring-core-6.1.jar
│       ├── spring-web-6.1.jar
│       ├── jackson-databind-2.16.jar
│       └── ... (150+ JARs)
├── META-INF/
└── org/springframework/boot/loader/  ← Spring Boot loader
```

**The Docker cache problem with fat JARs:**

```dockerfile
# With fat JAR:
COPY target/my-app-1.0.jar app.jar  ← 45MB blob
# Any change to your code (1 line in a .java file) → new fat JAR → cache MISS
# Docker re-uploads the entire 45MB on every code change
```

Every build pushes the entire 45MB even if you only changed one Java class.

### The Layered JAR

Spring Boot 2.3+ supports **layered JARs** — the JAR is split into layers so Docker can cache the dependency layers separately from your application code.

```
Layered JAR structure (same 45MB jar, but extractable into layers):
  Layer 1: spring-boot-loader      (~1MB)  ← Almost never changes
  Layer 2: dependencies            (~40MB) ← Changes when pom.xml changes
  Layer 3: snapshot-dependencies   (~2MB)  ← Changes more often (SNAPSHOT versions)
  Layer 4: application             (~1MB)  ← Changes on every commit

Docker build with layered JAR:
  COPY --from=builder spring-boot-loader/     (1MB  — cache hit 99% of the time)
  COPY --from=builder dependencies/           (40MB — cache hit ~95% of the time)
  COPY --from=builder snapshot-dependencies/  (2MB  — cache hit ~80% of the time)
  COPY --from=builder application/            (1MB  — always changes)

Result: Only the 1MB application layer is pushed on each code change!
```

---

## 4. Building the Layered JAR

### Maven Configuration

```xml
<!-- pom.xml -->
<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <!-- Enable layered JAR (enabled by default in Spring Boot 3.x) -->
                <layers>
                    <enabled>true</enabled>
                </layers>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### Verify Layers

```bash
# Build the JAR
mvn package -DskipTests

# Inspect layers
java -Djarmode=layertools -jar target/my-app-1.0.jar list
# Outputs:
# dependencies
# spring-boot-loader
# snapshot-dependencies
# application

# Extract layers to a directory (to see what's in each)
mkdir /tmp/layers && cd /tmp/layers
java -Djarmode=layertools -jar /path/to/target/my-app-1.0.jar extract
ls
# application/  dependencies/  snapshot-dependencies/  spring-boot-loader/
```

---

## 5. Single-Stage Dockerfile — The Naive Approach

This is what most tutorials show. Understand it, then move on to multi-stage.

```dockerfile
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY target/my-app-1.0.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

**Problems:**
1. Requires Maven/Gradle installed on the host machine — "works on my machine" is back
2. If you `COPY target/*.jar` and the JAR doesn't exist (dirty checkout), the build fails cryptically
3. No layer caching optimization — any code change = re-upload entire JAR
4. Runs as root (security risk)
5. No health check
6. No JVM memory configuration

Use this for quick experiments only. Never in CI/CD or production.

---

## 6. Multi-Stage Dockerfile — The Production Approach

### Version A: Fat JAR Multi-Stage (Simpler)

```dockerfile
# ═══════════════════════════════════════════════════════════════
# Stage 1: Build
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:17.0.11_9-jdk-jammy AS builder

WORKDIR /app

# Cache Maven dependencies separately from source code
COPY pom.xml .
# Download all dependencies. Will be cached as long as pom.xml doesn't change.
RUN mvn dependency:go-offline -q

# Copy source and build
COPY src ./src
RUN mvn package -DskipTests -q

# ═══════════════════════════════════════════════════════════════
# Stage 2: Runtime
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:17.0.11_9-jre-jammy

# Security: non-root user
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -d /app -s /bin/false appuser

WORKDIR /app

# Copy only the built JAR — nothing else from the build stage
COPY --from=builder --chown=appuser:appgroup /app/target/my-app-*.jar app.jar

USER appuser

EXPOSE 8080

# Exec form: Java becomes PID 1, receives SIGTERM directly
CMD ["java", "-jar", "app.jar"]
```

### Version B: Layered JAR Multi-Stage (Best Practice)

```dockerfile
# ═══════════════════════════════════════════════════════════════
# Stage 1: Build and Extract Layers
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:17.0.11_9-jdk-jammy AS builder

WORKDIR /app

# 1. Copy pom.xml first — Maven dependency cache layer
COPY pom.xml .
RUN mvn dependency:go-offline -q

# 2. Build the application
COPY src ./src
RUN mvn package -DskipTests -q

# 3. Extract JAR into layers
RUN java -Djarmode=layertools -jar target/my-app-*.jar extract --destination extracted

# ═══════════════════════════════════════════════════════════════
# Stage 2: Runtime — each COPY is a separate cacheable Docker layer
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:17.0.11_9-jre-jammy

RUN groupadd -r appgroup && \
    useradd -r -g appgroup -d /app -s /bin/false appuser

WORKDIR /app

# Copy layers in order of least-to-most frequently changing
# (least changing = more likely to cache hit)
COPY --from=builder --chown=appuser:appgroup /app/extracted/dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/extracted/spring-boot-loader/ ./
COPY --from=builder --chown=appuser:appgroup /app/extracted/snapshot-dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/extracted/application/ ./

USER appuser

EXPOSE 8080

# Use Spring Boot's JarLauncher directly (works with extracted layer structure)
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

### Version C: Production-Grade (All Best Practices)

```dockerfile
# ═══════════════════════════════════════════════════════════════
# Stage 1: Dependencies (only rebuilds when pom.xml changes)
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:17.0.11_9-jdk-jammy AS deps

WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q

# ═══════════════════════════════════════════════════════════════
# Stage 2: Build (rebuilds when source changes)
# ═══════════════════════════════════════════════════════════════
FROM deps AS builder

COPY src ./src
RUN mvn package -DskipTests -q && \
    java -Djarmode=layertools -jar target/my-app-*.jar extract --destination extracted

# ═══════════════════════════════════════════════════════════════
# Stage 3: Runtime
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:17.0.11_9-jre-jammy AS runtime

# Labels for traceability
ARG BUILD_DATE
ARG GIT_COMMIT
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.title="my-app"

# Security: non-root user
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -d /app -s /bin/false appuser

WORKDIR /app

# Layered copy — most cacheable first
COPY --from=builder --chown=appuser:appgroup /app/extracted/dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/extracted/spring-boot-loader/ ./
COPY --from=builder --chown=appuser:appgroup /app/extracted/snapshot-dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/extracted/application/ ./

USER appuser

EXPOSE 8080

# Health check using Spring Actuator
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=90s \
            --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Exec form — Java is PID 1, SIGTERM propagates correctly
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

Build with trace labels:
```bash
docker build \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
  -t myapp:$(git rev-parse --short HEAD) \
  .
```

---

## 7. .dockerignore

The `.dockerignore` file prevents unnecessary files from being sent to the Docker daemon as part of the build context. Without it, `docker build .` sends your entire project directory — including `target/`, `.git/`, `node_modules/`, etc. — to the daemon, which is slow and wasteful.

```
# .dockerignore

# Build output (we copy it in the Dockerfile ourselves)
target/

# Version control
.git/
.gitignore

# IDE files
.idea/
*.iml
.vscode/
*.swp

# Docker files themselves
Dockerfile*
docker-compose*.yml
.dockerignore

# Documentation and dev-only configs
*.md
docs/

# OS metadata
.DS_Store
Thumbs.db

# Test output
**/test-results/
**/surefire-reports/

# Logs
*.log
logs/

# Environment files (NEVER include secrets in image)
.env
.env.*
secrets/

# Node (if you have a frontend)
node_modules/

# Maven wrapper cache (optional — keeps context small)
# .mvn/wrapper/maven-wrapper.jar  ← keep this if you use mvnw
```

Check your build context size:
```bash
# Before .dockerignore: might be 500MB (includes target/ with all JARs)
# After .dockerignore: typically <5MB (just source + pom.xml)

# Verify:
du -sh .            # total project size
docker build --no-cache -t test . 2>&1 | head -5
# "Sending build context to Docker daemon  4.2MB"  ← with .dockerignore
# "Sending build context to Docker daemon  620MB"  ← without
```

---

## 8. JVM Memory Tuning Inside Containers

This is the most common source of OOM kills and performance problems when running Java in Docker.

### The Problem: JVM Doesn't See Container Memory Limits by Default (Old JVMs)

Old JVMs (before Java 8u191) read memory from the host, not the container:

```
Host has 32GB RAM.
Container limit: 512MB.
Old JVM sets heap to 25% of host RAM = 8GB.
Container hits 512MB limit → OOM killed.
```

Modern JVMs (Java 8u191+, all Java 11+) are container-aware — they read cgroup limits correctly. But you still need to tune:

### Container Memory Budget

```
Container memory limit: 512MB

Budget breakdown:
  JVM heap (-Xmx):        ~60% = 300MB  ← the objects your app creates
  JVM metaspace:          ~60MB          ← class metadata (grows as classes load)
  JVM off-heap / NIO:     ~50MB          ← direct buffers, NIO operations
  JVM overhead (threads): ~50MB          ← ~1MB per thread × ~50 threads
  OS + container:         ~52MB          ← Docker overhead, kernel buffers

Total: ~512MB
```

### Configuring Memory

```dockerfile
# Option 1: Hardcoded in Dockerfile (inflexible — hard to change per environment)
CMD ["java", "-Xms256m", "-Xmx384m", "-jar", "app.jar"]

# Option 2: Via environment variable (recommended — change per environment)
ENV JAVA_OPTS="-Xms256m -Xmx384m -XX:MaxMetaspaceSize=128m"
CMD ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
# Note: shell form needed here to expand env var — but this loses signal handling!

# Option 3: Use Spring Boot's SPRING_APPLICATION_JSON or JVM_OPTS tool chain
# Spring Boot 2.6+ reads JAVA_TOOL_OPTIONS automatically
ENV JAVA_TOOL_OPTIONS="-Xms256m -Xmx384m -XX:MaxMetaspaceSize=128m"
CMD ["java", "org.springframework.boot.loader.launch.JarLauncher"]
# JAVA_TOOL_OPTIONS is read by the JVM directly before launch — exec form works!
```

### UseContainerSupport (Always Verify It's On)

```dockerfile
# Java 11+: container support is ON by default
# Java 8u191-8u212: need to enable explicitly
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# MaxRAMPercentage: set heap to X% of container's memory limit
# 75% leaves room for metaspace, threads, off-heap
# Example: container limit 512MB × 75% = 384MB heap
```

### Recommended Settings per Container Size

```bash
# 256MB container (minimal)
JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0 -XX:MaxMetaspaceSize=64m -Xss256k"

# 512MB container (typical microservice)
JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0 -XX:MaxMetaspaceSize=96m"

# 1GB container (moderate load)
JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0 -XX:MaxMetaspaceSize=128m"

# 2GB+ container (high load / data processing)
JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:MaxMetaspaceSize=256m"
```

### Garbage Collection Tuning

```bash
# G1GC (default Java 9+): good general-purpose choice
JAVA_TOOL_OPTIONS="-XX:+UseG1GC -XX:MaxGCPauseMillis=200"

# ZGC (Java 15+ production): ultra-low pause times, good for latency-sensitive APIs
JAVA_TOOL_OPTIONS="-XX:+UseZGC"

# SerialGC: for very small containers (<256MB), minimal GC overhead
JAVA_TOOL_OPTIONS="-XX:+UseSerialGC"
```

### Monitoring JVM Inside Container

```bash
# Check effective JVM flags (see what container limits were detected)
docker exec myapp java -XX:+PrintFlagsFinal -version 2>&1 | grep -E "MaxHeapSize|InitialHeapSize"

# Run a one-off JVM diagnostic
docker exec myapp jcmd 1 VM.flags
docker exec myapp jcmd 1 GC.heap_info
```

---

## 9. Environment Variables and Spring Profiles

### 12-Factor App: Config in Environment

Never bake environment-specific config into the image. The same image should run in dev, staging, and production — just with different environment variables.

```bash
# Development
docker run -e SPRING_PROFILES_ACTIVE=local \
           -e DB_URL=jdbc:postgresql://localhost:5432/mydb_dev \
           -e DB_PASSWORD=devpassword \
           myapp:1.0

# Production
docker run -e SPRING_PROFILES_ACTIVE=production \
           -e DB_URL=jdbc:postgresql://prod-db.internal:5432/mydb \
           -e DB_PASSWORD="$PROD_DB_PASSWORD" \  # from secrets manager
           myapp:1.0
```

### Spring Boot Environment Variable Override

Spring Boot automatically maps environment variables to properties using relaxed binding:

```
Environment variable:       Spring property:
SPRING_DATASOURCE_URL   →  spring.datasource.url
DB_PASSWORD             →  db.password (if referenced as ${DB_PASSWORD})
SERVER_PORT             →  server.port
LOGGING_LEVEL_ROOT      →  logging.level.root
```

### application.yml — Designed for Containers

```yaml
# application.yml (in src/main/resources)
server:
  port: ${SERVER_PORT:8080}    # env var with default fallback

spring:
  datasource:
    url: ${DB_URL}             # required — fails fast if not set
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: ${DDL_AUTO:validate}

# Profile-specific config files:
# application-local.yml      → for local development
# application-production.yml → for production
```

### Profile-Specific Config Files

```yaml
# application-local.yml
spring:
  datasource:
    url: jdbc:h2:mem:testdb   # in-memory DB for local dev
  h2:
    console:
      enabled: true

logging:
  level:
    com.example: DEBUG

---
# application-production.yml
spring:
  jpa:
    show-sql: false

logging:
  level:
    root: WARN
    com.example: INFO
```

### Passing Entire Config File as a Volume

For complex config that's too long to put in environment variables:

```bash
docker run \
  -v $(pwd)/config/production.yml:/app/config/application.yml:ro \
  -e SPRING_CONFIG_LOCATION=file:/app/config/ \
  myapp:1.0
```

---

## 10. Health Checks — Docker and Actuator Together

### Spring Boot Actuator Setup

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized   # don't expose DB health to the world
      probes:
        enabled: true                  # enables /actuator/health/liveness and /readiness
  health:
    livenessState:
      enabled: true
    readinessState:
      enabled: true
```

### Liveness vs Readiness

Spring Boot 2.3+ exposes separate probes:

```
/actuator/health/liveness
  → "Is the app alive and not deadlocked?"
  → If unhealthy: Kubernetes/Docker restarts the container
  → Should only fail for truly unrecoverable states

/actuator/health/readiness
  → "Is the app ready to receive traffic?"
  → If unhealthy: Kubernetes removes from load balancer (doesn't restart)
  → Should fail if DB connection pool exhausted, downstream service unavailable
  → Healthy again once the transient issue resolves
```

### Dockerfile HEALTHCHECK

```dockerfile
# Check the readiness probe — if app can't serve traffic, it's unhealthy
HEALTHCHECK \
    --interval=30s \       # check every 30s
    --timeout=10s \        # fail if no response in 10s
    --start-period=90s \   # give 90s for app to start before first check
    --retries=3 \          # mark unhealthy after 3 consecutive failures
    CMD curl -f http://localhost:8080/actuator/health/readiness || exit 1
```

Install curl in the runtime image if it's not included (Alpine doesn't have it by default):

```dockerfile
# Alpine: install wget (lighter than curl)
RUN apk add --no-cache wget
HEALTHCHECK CMD wget -qO- http://localhost:8080/actuator/health/readiness || exit 1

# Distroless: can't use shell commands — use a Java-based health check
# Instead, rely on Kubernetes liveness/readiness probes (HTTP probe, no shell needed)
```

### Checking Health Status

```bash
docker inspect --format='{{.State.Health}}' myapp
# {running 0 2024-01-01T00:00:00Z []}

docker inspect --format='{{json .State.Health}}' myapp | python -m json.tool
# {
#   "Status": "healthy",
#   "FailingStreak": 0,
#   "Log": [
#     {
#       "Start": "2024-01-01T00:00:30Z",
#       "End": "2024-01-01T00:00:30.5Z",
#       "ExitCode": 0,
#       "Output": ""
#     }
#   ]
# }
```

---

## 11. Security Hardening

### Non-Root User (Mandatory)

```dockerfile
# Pattern for Debian/Ubuntu-based images
RUN groupadd -r appgroup && \
    useradd -r \
            -g appgroup \
            -d /app \
            -s /bin/false \
            appuser

# -r: system account (no login, no home directory in /home/)
# -d /app: home directory is /app (your working directory)
# -s /bin/false: no shell (can't SSH in)

WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/extracted/ ./
USER appuser
```

### Read-Only Filesystem

Spring Boot apps write to:
- `/tmp` (Spring's default temp dir)
- Log files (if using file appender)

Mount these as tmpfs:

```bash
docker run \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --tmpfs /app/logs:rw,noexec,nosuid,size=64m \
  -e LOGGING_FILE_NAME=/app/logs/app.log \
  myapp:1.0
```

Configure Spring to use `/tmp` for uploads:

```yaml
# application.yml
spring:
  servlet:
    multipart:
      location: /tmp   # use tmpfs-mounted /tmp
```

### Capabilities — Drop Everything Unnecessary

Containers run with a subset of Linux capabilities. Drop all, then add only what you need:

```bash
docker run \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  myapp:1.0

# Typical Spring Boot app needs no special capabilities
# --cap-add NET_BIND_SERVICE  ← only if binding to port < 1024 (don't — use port 8080+)
```

### Secrets — Never in Image Layers

```dockerfile
# BAD: visible in docker inspect and image history
ENV DB_PASSWORD=mypassword123

# GOOD: set at runtime via environment
# (keep in Dockerfile only the non-secret defaults)
ENV SPRING_PROFILES_ACTIVE=production
ENV SERVER_PORT=8080
```

In CI/CD pipelines:
```bash
# GitHub Actions
docker run \
  -e DB_PASSWORD="${{ secrets.DB_PASSWORD }}" \
  myapp:1.0
```

### Image Vulnerability Scanning

```bash
# Trivy (free, excellent)
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image \
  --severity HIGH,CRITICAL \
  --exit-code 1 \          # fail pipeline if HIGH/CRITICAL found
  myapp:1.0

# Docker Scout (built into Docker Desktop / Docker Hub)
docker scout cves myapp:1.0
docker scout recommendations myapp:1.0   # suggests base image upgrades
```

---

## 12. Connecting to Other Services

### Connecting to a Database Container (Local Dev)

```bash
# Step 1: Create a network
docker network create myapp-network

# Step 2: Run PostgreSQL
docker run -d \
  --name postgres \
  --network myapp-network \
  -e POSTGRES_DB=myapp \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15

# Step 3: Run your app connected to same network
docker run -d \
  --name myapp \
  --network myapp-network \
  -e DB_URL=jdbc:postgresql://postgres:5432/myapp \  # 'postgres' = container name = DNS name
  -e DB_USERNAME=myuser \
  -e DB_PASSWORD=mypassword \
  -e SPRING_PROFILES_ACTIVE=local \
  -p 8080:8080 \
  myapp:1.0

# Test
curl http://localhost:8080/actuator/health
```

### Waiting for Dependent Services

Spring Boot's database autoconfigure retries connection, but if postgres hasn't started at all yet:

```yaml
# application.yml — Spring Retry on datasource
spring:
  datasource:
    hikari:
      initialization-fail-timeout: 60000   # wait up to 60s for DB on startup
      connection-timeout: 30000
      maximum-pool-size: 10
```

Or use a startup script:

```dockerfile
# Install wait-for-it (open-source, MIT license)
ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Usage:
CMD ["/wait-for-it.sh", "postgres:5432", "--timeout=60", "--", \
     "java", "org.springframework.boot.loader.launch.JarLauncher"]
```

### Connecting to Redis

```bash
docker run -d \
  --name redis \
  --network myapp-network \
  redis:7-alpine

docker run -d \
  --name myapp \
  --network myapp-network \
  -e SPRING_REDIS_HOST=redis \
  -e SPRING_REDIS_PORT=6379 \
  myapp:1.0
```

---

## 13. Dev Workflow — Local Development with Docker

### Option A: Run Only Dependencies in Docker, App on Host

```bash
# Start just PostgreSQL and Redis in Docker
docker network create myapp-net

docker run -d --name postgres --network myapp-net \
  -p 5432:5432 \                   # expose to host for app running outside Docker
  -e POSTGRES_DB=myapp_dev \
  -e POSTGRES_PASSWORD=devpass \
  postgres:15

docker run -d --name redis --network myapp-net \
  -p 6379:6379 \
  redis:7-alpine

# Run Spring Boot on host machine (faster iteration, full IDE support)
export DB_URL=jdbc:postgresql://localhost:5432/myapp_dev
export DB_PASSWORD=devpass
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

### Option B: Full Docker Dev with Bind Mount + Hot Reload

```dockerfile
# Dockerfile.dev
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
VOLUME ["/app/src", "/app/target"]
CMD ["mvn", "spring-boot:run", "-Dspring.devtools.restart.enabled=true"]
```

```bash
docker run -d \
  -v $(pwd)/src:/app/src \       # live source sync
  -v $(pwd)/target:/app/target \ # build output sync
  -p 8080:8080 \
  --network myapp-net \
  myapp:dev
```

### Making Rebuilds Fast with BuildKit

```bash
# Enable BuildKit (default in Docker Desktop, manual on Linux)
export DOCKER_BUILDKIT=1

# Build with progress output
docker build --progress=plain -t myapp:latest .

# Rebuild only changed stages
docker build --target builder -t myapp:builder-cache .
docker build -t myapp:latest .
```

---

## 14. CI/CD — Building and Pushing Images

### GitHub Actions Pipeline

```yaml
# .github/workflows/docker-build.yml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            BUILD_DATE=${{ steps.meta.outputs.created }}
            GIT_COMMIT=${{ github.sha }}
          cache-from: type=gha                # Use GitHub Actions cache
          cache-to: type=gha,mode=max

      - name: Scan image for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}:sha-${{ github.sha }}
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'
```

### Multi-Platform Builds (ARM + AMD64)

For teams using Apple Silicon Macs but deploying to AMD64 servers:

```bash
# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --push \
  -t ghcr.io/myorg/myapp:latest \
  .
```

---

## 15. Industry Challenges and How to Solve Them

### Challenge 1: OOM Kill — Container Killed with Exit Code 137

**Symptoms**: Container exits unexpectedly, `docker inspect` shows exit code 137, no stack trace in logs (process killed by OS).

```bash
# Diagnose
docker inspect myapp --format='{{.State.ExitCode}}'   # 137 = OOM
dmesg | grep -i "oom killer"  # host kernel OOM log

# Root causes and fixes:
# 1. JVM heap too large for container
docker run -m 512m \
  -e JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0 -XX:MaxMetaspaceSize=96m" \
  myapp:1.0

# 2. Memory leak (heap grows over time)
# Add GC logging to diagnose:
-e JAVA_TOOL_OPTIONS="-Xlog:gc*:stdout:time -XX:+HeapDumpOnOutOfMemoryError \
                      -XX:HeapDumpPath=/tmp/heapdump.hprof"

# 3. Spring Batch / large datasets in memory
# Process in chunks, not loading entire datasets at once
```

### Challenge 2: Slow Spring Boot Startup in Container

**Symptoms**: Container takes 45-90 seconds to reach healthy state. Kubernetes restarts it because readiness probe fails.

```bash
# Solutions:

# 1. Adjust start-period in healthcheck / readiness probe delay in K8s
HEALTHCHECK --start-period=120s ...

# 2. Spring Boot startup optimization:
-Dspring.jmx.enabled=false       # disable JMX (unused in containers)
-Dspring.cloud.bootstrap.enabled=false  # if not using Spring Cloud Config
-Dspring.main.lazy-initialization=true  # lazy load beans (saves ~20% startup)

# 3. Use Spring AOT (Spring Boot 3.x) for GraalVM native image:
mvn spring-boot:build-image      # builds native image via Buildpacks
# Startup: 5-50ms instead of 5-30s (massive difference for autoscaling)

# 4. JVM CDS (Class Data Sharing) — pre-loads JVM class metadata
RUN java -Xshare:dump            # in Dockerfile, creates shared archive
CMD ["java", "-Xshare:on", ...]  # use the archive at startup
```

### Challenge 3: Spring Boot Can't Reach Database at Startup

**Symptoms**: App starts, immediately throws `Connection refused` to PostgreSQL, exits.

```yaml
# application.yml — configure connection pool retry
spring:
  datasource:
    hikari:
      connection-timeout: 30000          # 30s timeout per connection attempt
      initialization-fail-timeout: -1    # -1 = retry indefinitely on startup
      # (Spring Boot 2.6+ default is 1 = fail fast — change this for Docker!)
```

Or use a health check dependency in Docker Compose (covered in next tutorial):

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

### Challenge 4: Logs Not Visible / Missing

**Problem**: App writes logs to a file inside the container. `docker logs` shows nothing.

**Solution**: Log to stdout/stderr in containers — Docker captures these automatically.

```yaml
# application.yml — log to console, not file
logging:
  pattern:
    console: "%d{ISO8601} [%thread] %-5level %logger{36} - %msg%n"
  # Remove any file appenders:
  # file:
  #   name: /var/log/app.log  ← REMOVE THIS for containers
```

If you need file logging AND stdout:

```xml
<!-- logback-spring.xml -->
<configuration>
    <!-- Console output (captured by Docker) -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{ISO8601} %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE" />
    </root>
</configuration>
```

### Challenge 5: Image Contains Sensitive Build Artifacts

**Problem**: `docker history myapp` shows intermediate layers containing secrets or source code.

```bash
# Inspect what's in your image layers
docker history myapp:1.0
docker save myapp:1.0 | tar -xO '*/layer.tar' | tar -t | grep -E '\.(java|env|key)'
```

**Fix**: Multi-stage build — only the final stage's layers are in the published image. All build-stage layers are discarded.

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A team moves a Spring Boot service from VMs into containers with a 1 GB memory limit. It runs fine for hours, then gets OOM-killed under load. The heap was configured with `-Xmx1g`, matching the container limit — leaving no room for metaspace, thread stacks, direct buffers (Netty), and the code cache. **Decision**: Size the heap as a percentage of the container limit (`-XX:MaxRAMPercentage=70` or so, which modern JVMs read from cgroup limits), leave 25-30% for non-heap memory, set container memory request = limit for predictable behavior, and monitor both heap and resident memory (RSS). Load test at the container limit before production.

</div>

<div class="callout-scenario">

**Scenario**: During every deployment, a few hundred requests fail with connection resets. Containers receive SIGTERM and the JVM exits immediately, cutting off in-flight requests, while the load balancer still routes traffic to them for a few seconds. **Decision**: Enable `server.shutdown=graceful` with `spring.lifecycle.timeout-per-shutdown-phase=20s`, make sure the Java process is PID 1 or receives signals properly (exec-form `ENTRYPOINT`, not a shell wrapper that swallows SIGTERM), add a short pre-stop delay so the load balancer deregisters the instance first, and keep the orchestrator's termination grace period longer than the Spring shutdown timeout.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Which base image would you choose for production Spring Boot, and why not `openjdk:latest`?

<details>
<summary>Show answer</summary>

A maintained JRE image pinned to a specific version, such as `eclipse-temurin:21-jre` (or its Alpine/Ubuntu variant), or a distroless Java image for a smaller attack surface. The `openjdk` images on Docker Hub are deprecated, and `latest` is unpredictable (changes Java versions without warning). Use a JRE, not a JDK, in the runtime stage, and pin by tag or digest.

</details>

**L2.** Why does the exec form `ENTRYPOINT ["java", "-jar", "app.jar"]` matter compared with `ENTRYPOINT java -jar app.jar`?

<details>
<summary>Show answer</summary>

The shell form runs `/bin/sh -c "java ..."`, so the shell is PID 1 and may not forward SIGTERM to Java — graceful shutdown never runs and the container is SIGKILLed after the timeout. The exec form makes Java PID 1 and it receives signals directly. If you need a script, end it with `exec java ...`.

</details>

**L3.** What do the four layers of a Spring Boot layered JAR contain, and which changes most often?

<details>
<summary>Show answer</summary>

`dependencies` (release third-party JARs), `spring-boot-loader` (launcher classes), `snapshot-dependencies` (SNAPSHOT JARs), and `application` (your classes and resources). The application layer changes on almost every build, so it goes last in the Dockerfile; the large dependencies layer stays cached and isn't re-pushed.

</details>

### 🟡 Medium — Apply it

**M1.** Write a multi-stage Dockerfile for a Maven Spring Boot app using layered JARs and a non-root user.

<details>
<summary>Show answer</summary>

```dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q package -DskipTests \
 && java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination extracted

FROM eclipse-temurin:21-jre
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /src/extracted/dependencies/ ./
COPY --from=build /src/extracted/spring-boot-loader/ ./
COPY --from=build /src/extracted/snapshot-dependencies/ ./
COPY --from=build /src/extracted/application/ ./
USER app
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

This uses the Boot 3.3+ `jarmode=tools extract` command; on Boot 3.2 and earlier use `-Djarmode=layertools -jar app.jar extract`, and on Boot 2.x the launcher class is `org.springframework.boot.loader.JarLauncher`.

</details>

**M2.** The app works locally but in the container can't connect to PostgreSQL at `localhost:5432`. Why?

<details>
<summary>Show answer</summary>

Inside a container, `localhost` is the container itself, not your machine or the database container. Use the database service's hostname on a shared Docker network (`jdbc:postgresql://postgres:5432/app` in Compose), or `host.docker.internal` to reach a database running on the host (Docker Desktop; on Linux add `--add-host=host.docker.internal:host-gateway`). Externalize the URL via `SPRING_DATASOURCE_URL`.

</details>

**M3.** Configure health checks so the orchestrator restarts a hung app but doesn't kill it when the database is briefly down.

<details>
<summary>Show answer</summary>

Enable Actuator probes (`management.endpoint.health.probes.enabled=true`; on by default in Kubernetes environments). **Liveness** (`/actuator/health/liveness`) reflects only the app's internal state — don't include the database, or a DB blip restarts every pod. **Readiness** (`/actuator/health/readiness`) can include critical dependencies so traffic stops flowing while they're down. In plain Docker, use a `HEALTHCHECK` against the liveness endpoint with sensible interval, timeout, and retries (and install `curl`/`wget` or use a small Java-based check in distroless images).

</details>

### 🔴 High — Think like a senior

**H1.** Container startup takes 25 seconds, which slows autoscaling. What are your options?

<details>
<summary>Show answer</summary>

Measure first (Spring Boot startup actuator endpoint, or `-Xlog:class+load` and timing logs). Options in increasing effort: lazy initialization for non-critical beans, removing unnecessary auto-configurations, reducing classpath scanning, more CPU during startup (CPU limits throttle JIT and class loading), **Class Data Sharing / AppCDS** (Boot 3.3+ supports CDS training runs), **CRaC** (checkpoint/restore a warmed JVM, where supported), or **GraalVM native image** (sub-second startup, lower memory, but longer builds, reflection configuration, and possibly lower peak throughput). Choose based on how often you scale and what you can maintain.

</details>

**H2.** Design the CI/CD pipeline for building and shipping the Spring Boot image.

<details>
<summary>Show answer</summary>

On pull request: compile, unit and integration tests (Testcontainers), build the image with BuildKit and a registry cache, scan it (Trivy), and run a container smoke test (start it, hit `/actuator/health`). On merge to main: build once, tag with the commit SHA (immutable), generate an SBOM, sign the image, push to the registry, and deploy the **same digest** through environments (staging → production) with automated checks between them. Never rebuild per environment; configuration comes from environment variables or config maps.

</details>

## 🛠️ Mini Project — Production-Ready Spring Boot Container

**Goal**: A container you'd be proud to ship. 2 evenings.

**Build**

1. A Spring Boot 3 REST service with PostgreSQL and Actuator.
2. Multi-stage Dockerfile with layered JAR extraction, BuildKit Maven cache, non-root user, JRE base pinned by digest, exec-form entrypoint, `MaxRAMPercentage`.
3. Graceful shutdown: prove with a load test during `docker stop` that zero requests fail.
4. Memory experiment: run with `--memory=512m` and different `MaxRAMPercentage` values under load; record which settings survive.
5. Measure: image size, rebuild time after a one-line code change, startup time; then try CDS or a native image and compare.
6. GitHub Actions pipeline: test, build, scan, push with the commit SHA tag.

**Acceptance criteria**: README table of image size, rebuild time, startup time, and memory results; zero failed requests during shutdown.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "Why use a multi-stage build for Spring Boot?"**

Two main reasons. First, image size — the build stage needs a full JDK plus Maven, which together are over 600MB. The runtime only needs a JRE to execute the JAR, which is 200MB. Without multi-stage you'd ship all the build tools in production. With multi-stage, I build in the first stage and then COPY only the JAR into a minimal JRE image. The final image is 3x smaller — faster to pull and smaller attack surface. Second, reproducibility — I don't need Maven installed on the developer's machine or the CI server. The Dockerfile itself contains all build instructions, so anyone with Docker can build exactly the same artifact.

</div>

<div class="callout-interview">

**Q: "What is a layered JAR and why is it better for Docker?"**

A layered JAR is Spring Boot's way of splitting the fat JAR into separately cacheable layers: dependencies (rarely change), snapshot-dependencies (change occasionally), spring-boot-loader (almost never changes), and application (your code — changes every commit). In Docker, each COPY instruction creates a separate layer. By splitting the JAR into four COPY instructions in order of how rarely they change, Docker can cache the dependency layers. When you change one Java class and rebuild, only the 1MB application layer is invalidated and re-uploaded to the registry. With a traditional fat JAR, the entire 45MB JAR is a single blob — any code change invalidates the entire blob and forces a re-upload. In a team pushing 20 commits a day, this makes a significant difference in CI/CD speed.

</div>

<div class="callout-interview">

**Q: "How do you handle JVM memory configuration in a Docker container?"**

The key insight is that JVM heap is not the only memory the JVM uses. A 512MB container needs to budget for heap (~300MB), metaspace (~60MB), off-heap buffers (~50MB), thread stacks (~50MB), and OS overhead (~52MB). I use `JAVA_TOOL_OPTIONS` environment variable — it's picked up directly by the JVM before launch, so it works with exec form ENTRYPOINT. I use `MaxRAMPercentage` rather than hardcoded `-Xmx` because it adapts to the container limit: `-XX:MaxRAMPercentage=65.0 -XX:MaxMetaspaceSize=96m`. This way, if the container is resized, the heap adjusts automatically. I also verify container-awareness is working by checking that the JVM sees the container memory limit, not host memory: `docker exec myapp java -XX:+PrintFlagsFinal -version 2>&1 | grep MaxHeapSize`. On modern JVMs (11+) `UseContainerSupport` is enabled by default.

</div>

<div class="callout-interview">

**Q: "How does Spring Boot handle graceful shutdown in a container?"**

Two things must work together. First, Docker must send SIGTERM to the correct process. If I use shell form CMD (CMD java -jar app.jar), the shell (PID 1) gets SIGTERM — Java never sees it and is force-killed. I must use exec form: `CMD ["java", "-jar", "app.jar"]` so Java becomes PID 1 and receives SIGTERM directly. Second, Spring Boot must handle SIGTERM gracefully. In Spring Boot 2.3+, I enable graceful shutdown in application.yml: `server.shutdown=graceful` and `spring.lifecycle.timeout-per-shutdown-phase=30s`. This gives in-flight requests up to 30 seconds to complete before the JVM exits. I also need to tell Docker to wait: `docker stop --time 35 myapp` — Docker waits 35 seconds before force-killing, giving Spring's 30s grace period time to complete.

</div>

<div class="callout-interview">

**Q: "What would you check if a Dockerized Spring Boot app works locally but crashes in production?"**

I'd work through a checklist. First, environment variables — is every required variable set in production? Spring Boot fails fast with a clear error if a required property is missing. Second, memory — production containers are often smaller. Check if exit code is 137 (OOM killed). If so, tune JVM memory. Third, network — can the container reach its dependencies? Is it on the right network? Check with `docker exec myapp curl postgres:5432`. Fourth, startup timing — production may have slower disk or network. Is the health check start-period long enough? Fifth, base image — if using Alpine, check glibc compatibility. Sixth, secrets — are all credentials available? Never hardcode, always inject via environment or secrets manager. Seventh, file permissions — does the non-root user have read access to config files? I'd also compare `docker inspect` output between environments to spot configuration differences.

</div>

<div class="callout-interview">

**🎯 The three Dockerfile improvements that signal production experience:**

1. **Multi-stage with layered JAR** — shows you understand the cache and have optimized CI/CD
2. **Non-root user with --chown** — shows you know container security basics
3. **JAVA_TOOL_OPTIONS with MaxRAMPercentage** — shows you've debugged OOM kills before

If you can show all three and explain why each exists, you've demonstrated more Docker + Java production experience than 80% of candidates.

</div>

---

## Your Practice Checklist

- [ ] Write a multi-stage Dockerfile for a Spring Boot app from scratch without referencing this guide
- [ ] Enable layered JARs in a project and verify the 4 layers with `java -Djarmode=layertools ... list`
- [ ] Build the same app with fat JAR and layered JAR — time the push after a 1-line code change
- [ ] Run the container with `-m 256m` and tune JVM flags until it starts without OOM
- [ ] Configure Spring Actuator health probes and verify the HEALTHCHECK detects an unhealthy state
- [ ] Scan your image with Trivy and resolve at least one vulnerability by updating the base image
- [ ] Set up the full local dev workflow: PostgreSQL + Redis in Docker, app connected via custom network

---

## Related Topics

- `docker-fundamentals` — Container internals, image layers, volumes, networking
- `docker-compose` — Running the full stack (Spring Boot + PostgreSQL + Redis) with one command
- `spring-boot-fundamentals` — Spring Boot internals that affect containerization (auto-config, profiles, Actuator)

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's order-service Dockerfile is a multi-stage build with a layered jar, JVM sizing for containers, and graceful shutdown.

**Continue the story:** [Chapter 10 · Containerizing with Docker](/tutorials/journey-10-docker) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
