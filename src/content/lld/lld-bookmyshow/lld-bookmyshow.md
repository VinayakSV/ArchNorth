# Design BookMyShow / Movie Ticket Booking

## The Core Problem

Design a system where millions of users can browse movies, select seats, and book tickets — with no two users able to book the same seat for the same show.

---

## Key Design Challenges

- **Concurrent seat selection** — two users click the same seat simultaneously
- **Seat locking** — hold a seat while user enters payment details
- **Consistency** — no double booking under any circumstance
- **Scale** — IPL final or Blockbuster release day traffic spikes

---

## Class Design

```
Show → has many Screens → each Screen has a SeatMap
Booking → links User + Show + [Seats] + Payment
```

### Core Classes

```java
class Movie { String id, title, duration; }

class Theatre { String id, name; List<Screen> screens; }

class Screen { String id; SeatMap seatMap; }

class Show {
  String id;
  Movie movie;
  Screen screen;
  LocalDateTime startTime;
  Map<String, SeatStatus> seatStatuses; // seatId → AVAILABLE/LOCKED/BOOKED
}

enum SeatStatus { AVAILABLE, LOCKED, BOOKED }

class Booking {
  String id;
  User user;
  Show show;
  List<Seat> seats;
  BookingStatus status;
  Payment payment;
}
```

---

## The Concurrency Problem — How to Solve It

### Option 1: Optimistic Locking (DB-level)
```sql
UPDATE seats SET status = 'LOCKED', locked_by = ?, lock_expiry = NOW() + 10min
WHERE show_id = ? AND seat_id = ? AND status = 'AVAILABLE'
```
If `rowsAffected == 0` → seat was taken by another transaction. Show error.

### Option 2: Redis Distributed Lock
```java
String lockKey = "seat-lock:" + showId + ":" + seatId;
boolean locked = redis.setnx(lockKey, userId, 600); // 10-min TTL
if (!locked) throw new SeatAlreadyLockedException();
```

---

## Seat Locking Flow

```
1. User selects seats → LOCK them (10 min TTL)
2. User enters payment → process payment
3. If payment succeeds → mark seats BOOKED, create Booking
4. If payment fails / user abandons → TTL expires → seats become AVAILABLE again
```

---

<div class="callout-interview">
**Q: "How do you prevent double booking?"**

Atomic DB update with a `WHERE status = 'AVAILABLE'` condition. Only one transaction wins — the other sees `rowsAffected = 0` and knows the seat was taken. Redis `SETNX` achieves the same thing in-memory. The key principle: the check and the update must be atomic.

**Q: "What happens if payment fails but seat was locked?"**

TTL-based auto-release. Seats are locked with a 10-minute expiry. If no booking is confirmed before expiry, the lock disappears and seats become available again. No manual cleanup needed.

**Q: "How do you scale for a blockbuster release?"**

Partition shows by `show_id` across DB shards. Each shard handles its own set of shows. Redis cluster for seat locks. Queue incoming requests for hot shows — shed load at the API gateway. Pre-warm caches for known high-traffic shows.
</div>
