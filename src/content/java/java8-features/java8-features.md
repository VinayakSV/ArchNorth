# Java 8 — All Features Explained with Real Scenarios

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Development** · ShopNorth uses this in [Chapter 5 · Building with Spring Boot](/tutorials/journey-05-spring-boot)

</div>
<!-- sdlc-stage:end -->

## Why Java 8 Was a Game Changer

Before Java 8, writing Java felt like writing an essay when you just needed a tweet. Java 8 brought **functional programming** to Java — less boilerplate, more expressive code.

---

## 1. Lambda Expressions

### The Problem (Before Java 8)

```java
// To sort a list, you needed this monster:
Collections.sort(names, new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return a.compareTo(b);
    }
});
```

### The Solution (Java 8)

```java
// Same thing, one line:
names.sort((a, b) -> a.compareTo(b));

// Even shorter with method reference:
names.sort(String::compareTo);
```

### Real Scenario: Filtering employees by salary

```java
// Before: 10 lines of loop + if
List<Employee> highPaid = new ArrayList<>();
for (Employee e : employees) {
    if (e.getSalary() > 50000) {
        highPaid.add(e);
    }
}

// After: 1 line
List<Employee> highPaid = employees.stream()
    .filter(e -> e.getSalary() > 50000)
    .collect(Collectors.toList());
```

> **Think of lambdas as**: "Here's a small recipe I'm handing you — do this when the time comes."

---

## 2. Functional Interfaces

A functional interface has **exactly one abstract method**. Lambdas work because of these.

### The 4 Core Functional Interfaces

| Interface | Method | Takes | Returns | Use Case |
|-----------|--------|-------|---------|----------|
| `Predicate<T>` | `test(T)` | T | boolean | Filtering |
| `Function<T,R>` | `apply(T)` | T | R | Transforming |
| `Consumer<T>` | `accept(T)` | T | void | Side effects (print, save) |
| `Supplier<T>` | `get()` | nothing | T | Lazy creation |

### Scenario: Building a flexible validation system

```java
// Instead of hardcoding validation rules:
Predicate<String> isNotEmpty = s -> !s.isEmpty();
Predicate<String> isEmail = s -> s.contains("@");
Predicate<String> isValidEmail = isNotEmpty.and(isEmail);

// Now you can compose rules:
if (isValidEmail.test(userInput)) {
    System.out.println("Valid!");
}
```

### Scenario: Configurable data transformer

```java
Function<String, String> trim = String::trim;
Function<String, String> toUpper = String::toUpperCase;
Function<String, String> sanitize = trim.andThen(toUpper);

String result = sanitize.apply("  hello world  ");  // "HELLO WORLD"
```

---

## 3. Streams API

### Think of Streams Like a Factory Assembly Line

```
Raw Materials → Filter → Transform → Sort → Package → Ship
   (source)   (filter)    (map)     (sorted) (collect) (terminal)
```

Each station does ONE thing and passes the result to the next.

### Key Operations

```java
List<Employee> employees = getEmployees();

// 1. Filter + Map + Collect
List<String> seniorNames = employees.stream()
    .filter(e -> e.getYearsOfExp() > 5)        // keep seniors
    .map(Employee::getName)                      // extract names
    .sorted()                                    // alphabetical
    .collect(Collectors.toList());               // gather results

// 2. Find first match
Optional<Employee> first = employees.stream()
    .filter(e -> e.getDepartment().equals("Engineering"))
    .findFirst();

// 3. Check conditions
boolean allActive = employees.stream().allMatch(Employee::isActive);
boolean anyRemote = employees.stream().anyMatch(Employee::isRemote);

// 4. Reduce — combine all elements into one
int totalSalary = employees.stream()
    .mapToInt(Employee::getSalary)
    .sum();

// 5. Grouping
Map<String, List<Employee>> byDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment));

// 6. Partitioning (split into two groups)
Map<Boolean, List<Employee>> seniorVsJunior = employees.stream()
    .collect(Collectors.partitioningBy(e -> e.getYearsOfExp() > 5));
```

### Scenario: E-commerce order processing

```java
// "Give me the top 3 most expensive orders from VIP customers this month"
List<Order> result = orders.stream()
    .filter(o -> o.getCustomer().isVip())
    .filter(o -> o.getDate().getMonth() == LocalDate.now().getMonth())
    .sorted(Comparator.comparing(Order::getTotal).reversed())
    .limit(3)
    .collect(Collectors.toList());
```

### Lazy Evaluation — Streams Don't Do Work Until They Must

```java
// Nothing happens here — no filtering, no mapping
Stream<String> stream = names.stream()
    .filter(n -> {
        System.out.println("Filtering: " + n);
        return n.startsWith("A");
    })
    .map(n -> {
        System.out.println("Mapping: " + n);
        return n.toUpperCase();
    });

// Work starts HERE when you call a terminal operation
List<String> result = stream.collect(Collectors.toList());
```

> **Important**: Streams are **lazy** — intermediate operations build a pipeline, terminal operations trigger execution.

---

## 4. Optional — No More NullPointerException

### The Problem

```java
// This code is a NullPointerException waiting to happen:
String city = user.getAddress().getCity().toUpperCase();
```

### The Solution

```java
String city = Optional.ofNullable(user)
    .map(User::getAddress)
    .map(Address::getCity)
    .map(String::toUpperCase)
    .orElse("UNKNOWN");
```

### Key Methods

```java
// Creating
Optional<String> opt1 = Optional.of("hello");        // throws if null
Optional<String> opt2 = Optional.ofNullable(value);   // safe with null
Optional<String> opt3 = Optional.empty();              // empty optional

// Using
opt.isPresent();                    // true/false
opt.ifPresent(v -> print(v));       // do something if present
opt.orElse("default");              // get value or default
opt.orElseGet(() -> compute());     // lazy default
opt.orElseThrow(() -> new Ex());    // throw if empty
opt.map(String::toUpperCase);       // transform if present
opt.filter(s -> s.length() > 3);    // filter if present
opt.flatMap(this::findById);        // chain optionals
```

### Scenario: Safe database lookup chain

```java
// Find user → get their subscription → get the plan name
String planName = userRepository.findById(userId)        // Optional<User>
    .flatMap(User::getSubscription)                       // Optional<Subscription>
    .map(Subscription::getPlanName)                       // Optional<String>
    .orElse("Free Plan");
```

> **Rule of thumb**: Never use Optional as a field or method parameter. Use it only as a **return type** to signal "this might not have a value."

---

## 5. Method References

Four types — all are shortcuts for lambdas:

```java
// 1. Static method reference
Function<String, Integer> parse = Integer::parseInt;
// same as: s -> Integer.parseInt(s)

// 2. Instance method of a particular object
String prefix = "Hello";
Predicate<String> startsWith = prefix::startsWith;
// same as: s -> prefix.startsWith(s)

// 3. Instance method of an arbitrary object
Function<String, String> toUpper = String::toUpperCase;
// same as: s -> s.toUpperCase()

// 4. Constructor reference
Supplier<ArrayList<String>> listMaker = ArrayList::new;
// same as: () -> new ArrayList<>()
```

---

## 6. Default Methods in Interfaces

Before Java 8, adding a method to an interface broke every class that implemented it. Now:

```java
public interface Sortable<T> {
    List<T> getItems();

    // Default method — implementations get this for free
    default List<T> getSorted(Comparator<T> comparator) {
        List<T> copy = new ArrayList<>(getItems());
        copy.sort(comparator);
        return copy;
    }
}
```

### Scenario: Evolving an API without breaking clients

```java
public interface PaymentProcessor {
    void processPayment(Payment payment);

    // Added later — existing implementations don't break
    default void processRefund(Payment payment) {
        throw new UnsupportedOperationException("Refunds not supported");
    }

    // Static helper method
    static PaymentProcessor getDefault() {
        return new StripeProcessor();
    }
}
```

---

## 7. New Date/Time API (java.time)

The old `Date` and `Calendar` were mutable, confusing, and not thread-safe. Java 8 fixed everything:

```java
// Immutable, clear, thread-safe
LocalDate today = LocalDate.now();                    // 2024-01-15
LocalTime now = LocalTime.now();                      // 14:30:00
LocalDateTime dateTime = LocalDateTime.now();         // 2024-01-15T14:30:00
ZonedDateTime zoned = ZonedDateTime.now(ZoneId.of("America/New_York"));

// Operations (all return NEW objects — immutable!)
LocalDate nextWeek = today.plusWeeks(1);
LocalDate lastMonth = today.minusMonths(1);

// Parsing and formatting
LocalDate parsed = LocalDate.parse("2024-01-15");
String formatted = today.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));

// Duration and Period
Duration duration = Duration.between(startTime, endTime);  // hours, minutes, seconds
Period period = Period.between(startDate, endDate);          // years, months, days
```

### Scenario: Calculate business days between two dates

```java
long businessDays = startDate.datesUntil(endDate)
    .filter(d -> d.getDayOfWeek() != DayOfWeek.SATURDAY)
    .filter(d -> d.getDayOfWeek() != DayOfWeek.SUNDAY)
    .count();
```

---

## 8. CompletableFuture (Intro)

```java
// Run something async and chain operations
CompletableFuture.supplyAsync(() -> fetchUserFromDB(userId))
    .thenApply(user -> enrichWithProfile(user))
    .thenAccept(user -> sendWelcomeEmail(user))
    .exceptionally(ex -> { log.error("Failed", ex); return null; });
```

> Deep dive in the **CompletableFuture & Parallel Streams** tutorial.

---

## 9. Collectors — The Swiss Army Knife

```java
// toList, toSet, toMap
List<String> names = employees.stream().map(Employee::getName).collect(Collectors.toList());
Set<String> depts = employees.stream().map(Employee::getDept).collect(Collectors.toSet());
Map<Integer, String> idToName = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Employee::getName));

// joining
String csv = names.stream().collect(Collectors.joining(", "));  // "Alice, Bob, Charlie"

// summarizing
IntSummaryStatistics stats = employees.stream()
    .collect(Collectors.summarizingInt(Employee::getSalary));
// stats.getAverage(), stats.getMax(), stats.getMin(), stats.getSum(), stats.getCount()

// groupingBy with downstream collector
Map<String, Double> avgSalaryByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDept,
        Collectors.averagingInt(Employee::getSalary)
    ));
```

---

## 10. Quick Reference Card

| Feature | What It Does | One-Liner Example |
|---------|-------------|-------------------|
| Lambda | Anonymous function | `(a, b) -> a + b` |
| Stream | Pipeline processing | `list.stream().filter().map().collect()` |
| Optional | Null-safe wrapper | `Optional.ofNullable(x).orElse(default)` |
| Method Ref | Lambda shortcut | `String::toUpperCase` |
| Default Method | Interface evolution | `default void log() { ... }` |
| java.time | Immutable dates | `LocalDate.now().plusDays(7)` |
| Functional Interface | Lambda target | `Predicate<T>`, `Function<T,R>` |

---

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A nightly report job builds a `Map<String, Customer>` with `Collectors.toMap(Customer::email, c -> c)` and crashes one night with `IllegalStateException: Duplicate key`. **Decision**: `toMap` throws on duplicate keys by default; production data had two customers sharing an email (a data-quality issue nobody knew about). Decide the rule explicitly with a merge function — `toMap(Customer::email, c -> c, (a, b) -> a.updatedAt().isAfter(b.updatedAt()) ? a : b)` — and log/report duplicates, rather than letting a hidden assumption take down the job.

</div>

<div class="callout-scenario">

**Scenario**: A service returns `Optional<Order>` from repositories, but the code is full of `order.get()` calls and `NoSuchElementException`s appear in logs. **Decision**: `Optional.get()` without a check is just a delayed NullPointerException. Use `orElseThrow(() -> new OrderNotFoundException(id))` for required values (which maps cleanly to a 404), `map`/`orElse` for defaults, and keep `Optional` for **return types only** — not fields, parameters, or collections.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Rewrite with streams: sum the amounts of PAID orders over ₹1,000.

```java
BigDecimal total = BigDecimal.ZERO;
for (Order o : orders) {
    if (o.status() == Status.PAID && o.amount().compareTo(new BigDecimal("1000")) > 0) {
        total = total.add(o.amount());
    }
}
```

<details>
<summary>Show answer</summary>

```java
BigDecimal threshold = new BigDecimal("1000");
BigDecimal total = orders.stream()
    .filter(o -> o.status() == Status.PAID)
    .map(Order::amount)
    .filter(a -> a.compareTo(threshold) > 0)
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

</details>

**L2.** Why does this print nothing? `Stream.of("a", "b").peek(System.out::println).filter(s -> true);`

<details>
<summary>Show answer</summary>

Streams are **lazy**: intermediate operations (`peek`, `filter`, `map`) run only when a terminal operation (`collect`, `forEach`, `count`...) is invoked. There's no terminal operation here.

</details>

**L3.** Which functional interface fits: (a) validate an order → boolean, (b) convert an entity to a DTO, (c) supply a default config, (d) log an event (no result)?

<details>
<summary>Show answer</summary>

(a) `Predicate<Order>`, (b) `Function<OrderEntity, OrderDto>`, (c) `Supplier<Config>`, (d) `Consumer<Event>`.

</details>

### 🟡 Medium — Apply it

**M1.** Group orders by customer, and for each customer compute the order count and total amount, sorted by total descending.

<details>
<summary>Show answer</summary>

```java
record Totals(long orders, BigDecimal total) {}
record CustomerTotals(String customerId, long orders, BigDecimal total) {}

Map<String, Totals> byCustomer = orders.stream()
    .collect(Collectors.groupingBy(Order::customerId,
        Collectors.teeing(
            Collectors.counting(),
            Collectors.reducing(BigDecimal.ZERO, Order::amount, BigDecimal::add),
            Totals::new)));                                   // (count, sum) -> new Totals(count, sum)

List<CustomerTotals> result = byCustomer.entrySet().stream()
    .map(e -> new CustomerTotals(e.getKey(), e.getValue().orders(), e.getValue().total()))
    .sorted(Comparator.comparing(CustomerTotals::total).reversed())
    .toList();
```

(`teeing` is Java 12+; on Java 8 use two collectors or a custom accumulator. For large datasets, this aggregation belongs in SQL: `GROUP BY customer_id`.)

</details>

**M2.** Convert this date code to `java.time` and explain two bugs it has:

```java
private static final SimpleDateFormat FMT = new SimpleDateFormat("yyyy-MM-dd");
Date due = new Date(order.getCreated().getTime() + 30 * 24 * 60 * 60 * 1000);
String text = FMT.format(due);
```

<details>
<summary>Show answer</summary>

Bugs: (1) `SimpleDateFormat` is **not thread-safe** — a shared static instance produces corrupted output under concurrency; (2) `30 * 24 * 60 * 60 * 1000` overflows `int` (2,592,000,000 > 2^31−1), producing a negative number → a date in the past. Also, adding milliseconds ignores time zones and DST.

```java
private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE;   // immutable, thread-safe
LocalDate due = order.createdAt().atZone(ZoneId.of("Asia/Kolkata")).toLocalDate().plusDays(30);
String text = FMT.format(due);
```

</details>

**M3.** When should you **not** use `parallelStream()`?

<details>
<summary>Show answer</summary>

For small collections (overhead dominates), for blocking I/O (it runs on the shared common `ForkJoinPool` and starves other work), when operations have side effects on shared state, when order matters and you'd need `forEachOrdered` anyway, and in web request handlers where many requests would compete for the same pool. Use it only for large, CPU-bound, stateless computations — and measure.

</details>

### 🔴 High — Think like a senior

**H1.** A stream pipeline processes 50M rows loaded from the DB into a `List` and takes 40 seconds and 12 GB of heap. Redesign.

<details>
<summary>Show answer</summary>

Don't load everything into memory: push filtering and aggregation into SQL (`WHERE`, `GROUP BY`, window functions) so the DB returns only results. If row-by-row processing is needed, stream from the database (JDBC fetch size / Spring Data `Stream<T>` within a read-only transaction, or keyset-paginated batches), process in chunks, and write results in batches. Use primitive specializations (`mapToLong`) to avoid boxing in hot numeric pipelines. For very large jobs, Spring Batch with chunking and restartability. Measure with JFR allocation profiling before and after.

</details>

**H2.** Your team's codebase overuses streams: 15-line pipelines with nested lambdas that are hard to debug. Write the guidelines you'd propose.

<details>
<summary>Show answer</summary>

(1) Prefer streams for simple transform/filter/collect; use a loop when there's complex control flow, early exits, checked exceptions, or multiple accumulators. (2) Extract named methods for non-trivial lambdas (`.filter(this::isEligibleForRefund)`), making pipelines read like a sentence. (3) No side effects inside `map`/`filter`; no mutation of shared state. (4) Explicit merge functions in `toMap`; `toList()` for unmodifiable results. (5) Keep pipelines under ~6-8 steps; split into named intermediate variables. (6) `Optional` only as a return type; never `Optional.get()`. (7) Avoid `parallelStream` unless benchmarked. Enforce the most important points in code review and with static analysis rules.

</details>

## 🛠️ Mini Project — Sales Analytics CLI with Streams and java.time

**Goal**: Practice modern Java idioms on realistic data. 1 evening.

**Build**

1. Generate a CSV of 1M orders (`orderId, customerId, city, category, amount, status, createdAt` with time zones) and read it with `Files.lines` into records.
2. Reports: revenue by city and month (`YearMonth`), top 10 customers, average order value per category, orders created on weekends in IST, customers with no order in the last 90 days.
3. Use `Collectors.groupingBy`, `teeing`, `toMap` with merge functions, `Comparator.comparing().thenComparing()`, `Optional` properly.
4. Compare the sequential stream vs `parallelStream` for the heaviest report with JMH; explain the result.
5. Write the same "revenue by city and month" query in SQL (load the CSV into Postgres) and compare speed and code size.

**Acceptance criteria**: unit tests for each report with a small fixed dataset; no `Date`/`SimpleDateFormat`; README with benchmark numbers.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "Explain the Stream pipeline. What's the difference between intermediate and terminal operations?"**

A Stream pipeline has three parts: a source (collection, array, generator), zero or more intermediate operations (filter, map, sorted — these are lazy and return a new Stream), and one terminal operation (collect, forEach, reduce — this triggers execution). Nothing happens until the terminal operation is called. This is important because it means the pipeline can optimize: if you do `.filter().map().findFirst()`, it doesn't filter the entire list then map the entire list — it processes one element at a time through the full chain and stops at the first match.

</div>

<div class="callout-interview">

**Q: "What's the difference between map() and flatMap() in Streams?"**

map() transforms each element one-to-one: `Stream<String>` → `Stream<Integer>` via `map(String::length)`. flatMap() transforms each element into a stream and flattens them: if each customer has a list of orders, `customers.stream().map(Customer::getOrders)` gives you `Stream<List<Order>>` — a stream of lists. `customers.stream().flatMap(c -> c.getOrders().stream())` gives you `Stream<Order>` — all orders flattened into one stream. Use flatMap whenever you need to "unwrap" nested collections.

**Follow-up trap**: "What about flatMap with Optional?" → Same concept. `optional.map(User::getAddress)` returns `Optional<Optional<Address>>` if getAddress() returns Optional. `optional.flatMap(User::getAddress)` unwraps it to `Optional<Address>`.

</div>

<div class="callout-interview">

**Q: "When should you use Optional and when shouldn't you?"**

Use Optional as a return type to signal "this method might not return a value" — like findById() returning Optional<User>. Don't use Optional as a method parameter (it forces callers to wrap values), as a class field (it's not Serializable and adds overhead), or in collections (use an empty collection instead). Never call get() without checking isPresent() first — that defeats the purpose. Prefer orElse(), orElseThrow(), or map() chains. The goal is to make the "might be absent" case explicit in the API contract so callers can't forget to handle it.

</div>

<div class="callout-interview">

**Q: "Write a stream pipeline that groups employees by department, then finds the highest-paid employee in each department."**

```java
Map<String, Optional<Employee>> topByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.maxBy(Comparator.comparing(Employee::getSalary))
    ));
```

This uses groupingBy with a downstream collector. groupingBy partitions the stream by department, then maxBy finds the max salary within each group. The result is `Map<String, Optional<Employee>>` because a group could theoretically be empty. In practice, you can use `collectingAndThen(maxBy(...), Optional::get)` if you're sure groups are non-empty.

</div>

<div class="callout-tip">

**Applying this** — In real codebases, Streams shine for data transformation pipelines: filtering lists, grouping results, computing aggregates. But don't force everything into streams. A simple for-loop is more readable for imperative logic with side effects, early exits, or exception handling. If your stream pipeline exceeds 5-6 operations, extract intermediate results into named variables for readability.

</div>

---

> **The mindset shift**: Java 8 is about telling the computer **what** you want, not **how** to do it. Instead of writing loops, you describe transformations. Instead of null checks, you chain Optionals. Think declarative, not imperative.

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's order service uses Optional for lookups and streams for mapping requests to order items.

**Continue the story:** [Chapter 5 · Building with Spring Boot](/tutorials/journey-05-spring-boot) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
