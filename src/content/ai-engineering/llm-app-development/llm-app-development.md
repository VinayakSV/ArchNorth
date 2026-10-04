# Building LLM Apps — APIs, Streaming, Tool Use, Resilience & Cost

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Maintenance & evolution** · ShopNorth uses this in [Chapter 15 · Evolving with AI](/tutorials/journey-15-ai)

</div>
<!-- sdlc-stage:end -->

> **AI Engineering · Building with LLMs** — Time to put a model inside a real service. Everything you know about calling remote APIs still applies — plus a few things that are new: token-based cost, streamed output, the model asking *your code* to run functions, and outputs that must be validated before anyone trusts them.

---

## Table of Contents

1. The Call-Center-with-a-Specialist Analogy
2. Reference Architecture for an LLM Feature
3. Your First Call — Official SDKs (Java & TypeScript)
4. Conversations & State
5. Streaming to the Browser (SSE)
6. Tool Use (Function Calling) — Letting the Model Call Your Code
7. Resilience — Timeouts, Retries, Rate Limits, Fallbacks
8. Cost Control — Caching, Model Routing, Batching, Budgets
9. Security Basics for LLM Endpoints
10. Frameworks: Official SDK vs Spring AI vs LangChain4j
11. Practice Assignments (Low / Medium / High)
12. Mini Project — Streaming Order Assistant in Spring Boot
13. Interview Corner
14. Quick Reference

---

## 1. The Call-Center-with-a-Specialist Analogy

A call center (your backend) receives customer calls. For tricky questions it can conference in a brilliant specialist (the LLM) — who is:

- **Paid by the minute** → tokens cost money; keep calls focused.
- **Sometimes busy** → rate limits and occasional errors; you need retries and a plan B.
- **Talks as they think** → streaming: the customer hears words as they're spoken, not after a long silence.
- **Can't look anything up themselves** → but can ask *your* agent to check the order system (tool use), and your agent decides whether that's allowed.
- **Never gets direct access to the customer's credit card system** → your call center stays in control of every action.

Your backend is always the call center: it authenticates the customer, decides what the specialist sees, executes any actions, and checks what's said before it reaches the customer.

---

## 2. Reference Architecture for an LLM Feature

```mermaid
flowchart LR
    UI["Web / mobile UI"] -->|"HTTPS + user auth"| API["Spring Boot service<br/>(your backend)"]
    API --> PB["Prompt builder<br/>system prompt + context + history"]
    PB --> GW["LLM client / gateway<br/>timeouts, retries, logging, cost"]
    GW -->|"API key (server-side only)"| LLM["LLM provider API"]
    LLM -->|"tool_use request"| API
    API --> TOOLS["Your tools<br/>order DB, inventory API"]
    API --> VAL["Output validation<br/>schema, rules, moderation"]
    VAL -->|"SSE stream"| UI
    API --> STORE[("Conversation store<br/>+ usage/cost logs")]
```

| Component | Responsibility |
|-----------|----------------|
| Backend endpoint | AuthN/AuthZ, per-user rate limits and quotas, input size limits |
| Prompt builder | Stable system prompt (cacheable) + retrieved context + trimmed history |
| LLM client | One place for model config, timeouts, retries, token/cost logging, prompt version tagging |
| Tool executor | Runs functions the model requests — with **your** permission checks |
| Validator | Schema and business-rule validation before anything is shown or acted on |
| Store | Conversations, feedback, and per-request usage for cost dashboards |

---

## 3. Your First Call — Official SDKs

### Java (official SDK: `com.anthropic:anthropic-java`)

```java
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;

AnthropicClient client = AnthropicOkHttpClient.fromEnv();   // ANTHROPIC_API_KEY from the environment

MessageCreateParams params = MessageCreateParams.builder()
    .model("claude-opus-5")
    .maxTokens(16000L)
    .system("You are a concise assistant for ShopKart customer support agents.")
    .addUserMessage("Summarize the refund policy for damaged items in 3 bullets.")
    .build();

Message response = client.messages().create(params);
response.content().stream()
    .flatMap(block -> block.text().stream())
    .forEach(text -> System.out.println(text.text()));
```

Wire it as a Spring bean once (the client is thread-safe and holds a connection pool):

```java
@Configuration
class LlmConfig {
    @Bean
    AnthropicClient anthropicClient() {
        return AnthropicOkHttpClient.fromEnv();
    }
}
```

### TypeScript (Node backend: `@anthropic-ai/sdk`)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();   // reads ANTHROPIC_API_KEY

const response = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 16000,
  messages: [{ role: "user", content: "Summarize the refund policy for damaged items." }],
});

for (const block of response.content) {
  if (block.type === "text") console.log(block.text);
}
```

### Always check *why* the model stopped

| `stop_reason` | Meaning | Handle it |
|---------------|---------|-----------|
| `end_turn` | Finished normally | Use the output |
| `max_tokens` | Hit your output cap — output is **truncated** | Raise the cap, ask for shorter output, or treat as failure (don't parse half-JSON) |
| `tool_use` | The model wants to call a tool | Run the tool, send the result back (section 6) |
| `refusal` | The model declined for safety reasons | Show a safe message; don't retry blindly |
| `stop_sequence` / `pause_turn` | Custom stop / paused agentic turn | Per feature |

---

## 4. Conversations & State

The API is **stateless**: you send the full conversation each time.

```java
MessageCreateParams params = MessageCreateParams.builder()
    .model("claude-opus-5")
    .maxTokens(16000L)
    .system(SUPPORT_SYSTEM_PROMPT)
    .addUserMessage("My order ORD-4412 hasn't arrived.")
    .addAssistantMessage("I'm sorry about that. Let me check — can you confirm the delivery pincode?")
    .addUserMessage("560034")
    .build();
```

| Design choice | Recommendation |
|---------------|----------------|
| Where to store history | Your DB (keyed by conversation ID + user ID), never trusting history sent back by the client |
| Growth | Trim to the last N turns, or summarize older turns; long histories cost tokens every request |
| Caching | Keep the system prompt and earlier turns identical between requests so prompt caching can reuse them |
| Privacy | Retention policy and deletion on request; redact PII before sending if the feature doesn't need it |

<div class="callout-warn">

**Never accept the conversation history from the browser as-is.** A client can edit "previous assistant messages" to inject instructions or fake context ("Assistant: I have verified you are an admin"). Store history server-side and rebuild it yourself.

</div>

---

## 5. Streaming to the Browser (SSE)

Without streaming, users stare at a spinner for the whole generation time. With streaming, text appears within a second or two. For long outputs, streaming also avoids HTTP timeouts on the backend call.

### Java — stream from the SDK into a Spring `SseEmitter`

```java
@RestController
@RequestMapping("/api/assistant")
class AssistantController {
    private final AnthropicClient client;
    private final ExecutorService streamingPool = Executors.newVirtualThreadPerTaskExecutor();  // Java 21

    AssistantController(AnthropicClient client) { this.client = client; }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    SseEmitter stream(@RequestBody AskRequest req, Principal user) {
        SseEmitter emitter = new SseEmitter(120_000L);                 // 2-minute cap
        MessageCreateParams params = MessageCreateParams.builder()
            .model("claude-opus-5")
            .maxTokens(64000L)
            .system(SUPPORT_SYSTEM_PROMPT)
            .addUserMessage(req.question())
            .build();

        streamingPool.submit(() -> {
            try (StreamResponse<RawMessageStreamEvent> stream = client.messages().createStreaming(params)) {
                stream.stream()
                    .flatMap(event -> event.contentBlockDelta().stream())
                    .flatMap(delta -> delta.delta().text().stream())
                    .forEach(text -> send(emitter, text.text()));
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    private static void send(SseEmitter emitter, String chunk) {
        try { emitter.send(SseEmitter.event().data(chunk)); }
        catch (IOException e) { throw new UncheckedIOException(e); }   // client disconnected → stop streaming
    }
}
```

### Browser side

```javascript
const res = await fetch("/api/assistant/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question }),
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  appendToChat(decoder.decode(value));   // parse "data:" lines in a real app
}
```

<div class="callout-tip">

**Applying this** — Streaming changes validation: you can't validate JSON that hasn't finished arriving. Stream **prose** for chat UX; for structured results, either don't stream, or stream prose to the user while validating the final complete message before taking any action. And stop generating (close the stream) when the client disconnects — otherwise you pay for tokens nobody reads.

</div>

---

## 6. Tool Use (Function Calling) — Letting the Model Call Your Code

The model can't query your database. But you can **describe tools** (name, description, input schema); the model replies with a structured request to call one; **your code executes it** and returns the result; the model continues.

```mermaid
sequenceDiagram
    participant U as User
    participant B as Your backend
    participant M as Model
    participant DB as Order DB
    U->>B: "Where is my order ORD-4412?"
    B->>M: messages + tools [getOrderStatus(orderId)]
    M-->>B: stop_reason=tool_use: getOrderStatus({"orderId":"ORD-4412"})
    B->>B: authorize: does ORD-4412 belong to this user?
    B->>DB: SELECT status...
    DB-->>B: SHIPPED, ETA 2 days
    B->>M: tool_result: {"status":"SHIPPED","eta":"2026-10-02"}
    M-->>B: "Your order shipped and should arrive by Oct 2."
    B-->>U: streamed answer
```

### Java — the SDK's tool runner (beta helper that runs the loop for you)

```java
@JsonClassDescription("Get the current status and ETA of one of the signed-in customer's orders")
static class GetOrderStatus implements Supplier<String> {
    @JsonPropertyDescription("Order ID in the format ORD-<digits>, e.g. ORD-4412")
    public String orderId;

    @Override
    public String get() {
        // Your authorization + lookup — the model never touches the DB directly
        return orderService.statusForCurrentUser(orderId).toJson();
    }
}

BetaToolRunner runner = client.beta().messages().toolRunner(
    com.anthropic.models.beta.messages.MessageCreateParams.builder()
        .model("claude-opus-5")
        .maxTokens(16000L)
        .putAdditionalHeader("anthropic-beta", "structured-outputs-2025-11-13")
        .addTool(GetOrderStatus.class)
        .addUserMessage("Where is my order ORD-4412?")
        .build());

for (BetaMessage message : runner) {       // each iteration = one model turn (tool calls handled for you)
    log.debug("turn: {}", message);
}
```

For full control (approval steps, custom logging), write the loop yourself: while `stop_reason == tool_use`, execute every `tool_use` block, append **all** results in one user message as `tool_result` blocks, and call the API again.

### Designing good tools

| Principle | Example |
|-----------|---------|
| Clear name + description that says *when* to use it | "Get status and ETA for **one of the signed-in customer's** orders" |
| Narrow, typed inputs | `orderId` with a pattern, not free-text SQL |
| **Authorization inside the tool** | Check the order belongs to the current user — the model's request is untrusted |
| Read-only by default | Actions (cancel, refund) need confirmation or a separate approval step |
| Useful, compact results | Return the fields needed, not a 500-line JSON dump |
| Errors as results | Return `{"error":"ORDER_NOT_FOUND"}` so the model can respond gracefully |

<div class="callout-warn">

**The model chooses the tool arguments, and a user can influence the model.** "Look up order ORD-9999" (someone else's order) will produce a perfectly valid tool call. Every tool must enforce the same authorization your REST API would. Treat tool inputs exactly like untrusted HTTP request parameters.

</div>

---

## 7. Resilience — Timeouts, Retries, Rate Limits, Fallbacks

An LLM API is a remote dependency with variable latency — apply every pattern from `microservices-patterns`.

| Failure | Handling |
|---------|----------|
| **429 rate limit** | Retry with exponential backoff + jitter, honoring `retry-after`; per-user quotas to protect your org-wide limit |
| **5xx / overloaded / network errors** | Retry a limited number of times (the official SDKs retry common transient errors by default — configure rather than double-wrap) |
| **Slow responses** | Timeouts sized to the output length; stream long outputs |
| **Provider outage** | Circuit breaker + graceful degradation ("assistant unavailable — here are help articles"), or a fallback model/provider for critical features |
| **Refusal** | Don't loop retrying; show a safe message or route to a human |
| **Bad output** (invalid JSON, rule violations) | One repair attempt with the validation error, then fail safely |

```java
// Resilience4j around the call — the circuit breaker stops hammering a failing provider
@CircuitBreaker(name = "llm", fallbackMethod = "degraded")
@Bulkhead(name = "llm")                          // cap concurrent LLM calls from this service
public Answer ask(String question) { return llmClient.ask(question); }

private Answer degraded(String question, Throwable t) {
    return Answer.fallback("Our assistant is busy right now. Here are articles that may help: ...");
}
```

<div class="callout-scenario">

**Scenario**: A marketing campaign drives 10x traffic to the AI assistant; the org-wide rate limit is hit, and *every* AI feature in the company starts failing — including the critical fraud-review summarizer. **Decision**: Rate limits are shared per organization/workspace, so isolate: separate workspaces or API keys per critical feature, per-feature concurrency limits (bulkheads) and per-user quotas at your gateway, priority for critical routes, and a queue with the Batch API for non-urgent work. Load-test AI features like any dependency.

</div>

---

## 8. Cost Control — Caching, Model Routing, Batching, Budgets

| Lever | How | Typical impact |
|-------|-----|----------------|
| **Prompt caching** | Keep the long, stable prefix (system prompt, tools, reference docs) identical; mark it cacheable | Cached input tokens are billed at a small fraction of the normal rate, and responses start faster |
| **Right model per route** | Eval-driven: cheapest model/effort that passes the bar | Often the biggest saving |
| **Output length** | Ask for concise output; structured instead of prose | Output tokens are the priciest |
| **Batch API** | Non-urgent bulk work (nightly summaries, backfills) | Roughly half price, asynchronous |
| **Context hygiene** | Retrieve top chunks instead of whole documents; trim history | Fewer input tokens |
| **Response caching** | Cache identical or near-identical requests (FAQ answers) in Redis | Zero tokens for hits (watch personalization and staleness) |
| **Budgets & alerts** | Per-feature and per-user token budgets; daily cost alerts | Prevents surprise bills and abuse |

```typescript
// Prompt caching: the long, stable system prompt is cached and reused across requests
const response = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 16000,
  cache_control: { type: "ephemeral" },     // automatically caches the last cacheable block
  system: LONG_STABLE_POLICY_DOCUMENT,      // e.g., 30 KB of support policies
  messages: [{ role: "user", content: question }],
});
console.log(response.usage.cache_read_input_tokens);   // > 0 on cache hits
```

<div class="callout-tip">

**Applying this** — Cache hits require a **byte-identical prefix**. The classic silent cache-killer is a timestamp, request ID, or user name interpolated into the system prompt. Put stable content first and anything per-request after it, then verify with the cache-read token counts in the response usage.

</div>

---

## 9. Security Basics for LLM Endpoints

| Risk | Control |
|------|---------|
| API key leakage | Keys only on the server, in a secret manager; never in frontend bundles or Git; rotate |
| Cost abuse ("denial of wallet") | AuthN required, per-user rate limits, input size limits, max output tokens, budgets |
| Prompt injection | Delimit untrusted data, least-privilege tools, authorization in tools, human approval for actions (see `ai-production-llmops`) |
| Data leakage | Don't send data the feature doesn't need; redact PII; check the provider's retention terms and your data classification rules |
| Harmful or wrong output shown to users | Output validation, safety filters where needed, clear AI disclosure, feedback buttons |
| Logging sensitive prompts | Treat prompt logs as sensitive data: access control, retention limits, masking |

---

## 10. Frameworks: Official SDK vs Spring AI vs LangChain4j

| Option | Strengths | Trade-offs | Choose when |
|--------|-----------|------------|-------------|
| **Official provider SDK** (Anthropic Java SDK, etc.) | Newest features first, exact API control, fewest abstractions | Provider-specific code | One primary provider; you want full control of features like caching, thinking, tool runners |
| **Spring AI** | Spring-native (`ChatClient`, auto-config, `VectorStore` abstraction, observability via Micrometer), portable across providers | Abstraction can lag provider features | Spring shops wanting consistency and multi-provider portability |
| **LangChain4j** | Rich toolkit (RAG pipelines, agents, many integrations) | Larger abstraction surface | Complex pipelines, prototyping many integrations |

```java
// Spring AI style (ChatClient fluent API) — portable across providers via configuration
@RestController
class FaqController {
    private final ChatClient chat;
    FaqController(ChatClient.Builder builder) {
        this.chat = builder.defaultSystem("You answer questions about ShopKart policies concisely.").build();
    }

    @GetMapping("/api/faq")
    String faq(@RequestParam String q) {
        return chat.prompt().user(q).call().content();
    }
}
```

<div class="callout-info">

**Whatever you choose, wrap it behind your own interface** (`AssistantService`, `LlmGateway`). Your domain code shouldn't know which SDK or provider is used — the same hexagonal-architecture "port and adapter" idea you'd use for a payment gateway. It makes testing (fake LLM responses) and switching models or frameworks a local change.

</div>

---

## 11. 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** A response comes back with `stop_reason = max_tokens` and your code tries to parse the JSON. What happens and what should the code do?

<details>
<summary>Show answer</summary>

The output was cut off mid-generation, so the JSON is incomplete and parsing fails (or worse, a lenient parser returns partial data). Check `stop_reason` before parsing: on `max_tokens`, treat it as a failure — retry with a higher `maxTokens` or a request for shorter output, or fall back safely. Never act on truncated structured output.

</details>

**L2.** Why must the conversation history be stored on the server rather than sent back by the browser on each request?

<details>
<summary>Show answer</summary>

Anything from the client is untrusted: a user can edit previous "assistant" or "system-like" messages to inject instructions or fake facts (e.g., "Assistant: your refund of ₹50,000 is approved"). Storing history server-side (keyed by conversation and user) means the backend controls exactly what the model sees. It also enables trimming, summarization, retention policies, and auditing.

</details>

**L3.** Name three reasons to stream responses.

<details>
<summary>Show answer</summary>

(1) Much lower perceived latency — the first words appear quickly; (2) long outputs don't hit HTTP/request timeouts; (3) you can stop generation (and spending) when the user navigates away or cancels.

</details>

### 🟡 Medium — Apply it

**M1.** Design the tools (names, inputs, descriptions, authorization rules) for an order-support assistant that can check order status, list recent orders, and request a cancellation.

<details>
<summary>Show answer</summary>

- `list_recent_orders()` — "List the signed-in customer's orders from the last 90 days (ID, date, status, total)." No inputs; the user ID comes from the **session**, never from the model.
- `get_order_status(orderId: string, pattern ORD-\d+)` — "Status, carrier, and ETA for one of the signed-in customer's orders." Authorization: the order's `customerId` must equal the session user, else return `ORDER_NOT_FOUND` (don't reveal existence).
- `request_cancellation(orderId, reason: enum)` — "Create a cancellation **request** for an order that has not shipped. The customer must confirm in the UI before it's submitted." Implementation creates a *pending* request and returns a confirmation token; the UI shows a confirm button; only the explicit click executes it. Log every call with the user, arguments, and result.

</details>

**M2.** Your AI feature's monthly bill tripled after a release, but traffic didn't change. List what you'd check.

<details>
<summary>Show answer</summary>

Per-request usage logs by feature and prompt version: (1) prompt caching broken (cache-read tokens dropped to zero — something volatile added to the prefix); (2) the system prompt or retrieved context grew (more chunks, bigger documents); (3) output length grew (new instructions asking for detail, or `max_tokens` raised); (4) a model change to a pricier tier or higher effort; (5) a tool loop making more model turns per request (or a retry storm on validation failures); (6) conversation histories no longer trimmed. Fix, then add alerts on tokens-per-request and cost-per-feature.

</details>

**M3.** Write the resilience policy (timeouts, retries, circuit breaker, fallback) for (a) a synchronous chat assistant and (b) a nightly summarization job.

<details>
<summary>Show answer</summary>

(a) **Chat**: streaming with a per-request cap (~60-120 s total, a shorter time-to-first-token alert); rely on the SDK's limited built-in retries for 429/5xx with backoff before streaming starts; circuit breaker per provider opening on sustained error rates; a bulkhead limiting concurrent calls; fallback message with help articles; per-user rate limits.

(b) **Nightly job**: use the **Batch API** where possible (asynchronous, cheaper); otherwise generous timeouts and more retries with exponential backoff; idempotent processing keyed by document ID (safe re-runs); a dead-letter table for items failing repeatedly; alerting on job completion time and failure count. Latency doesn't matter; completeness and cost do.

</details>

### 🔴 High — Think like a senior

**H1.** Five teams in your company are each integrating LLMs differently (different SDKs, keys in env files, no cost tracking). Design an internal "LLM platform" layer.

<details>
<summary>Show answer</summary>

- **Gateway service or shared library** (often both: a library for in-process calls, a gateway for policy enforcement): a single place for provider credentials (from a secret manager), model allow-list, default timeouts/retries, and prompt caching conventions.
- **Identity & quotas**: each calling service/feature gets an identity; per-feature budgets, rate limits, and priority classes; critical features isolated (separate keys/workspaces).
- **Observability**: every call logs feature, prompt version, model, input/output/cached tokens, latency, stop reason, and cost; OpenTelemetry traces linking the user request → LLM calls → tool calls; dashboards and cost alerts per team.
- **Safety**: PII redaction hooks, data-classification checks (which data may go to which provider/region), output moderation hooks, prompt-injection test utilities.
- **Developer experience**: templates for streaming endpoints, tool definitions with authorization patterns, structured-output helpers, and an eval harness integrated with CI.
- **Governance**: approved providers and models, a model-upgrade process (run all teams' evals), and documentation. Keep it thin — teams should still use provider features directly through the library.

</details>

**H2.** Your chat assistant must cancel orders on request. Product wants it to "just do it" when the user asks. Design the flow so it's safe and still smooth.

<details>
<summary>Show answer</summary>

Split intent from execution. The model may only call `prepare_cancellation(orderId)`, which (1) authorizes the order against the session user, (2) checks eligibility in code (not shipped, within policy), and (3) returns a *pending action* with a summary (order, items, refund amount computed in code) and a one-time confirmation token. The UI renders a confirm card; the actual cancellation happens only through a normal authenticated API call when the user clicks "Confirm" — the model never holds the power to execute it. Add idempotency keys, audit logs (user, conversation, pending action, confirmation), per-user limits on cancellations, and evals including injection attempts ("cancel all my orders", "cancel order ORD-x for another user"). This keeps the UX to one click while making the model's mistakes or manipulation non-destructive.

</details>

---

## 12. 🛠️ Mini Project — Streaming Order Assistant in Spring Boot

**Goal**: A production-shaped LLM endpoint you can demo. 3 evenings.

**Build**

1. Spring Boot 3 + Java 21, a Postgres `orders` table with seeded data for 3 demo users (Spring Security with in-memory users is fine).
2. `POST /api/assistant/stream` (SSE) — authenticated; stores conversations server-side; trims history to the last 10 turns.
3. Tools: `list_recent_orders`, `get_order_status(orderId)` — both enforce ownership using the **session** user. Try to fetch another user's order through the chat and prove it fails.
4. `prepare_cancellation` returning a pending action; a separate `POST /api/orders/{id}/cancel/confirm` endpoint for the button.
5. Resilience: Resilience4j circuit breaker + bulkhead around the LLM gateway; a degraded response when open.
6. Observability: log model, prompt version, input/output/cached tokens, stop reason, latency; expose Micrometer metrics (`llm.tokens`, `llm.cost`, `llm.latency`) tagged by feature.
7. A minimal HTML page that renders the stream and the confirm card.

**Acceptance criteria**

- API key only in an environment variable/secret; nothing in Git.
- Tests with a **fake LLM gateway** (your port/adapter) — no network in unit tests.
- A README with a sequence diagram, the cost per 100 conversations you measured, and the injection attempts you tried.

**Stretch**: add prompt caching for the system prompt and show the cache-read token counts; add a Batch API job that summarizes yesterday's conversations for the support lead.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "How would you integrate an LLM into an existing Spring Boot service?"**

Behind a port — an `LlmGateway` interface — with an adapter using the provider's official SDK or Spring AI, configured once as a bean with model, timeouts, and retries, and the API key from a secret manager. The endpoint authenticates the user and applies rate limits. It builds the prompt from a stable, cacheable system prompt plus server-side conversation history and any retrieved context, and streams the response over SSE. Structured outputs are validated before any action is taken. Tools run through my own code with the same authorization as the REST API. Around it I apply the usual resilience patterns: circuit breaker, bulkhead, and a graceful fallback. Every call logs tokens, cost, latency, and prompt version. Unit tests use a fake gateway, and an eval suite covers quality.

</div>

<div class="callout-interview">

**Q: "Explain tool use or function calling, and its security implications."**

I describe tools to the model with names, descriptions, and JSON schemas. When the model needs one, it returns a structured tool call instead of text. My code executes the function, returns the result, and the model continues, looping until it produces a final answer. The key point is that the model only *requests* actions: my application decides and executes them. Security follows from that. Tool arguments are untrusted input that a user can influence through prompt injection, so every tool enforces authorization against the session user, tools are least-privilege and read-only by default, and consequential actions return a pending action that the user confirms through a normal authenticated flow.

**Follow-up trap**: "Can't you just tell the model in the system prompt to only access the user's own orders?" → That's a helpful hint, not a control. Authorization must be enforced in code, because prompts can be overridden.

</div>

<div class="callout-interview">

**Q: "How do you control the cost of an LLM feature?"**

First I measure: I log input, output, and cached tokens per request and feature, and track cost per completed task. Then I pull the levers in order. Free wins first: prompt caching of the stable prefix, concise outputs, and context hygiene — retrieving the top chunks rather than whole documents, and trimming history. Then trade-offs validated by evals: the cheapest model and reasoning effort that pass the quality bar for each route, and the Batch API for non-urgent bulk work. Around that go per-user quotas and per-feature budgets with alerts, so a bug or abuse can't produce a surprise bill.

</div>

---

## Quick Reference

| Topic | Key practice |
|-------|--------------|
| Architecture | Backend owns auth, prompt building, tools, validation; UI never sees the key |
| SDK | Official SDK or Spring AI, behind your own gateway interface |
| Stop reasons | Check before parsing: `max_tokens`, `tool_use`, `refusal` |
| State | Server-side history; trim/summarize; stable prefix for caching |
| Streaming | SSE to the UI; stop on disconnect; validate final structured output |
| Tools | Clear descriptions, typed inputs, authorization in code, read-only by default |
| Actions | Pending action + explicit user confirmation |
| Resilience | Timeouts, limited retries with backoff, circuit breaker, bulkhead, fallback |
| Rate limits | Per-user quotas; isolate critical features |
| Cost | Caching, right model per route, short outputs, batch, budgets |
| Security | Secrets server-side, input limits, PII minimization, injection-aware design |

---

## Related Topics

- `prompt-engineering` — building the prompts this service sends
- `rag-deep-dive` — adding retrieval to the prompt builder
- `ai-agents` — when the tool loop becomes an agent
- `microservices-patterns` — circuit breakers, bulkheads, retries
- `spring-beans-di` — ports, adapters, and fakes for testing

> **The model is just another remote dependency — expensive, slow, occasionally wrong, and very powerful. Wrap it like one: behind an interface, inside timeouts, under budgets, and never with more authority than the user who's talking to it.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's support assistant calls tools like get_order_status, scoped to the logged-in customer in code.

**Continue the story:** [Chapter 15 · Evolving with AI](/tutorials/journey-15-ai) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
