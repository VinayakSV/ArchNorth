# Containers on AWS — ECR, ECS & EKS: The Shipping Port Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Deployment — infrastructure & runtime** · ShopNorth uses this in [Chapter 12 · Deploying on Kubernetes](/tutorials/journey-12-kubernetes)

</div>
<!-- sdlc-stage:end -->

## The Shipping Port Analogy

Global trade runs on standard shipping containers, and a port has a few distinct parts:

- A **container depot** where sealed containers are stored, labeled, inspected for dangerous goods, and released only to authorized trucks. That's **ECR**, the container registry.
- A **port authority with its own simple rules**: you say "keep 6 of these containers moving, replace any that break", and it handles the rest. Easy to learn, works only at this port. That's **ECS**.
- A port that follows the **international standard procedures** every major port uses — more paperwork and more options, but your team's skills and tools work at any port in the world. That's **EKS**, managed Kubernetes.
- Instead of owning a ship, you can **rent space on someone else's ship** and never think about engines or crews. That's **Fargate**.

Docker built the containers ([Docker Fundamentals](/tutorials/docker-fundamentals)); this tutorial is about where they're stored and how AWS runs them.

## 1. ECR: Your Private Registry

**Amazon ECR** stores container images close to where they run, with IAM-controlled access. ShopNorth keeps one repository per service in its `shared` account, and staging and production pull from it.

| Feature | What it does | ShopNorth's setting |
|---------|-------------|---------------------|
| **Immutable tags** | A tag can never be overwritten | On — tags are commit SHAs, so `3f9c1a2b7d4e` always means the same image |
| **Scan on push** | Finds known vulnerabilities in OS packages (basic) or OS + language packages (enhanced, via Amazon Inspector) | Enhanced scanning; critical findings raise an EventBridge alert |
| **Lifecycle policy** | Deletes old images automatically | Keep the last 50 per repository |
| **Repository policy** | Lets other accounts pull | `staging` and `production` accounts may pull |
| **Replication** | Copies images to other regions or accounts | To Hyderabad for disaster recovery |
| **Pull-through cache** | Caches images from public registries (Docker Hub, GitHub, Quay…) | Base images come through it — no public rate limits during scale-out |

```bash
aws ecr create-repository --repository-name order-service \
  --image-tag-mutability IMMUTABLE \
  --image-scanning-configuration scanOnPush=true

aws ecr put-lifecycle-policy --repository-name order-service --lifecycle-policy-text '{
  "rules": [{
    "rulePriority": 1,
    "description": "Keep the last 50 images",
    "selection": { "tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 50 },
    "action": { "type": "expire" }
  }]
}'
```

CI pushes with short-lived credentials from GitHub OIDC (Chapter 11), and images are signed in the pipeline; an admission policy in the cluster only runs signed images from this registry (Chapter 12).

## 2. ECS: AWS's Own Container Orchestrator

**Amazon ECS** runs containers with a small set of concepts:

| Concept | Meaning |
|---------|---------|
| **Cluster** | A logical group of capacity |
| **Task definition** | The blueprint: images, CPU and memory, ports, environment, secrets, logging, IAM roles |
| **Task** | A running instance of a task definition (like a pod) |
| **Service** | Keeps N tasks running, replaces failed ones, registers them with a load balancer, deploys new versions |
| **Capacity provider** | Where tasks run: **Fargate**, **Fargate Spot**, or your own EC2 Auto Scaling groups |

A Fargate task definition for a Spring Boot service looks like this (abridged):

```json
{
  "family": "order-service",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789012:role/order-service-ecs-execution",
  "taskRoleArn": "arn:aws:iam::123456789012:role/order-service-prod",
  "containerDefinitions": [{
    "name": "app",
    "image": "123456789012.dkr.ecr.ap-south-1.amazonaws.com/order-service:3f9c1a2b7d4e",
    "portMappings": [{ "containerPort": 8080 }],
    "environment": [{ "name": "SPRING_PROFILES_ACTIVE", "value": "production" }],
    "secrets": [{
      "name": "DB_PASSWORD",
      "valueFrom": "arn:aws:secretsmanager:ap-south-1:123456789012:secret:production/order-service/db-AbC123:password::"
    }],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": { "awslogs-group": "/ecs/order-service", "awslogs-region": "ap-south-1", "awslogs-stream-prefix": "app" }
    }
  }]
}
```

<div class="callout-info">

**Two roles, two jobs.** The **execution role** is used by ECS itself to pull the image from ECR and fetch the secrets in `secrets`. The **task role** is what *your code* gets through the SDK — for the Order service, access to its Kafka topics. Mixing them up is the most common ECS permission bug.

</div>

ECS services deploy with **rolling updates** (`minimumHealthyPercent` / `maximumPercent`) or **blue/green**, integrate with ALB target groups and health checks, scale with Application Auto Scaling (CPU, memory, request count per target), and discover each other with **ECS Service Connect**.

## 3. EKS: Managed Kubernetes

With **Amazon EKS**, AWS runs the Kubernetes control plane — API servers and etcd spread across three availability zones — and you run (or delegate) the nodes. Everything you learned in the [Kubernetes section](/tutorials/k8s-fundamentals) applies; these are the AWS-specific parts:

| Area | AWS specifics | ShopNorth |
|------|--------------|-----------|
| **Control plane** | Managed, multi-AZ; billed per cluster per hour | Two clusters: `shopnorth-staging`, `shopnorth-prod`, built with Terraform |
| **Versions** | Each Kubernetes version gets standard support, then a paid extended-support period | Upgrades twice a year, staging first |
| **Nodes** | Managed node groups, Karpenter, Fargate profiles, or EKS Auto Mode (AWS manages nodes for you) | Managed node group for add-ons + Karpenter for services ([EC2 & Auto Scaling](/tutorials/aws-ec2-autoscaling)) |
| **Pod networking** | The VPC CNI gives every pod a real VPC IP address | Large `/20` app subnets ([Networking & VPC](/tutorials/aws-networking-vpc)) |
| **Pod permissions** | EKS Pod Identity or IRSA | One IAM role per service ([IAM](/tutorials/aws-iam)) |
| **Load balancing** | AWS Load Balancer Controller creates ALBs/NLBs from Ingress and Service objects | One ALB for `api.shopnorth.example` |
| **Storage** | EBS CSI driver (block volumes), EFS CSI driver (shared files) | Not needed — stateful systems are managed services |
| **Cluster access** | **Access entries** map IAM roles to Kubernetes permissions | SSO `ReadOnly` → view-only in production; changes only through Argo CD |

Getting `kubectl` access is one command after an SSO login:

```bash
aws sso login --profile shopnorth-prod-readonly
aws eks update-kubeconfig --name shopnorth-prod --region ap-south-1 --profile shopnorth-prod-readonly
kubectl get pods -n shopnorth                 # allowed: read
kubectl delete pod order-service-abc -n shopnorth   # Forbidden: production changes go through GitOps
```

<div class="callout-warn">

**Upgrades are where EKS bites.** Each Kubernetes release removes old API versions; manifests or Helm charts that still use them fail after the upgrade. ShopNorth's upgrade checklist: scan manifests for deprecated APIs, upgrade add-ons (VPC CNI, CoreDNS, kube-proxy, the Load Balancer Controller) to compatible versions, upgrade the control plane in staging, run the regression suite, roll nodes (Karpenter replaces them gradually, respecting PodDisruptionBudgets), then repeat in production a week later.

</div>

## 4. Fargate: No Nodes at All

**Fargate** runs each ECS task or EKS pod on its own isolated, right-sized compute — you pick vCPU and memory per task and never see an instance.

| | Fargate | EC2 nodes |
|---|---|---|
| Operations | No patching, no node scaling | You manage AMIs, scaling, and node upgrades (or Karpenter/Auto Mode does) |
| Pricing | Per vCPU and GB per second, per task | Per instance, regardless of how full it is |
| Efficiency | No unused node capacity | Can bin-pack many small pods cheaply |
| Limits | No privileged containers or DaemonSets on EKS Fargate; GPU support is limited | Anything goes |
| Good for | Small teams, spiky or isolated workloads | Large, steady fleets; special hardware |

## 5. ECS or EKS?

| Question | Points to ECS | Points to EKS |
|----------|---------------|---------------|
| Team Kubernetes experience | Little | Strong, or a platform team |
| Ecosystem needs | Plain services and workers | Operators, Helm charts, Argo CD/Rollouts, service meshes |
| Portability | AWS only is fine | Multi-cloud or on-prem matters |
| Operational budget | Minimal | Can afford upgrades and add-ons |
| Number of services | A handful | Many, with shared platform conventions |

ShopNorth chose EKS because Kabir already runs Kubernetes well and the team wanted Argo CD, Argo Rollouts canaries, and Kyverno policies (Chapters 11-12). A team of three building five services would very reasonably choose ECS on Fargate. The deeper trade-offs are in [Cloud & Infrastructure Decisions](/tutorials/cloud-infra-decisions).

## 6. Image Hygiene That Pays Off on AWS

| Habit | Payoff |
|-------|--------|
| Small images (JRE only, multi-stage builds) | Faster pulls during scale-out, fewer vulnerabilities |
| Non-root user, read-only filesystem | Smaller blast radius if compromised |
| Immutable tags = commit SHAs | You always know what's running; rollbacks are exact |
| Scanning in CI *and* in ECR | Catch issues at build time and when new CVEs are published later |
| Signing + admission checks | Only images built by your pipeline can run |
| Multi-arch builds (amd64 + arm64) | Unlock cheaper Graviton capacity |
| Pull-through cache for base images | No surprise rate limits from public registries |

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: During a traffic spike, a team's new pods failed with `ImagePullBackOff`. Their images were based on a public Docker Hub image pulled at startup by every new node, and they'd hit Docker Hub's anonymous pull rate limit from their NAT gateway's single IP address. **Decision**: All images — including base images through an ECR pull-through cache — come from ECR in the same region, which also cut NAT costs and pull times.

</div>

<div class="callout-scenario">

**Scenario**: A team upgraded their EKS cluster two versions in one evening. Afterwards, a Helm chart still used an API version that had been removed, so its resources failed to update, and an old ingress controller stopped routing traffic. **Decision**: One minor version at a time, staging first, with an automated check for deprecated APIs in CI, add-on upgrades planned with each step, and a written rollback plan (blue/green clusters for risky jumps).

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why does ShopNorth make ECR tags immutable and use commit SHAs as tags instead of `latest`?

<details>
<summary>Show answer</summary>

With immutable tags, a tag can never point to a different image later, so `order-service:3f9c1a2b7d4e` is exactly the code from that commit — in staging, production, and any rollback. `latest` changes with every push, so two nodes can run different code under the same name, rollbacks are guesswork, and audits can't tell what was running.

</details>

**L2.** In ECS, which role is used to pull the image and read the secrets in the task definition, and which role does the application code use?

<details>
<summary>Show answer</summary>

The **task execution role** is used by the ECS agent/Fargate to pull the image from ECR, fetch secrets referenced in the task definition, and send logs. The **task role** is assumed by the application's code (through the SDK's credential chain) for its own AWS calls, like reading from S3 or using MSK topics.

</details>

### 🟡 Medium — Apply it

**M1.** Your EKS pods can't pull images from ECR in another account (`ImagePullBackOff`, `403`). What do you check?

<details>
<summary>Show answer</summary>

(1) The ECR **repository policy** in the `shared` account allows the production account (or the node role's ARN) to `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, and `ecr:BatchCheckLayerAvailability`. (2) The **node IAM role** (image pulls use the node's credentials, not the pod's) has ECR read permissions and `ecr:GetAuthorizationToken`. (3) Network: private nodes reach ECR via NAT or the ECR interface endpoints, plus the S3 gateway endpoint for image layers. (4) The image tag actually exists (immutable tags + lifecycle policies can expire old ones). (5) If the repository uses KMS encryption, the key policy allows the consumer.

</details>

**M2.** A startup with 4 engineers and 6 Spring Boot services asks whether to start on EKS or ECS Fargate. Recommend and justify.

<details>
<summary>Show answer</summary>

**ECS on Fargate.** No cluster upgrades, add-ons, or node management; task definitions, services, ALB integration, Secrets Manager, and autoscaling cover everything 6 services need; costs are per task. EKS would add an ongoing operational load (version upgrades several times a year, add-ons, node management) that a 4-person team would feel every month, for ecosystem benefits they don't need yet. Revisit if the company grows a platform team, needs Kubernetes-specific tooling, or must run on another cloud. Record the decision as an ADR with those triggers.

</details>

### 🔴 High — Think like a senior

**H1.** Design ShopNorth's EKS upgrade process so that a Kubernetes version upgrade never causes a customer-visible incident.

<details>
<summary>Show answer</summary>

**Prepare:** read the release notes and EKS upgrade insights; a CI job scans manifests and Helm charts for removed APIs; check add-on compatibility (VPC CNI, CoreDNS, kube-proxy, Load Balancer Controller, Karpenter, External Secrets, Argo CD, Datadog). **Staging first:** upgrade the control plane, then add-ons, then roll nodes (Karpenter drift replacement, respecting PodDisruptionBudgets); run the full regression and a k6 load test, including a deploy during load. **Production:** a week later, outside sale periods (change freeze around sales), with dashboards and the canary analysis watched; nodes roll gradually across zones. **Rollback:** the control plane can't be downgraded, so for risky jumps use blue/green clusters (a new cluster, shift traffic by DNS weights, keep the old one for a while). **Afterwards:** document issues found, and keep at most one version behind the latest supported.

</details>

**H2.** ShopNorth wants to cut compute cost by running the catalog and search services on Fargate Spot (ECS) or Spot nodes (EKS). What has to be true for this to be safe?

<details>
<summary>Show answer</summary>

The services must be stateless and tolerate losing instances with two minutes' notice: graceful shutdown on `SIGTERM` within that window, readiness probes, and enough replicas that losing several at once doesn't hurt (PodDisruptionBudgets on EKS; a minimum on-demand base on ECS capacity providers). Keep a baseline on on-demand capacity able to serve normal traffic, diversify instance types and zones (Karpenter or mixed capacity providers), and keep checkout, payments, and anything stateful off Spot. Exclude Spot during sale peaks. Measure interruption frequency and its effect on error rates in staging before production.

</details>

## 🛠️ Mini Project — Same Service, Two Orchestrators

**Goal**: Feel the difference between ECS and EKS by deploying one service to both. 1-2 weekends (destroy everything afterwards; EKS bills per cluster hour).

**Build**

1. Create an ECR repository with immutable tags, scan on push, and a lifecycle policy; push your Spring Boot image tagged with the commit SHA.
2. Deploy it to **ECS on Fargate** behind an ALB: a task definition with a secret from Secrets Manager, a service with 2 tasks, health checks on `/actuator/health/readiness`, and CPU-based autoscaling.
3. Deploy the same image to **EKS** (eksctl or Terraform's EKS module): a Deployment, Service, and an Ingress through the AWS Load Balancer Controller; give the pod its own role with Pod Identity.
4. Do a rolling deploy on both while running k6, and compare: errors, time to complete, and what you had to configure.
5. Write a one-page comparison: setup time, moving parts, cost per month at your size, and which you'd choose for a 5-person team.

**Acceptance criteria**: both deployments serving traffic, zero-error rolling deploys on both, and a written recommendation with numbers.

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How do you choose between ECS and EKS?"**

Both run containers reliably. The difference is operational cost against ecosystem and portability. ECS is AWS-native and simple, with no control-plane versions to upgrade or add-ons to manage, and on Fargate there are no nodes at all. It's my default for small teams and AWS-only shops. EKS gives you Kubernetes: a huge ecosystem of operators, Helm, GitOps tools, progressive delivery, and skills and manifests that move across clouds. You pay for that with upgrades, add-ons, and more expertise. I'd choose EKS when there's a platform team or a clear need for that ecosystem, and record the decision with the triggers that would change it.

</div>

<div class="callout-interview">

**Q: "What does EKS manage for you, and what's still your responsibility?"**

EKS runs and scales the Kubernetes control plane, the API servers and etcd, across three availability zones, and patches it. I'm still responsible for the cluster version upgrades, which I trigger, and the add-ons like VPC CNI, CoreDNS, kube-proxy, and the load balancer controller. Nodes too, unless I use Fargate or Auto Mode: their AMIs, scaling, and replacement, which Karpenter or managed node groups help with. Plus workload security: IAM per pod with Pod Identity, network policies, admission policies, and image provenance. And of course the applications, their probes, resources, and disruption budgets.

</div>

<div class="callout-interview">

**Q: "How do you secure the container supply chain on AWS?"**

Images are built only in CI from reviewed code, with small base images pulled through an ECR pull-through cache. CI scans them with something like Trivy, generates an SBOM, signs them, and pushes to ECR with immutable tags equal to the commit SHA, using OIDC credentials rather than stored keys. ECR scans again continuously, so newly published vulnerabilities in old images are flagged, and critical findings alert the team through EventBridge. In the cluster, an admission policy only allows signed images from our registry, running as non-root with read-only filesystems. Lifecycle policies remove stale images, so the registry doesn't fill up with old, vulnerable versions.

</div>

## Quick Reference

| Concept | Remember |
|---------|----------|
| ECR | Private registry; immutable SHA tags, scanning, lifecycle, replication, pull-through cache |
| ECS | Task definitions + services; Fargate or EC2 capacity |
| ECS roles | Execution role (pull, secrets, logs) vs task role (your code) |
| EKS | Managed control plane; you own upgrades, add-ons, nodes |
| EKS nodes | Managed node groups, Karpenter, Fargate, Auto Mode |
| EKS access | Access entries map IAM roles to Kubernetes permissions |
| Fargate | No nodes; per-task pricing; some limits |
| Choose ECS | Small team, AWS-only, simple services |
| Choose EKS | Platform team, Kubernetes ecosystem, portability |

> **Golden rule: pick the orchestrator your team can operate on its worst day — not the one with the most features.**

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth pushes signed, SHA-tagged images to ECR from CI and runs them on two EKS clusters with Karpenter nodes and Pod Identity. A smaller team could run the same services on ECS Fargate; Chapter 12 explains why ShopNorth chose Kubernetes.

**Continue the story:** [Chapter 12 · Deploying on Kubernetes](/tutorials/journey-12-kubernetes) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
