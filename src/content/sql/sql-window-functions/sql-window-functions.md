# SQL Window Functions — ROW_NUMBER, RANK, LAG, Running Totals

> **Use the SQL Playground above** — window functions run live. These are the queries that separate junior from senior SQL developers. Master them here.

---

## Table of Contents

1. [What Window Functions Are](#1-what-window-functions-are)
2. [The OVER() Clause — Defining the Window](#2-over-clause)
3. [PARTITION BY — Per-Group Windows](#3-partition-by)
4. [Ranking Functions — ROW_NUMBER, RANK, DENSE_RANK](#4-ranking-functions)
5. [Value Functions — LAG, LEAD, FIRST_VALUE, LAST_VALUE](#5-value-functions)
6. [Aggregate Window Functions — Running Totals, Moving Averages](#6-aggregate-window-functions)
7. [Frame Specification — ROWS vs RANGE](#7-frame-specification)
8. [NTILE — Percentile Buckets](#8-ntile)
9. [Real Interview Problems Solved](#9-real-problems)
10. [Performance Considerations](#10-performance)
11. [Interview Questions](#11-interview-questions)

---

## 1. What Window Functions Are

Window functions compute a value across a set of related rows — the "window" — **without collapsing them into one row**. This is the crucial difference from GROUP BY:

```
GROUP BY collapses rows:                Window functions keep all rows:
┌───────────────────────┐               ┌────────────────────────────────────────────┐
│ tier   | total_miles  │               │ passenger  | tier    | miles  | rank_in_tier│
│ gold   | 1,234,567    │               │ Kiran      | platinum| 203400 | 1           │
│ silver | 456,789      │               │ Ahmed      | platinum| 188700 | 2           │
│ bronze | 123,456      │               │ Vinayak    | platinum| 145200 | 3           │
│ ...    | ...          │               │ Priya      | gold    | 82300  | 1           │
└───────────────────────┘               │ Anita      | gold    | 91500  | 1 (tie!)    │
                                        │ ...        | ...     | ...    | ...         │
                                        └────────────────────────────────────────────┘
```

Window functions are evaluated AFTER WHERE, GROUP BY, and HAVING — but BEFORE ORDER BY and LIMIT.

---

## 2. The OVER() Clause — Defining the Window

Every window function requires an `OVER()` clause. Without it, you'd get a regular aggregate.

```sql
-- Regular aggregate (collapses rows)
SELECT AVG(fare) FROM bookings;               -- one row

-- Window aggregate (keeps all rows)
SELECT
    booking_id,
    fare,
    AVG(fare) OVER ()                         AS overall_avg,
    fare - AVG(fare) OVER ()                  AS vs_avg
FROM bookings
WHERE status = 'confirmed'
ORDER BY fare DESC;
-- Every row gets the same overall_avg; original rows preserved
```

`OVER ()` with empty parentheses = the entire result set is the window.

```sql
-- More examples of OVER () — the whole table as window
SELECT
    passenger_id,
    fare,
    class,
    SUM(fare)   OVER ()  AS total_revenue,
    COUNT(*)    OVER ()  AS total_bookings,
    fare * 1.0 / SUM(fare) OVER () AS revenue_share_pct
FROM bookings
WHERE status = 'confirmed'
ORDER BY fare DESC
LIMIT 15;
```

---

## 3. PARTITION BY — Per-Group Windows

`PARTITION BY` divides rows into groups (partitions). The window function resets for each partition.

```sql
-- Average fare per class — but keep all rows visible
SELECT
    booking_id,
    class,
    fare,
    ROUND(AVG(fare) OVER (PARTITION BY class), 0) AS avg_fare_for_class,
    ROUND(fare - AVG(fare) OVER (PARTITION BY class), 0) AS vs_class_avg
FROM bookings
WHERE status = 'confirmed'
ORDER BY class, fare DESC;
```

```sql
-- Count bookings per tier with all passenger rows still visible
SELECT
    p.first_name || ' ' || p.last_name AS passenger,
    p.tier,
    p.total_miles,
    COUNT(*) OVER (PARTITION BY p.tier) AS passengers_in_tier,
    SUM(p.total_miles) OVER (PARTITION BY p.tier) AS total_tier_miles,
    ROUND(p.total_miles * 100.0 / SUM(p.total_miles) OVER (PARTITION BY p.tier), 1) AS pct_of_tier_miles
FROM passengers p
ORDER BY p.tier, p.total_miles DESC;
```

---

## 4. Ranking Functions — ROW_NUMBER, RANK, DENSE_RANK

The three ranking functions behave differently when values tie:

```
Values to rank: 100, 100, 80, 70, 70, 50

ROW_NUMBER:  1, 2, 3, 4, 5, 6   ← always unique, arbitrary tiebreaking
RANK:        1, 1, 3, 4, 4, 6   ← ties get same rank, skips numbers
DENSE_RANK:  1, 1, 2, 3, 3, 4   ← ties get same rank, no gaps
```

### ROW_NUMBER — unique sequential number

```sql
-- Assign a sequential number to each flight by departure time
SELECT
    ROW_NUMBER() OVER (ORDER BY departure_time) AS seq,
    flight_number,
    departure_time,
    status,
    seats_booked
FROM flights
WHERE status != 'cancelled'
ORDER BY departure_time;
```

### RANK vs DENSE_RANK — handle ties differently

```sql
SELECT
    p.first_name || ' ' || p.last_name  AS passenger,
    p.tier,
    p.total_miles,
    RANK()       OVER (ORDER BY p.total_miles DESC) AS rank_with_gaps,
    DENSE_RANK() OVER (ORDER BY p.total_miles DESC) AS rank_no_gaps,
    ROW_NUMBER() OVER (ORDER BY p.total_miles DESC) AS row_number
FROM passengers p
ORDER BY p.total_miles DESC
LIMIT 10;
-- RANK: two passengers with same miles both get rank 1, next gets rank 3
-- DENSE_RANK: both get rank 1, next gets rank 2 (no gap)
-- ROW_NUMBER: 1, 2, 3 regardless of ties
```

### RANK per partition — the "top N per group" pattern

```sql
-- Rank passengers within each tier by total_miles
SELECT
    p.first_name || ' ' || p.last_name  AS passenger,
    p.tier,
    p.total_miles,
    RANK() OVER (
        PARTITION BY p.tier
        ORDER BY p.total_miles DESC
    ) AS rank_in_tier
FROM passengers p
ORDER BY p.tier, rank_in_tier;
```

### Get top 1 per group using ROW_NUMBER

```sql
-- Highest-fare booking per passenger (works with subquery)
SELECT passenger, tier, booking_id, class, fare
FROM (
    SELECT
        p.first_name || ' ' || p.last_name AS passenger,
        p.tier,
        b.booking_id,
        b.class,
        b.fare,
        ROW_NUMBER() OVER (
            PARTITION BY b.passenger_id
            ORDER BY b.fare DESC
        ) AS rn
    FROM bookings b
    JOIN passengers p ON b.passenger_id = p.passenger_id
    WHERE b.status = 'confirmed'
) t
WHERE rn = 1
ORDER BY fare DESC;
```

<div class="callout-tip">

**ROW_NUMBER vs RANK for top-N**: Use `ROW_NUMBER()` when you want exactly N rows per group (no ties). Use `RANK()` or `DENSE_RANK()` when you want all tied rows included. The pattern `WHERE rn = 1` on a ROW_NUMBER subquery is the most common window function pattern in SQL interviews.

</div>

---

## 5. Value Functions — LAG, LEAD, FIRST_VALUE, LAST_VALUE

These functions access row values from different positions in the window.

### LAG — access the previous row's value

```sql
-- Show each booking's fare and the previous booking's fare for the same passenger
SELECT
    p.first_name || ' ' || p.last_name AS passenger,
    b.booking_date,
    b.class,
    b.fare,
    LAG(b.fare) OVER (
        PARTITION BY b.passenger_id
        ORDER BY b.booking_date
    ) AS prev_booking_fare,
    b.fare - LAG(b.fare) OVER (
        PARTITION BY b.passenger_id
        ORDER BY b.booking_date
    ) AS fare_change
FROM bookings b
JOIN passengers p ON b.passenger_id = p.passenger_id
WHERE b.status = 'confirmed'
ORDER BY b.passenger_id, b.booking_date;
```

LAG default offset = 1 (previous row). Second argument changes the offset:

```sql
-- Access 2 rows back
LAG(fare, 2) OVER (PARTITION BY passenger_id ORDER BY booking_date)

-- Provide a default value when there's no previous row (first row)
LAG(fare, 1, 0) OVER (PARTITION BY passenger_id ORDER BY booking_date)
-- Returns 0 instead of NULL for the first row in each partition
```

### LEAD — access the next row's value

```sql
-- Show flight departure and the next flight on the same route
SELECT
    f.flight_number,
    f.departure_time,
    f.status,
    LEAD(f.flight_number) OVER (
        PARTITION BY f.route_id
        ORDER BY f.departure_time
    ) AS next_flight_on_route,
    LEAD(f.departure_time) OVER (
        PARTITION BY f.route_id
        ORDER BY f.departure_time
    ) AS next_departure,
    ROUND((JULIANDAY(LEAD(f.departure_time) OVER (
        PARTITION BY f.route_id ORDER BY f.departure_time
    )) - JULIANDAY(f.departure_time)) * 24, 1) AS hours_to_next_flight
FROM flights f
WHERE f.status != 'cancelled'
ORDER BY f.route_id, f.departure_time;
```

### FIRST_VALUE and LAST_VALUE

```sql
-- For each booking, show the cheapest and most expensive fare in the same class
SELECT
    booking_id,
    class,
    fare,
    FIRST_VALUE(fare) OVER (
        PARTITION BY class
        ORDER BY fare ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS min_fare_in_class,
    LAST_VALUE(fare) OVER (
        PARTITION BY class
        ORDER BY fare ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS max_fare_in_class,
    fare - FIRST_VALUE(fare) OVER (
        PARTITION BY class
        ORDER BY fare ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS above_minimum
FROM bookings
WHERE status = 'confirmed'
ORDER BY class, fare;
```

<div class="callout-warn">

**LAST_VALUE frame trap**: `LAST_VALUE` with default frame (`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`) only looks up to the current row. To get the actual last value in the partition, you MUST specify `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`. This is one of the most common window function bugs.

</div>

---

## 6. Aggregate Window Functions — Running Totals, Moving Averages

Any aggregate function (SUM, AVG, COUNT, MIN, MAX) can be used as a window function with OVER().

### Running total (cumulative sum)

```sql
-- Cumulative revenue as bookings are made (by booking_date)
SELECT
    booking_id,
    booking_date,
    fare,
    ROUND(SUM(fare) OVER (
        ORDER BY booking_date, booking_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ), 0) AS cumulative_revenue,
    COUNT(*) OVER (
        ORDER BY booking_date, booking_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_bookings
FROM bookings
WHERE status = 'confirmed'
ORDER BY booking_date, booking_id
LIMIT 20;
```

### Running total per partition

```sql
-- Cumulative revenue per airline, ordered by booking date
SELECT
    al.code AS airline,
    b.booking_date,
    b.fare,
    ROUND(SUM(b.fare) OVER (
        PARTITION BY al.airline_id
        ORDER BY b.booking_date, b.booking_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ), 0) AS airline_cumulative_revenue
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
ORDER BY al.code, b.booking_date
LIMIT 20;
```

### Moving average (rolling N-row window)

```sql
-- 3-booking moving average fare per airline
SELECT
    al.code,
    b.booking_id,
    b.fare,
    ROUND(AVG(b.fare) OVER (
        PARTITION BY al.airline_id
        ORDER BY b.booking_id
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW  -- ← 3-row window
    ), 0) AS moving_avg_3_bookings
FROM bookings b
JOIN flights  f  ON b.flight_id  = f.flight_id
JOIN routes   r  ON f.route_id   = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
ORDER BY al.code, b.booking_id;
```

---

## 7. Frame Specification — ROWS vs RANGE

The frame defines which rows within the partition are included in the window calculation for each row.

```
Default (when ORDER BY present): RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
Common override:                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
Moving window:                    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
Entire partition:                 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
Centered window:                  ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
```

### ROWS vs RANGE — the tie-handling difference

```sql
-- With duplicate booking_dates, ROWS and RANGE behave differently:
-- ROWS BETWEEN ... CURRENT ROW: current row only (exact position)
-- RANGE BETWEEN ... CURRENT ROW: all rows with the same ORDER BY value as current row

-- Run both and compare (use booking_date to see ties):
SELECT
    booking_date,
    fare,
    SUM(fare) OVER (
        ORDER BY booking_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_sum_rows,
    SUM(fare) OVER (
        ORDER BY booking_date
        RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_sum_range
FROM bookings
WHERE status = 'confirmed'
ORDER BY booking_date, booking_id
LIMIT 20;
-- On rows with the same booking_date:
--   ROWS: incremental (each row adds its own fare)
--   RANGE: all same-date rows get the same cumulative total (sum of all same-date fares)
```

---

## 8. NTILE — Percentile Buckets

`NTILE(n)` divides rows into n approximately equal buckets.

```sql
-- Divide passengers into 4 quartiles by total_miles
SELECT
    first_name || ' ' || last_name AS passenger,
    tier,
    total_miles,
    NTILE(4) OVER (ORDER BY total_miles) AS quartile,
    NTILE(10) OVER (ORDER BY total_miles) AS decile,
    CASE NTILE(4) OVER (ORDER BY total_miles)
        WHEN 1 THEN 'Bottom 25%'
        WHEN 2 THEN '25-50%'
        WHEN 3 THEN '50-75%'
        WHEN 4 THEN 'Top 25%'
    END AS quartile_label
FROM passengers
ORDER BY total_miles DESC;
```

```sql
-- Split flights into 3 groups by load factor for capacity planning
SELECT
    flight_number, aircraft, status,
    ROUND(CAST(seats_booked AS REAL) / seats_total * 100, 1) AS load_pct,
    NTILE(3) OVER (ORDER BY CAST(seats_booked AS REAL) / seats_total) AS capacity_tier,
    CASE NTILE(3) OVER (ORDER BY CAST(seats_booked AS REAL) / seats_total)
        WHEN 1 THEN 'Under-booked'
        WHEN 2 THEN 'Normal'
        WHEN 3 THEN 'High demand'
    END AS capacity_label
FROM flights
WHERE status != 'cancelled'
ORDER BY load_pct DESC;
```

---

## 9. Real Interview Problems Solved

### Problem 1: "Find the top 3 passengers by revenue for each airline"

```sql
WITH passenger_airline_revenue AS (
    SELECT
        al.airline_id,
        al.name    AS airline,
        p.passenger_id,
        p.first_name || ' ' || p.last_name AS passenger,
        p.tier,
        ROUND(SUM(b.fare), 0) AS revenue
    FROM bookings b
    JOIN passengers p  ON b.passenger_id = p.passenger_id
    JOIN flights    f  ON b.flight_id    = f.flight_id
    JOIN routes     r  ON f.route_id     = r.route_id
    JOIN airlines   al ON r.airline_id   = al.airline_id
    WHERE b.status = 'confirmed'
    GROUP BY al.airline_id, al.name, p.passenger_id, p.first_name, p.last_name, p.tier
)
SELECT airline, passenger, tier, revenue
FROM (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY airline_id ORDER BY revenue DESC) AS rn
    FROM passenger_airline_revenue
) ranked
WHERE rn <= 3
ORDER BY airline, rn;
```

### Problem 2: "Show month-over-month revenue change (use booking_date)"

```sql
WITH monthly_revenue AS (
    SELECT
        STRFTIME('%Y-%m', booking_date) AS month,
        ROUND(SUM(fare), 0) AS revenue
    FROM bookings
    WHERE status = 'confirmed'
    GROUP BY STRFTIME('%Y-%m', booking_date)
)
SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month)  AS prev_month_revenue,
    revenue - LAG(revenue) OVER (ORDER BY month) AS absolute_change,
    CASE WHEN LAG(revenue) OVER (ORDER BY month) IS NULL THEN NULL
         ELSE ROUND((revenue - LAG(revenue) OVER (ORDER BY month))
              * 100.0 / LAG(revenue) OVER (ORDER BY month), 1)
    END AS pct_change
FROM monthly_revenue
ORDER BY month;
```

### Problem 3: "Rank flights by load factor and show percentile"

```sql
SELECT
    flight_number,
    status,
    aircraft,
    seats_booked,
    seats_total,
    ROUND(CAST(seats_booked AS REAL) / seats_total * 100, 1) AS load_pct,
    RANK()       OVER (ORDER BY CAST(seats_booked AS REAL) / seats_total DESC) AS rank_by_load,
    NTILE(100)   OVER (ORDER BY CAST(seats_booked AS REAL) / seats_total)      AS percentile
FROM flights
WHERE status != 'cancelled'
ORDER BY load_pct DESC;
```

### Problem 4: "For each booking, show its position relative to the passenger's bookings"

```sql
SELECT
    p.first_name || ' ' || p.last_name AS passenger,
    b.booking_date,
    b.class,
    b.fare,
    ROW_NUMBER() OVER (PARTITION BY b.passenger_id ORDER BY b.booking_date) AS booking_seq,
    FIRST_VALUE(b.fare) OVER (
        PARTITION BY b.passenger_id
        ORDER BY b.booking_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS first_ever_fare,
    MAX(b.fare) OVER (PARTITION BY b.passenger_id) AS personal_max_fare,
    ROUND(b.fare * 100.0 / SUM(b.fare) OVER (PARTITION BY b.passenger_id), 1) AS pct_of_personal_total
FROM bookings b
JOIN passengers p ON b.passenger_id = p.passenger_id
WHERE b.status = 'confirmed'
ORDER BY p.passenger_id, b.booking_date
LIMIT 20;
```

---

## 10. Performance Considerations

```sql
-- 1. Window functions run AFTER WHERE, GROUP BY — they process the filtered result
-- Filter aggressively BEFORE window functions to reduce the working set:
SELECT flight_number, fare,
       AVG(fare) OVER (PARTITION BY class) AS class_avg
FROM (
    SELECT b.*, f.flight_number
    FROM bookings b
    JOIN flights f ON b.flight_id = f.flight_id
    WHERE b.status = 'confirmed'     -- filter first
      AND b.fare > 1000              -- reduce rows early
) filtered;

-- 2. Avoid multiple OVER() clauses with the same definition:
-- BAD: computes window twice
SELECT
    fare,
    SUM(fare) OVER (PARTITION BY class ORDER BY booking_id) AS running_sum,
    AVG(fare) OVER (PARTITION BY class ORDER BY booking_id) AS running_avg
FROM bookings;
-- SAME performance in modern PostgreSQL (optimized to one pass), but:

-- 3. Named windows avoid repetition and help readability (PostgreSQL):
SELECT
    fare,
    SUM(fare) OVER w AS running_sum,
    AVG(fare) OVER w AS running_avg,
    COUNT(*) OVER w  AS running_count
FROM bookings
WHERE status = 'confirmed'
WINDOW w AS (PARTITION BY class ORDER BY booking_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW);

-- 4. Indexes on PARTITION BY and ORDER BY columns speed up window functions:
-- PostgreSQL:
CREATE INDEX idx_bookings_pid_date ON bookings(passenger_id, booking_date);
-- Enables efficient PARTITION BY passenger_id ORDER BY booking_date
```

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A sales leaderboard uses `ROW_NUMBER()` to award prizes to the "top 3 agents". Two agents tie for third place, and one is excluded arbitrarily — and differently each time the query runs. **Decision**: `ROW_NUMBER()` breaks ties arbitrarily (non-deterministic unless the `ORDER BY` is unique). Use `RANK()` or `DENSE_RANK()` when ties must share a position, or add a deterministic tie-breaker (earliest achievement time, then agent ID) when exactly N winners are required — and document the rule.

</div>

<div class="callout-scenario">

**Scenario**: A "latest status per order" query uses a correlated subquery `WHERE updated_at = (SELECT MAX(updated_at) ...)` over a 200M-row events table and takes minutes; it also returns duplicates when two events share a timestamp. **Decision**: Use `ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC, event_id DESC)` and keep `rn = 1` — one pass, deterministic ties — backed by an index on `(order_id, updated_at DESC)`. In PostgreSQL, `DISTINCT ON (order_id)` is an equally good idiom.

</div>

## 🏋️ Practice Assignments

Run these in the **SQL Playground** above.

### 🟢 Low — Build the reflexes

**L1.** Rank bookings by fare within each class, showing ROW_NUMBER, RANK, and DENSE_RANK side by side.

<details>
<summary>Show answer</summary>

```sql
SELECT booking_id, class, fare,
       ROW_NUMBER() OVER (PARTITION BY class ORDER BY fare DESC) AS row_num,
       RANK()       OVER (PARTITION BY class ORDER BY fare DESC) AS rnk,
       DENSE_RANK() OVER (PARTITION BY class ORDER BY fare DESC) AS dense_rnk
FROM bookings
ORDER BY class, fare DESC;
```

Look at tied fares: `RANK` skips numbers after a tie (1, 1, 3), `DENSE_RANK` doesn't (1, 1, 2).

</details>

**L2.** For each passenger, show each booking with the previous booking's date (by booking date).

<details>
<summary>Show answer</summary>

```sql
SELECT passenger_id, booking_id, booking_date,
       LAG(booking_date) OVER (PARTITION BY passenger_id ORDER BY booking_date) AS previous_booking
FROM bookings
ORDER BY passenger_id, booking_date;
```

</details>

**L3.** Show each booking's fare and the total fare of all bookings of the same passenger, on every row.

<details>
<summary>Show answer</summary>

```sql
SELECT booking_id, passenger_id, fare,
       SUM(fare) OVER (PARTITION BY passenger_id) AS passenger_total
FROM bookings;
```

Unlike `GROUP BY`, the window keeps every row.

</details>

### 🟡 Medium — Apply it

**M1.** Top 2 bookings by fare for each airline (ties broken by booking ID).

<details>
<summary>Show answer</summary>

```sql
WITH ranked AS (
  SELECT al.name AS airline, b.booking_id, b.fare,
         ROW_NUMBER() OVER (PARTITION BY al.airline_id ORDER BY b.fare DESC, b.booking_id) AS rn
  FROM bookings b
  JOIN flights  f  ON f.flight_id   = b.flight_id
  JOIN routes   r  ON r.route_id    = f.route_id
  JOIN airlines al ON al.airline_id = r.airline_id
)
SELECT airline, booking_id, fare
FROM ranked
WHERE rn <= 2
ORDER BY airline, rn;
```

Window functions can't be used in `WHERE` directly — compute them in a CTE/subquery first.

</details>

**M2.** Running total of confirmed revenue by booking date, and each booking's percentage of the day's revenue.

<details>
<summary>Show answer</summary>

```sql
SELECT booking_id, booking_date, fare,
       SUM(fare) OVER (ORDER BY booking_date, booking_id
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
       ROUND(100.0 * fare / SUM(fare) OVER (PARTITION BY date(booking_date)), 1) AS pct_of_day
FROM bookings
WHERE status = 'confirmed'
ORDER BY booking_date, booking_id;
```

The explicit `ROWS` frame (and a unique ordering) avoids `RANGE` treating tied timestamps as one peer group.

</details>

**M3.** Split passengers into 4 quartiles by `total_miles` and show the min/max miles of each quartile.

<details>
<summary>Show answer</summary>

```sql
WITH q AS (
  SELECT passenger_id, total_miles,
         NTILE(4) OVER (ORDER BY total_miles) AS quartile
  FROM passengers
)
SELECT quartile, COUNT(*) AS passengers, MIN(total_miles) AS min_miles, MAX(total_miles) AS max_miles
FROM q
GROUP BY quartile
ORDER BY quartile;
```

</details>

### 🔴 High — Think like a senior

**H1.** Find "streaks": for each passenger, the longest run of consecutive **months** in which they made at least one booking.

<details>
<summary>Show answer</summary>

The gaps-and-islands technique: consecutive months minus a row number produce the same "group key".

```sql
WITH months AS (
  SELECT DISTINCT passenger_id,
         CAST(strftime('%Y', booking_date) AS INTEGER) * 12 + CAST(strftime('%m', booking_date) AS INTEGER) AS month_idx
  FROM bookings
),
grouped AS (
  SELECT passenger_id, month_idx,
         month_idx - ROW_NUMBER() OVER (PARTITION BY passenger_id ORDER BY month_idx) AS island
  FROM months
),
streaks AS (
  SELECT passenger_id, island, COUNT(*) AS streak_len
  FROM grouped
  GROUP BY passenger_id, island
)
SELECT passenger_id, MAX(streak_len) AS longest_streak_months
FROM streaks
GROUP BY passenger_id
ORDER BY longest_streak_months DESC;
```

In PostgreSQL, compute `month_idx` with `EXTRACT(YEAR ...) * 12 + EXTRACT(MONTH ...)`. The same pattern finds login streaks, consecutive failed payments, or outage windows.

</details>

**H2.** A query computes `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC)` over 300M rows to get each customer's latest order, and it spills to disk. Optimize it.

<details>
<summary>Show answer</summary>

(1) Add a composite index on `(customer_id, created_at DESC)` so PostgreSQL can read rows pre-sorted per partition (no big sort). (2) Filter first: if only active customers or a date range matter, apply that before the window. (3) Alternatives: `DISTINCT ON (customer_id) ... ORDER BY customer_id, created_at DESC` using the same index; or a `LATERAL` subquery per customer with `LIMIT 1` (fast when the customer list is small and indexed). (4) If this is a frequent need, maintain a `customer_latest_order` table updated on insert (trigger or application logic) instead of recomputing. (5) Check `work_mem` for the sort if a sort remains unavoidable. Confirm each change with `EXPLAIN (ANALYZE, BUFFERS)`.

</details>

## 🛠️ Mini Project — Analytics Queries an Interviewer Would Ask

**Goal**: A portfolio of window-function solutions to classic analytics problems. 1-2 evenings.

**Build** (playground first, then PostgreSQL with 1M generated rows):

1. Top N per group (top 3 passengers by spend per airline) with deterministic ties.
2. Month-over-month revenue growth with `LAG`, including the percentage change.
3. 7-day moving average of daily bookings (with a zero-filled calendar in PostgreSQL).
4. First and last booking per passenger with `FIRST_VALUE`/`LAST_VALUE` (fix the default frame pitfall).
5. Gaps-and-islands: longest monthly booking streak (H1).
6. Percentile buckets with `NTILE` and a median with `PERCENTILE_CONT` (PostgreSQL).
7. Deduplication: keep the latest record per key with `ROW_NUMBER` and delete the rest (in a transaction, verifying counts first).

**Acceptance criteria**: each query has a comment stating the business question, the partition/order/frame used, and an index that supports it; `EXPLAIN` output saved for the three heaviest.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What is the difference between ROW_NUMBER, RANK, and DENSE_RANK?"**

All three assign numbers to rows within a window, but they handle ties differently. ROW_NUMBER assigns a unique sequential integer to every row — no ties are possible. For two rows with the same value, it picks arbitrarily (usually by internal row ID). RANK assigns the same number to tied rows but then skips ranks: if positions 1 and 2 tie, both get rank 1 and the next row gets rank 3 — there's no rank 2. DENSE_RANK also assigns the same number to tied rows but doesn't skip: both tied rows get rank 1, and the next row gets rank 2. In interviews: use ROW_NUMBER when you need exactly one row per partition (top-1 queries). Use RANK or DENSE_RANK when ties should be visible and 'top N' means 'all rows with value in top N range.'

</div>

<div class="callout-interview">

**Q: "How do you calculate a running total in PostgreSQL?"**

Use SUM as a window function with an ORDER BY and a frame specification: SUM(fare) OVER (ORDER BY booking_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW). The OVER clause defines the window, ORDER BY determines the accumulation order, and the frame ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW means 'sum from the first row up to and including the current row.' For running totals partitioned by a group — say, cumulative revenue per airline — add PARTITION BY airline_id before ORDER BY. I'd emphasise the difference between ROWS and RANGE: with duplicate values in the ORDER BY column, RANGE accumulates all tied rows at each step, while ROWS accumulates one row at a time. For running totals, ROWS is usually what you want.

</div>

<div class="callout-interview">

**Q: "How would you find the employee with the highest salary in each department?"**

The standard pattern uses ROW_NUMBER in a subquery or CTE: assign ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn to each row, then filter WHERE rn = 1 in the outer query. This returns exactly one row per department — arbitrary tiebreaking if two employees share the top salary. If you want all tied employees at the top, use RANK() instead and filter WHERE rn = 1 — RANK gives both tied employees rank 1. In production code I'd write it as a CTE for readability: WITH ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn FROM employees), then SELECT * FROM ranked WHERE rn = 1.

</div>

<div class="callout-interview">

**Q: "Explain the LAST_VALUE pitfall and how to fix it."**

LAST_VALUE with a default frame returns not what most people expect. The default frame is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW — which means 'from the start of the partition up to and including the current row.' For the first row, the last value in that frame is the first row itself. For the second row, the last value is the second row itself. You never see the actual last value in the partition unless you're on the last row. The fix is to specify the frame explicitly as ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING — this makes the window the entire partition, so LAST_VALUE always returns the actual last row's value. This is one of those SQL gotchas that trips up even experienced developers.

</div>

<div class="callout-interview">

**Q: "What is the difference between GROUP BY and window functions?"**

GROUP BY collapses multiple rows into one summary row per group — you lose the individual row data. Window functions compute values across related rows but return one result row for every input row — the original rows are preserved. So: GROUP BY for 'give me one revenue figure per airline', window functions for 'show each booking row with the airline's total revenue alongside it'. Window functions also enable things that GROUP BY can't: comparing each row to the group average, assigning sequential numbers within groups, accessing adjacent rows (LAG/LEAD), and computing running totals. They're evaluated after WHERE and GROUP BY but before LIMIT — you can't reference a window function alias in WHERE, but you can in a wrapping subquery.

</div>

---

## Your Practice Checklist

- [ ] Write ROW_NUMBER, RANK, and DENSE_RANK on the same query — observe the difference on ties
- [ ] Use PARTITION BY tier to rank passengers within their tier by total_miles
- [ ] Use LAG to show each booking's fare change compared to the passenger's previous booking
- [ ] Compute a running total of revenue ordered by booking_date
- [ ] Build the "top 1 per group" query: highest-fare booking per airline
- [ ] Use NTILE(4) to divide passengers into quartiles by total_miles
- [ ] Reproduce the LAST_VALUE bug, then fix it with the correct ROWS BETWEEN frame
- [ ] Use WINDOW w AS (...) syntax to define a named window reused in multiple functions

## Related Topics

- `sql-subqueries-cte` — CTEs are the natural wrapper for window function results
- `sql-aggregates` — GROUP BY for when you DO want to collapse rows
- `sql-indexing` — PARTITION BY and ORDER BY columns should be indexed

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth ranks its best-selling products per category with RANK and ROW_NUMBER.

**Continue the story:** [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
