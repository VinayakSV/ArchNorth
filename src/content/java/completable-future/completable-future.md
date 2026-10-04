# CompletableFuture & Parallel Streams — Async Java

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Development** · ShopNorth uses this in [Chapter 5 · Building with Spring Boot](/tutorials/journey-05-spring-boot)

</div>
<!-- sdlc-stage:end -->

## The Pizza Delivery Analogy

- **Synchronous**: You call the pizza shop, stay on the phone until it's delivered. You can't do anything else.
- **Future**: You call, hang up, and keep checking "Is it here yet? Is it here yet?"
- **CompletableFuture**: You call and say "When the pizza arrives, put it on the table, then call my friend to come over." You go do other things.

---

## 1. Creating CompletableFutures

```java
// Run something async (no return value)
CompletableFuture<Void> cf1 = CompletableFuture.runAsync(() -> {
    sendEmail("user@example.com");
});

// Run something async (with return value)
CompletableFuture<User> cf2 = CompletableFuture.supplyAsync(() -> {
    return userService.findById(123);
});

// Already completed (for testing or default values)
CompletableFuture<String> cf3 = CompletableFuture.completedFuture("default");
```

---

## 2. Chaining — The Real Power

### thenApply — Transform the result

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> fetchUser(userId))       // returns User
    .thenApply(user -> user.getName())           // User → String
    .thenApply(name -> "Hello, " + name);        // String → String

String greeting = future.get();  // "Hello, Alice"
```

### thenAccept — Consume the result (no return)

```java
CompletableFuture.supplyAsync(() -> fetchUser(userId))
    .thenAccept(user -> System.out.println("Found: " + user.getName()));
```

### thenRun — Just do something after (ignores result)

```java
CompletableFuture.supplyAsync(() -> saveOrder(order))
    .thenRun(() -> System.out.println("Order saved!"));
```

### thenCompose — Chain dependent async calls (flatMap)

```java
// fetchUser returns CompletableFuture<User>
// fetchOrders returns CompletableFuture<List<Order>>
CompletableFuture<List<Order>> orders = CompletableFuture
    .supplyAsync(() -> fetchUser(userId))
    .thenCompose(user -> fetchOrders(user.getId()));
    // thenCompose unwraps the inner CompletableFuture
    // thenApply would give CompletableFuture<CompletableFuture<List<Order>>> — wrong!
```

---

## 3. Combining Multiple Futures

### Scenario: Dashboard needs data from 3 services

```java
CompletableFuture<User> userFuture = CompletableFuture.supplyAsync(() -> fetchUser(id));
CompletableFuture<List<Order>> ordersFuture = CompletableFuture.supplyAsync(() -> fetchOrders(id));
CompletableFuture<Profile> profileFuture = CompletableFuture.supplyAsync(() -> fetchProfile(id));

// thenCombine — combine 2 futures
CompletableFuture<String> combined = userFuture.thenCombine(ordersFuture,
    (user, orders) -> user.getName() + " has " + orders.size() + " orders");

// allOf — wait for ALL to complete
CompletableFuture<Void> all = CompletableFuture.allOf(userFuture, ordersFuture, profileFuture);
all.thenRun(() -> {
    // All 3 are done — safe to call .join()
    User user = userFuture.join();
    List<Order> orders = ordersFuture.join();
    Profile profile = profileFuture.join();
    buildDashboard(user, orders, profile);
});

// anyOf — first one to complete wins
CompletableFuture<Object> fastest = CompletableFuture.anyOf(
    fetchFromCacheAsync(key),
    fetchFromDbAsync(key)
);
```

---

## 4. Error Handling

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        if (Math.random() > 0.5) throw new RuntimeException("Boom!");
        return "Success";
    })
    // exceptionally — recover from error
    .exceptionally(ex -> {
        log.error("Failed: " + ex.getMessage());
        return "Fallback value";
    });

// handle — access both result AND exception
CompletableFuture<String> handled = CompletableFuture
    .supplyAsync(() -> riskyOperation())
    .handle((result, ex) -> {
        if (ex != null) return "Error: " + ex.getMessage();
        return "OK: " + result;
    });

// whenComplete — like handle but doesn't transform the result
CompletableFuture<String> logged = CompletableFuture
    .supplyAsync(() -> riskyOperation())
    .whenComplete((result, ex) -> {
        if (ex != null) log.error("Failed", ex);
        else log.info("Result: " + result);
    });
```

### Scenario: Retry with fallback

```java
public CompletableFuture<Data> fetchWithRetry(String id) {
    return CompletableFuture.supplyAsync(() -> primaryService.fetch(id))
        .exceptionally(ex -> {
            log.warn("Primary failed, trying backup");
            return backupService.fetch(id);
        })
        .exceptionally(ex -> {
            log.error("Both services failed");
            return Data.empty();
        });
}
```

---

## 5. Timeouts (Java 9+)

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> slowApiCall())
    .orTimeout(3, TimeUnit.SECONDS)           // throws TimeoutException after 3s
    .exceptionally(ex -> "Timed out!");

// Or use a default value on timeout
CompletableFuture<String> future2 = CompletableFuture
    .supplyAsync(() -> slowApiCall())
    .completeOnTimeout("Default", 3, TimeUnit.SECONDS);  // returns "Default" after 3s
```

---

## 6. Custom Thread Pools

```java
// By default, CompletableFuture uses ForkJoinPool.commonPool()
// For I/O-heavy tasks, use a custom pool:

ExecutorService ioPool = Executors.newFixedThreadPool(20);

CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> callExternalApi(), ioPool)    // runs on ioPool
    .thenApplyAsync(result -> process(result), ioPool);  // also on ioPool

// Don't forget to shutdown
ioPool.shutdown();
```

> **Rule of thumb**: CPU-bound tasks → use common pool (cores count). I/O-bound tasks → use larger custom pool.

---

## 7. Parallel Streams

### When to use

```java
// Large dataset + CPU-intensive operation = good candidate
List<Integer> numbers = IntStream.rangeClosed(1, 10_000_000).boxed().toList();

// Sequential
long sum1 = numbers.stream().mapToLong(n -> expensiveCalc(n)).sum();

// Parallel — splits work across CPU cores
long sum2 = numbers.parallelStream().mapToLong(n -> expensiveCalc(n)).sum();
```

### When NOT to use

```java
// ❌ Small collections — overhead > benefit
List.of(1, 2, 3).parallelStream()...  // slower than sequential!

// ❌ I/O operations — threads block, pool starves
files.parallelStream().map(f -> readFile(f))...  // BAD

// ❌ Order-dependent operations
list.parallelStream().forEachOrdered(...)  // defeats the purpose

// ❌ Shared mutable state
List<String> results = new ArrayList<>();  // NOT thread-safe!
stream.parallel().forEach(item -> results.add(item));  // 💥 ConcurrentModificationException
```

### Safe parallel collection

```java
// Use collect() instead of forEach + mutable list
List<String> results = stream.parallel()
    .map(this::process)
    .collect(Collectors.toList());  // thread-safe
```

---

## 8. Real-World Pattern: Parallel Service Aggregation

```java
public DashboardResponse buildDashboard(Long userId) {
    var executor = Executors.newFixedThreadPool(4);

    var userCf = CompletableFuture.supplyAsync(() -> userService.getUser(userId), executor);
    var ordersCf = CompletableFuture.supplyAsync(() -> orderService.getRecent(userId), executor);
    var notifCf = CompletableFuture.supplyAsync(() -> notificationService.getUnread(userId), executor);
    var recCf = CompletableFuture.supplyAsync(() -> recommendationService.getTop5(userId), executor);

    CompletableFuture.allOf(userCf, ordersCf, notifCf, recCf).join();

    executor.shutdown();

    return new DashboardResponse(
        userCf.join(),
        ordersCf.join(),
        notifCf.join(),
        recCf.join()
    );
    // Total time ≈ max(individual call times) instead of sum
}
```

---

## Quick Reference

| Method | Input → Output | Use When |
|--------|---------------|----------|
| `thenApply` | `T → U` | Transform result |
| `thenAccept` | `T → void` | Consume result |
| `thenRun` | `void → void` | Just run after |
| `thenCompose` | `T → CF<U>` | Chain async calls |
| `thenCombine` | `(T, U) → V` | Combine 2 futures |
| `allOf` | `CF[]` → `CF<Void>` | Wait for all |
| `anyOf` | `CF[]` → `CF<Object>` | First to finish |
| `exceptionally` | `Throwable → T` | Recover from error |
| `handle` | `(T, Throwable) → U` | Handle both cases |
| `orTimeout` | — | Fail after timeout |
| `completeOnTimeout` | — | Default after timeout |

---

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A product page aggregates details, price, stock, and reviews with four `supplyAsync` calls and `allOf(...).join()`. When the reviews service slows to 8 seconds, the whole page takes 8 seconds and Tomcat threads pile up. **Decision**: Put a timeout and a fallback on each **optional** dependency: `reviewsFuture.completeOnTimeout(List.of(), 300, MILLISECONDS)` or `orTimeout(...)` + `exceptionally(...)`, run them on a dedicated bounded executor, and make the aggregate return partial data. Required data (price) fails the request fast with a clear error rather than waiting.

</div>

<div class="callout-scenario">

**Scenario**: An exception thrown inside a `thenApply` step disappears — no log, no error response — and customers get empty responses. **Decision**: Exceptions in a `CompletableFuture` chain are stored in the future, not thrown. If nobody calls `join()`/`get()` or attaches `exceptionally`/`handle`/`whenComplete`, the failure is silently lost. Always terminate chains with error handling (and logging), and unwrap `CompletionException` to get the real cause.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** `thenApply` vs `thenCompose` — when do you use each?

<details>
<summary>Show answer</summary>

`thenApply(fn)` transforms the result with a synchronous function (`T -> U`). `thenCompose(fn)` chains another asynchronous step whose function returns a future (`T -> CompletableFuture<U>`), flattening it — like `flatMap`. Using `thenApply` with an async function gives you a nested `CompletableFuture<CompletableFuture<U>>`.

</details>

**L2.** Which thread runs `supplyAsync(task)` with no executor argument, and why can that be a problem?

<details>
<summary>Show answer</summary>

The common `ForkJoinPool` (sized to CPU cores − 1). Blocking I/O there starves every other user of the common pool, including parallel streams. Pass a dedicated executor for I/O work (or a virtual-thread executor on Java 21).

</details>

**L3.** What's the difference between `exceptionally` and `handle`?

<details>
<summary>Show answer</summary>

`exceptionally(ex -> fallback)` runs only on failure and returns a replacement value. `handle((result, ex) -> ...)` runs on both success and failure and can transform either. `whenComplete` observes both (e.g., logging) without changing the result.

</details>

### 🟡 Medium — Apply it

**M1.** Fetch prices for 200 SKUs from a pricing API that allows at most 10 concurrent requests, collecting results into a `Map<String, Money>`; failed SKUs map to `null`, and the whole operation has a 3-second budget.

<details>
<summary>Show answer</summary>

```java
ExecutorService io = Executors.newFixedThreadPool(10);        // concurrency limit = pool size
List<CompletableFuture<Map.Entry<String, Money>>> futures = skus.stream()
    .map(sku -> CompletableFuture.supplyAsync(() -> pricingClient.price(sku), io)
        .orTimeout(1, TimeUnit.SECONDS)
        .handle((price, ex) -> new AbstractMap.SimpleEntry<>(sku, ex == null ? price : null)))
    .toList();

CompletableFuture<Void> all = CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new));
try {
    all.get(3, TimeUnit.SECONDS);
} catch (TimeoutException e) {
    futures.forEach(f -> f.cancel(true));                     // stop waiting; unfinished → absent
}
Map<String, Money> prices = new HashMap<>();
futures.stream().filter(f -> f.isDone() && !f.isCancelled())
    .map(CompletableFuture::join).forEach(e -> prices.put(e.getKey(), e.getValue()));
```

`cancel(true)` doesn't interrupt the underlying HTTP call in `CompletableFuture` — the client's own timeout is still needed. On Java 21+, virtual threads + a `Semaphore(10)` is an equally good design.

</details>

**M2.** Why might `thenApply` run on the calling thread instead of the pool, and when does it matter?

<details>
<summary>Show answer</summary>

Non-async methods (`thenApply`, `thenAccept`) run on whichever thread completes the previous stage — or on the **caller's** thread if the future is already complete when the callback is attached. If that callback does heavy work, it may run on a request thread or a Netty event loop unexpectedly. Use the `*Async(fn, executor)` variants to control where work runs.

</details>

**M3.** Combine: fetch a user, then (in parallel) their orders and their loyalty points, then build a `DashboardDto`.

<details>
<summary>Show answer</summary>

```java
CompletableFuture<DashboardDto> dashboard =
    CompletableFuture.supplyAsync(() -> users.find(id), io)
        .thenCompose(user -> {
            var orders = CompletableFuture.supplyAsync(() -> ordersClient.recent(user.id()), io);
            var points = CompletableFuture.supplyAsync(() -> loyaltyClient.points(user.id()), io)
                .completeOnTimeout(Points.UNKNOWN, 300, TimeUnit.MILLISECONDS);   // optional data
            return orders.thenCombine(points, (o, p) -> new DashboardDto(user, o, p));
        });
```

</details>

### 🔴 High — Think like a senior

**H1.** A service has 30 methods returning `CompletableFuture` chains with nested `thenCompose` calls and inconsistent error handling. Propose a cleanup strategy, including whether to move to virtual threads.

<details>
<summary>Show answer</summary>

Standardize: one bounded I/O executor (instrumented) injected everywhere; a small helper library for "call with timeout + fallback + logging"; every public method's chain ends with error mapping into domain exceptions; unwrap `CompletionException` at the boundary; tests for timeout/failure paths. Then evaluate **Java 21 virtual threads**: most of these chains exist only to avoid blocking platform threads. With virtual threads, the code becomes plain sequential blocking calls (easier to read, debug, and profile), with parallelism where needed via `ExecutorService` per task or structured concurrency (preview APIs in Java 21-24; check the status on your JDK). Keep `CompletableFuture` where true composition of independent async results is valuable. Migrate incrementally, measuring latency and error rates.

</details>

**H2.** Explain how a `CompletableFuture`-based aggregator can create a thread-pool deadlock, and how to avoid it.

<details>
<summary>Show answer</summary>

If tasks running on pool P submit sub-tasks to the **same** pool P and then block waiting (`join()`) for them, all P threads can end up blocked waiting for sub-tasks that are queued behind them — nothing progresses. Avoid blocking inside pool threads: compose with `thenCompose/thenCombine` instead of `join()` inside tasks, use separate pools for parent and child work, or use `ForkJoinPool` (work-stealing handles `join` within fork/join tasks) — or virtual threads, where blocking doesn't consume a scarce pool thread.

</details>

## 🛠️ Mini Project — Product Page Aggregator with Graceful Degradation

**Goal**: A fast, resilient fan-out endpoint. 1-2 evenings.

**Build**

1. Spring Boot with WireMock (or small stub services) for `catalog`, `price`, `stock`, `reviews`, `recommendations`, each with configurable latency and failure rate.
2. `GET /product-page/{id}` calling all five in parallel on a bounded executor; price and catalog are **required** (fail fast with a clear error), the other three are optional with individual timeouts and fallbacks.
3. A `partial: true` flag + list of missing sections in the response when degraded.
4. Metrics per dependency (latency, timeouts, fallbacks) with Micrometer.
5. A load test: with reviews at 5 s latency, p95 of the page stays under 400 ms.
6. Bonus: a second implementation with virtual threads and plain blocking calls; compare code size and performance.

**Acceptance criteria**: tests for each degradation path; no unhandled exception can escape a chain silently (add a test that fails if any future completes exceptionally without being handled).

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What's the difference between thenApply and thenCompose? Give me a real example."**

thenApply is like map — it takes the result and transforms it synchronously. `userFuture.thenApply(user -> user.getName())` transforms User to String. thenCompose is like flatMap — it takes the result and returns another CompletableFuture. `userFuture.thenCompose(user -> fetchOrders(user.getId()))` chains two async calls where the second depends on the first. If you use thenApply with an async call, you get `CompletableFuture<CompletableFuture<Orders>>` — nested and broken. thenCompose unwraps it to `CompletableFuture<Orders>`.

</div>

<div class="callout-interview">

**Q: "How would you call 5 microservices in parallel and combine the results, with a 3-second timeout and fallback for any that fail?"**

Create 5 CompletableFutures with supplyAsync(), each on a custom I/O thread pool. Apply `.orTimeout(3, TimeUnit.SECONDS)` and `.exceptionally(ex -> fallbackValue)` to each individually — so one failure doesn't kill the others. Then use `CompletableFuture.allOf(cf1, cf2, cf3, cf4, cf5).join()` to wait for all. After that, call `.join()` on each to get results. The key insight: apply timeout and fallback per-future, not on allOf. If you put timeout on allOf, one slow service kills the entire aggregation even if the other 4 succeeded.

**Follow-up trap**: "Why not use get() instead of join()?" → get() throws checked exceptions (ExecutionException, InterruptedException) which are painful in lambda chains. join() throws unchecked CompletionException. In practice, join() is cleaner for composition. Use get() only when you need the checked exception handling.

</div>

<div class="callout-interview">

**Q: "When would you use parallel streams vs CompletableFuture?"**

Parallel streams are for CPU-bound data processing — you have a large collection and want to split computation across cores. They use the common ForkJoinPool, which is sized to your CPU count. CompletableFuture is for I/O-bound async operations — calling APIs, databases, file systems. You use a custom thread pool sized for I/O wait times. Never use parallel streams for I/O: they'll exhaust the common pool and starve other parallel streams in your entire JVM. If you need to process a list where each item requires an API call, use CompletableFuture with a dedicated executor, not parallelStream.

</div>

<div class="callout-interview">

**Q: "What happens if you don't handle exceptions in a CompletableFuture chain?"**

The exception propagates silently through the chain. Every subsequent thenApply/thenCompose is skipped — the chain short-circuits. If nobody calls get()/join(), the exception is swallowed entirely and you'll never know something failed. This is a common production bug: fire-and-forget async calls that fail silently. Always add exceptionally() or handle() at the end of every chain, at minimum to log the error. In Spring's @Async methods, uncaught exceptions go to an AsyncUncaughtExceptionHandler — configure one or you'll lose errors.

</div>

<div class="callout-tip">

**Applying this** — In microservices, the most common pattern is parallel service aggregation: fetch user, orders, and recommendations simultaneously, combine into a response. Use a dedicated I/O thread pool (not the common ForkJoinPool), apply timeouts per-call, and always have fallbacks. Monitor your thread pool saturation — if the queue grows, you need more threads or your downstream services are too slow.

</div>

---

> **Key insight**: CompletableFuture is about **describing what should happen** without blocking. Think of it as writing a recipe: "When the user data arrives, enrich it, then send the email, and if anything fails, log it." The framework handles the execution.

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Fetching prices and coupon data in parallel is a later optimization for ShopNorth's checkout — with timeouts on every future.

**Continue the story:** [Chapter 5 · Building with Spring Boot](/tutorials/journey-05-spring-boot) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
