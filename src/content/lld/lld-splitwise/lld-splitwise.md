# Design Splitwise / Expense Sharing

## The Core Problem

Multiple friends share expenses (rent, trips, dinners). The app tracks who paid what, calculates who owes whom, and optionally simplifies the debts to the minimum number of transactions.

---

## Class Design

```java
class User { String id, name, email; }

class Group { String id, name; List<User> members; List<Expense> expenses; }

class Expense {
  String id;
  User paidBy;
  double amount;
  String description;
  List<ExpenseSplit> splits;
  SplitType splitType;
}

enum SplitType { EQUAL, EXACT, PERCENTAGE, SHARES }

class ExpenseSplit { User user; double amount; }

class Balance { User owes; User isOwedBy; double amount; }
```

---

## The Split Strategies (Strategy Pattern)

```java
interface SplitStrategy {
  List<ExpenseSplit> split(double totalAmount, List<User> participants, List<Double> inputs);
}

class EqualSplit implements SplitStrategy {
  public List<ExpenseSplit> split(double total, List<User> users, List<Double> ignored) {
    double each = total / users.size();
    return users.stream().map(u -> new ExpenseSplit(u, each)).toList();
  }
}

class ExactSplit implements SplitStrategy { /* uses input amounts directly */ }

class PercentageSplit implements SplitStrategy { /* inputs are percentages, must sum to 100 */ }
```

---

## Debt Simplification Algorithm

Naive approach: track every individual debt (A owes B ₹100, B owes C ₹80). This creates many transactions.

**Simplification approach:**
1. Build a net balance map: `netBalance[user] = totalOwed - totalPaid`
2. Users with positive balance are owed money; negative balance owe money
3. Greedily match the largest creditor with the largest debtor
4. Repeat until all balances are zero

```java
// Net balance map
Map<User, Double> net = new HashMap<>();
for (Expense e : expenses) {
    net.merge(e.paidBy, e.amount, Double::sum);
    for (ExpenseSplit s : e.splits) {
        net.merge(s.user, -s.amount, Double::sum);
    }
}

// Simplify: use two-pointer approach on sorted creditors/debtors
```

This reduces N debts to at most N-1 transactions.

---

<div class="callout-interview">
**Q: "Which design pattern does the split logic use?"**

Strategy Pattern. Each split type (Equal, Exact, Percentage, Shares) is a separate strategy implementing a common interface. The Expense class holds a reference to the strategy and delegates to it. Adding a new split type means adding a new class, not modifying existing ones (Open/Closed Principle).

**Q: "How do you simplify debts?"**

Compute net balance for each user (money received minus money owed). Positive = owed money, negative = owes money. Use a greedy two-pointer approach: the biggest debtor pays the biggest creditor, repeat. This gives the minimum number of transactions needed to settle all debts.

**Q: "How would you add currency support?"**

Add a `Currency` field to `Expense`. Store all balances in a base currency (e.g., USD). On display, convert using an exchange rate service. Store the original currency + amount for audit purposes.
</div>
