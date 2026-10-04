# CloudFormation, SAM & CDK — Infrastructure as Code: The Architect's Blueprint Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Deployment — CI/CD** · ShopNorth uses this in [Chapter 11 · CI/CD Pipeline](/tutorials/journey-11-cicd)

</div>
<!-- sdlc-stage:end -->

## The Architect's Blueprint Analogy

Imagine building houses by phoning the workers: "add a window here… actually, a bit to the left… now a door". Nobody could build a second identical house, and nobody would remember why the window moved.

A construction company works from **blueprints** instead:

- The architect draws the **blueprint**; the company builds exactly what it shows. That's a **template** and a **stack**.
- For a renovation, the architect submits a revised blueprint, and the company first sends a report: "we'll add a balcony, repaint the kitchen, and **demolish and rebuild the garage**". That's a **change set** — and that last line is the one to read twice.
- If construction fails halfway, the company **restores the last good state** instead of leaving a half-built wall. That's **automatic rollback**.
- Inspectors periodically compare the building with the blueprint and report unauthorized changes. That's **drift detection**.
- Standard designs — a kitchen, a staircase — are reused across projects. Those are **modules** and **constructs**, and design software that produces blueprints from higher-level choices is **CDK**.

Infrastructure as code (IaC) means your AWS resources are defined in files, reviewed like code, versioned in Git, and created by a tool — never by memory and clicking.

## 1. Why Infrastructure as Code

| Without IaC ("ClickOps") | With IaC |
|-------------------------|----------|
| Staging and production slowly differ | Environments come from the same code with different parameters |
| "Who opened port 22 last month?" | Every change is a reviewed pull request with an author and a reason |
| Recreating a region takes days of guesswork | ShopNorth's DR plan rebuilds the platform in Hyderabad from the same code ([High Availability & DR](/tutorials/high-availability)) |
| Changes are applied, then discovered | Changes are previewed (change sets, plans) before they happen |

## 2. CloudFormation Template Anatomy

A template is YAML or JSON with a few sections — only `Resources` is required:

| Section | Purpose |
|---------|---------|
| `Parameters` | Inputs per environment (bucket names, sizes) |
| `Mappings` / `Conditions` | Lookup tables and "only in production" logic |
| `Resources` | The AWS resources to create |
| `Outputs` | Values to show or export to other stacks |
| `Transform` | Macros, like SAM's |

Common **intrinsic functions**: `!Ref` (a parameter or a resource's main ID), `!GetAtt` (a resource attribute, like a queue's ARN), `!Sub` (string interpolation with `${…}`), `!If`, `!ImportValue`, plus pseudo-parameters such as `${AWS::Region}` and `${AWS::AccountId}`. **Dynamic references** pull values at deploy time: `{{resolve:ssm:/shopnorth/prod/images-bucket}}` reads Parameter Store, and `{{resolve:secretsmanager:…}}` reads a secret without putting it in the template.

## 3. Stacks, Change Sets, and Safety Nets

| Feature | What it does | ShopNorth's rule |
|---------|-------------|------------------|
| **Change set** | Lists every add, modify, and remove before execution, including whether a modification needs **replacement** | Reviewed for every production change; any `Replacement: True` on a stateful resource stops the deploy |
| **Automatic rollback** | A failed update returns the stack to its previous state | Default on; rollback triggers watch CloudWatch alarms during deploys |
| **`DeletionPolicy: Retain` / `Snapshot`** | Keeps the resource (or a snapshot) even if the stack deletes it | On every database, bucket, and KMS key |
| **`UpdateReplacePolicy`** | Same protection when an update replaces a resource | Same resources |
| **Termination protection** | The stack can't be deleted until it's turned off | Production stacks |
| **Stack policy** | Forbids updates to specific resources | Protects data stores |
| **Drift detection** | Compares real resources with the template | Scheduled weekly; drift is a finding |
| **Nested stacks / exports** | Compose large systems; share outputs between stacks | Used sparingly — exports create hard dependencies |
| **StackSets** | Deploy one template to many accounts and regions | Account baselines (alarms, guardrail roles) |
| **IaC generator** | Creates a template from resources that already exist | Bringing old hand-made resources under code |

<div class="callout-warn">

**Some property changes replace the resource.** Renaming a database instance identifier, changing certain encryption settings, or editing a resource's name can make CloudFormation (and Terraform) *create a new resource and delete the old one*. For a database or bucket, that means data loss unless `DeletionPolicy`/`UpdateReplacePolicy` save it. Read the change set's **Replacement** column on every production change.

</div>

## 4. SAM: CloudFormation for Serverless

**AWS SAM** is a CloudFormation transform with shorthand for Lambda functions, their triggers, and permissions, plus a CLI to build, test locally, and deploy. ShopNorth's `image-resizer` ([Lambda](/tutorials/aws-lambda)) is one SAM stack:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: ShopNorth image resizer

Parameters:
  ImagesBucket:
    Type: String
    Default: shopnorth-product-images-prod     # created by Terraform; SAM only references it

Resources:
  ResizerFailures:
    Type: AWS::SQS::Queue
    Properties:
      MessageRetentionPeriod: 1209600          # 14 days to investigate failures

  ImageResizerFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: image-resizer
      Runtime: java21
      Handler: com.shopnorth.images.ImageResizer::handleRequest
      CodeUri: .
      MemorySize: 1536
      Timeout: 30
      AutoPublishAlias: live
      SnapStart:
        ApplyOn: PublishedVersions
      Policies:
        - Statement:
            - Effect: Allow
              Action: s3:GetObject
              Resource: !Sub arn:aws:s3:::${ImagesBucket}/originals/*
            - Effect: Allow
              Action: s3:PutObject
              Resource: !Sub arn:aws:s3:::${ImagesBucket}/resized/*
      EventInvokeConfig:
        MaximumRetryAttempts: 2
        DestinationConfig:
          OnFailure:
            Type: SQS
            Destination: !GetAtt ResizerFailures.Arn
      Events:
        OriginalUploaded:
          Type: EventBridgeRule
          Properties:
            Pattern:
              source: [aws.s3]
              detail-type: [Object Created]
              detail:
                bucket:
                  name: [!Ref ImagesBucket]
                object:
                  key: [{ prefix: originals/ }]

  FailuresAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: Image resizing failed for at least one upload
      Namespace: AWS/SQS
      MetricName: ApproximateNumberOfMessagesVisible
      Dimensions:
        - Name: QueueName
          Value: !GetAtt ResizerFailures.QueueName
      Statistic: Maximum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 0
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Sub arn:aws:sns:${AWS::Region}:${AWS::AccountId}:platform-alerts

Outputs:
  LiveAlias:
    Value: !Ref ImageResizerFunction.Alias
```

About 70 lines describe the function, its least-privilege permissions, its trigger, its failure queue, and an alarm. SAM expands it into the full CloudFormation resources (IAM role, EventBridge rule, Lambda permission, version, alias).

```bash
sam build                              # compiles the Java function
sam local invoke ImageResizerFunction --event events/object-created.json   # runs it locally in Docker
sam deploy --guided                    # first deploy: creates a change set and asks before executing
```

## 5. CDK: Infrastructure in a Programming Language

The **AWS CDK** lets you define infrastructure in TypeScript, Python, Java, Go, or C#; it **synthesizes** CloudFormation templates. Higher-level **constructs** bundle best practices, so a few lines create a correctly wired queue, DLQ, and permissions:

```java
// AWS CDK (Java): a queue with a DLQ, and permission for the notification role to consume it
Queue dlq = Queue.Builder.create(this, "EmailDlq")
        .retentionPeriod(Duration.days(14))
        .build();

Queue emailQueue = Queue.Builder.create(this, "EmailQueue")
        .visibilityTimeout(Duration.minutes(3))
        .deadLetterQueue(DeadLetterQueue.builder().queue(dlq).maxReceiveCount(5).build())
        .build();

emailQueue.grantConsumeMessages(notificationRole);   // generates a least-privilege IAM policy
```

`cdk diff` shows what will change; `cdk deploy` deploys the synthesized template as a CloudFormation stack.

## 6. Terraform, CloudFormation, or CDK?

| | CloudFormation (+ SAM) | CDK | Terraform |
|---|---|---|---|
| Language | YAML/JSON | General-purpose languages | HCL |
| State | Managed by AWS | Managed by AWS (it's CloudFormation underneath) | A state file you store and lock (S3) |
| Preview | Change sets | `cdk diff` | `terraform plan` |
| Failed deploy | Automatic rollback | Automatic rollback | Stops; you fix forward |
| Beyond AWS | AWS only (plus registry extensions) | AWS mainly | Many providers: Datadog, Auth0, GitHub, Kubernetes… |
| Best for | AWS-only teams, serverless (SAM), vendor templates | Teams that prefer code and abstractions | Multi-provider platforms |

**ShopNorth's split:**

- **Terraform** for the platform: VPCs, EKS, RDS, ElastiCache, MSK, S3 buckets, IAM roles for services, Route 53 — and, through other providers, Datadog monitors and Auth0 configuration. One tool for everything the platform team owns.
- **SAM (CloudFormation)** for the three Lambda functions and their queues, schedules, and alarms — owned by the feature teams, with local testing.
- **Vendor CloudFormation stacks**: Datadog's AWS integration is installed from Datadog's own template.

The rule that makes mixing tools safe: **every resource is owned by exactly one tool**, and tools share values through **Parameter Store** (Terraform writes `/shopnorth/prod/images-bucket`; SAM reads it with a dynamic reference) rather than by editing each other's resources.

## 7. Infrastructure Changes Through the Pipeline

Infrastructure follows the same path as application code (Chapter 11):

1. A pull request changes a template; CI runs **`cfn-lint`** (template errors) and **`cfn-guard`** or policy checks (e.g., "every bucket blocks public access").
2. For production, CI creates a **change set** and posts the summary on the pull request — reviewers see "Add 3, Modify 1, Replace 0".
3. After approval and merge, the pipeline executes the change set using an OIDC role scoped to deploying those stacks.
4. Alarms act as **rollback triggers**; humans have read-only access in production, so the console can't create drift.

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ vars.AWS_SERVERLESS_DEPLOY_ROLE_ARN }}
    aws-region: ap-south-1
- run: sam build
- run: >
    sam deploy --stack-name image-resizer-prod
    --capabilities CAPABILITY_IAM --resolve-s3
    --no-confirm-changeset --no-fail-on-empty-changeset
```

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: An engineer "tidied up" a template by renaming a database's `DBInstanceIdentifier` to match a new naming convention. The production deploy pipeline auto-executed the change set, which replaced the instance: CloudFormation created a new, empty database and deleted the old one. A final snapshot existed only because `DeletionPolicy: Snapshot` had been set; restoring it took two hours. **Decision**: Stateful resources carry `DeletionPolicy` and `UpdateReplacePolicy`, a stack policy denies replacing them, and the pipeline stops for human review when a change set contains any replacement in production.

</div>

<div class="callout-scenario">

**Scenario**: During an incident, an engineer opened a port on a security group in the console as a quick fix and forgot about it. A week later, a routine stack update reverted the rule — and a service that had quietly started depending on it broke at 6 PM. **Decision**: No write access to production in the console (changes go through IaC, with a break-glass path that requires a follow-up pull request), weekly drift detection with alerts, and an incident checklist item: "every manual change is codified or reverted before the incident closes".

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** What's the difference between `!Ref` and `!GetAtt` for an SQS queue resource?

<details>
<summary>Show answer</summary>

For an `AWS::SQS::Queue`, `!Ref` returns the **queue URL** (its primary identifier for that resource type), while `!GetAtt Queue.Arn` returns its **ARN** and `!GetAtt Queue.QueueName` its name. Each resource type documents what `!Ref` returns and which attributes `!GetAtt` supports — IAM policies need ARNs, SDK calls need the URL.

</details>

**L2.** Name three ways CloudFormation protects you from losing a production database through a template change.

<details>
<summary>Show answer</summary>

(1) **Change sets** show when a change will **replace** the resource before anything happens. (2) **`DeletionPolicy: Snapshot`/`Retain`** and **`UpdateReplacePolicy`** keep the data (or a snapshot) if the resource is deleted or replaced. (3) **Stack policies** deny updates or replacement of specific resources; **termination protection** prevents deleting the whole stack. (Also: the database's own deletion protection.)

</details>

### 🟡 Medium — Apply it

**M1.** ShopNorth's SAM stack needs the images bucket name, which Terraform creates. How do you connect them without hardcoding or circular dependencies?

<details>
<summary>Show answer</summary>

Terraform writes the bucket name (and ARN) to **SSM Parameter Store** (`/shopnorth/prod/images-bucket`). The SAM template takes a parameter of type `AWS::SSM::Parameter::Value<String>` with that path as the default — or uses a dynamic reference `{{resolve:ssm:/shopnorth/prod/images-bucket}}`. Ownership stays clear (Terraform owns the bucket; SAM never modifies it), and changing environments means changing the parameter path, not the template. Avoid CloudFormation exports across tools — they can't be referenced from Terraform cleanly and lock dependent stacks.

</details>

**M2.** Your team keeps finding resources that were changed by hand in production. Propose a plan.

<details>
<summary>Show answer</summary>

**Prevent:** production permission sets are read-only for humans; changes go through pipelines with OIDC roles; a time-limited break-glass role exists for incidents, with alerts when used. **Detect:** scheduled CloudFormation drift detection (and `terraform plan` on a schedule for Terraform-managed resources) with alerts for any drift; AWS Config rules for key settings. **Correct:** every drift finding becomes a pull request that either codifies the change or reverts it. **Culture:** "if it's not in Git, it doesn't exist" — and the incident checklist requires codifying emergency fixes.

</details>

### 🔴 High — Think like a senior

**H1.** Your company runs 400 hand-created AWS resources in production with no IaC. Plan the migration to IaC without downtime.

<details>
<summary>Show answer</summary>

**Inventory** everything (AWS Config, tags, the CloudFormation **IaC generator** or Terraform import tooling) and group resources by ownership and change frequency. **Pick the tool** per area (Terraform for the shared platform; SAM/CDK for serverless apps). **Import, don't recreate:** CloudFormation **resource import** and `terraform import` bring existing resources under management without replacing them; generate the code, then run a plan that shows **no changes** before trusting it. **Start low-risk** (alarms, IAM roles, queues), then networking, then data stores with `DeletionPolicy`/`prevent_destroy` set *before* importing. **Lock in**: once an area is imported, remove human write access to it and enable drift detection. Track progress weekly; expect months, not days.

</details>

**H2.** A colleague argues: "CDK is better than YAML because it's real code — let's use loops and abstractions everywhere." When is that right, and what are the risks?

<details>
<summary>Show answer</summary>

**Right** when you have repeated patterns (20 services that each need a queue, DLQ, alarms, and IAM grants), when type checking and IDE support catch mistakes early, and when constructs encode your company's standards so every team gets secure defaults. **Risks:** too much abstraction hides what's being created — reviewers must read `cdk diff` and synthesized templates, not just code; logic that depends on runtime values can produce surprising templates; upgrades of construct libraries can change resources (watch for replacements); and over-generic code is harder to change than duplicated YAML. **Balance:** use CDK constructs for well-understood patterns, keep stacks small, review the synthesized diff in every pull request, and pin library versions.

</details>

## 🛠️ Mini Project — A Serverless Stack, Fully Coded

**Goal**: Define, test, and deploy a Lambda + queue stack entirely as code, with safety nets. 1 weekend (free-tier friendly).

**Build**

1. Write a SAM template with an S3 bucket (with EventBridge notifications enabled), a Java 21 function triggered by `Object Created` events under `uploads/`, an on-failure SQS queue, and a CloudWatch alarm on that queue.
2. Run `cfn-lint` and fix every warning; test the function with `sam local invoke`.
3. Deploy with `sam deploy --guided`; inspect the change set in the console before executing it.
4. Change the function's memory and redeploy — confirm the change set shows a modification, not a replacement. Then change the bucket's name and observe that the change set shows **replacement**; cancel it.
5. Add `DeletionPolicy: Retain` to the bucket, delete the stack, and confirm the bucket survives.
6. Modify the function's timeout in the console, then run drift detection and see it reported.

**Acceptance criteria**: a template that passes `cfn-lint`, a screenshot or text of a change set with a replacement you caught, a retained bucket after stack deletion, and a drift report.

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "Why use infrastructure as code, and how do you make infrastructure changes safely?"**

IaC makes environments reproducible, reviewable, and recoverable: the same code creates staging and production, every change is a pull request with an author and a reason, and a region can be rebuilt from Git. To make changes safe, I lint and run policy checks in CI, preview every change with a change set or terraform plan posted on the pull request, and look specifically for resource replacements on anything stateful. Stateful resources carry deletion and replacement protection. Deployment runs from the pipeline with a scoped role, with alarms as rollback triggers, and humans don't have write access in production, so the console can't create drift.

</div>

<div class="callout-interview">

**Q: "CloudFormation or Terraform — how do you choose?"**

CloudFormation is AWS-native: AWS keeps the state, failed updates roll back automatically, it's the foundation for SAM and CDK, and vendors often ship integrations as CloudFormation templates. Terraform is multi-provider, so one tool and workflow covers AWS, Kubernetes, Datadog, Auth0, GitHub, and more, with mature module ecosystems and plans. You manage its state file and locking. For an AWS-only, serverless-heavy team, CloudFormation with SAM or CDK is natural. For a platform team managing many providers, Terraform. Mixing is fine if every resource has exactly one owner and values are shared through something like Parameter Store.

</div>

<div class="callout-interview">

**Q: "What happens when a CloudFormation stack update fails halfway?"**

CloudFormation automatically rolls the stack back to its last known good configuration, undoing the resources it changed in that update, and the stack ends in an UPDATE_ROLLBACK_COMPLETE state. If the rollback itself can't complete, for example because a resource was modified outside CloudFormation, the stack can get stuck in UPDATE_ROLLBACK_FAILED. Then you fix the underlying issue and continue the rollback, optionally skipping specific resources. Rollback triggers can also roll back an update that succeeded technically but set off CloudWatch alarms during the monitoring period. This is a key difference from Terraform, which stops at the failure and leaves you to fix forward.

</div>

## Quick Reference

| Concept | Remember |
|---------|----------|
| Template | `Parameters`, `Conditions`, `Resources` (required), `Outputs`, `Transform` |
| Functions | `!Ref`, `!GetAtt`, `!Sub`, `!If`, dynamic references `{{resolve:…}}` |
| Change set | Preview — read the **Replacement** column |
| Protection | `DeletionPolicy`, `UpdateReplacePolicy`, stack policies, termination protection |
| Failure | Automatic rollback; rollback triggers on alarms |
| Drift | Detect on a schedule; codify or revert |
| SAM | Serverless shorthand + `sam build/local/deploy` |
| CDK | Code → synthesized CloudFormation; review `cdk diff` |
| Mixing tools | One owner per resource; share via Parameter Store |

> **Golden rule: if it's not in Git, it doesn't exist — and every production change gets previewed, reviewed, and protected against replacing your data.**

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's platform is Terraform, its Lambda functions and their queues are SAM stacks deployed by the pipeline with OIDC, and Datadog's AWS integration is a vendor CloudFormation stack — every resource owned by exactly one tool. Chapter 11 builds the pipeline these deploys run through.

**Continue the story:** [Chapter 11 · CI/CD Pipeline](/tutorials/journey-11-cicd) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
