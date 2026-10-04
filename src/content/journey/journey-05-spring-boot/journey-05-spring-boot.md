# Chapter 5 · Building with Spring Boot

<div class="callout-journey">

🛒 **The ShopNorth Journey** · Chapter 5 of 15 · Phase: **Build**

**Previously:** The domain model (Chapter 3) and the database with its guarantees — unique idempotency keys, atomic stock reservations — are designed ([Chapter 4](/tutorials/journey-04-data-sql)).

**In this chapter:** Sprint 2 begins. You build the Order service in Spring Boot: the `POST /orders` endpoint, validation, transactions, idempotency, calls to Inventory that survive a slow network, and clean error responses.

</div>

## The Situation

Sprint planning, Monday. Ananya drags the story *"As a shopper, I want to place an order"* into your column. Priya adds one line to the ticket: "This endpoint takes the sale-day peak: 150 orders per second. Build it like it."

Arjun pairs with you on the first day. "Spring Boot makes a working endpoint easy," he says. "Making it correct under retries, duplicate clicks, slow dependencies, and 150 requests a second — that's the actual job."

## Step 1 — Project Structure

You generate the project with Spring Initializr (Java 21, Spring Boot 3.x): **Web, Validation, Data JPA, PostgreSQL Driver, Flyway, Actuator**, plus Resilience4j. Kafka (Chapter 6), OAuth2 Resource Server (Chapter 7), and Testcontainers (Chapter 8) come later.

The code is organized **by feature, with the domain at the center** — the Chapter 3 classes don't depend on Spring:

```text
order-service/src/main/java/com/shopnorth/order/
├── OrderServiceApplication.java
├── domain/        ← Order, OrderStatus, Money, PricingEngine, ports (Chapter 3) — no Spring here
├── application/   ← use cases: PlaceOrderService, CancelExpiredOrdersJob
├── api/           ← REST controllers, request/response records, error handling
├── persistence/   ← JPA entities and repositories (implement the OrderStore port)
├── clients/       ← HTTP clients for Catalog and Inventory (implement CatalogPort, InventoryPort)
└── config/        ← configuration properties and beans
```

## Step 2 — The API Contract

Requests and responses are **records** with Bean Validation, so bad input is rejected before it reaches business code:

```java
public record PlaceOrderRequest(
        @NotEmpty @Size(max = 50) List<@Valid OrderLineRequest> lines,
        @Size(max = 30) String couponCode) {}

public record OrderLineRequest(
        @NotBlank @Size(max = 64) String sku,
        @Min(1) @Max(10) int quantity) {}          // the sale allows max 10 units per item

public record OrderResponse(UUID id, String status, long totalPaise, List<OrderLineResponse> lines) {
    public static OrderResponse from(Order order) { /* map domain → response */ }
}
```

```java
@RestController
@RequestMapping("/orders")
class OrderController {

    private final PlaceOrderService placeOrder;

    OrderController(PlaceOrderService placeOrder) {
        this.placeOrder = placeOrder;
    }

    @PostMapping
    ResponseEntity<OrderResponse> place(@RequestHeader("Idempotency-Key") String idempotencyKey,
                                        @Valid @RequestBody PlaceOrderRequest request,
                                        @AuthenticationPrincipal Jwt jwt) {
        PlaceOrderResult result = placeOrder.place(jwt.getSubject(), idempotencyKey, request);
        OrderResponse body = OrderResponse.from(result.order());
        return result.created()
                ? ResponseEntity.created(URI.create("/orders/" + body.id())).body(body)  // 201 first time
                : ResponseEntity.ok(body);                                               // 200 on a replay
    }
}
```

- The **customer ID comes from the login token** (`jwt.getSubject()`), never from the request body — a customer can't place orders for someone else. Chapter 7 wires up the token.
- A missing `Idempotency-Key` header is rejected automatically with `400 Bad Request`.
- Constructor injection, package-private class, no `@Autowired` on fields — easy to test, impossible to half-construct.

## Step 3 — The Use Case: Correct Under Retries and Races

This is the most important code in ShopNorth. Read it slowly — every line answers a Chapter 1 acceptance criterion.

```java
@Service
public class PlaceOrderService {

    private static final Duration STOCK_HOLD = Duration.ofMinutes(15);

    private final CatalogPort catalog;
    private final InventoryPort inventory;
    private final PricingEngine pricing;
    private final OrderStore store;
    private final Clock clock;

    // constructor omitted

    public PlaceOrderResult place(String customerId, String idempotencyKey, PlaceOrderRequest request) {
        // 1. Replay? Same customer + same key → return the existing order, no side effects.
        Optional<Order> existing = store.findByIdempotencyKey(customerId, idempotencyKey);
        if (existing.isPresent()) {
            return PlaceOrderResult.replayed(existing.get());
        }

        // 2. Price from the source of truth (never from the client or a cache). Remote call: no DB transaction open.
        Map<String, Money> prices = catalog.currentPrices(skusOf(request));
        List<OrderItem> items = toItems(request, prices);
        PriceBreakdown price = pricing.price(contextFor(items, request.couponCode(), clock.instant()));
        Order order = Order.place(customerId, items, price.total());

        // 3. Reserve stock. Idempotent by order id, so a retried call can't reserve twice.
        ReservationResult reservation = inventory.reserve(order.id(), items, STOCK_HOLD);
        if (!reservation.success()) {
            throw new OutOfStockException(reservation.unavailableSkus());
        }

        // 4. Save order + items + outbox event in ONE short local transaction.
        try {
            store.saveNewOrder(order, price, idempotencyKey);
            return PlaceOrderResult.created(order);
        } catch (DataIntegrityViolationException e) {
            if (!IdempotencyConflicts.isIdempotencyConflict(e)) throw e;
            // A parallel request with the same key won the race: give our stock back, return theirs.
            inventory.release(order.id());
            return PlaceOrderResult.replayed(store.findByIdempotencyKey(customerId, idempotencyKey).orElseThrow());
        }
    }
}
```

Three decisions to notice:

1. **The database transaction is short and contains no network calls.** Catalog and Inventory are called *before* the transaction opens. During the sale, a slow Inventory call must not hold a database connection hostage (see the first scenario below).
2. **The duplicate-request race is settled by the database.** Two identical requests can both pass step 1 at the same millisecond; the unique constraint from Chapter 4 lets exactly one insert succeed. The loser releases its reservation and returns the winner's order — the customer sees one order and is charged once.
3. **If the service crashes between step 3 and step 4,** stock stays reserved but no order exists. Nothing is lost: the 15-minute hold expires and the sweeper (Chapter 4) releases it.

The transactional write lives in a **separate bean** — on purpose:

```java
@Component
class JpaOrderStore implements OrderStore {

    private final OrderJpaRepository orders;
    private final OutboxJpaRepository outbox;
    private final OutboxEventMapper events;

    // constructor omitted

    @Override
    @Transactional
    public void saveNewOrder(Order order, PriceBreakdown price, String idempotencyKey) {
        orders.saveAndFlush(OrderEntity.from(order, price, idempotencyKey)); // flush → unique violation surfaces here
        order.pullDomainEvents().forEach(event -> outbox.save(events.toOutbox(order.id(), event)));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findByIdempotencyKey(String customerId, String key) {
        return orders.findByCustomerIdAndIdempotencyKey(customerId, key).map(OrderEntity::toDomain);
    }
}
```

<div class="callout-warn">

**The `@Transactional` self-invocation trap.** Spring applies `@Transactional` through a proxy. If `PlaceOrderService` called its *own* `@Transactional` method (`this.saveNewOrder(…)`), the call would bypass the proxy and run **without a transaction**. Putting the transactional method on a different bean (`JpaOrderStore`) makes the proxy work — and keeps the transaction boundary obvious.

</div>

## Step 4 — The JPA Entity

```java
@Entity
@Table(name = "orders")
class OrderEntity {

    @Id
    private UUID id;                                  // assigned by the domain (Order.place)

    @Column(name = "customer_id", nullable = false)
    private String customerId;

    @Enumerated(EnumType.STRING)                      // stored as text, matches the CHECK constraint
    @Column(nullable = false)
    private OrderStatus status;

    @Column(name = "subtotal_paise", nullable = false) private long subtotalPaise;
    @Column(name = "discount_paise", nullable = false) private long discountPaise;
    @Column(name = "total_paise", nullable = false)    private long totalPaise;

    @Column(name = "idempotency_key", nullable = false, updatable = false)
    private String idempotencyKey;

    @Version
    private Long version;                             // wrapper type: null means "new" → INSERT, not SELECT + merge

    @ElementCollection
    @CollectionTable(name = "order_items", joinColumns = @JoinColumn(name = "order_id"))
    @OrderColumn(name = "line_no")                    // maps to the (order_id, line_no) primary key
    private List<OrderItemValue> items = new ArrayList<>();

    protected OrderEntity() { }                       // required by JPA

    static OrderEntity from(Order order, PriceBreakdown price, String idempotencyKey) { /* … */ }
    Order toDomain() { /* … */ }
}
```

`@Version` gives **optimistic locking** for later updates: when the payment handler and the timeout job both try to change the same order, one of them gets an `OptimisticLockingFailureException` instead of silently overwriting the other. The handler reloads the order and lets the state machine (Chapter 3) decide whether the transition is still allowed.

## Step 5 — Calling Other Services Without Getting Stuck

A remote call without a timeout is a thread that can wait forever. At 150 orders per second, a few seconds of a stuck Inventory service would exhaust every request thread. Every client gets explicit timeouts:

```java
@Configuration
class HttpClientsConfig {

    @Bean
    RestClient inventoryRestClient(RestClient.Builder builder, InventoryProperties props) {
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(500))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(props.readTimeout());               // e.g. 2s
        return builder.baseUrl(props.baseUrl().toString()).requestFactory(factory).build();
    }
}
```

```java
@Component
class InventoryClient implements InventoryPort {

    private final RestClient http;

    InventoryClient(@Qualifier("inventoryRestClient") RestClient http) { this.http = http; }

    @Override
    @Retry(name = "inventory")
    @CircuitBreaker(name = "inventory")
    public ReservationResult reserve(UUID orderId, List<OrderItem> items, Duration hold) {
        return http.put()                                          // PUT /reservations/{orderId}: idempotent
                .uri("/reservations/{orderId}", orderId)
                .body(ReserveRequest.of(items, hold))
                .retrieve()
                .body(ReservationResult.class);
    }
}
```

```yaml
resilience4j:
  retry:
    instances:
      inventory:
        max-attempts: 3
        wait-duration: 200ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
        retry-exceptions:
          - org.springframework.web.client.ResourceAccessException   # network errors and timeouts only
  circuitbreaker:
    instances:
      inventory:
        sliding-window-size: 50
        failure-rate-threshold: 50          # open after 50% failures in the last 50 calls
        slow-call-duration-threshold: 1s
        slow-call-rate-threshold: 80
        wait-duration-in-open-state: 10s    # then let a few trial calls through
```

<div class="callout-tip">

**Only retry what is safe to repeat.** The reservation is a `PUT` keyed by order ID, so Inventory treats a repeat as "already reserved" — retrying can't reserve stock twice. Retrying a non-idempotent call (like "charge this card") on a timeout is how customers get charged twice. ShopNorth never retries payment creation blindly; the payment provider's own idempotency key handles that (Chapter 6).

</div>

## Step 6 — Errors Customers and Clients Can Use

Spring's `ProblemDetail` (RFC 9457) gives every error the same JSON shape:

```java
@RestControllerAdvice
class ApiErrorHandler {

    @ExceptionHandler(OutOfStockException.class)
    ProblemDetail outOfStock(OutOfStockException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Some items just sold out");
        problem.setTitle("Out of stock");
        problem.setProperty("unavailableSkus", e.skus());          // the app highlights these items
        return problem;
    }

    @ExceptionHandler(CallNotPermittedException.class)             // circuit breaker is open
    ResponseEntity<ProblemDetail> dependencyDown(CallNotPermittedException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "We're having trouble confirming stock. Please try again in a few seconds.");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.RETRY_AFTER, "10")
                .body(problem);
    }
}
```

```json
{
  "type": "about:blank",
  "title": "Out of stock",
  "status": 409,
  "detail": "Some items just sold out",
  "instance": "/orders",
  "unavailableSkus": ["HEADPHONE-NC-01"]
}
```

No stack traces, no internal class names, no SQL in responses — those go to the logs (Chapter 13), with a trace ID that support can search for.

## Step 7 — Configuration and Profiles

```yaml
# application.yml — defaults shared by every environment
spring:
  application:
    name: order-service
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/orders}
    username: ${DB_USERNAME:order_app}
    password: ${DB_PASSWORD}                  # injected from a secret (Chapter 7, 12), never committed
    hikari:
      maximum-pool-size: 20
  jpa:
    open-in-view: false                       # no lazy loading during JSON rendering
    hibernate:
      ddl-auto: validate                      # Flyway owns the schema; Hibernate only checks it
  mvc:
    problemdetails:
      enabled: true                           # framework errors (validation, 404) use ProblemDetail too
server:
  shutdown: graceful                          # finish in-flight requests on deploy (Chapter 12)
management:
  endpoint:
    health:
      probes:
        enabled: true                         # /actuator/health/liveness and /readiness for Kubernetes
shopnorth:
  inventory:
    base-url: ${INVENTORY_URL:http://localhost:8082}
    read-timeout: 2s
```

```java
@ConfigurationProperties(prefix = "shopnorth.inventory")
@Validated
public record InventoryProperties(@NotNull URI baseUrl, @NotNull Duration readTimeout) {}
```

Environment-specific values (`DB_URL`, `INVENTORY_URL`) come from environment variables set by the platform — the **same jar and image** run in every environment, only configuration changes.

**Connection pool math:** a checkout transaction takes ~20 ms of database time. 150 orders/s × 0.02 s = ~3 connections busy on average across the fleet. A pool of 20 per instance is generous — the real constraint is the database's `max_connections` across *all* instances (pods × pool size), which Kabir checks when setting autoscaling limits in Chapter 12.

## Step 8 — The Background Job: Cancel Unpaid Orders

```java
@Component
class CancelExpiredOrdersJob {

    private final OrderJpaRepository orders;
    private final OrderStore store;
    private final Clock clock;

    // constructor omitted

    @Scheduled(fixedDelayString = "PT1M")
    void cancelExpired() {
        Instant cutoff = clock.instant().minus(Duration.ofMinutes(15));
        // SELECT … WHERE status = 'PENDING_PAYMENT' AND created_at < :cutoff
        // ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED
        // — several pods can run this job at once without picking the same rows.
        for (UUID id : orders.lockExpiredPending(cutoff, 100)) {
            store.cancel(id, "Payment not completed within 15 minutes");   // emits OrderCancelled → stock released
        }
    }
}
```

`@Scheduled` needs `@EnableScheduling` on a configuration class. `FOR UPDATE SKIP LOCKED` is what makes the job safe to run on every pod: each instance grabs a different batch instead of all of them cancelling the same orders.

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: An order service annotated its whole `placeOrder` method with `@Transactional`, including HTTP calls to inventory and pricing services. On a normal day nobody noticed. During a sale, the inventory service slowed to 3 seconds per call; every in-flight order held a database connection for those 3 seconds, the 20-connection pool emptied, and even simple "my orders" queries started timing out. **Decision**: Keep transactions short and local: do remote calls first, then open a transaction only for the database writes. Add timeouts and a circuit breaker so a slow dependency fails fast instead of draining shared resources.

</div>

<div class="callout-scenario">

**Scenario**: The "My orders" page loaded 20 orders and then lazily loaded each order's items while building the JSON — 21 queries per page view. With `open-in-view` enabled, nobody saw it in development; under sale traffic, the database spent most of its time on these tiny queries. **Decision**: Disable `open-in-view`, load what each endpoint needs explicitly (a fetch join or a DTO projection query), and add a test that counts SQL statements for the endpoint so the N+1 pattern can't quietly come back.

</div>

## 🔗 Go Deeper — Topic Tutorials

| Topic | What you'll learn | How ShopNorth used it here |
|-------|-------------------|----------------------------|
| [Spring Boot Fundamentals](/tutorials/spring-boot-fundamentals) | Auto-configuration, profiles, Actuator | Project setup, `application.yml`, health probes |
| [Beans & Dependency Injection](/tutorials/spring-beans-di) | Bean lifecycle, proxies, injection | Constructor injection; why the proxy matters |
| [@Transactional — Propagation & Isolation](/tutorials/spring-transactional) | Transaction boundaries and pitfalls | Short local transaction; the self-invocation trap |
| [Exceptions](/tutorials/java-exceptions) | Designing exception hierarchies | `OutOfStockException`, `ProblemDetail` mapping |
| [Java 8](/tutorials/java8-features) · [Java 17](/tutorials/java17-features) | Optional, streams, records | Records for DTOs; `Optional` lookups |
| [Collections](/tutorials/java-collections-list) · [HashMap Internals](/tutorials/hashmap-internals) | Choosing and using collections | `Map<String, Money>` of prices; `List.copyOf` |
| [CompletableFuture](/tutorials/completable-future) | Running independent calls in parallel | Fetching prices and coupon data concurrently (an optimization for later) |
| [Multithreading](/tutorials/multithreading) | Thread pools and their limits | Why timeouts protect the request thread pool |
| [Java Coding Standards](/tutorials/java-coding-standards) | Naming, structure, clean code | Package-by-feature layout |

## 📚 Extra Case Studies

The same building blocks in other systems: [Payment Gateway](/tutorials/payment-gateway) (idempotency done for money), [Service Communication](/tutorials/service-communication) (timeouts, retries, circuit breakers), and [Reactive Programming](/tutorials/reactive-programming) (when a non-blocking stack is worth it instead of the classic model used here).

## 🛠️ Mini Project — Build ShopNorth, Step 5: The Order Service

**Goal**: A Spring Boot service that's correct under duplicates, races, and slow dependencies. 1 week of evenings.

**Build**

1. Create `order-service` (Spring Boot 3, Java 21) that uses your Chapter 3 domain module and your Chapter 4 Flyway migrations.
2. Implement `POST /orders` (with `Idempotency-Key`) and `GET /orders/{id}`. For now, take the customer ID from a header like `X-Customer-Id`; Chapter 7 replaces it with a real token.
3. Fake the Catalog and Inventory services with a tiny second Spring Boot app (or WireMock) that you can make slow or failing.
4. Add timeouts, Resilience4j retry and circuit breaker, and `ProblemDetail` errors.
5. Prove it: send the same request twice (one order); send 20 identical requests in parallel (still one order); make Inventory sleep 5 seconds (requests fail fast with 503, the DB pool stays healthy).

**Acceptance criteria**: duplicate and parallel-duplicate requests create exactly one order; a slow Inventory never holds a database connection; errors follow RFC 9457 `ProblemDetail`.

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why does ShopNorth set `spring.jpa.open-in-view: false`?

<details>
<summary>Show answer</summary>

With open-in-view enabled (Spring Boot's default, with a warning), the persistence context stays open until the HTTP response is rendered, so lazy associations load silently during JSON serialization — hiding N+1 queries and holding a database connection longer than needed. Disabling it forces each endpoint to load exactly what it needs inside the service layer, which makes performance predictable and problems visible in development.

</details>

**L2.** A teammate puts `@Transactional` on a `private` method and calls it from another method in the same class. What happens, and how do you fix it?

<details>
<summary>Show answer</summary>

Nothing transactional happens. Spring's proxy only intercepts calls that come *through the proxy* to public (proxyable) methods; a call from inside the same object (self-invocation) goes straight to the target, and private methods can't be proxied at all. Fix: move the transactional method to another bean (as ShopNorth does with `JpaOrderStore`), or use `TransactionTemplate` for programmatic transactions.

</details>

### 🟡 Medium — Apply it

**M1.** Each order-service pod has a Hikari pool of 20, and Kubernetes may scale to 12 pods during the sale. The database allows 300 connections. Is that a problem? What would you change?

<details>
<summary>Show answer</summary>

12 × 20 = 240 connections from the order service alone — close to the 300 limit before counting the timeout job, migrations, admin tools, and monitoring. And it's mostly waste: the math says only a handful of connections are busy at once. Options: lower the pool to 8-10 per pod (still plenty for ~20 ms transactions), cap the autoscaler's max replicas with the DB limit in mind, and/or add a connection pooler such as PgBouncer in transaction mode. Then monitor active vs idle connections and pool wait time in Datadog (Chapter 13).

</details>

**M2.** Should `POST /orders` be retried automatically by the API gateway when it times out? Why or why not?

<details>
<summary>Show answer</summary>

Only because ShopNorth made it idempotent. Without the `Idempotency-Key`, a gateway retry after a timeout could create a second order (the first might have succeeded just after the timeout). With the key, a retry returns the same order, so retrying is safe — but the gateway should still limit retries (one retry, with backoff), retry only on connection errors and timeouts (not on 4xx), and the client should reuse the same key. General rule: only automatically retry idempotent operations.

</details>

### 🔴 High — Think like a senior

**H1.** The payment provider's webhook sometimes arrives *before* the order's database transaction has committed (the customer paid very fast). How do you handle it?

<details>
<summary>Show answer</summary>

Make the webhook path tolerant of ordering. The Payment service stores every verified webhook first (with the provider's event ID as a unique key, for deduplication) and publishes `PaymentSucceeded`. The Order service's consumer looks up the order; if it doesn't exist **yet**, it doesn't drop the event — it retries with backoff (or the message is redelivered later) for a bounded time, and only then moves it to a dead-letter queue and alerts. Because the order insert commits within milliseconds, the retry almost always finds it. Never return "success" for an event you couldn't apply, and never assume events arrive in causal order across services.

</details>

**H2.** "My orders" must stay fast for customers with 500+ orders. Design the endpoint.

<details>
<summary>Show answer</summary>

Use **keyset pagination**, not `OFFSET`: `WHERE customer_id = ? AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 20`, returning a cursor for the next page — cost stays constant no matter how deep the customer scrolls, and it uses the `(customer_id, created_at DESC)` index. Load a **DTO projection** with exactly the fields the list shows (no full entities), and fetch item summaries for the page in one query (`WHERE order_id IN (…)`), avoiding N+1. Optionally serve it from a read replica with read-your-writes protection for just-placed orders (e.g., include the newest order from the primary). Add a test that asserts the number of SQL statements.

</details>

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "Walk me through how your create-order endpoint works, end to end."**

The controller validates the request and takes the customer ID from the JWT. The use case first checks whether this customer already sent this idempotency key; if so, it returns the existing order. Next, it fetches current prices from the catalog, prices the order with the pricing engine, and reserves stock in the inventory service with a call keyed by order ID, so it's idempotent. Those remote calls happen before any database transaction opens. Then one short transaction saves the order, its items, and an outbox event. If a parallel duplicate wins the race on the unique constraint, we release our reservation and return their order. Errors come back as ProblemDetail, for example 409 with the sold-out SKUs.

</div>

<div class="callout-interview">

**Q: "Why shouldn't you call remote services inside a @Transactional method?"**

Because the transaction holds a database connection, and sometimes row locks, for the whole duration of the network call. If the remote service slows down, connections stay checked out, the pool empties, and unrelated requests start failing. A slow dependency becomes a database outage. There's also a consistency trap: the remote call can succeed while the local transaction rolls back, or the reverse. I keep transactions short and local, do remote calls before or after them, and use idempotency plus the outbox pattern to keep both sides consistent.

**Follow-up trap**: "Then how do you keep the reservation and the order consistent?" → The reservation is idempotent and has an expiry; if the order isn't saved, the hold times out and stock is released. The order's state change is published through the outbox in the same transaction as the write.

</div>

<div class="callout-interview">

**Q: "How do you configure timeouts, retries, and circuit breakers for service calls?"**

Every call gets a connect timeout and a read timeout based on the dependency's real latency. For example, inventory p99 is about 300 ms, so the read timeout is 2 seconds, never infinite. Retries are only for idempotent operations, only for transient failures like timeouts and connection errors (never 4xx), with a small number of attempts and exponential backoff with jitter. A circuit breaker opens when the failure or slow-call rate crosses a threshold, so we fail fast with a clear 503 and a Retry-After header instead of piling up threads. Then I watch the breaker state and retry counts on dashboards, because hidden retries can multiply load during an incident.

</div>

> **Golden rule: assume every request will be sent twice and every dependency will be slow at the worst moment — then write code that's still correct.**

<div class="callout-journey">

➡️ **Next: [Chapter 6 · Microservices & Events](/tutorials/journey-06-microservices)** — The Order service works on its own. Now it has to cooperate: the gateway routes traffic to it, and Kafka carries `OrderPlaced`, `PaymentSucceeded`, and `OrderCancelled` between services — reliably, even when Kafka is down.

</div>
