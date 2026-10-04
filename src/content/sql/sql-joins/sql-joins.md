# SQL Joins — INNER, LEFT, RIGHT, FULL, CROSS, Self

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Design — data model** · ShopNorth uses this in [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql)

</div>
<!-- sdlc-stage:end -->

> **Use the SQL Playground above** — all queries run against the airline database. Joins are the foundation of relational databases. Master them here.

---

## Table of Contents

1. [Why Joins Exist](#1-why-joins-exist)
2. [The Join Mental Model](#2-join-mental-model)
3. [INNER JOIN — Only Matching Rows](#3-inner-join)
4. [LEFT JOIN — Preserve Left Side](#4-left-join)
5. [RIGHT JOIN — Preserve Right Side](#5-right-join)
6. [FULL OUTER JOIN — Preserve Both Sides](#6-full-outer-join)
7. [CROSS JOIN — Every Combination](#7-cross-join)
8. [SELF JOIN — Table Joins Itself](#8-self-join)
9. [Multi-Table Joins — Three or More Tables](#9-multi-table-joins)
10. [JOIN vs Subquery — When to Use Which](#10-join-vs-subquery)
11. [Performance — How Joins Execute](#11-performance)
12. [Common Mistakes](#12-common-mistakes)
13. [Interview Questions](#13-interview-questions)

---

## 1. Why Joins Exist

Relational databases store data in **normalised** form — each fact in exactly one place. A passenger's name is stored once in `passengers`, not repeated in every booking row. A flight's departure time is stored once in `flights`, not in every booking.

To answer questions that span multiple tables, you need to **join** them back together.

```
Question: "Which passengers have bookings on flight AI101?"

Answer requires joining:
  bookings (has passenger_id + flight_id) 
    + passengers (has passenger name)
    + flights (has flight_number)
```

The fundamental idea: find rows in two tables where a column value matches (usually a foreign key → primary key relationship).

---

## 2. The Join Mental Model

Think of a join as a Venn diagram with rows instead of sets:

```
Table A (left)          Table B (right)
┌──────────────┐        ┌──────────────┐
│ A rows       │        │ B rows       │
│ not in B  ╔══════════════╗           │
│           ║ Matching  ║             │
│           ║  rows     ║             │
│           ╚══════════════╝           │
│              └──────────────┘        │
└──────────────┘

INNER JOIN  = Only the intersection (matching rows)
LEFT JOIN   = Left side + intersection (all A rows)
RIGHT JOIN  = Right side + intersection (all B rows)
FULL JOIN   = Everything from both sides
CROSS JOIN  = Every A row × every B row (no join condition)
```

The join condition (`ON table1.col = table2.col`) determines which rows "match".

---

## 3. INNER JOIN — Only Matching Rows

Returns rows where the join condition is TRUE in **both** tables. Rows without a match in either table are excluded.

### Basic syntax

```sql
SELECT f.flight_number, f.status, f.departure_time,
       r.distance_km
FROM flights f
INNER JOIN routes r ON f.route_id = r.route_id
ORDER BY f.departure_time;
```

`INNER` is optional — `JOIN` alone means `INNER JOIN`. Both are identical.

### Join flights with their origin and destination airports

```sql
SELECT f.flight_number,
       f.status,
       a_origin.iata_code  AS origin,
       a_dest.iata_code    AS destination,
       a_origin.city       AS from_city,
       a_dest.city         AS to_city,
       r.distance_km
FROM flights f
JOIN routes   r        ON f.route_id   = r.route_id
JOIN airports a_origin ON r.origin_id  = a_origin.airport_id
JOIN airports a_dest   ON r.dest_id    = a_dest.airport_id
ORDER BY f.departure_time;
```

Note: `airports` is joined twice with different aliases (`a_origin`, `a_dest`). This is normal and necessary when the same table plays two different roles.

### Add the airline

```sql
SELECT al.code         AS airline,
       f.flight_number,
       a1.iata_code    AS origin,
       a2.iata_code    AS dest,
       f.status,
       f.seats_booked,
       f.seats_total,
       ROUND(CAST(f.seats_booked AS REAL) / f.seats_total * 100, 1) AS load_pct
FROM flights f
JOIN routes   r  ON f.route_id  = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
JOIN airports a1 ON r.origin_id  = a1.airport_id
JOIN airports a2 ON r.dest_id    = a2.airport_id
WHERE f.status != 'cancelled'
ORDER BY load_pct DESC;
```

### Full booking details (all 5 tables joined)

```sql
SELECT b.booking_id,
       p.first_name || ' ' || p.last_name AS passenger,
       p.tier,
       al.code || f.flight_number         AS flight,
       a1.iata_code || '→' || a2.iata_code AS route,
       b.class,
       b.fare,
       b.status AS booking_status
FROM bookings b
JOIN passengers p  ON b.passenger_id = p.passenger_id
JOIN flights    f  ON b.flight_id    = f.flight_id
JOIN routes     r  ON f.route_id     = r.route_id
JOIN airlines  al  ON r.airline_id   = al.airline_id
JOIN airports  a1  ON r.origin_id    = a1.airport_id
JOIN airports  a2  ON r.dest_id      = a2.airport_id
ORDER BY b.fare DESC
LIMIT 15;
```

<div class="callout-tip">

**Column naming collision**: when two tables have a column with the same name (e.g., both have `status`), you MUST qualify them with the table alias: `b.status`, `f.status`. Unqualified column names in a join cause an "ambiguous column" error.

</div>

---

## 4. LEFT JOIN — Preserve the Left Side

Returns all rows from the **left** table, plus matching rows from the right table. When there's no match in the right table, right-table columns are NULL.

```
LEFT TABLE     RIGHT TABLE     LEFT JOIN RESULT
──────────     ──────────      ────────────────────────────────────────
id  name       id  data        left.id  left.name  right.data
1   Alice      1   X           1        Alice      X
2   Bob        3   Y           2        Bob        NULL  ← no match
3   Carol                      3        Carol      Y
```

### Which flights have no bookings?

```sql
SELECT f.flight_number,
       f.status,
       f.seats_total,
       COUNT(b.booking_id) AS booking_count
FROM flights f
LEFT JOIN bookings b ON b.flight_id = f.flight_id
GROUP BY f.flight_id, f.flight_number, f.status, f.seats_total
ORDER BY booking_count ASC;
-- Flights with 0 bookings appear with booking_count = 0
-- (the LEFT JOIN gives NULL for b.booking_id, COUNT ignores NULLs)
```

### Find passengers who have never made a booking

```sql
SELECT p.passenger_id,
       p.first_name || ' ' || p.last_name AS passenger,
       p.tier,
       p.total_miles
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
WHERE b.booking_id IS NULL;
-- The IS NULL filter is the key pattern for "find rows with no match"
-- Only rows with no bookings will have NULL for b.booking_id after the LEFT JOIN
```

This `LEFT JOIN ... WHERE right_table.col IS NULL` pattern is the canonical way to find "rows in A with no match in B" — more efficient than `NOT IN` and safer than `NOT EXISTS` in some cases.

### LEFT JOIN with filtering

```sql
-- CAREFUL: WHERE clause on right table turns LEFT JOIN into INNER JOIN
-- This is a very common bug:

-- BUG: filters OUT unmatched rows (turned into INNER JOIN)
SELECT p.first_name, b.fare
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
WHERE b.class = 'business';     -- ← This kills the LEFT JOIN!
-- Passengers with no bookings disappear because b.class IS NULL, not 'business'

-- CORRECT: filter in the ON clause — keeps unmatched rows
SELECT p.first_name, b.fare
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
                     AND b.class = 'business';
-- Now all passengers appear; fare is NULL for those without business bookings
```

<div class="callout-warn">

**The most common LEFT JOIN bug**: putting a filter condition on the right table in the WHERE clause instead of the ON clause. The WHERE clause runs AFTER the join, treating NULLs (from unmatched rows) as not matching the condition, effectively converting the LEFT JOIN into an INNER JOIN.

</div>

---

## 5. RIGHT JOIN — Preserve the Right Side

`RIGHT JOIN` is the mirror of `LEFT JOIN` — it preserves all rows from the right table. It's rarely used in practice because you can always rewrite a RIGHT JOIN as a LEFT JOIN by swapping table order.

```sql
-- These two queries produce identical results:

-- RIGHT JOIN
SELECT al.name, f.flight_number
FROM flights f
RIGHT JOIN airlines al ON f.route_id IN (
    SELECT route_id FROM routes WHERE airline_id = al.airline_id
);

-- LEFT JOIN (preferred — more readable)
SELECT al.name, f.flight_number
FROM airlines al
LEFT JOIN routes r ON r.airline_id = al.airline_id
LEFT JOIN flights f ON f.route_id = r.route_id
ORDER BY al.name;
-- More explicit and easier to reason about
```

Most style guides recommend avoiding RIGHT JOIN — always restructure as LEFT JOIN for consistency.

---

## 6. FULL OUTER JOIN — Preserve Both Sides

Returns all rows from both tables, with NULLs where there's no match on either side.

```sql
-- Show all airlines AND all airports — matched where possible
-- SQLite doesn't support FULL OUTER JOIN natively;
-- PostgreSQL syntax:
SELECT al.name      AS airline,
       ap.iata_code AS hub_airport,
       ap.city
FROM airlines al
FULL OUTER JOIN airports ap ON al.hub = ap.iata_code;
-- Airlines without airports (hub not in airports table): NULL on airport side
-- Airports without airlines using them as hub: NULL on airline side

-- SQLite workaround with UNION:
SELECT al.name, ap.iata_code, ap.city
FROM airlines al LEFT JOIN airports ap ON al.hub = ap.iata_code
UNION
SELECT al.name, ap.iata_code, ap.city
FROM airports ap LEFT JOIN airlines al ON al.hub = ap.iata_code
WHERE al.airline_id IS NULL;
```

FULL OUTER JOIN is used for data reconciliation — finding what's in one dataset but not the other, or identifying mismatches.

---

## 7. CROSS JOIN — Every Combination

Returns the Cartesian product: every row from the left table paired with every row from the right table. No join condition.

```sql
-- 5 airlines × 10 airports = 50 rows (all possible airline-airport pairs)
SELECT al.code, al.name, ap.iata_code, ap.city
FROM airlines al
CROSS JOIN airports ap
ORDER BY al.code, ap.iata_code;

-- Practical use: generate a calendar or test data
-- Generate seat labels: rows A-D × numbers 1-30
SELECT r.row_num || c.col_letter AS seat_label
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
             (11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
             (21),(22),(23),(24),(25),(26),(27),(28),(29),(30)) AS r(row_num)
CROSS JOIN (VALUES ('A'),('B'),('C'),('D'),('E'),('F')) AS c(col_letter)
ORDER BY row_num, col_letter;
```

Accidental CROSS JOIN (old-style comma join syntax without a WHERE condition) is a common bug that can produce billions of rows.

---

## 8. SELF JOIN — A Table Joined to Itself

Used when rows in a table have a relationship to other rows in the same table (hierarchical data, pairs, etc.).

### Find all passengers with the same nationality as a given passenger

```sql
SELECT p1.first_name || ' ' || p1.last_name AS passenger_1,
       p2.first_name || ' ' || p2.last_name AS passenger_2,
       p1.nationality
FROM passengers p1
JOIN passengers p2 ON p1.nationality = p2.nationality
                   AND p1.passenger_id < p2.passenger_id  -- avoid duplicates (A,B) and (B,A)
ORDER BY p1.nationality, p1.last_name;
```

### Find routes between the same two airports (different airlines)

```sql
SELECT r1.route_id        AS route1,
       al1.code           AS airline1,
       r2.route_id        AS route2,
       al2.code           AS airline2,
       a_org.iata_code    AS origin,
       a_dst.iata_code    AS dest,
       r1.distance_km
FROM routes r1
JOIN routes   r2  ON r1.origin_id = r2.origin_id
                  AND r1.dest_id  = r2.dest_id
                  AND r1.airline_id < r2.airline_id  -- avoid duplicates
JOIN airlines al1 ON r1.airline_id = al1.airline_id
JOIN airlines al2 ON r2.airline_id = al2.airline_id
JOIN airports a_org ON r1.origin_id = a_org.airport_id
JOIN airports a_dst ON r1.dest_id   = a_dst.airport_id
ORDER BY a_org.iata_code, a_dst.iata_code;
-- Shows competing routes between the same city pairs
```

### Employee hierarchy example (classic self-join use case)

```sql
-- In PostgreSQL, if you had an employees table with manager_id:
SELECT e.first_name || ' ' || e.last_name AS employee,
       m.first_name || ' ' || m.last_name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.employee_id
ORDER BY manager NULLS LAST, employee;
-- The CEO has no manager (NULL) — LEFT JOIN preserves them
```

---

## 9. Multi-Table Joins — Three or More Tables

Each additional JOIN adds another table to the result set. The engine processes them left-to-right by default (though the query planner may reorder for efficiency).

### 5-table join: complete booking context

```sql
SELECT
    b.booking_id,
    p.first_name || ' ' || p.last_name  AS passenger,
    p.tier                              AS loyalty_tier,
    al.name                             AS airline,
    f.flight_number,
    a1.city || ' (' || a1.iata_code || ')' AS origin_city,
    a2.city || ' (' || a2.iata_code || ')' AS dest_city,
    r.distance_km,
    b.class,
    b.seat,
    b.fare,
    b.status                            AS booking_status,
    f.status                            AS flight_status
FROM bookings    b
JOIN passengers  p   ON b.passenger_id = p.passenger_id
JOIN flights     f   ON b.flight_id    = f.flight_id
JOIN routes      r   ON f.route_id     = r.route_id
JOIN airlines    al  ON r.airline_id   = al.airline_id
JOIN airports    a1  ON r.origin_id    = a1.airport_id
JOIN airports    a2  ON r.dest_id      = a2.airport_id
WHERE b.status = 'confirmed'
ORDER BY b.fare DESC
LIMIT 20;
```

### Revenue by route and airline

```sql
SELECT
    al.code                                   AS airline_code,
    al.name                                   AS airline_name,
    a1.iata_code || ' → ' || a2.iata_code     AS route,
    r.distance_km,
    COUNT(b.booking_id)                        AS total_bookings,
    ROUND(SUM(b.fare), 0)                      AS total_revenue,
    ROUND(AVG(b.fare), 0)                      AS avg_fare,
    ROUND(SUM(b.fare) / NULLIF(r.distance_km, 0), 2) AS revenue_per_km
FROM bookings   b
JOIN flights    f   ON b.flight_id   = f.flight_id
JOIN routes     r   ON f.route_id    = r.route_id
JOIN airlines   al  ON r.airline_id  = al.airline_id
JOIN airports   a1  ON r.origin_id   = a1.airport_id
JOIN airports   a2  ON r.dest_id     = a2.airport_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.code, al.name, r.route_id, a1.iata_code, a2.iata_code, r.distance_km
ORDER BY total_revenue DESC;
```

---

## 10. JOIN vs Subquery — When to Use Which

Both can often solve the same problem. The choice matters for readability and sometimes performance.

### Finding top spender — JOIN approach

```sql
SELECT p.first_name, p.last_name, total_spend.total
FROM passengers p
JOIN (
    SELECT passenger_id, SUM(fare) AS total
    FROM bookings
    WHERE status = 'confirmed'
    GROUP BY passenger_id
) AS total_spend ON p.passenger_id = total_spend.passenger_id
ORDER BY total_spend.total DESC
LIMIT 5;
```

### Same result — WHERE + subquery approach

```sql
SELECT first_name, last_name
FROM passengers
WHERE passenger_id IN (
    SELECT passenger_id
    FROM bookings
    WHERE status = 'confirmed'
    GROUP BY passenger_id
    HAVING SUM(fare) > 50000
);
```

### When to prefer JOIN:
- When you need columns from both tables in the output
- When joining on a foreign key (the natural case)
- When performance matters for large datasets (JOIN can use merge/hash strategies)

### When to prefer subquery:
- When you only need existence (use EXISTS)
- When the derived table is used once and is clearer as a subquery
- For scalar values used as a filter

---

## 11. Performance — How Joins Execute

PostgreSQL chooses from three physical join strategies based on cost estimates:

```
┌─────────────────────────────────────────────────────────────────────┐
│  NESTED LOOP JOIN                                                   │
│  For each row in outer table, scan inner table                      │
│  Cost: O(n × m)                                                     │
│  Best when: outer table is small, inner table has index on join key │
│  Example: 10 airlines × scan bookings for each → bad               │
│           10 airlines × index lookup in bookings → good             │
├─────────────────────────────────────────────────────────────────────┤
│  HASH JOIN                                                          │
│  Build hash table from smaller table, probe with larger table       │
│  Cost: O(n + m) but requires memory                                 │
│  Best when: both tables are large, no index, memory available       │
│  Common for: joining two big tables without index on join key       │
├─────────────────────────────────────────────────────────────────────┤
│  MERGE JOIN                                                         │
│  Both tables sorted on join key, merged linearly                    │
│  Cost: O(n log n + m log m) for sorting, then O(n + m)             │
│  Best when: both tables already sorted/indexed on join key          │
│  Common for: joining two tables where both have B-tree indexes      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key rules for join performance

```sql
-- 1. Always have an index on foreign key columns used in JOINs:
CREATE INDEX idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX idx_bookings_flight    ON bookings(flight_id);
CREATE INDEX idx_flights_route      ON flights(route_id);

-- 2. Check what strategy PostgreSQL chooses:
EXPLAIN ANALYZE
SELECT * FROM bookings b
JOIN passengers p ON b.passenger_id = p.passenger_id
WHERE p.tier = 'platinum';

-- 3. Filter early — put WHERE conditions BEFORE joins when possible
-- PostgreSQL planner usually does this, but explicit is clear:
SELECT p.first_name, b.fare
FROM (SELECT * FROM passengers WHERE tier = 'platinum') AS p
JOIN bookings b ON b.passenger_id = p.passenger_id;
```

---

## 12. Common Mistakes

### Mistake 1: Forgetting the join condition (accidental CROSS JOIN)

```sql
-- BUG: no ON clause — returns all flights × all passengers!
SELECT f.flight_number, p.first_name
FROM flights f, passengers p;
-- 28 flights × 30 passengers = 840 rows (all wrong)

-- CORRECT: explicit JOIN with condition
SELECT f.flight_number, p.first_name
FROM flights f
JOIN bookings b ON b.flight_id = f.flight_id
JOIN passengers p ON b.passenger_id = p.passenger_id;
```

### Mistake 2: WHERE filter on right table turns LEFT JOIN into INNER JOIN

```sql
-- BUG: converts LEFT JOIN to INNER JOIN
SELECT p.first_name, b.fare
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
WHERE b.class = 'business';  -- ← kills unmatched rows

-- CORRECT: filter in the ON clause
SELECT p.first_name, b.fare
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
                     AND b.class = 'business';
```

### Mistake 3: Ambiguous column names without table alias

```sql
-- BUG: PostgreSQL can't tell which 'status' you mean
SELECT flight_number, status, fare
FROM flights
JOIN bookings ON bookings.flight_id = flights.flight_id;
-- ERROR: column "status" is ambiguous (both tables have status)

-- CORRECT: qualify all ambiguous columns
SELECT f.flight_number, f.status AS flight_status,
       b.status AS booking_status, b.fare
FROM flights f
JOIN bookings b ON b.flight_id = f.flight_id;
```

### Mistake 4: Joining on the wrong column

```sql
-- BUG: accidentally joining on the same PK column
SELECT p.first_name, b.fare
FROM passengers p
JOIN bookings b ON p.passenger_id = b.booking_id;  -- ← booking_id, not passenger_id!
-- Returns wrong data with no error

-- CORRECT: always double-check FK → PK direction
SELECT p.first_name, b.fare
FROM passengers p
JOIN bookings b ON b.passenger_id = p.passenger_id;
```

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A finance dashboard's "revenue per airline" total is 3x higher than the accounting ledger. The query joins bookings to flights to a `flight_crew` table before summing fares. **Decision**: Joining to a one-to-many table (3 crew rows per flight) **multiplies** each booking row — "fan-out" — so `SUM(fare)` counts every fare three times. Aggregate at the right grain before joining (sum bookings per flight in a subquery/CTE, then join), or avoid joining tables the metric doesn't need. Always sanity-check totals against a trusted source.

</div>

<div class="callout-scenario">

**Scenario**: A report of "all passengers and their business-class bookings" silently drops passengers with no business bookings, and the sales team thinks the customer base shrank. **Decision**: The filter `b.class = 'business'` was in the `WHERE` clause after a `LEFT JOIN`, turning it into an inner join. Move right-table filters into the `ON` clause to keep unmatched left rows, and add a row-count check (the report should have exactly one row per passenger).

</div>

## 🏋️ Practice Assignments

Run these in the **SQL Playground** above.

### 🟢 Low — Build the reflexes

**L1.** List each flight with its airline name and origin and destination airport codes.

<details>
<summary>Show answer</summary>

```sql
SELECT f.flight_number, al.name AS airline, o.iata_code AS origin, d.iata_code AS destination
FROM flights f
JOIN routes   r  ON r.route_id   = f.route_id
JOIN airlines al ON al.airline_id = r.airline_id
JOIN airports o  ON o.airport_id  = r.origin_id
JOIN airports d  ON d.airport_id  = r.dest_id
ORDER BY f.flight_number;
```

The `airports` table is joined **twice** with different aliases — once for each role.

</details>

**L2.** Find passengers who have never made a booking.

<details>
<summary>Show answer</summary>

```sql
SELECT p.passenger_id, p.first_name, p.last_name
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
WHERE b.booking_id IS NULL;
```

Equivalent and often clearer: `WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.passenger_id = p.passenger_id)`.

In the sample data every passenger has booked, so this returns no rows. Add one to see it work: `INSERT INTO passengers (passenger_id, first_name, last_name, email) VALUES (99, 'Test', 'NoTrips', 'test99@example.com');` — then run the query again.

</details>

**L3.** Show every airline with the number of routes it operates, including airlines with zero routes.

<details>
<summary>Show answer</summary>

```sql
SELECT al.name, COUNT(r.route_id) AS routes
FROM airlines al
LEFT JOIN routes r ON r.airline_id = al.airline_id
GROUP BY al.airline_id, al.name
ORDER BY routes DESC;
```

`COUNT(r.route_id)` (not `COUNT(*)`) counts 0 for airlines without routes, because the column is NULL on unmatched rows.

</details>

### 🟡 Medium — Apply it

**M1.** List all passengers with the count of their **business-class** bookings, including passengers with zero.

<details>
<summary>Show answer</summary>

```sql
SELECT p.first_name || ' ' || p.last_name AS passenger,
       COUNT(b.booking_id) AS business_bookings
FROM passengers p
LEFT JOIN bookings b
       ON b.passenger_id = p.passenger_id
      AND b.class = 'business'                 -- filter in ON keeps passengers with no match
GROUP BY p.passenger_id, p.first_name, p.last_name
ORDER BY business_bookings DESC;
```

</details>

**M2.** Find pairs of routes that connect the same two airports (in the same direction) but are operated by different airlines.

<details>
<summary>Show answer</summary>

```sql
SELECT a1.code AS airline_1, a2.code AS airline_2,
       o.iata_code AS origin, d.iata_code AS destination
FROM routes r1
JOIN routes r2   ON r2.origin_id = r1.origin_id
                AND r2.dest_id   = r1.dest_id
                AND r2.airline_id > r1.airline_id     -- each pair once, no self-pairs
JOIN airlines a1 ON a1.airline_id = r1.airline_id
JOIN airlines a2 ON a2.airline_id = r2.airline_id
JOIN airports o  ON o.airport_id  = r1.origin_id
JOIN airports d  ON d.airport_id  = r1.dest_id;
```

A self-join with `>` instead of `<>` avoids returning both (A, B) and (B, A).

</details>

**M3.** Revenue per airline from confirmed bookings, with the number of distinct passengers.

<details>
<summary>Show answer</summary>

```sql
SELECT al.name,
       COUNT(DISTINCT b.passenger_id) AS passengers,
       SUM(b.fare)                    AS revenue
FROM bookings b
JOIN flights  f  ON f.flight_id   = b.flight_id
JOIN routes   r  ON r.route_id    = f.route_id
JOIN airlines al ON al.airline_id = r.airline_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.name
ORDER BY revenue DESC;
```

</details>

### 🔴 High — Think like a senior

**H1.** Produce, per flight, the booked revenue and the number of distinct aircraft crew — without fan-out inflating the revenue. (Assume a `flight_crew(flight_id, crew_id)` table exists in production.)

<details>
<summary>Show answer</summary>

Aggregate each child table **separately at the flight grain**, then join the aggregates:

```sql
WITH rev AS (
  SELECT flight_id, SUM(fare) AS revenue
  FROM bookings WHERE status = 'confirmed'
  GROUP BY flight_id
)
SELECT f.flight_number, COALESCE(rev.revenue, 0) AS revenue
FROM flights f
LEFT JOIN rev ON rev.flight_id = f.flight_id
ORDER BY revenue DESC;
-- In production, add:  LEFT JOIN (SELECT flight_id, COUNT(DISTINCT crew_id) AS crew
--                                FROM flight_crew GROUP BY flight_id) c ON c.flight_id = f.flight_id
```

Joining bookings and crew directly to flights would create bookings × crew rows per flight, multiplying `SUM(fare)`. This "aggregate before join" pattern is the standard fix for fan-out.

</details>

**H2.** A 6-table join report takes 40 seconds in PostgreSQL. Walk through how you'd optimize it.

<details>
<summary>Show answer</summary>

(1) `EXPLAIN (ANALYZE, BUFFERS)`: find the most expensive node, large seq scans, and bad row estimates (estimated 10 rows, actual 2M → wrong join algorithm). (2) Ensure indexes exist on **foreign keys used in joins** (PostgreSQL doesn't create them automatically) and on selective filter columns. (3) Filter early: push date/status filters to the largest table; aggregate before joining when possible (fan-out). (4) Update statistics (`ANALYZE`) if estimates are off; consider extended statistics for correlated columns. (5) Select only needed columns (enables index-only scans). (6) If it's a recurring dashboard over large history, precompute with a materialized view or a summary table refreshed incrementally. Re-measure after each change.

</details>

## 🛠️ Mini Project — Customer 360 View

**Goal**: Build one query-backed "customer profile" combining 5+ tables correctly. 1 evening.

**Build**

1. In the playground: one row per passenger with total confirmed spend, number of trips, favorite airline (most bookings), last travel date, most frequent destination city, and cancellation count — passengers with no bookings must still appear with zeros/NULLs.
2. Use CTEs to aggregate each metric at the passenger grain, then join them to `passengers` with `LEFT JOIN`s (no fan-out).
3. Verify: the row count equals the passenger count, and total spend across all rows equals `SELECT SUM(fare) FROM bookings WHERE status = 'confirmed'`.
4. Port to PostgreSQL, add the indexes it needs, and compare `EXPLAIN` plans before/after.

**Acceptance criteria**: the two verification checks pass, and a README documents the grain of each CTE.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What is the difference between INNER JOIN and LEFT JOIN?"**

INNER JOIN returns only rows where the join condition is TRUE in both tables. If a row in the left table has no matching row in the right table, it's excluded. LEFT JOIN preserves every row from the left table regardless of whether there's a match — unmatched rows get NULLs for the right table's columns. The practical difference: INNER JOIN for 'give me rows that exist in both tables', LEFT JOIN for 'give me all rows from the left table and add data from the right where available — or NULL where not'. The LEFT JOIN pattern is also essential for finding rows with no match: LEFT JOIN ... WHERE right_table.id IS NULL.

</div>

<div class="callout-interview">

**Q: "How would you find passengers who have no bookings?"**

There are three ways. First, LEFT JOIN with IS NULL filter: join passengers to bookings with a LEFT JOIN, then filter WHERE bookings.booking_id IS NULL — this returns passengers with no matching booking. Second, NOT EXISTS with a correlated subquery: WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE passenger_id = passengers.passenger_id) — clearly expresses intent. Third, NOT IN: WHERE passenger_id NOT IN (SELECT passenger_id FROM bookings) — works but risky if the subquery can return NULLs, which makes NOT IN return zero rows. I'd use NOT EXISTS for production code because it's safe with NULLs, expresses intent clearly, and the planner often uses the same execution plan as LEFT JOIN.

</div>

<div class="callout-interview">

**Q: "Explain a situation where you need to join a table to itself."**

The canonical cases are hierarchical data and symmetric relationships. For hierarchical data — employees and their managers, categories and subcategories — the table has a self-referential foreign key: employees.manager_id references employees.employee_id. To display each employee alongside their manager's name, you join employees as 'e' to employees as 'm' on e.manager_id = m.employee_id. For symmetric relationships — finding pairs of items that share an attribute, like passengers from the same country — you join the table to itself with different aliases and add a condition like p1.id < p2.id to avoid returning both (A,B) and (B,A). In the airline database, I'd use a self-join on routes to find pairs of routes connecting the same cities but operated by different airlines.

</div>

<div class="callout-interview">

**Q: "Why does adding a WHERE clause on the right table's column sometimes turn a LEFT JOIN into an INNER JOIN?"**

A LEFT JOIN produces NULLs for all right-table columns when there's no match. The WHERE clause runs after the join. So if you write LEFT JOIN bookings b ON ... WHERE b.class = 'business', passengers with no bookings get NULL for b.class. NULL = 'business' is NULL (unknown), not TRUE. Since WHERE only passes rows where the condition is TRUE, these passengers are excluded — exactly the behaviour of an INNER JOIN. The fix is to move the filter into the ON clause: JOIN bookings b ON b.passenger_id = p.passenger_id AND b.class = 'business'. Now the filter is part of the join condition, not a post-join filter, so unmatched passengers survive with NULL for b.class.

</div>

<div class="callout-interview">

**Q: "What are the three physical join algorithms PostgreSQL uses?"**

Nested Loop, Hash Join, and Merge Join. Nested Loop: for each row in the outer table, scan the inner table — efficient when the outer table is small and the inner has an index on the join key. O(n × log m) with an index. Hash Join: build a hash table from the smaller table in memory, then probe it with the larger table — O(n + m) but requires RAM for the hash. Best for large tables without indexes. Merge Join: both tables are sorted on the join key (or already have indexes), then merged linearly — O(n + m) after sorting. The planner chooses based on table statistics, available indexes, memory settings, and estimated row counts from ANALYZE. You can see the choice with EXPLAIN.

</div>

---

## Your Practice Checklist

- [ ] Write a 3-table JOIN: flights + routes + airlines — show airline code, flight number, status
- [ ] Use LEFT JOIN to find all airlines with their flight count (including airlines with 0 flights)
- [ ] Find passengers with no confirmed bookings — using LEFT JOIN + IS NULL pattern
- [ ] Write a self-join on passengers to find pairs of passengers with the same nationality
- [ ] Join all 6 tables (bookings, passengers, flights, routes, airlines, airports) in one query
- [ ] Reproduce the LEFT JOIN bug (WHERE clause on right table) and then fix it with ON clause
- [ ] Use EXPLAIN ANALYZE in PostgreSQL to see which join strategy is chosen

## Related Topics

- `sql-basics` — SELECT, WHERE, ORDER BY foundations
- `sql-aggregates` — GROUP BY on joined tables
- `sql-subqueries-cte` — Subqueries as alternatives to joins
- `sql-indexing` — Indexes that make joins fast

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's top-products report joins order items with orders to count only paid sales.

**Continue the story:** [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
