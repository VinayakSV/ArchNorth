# SQL Aggregates — GROUP BY, HAVING, COUNT, SUM, AVG

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Design — data model** · ShopNorth uses this in [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql)

</div>
<!-- sdlc-stage:end -->

> **Use the SQL Playground above** — all queries run live. Aggregation is where SQL goes from "retrieve data" to "answer business questions."

---

## Table of Contents

1. [What Aggregation Is](#1-what-aggregation-is)
2. [The Five Core Aggregate Functions](#2-aggregate-functions)
3. [GROUP BY — Grouping Rows](#3-group-by)
4. [HAVING — Filtering Groups](#4-having)
5. [NULL Handling in Aggregates](#5-null-handling)
6. [FILTER Clause — Conditional Aggregation](#6-filter-clause)
7. [STRING_AGG and ARRAY_AGG](#7-string-agg)
8. [ROLLUP, CUBE, GROUPING SETS](#8-rollup-cube)
9. [Aggregate + JOIN Patterns](#9-aggregate-join-patterns)
10. [Performance Considerations](#10-performance)
11. [Common Mistakes](#11-common-mistakes)
12. [Interview Questions](#12-interview-questions)

---

## 1. What Aggregation Is

Aggregation collapses many rows into one summary row. Instead of seeing each booking individually, you see "total revenue per airline" — one row per airline.

```
Individual bookings (86 rows):           Aggregated (5 rows — one per airline):
booking_id  airline  fare                 airline     bookings  revenue
──────────  ───────  ────                 ───────     ────────  ───────
1           AI       85000                Air India    N         X
2           AI       62000                IndiGo       N         X
3           6E       3800                 Vistara      N         X
...                                       Emirates     N         X
                                         British Air  N         X
```

The execution order matters:

```
FROM → JOIN → WHERE (filter rows) → GROUP BY → HAVING (filter groups) → SELECT → ORDER BY
```

**WHERE filters individual rows. HAVING filters aggregated groups.** Aggregation only happens after WHERE.

---

## 2. The Five Core Aggregate Functions

```sql
SELECT
    COUNT(*)                           AS total_bookings,        -- count all rows
    COUNT(checked_in)                  AS rows_with_check_in,    -- count non-NULLs
    COUNT(DISTINCT passenger_id)       AS unique_passengers,
    SUM(fare)                          AS total_revenue,
    AVG(fare)                          AS average_fare,
    MIN(fare)                          AS cheapest_fare,
    MAX(fare)                          AS most_expensive_fare,
    ROUND(SUM(fare) / COUNT(*), 2)     AS custom_avg            -- same as AVG
FROM bookings
WHERE status = 'confirmed';
```

**Try this in the playground.** One row back, summarising all confirmed bookings.

### COUNT variants

```sql
-- COUNT(*): count all rows, including NULLs
SELECT COUNT(*) FROM bookings;                    -- 86 (total bookings)

-- COUNT(column): count non-NULL values only
SELECT COUNT(checked_in) FROM bookings;           -- counts rows where checked_in IS NOT NULL

-- COUNT(DISTINCT column): count unique values
SELECT COUNT(DISTINCT passenger_id) FROM bookings; -- how many distinct passengers booked

-- COUNT(*) vs COUNT(column) — the difference matters
SELECT COUNT(*), COUNT(seat) FROM bookings;
-- If some bookings don't have a seat assigned, these differ
```

### SUM, AVG, MIN, MAX

```sql
SELECT
    SUM(fare)                AS total_fare_collected,
    AVG(fare)                AS mean_fare,
    PERCENTILE_CONT(0.5)     -- PostgreSQL: median (not in SQLite)
      WITHIN GROUP (ORDER BY fare) AS median_fare,
    MIN(fare)                AS cheapest,
    MAX(fare)                AS most_expensive,
    MAX(fare) - MIN(fare)    AS fare_range
FROM bookings
WHERE status = 'confirmed';

-- In SQLite playground, use ROUND for cleaner display:
SELECT
    ROUND(SUM(fare), 0)   AS total_revenue,
    ROUND(AVG(fare), 0)   AS avg_fare,
    MIN(fare)             AS min_fare,
    MAX(fare)             AS max_fare
FROM bookings
WHERE status = 'confirmed';
```

---

## 3. GROUP BY — Grouping Rows

`GROUP BY` partitions rows into groups. One aggregate row is returned per group.

### Revenue and bookings by class

```sql
SELECT
    class,
    COUNT(*)          AS booking_count,
    ROUND(SUM(fare), 0)  AS total_revenue,
    ROUND(AVG(fare), 0)  AS avg_fare,
    MIN(fare)            AS cheapest,
    MAX(fare)            AS most_expensive
FROM bookings
WHERE status = 'confirmed'
GROUP BY class
ORDER BY total_revenue DESC;
```

### Revenue by airline (requires JOIN + GROUP BY)

```sql
SELECT
    al.name                  AS airline,
    al.code,
    COUNT(b.booking_id)      AS bookings,
    ROUND(SUM(b.fare), 0)    AS revenue,
    ROUND(AVG(b.fare), 0)    AS avg_fare
FROM bookings b
JOIN flights   f  ON b.flight_id   = f.flight_id
JOIN routes    r  ON f.route_id    = r.route_id
JOIN airlines  al ON r.airline_id  = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.name, al.code
ORDER BY revenue DESC;
```

### Bookings per passenger, with tier

```sql
SELECT
    p.first_name || ' ' || p.last_name  AS passenger,
    p.tier,
    COUNT(b.booking_id)                  AS total_bookings,
    ROUND(SUM(b.fare), 0)                AS total_spent,
    ROUND(AVG(b.fare), 0)                AS avg_fare
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
                     AND b.status = 'confirmed'
GROUP BY p.passenger_id, p.first_name, p.last_name, p.tier
ORDER BY total_spent DESC;
```

### GROUP BY rule — every non-aggregate column must be in GROUP BY

```sql
-- BUG: 'name' not in GROUP BY and not aggregated
SELECT airline_id, name, COUNT(*)
FROM airlines
GROUP BY airline_id;  -- ERROR in PostgreSQL (name must be in GROUP BY)

-- CORRECT:
SELECT airline_id, name, COUNT(*)
FROM airlines
GROUP BY airline_id, name;

-- OR: use MIN/MAX if you know name is functionally dependent on airline_id
-- (PostgreSQL doesn't enforce functional dependencies automatically)
SELECT airline_id, MIN(name) AS name, COUNT(*)
FROM airlines
GROUP BY airline_id;
```

<div class="callout-tip">

**PostgreSQL vs SQLite on GROUP BY**: SQLite is lenient — non-aggregated columns not in GROUP BY are allowed (it picks an arbitrary value). PostgreSQL is strict — every non-aggregated column in SELECT must appear in GROUP BY. In interviews, the PostgreSQL behaviour is what you should describe. The strict rule prevents subtle bugs.

</div>

### Group by multiple columns

```sql
-- Revenue by airline AND booking class (2D grouping)
SELECT
    al.code            AS airline,
    b.class,
    COUNT(*)           AS bookings,
    ROUND(SUM(b.fare), 0) AS revenue
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.code, b.class
ORDER BY al.code, b.class;
```

### Group by expression

```sql
-- Bookings by hour of day
SELECT
    STRFTIME('%H', booking_date) AS booking_hour,
    COUNT(*)                      AS bookings
FROM bookings
GROUP BY STRFTIME('%H', booking_date)
ORDER BY booking_hour;

-- PostgreSQL equivalent:
-- GROUP BY EXTRACT(hour FROM booking_date)
```

---

## 4. HAVING — Filtering Groups

`WHERE` filters rows before aggregation. `HAVING` filters groups after aggregation.

```sql
-- Airlines with total confirmed revenue > 100,000
SELECT
    al.name,
    COUNT(b.booking_id)      AS bookings,
    ROUND(SUM(b.fare), 0)    AS total_revenue
FROM bookings b
JOIN flights   f  ON b.flight_id  = f.flight_id
JOIN routes    r  ON f.route_id   = r.route_id
JOIN airlines  al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'               -- filter rows first (before aggregation)
GROUP BY al.airline_id, al.name
HAVING SUM(b.fare) > 100000               -- filter groups after aggregation
ORDER BY total_revenue DESC;
```

### Passengers who booked more than 2 flights

```sql
SELECT
    p.first_name || ' ' || p.last_name AS passenger,
    p.tier,
    COUNT(b.booking_id)                 AS booking_count,
    ROUND(SUM(b.fare), 0)               AS total_spent
FROM passengers p
JOIN bookings b ON b.passenger_id = p.passenger_id
WHERE b.status = 'confirmed'
GROUP BY p.passenger_id, p.first_name, p.last_name, p.tier
HAVING COUNT(b.booking_id) > 2
ORDER BY booking_count DESC;
```

### HAVING with multiple conditions

```sql
SELECT
    class,
    COUNT(*)           AS bookings,
    ROUND(AVG(fare), 0) AS avg_fare
FROM bookings
WHERE status = 'confirmed'
GROUP BY class
HAVING COUNT(*) > 10               -- at least 10 bookings
   AND AVG(fare) > 5000;           -- and average fare over 5000
```

<div class="callout-warn">

**Don't use HAVING instead of WHERE for non-aggregate conditions.** `HAVING fare > 5000` works but runs the aggregation first, then filters — wasteful. `WHERE fare > 5000` filters rows before aggregation — always faster. Use WHERE for row-level conditions, HAVING only for conditions involving aggregate functions.

</div>

---

## 5. NULL Handling in Aggregates

```sql
-- Create a query showing NULL behavior
SELECT
    COUNT(*)              AS total_rows,
    COUNT(fare)           AS non_null_fares,
    COUNT(checked_in)     AS non_null_check_ins,
    SUM(fare)             AS sum_ignores_null,
    AVG(fare)             AS avg_ignores_null,
    -- To include NULLs as 0 in average:
    SUM(COALESCE(fare, 0)) * 1.0 / COUNT(*) AS avg_treating_null_as_zero
FROM bookings;
```

**Key rule**: `COUNT(column)` skips NULLs. `SUM`, `AVG`, `MIN`, `MAX` all skip NULLs. Only `COUNT(*)` includes NULLs.

```sql
-- Demonstration: cancelled booking with NULL fare
INSERT INTO bookings VALUES (87, 1, 16, '2025-06-01', NULL, 'economy', NULL, 'cancelled', 0);

SELECT COUNT(*), COUNT(fare), SUM(fare), AVG(fare)
FROM bookings
WHERE booking_id = 87;
-- COUNT(*) = 1 (row exists)
-- COUNT(fare) = 0 (fare is NULL)
-- SUM(fare) = NULL (no non-NULL values to sum)
-- AVG(fare) = NULL

-- Clean up
DELETE FROM bookings WHERE booking_id = 87;
```

---

## 6. FILTER Clause — Conditional Aggregation

`FILTER (WHERE ...)` applies a condition to an aggregate function, aggregating only the rows that match.

```sql
-- Booking counts broken down by status — in ONE query, not multiple
SELECT
    COUNT(*)                                           AS total_bookings,
    COUNT(*) FILTER (WHERE status = 'confirmed')       AS confirmed,
    COUNT(*) FILTER (WHERE status = 'cancelled')       AS cancelled,
    COUNT(*) FILTER (WHERE status = 'refunded')        AS refunded,
    COUNT(*) FILTER (WHERE checked_in = 1)             AS checked_in,
    ROUND(SUM(fare) FILTER (WHERE status = 'confirmed'), 0)  AS confirmed_revenue
FROM bookings;
```

**SQLite doesn't support FILTER** — use CASE inside the aggregate:

```sql
-- SQLite playground equivalent:
SELECT
    COUNT(*)                                                  AS total_bookings,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)    AS confirmed,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)    AS cancelled,
    SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END)          AS checked_in,
    ROUND(SUM(CASE WHEN status = 'confirmed' THEN fare ELSE 0 END), 0) AS confirmed_revenue
FROM bookings;
```

### Revenue pivot by booking class per airline

```sql
-- PostgreSQL (FILTER version):
SELECT
    al.code AS airline,
    COUNT(*) AS total,
    SUM(b.fare) FILTER (WHERE b.class = 'economy')  AS economy_revenue,
    SUM(b.fare) FILTER (WHERE b.class = 'business') AS business_revenue,
    SUM(b.fare) FILTER (WHERE b.class = 'first')    AS first_revenue
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.code
ORDER BY al.code;

-- SQLite playground:
SELECT
    al.code AS airline,
    COUNT(b.booking_id) AS total,
    ROUND(SUM(CASE WHEN b.class='economy'  THEN b.fare ELSE 0 END), 0) AS economy_rev,
    ROUND(SUM(CASE WHEN b.class='business' THEN b.fare ELSE 0 END), 0) AS business_rev,
    ROUND(SUM(CASE WHEN b.class='first'    THEN b.fare ELSE 0 END), 0) AS first_rev
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.code
ORDER BY al.code;
```

---

## 7. STRING_AGG and ARRAY_AGG

These PostgreSQL functions aggregate multiple row values into a single value.

### STRING_AGG — concatenate row values into a string

```sql
-- PostgreSQL:
SELECT
    al.name AS airline,
    STRING_AGG(DISTINCT b.class, ', ' ORDER BY b.class) AS booking_classes,
    STRING_AGG(DISTINCT f.aircraft, ' / ' ORDER BY f.aircraft) AS aircraft_types
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
GROUP BY al.airline_id, al.name
ORDER BY al.name;

-- SQLite playground (no STRING_AGG, but GROUP_CONCAT works):
SELECT
    al.name AS airline,
    GROUP_CONCAT(DISTINCT b.class) AS booking_classes
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
GROUP BY al.airline_id, al.name
ORDER BY al.name;
```

### ARRAY_AGG — collect values into a PostgreSQL array

```sql
-- PostgreSQL only:
SELECT
    p.first_name || ' ' || p.last_name   AS passenger,
    ARRAY_AGG(b.class ORDER BY b.booking_date)    AS booking_classes,
    ARRAY_AGG(b.fare  ORDER BY b.booking_date)    AS fares_in_order
FROM passengers p
JOIN bookings b ON b.passenger_id = p.passenger_id
WHERE b.status = 'confirmed'
GROUP BY p.passenger_id, p.first_name, p.last_name
HAVING COUNT(b.booking_id) > 1
ORDER BY p.last_name;
```

---

## 8. ROLLUP, CUBE, GROUPING SETS

These extensions generate multiple levels of aggregation in one query — useful for reports.

### ROLLUP — hierarchical subtotals

```sql
-- PostgreSQL:
SELECT
    al.code   AS airline,
    b.class,
    COUNT(*)  AS bookings,
    ROUND(SUM(b.fare), 0) AS revenue
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY ROLLUP(al.code, b.class)
ORDER BY al.code NULLS LAST, b.class NULLS LAST;

-- Output includes:
--   Individual rows: (AI, economy), (AI, business), (AI, first)
--   Airline subtotal: (AI, NULL) ← subtotal for all AI classes
--   Grand total: (NULL, NULL) ← total of everything
```

### CUBE — all possible combinations

```sql
-- PostgreSQL:
SELECT
    al.code,
    b.class,
    f.status AS flight_status,
    COUNT(*) AS bookings,
    ROUND(SUM(b.fare), 0) AS revenue
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY CUBE(al.code, b.class, f.status)
ORDER BY al.code NULLS LAST, b.class NULLS LAST;
-- Generates subtotals for all 2^3 = 8 combinations of the 3 dimensions
```

### GROUPING SETS — specific combinations

```sql
-- PostgreSQL:
SELECT
    al.code,
    b.class,
    COUNT(*) AS bookings
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY GROUPING SETS (
    (al.code, b.class),   -- both dimensions
    (al.code),            -- airline-only subtotals
    ()                    -- grand total
)
ORDER BY al.code NULLS LAST;
```

---

## 9. Aggregate + JOIN Patterns

### Find the airline with the most bookings per route

```sql
SELECT
    a_org.iata_code || ' → ' || a_dst.iata_code AS route,
    al.code          AS airline,
    COUNT(b.booking_id) AS bookings
FROM bookings   b
JOIN flights    f   ON b.flight_id  = f.flight_id
JOIN routes     r   ON f.route_id   = r.route_id
JOIN airlines   al  ON r.airline_id = al.airline_id
JOIN airports   a_org ON r.origin_id = a_org.airport_id
JOIN airports   a_dst ON r.dest_id   = a_dst.airport_id
WHERE b.status = 'confirmed'
GROUP BY r.origin_id, r.dest_id, a_org.iata_code, a_dst.iata_code, al.airline_id, al.code
ORDER BY route, bookings DESC;
```

### Average bookings per passenger by loyalty tier

```sql
SELECT
    p.tier,
    COUNT(DISTINCT p.passenger_id)           AS passengers,
    COUNT(b.booking_id)                      AS total_bookings,
    ROUND(COUNT(b.booking_id) * 1.0
          / COUNT(DISTINCT p.passenger_id), 2) AS avg_bookings_per_passenger,
    ROUND(AVG(b.fare), 0)                    AS avg_fare
FROM passengers p
LEFT JOIN bookings b ON b.passenger_id = p.passenger_id
                     AND b.status = 'confirmed'
GROUP BY p.tier
ORDER BY CASE p.tier
    WHEN 'platinum' THEN 1
    WHEN 'gold'     THEN 2
    WHEN 'silver'   THEN 3
    WHEN 'bronze'   THEN 4
END;
```

### Flights with above-average load factor

```sql
SELECT flight_number, status,
       seats_booked, seats_total,
       ROUND(CAST(seats_booked AS REAL) / seats_total * 100, 1) AS load_pct
FROM flights
WHERE status != 'cancelled'
  AND CAST(seats_booked AS REAL) / seats_total >
      (SELECT AVG(CAST(seats_booked AS REAL) / seats_total)
       FROM flights WHERE status != 'cancelled')
ORDER BY load_pct DESC;
```

---

## 10. Performance Considerations

```sql
-- 1. Filter before aggregating with WHERE (not HAVING)
-- BAD: aggregates ALL bookings, then filters
SELECT status, SUM(fare) FROM bookings GROUP BY status
HAVING status = 'confirmed';

-- GOOD: filters first, then aggregates fewer rows
SELECT SUM(fare) FROM bookings WHERE status = 'confirmed';

-- 2. Create indexes on GROUP BY columns that are frequently used
-- PostgreSQL:
CREATE INDEX idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX idx_bookings_status    ON bookings(status);

-- 3. Partial indexes for filtered aggregates
-- If you often aggregate only 'confirmed' bookings:
CREATE INDEX idx_bookings_confirmed ON bookings(passenger_id, fare)
WHERE status = 'confirmed';

-- 4. For very large aggregations, consider materialized views
-- PostgreSQL:
CREATE MATERIALIZED VIEW mv_revenue_by_airline AS
SELECT al.airline_id, al.name, SUM(b.fare) AS total_revenue
FROM bookings b
JOIN flights f ON b.flight_id = f.flight_id
JOIN routes r ON f.route_id = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.name;

-- Refresh when data changes:
REFRESH MATERIALIZED VIEW mv_revenue_by_airline;
```

---

## 11. Common Mistakes

### Mistake 1: Using HAVING instead of WHERE for non-aggregate conditions

```sql
-- SLOW: aggregates all rows, then throws most away
SELECT class, COUNT(*) FROM bookings
GROUP BY class HAVING class = 'business';

-- FAST: filters before aggregation
SELECT class, COUNT(*) FROM bookings
WHERE class = 'business' GROUP BY class;
```

### Mistake 2: Counting NULLs unexpectedly

```sql
-- If some fares are NULL, these give different results:
SELECT COUNT(*) FROM bookings;       -- 86 (all rows)
SELECT COUNT(fare) FROM bookings;    -- fewer (NULLs excluded)

-- Always be explicit about what you're counting:
SELECT COUNT(*) FILTER (WHERE fare IS NOT NULL) FROM bookings; -- PostgreSQL
SELECT SUM(CASE WHEN fare IS NOT NULL THEN 1 ELSE 0 END) FROM bookings; -- SQLite
```

### Mistake 3: Aggregating without GROUP BY when you need groups

```sql
-- Returns one row (grand total) — is this what you wanted?
SELECT passenger_id, SUM(fare) FROM bookings WHERE status = 'confirmed';
-- ERROR in PostgreSQL (passenger_id not in aggregate and not in GROUP BY)
-- Returns one row in SQLite (arbitrary passenger_id)

-- Add GROUP BY to get one row per passenger:
SELECT passenger_id, SUM(fare) FROM bookings
WHERE status = 'confirmed' GROUP BY passenger_id;
```

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A "average rating per product" dashboard shows higher averages than the review page, because products with NULL ratings (reviews without a star rating) are silently ignored by `AVG`. The product team thinks quality improved. **Decision**: Aggregates skip NULLs: `AVG(rating)` averages only non-NULL ratings, and `COUNT(rating)` ≠ `COUNT(*)`. Decide explicitly what NULL means — "no rating" (exclude, and show the count of rated reviews next to the average) or "zero" (`AVG(COALESCE(rating, 0))`) — and label the metric accordingly.

</div>

<div class="callout-scenario">

**Scenario**: A monthly revenue chart has a gap: no bar for a month with zero sales, and the line chart interpolates over it, hiding an outage. **Decision**: `GROUP BY month` only returns months that have rows. Generate the full calendar (a `generate_series` of months in PostgreSQL, or a calendar table) and `LEFT JOIN` the aggregates onto it with `COALESCE(revenue, 0)`, so missing periods appear as zeros.

</div>

## 🏋️ Practice Assignments

Run these in the **SQL Playground** above.

### 🟢 Low — Build the reflexes

**L1.** Count bookings and total fare by class.

<details>
<summary>Show answer</summary>

```sql
SELECT class, COUNT(*) AS bookings, SUM(fare) AS total_fare
FROM bookings
GROUP BY class
ORDER BY total_fare DESC;
```

</details>

**L2.** Which passenger tiers have more than 5 passengers?

<details>
<summary>Show answer</summary>

```sql
SELECT tier, COUNT(*) AS passengers
FROM passengers
GROUP BY tier
HAVING COUNT(*) > 5;
```

`HAVING` filters groups after aggregation; `WHERE` can't reference `COUNT(*)`.

</details>

**L3.** Average fare per class, rounded to 2 decimals, only for confirmed bookings.

<details>
<summary>Show answer</summary>

```sql
SELECT class, ROUND(AVG(fare), 2) AS avg_fare
FROM bookings
WHERE status = 'confirmed'
GROUP BY class;
```

</details>

### 🟡 Medium — Apply it

**M1.** In one query, per airline: total bookings, confirmed bookings, cancelled bookings, and cancellation rate (%).

<details>
<summary>Show answer</summary>

```sql
SELECT al.name,
       COUNT(*)                                                AS total,
       COUNT(*) FILTER (WHERE b.status = 'confirmed')          AS confirmed,
       COUNT(*) FILTER (WHERE b.status = 'cancelled')          AS cancelled,
       ROUND(100.0 * COUNT(*) FILTER (WHERE b.status = 'cancelled') / COUNT(*), 1) AS cancel_rate_pct
FROM bookings b
JOIN flights  f  ON f.flight_id   = b.flight_id
JOIN routes   r  ON r.route_id    = f.route_id
JOIN airlines al ON al.airline_id = r.airline_id
GROUP BY al.airline_id, al.name
ORDER BY cancel_rate_pct DESC;
```

`FILTER (WHERE ...)` works in PostgreSQL and SQLite; elsewhere use `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`.

</details>

**M2.** Find routes (origin → destination codes) whose average confirmed fare is above the overall average confirmed fare.

<details>
<summary>Show answer</summary>

```sql
SELECT o.iata_code || '→' || d.iata_code AS route,
       ROUND(AVG(b.fare), 0) AS avg_fare,
       COUNT(*) AS bookings
FROM bookings b
JOIN flights  f ON f.flight_id  = b.flight_id
JOIN routes   r ON r.route_id   = f.route_id
JOIN airports o ON o.airport_id = r.origin_id
JOIN airports d ON d.airport_id = r.dest_id
WHERE b.status = 'confirmed'
GROUP BY r.route_id, o.iata_code, d.iata_code
HAVING AVG(b.fare) > (SELECT AVG(fare) FROM bookings WHERE status = 'confirmed')
ORDER BY avg_fare DESC;
```

</details>

**M3.** Bookings per month (from `booking_date`) with each month's revenue.

<details>
<summary>Show answer</summary>

```sql
-- SQLite (playground):
SELECT strftime('%Y-%m', booking_date) AS month, COUNT(*) AS bookings, SUM(fare) AS revenue
FROM bookings
WHERE status = 'confirmed'
GROUP BY month
ORDER BY month;

-- PostgreSQL: SELECT date_trunc('month', booking_date) AS month, ... GROUP BY 1 ORDER BY 1;
```

</details>

### 🔴 High — Think like a senior

**H1.** Finance needs daily revenue for the last 90 days with **zero** for days without sales, plus a 7-day moving average. Write it for PostgreSQL.

<details>
<summary>Show answer</summary>

```sql
-- postgres
WITH days AS (
  SELECT generate_series(current_date - 89, current_date, interval '1 day')::date AS day
),
daily AS (
  SELECT booking_date::date AS day, SUM(fare) AS revenue
  FROM bookings
  WHERE status = 'confirmed' AND booking_date >= current_date - 89
  GROUP BY 1
)
SELECT d.day,
       COALESCE(daily.revenue, 0) AS revenue,
       ROUND(AVG(COALESCE(daily.revenue, 0)) OVER (ORDER BY d.day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2)
         AS moving_avg_7d
FROM days d
LEFT JOIN daily ON daily.day = d.day
ORDER BY d.day;
```

The calendar CTE guarantees every day appears; the window function computes the moving average over the zero-filled series (see `sql-window-functions`).

</details>

**H2.** A `GROUP BY` dashboard over 500M booking rows takes 2 minutes and runs every 5 minutes. Redesign.

<details>
<summary>Show answer</summary>

Don't recompute history on every refresh. Options: (1) a **summary table** (e.g., revenue per airline per day) maintained incrementally — a job aggregates only new/changed rows (by `updated_at` or CDC) and upserts; (2) a **materialized view** with `REFRESH MATERIALIZED VIEW CONCURRENTLY` on a schedule if full refresh is acceptable; (3) partition the fact table by date so queries prune old partitions; (4) indexes supporting the filter + group columns (or BRIN indexes on append-only timestamp columns); (5) move analytics to a columnar store (ClickHouse, BigQuery, Redshift) fed by CDC if the workload keeps growing. Measure freshness requirements with the business — "5-minute-old data" often allows cheap incremental aggregation.

</details>

## 🛠️ Mini Project — Revenue & Operations Dashboard Queries

**Goal**: Build the SQL behind a real dashboard, correctly handling NULLs, gaps, and grain. 1-2 evenings.

**Build**

1. In the playground: KPIs per airline (bookings, revenue, cancellation rate, average fare by class via `FILTER`), top 5 routes by revenue, load factor per aircraft type, revenue by passenger tier with a `ROLLUP` total row (PostgreSQL) or a `UNION ALL` total row (SQLite).
2. In PostgreSQL with generated data (1M bookings via `generate_series`): a zero-filled daily revenue series with a 7-day moving average (H1).
3. Create a `daily_airline_revenue` summary table and an incremental refresh query that only processes the last 2 days; compare query times against the raw aggregation.
4. Verify totals: summary table totals equal raw totals for the same period.

**Acceptance criteria**: every metric documents its NULL handling and grain; the verification query returns zero differences.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What is the difference between WHERE and HAVING?"**

WHERE filters individual rows before aggregation — it reduces the dataset before GROUP BY runs. HAVING filters groups after aggregation. You cannot use aggregate functions in WHERE (they haven't been computed yet at that stage), but you can in HAVING. In practice: always put non-aggregate conditions in WHERE to filter early and reduce the work the aggregation has to do. Only put conditions in HAVING when they reference aggregate results like HAVING COUNT(*) > 5 or HAVING SUM(fare) > 10000. A useful mnemonic: WHERE for rows, HAVING for groups.

</div>

<div class="callout-interview">

**Q: "How does NULL behave inside aggregate functions?"**

All aggregate functions except COUNT(*) ignore NULLs silently. SUM(column) with all NULLs returns NULL, not zero. AVG(column) divides by the count of non-NULL values, not total rows — so AVG over a column with 8 values and 2 NULLs divides by 8, not 10. COUNT(column) counts non-NULLs; COUNT(*) counts all rows. This can cause subtle bugs: if you write AVG(some_column) intending it to represent the average over all rows, NULLs will skew the result. The fix: use COALESCE to provide defaults — AVG(COALESCE(some_column, 0)) — if you want NULLs treated as zero.

</div>

<div class="callout-interview">

**Q: "Write a query to find the second highest fare in the bookings table."**

Several approaches. The cleanest with LIMIT/OFFSET in SQL: SELECT DISTINCT fare FROM bookings ORDER BY fare DESC LIMIT 1 OFFSET 1. In PostgreSQL you can also use dense_rank() with a window function in a subquery: SELECT fare FROM (SELECT fare, DENSE_RANK() OVER (ORDER BY fare DESC) AS rk FROM bookings) t WHERE rk = 2 LIMIT 1. Or with a correlated subquery: SELECT MAX(fare) FROM bookings WHERE fare < (SELECT MAX(fare) FROM bookings). The window function approach is the most general — it works for Nth highest for any N and handles ties correctly.

</div>

<div class="callout-interview">

**Q: "How do ROLLUP and CUBE differ from regular GROUP BY?"**

Regular GROUP BY produces one row per distinct combination of the grouping columns. ROLLUP produces subtotals — it generates rows for each prefix of the column list plus a grand total. GROUP BY ROLLUP(a, b) gives rows for (a,b), (a), and () — three levels. CUBE generates subtotals for all possible subsets: GROUP BY CUBE(a, b) gives (a,b), (a), (b), and () — 2^n grouping sets. GROUPING SETS lets you specify exactly which groupings you want. All three are used for reporting dashboards where you need multiple aggregation levels in a single query pass. NULL in the output indicates that dimension was rolled up (aggregated across all values), which you identify with the GROUPING() function.

</div>

<div class="callout-interview">

**Q: "How do you calculate a running total in SQL?"**

Use window functions — specifically SUM with an OVER clause and an ORDER BY: SELECT date, amount, SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total. The ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW frame specifies: sum everything from the first row up to and including the current row. Without specifying the frame explicitly, the default for ORDER BY in a window function is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW — which handles ties differently (includes all tied rows in the current sum). For running totals, ROWS is usually safer than RANGE. This is covered in detail in the Window Functions tutorial.

</div>

---

## Your Practice Checklist

- [ ] Calculate total, average, min, max fare for confirmed bookings
- [ ] Group by airline to get revenue per airline — join bookings + flights + routes + airlines
- [ ] Use HAVING to find passengers with more than 2 bookings
- [ ] Use FILTER (or CASE inside aggregate) to pivot booking counts by status into one row
- [ ] Find the airline with the highest average fare per booking class
- [ ] Combine GROUP BY with ORDER BY CASE for custom tier ordering
- [ ] Use GROUP_CONCAT (SQLite) or STRING_AGG (PostgreSQL) to list aircraft types per airline
- [ ] Explain to someone what happens to NULLs inside COUNT vs SUM

## Related Topics

- `sql-joins` — JOINs that feed data into GROUP BY
- `sql-window-functions` — Running totals, ranking without GROUP BY collapsing rows
- `sql-subqueries-cte` — Using aggregated results as subqueries
- `sql-indexing` — Speeding up GROUP BY with the right indexes

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's morning dashboard — revenue per day, average order value, checkout time-outs per hour — is built with GROUP BY and FILTER.

**Continue the story:** [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
