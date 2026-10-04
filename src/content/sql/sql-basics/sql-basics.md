# SQL Basics — SELECT, WHERE, ORDER BY

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Design — data model** · ShopNorth uses this in [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql)

</div>
<!-- sdlc-stage:end -->

> **Use the SQL Playground above** to run every query in this tutorial against a live airline database (5 airlines, 10 airports, 28 flights, 30 passengers, 86 bookings).

---

## Table of Contents

1. [Why PostgreSQL Specifically](#1-why-postgresql)
2. [The Airline Database — Schema](#2-the-airline-schema)
3. [SELECT — Reading Data](#3-select)
4. [WHERE — Filtering Rows](#4-where)
5. [ORDER BY — Sorting Results](#5-order-by)
6. [LIMIT and OFFSET — Pagination](#6-limit-offset)
7. [Column Expressions — Arithmetic and Aliases](#7-expressions-aliases)
8. [String Functions](#8-string-functions)
9. [Date and Time Functions](#9-date-time)
10. [CASE — Conditional Logic](#10-case)
11. [NULL — The Three-Valued Logic](#11-null)
12. [PostgreSQL Data Types — Reference](#12-data-types)
13. [Best Practices and Gotchas](#13-best-practices)
14. [Interview Questions](#14-interview-questions)

---

## 1. Why PostgreSQL Specifically

SQL is a standard but every database implements it with different extensions and behaviour. PostgreSQL is the industry choice for serious backend work because:

| Feature | PostgreSQL | MySQL | SQLite |
|---------|-----------|-------|--------|
| Full ACID compliance | ✅ | Partial (MyISAM) | ✅ |
| Window functions | ✅ Full | ✅ (8.0+) | ✅ (3.25+) |
| JSON / JSONB support | ✅ Native, indexed | ✅ Basic | ⚠️ Limited |
| Advanced indexing (GIN, GiST, BRIN) | ✅ | ❌ | ❌ |
| Full-text search | ✅ Built-in | Partial | ❌ |
| Row-level security | ✅ | ❌ | ❌ |
| Concurrent writes (MVCC) | ✅ Excellent | ✅ | ⚠️ WAL only |
| Extensions (PostGIS, pgvector) | ✅ Rich | Limited | ❌ |
| Cost-based query planner | ✅ Very sophisticated | ✅ | Basic |

The SQL Playground runs SQLite (browser-compatible) which supports ~95% of standard SQL. Differences from PostgreSQL are noted where they arise.

---

## 2. The Airline Database — Schema

All tutorials use the same schema. Memorise it — every query builds on it.

```
airlines          airports          routes
──────────        ──────────        ──────────
airline_id  PK    airport_id  PK    route_id    PK
code              iata_code         airline_id  FK→airlines
name              name              origin_id   FK→airports
country           city              dest_id     FK→airports
founded           country           distance_km
fleet_size        timezone
hub

flights               passengers            bookings
──────────────        ──────────────        ──────────────
flight_id    PK       passenger_id  PK      booking_id    PK
route_id     FK       first_name            passenger_id  FK→passengers
flight_number         last_name             flight_id     FK→flights
departure_time        email                 booking_date
arrival_time          nationality           seat
status                tier                  class
aircraft              total_miles           fare
seats_total           joined_date           status
seats_booked                                checked_in
```

**Relationships:**
- One airline → many routes
- Each route has one origin airport and one destination airport
- One route → many flights
- One flight → many bookings
- One passenger → many bookings

---

## 3. SELECT — Reading Data

`SELECT` retrieves data from one or more tables. The logical order of clause execution is:

```sql
FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT
```

This is NOT the written order — understanding execution order explains why you can reference an alias in ORDER BY but not in WHERE.

### Select specific columns

```sql
SELECT code, name, country
FROM airlines;
```

You get 5 rows — one per airline, only the 3 requested columns.

### Select all columns

```sql
SELECT *
FROM flights;
```

`*` returns every column. **Avoid `SELECT *` in production** — it transmits unused data, breaks when columns change, and prevents covering index optimisations.

### Column order is your choice

```sql
SELECT country, founded, name, code
FROM airlines;
```

Columns appear in the order you list them, regardless of table definition.

### DISTINCT — deduplicate results

```sql
SELECT DISTINCT country
FROM airlines;
-- Returns: India, UAE, UK

SELECT DISTINCT status
FROM flights;
-- Returns: departed, scheduled, arrived, delayed, cancelled

SELECT DISTINCT nationality, tier
FROM passengers
ORDER BY nationality, tier;
-- DISTINCT on multiple columns treats each combination as unique
```

<div class="callout-tip">

**Performance**: `DISTINCT` requires sorting or hashing the full result set. Use it only when you genuinely need deduplication. If duplicates appear because of a bad JOIN, fix the JOIN — don't mask it with DISTINCT.

</div>

---

## 4. WHERE — Filtering Rows

`WHERE` filters which rows are processed. A row is included only if the condition evaluates to `TRUE`. NULL evaluates to UNKNOWN, so NULL rows are excluded just like FALSE rows.

### Comparison operators

```sql
-- Exact match
SELECT * FROM flights WHERE status = 'scheduled';

-- Not equal (both forms work)
SELECT * FROM flights WHERE status != 'cancelled';
SELECT * FROM flights WHERE status <> 'cancelled';

-- Numeric comparisons
SELECT first_name, last_name, total_miles
FROM passengers
WHERE total_miles > 100000;

SELECT * FROM routes WHERE distance_km >= 2000;
SELECT * FROM passengers WHERE total_miles < 10000;
```

### BETWEEN — inclusive range

```sql
SELECT flight_number, seats_booked, seats_total
FROM flights
WHERE seats_booked BETWEEN 100 AND 200;
-- Exactly equivalent to: seats_booked >= 100 AND seats_booked <= 200
-- Both bounds are INCLUSIVE

-- Works on strings too (alphabetical)
SELECT first_name, last_name FROM passengers
WHERE last_name BETWEEN 'J' AND 'R';
```

### IN — match a list of values

```sql
SELECT first_name, last_name, tier
FROM passengers
WHERE tier IN ('gold', 'platinum');
-- Cleaner than: tier = 'gold' OR tier = 'platinum'

SELECT * FROM flights
WHERE status IN ('delayed', 'cancelled');

-- NOT IN — exclude values
SELECT flight_number, status FROM flights
WHERE status NOT IN ('arrived', 'cancelled');
```

<div class="callout-warn">

**`NOT IN` with NULLs — a famous trap**: If the list contains any NULL value, `NOT IN` returns zero rows. `col NOT IN (1, NULL)` becomes `col <> 1 AND col <> NULL`. Since `col <> NULL` is always NULL/UNKNOWN, the whole condition becomes UNKNOWN, and no rows pass. When your subquery might return NULLs, use `NOT EXISTS` instead.

</div>

### LIKE — wildcard pattern matching

```sql
-- % matches zero or more characters
SELECT flight_number FROM flights WHERE flight_number LIKE 'AI%';
-- AI101, AI103, AI105, AI201... (all Air India flights)

SELECT flight_number FROM flights WHERE flight_number LIKE '%01';
-- AI101, 6E201, UK101, EK501, BA001 (all flight 01s)

-- _ matches exactly one character
SELECT iata_code FROM airports WHERE iata_code LIKE 'B__';
-- BOM, BLR (3-letter codes starting with B)

-- Both wildcards together
SELECT name FROM airports WHERE name LIKE '%Inter%';
```

**PostgreSQL bonus — ILIKE (case-insensitive):**

```sql
-- PostgreSQL only:
SELECT name FROM airlines WHERE name ILIKE '%air%';
-- Returns: Air India, British Airways

-- SQLite workaround in playground:
SELECT name FROM airlines WHERE LOWER(name) LIKE '%air%';
```

### Combining conditions

```sql
-- AND: both conditions must be true
SELECT * FROM passengers
WHERE nationality = 'Indian' AND tier = 'platinum';

-- OR: either condition true
SELECT * FROM passengers
WHERE tier = 'platinum' OR total_miles > 150000;

-- NOT: invert the condition
SELECT * FROM passengers
WHERE NOT (tier = 'bronze');
```

**Operator precedence — AND binds tighter than OR.** Always use parentheses when mixing:

```sql
-- BUG: finds (Indian AND gold) OR (any silver) — not what you want
SELECT * FROM passengers
WHERE nationality = 'Indian' AND tier = 'gold'
   OR tier = 'silver';

-- CORRECT: finds Indians who are gold OR silver
SELECT * FROM passengers
WHERE nationality = 'Indian'
  AND (tier = 'gold' OR tier = 'silver');
```

---

## 5. ORDER BY — Sorting Results

Without `ORDER BY`, row order from PostgreSQL is **undefined** — never rely on it in production.

```sql
-- Ascending (default — you can write ASC explicitly)
SELECT code, name, founded FROM airlines ORDER BY founded ASC;

-- Descending
SELECT code, name, founded FROM airlines ORDER BY founded DESC;

-- Multiple columns: primary sort, then tiebreaker
SELECT last_name, first_name, tier, total_miles
FROM passengers
ORDER BY tier DESC, last_name ASC;
-- Sorts by tier (platinum first), then alphabetically within each tier
```

### Sort by expression

```sql
SELECT flight_number, seats_booked, seats_total,
       ROUND(CAST(seats_booked AS REAL) / seats_total * 100, 1) AS load_pct
FROM flights
WHERE status != 'cancelled'
ORDER BY load_pct DESC;
-- Busiest flights first
```

### Column aliases in ORDER BY

```sql
-- You CAN reference a SELECT alias in ORDER BY
SELECT first_name || ' ' || last_name AS full_name, total_miles
FROM passengers
ORDER BY full_name;  -- works!

-- You CANNOT reference aliases in WHERE (WHERE executes before SELECT)
-- This would fail: WHERE full_name LIKE 'V%'
-- Use the expression directly:
WHERE first_name || ' ' || last_name LIKE 'V%'
```

### NULL ordering

```sql
-- PostgreSQL: NULLs sort LAST in ASC, FIRST in DESC by default
-- Make it explicit:
SELECT first_name, total_miles
FROM passengers
ORDER BY total_miles DESC NULLS LAST;

-- SQLite playground workaround (NULLs sort first by default in ASC):
SELECT first_name, total_miles
FROM passengers
ORDER BY COALESCE(total_miles, 0) DESC;
```

---

## 6. LIMIT and OFFSET — Pagination

```sql
-- Top 5 passengers by miles
SELECT first_name, last_name, tier, total_miles
FROM passengers
ORDER BY total_miles DESC
LIMIT 5;

-- Skip first 5, get next 5 (page 2)
SELECT first_name, last_name, tier, total_miles
FROM passengers
ORDER BY total_miles DESC
LIMIT 5 OFFSET 5;

-- Page 3 (zero-indexed pages, page size 10)
SELECT * FROM passengers ORDER BY passenger_id LIMIT 10 OFFSET 20;
```

### Keyset / cursor pagination (production pattern)

```sql
-- Naive OFFSET is slow at scale: OFFSET 50000 scans 50,000 rows to throw them away
-- Keyset pagination uses the last seen value instead:

-- Page 1
SELECT * FROM passengers ORDER BY passenger_id LIMIT 10;
-- Last returned passenger_id = 10

-- Page 2 (pass last_id from previous page)
SELECT * FROM passengers
WHERE passenger_id > 10   -- start after last seen
ORDER BY passenger_id
LIMIT 10;
-- Uses the primary key index — O(log n) regardless of page depth
```

<div class="callout-tip">

**Rule**: Use OFFSET only for small tables or when jumping to a specific page (like admin UIs). Use keyset pagination for any high-traffic, large-table scenario. Most API endpoints should be keyset.

</div>

---

## 7. Column Expressions — Arithmetic and Aliases

```sql
SELECT flight_number,
       seats_total,
       seats_booked,
       seats_total - seats_booked                                AS seats_available,
       ROUND(CAST(seats_booked AS REAL) / seats_total * 100, 1) AS load_factor_pct
FROM flights
WHERE status != 'cancelled'
ORDER BY load_factor_pct DESC;
```

### String concatenation

```sql
SELECT first_name || ' ' || last_name   AS full_name,
       '(' || nationality || ')'        AS nationality_display,
       total_miles
FROM passengers
ORDER BY total_miles DESC LIMIT 10;

-- PostgreSQL also has CONCAT():
-- CONCAT(first_name, ' ', last_name)
```

### Arithmetic with mixed types

```sql
-- Always cast integers before float division (CAST or multiply by 1.0)
SELECT 5 / 2;                          -- Returns: 2  (integer division!)
SELECT 5.0 / 2;                        -- Returns: 2.5
SELECT CAST(5 AS REAL) / 2;           -- Returns: 2.5
SELECT 5 * 1.0 / 2;                   -- Returns: 2.5
```

### Table aliases (critical for JOINs)

```sql
SELECT p.first_name, p.last_name, p.tier, p.total_miles
FROM passengers p          -- p is the table alias
WHERE p.total_miles > 80000
ORDER BY p.total_miles DESC;
```

---

## 8. String Functions

```sql
-- Case conversion
SELECT UPPER(code), LOWER(name) FROM airlines;

-- Length
SELECT first_name, LENGTH(first_name) AS name_length
FROM passengers
ORDER BY name_length DESC LIMIT 5;

-- Substring extraction
SELECT flight_number,
       SUBSTR(flight_number, 1, 2)  AS airline_code,
       SUBSTR(flight_number, 3)     AS flight_num_only
FROM flights LIMIT 10;

-- Trim whitespace
SELECT TRIM('  Bangalore  ');          -- 'Bangalore'
SELECT LTRIM('   Delhi');              -- 'Delhi'
SELECT RTRIM('Mumbai   ');             -- 'Mumbai'

-- Replace
SELECT REPLACE(name, 'International', 'Intl') AS short_airport_name
FROM airports;

-- Concatenate with separator
SELECT iata_code || ' - ' || city || ', ' || country AS airport_label
FROM airports
ORDER BY country, city;
```

**PostgreSQL-specific (not available in SQLite playground):**

```sql
-- LPAD / RPAD — pad to fixed width
SELECT LPAD(code, 5, '-') FROM airlines;   -- '--AI-', '-6E--', etc.

-- FORMAT (printf-style)
SELECT FORMAT('Flight %s: %s → booked %s/%s seats',
              flight_number, status, seats_booked, seats_total)
FROM flights LIMIT 5;

-- REGEXP_REPLACE — regex-based replacement
SELECT REGEXP_REPLACE(flight_number, '[0-9]+', 'XXX')
FROM flights;  -- 'AIXXX', '6EXXX', etc.

-- SPLIT_PART — split by delimiter
SELECT SPLIT_PART(email, '@', 2) AS email_domain
FROM passengers;  -- 'example.com', etc.
```

---

## 9. Date and Time Functions

### SQLite (playground)

```sql
SELECT flight_number,
       departure_time,
       STRFTIME('%Y', departure_time)  AS year,
       STRFTIME('%m', departure_time)  AS month,
       STRFTIME('%d', departure_time)  AS day,
       STRFTIME('%H:%M', departure_time) AS time_hhmm
FROM flights LIMIT 10;

-- Duration calculation
SELECT flight_number,
       departure_time,
       arrival_time,
       ROUND((JULIANDAY(arrival_time) - JULIANDAY(departure_time)) * 24 * 60) AS duration_min
FROM flights
WHERE status IN ('scheduled','departed')
ORDER BY duration_min DESC;
```

### PostgreSQL equivalents

```sql
-- Extract components
SELECT flight_number,
       EXTRACT(year  FROM departure_time) AS year,
       EXTRACT(month FROM departure_time) AS month,
       EXTRACT(hour  FROM departure_time) AS hour,
       TO_CHAR(departure_time, 'HH24:MI') AS time_display
FROM flights;

-- Date truncation
SELECT DATE_TRUNC('month', NOW())  AS month_start,
       DATE_TRUNC('week',  NOW())  AS week_start,
       DATE_TRUNC('hour',  NOW())  AS hour_start;

-- Interval arithmetic
SELECT departure_time + INTERVAL '2 hours' AS expected_departure_plus_buffer
FROM flights;

-- Age / difference
SELECT AGE(NOW(), joined_date::date) AS tenure
FROM passengers LIMIT 5;

-- Current time
SELECT NOW(), CURRENT_DATE, CURRENT_TIMESTAMP;

-- Timezone conversion (critical for global apps)
SELECT departure_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
       departure_time AT TIME ZONE 'UTC'          AS utc_time
FROM flights LIMIT 5;
```

<div class="callout-tip">

**Always store timestamps in UTC** in PostgreSQL using `TIMESTAMPTZ`. Convert to local timezone only at display time in the application layer. This avoids DST bugs and makes global deployments consistent.

</div>

---

## 10. CASE — Conditional Logic

`CASE` is SQL's if-else. It appears inside SELECT, WHERE, ORDER BY, and even GROUP BY.

### Simple CASE (equality comparison)

```sql
SELECT flight_number, status,
       CASE status
           WHEN 'scheduled' THEN 'Waiting at gate'
           WHEN 'boarding'  THEN 'Now boarding'
           WHEN 'departed'  THEN 'In flight'
           WHEN 'arrived'   THEN 'Landed'
           WHEN 'delayed'   THEN 'Running late'
           WHEN 'cancelled' THEN 'Cancelled'
           ELSE 'Unknown status'
       END AS status_label
FROM flights
ORDER BY departure_time;
```

### Searched CASE (arbitrary conditions)

```sql
SELECT first_name, last_name, total_miles,
       CASE
           WHEN total_miles >= 150000 THEN 'Elite Platinum'
           WHEN total_miles >= 100000 THEN 'Platinum'
           WHEN total_miles >= 50000  THEN 'Gold'
           WHEN total_miles >= 20000  THEN 'Silver'
           ELSE 'Bronze'
       END AS computed_tier,
       tier AS stored_tier
FROM passengers
ORDER BY total_miles DESC;
-- Compare computed_tier vs stored_tier — are they consistent?
```

### CASE in ORDER BY — custom sort priority

```sql
SELECT flight_number, status
FROM flights
ORDER BY
    CASE status
        WHEN 'delayed'   THEN 1   -- show problems first
        WHEN 'boarding'  THEN 2
        WHEN 'scheduled' THEN 3
        WHEN 'departed'  THEN 4
        WHEN 'arrived'   THEN 5
        WHEN 'cancelled' THEN 6
    END,
    departure_time;
```

### IIF, NULLIF, COALESCE (shorthand CASE variants)

```sql
-- IIF(condition, true_val, false_val) — available in SQLite
SELECT flight_number,
       IIF(status = 'cancelled', 'N/A', seats_booked || '/' || seats_total) AS capacity_info
FROM flights;

-- NULLIF(a, b) — returns NULL if a = b, otherwise a
SELECT flight_number,
       seats_booked * 1.0 / NULLIF(seats_total, 0) AS load_factor
FROM flights;
-- Prevents division-by-zero by returning NULL when seats_total = 0

-- COALESCE(a, b, c, ...) — return first non-NULL
SELECT flight_number,
       COALESCE(actual_arrival, arrival_time, 'TBD') AS effective_arrival
FROM flights;
```

---

## 11. NULL — The Three-Valued Logic

NULL means "unknown" or "missing". It is NOT zero, NOT empty string, NOT false. It participates in **three-valued logic**: TRUE, FALSE, and UNKNOWN (NULL).

### The golden rule: NULL comparisons return NULL

```sql
-- These all return NULL (unknown), never TRUE:
SELECT NULL = NULL;      -- NULL
SELECT NULL <> NULL;     -- NULL
SELECT NULL = 0;         -- NULL
SELECT NULL > 5;         -- NULL
SELECT 1 + NULL;         -- NULL (any arithmetic with NULL = NULL)
SELECT 'text' || NULL;   -- NULL (concatenation with NULL = NULL)
```

### The only correct way to check for NULL

```sql
-- Correct:
SELECT * FROM passengers WHERE email IS NULL;
SELECT * FROM passengers WHERE email IS NOT NULL;

-- Wrong — returns no rows because NULL != NULL:
SELECT * FROM passengers WHERE email = NULL;
```

### COALESCE — handle NULLs with defaults

```sql
SELECT passenger_id,
       COALESCE(total_miles, 0)   AS miles_with_default,
       COALESCE(tier, 'unranked') AS tier_with_default
FROM passengers;

-- First non-NULL wins:
SELECT COALESCE(NULL, NULL, 'third', 'fourth');  -- Returns: 'third'
```

### NULLIF — turn a specific value into NULL

```sql
-- Returns NULL if value equals second argument, else returns value
-- Classic use: safe division
SELECT route_id,
       ROUND(CAST(seats_booked AS REAL) / NULLIF(seats_total, 0) * 100, 1) AS load_pct
FROM flights;
-- When seats_total = 0, returns NULL instead of division-by-zero error
```

### NULLs in aggregate functions

```sql
-- COUNT(*) counts all rows including NULLs
-- COUNT(column) counts only non-NULL values — silently skips NULLs
-- SUM, AVG, MIN, MAX all ignore NULLs
SELECT
    COUNT(*)               AS total_bookings,
    COUNT(checked_in)      AS rows_with_check_in,
    AVG(fare)              AS avg_fare_ignores_nulls,
    SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) AS checked_in_count
FROM bookings;
```

### IS DISTINCT FROM (PostgreSQL — NULL-safe comparison)

```sql
-- PostgreSQL:
-- True when values differ, or one is NULL and the other isn't
-- Unlike !=, handles NULL values gracefully
SELECT * FROM flights WHERE status IS DISTINCT FROM 'cancelled';
-- Returns rows where status != 'cancelled' AND rows where status IS NULL

-- Opposite: IS NOT DISTINCT FROM (NULL-safe equals)
SELECT * FROM flights WHERE status IS NOT DISTINCT FROM 'delayed';
-- Returns rows where status = 'delayed' OR both are NULL
```

---

## 12. PostgreSQL Data Types — Reference

### Numeric types

| Type | Storage | Range | Use case |
|------|---------|-------|----------|
| `SMALLINT` | 2 bytes | ±32,767 | Small enumerations |
| `INTEGER` | 4 bytes | ±2.1 billion | IDs, counts, years |
| `BIGINT` | 8 bytes | ±9.2 quintillion | Large IDs, Unix timestamps |
| `NUMERIC(p,s)` | Variable | Exact | **Money** — never use FLOAT for currency |
| `REAL` | 4 bytes | ~6 sig digits | Physics, stats (approximate) |
| `DOUBLE PRECISION` | 8 bytes | ~15 sig digits | High-precision floats |

```sql
-- Numeric precision matters for money:
SELECT 0.1 + 0.2;             -- 0.30000000000000004 (FLOAT!)
SELECT 0.1::NUMERIC + 0.2;    -- 0.3 (EXACT)

-- Use NUMERIC(10,2) for INR amounts:
-- Up to ₹99,999,999.99, always exact, two decimal places
```

### Text types

| Type | Description | Recommendation |
|------|-------------|---------------|
| `TEXT` | Unlimited variable length | **Use this for most strings** |
| `VARCHAR(n)` | Variable, max n chars | When you need a length constraint |
| `CHAR(n)` | Fixed, padded with spaces | Almost never — causes surprising bugs |

### Date / Time types

| Type | Example | Use |
|------|---------|-----|
| `DATE` | `2025-06-01` | Date only (no time) |
| `TIME` | `14:30:00` | Time only (no date) |
| `TIMESTAMP` | `2025-06-01 14:30:00` | Without timezone |
| `TIMESTAMPTZ` | `2025-06-01 14:30:00+05:30` | **With timezone — use this** |
| `INTERVAL` | `3 hours 30 minutes` | Duration between two times |

### Boolean (PostgreSQL)

```sql
-- PostgreSQL has a real BOOLEAN type: TRUE, FALSE, NULL
SELECT * FROM bookings WHERE checked_in = TRUE;
SELECT * FROM bookings WHERE checked_in;    -- same as = TRUE

-- SQLite uses 1/0 integers (playground)
SELECT * FROM bookings WHERE checked_in = 1;
```

### JSONB — PostgreSQL's superpower

```sql
-- PostgreSQL JSONB: binary JSON, indexed, queryable
CREATE TABLE flight_extras (
    flight_id  INTEGER,
    details    JSONB
);

INSERT INTO flight_extras VALUES
    (1, '{"gate": "B22", "meal": "veg", "delay_reason": null}');

-- Query JSON fields
SELECT details->>'gate'  AS gate,
       details->>'meal'  AS meal
FROM flight_extras;

-- GIN index for fast JSONB search
CREATE INDEX idx_extras_details ON flight_extras USING GIN(details);

-- Contains operator @>
SELECT * FROM flight_extras WHERE details @> '{"meal": "veg"}';
```

---

## 13. Best Practices and Gotchas

### 1. Use explicit column lists, never `SELECT *` in production

```sql
-- BAD: fragile, wasteful
SELECT * FROM passengers WHERE tier = 'gold';

-- GOOD: explicit, self-documenting
SELECT passenger_id, first_name, last_name, email, tier, total_miles
FROM passengers WHERE tier = 'gold';
```

### 2. Integer division is silent in SQL

```sql
SELECT 7 / 2;       -- Returns 3, not 3.5 (integer division!)
SELECT 7.0 / 2;     -- Returns 3.5
SELECT 7 * 1.0 / 2; -- Returns 3.5
SELECT 7::NUMERIC / 2; -- PostgreSQL cast syntax
```

### 3. String comparison is case-sensitive in PostgreSQL

```sql
-- 'Delhi' != 'delhi' != 'DELHI' in PostgreSQL
-- Use LOWER() or ILIKE for case-insensitive search:
SELECT * FROM airports WHERE LOWER(city) = 'delhi';
SELECT * FROM airports WHERE city ILIKE 'delhi';  -- PostgreSQL only
```

### 4. OFFSET is slow at scale — use keyset pagination

```sql
-- BAD: scans 10,000 rows to discard them
SELECT * FROM bookings ORDER BY booking_id LIMIT 10 OFFSET 10000;

-- GOOD: uses index, constant time
SELECT * FROM bookings
WHERE booking_id > 10000  -- last seen ID
ORDER BY booking_id LIMIT 10;
```

### 5. Use EXPLAIN ANALYZE to understand what PostgreSQL actually does

```sql
-- PostgreSQL:
EXPLAIN ANALYZE SELECT * FROM bookings WHERE passenger_id = 5;
-- Shows: Seq Scan vs Index Scan, actual rows, execution time
-- Everything you write should have an EXPLAIN ANALYZE story
```

### 6. Always quote table/column names in double quotes if they conflict with keywords

```sql
-- Avoid reserved words as column names
-- If you must:
SELECT "order", "group", "user" FROM some_table;  -- double quotes
-- NOT single quotes — those are for string literals
```

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A support dashboard shows "customers without a phone number" using `WHERE phone = NULL`, and it always returns zero rows — so the team believes all customers have phone numbers. **Decision**: In SQL, `NULL = NULL` is not true (it's unknown), so the filter never matches. Use `WHERE phone IS NULL`. Always test filters on nullable columns with known NULL rows, and remember that `NOT IN (...)` against a list containing NULL also returns nothing.

</div>

<div class="callout-scenario">

**Scenario**: An API endpoint runs `SELECT * FROM bookings WHERE passenger_id = ?` and serializes every column. After a migration adds a `payment_token` column, the token starts appearing in API responses. **Decision**: `SELECT *` couples your code to the table's current shape: new columns leak into responses, extra data is transferred, and covering indexes can't be used. Select explicit columns (or map to a DTO projection) so schema changes are deliberate.

</div>

## 🏋️ Practice Assignments

Run these in the **SQL Playground** at the top of this page.

### 🟢 Low — Build the reflexes

**L1.** List all flights with status `'scheduled'`, showing flight number, departure time, and aircraft, earliest first.

<details>
<summary>Show answer</summary>

```sql
SELECT flight_number, departure_time, aircraft
FROM flights
WHERE status = 'scheduled'
ORDER BY departure_time;
```

</details>

**L2.** Find passengers in the `gold` or `platinum` tier with more than 50,000 miles, highest miles first.

<details>
<summary>Show answer</summary>

```sql
SELECT first_name || ' ' || last_name AS passenger, tier, total_miles
FROM passengers
WHERE tier IN ('gold', 'platinum')
  AND total_miles > 50000
ORDER BY total_miles DESC;
```

</details>

**L3.** Show the 5 most expensive bookings with their class and fare.

<details>
<summary>Show answer</summary>

```sql
SELECT booking_id, class, fare
FROM bookings
ORDER BY fare DESC
LIMIT 5;
```

In PostgreSQL you may also see `FETCH FIRST 5 ROWS ONLY` (standard SQL).

</details>

### 🟡 Medium — Apply it

**M1.** Label each flight's occupancy as `'FULL'` (≥ 95% of seats booked), `'BUSY'` (≥ 70%), or `'OPEN'`, with the occupancy percentage rounded to one decimal.

<details>
<summary>Show answer</summary>

```sql
SELECT flight_number,
       seats_booked, seats_total,
       ROUND(100.0 * seats_booked / seats_total, 1) AS occupancy_pct,
       CASE
         WHEN 1.0 * seats_booked / seats_total >= 0.95 THEN 'FULL'
         WHEN 1.0 * seats_booked / seats_total >= 0.70 THEN 'BUSY'
         ELSE 'OPEN'
       END AS load_label
FROM flights
ORDER BY occupancy_pct DESC;
```

Multiplying by `100.0` / `1.0` avoids **integer division** (`162 / 168` is `0` in integer arithmetic).

</details>

**M2.** Find passengers whose email is on the `example.com` domain and who joined in 2020, sorted by last name.

<details>
<summary>Show answer</summary>

```sql
SELECT first_name, last_name, email, joined_date
FROM passengers
WHERE email LIKE '%@example.com'
  AND joined_date >= '2020-01-01' AND joined_date < '2021-01-01'
ORDER BY last_name;
```

The date range (instead of a function on the column) keeps the filter index-friendly — see `sql-indexing`.

</details>

**M3.** Show bookings that are not `'confirmed'` together with the reason category: `'cancelled'` → "Cancelled by user", `'refunded'` → "Refunded", anything else → "Needs review".

<details>
<summary>Show answer</summary>

```sql
SELECT booking_id, status,
       CASE status
         WHEN 'cancelled' THEN 'Cancelled by user'
         WHEN 'refunded'  THEN 'Refunded'
         ELSE 'Needs review'
       END AS reason
FROM bookings
WHERE status <> 'confirmed';
```

Note: `status <> 'confirmed'` excludes rows where `status IS NULL`; add `OR status IS NULL` if NULL statuses are possible.

</details>

### 🔴 High — Think like a senior

**H1.** A product manager asks for "all bookings from last month". Write a query that's correct regardless of time-of-day values, explain the pitfalls, and make it index-friendly.

<details>
<summary>Show answer</summary>

```sql
-- PostgreSQL version (half-open range on the raw column):
-- WHERE booking_date >= date_trunc('month', now()) - interval '1 month'
--   AND booking_date <  date_trunc('month', now())

-- Playground (SQLite) version for a fixed month:
SELECT booking_id, booking_date, fare
FROM bookings
WHERE booking_date >= '2025-05-01'
  AND booking_date <  '2025-06-01'
ORDER BY booking_date;
```

Pitfalls: `BETWEEN '2025-05-01' AND '2025-05-31'` misses bookings on May 31 after midnight (timestamps); `EXTRACT(MONTH FROM booking_date) = 5` is non-sargable (no index use) and ignores the year; time zones — "last month" for an Indian business means IST boundaries, so convert explicitly if timestamps are stored in UTC. Always use a half-open range `[start, next_start)`.

</details>

**H2.** A query `SELECT * FROM passengers WHERE LOWER(email) = LOWER(?)` is slow on 20M rows, and duplicates exist that differ only by case. Propose a complete fix.

<details>
<summary>Show answer</summary>

Data: normalize emails at write time (store lowercase, trimmed) and deduplicate existing rows after merging accounts carefully. Constraint: a unique index on the normalized value — in PostgreSQL `CREATE UNIQUE INDEX ON passengers (LOWER(email));` (expression index) or the `citext` type — which also makes `WHERE LOWER(email) = LOWER(?)` fast. Query: select only needed columns. Application: normalize input before querying. This turns a slow query and a data-quality bug into one enforced rule.

</details>

## 🛠️ Mini Project — Airline Operations Report Pack

**Goal**: Write a set of production-style SQL reports against the playground schema, then port them to PostgreSQL. 1 evening.

**Build**

1. In the playground, write 8 reports: today's departures board; flights over 90% full; platinum passengers who haven't booked in 60 days; cancelled/refunded bookings with reasons; busiest aircraft types; bookings by class; passengers missing contact data; fares above the average for their class (preview of subqueries).
2. Load the same schema and data into PostgreSQL (Docker) and run them there; note any syntax differences (date functions, `LIMIT` vs `FETCH`, string functions).
3. Save them as versioned `.sql` files with a header comment: purpose, owner, expected runtime, and indexes they rely on.
4. For two reports, run `EXPLAIN` in PostgreSQL and add an index that improves them.

**Acceptance criteria**: every report has explicit columns (no `SELECT *`), NULL-safe filters, half-open date ranges, and a note of the business question it answers.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What is the difference between WHERE and HAVING?"**

WHERE filters individual rows before any aggregation happens. HAVING filters groups after GROUP BY has been applied. The practical consequence: you cannot use aggregate functions (COUNT, SUM, AVG) in WHERE — they don't exist yet at that stage of execution. HAVING runs after aggregation, so you can filter on aggregate results. In practice: use WHERE to reduce the row set early (cheaper, uses indexes), then HAVING to filter the aggregated groups. For non-aggregate conditions, always put them in WHERE not HAVING — the planner may still handle it, but it's conceptually wrong and can hurt performance.

</div>

<div class="callout-interview">

**Q: "Why should you avoid `SELECT *`?"**

Three reasons. First, network waste — you transmit every column even if the application uses two. At scale this is significant. Second, fragility — if someone adds a column, renames a column, or reorders them, code relying on SELECT * may break silently or return unexpected data. Third, it prevents covering indexes — a query like SELECT id, email FROM users can be answered entirely from an index on (id, email) without touching the main table. SELECT * forces a heap lookup for every row. In interviews, I'd also mention it hides intent — explicit column lists document what the query actually needs.

</div>

<div class="callout-interview">

**Q: "Explain NULL behaviour in SQL. Why is NULL != NULL?"**

NULL in SQL means 'unknown' or 'missing' — it's not a value, it's the absence of a value. Because it's unknown, any comparison involving NULL returns UNKNOWN, not TRUE or FALSE. NULL = NULL asks 'is unknown equal to unknown?' — since you don't know what either is, you can't say yes. SQL uses three-valued logic: TRUE, FALSE, and UNKNOWN. A WHERE clause only passes rows where the condition is TRUE — UNKNOWN fails just like FALSE. The correct operators for NULL are IS NULL and IS NOT NULL. In PostgreSQL you also have IS DISTINCT FROM for NULL-safe equality. The most dangerous consequence: NOT IN with a subquery that returns NULLs makes NOT IN return zero rows, because the expression evaluates to UNKNOWN.

</div>

<div class="callout-interview">

**Q: "What is the difference between TRUNCATE, DELETE, and DROP?"**

DELETE is DML — it removes specific rows matching a WHERE condition (or all rows if no WHERE), is logged per-row, fires row-level triggers, and is fully transactional (rollback-able). TRUNCATE is DDL — it removes all rows at once by resetting the table storage, is much faster for large tables, doesn't fire row-level triggers, but in PostgreSQL it IS transactional (unlike MySQL). DROP removes the entire table structure — schema, data, indexes, constraints — completely. As a rule: DELETE for selective removal or when triggers matter, TRUNCATE to empty a table quickly (bulk reset, test data), DROP to eliminate the table itself.

</div>

<div class="callout-interview">

**Q: "How does BETWEEN behave with NULL values?"**

BETWEEN a AND b is exactly equivalent to val >= a AND val <= b. If val is NULL, both comparisons return NULL, the AND of two NULLs is NULL, and the row is excluded. If one of the bounds (a or b) is NULL, the corresponding comparison returns NULL and the overall condition becomes NULL. So any row where the tested column is NULL, or where you're comparing against NULL bounds, will be silently excluded — the same as any other NULL comparison. For columns that may be NULL, combine BETWEEN with an explicit IS NOT NULL check if needed.

</div>

---

## Your Practice Checklist

- [ ] Run `SELECT * FROM airlines` and understand every column
- [ ] Query all flights NOT in 'scheduled' or 'arrived' status
- [ ] Use CASE to label flights as 'On Time', 'Running Late', or 'Done'
- [ ] Find passengers whose last name starts with 'S' — using LIKE
- [ ] Use COALESCE to replace NULL with a default value
- [ ] Write ORDER BY that sorts by two columns in different directions
- [ ] Use BETWEEN for a numeric range on total_miles
- [ ] Combine AND + OR with parentheses and verify operator precedence
- [ ] Calculate load factor (seats_booked / seats_total) as a percentage
- [ ] Use IS NULL to find any rows where a field is missing

## Related Topics

- `sql-joins` — Combining multiple tables
- `sql-aggregates` — GROUP BY, COUNT, SUM, AVG
- `sql-window-functions` — Ranking and running totals
- `sql-indexing` — Making these queries fast at scale

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — ShopNorth's 'my orders' page and daily reports start with exactly these queries.

**Continue the story:** [Chapter 4 · Data Model & SQL](/tutorials/journey-04-data-sql) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
