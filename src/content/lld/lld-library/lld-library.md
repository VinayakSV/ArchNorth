# Design Library Management System

## The Core Problem

A library needs to manage books, members, borrowing/returning, fines for overdue books, search, and reservations.

---

## Class Design

```java
class Library { List<BookItem> catalog; List<Member> members; }

class Book { String isbn, title, author, publisher; int totalCopies; }

class BookItem {          // Physical copy of a book
  String barcode;
  Book book;
  BookItemStatus status;
  LocalDate dueDate;
}

enum BookItemStatus { AVAILABLE, BORROWED, RESERVED, LOST }

class Member {
  String id, name, email;
  List<Loan> activeLoans;
  double outstandingFine;
}

class Loan {
  BookItem bookItem;
  Member member;
  LocalDate borrowDate, dueDate, returnDate;
  double fine;
}
```

---

## Core Operations

### Borrow Book
```java
BookItem borrow(Member member, String isbn) {
  if (member.activeLoans.size() >= MAX_BOOKS) throw new LimitExceededException();
  if (member.outstandingFine > 0) throw new OutstandingFineException();

  BookItem item = catalog.findAvailable(isbn)
                         .orElseThrow(BookNotAvailableException::new);
  item.status = BORROWED;
  item.dueDate = LocalDate.now().plusDays(14);

  Loan loan = new Loan(item, member, LocalDate.now(), item.dueDate);
  member.activeLoans.add(loan);
  return item;
}
```

### Return Book and Calculate Fine
```java
void returnBook(String barcode) {
  BookItem item = findByBarcode(barcode);
  Loan loan = findActiveLoan(item);

  long daysOverdue = ChronoUnit.DAYS.between(loan.dueDate, LocalDate.now());
  if (daysOverdue > 0) {
    loan.fine = daysOverdue * FINE_PER_DAY;
    loan.member.outstandingFine += loan.fine;
  }

  item.status = AVAILABLE;
  loan.returnDate = LocalDate.now();
  // Notify any members on the reservation list
  notifyReservations(item);
}
```

---

## Observer Pattern for Reservations

```java
interface BookAvailabilityObserver { void onBookAvailable(BookItem item); }

class ReservationService implements BookAvailabilityObserver {
  Map<String, Queue<Member>> waitlists = new HashMap<>();

  public void reserve(Member member, String isbn) {
    waitlists.computeIfAbsent(isbn, k -> new LinkedList<>()).add(member);
  }

  public void onBookAvailable(BookItem item) {
    Queue<Member> queue = waitlists.get(item.book.isbn);
    if (queue != null && !queue.isEmpty()) {
      notifyMember(queue.poll(), item); // notify first in line
    }
  }
}
```

---

<div class="callout-interview">
**Q: "Why separate Book from BookItem?"**

Book represents the title/metadata (one record per ISBN). BookItem represents a physical copy — there might be 5 copies of the same book. This models the real world accurately: you borrow a specific physical copy, not the abstract "book". Without this separation, tracking which copy is borrowed where becomes impossible.

**Q: "How do you handle concurrent borrowing of the last copy?"**

Optimistic locking on `BookItem.status`. Use a DB-level conditional update: `UPDATE book_items SET status='BORROWED' WHERE barcode=? AND status='AVAILABLE'`. Only one transaction succeeds; the other gets 0 rows updated and knows to show "Not available".

**Q: "How are fine notifications handled?"**

A scheduled job (cron) runs daily, finds all loans where `dueDate < today` and `returnDate IS NULL`, calculates fines, and notifies members via email/SMS. The notification itself uses the Observer pattern — the fine calculator fires an event, and registered notifiers (email, SMS, push) handle it.
</div>
