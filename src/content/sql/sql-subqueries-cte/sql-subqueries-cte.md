# SQL Subqueries & CTEs — WITH, EXISTS, Recursive

> **Use the SQL Playground above** — every query runs live. Subqueries and CTEs are the tools that turn SQL from "retrieve data" into "solve problems."

---

## Table of Contents

1. [What a Subquery Is](#1-what-is-a-subquery)
2. [Scalar Subqueries](#2-scalar-subqueries)
3. [Row and Table Subqueries](#3-row-table-subqueries)
4. [Correlated Subqueries](#4-correlated-subqueries)
5. [EXISTS and NOT EXISTS](#5-exists-not-exists)
6. [IN vs EXISTS vs JOIN — When to Use Which](#6-in-vs-exists-vs-join)
7. [Common Table Expressions — WITH](#7-cte-with)
8. [Recursive CTEs — Hierarchical Data](#8-recursive-cte)
9. [CTE vs Subquery vs Temp Table](#9-cte-vs-subquery-vs-temp)
10. [Lateral Joins (PostgreSQL)](#10-lateral-joins)
11. [Interview Questions](#11-interview-questions)

---

## 1. What a Subquery Is

A subquery is a `SELECT` statement nested inside another SQL statement. It runs first and its result is used by the outer query.

```sql
-- Find passengers who spent more than the average fare
SELECT first_name, last_name, total_miles
FROM passengers
WHERE passenger_id IN (
    SELECT passenger_id        -- ← inner query (subquery)
    FROM bookings
    WHERE status = 'confirmed'
    GROUP BY passenger_id
    HAVING SUM(fare) > (
        SELECT AVG(fare)       -- ← doubly nested subquery
        FROM bookings
        WHERE status = 'confirmed'
    )
);
```

Subqueries can appear in:
- `WHERE` clause (most common)
- `FROM` clause (as a derived table)
- `SELECT` clause (scalar subqueries)
- `HAVING` clause
- `JOIN` condition

---

## 2. Scalar Subqueries

A **scalar subquery** returns exactly one row and one column — a single value. It can appear anywhere a value can appear.

```sql
-- Show each flight's booked seats vs the average across all flights
SELECT flight_number, status, seats_booked,
       (SELECT ROUND(AVG(seats_booked), 0) FROM flights WHERE status != 'cancelled') AS fleet_avg,
       seats_booked - (SELECT ROUND(AVG(seats_booked), 0) FROM flights WHERE status != 'cancelled') AS vs_avg
FROM flights
WHERE status != 'cancelled'
ORDER BY vs_avg DESC;
```

```sql
-- Show each passenger's total spend and how it compares to the grand average
SELECT
    p.first_name || ' ' || p.last_name  AS passenger,
    p.tier,
    ROUND(SUM(b.fare), 0)               AS total_spent,
    (SELECT ROUND(AVG(total), 0)
     FROM (SELECT SUM(fare) AS total
           FROM bookings WHERE status = 'confirmed'
           GROUP BY passenger_id) t)    AS avg_passenger_spend
FROM passengers p
JOIN bookings b ON b.passenger_id = p.passenger_id
WHERE b.status = 'confirmed'
GROUP BY p.passenger_id, p.first_name, p.last_name, p.tier
ORDER BY total_spent DESC
LIMIT 10;
```

<div class="callout-warn">

**Scalar subquery runtime error**: if the subquery returns more than one row, PostgreSQL raises "ERROR: more than one row returned by a subquery used as an expression." Ensure your scalar subqueries always return exactly one row — use LIMIT 1, aggregation, or a very specific WHERE clause.

</div>

---

## 3. Row and Table Subqueries (Derived Tables)

A subquery in the FROM clause creates a **derived table** (also called an inline view). The result is treated as a temporary table for the outer query.

```sql
-- Top 5 passengers by spend, with their tier shown
SELECT top_spenders.passenger_id,
       p.first_name || ' ' || p.last_name AS passenger,
       p.tier,
       top_spenders.total_spent
FROM (
    SELECT passenger_id, ROUND(SUM(fare), 0) AS total_spent
    FROM bookings
    WHERE status = 'confirmed'
    GROUP BY passenger_id
    ORDER BY total_spent DESC
    LIMIT 5
) AS top_spenders                    -- ← derived table, must be aliased
JOIN passengers p ON p.passenger_id = top_spenders.passenger_id
ORDER BY total_spent DESC;
```

```sql
-- Average load factor per airline (derived table in FROM)
SELECT al.name AS airline, flight_stats.avg_load_pct
FROM airlines al
JOIN (
    SELECT r.airline_id,
           ROUND(AVG(CAST(f.seats_booked AS REAL) / f.seats_total * 100), 1) AS avg_load_pct
    FROM flights f
    JOIN routes r ON f.route_id = r.route_id
    WHERE f.status != 'cancelled'
    GROUP BY r.airline_id
) AS flight_stats ON flight_stats.airline_id = al.airline_id
ORDER BY avg_load_pct DESC;
```

---

## 4. Correlated Subqueries

A **correlated subquery** references a column from the outer query. It re-executes for every row the outer query processes — this makes them slow on large tables.

```sql
-- For each passenger, show their most expensive booking
SELECT
    p.first_name || ' ' || p.last_name  AS passenger,
    p.tier,
    (SELECT MAX(fare)
     FROM bookings b
     WHERE b.passenger_id = p.passenger_id   -- ← references outer query's p
       AND b.status = 'confirmed')            AS max_fare
FROM passengers p
ORDER BY max_fare DESC NULLS LAST;
```

```sql
-- Show flights with above-average seats_booked for their aircraft type
SELECT f.flight_number, f.aircraft, f.seats_booked, f.seats_total, f.status
FROM flights f
WHERE f.seats_booked > (
    SELECT AVG(f2.seats_booked)          -- correlated: same aircraft type
    FROM flights f2
    WHERE f2.aircraft = f.aircraft       -- ← reference to outer f
      AND f2.status != 'cancelled'
)
AND f.status != 'cancelled'
ORDER BY f.aircraft, f.seats_booked DESC;
```

```sql
-- Each passenger's booking count compared to others in same tier
SELECT
    p.first_name || ' ' || p.last_name AS passenger,
    p.tier,
    COUNT(b.booking_id) AS bookings,
    (SELECT COUNT(DISTINCT b2.booking_id)
     FROM bookings b2
     JOIN passengers p2 ON b2.passenger_id = p2.passenger_id
     WHERE p2.tier = p.tier) AS tier_total_bookings
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
GROUP BY p.passenger_id, p.first_name, p.last_name, p.tier
ORDER BY p.tier, bookings DESC;
```

<div class="callout-tip">

**Correlated subquery performance**: for N outer rows, the subquery runs N times. If N = 100,000 and the subquery scans 1,000 rows each time, that's 100M row reads. Always profile correlated subqueries with EXPLAIN ANALYZE. Often replaceable with a JOIN + GROUP BY or a window function.

</div>

---

## 5. EXISTS and NOT EXISTS

`EXISTS` checks whether a subquery returns any rows — it short-circuits as soon as the first matching row is found.

### Find passengers who have at least one confirmed booking

```sql
SELECT p.first_name, p.last_name, p.tier
FROM passengers p
WHERE EXISTS (
    SELECT 1                     -- ← '1' is conventional — any value works
    FROM bookings b
    WHERE b.passenger_id = p.passenger_id
      AND b.status = 'confirmed'
)
ORDER BY p.tier, p.last_name;
```

### Find passengers who have NO confirmed bookings

```sql
SELECT p.first_name, p.last_name, p.tier
FROM passengers p
WHERE NOT EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.passenger_id = p.passenger_id
      AND b.status = 'confirmed'
)
ORDER BY p.tier, p.last_name;
```

### Verify flight has at least one business-class booking

```sql
SELECT f.flight_number, f.status, f.seats_booked, f.seats_total
FROM flights f
WHERE f.status = 'scheduled'
  AND EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.flight_id = f.flight_id
      AND b.class = 'business'
      AND b.status = 'confirmed'
)
ORDER BY f.departure_time;
```

### NOT EXISTS vs NOT IN — why NOT EXISTS is safer

```sql
-- NOT IN is dangerous with NULLs:
-- If any booking has NULL passenger_id, NOT IN returns ZERO rows
-- because NULL comparisons return UNKNOWN, killing all rows
SELECT first_name FROM passengers
WHERE passenger_id NOT IN (
    SELECT passenger_id FROM bookings  -- if any row has NULL passenger_id: NO RESULTS
);

-- NOT EXISTS is NULL-safe:
SELECT first_name FROM passengers p
WHERE NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.passenger_id = p.passenger_id
    -- NULL passenger_ids never match p.passenger_id (an actual value)
    -- so those rows don't affect the EXISTS result
);
```

---

## 6. IN vs EXISTS vs JOIN — When to Use Which

```
Scenario: Find passengers who have bookings

IN:
  SELECT * FROM passengers
  WHERE passenger_id IN (SELECT passenger_id FROM bookings);

EXISTS:
  SELECT * FROM passengers p
  WHERE EXISTS (SELECT 1 FROM bookings b WHERE b.passenger_id = p.passenger_id);

JOIN:
  SELECT DISTINCT p.*
  FROM passengers p
  JOIN bookings b ON b.passenger_id = p.passenger_id;
```

| Approach | Best for | Caveat |
|----------|----------|--------|
| `IN (subquery)` | Short lists, non-correlated | Risky with NULLs in subquery |
| `IN (values)` | Static lists | Fine for small lists |
| `EXISTS` | Checking existence | Safer than NOT IN; short-circuits |
| `NOT EXISTS` | "Has no matching rows" | Always prefer over NOT IN |
| `JOIN` | Need columns from joined table | May need DISTINCT to avoid duplicates |
| `LEFT JOIN + IS NULL` | "No match" pattern | Alternative to NOT EXISTS |

PostgreSQL's query planner often converts `IN (subquery)` into a semi-join internally — the performance of IN and EXISTS tends to be similar in modern PostgreSQL. The preference is usually readability and correctness.

---

## 7. Common Table Expressions — WITH

CTEs (Common Table Expressions) define named temporary result sets at the top of a query. They make complex queries readable by breaking them into named, sequential steps.

### Basic CTE syntax

```sql
WITH cte_name AS (
    SELECT ...
    FROM ...
    WHERE ...
)
SELECT *
FROM cte_name;
```

### Multiple CTEs — building complex logic step by step

```sql
-- Step 1: Calculate revenue per route
-- Step 2: Rank routes within each airline
-- Step 3: Show only the top route per airline

WITH route_revenue AS (
    SELECT
        r.route_id,
        r.airline_id,
        a1.iata_code || '→' || a2.iata_code AS route_label,
        r.distance_km,
        COUNT(b.booking_id)              AS bookings,
        ROUND(SUM(b.fare), 0)            AS revenue
    FROM bookings b
    JOIN flights   f  ON b.flight_id  = f.flight_id
    JOIN routes    r  ON f.route_id   = r.route_id
    JOIN airports  a1 ON r.origin_id  = a1.airport_id
    JOIN airports  a2 ON r.dest_id    = a2.airport_id
    WHERE b.status = 'confirmed'
    GROUP BY r.route_id, r.airline_id, a1.iata_code, a2.iata_code, r.distance_km
),
ranked_routes AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY airline_id ORDER BY revenue DESC) AS rn
    FROM route_revenue
)
SELECT
    al.name          AS airline,
    rr.route_label,
    rr.distance_km,
    rr.bookings,
    rr.revenue       AS top_route_revenue
FROM ranked_routes rr
JOIN airlines al ON al.airline_id = rr.airline_id
WHERE rr.rn = 1
ORDER BY rr.revenue DESC;
```

### CTE for readable passenger analytics

```sql
WITH passenger_bookings AS (
    SELECT
        p.passenger_id,
        p.first_name || ' ' || p.last_name  AS full_name,
        p.tier,
        p.total_miles,
        COUNT(b.booking_id)                  AS booking_count,
        ROUND(SUM(b.fare), 0)                AS total_spent,
        ROUND(AVG(b.fare), 0)                AS avg_fare,
        MIN(b.booking_date)                  AS first_booking,
        MAX(b.booking_date)                  AS latest_booking
    FROM passengers p
    LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
                         AND b.status = 'confirmed'
    GROUP BY p.passenger_id, p.first_name, p.last_name, p.tier, p.total_miles
),
tier_averages AS (
    SELECT tier,
           ROUND(AVG(booking_count), 1)  AS avg_bookings_in_tier,
           ROUND(AVG(total_spent), 0)    AS avg_spend_in_tier
    FROM passenger_bookings
    GROUP BY tier
)
SELECT
    pb.full_name,
    pb.tier,
    pb.booking_count,
    ta.avg_bookings_in_tier,
    pb.booking_count - ta.avg_bookings_in_tier AS bookings_vs_tier_avg,
    pb.total_spent,
    ta.avg_spend_in_tier,
    pb.total_spent - ta.avg_spend_in_tier      AS spend_vs_tier_avg
FROM passenger_bookings pb
JOIN tier_averages ta ON ta.tier = pb.tier
ORDER BY pb.tier, pb.total_spent DESC;
```

### Reusing a CTE multiple times

```sql
-- Without CTE: must repeat the subquery
SELECT * FROM (complex_subquery) WHERE ...;
-- ... and again
SELECT COUNT(*) FROM (complex_subquery);

-- With CTE: define once, reference many times
WITH expensive_bookings AS (
    SELECT b.*, p.tier, p.total_miles
    FROM bookings b
    JOIN passengers p ON b.passenger_id = p.passenger_id
    WHERE b.fare > 50000 AND b.status = 'confirmed'
)
SELECT COUNT(*) AS count_over_50k FROM expensive_bookings;
-- (can reference expensive_bookings again in the same query)
```

---

## 8. Recursive CTEs — Hierarchical Data

Recursive CTEs solve hierarchical problems: org charts, category trees, route networks, bill-of-materials.

### Structure

```sql
WITH RECURSIVE cte_name AS (
    -- Anchor member (base case)
    SELECT ...
    FROM ...
    WHERE ...

    UNION ALL

    -- Recursive member (refers back to cte_name)
    SELECT ...
    FROM ... JOIN cte_name ON ...
    -- Must have a termination condition!
)
SELECT * FROM cte_name;
```

### Generate a sequence of numbers

```sql
-- SQLite supports recursive CTEs:
WITH RECURSIVE nums AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM nums WHERE n < 20
)
SELECT n FROM nums;
-- Returns: 1, 2, 3, ..., 20
```

### Generate a date series (useful for filling gaps in data)

```sql
-- Generate every date in June 2025
WITH RECURSIVE dates AS (
    SELECT DATE('2025-06-01') AS dt
    UNION ALL
    SELECT DATE(dt, '+1 day')
    FROM dates
    WHERE dt < DATE('2025-06-30')
)
SELECT dt FROM dates;
```

### Org chart traversal

```sql
-- Create a temporary employee hierarchy for demonstration:
-- (using the airline data: imagine airports connected in a hub-and-spoke network)

-- Find all airports reachable from Delhi (DEL) within 2 hops
WITH RECURSIVE reachable AS (
    -- Anchor: start at Delhi
    SELECT dest_id AS airport_id, 1 AS hops
    FROM routes r
    JOIN airports a ON r.origin_id = a.airport_id
    WHERE a.iata_code = 'DEL'

    UNION ALL

    -- Recursive: find airports reachable from already-found airports
    SELECT r.dest_id, reachable.hops + 1
    FROM routes r
    JOIN reachable ON r.origin_id = reachable.airport_id
    WHERE reachable.hops < 2   -- ← termination condition
)
SELECT DISTINCT
    a.iata_code,
    a.city,
    a.country,
    MIN(reachable.hops) AS min_hops_from_del
FROM reachable
JOIN airports a ON a.airport_id = reachable.airport_id
GROUP BY a.airport_id, a.iata_code, a.city, a.country
ORDER BY min_hops_from_del, a.iata_code;
```

<div class="callout-warn">

**Infinite recursion**: if the recursive member has no termination condition, it runs forever (or until max depth is hit). PostgreSQL has a `max_recursive_iterations` setting (default 50,000). Always include a termination condition: a counter limit, a DISTINCT to avoid cycles, or a depth-limiting WHERE clause.

</div>

---

## 9. CTE vs Subquery vs Temp Table

| Approach | Readability | Reusability | Performance | Use when |
|----------|-------------|-------------|-------------|----------|
| **Subquery (inline)** | Low for complex | Not reusable | Same as CTE | Simple, one-off |
| **CTE (WITH)** | High | Reuse in same query | Usually same* | Complex, multi-step |
| **MATERIALIZED CTE** | High | Single query | Forces materialisation | CTE used 2+ times |
| **Temp Table** | Medium | Multiple queries | Indexed, persistent | Multi-query pipelines |

*PostgreSQL's CTE behaviour changed in v12: before v12, CTEs were always materialised (computed once, result stored). In v12+, CTEs are inlined by default (treated like subqueries). Use `WITH ... AS MATERIALIZED (...)` to force materialisation.

```sql
-- Force CTE materialisation (useful when CTE is used many times)
WITH MATERIALIZED heavy_computation AS (
    SELECT ...
    FROM big_table
    WHERE complex_conditions
)
SELECT * FROM heavy_computation WHERE ...
UNION ALL
SELECT * FROM heavy_computation WHERE ...;
-- Without MATERIALIZED: PostgreSQL might run it twice
-- With MATERIALIZED: runs once, caches result
```

### When to use a Temp Table

```sql
-- Temp tables are useful in multi-step data processing:
-- PostgreSQL:
CREATE TEMP TABLE confirmed_bookings AS
SELECT b.*, p.tier, p.nationality
FROM bookings b
JOIN passengers p ON b.passenger_id = p.passenger_id
WHERE b.status = 'confirmed';

-- Add an index for fast lookups
CREATE INDEX idx_temp_bookings_tier ON confirmed_bookings(tier);

-- Now use in multiple queries without re-computing
SELECT tier, SUM(fare) FROM confirmed_bookings GROUP BY tier;
SELECT nationality, COUNT(*) FROM confirmed_bookings GROUP BY nationality;

-- Dropped automatically at end of session
```

---

## 10. Lateral Joins (PostgreSQL)

`LATERAL` lets a subquery in the `FROM` clause reference columns from earlier tables in the same `FROM` clause — like a correlated subquery that produces multiple rows.

```sql
-- For each passenger, get their top 2 most expensive bookings
-- PostgreSQL only:
SELECT p.first_name, p.last_name, p.tier,
       top_bookings.class, top_bookings.fare, top_bookings.flight_number
FROM passengers p
CROSS JOIN LATERAL (
    SELECT b.class, b.fare, f.flight_number
    FROM bookings b
    JOIN flights f ON b.flight_id = f.flight_id
    WHERE b.passenger_id = p.passenger_id    -- ← references outer p
      AND b.status = 'confirmed'
    ORDER BY b.fare DESC
    LIMIT 2                                  -- ← top 2 per passenger
) AS top_bookings
ORDER BY p.last_name, top_bookings.fare DESC;
```

Without LATERAL, you'd need window functions or correlated subqueries with LIMIT (which doesn't work in IN subqueries).

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A marketing export of "customers who have never ordered product category X" returns **zero** rows after a data migration, and the campaign is cancelled. **Decision**: The query used `WHERE customer_id NOT IN (SELECT customer_id FROM orders ...)`, and the migration introduced a few orders with `customer_id IS NULL`. `NOT IN` against a list containing NULL evaluates to unknown for every row, so nothing is returned. Use `NOT EXISTS` (NULL-safe), and add a NOT NULL constraint on `orders.customer_id`.

</div>

<div class="callout-scenario">

**Scenario**: A product catalog stores categories as `(id, parent_id)`. The website needs breadcrumbs ("Electronics > Phones > Android") and the list of all subcategories under "Electronics" for filters; the application loops with one query per level (N+1 queries, slow pages). **Decision**: A **recursive CTE** fetches the whole subtree or ancestor path in one query. Add a depth limit and cycle protection, since bad data can create loops.

</div>

## 🏋️ Practice Assignments

Run these in the **SQL Playground** above.

### 🟢 Low — Build the reflexes

**L1.** Find bookings with a fare above the average fare of all bookings.

<details>
<summary>Show answer</summary>

```sql
SELECT booking_id, class, fare
FROM bookings
WHERE fare > (SELECT AVG(fare) FROM bookings)
ORDER BY fare DESC;
```

A **non-correlated** scalar subquery — evaluated once.

</details>

**L2.** List passengers who have at least one `first`-class booking, using `EXISTS`.

<details>
<summary>Show answer</summary>

```sql
SELECT p.first_name, p.last_name
FROM passengers p
WHERE EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.passenger_id = p.passenger_id AND b.class = 'first'
);
```

</details>

**L3.** Rewrite L1 using a CTE.

<details>
<summary>Show answer</summary>

```sql
WITH avg_fare AS (SELECT AVG(fare) AS value FROM bookings)
SELECT b.booking_id, b.class, b.fare
FROM bookings b, avg_fare
WHERE b.fare > avg_fare.value
ORDER BY b.fare DESC;
```

</details>

### 🟡 Medium — Apply it

**M1.** For each booking, show how its fare compares with the average fare **of its own class** (a correlated subquery), then rewrite it with a window function.

<details>
<summary>Show answer</summary>

```sql
-- Correlated subquery: re-evaluated per row
SELECT b.booking_id, b.class, b.fare,
       ROUND(b.fare - (SELECT AVG(b2.fare) FROM bookings b2 WHERE b2.class = b.class), 0) AS diff_from_class_avg
FROM bookings b;

-- Window function: one pass, usually faster
SELECT booking_id, class, fare,
       ROUND(fare - AVG(fare) OVER (PARTITION BY class), 0) AS diff_from_class_avg
FROM bookings;
```

</details>

**M2.** Using CTEs, find the airline whose confirmed revenue is the highest, and show its share of total revenue.

<details>
<summary>Show answer</summary>

```sql
WITH airline_revenue AS (
  SELECT al.name, SUM(b.fare) AS revenue
  FROM bookings b
  JOIN flights  f  ON f.flight_id   = b.flight_id
  JOIN routes   r  ON r.route_id    = f.route_id
  JOIN airlines al ON al.airline_id = r.airline_id
  WHERE b.status = 'confirmed'
  GROUP BY al.airline_id, al.name
),
total AS (SELECT SUM(revenue) AS value FROM airline_revenue)
SELECT a.name, a.revenue, ROUND(100.0 * a.revenue / t.value, 1) AS share_pct
FROM airline_revenue a, total t
ORDER BY a.revenue DESC
LIMIT 1;
```

</details>

**M3.** Generate the numbers 1-10 with a recursive CTE, then use the same technique to list each of the next 7 days as dates.

<details>
<summary>Show answer</summary>

```sql
WITH RECURSIVE n(i) AS (
  SELECT 1
  UNION ALL
  SELECT i + 1 FROM n WHERE i < 10
)
SELECT i FROM n;

WITH RECURSIVE d(day) AS (
  SELECT date('2025-06-01')
  UNION ALL
  SELECT date(day, '+1 day') FROM d WHERE day < date('2025-06-07')
)
SELECT day FROM d;          -- SQLite date functions; in PostgreSQL use generate_series
```

</details>

### 🔴 High — Think like a senior

**H1.** Given `employees(id, name, manager_id)`, write a recursive CTE returning every employee in the org tree under a given manager with their depth and the path from the top — safely, even if bad data contains a cycle. (PostgreSQL.)

<details>
<summary>Show answer</summary>

```sql
-- postgres
WITH RECURSIVE org AS (
  SELECT id, name, manager_id, 0 AS depth, ARRAY[id] AS path
  FROM employees WHERE id = :rootId
  UNION ALL
  SELECT e.id, e.name, e.manager_id, o.depth + 1, o.path || e.id
  FROM employees e
  JOIN org o ON e.manager_id = o.id
  WHERE NOT e.id = ANY(o.path)          -- cycle guard
    AND o.depth < 20                    -- depth guard
)
SELECT id, name, depth, path FROM org ORDER BY path;
```

PostgreSQL 14+ also supports the standard `CYCLE id SET is_cycle USING path` clause. Add an index on `employees(manager_id)` so each recursion step is an index lookup.

</details>

**H2.** A report query nests 5 levels of subqueries and nobody can maintain it. How do you refactor and verify it?

<details>
<summary>Show answer</summary>

Refactor into named CTEs, one per logical step (filter base data → aggregate at a clear grain → join dimensions → rank/filter → format), each with a comment stating its grain and purpose. Replace correlated subqueries with joins or window functions where they cause repeated scans. Verify equivalence by running old and new queries on the same data and comparing results with `EXCEPT` in both directions (both must return zero rows), then compare `EXPLAIN ANALYZE` timings. In PostgreSQL 12+, CTEs are inlined by default unless referenced multiple times or marked `MATERIALIZED`, so readability usually costs nothing.

</details>

## 🛠️ Mini Project — Category Tree & Customer Segments

**Goal**: Use subqueries and CTEs to solve two classic production problems. 1-2 evenings (PostgreSQL in Docker).

**Build**

1. Create `categories(id, name, parent_id)` with a 4-level tree of ~200 categories and `products(id, name, category_id)` with 5,000 products.
2. Write recursive CTEs for: breadcrumbs for a product; all products under a top-level category (including all descendants); the depth of the tree. Add cycle and depth guards, then insert a deliberate cycle and show the guard working.
3. Segment customers with CTEs: "new" (first order in the last 30 days), "loyal" (≥ 5 orders in 6 months), "at risk" (ordered before but not in 90 days) — each customer in exactly one segment (priority order).
4. Replace one `NOT IN` with `NOT EXISTS`, insert a NULL to show the difference in results.
5. Verify segment counts sum to the number of customers.

**Acceptance criteria**: queries documented with their grain; `EXPLAIN ANALYZE` shows index usage on `parent_id` and `category_id`.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What is the difference between a correlated and non-correlated subquery?"**

A non-correlated subquery executes once and its result is used by the outer query — it's independent and can be run on its own. For example, WHERE fare > (SELECT AVG(fare) FROM bookings): the inner query runs once, produces a scalar value, and the outer query uses that value. A correlated subquery references a column from the outer query — it re-executes once for every row the outer query processes. For example, WHERE EXISTS (SELECT 1 FROM bookings WHERE passenger_id = p.passenger_id): the inner query uses p.passenger_id from the outer row. Correlated subqueries can be significantly slower at scale — O(n × scan) instead of O(n + scan). They're often replaceable with a JOIN or window function, which the query planner can optimise much better.

</div>

<div class="callout-interview">

**Q: "Why is NOT EXISTS safer than NOT IN when the subquery might return NULLs?"**

NOT IN with a subquery evaluates to unknown (NULL) if any value in the subquery result is NULL. Here's why: NOT IN (1, 2, NULL) translates to col != 1 AND col != 2 AND col != NULL. Since col != NULL is always NULL (unknown in three-valued logic), the entire expression is NULL. A NULL condition in WHERE is treated the same as FALSE — the row is excluded. Result: if the subquery returns any NULL, NOT IN returns zero rows — every row is silently excluded. NOT EXISTS doesn't have this problem: if the inner query uses a correlated reference to an actual outer-row value, NULLs in the inner table simply don't match that value, so they don't affect the EXISTS result. For this reason, NOT EXISTS is always preferred over NOT IN when the subquery column might be nullable.

</div>

<div class="callout-interview">

**Q: "What are CTEs and when would you use them over subqueries?"**

A CTE (Common Table Expression), written with the WITH clause, defines a named temporary result set that you can reference in the main query. I prefer CTEs over subqueries when: the same subquery would be referenced more than once (with MATERIALIZED to ensure it runs only once); when the logic has multiple sequential steps and naming each step makes it readable — you can describe what each step does rather than nesting cryptic parentheses; and when working with recursive logic, which requires WITH RECURSIVE and can't be done with plain subqueries. Subqueries are fine for simple, one-off conditions in WHERE. The key point in PostgreSQL 12+: CTEs are inlined by default (same performance as subqueries), so the choice is mostly about readability and maintainability, not performance.

</div>

<div class="callout-interview">

**Q: "Write a query to find the top passenger by revenue for each airline."**

```sql
-- Model answer:
WITH passenger_airline_spend AS (
    SELECT
        al.airline_id,
        al.name     AS airline_name,
        p.passenger_id,
        p.first_name || ' ' || p.last_name AS passenger,
        p.tier,
        SUM(b.fare) AS total_spent
    FROM bookings b
    JOIN passengers p  ON b.passenger_id = p.passenger_id
    JOIN flights    f  ON b.flight_id    = f.flight_id
    JOIN routes     r  ON f.route_id     = r.route_id
    JOIN airlines   al ON r.airline_id   = al.airline_id
    WHERE b.status = 'confirmed'
    GROUP BY al.airline_id, al.name, p.passenger_id, p.first_name, p.last_name, p.tier
),
ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY airline_id ORDER BY total_spent DESC) AS rn
    FROM passenger_airline_spend
)
SELECT airline_name, passenger, tier, ROUND(total_spent, 0) AS total_spent
FROM ranked
WHERE rn = 1
ORDER BY total_spent DESC;
```

> *"I'd use two CTEs: the first joins all 6 tables and aggregates spend per passenger per airline. The second applies ROW_NUMBER() with PARTITION BY airline_id so each airline gets its own ranking. Finally the outer query filters WHERE rn = 1 to get only the top passenger per airline. This pattern — aggregate, rank, filter — is the template for 'top N per group' problems, which appear constantly in data engineering interviews."*

</div>

<div class="callout-interview">

**Q: "How do recursive CTEs work?"**

A recursive CTE has two parts separated by UNION ALL. The anchor member is a regular query that defines the starting rows — the base case. The recursive member references the CTE itself and adds rows based on the previous iteration's result. PostgreSQL repeats the recursive member until it produces no new rows, building up the full result set. The termination condition is usually a WHERE clause that limits depth or checks for cycles. The classic use cases are: traversing org charts (employee-manager relationships), navigating category hierarchies, finding shortest paths in a graph, or generating date/number sequences. A critical safety measure: always include a depth counter or cycle detection, otherwise an infinite loop will run until PostgreSQL's recursion limit or your query times out.

</div>

---

## Your Practice Checklist

- [ ] Write a scalar subquery that compares each flight's load to the overall average
- [ ] Use a derived table in FROM to find the top 3 routes by revenue
- [ ] Write a correlated subquery to find each passenger's most expensive booking
- [ ] Rewrite the correlated subquery as a JOIN — compare the two approaches
- [ ] Use NOT EXISTS to find passengers with no confirmed bookings
- [ ] Write a CTE with 3 named steps to produce a complex report
- [ ] Try a recursive CTE: generate the numbers 1-50
- [ ] Use the "CTE + ROW_NUMBER() + WHERE rn = 1" pattern to get top per group

## Related Topics

- `sql-window-functions` — ROW_NUMBER, RANK, running totals (used heavily in CTEs)
- `sql-aggregates` — GROUP BY, HAVING — feeds into CTEs
- `sql-joins` — The JOIN patterns used inside subqueries
- `sql-indexing` — Subqueries are often slow without the right indexes

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth uses a recursive CTE for its category tree and a data-modifying CTE to release expired stock holds.

**Continue the story:** [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
