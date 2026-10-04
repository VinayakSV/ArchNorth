# Chapter 12 · Deploying on Kubernetes

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 12 of 15 · Phase: **Ship** · SDLC stage: **Deployment — infrastructure & runtime**

**Previously:** The CI/CD pipeline builds one image per commit, deploys it to staging through GitOps, runs smoke and regression tests, and promotes it to production after an approval ([Chapter 11](/tutorials/journey-11-cicd)).

**In this chapter:** You see where those images run. Kabir sets up ShopNorth on Kubernetes (Amazon EKS): deployments with health probes and resource sizes, secrets from AWS, network rules, autoscaling sized for the sale, graceful deploys, and the canary that protects production.

</div>

## The Situation

Week 10. Kabir has two EKS clusters ready (staging and production, built with Terraform), plus managed PostgreSQL (RDS), Redis (ElastiCache), and Kafka (MSK). His rule for the team: "Kubernetes runs our **stateless** services. Databases and Kafka are managed by AWS. Six people shouldn't be on call for database failover at 3 AM."

Your job this week: make the Order service a good Kubernetes citizen.

## Step 1 — What Runs Where

| Component | Runs on | Why |
|-----------|---------|-----|
| Gateway, Catalog, Cart, Order, Inventory, Payment, Notification, Search indexer | Kubernetes Deployments (Argo Rollouts in production) | Stateless, scale horizontally, deploy often |
| PostgreSQL (3 databases) | Amazon RDS, Multi-AZ | Backups, failover, patching handled for you |
| Redis | Amazon ElastiCache, with a replica | Same |
| Kafka | Amazon MSK, 3 brokers across 3 zones | Same |
| Search | Amazon OpenSearch Service | Same |
| Images | Amazon ECR (private registry) | Close to the cluster; scanned |

All services share one Helm chart (`shopnorth-service`) with per-service, per-environment values files in the GitOps repository — so every service gets the same probes, security settings, and labels by default.

## Step 2 — The Order Service Deployment

This is what Helm renders for the Order service in production (a few fields trimmed):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  labels:
    app.kubernetes.io/name: order-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
  template:
    metadata:
      labels:
        app.kubernetes.io/name: order-service
        tags.datadoghq.com/env: production          # Datadog unified service tags (Chapter 13)
        tags.datadoghq.com/service: order-service
        tags.datadoghq.com/version: "3f9c1a2b7d4e"   # = the image tag = the commit
    spec:
      serviceAccountName: order-service           # mapped to an AWS IAM role (no keys in the pod)
      terminationGracePeriodSeconds: 45
      topologySpreadConstraints:                  # spread pods across availability zones
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: order-service
      containers:
        - name: app
          image: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/order-service:3f9c1a2b7d4e
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef: { name: order-service-config }
            - secretRef: { name: order-service-secrets }
          resources:
            requests:
              cpu: 500m
              memory: 768Mi
            limits:
              memory: 1Gi                         # no CPU limit on purpose (see below)
          startupProbe:                           # give the JVM time to start before other probes count
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            periodSeconds: 5
            failureThreshold: 30
          readinessProbe:                         # "send me traffic?"
            httpGet: { path: /actuator/health/readiness, port: 8080 }
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:                          # "am I stuck? restart me"
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]  # let the load balancer stop sending traffic first
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
          volumeMounts:
            - { name: tmp, mountPath: /tmp }        # the only writable path
      volumes:
        - { name: tmp, emptyDir: {} }
```

What each part protects:

| Setting | Protects against |
|---------|------------------|
| **Readiness probe** | Sending customers to a pod that isn't ready (still starting, or temporarily overloaded) |
| **Liveness probe** | A pod that's stuck forever — Kubernetes restarts it. It checks only the app itself, **never the database** (see the first scenario) |
| **Startup probe** | Liveness killing a slow-starting JVM in a restart loop |
| **CPU request, no CPU limit** | Requests reserve capacity for scheduling; without a limit, a pod can use idle CPU during spikes instead of being throttled (a common cause of latency spikes in JVM services) |
| **Memory limit** | One leaking pod taking down the whole node; Chapter 10's `MaxRAMPercentage` keeps the JVM inside it |
| **Zone spread** | Losing an availability zone means losing a third of the pods, not all of them |
| **Read-only filesystem, non-root, no capabilities** | Limits what an attacker can do inside a compromised container |

## Step 3 — Services and the Only Way In

Every service gets a stable internal name:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app.kubernetes.io/name: order-service
  ports:
    - port: 80          # the gateway calls http://order-service (Chapter 6)
      targetPort: 8080
```

Only the **gateway** is exposed to the internet, through an AWS Application Load Balancer created by the AWS Load Balancer Controller:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-south-1:123456789012:certificate/example
spec:
  ingressClassName: alb
  rules:
    - host: api.shopnorth.example
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-gateway
                port:
                  number: 80
```

And **NetworkPolicies** make the Chapter 7 rule real inside the cluster — only the gateway may call the Order service:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: order-service-allow-gateway
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: order-service
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: api-gateway
      ports:
        - port: 8080
```

## Step 4 — Configuration and Secrets

Non-secret settings live in a ConfigMap (in Git). Secrets live in **AWS Secrets Manager**, and the **External Secrets Operator** copies them into a Kubernetes Secret, refreshing them when they rotate:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-service-config
data:
  SPRING_PROFILES_ACTIVE: production
  DB_URL: jdbc:postgresql://orders-prod.c4example1xyz.ap-south-1.rds.amazonaws.com:5432/orders
  INVENTORY_URL: http://inventory-service
  SPRING_KAFKA_BOOTSTRAP_SERVERS: b-1.shopnorth.kafka.ap-south-1.amazonaws.com:9098
---
apiVersion: external-secrets.io/v1beta1        # newer operator releases also serve external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: order-service-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: order-service-secrets                 # the Kubernetes Secret the Deployment reads
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: production/order-service/db
        property: password
    - secretKey: PAYMENT_WEBHOOK_SECRET
      remoteRef:
        key: production/payment/webhook
        property: secret
```

The pod's service account is linked to an IAM role (IRSA or EKS Pod Identity), so AWS access never involves stored keys.

## Step 5 — Autoscaling for the Sale

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service
spec:
  scaleTargetRef:
    apiVersion: argoproj.io/v1alpha1
    kind: Rollout                     # in production the Rollout (Step 7) owns the pods
    name: order-service
  minReplicas: 3
  maxReplicas: 12                     # capped by database connections, not just by CPU
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # don't shrink right after a burst
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: order-service
spec:
  minAvailable: 2                      # node upgrades never take more than one pod at a time below this
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
```

Two layers scale: the **HPA** adds pods when CPU rises, and **Karpenter** adds EC2 nodes when pods can't be scheduled. Why `maxReplicas: 12`? Chapter 5's math: 12 pods × 10 connections = 120 connections, safely under the database limit together with the other services. Scaling pods beyond what the database can serve just moves the bottleneck.

<div class="callout-warn">

**Autoscaling reacts in minutes; the 8 PM sale spike happens in seconds.** New pods need time to be scheduled, start the JVM, and warm up. For known events, ShopNorth **pre-scales**: a GitOps change the afternoon before raises `minReplicas` for every service (and Karpenter's node pool), then lowers it the next morning. Autoscaling handles the surprises; pre-scaling handles the schedule. Chapter 14 shows the full plan.

</div>

## Step 6 — A Deployment Without Dropped Requests

When a new version rolls out, each old pod goes through this sequence:

1. Kubernetes marks the pod as terminating and starts **removing it from Service endpoints** and the load balancer's targets — this takes a few seconds to spread.
2. At the same time, the **`preStop` hook sleeps 10 s**, so the pod keeps serving requests that still arrive during that propagation.
3. Then the container gets **`SIGTERM`**. Spring's **graceful shutdown** (`server.shutdown: graceful`, Chapter 5) stops accepting new requests and lets in-flight ones finish (up to a configured timeout of about 30 s).
4. If anything is still running after **`terminationGracePeriodSeconds: 45`**, Kubernetes sends `SIGKILL`.

New pods receive traffic only once their readiness probe passes. Result: deployments during the sale drop zero requests — which Meera verifies by running the k6 load test *during* a deployment in staging.

## Step 7 — The Canary in Production (Argo Rollouts)

In production, the Order service's pods are managed by an **Argo Rollout** instead of a plain Deployment. It has the same pod template, plus a release strategy:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: order-service
spec:
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
  template:
    # ... the same pod template as the Deployment in Step 2 ...
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: canary-health        # Datadog queries, defined in Chapter 13
            args:
              - { name: service, value: order-service }
        - setWeight: 50
        - pause: { duration: 10m }
        - analysis:
            templates:
              - templateName: canary-health
            args:
              - { name: service, value: order-service }
        # then 100%
```

For internal services without a service mesh, the weight is approximated by the number of pods (10% ≈ 1 canary pod out of 10). Precise traffic percentages would need a mesh or ingress-level traffic splitting, which the team decided wasn't worth the complexity yet. If the analysis fails, Argo Rollouts **aborts automatically** and scales the canary down; the stable version never stopped serving.

Day-to-day commands the team uses:

```bash
kubectl get pods -l app.kubernetes.io/name=order-service -n shopnorth
kubectl describe pod <pod> -n shopnorth            # events: probe failures, OOMKilled, scheduling
kubectl logs <pod> -n shopnorth --since=10m
kubectl argo rollouts get rollout order-service -n shopnorth --watch
kubectl argo rollouts abort order-service -n shopnorth    # emergency stop of a canary
```

## Step 8 — Guardrails for the Whole Cluster

- **Namespaces and RBAC:** developers can read logs and pod status in production but can't change anything; changes go through GitOps.
- **Admission policies (Kyverno):** pods must run as non-root, set resource requests, and use **signed images** from ShopNorth's registry; anything else is rejected at admission.
- **Separate clusters** for staging and production, so a staging experiment can't affect customers.

<!-- aws-section:start -->

## ☁️ ShopNorth on AWS — The Foundation Under the Cluster

Kubernetes sits on AWS building blocks that Kabir built with Terraform before week 10:

| Building block | ShopNorth's setup | Learn it |
|----------------|-------------------|----------|
| Network | VPC `10.20.0.0/16` across 3 zones: public subnets for the ALB and NAT gateways, large private subnets for pods, data subnets with no internet route | [Networking & VPC](/tutorials/aws-networking-vpc) |
| Firewalls | Security groups chained ALB → nodes → RDS, Redis, MSK, OpenSearch | [Networking & VPC](/tutorials/aws-networking-vpc) |
| Cluster | EKS control plane run by AWS; access entries map SSO roles to read-only Kubernetes access | [Containers on AWS](/tutorials/aws-containers) |
| Nodes | A managed node group (an Auto Scaling group) for add-ons; Karpenter-launched EC2 nodes for the services | [EC2 & Auto Scaling](/tutorials/aws-ec2-autoscaling) |
| Load balancer | The ALB created by the AWS Load Balancer Controller: readiness health checks, a 30 s deregistration delay | [EC2 & Auto Scaling](/tutorials/aws-ec2-autoscaling) |
| Permissions | One IAM role per service through Pod Identity | [IAM](/tutorials/aws-iam) |

<!-- aws-section:end -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A team's liveness probe called a health endpoint that checked the database. During a 40-second database failover, every pod's liveness probe failed, and Kubernetes restarted all of them at once. The JVMs restarted cold just as the database came back, and a 40-second blip became an 8-minute outage. **Decision**: Liveness checks only whether the process itself is healthy (Spring's liveness group). Dependency health belongs in readiness at most — and even there carefully, because if every pod becomes unready at once, nothing serves traffic. Timeouts, circuit breakers, and degraded responses handle dependency failures.

</div>

<div class="callout-scenario">

**Scenario**: During a sale, the HPA scaled a service from 4 to 40 pods as CPU climbed. Each pod opened a 20-connection pool, the database hit its connection limit, new pods couldn't connect, failed readiness, and the HPA added still more pods. The scaling made the outage worse. **Decision**: Cap `maxReplicas` using database capacity, size pools small (connections are rarely the bottleneck at 20 ms per transaction), put PgBouncer in front of the database for bursty workloads, pre-scale for known events, and alert on connection usage, not just CPU.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [Kubernetes Fundamentals](/tutorials/k8s-fundamentals) | Pods, nodes, control plane | The foundation for everything here |
| [Workloads](/tutorials/k8s-workloads) | Deployments, rollouts, PDBs | Deployment + Rollout + PodDisruptionBudget |
| [Networking](/tutorials/k8s-networking) | Services, Ingress, DNS, NetworkPolicy | Internal names, the ALB ingress, network rules |
| [Config, Secrets & Storage](/tutorials/k8s-config-storage) | ConfigMaps, Secrets, external secret stores | ConfigMap + External Secrets from AWS |
| [Deploying Spring Boot on Kubernetes](/tutorials/k8s-spring-boot) | Probes, graceful shutdown, JVM sizing | The probe and shutdown setup |
| [Kubernetes in Production](/tutorials/k8s-production) | Autoscaling, GitOps, policies | HPA, Karpenter, Argo CD, Kyverno |
| [Load Balancing](/tutorials/load-balancing) | L7 load balancers, health checks | The ALB in front of the gateway |
| [Service Discovery & Config](/tutorials/service-discovery) | DNS-based discovery | `http://order-service` |
| [Networking & VPC](/tutorials/aws-networking-vpc) | VPC, subnets, security groups | The network the cluster runs in |
| [EC2, Load Balancers & Auto Scaling](/tutorials/aws-ec2-autoscaling) | Instances, target groups, Auto Scaling, quotas | Nodes, the ALB, and capacity for the sale |
| [Containers on AWS](/tutorials/aws-containers) | ECR, EKS specifics, upgrades | The EKS clusters and how they're upgraded |
| [High Availability & DR](/tutorials/high-availability) | Zone failures, static stability | Why pods spread across three zones with headroom |

## 📚 Extra Case Studies

Running containers at scale elsewhere: [Live Streaming Platform](/tutorials/live-streaming-platform) (pre-scaling for a known start time), [Data Ingestion Platform](/tutorials/data-ingestion-platform) (scaling workers on queue depth), and [Cloud & Infrastructure Decisions](/tutorials/cloud-infra-decisions) (when Kubernetes is worth it versus ECS or Lambda).

## 🛠️ Mini Project — Build ShopNorth, Step 12: Kubernetes

**Goal**: Your mini ShopNorth running on a local Kubernetes cluster like production. 1 week of evenings.

**Build**

1. Create a local cluster with kind or minikube; run PostgreSQL and Kafka inside it for practice (production would use managed services).
2. Write a Helm chart for your order service: Deployment with startup/readiness/liveness probes, resources, security context, zone spread (harmless on one node), Service, ConfigMap, Secret.
3. Add an HPA and a PodDisruptionBudget; generate load with k6 and watch it scale.
4. Install Argo Rollouts and convert the Deployment to a Rollout with a 25% → 50% → 100% canary; deploy a deliberately broken version and abort it.
5. Prove graceful deploys: run k6 during a rollout and confirm zero failed requests.
6. Optional: install Argo CD and deploy from a GitOps repo instead of `helm install`.

**Acceptance criteria**: zero failed requests during a rollout; the HPA scales up under load and back down after; a broken canary never reaches 100%.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Explain the difference between startup, readiness, and liveness probes, with what happens when each fails.

<details>
<summary>Show answer</summary>

**Startup:** "has the app finished starting?" While it hasn't passed, the other probes are ignored; if it fails for too long, the container is restarted. It protects slow starters like JVMs. **Readiness:** "should this pod receive traffic now?" Failing removes the pod from Service endpoints (no restart); passing adds it back. **Liveness:** "is the process stuck beyond recovery?" Failing restarts the container. Liveness must only check the app itself, or a dependency outage restarts every pod.

</details>

**L2.** Why does ShopNorth set a memory limit but no CPU limit?

<details>
<summary>Show answer</summary>

Memory isn't compressible: a pod that grows without bound can crash the node, so a limit (with the JVM sized inside it) contains the damage. CPU *is* compressible: with only a request, the pod is guaranteed its requested share and may use idle CPU beyond it, while CPU limits cause **throttling** that shows up as latency spikes (JVMs with many threads and GC activity are especially sensitive). Requests still make scheduling fair. Some organizations require CPU limits for strict multi-tenancy; then set them generously and watch the throttling metrics.

</details>

### 🟡 Medium — Apply it

**M1.** The database allows 400 connections. Order (pool 10), Inventory (pool 10), Catalog (pool 8), and Payment (pool 6) all autoscale. How do you set `maxReplicas`?

<details>
<summary>Show answer</summary>

Reserve headroom first (admin, migrations, monitoring, replicas): say 50 connections, leaving 350 for apps. Allocate by need: with three separate databases in ShopNorth's design, each database's budget only covers its own services, which makes this easier — e.g., Order DB: order-service 12 pods × 10 = 120. If services share a database, split the budget: e.g., Inventory 15 × 10 = 150, Catalog 15 × 8 = 120, Payment 10 × 6 = 60 → 330. Then validate with a load test that the database itself (CPU, I/O, locks) handles the corresponding query load, and alert at 80% of connection usage. If the math doesn't fit, add PgBouncer or reduce pool sizes rather than raising the database limit blindly.

</details>

**M2.** Write the timeline of an old pod's shutdown during a rolling deployment, and explain why the `preStop` sleep is needed.

<details>
<summary>Show answer</summary>

t=0: the pod is marked terminating; endpoint removal starts propagating to kube-proxy and the load balancer (asynchronous, takes a few seconds), and the `preStop` hook starts (sleep 10 s), during which the pod keeps serving. t=10 s: `SIGTERM` is sent; Spring graceful shutdown stops accepting new connections and finishes in-flight requests (up to ~30 s). t≈10-40 s: the app exits normally. t=45 s: `SIGKILL` if anything is still running. Without the sleep, `SIGTERM` can arrive while load balancers still route new requests to the pod, which then get connection errors — the classic "a few 502s on every deploy".

</details>

### 🔴 High — Think like a senior

**H1.** On sale day, traffic goes from 300 to 3,000 requests/s within two minutes of 8 PM. The HPA reacts too slowly. Design the scaling plan.

<details>
<summary>Show answer</summary>

Don't rely on reactive scaling for a scheduled spike. **Pre-scale** at ~6 PM via GitOps: raise `minReplicas` to the load-tested peak count for every service and pre-provision nodes (Karpenter node pool minimums or overprovisioning placeholder pods with low priority, which get evicted to make room instantly). **Warm up:** pods ready well before 8 PM, caches warmed with the sale catalog, JIT warmed by synthetic traffic. **Protect the core:** gateway rate limits and a waiting room for the flash deal (Chapter 14). **Keep HPA on** above the new minimum for surprises, with fast scale-up and slow scale-down policies. **Verify:** a staging spike test with the same pattern a week earlier. Scale back down the next morning, again via GitOps.

</details>

**H2.** One availability zone fails during the sale. Walk through what keeps ShopNorth running.

<details>
<summary>Show answer</summary>

**Pods:** zone spread put about a third of each service's pods in each zone; the remaining two thirds keep serving, readiness removes dead pods, and the HPA plus Karpenter create replacements in healthy zones (pre-scaling should leave enough headroom to run on two zones). **Load balancer:** the ALB spans zones and stops routing to unhealthy targets. **Databases:** RDS Multi-AZ fails over to the standby in another zone (typically within a minute or two); apps see brief connection errors, and retries plus circuit breakers absorb them. Liveness doesn't check the database, so pods aren't restarted. **Redis and Kafka:** replicas and brokers in other zones take over; producers retry, and the outbox buffers events. **Monitoring:** Datadog alerts fire, and the on-call engineer follows the zone-failure runbook (Chapter 14). The design goal: N+1 capacity across zones, with no single-zone dependency.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What do you need to run a Spring Boot service well on Kubernetes?"**

Separate startup, readiness, and liveness probes, using Spring Actuator's probe groups. Liveness checks only the app, never the database. I set CPU and memory requests for scheduling and a memory limit, with the JVM heap sized as a percentage of it. Graceful shutdown means a preStop delay, Spring's graceful shutdown, and a termination grace period longer than both. Configuration comes from ConfigMaps, and secrets come from an external store like AWS Secrets Manager through the External Secrets Operator. Then a non-root, read-only security context, pods spread across zones, a PodDisruptionBudget, and an HPA whose max is set with downstream limits like database connections in mind. Everything is deployed through GitOps.

</div>

<div class="callout-interview">

**Q: "What's the difference between readiness and liveness probes, and what goes wrong when they're misconfigured?"**

Readiness decides whether a pod receives traffic; failing it takes the pod out of the load balancer without restarting it. Liveness decides whether the container is restarted. The classic mistake is a liveness check that depends on the database or another service. During a dependency blip, every pod fails liveness and restarts at once, turning a short blip into a full outage. Another mistake is no startup probe for slow-starting JVMs, so liveness kills them before they finish starting, in a loop. Readiness that depends on shared dependencies can also take all pods out of service at once, so I use it carefully.

</div>

<div class="callout-interview">

**Q: "How does autoscaling work in Kubernetes, and what are its limits?"**

The Horizontal Pod Autoscaler adjusts replica counts based on metrics, usually CPU utilization relative to requests, or custom metrics like request rate or queue lag. A cluster autoscaler or Karpenter adds nodes when pods can't be scheduled. The limits: it's reactive and takes minutes, between metrics, scheduling, new nodes, and JVM warm-up, so sudden scheduled spikes need pre-scaling. It also scales the pods, not their dependencies, so you cap max replicas using database and downstream capacity, or scaling just moves the bottleneck. And CPU is a proxy: for I/O-bound services, request-rate or latency-based metrics often scale better.

</div>

> **Golden rule: Kubernetes keeps your service alive only if you tell it the truth — honest probes, real resource needs, and limits that respect what's downstream.**

<div class="callout-journey">

➡️ **Next: [Chapter 13 · Observability with Datadog](/tutorials/journey-13-observability)** — ShopNorth runs in production. But is it *healthy*? Kabir wires up Datadog: traces, logs, and metrics tied together, dashboards on the golden signals, SLOs from Chapter 1's NFRs, monitors that page the right person, and synthetic checks that test checkout every minute.

</div>
