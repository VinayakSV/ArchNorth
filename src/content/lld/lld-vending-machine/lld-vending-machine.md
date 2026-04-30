# Design Vending Machine

## The Core Problem

Model a vending machine that accepts coins, displays products, dispenses items, and handles edge cases like insufficient funds, out-of-stock items, and change.

---

## State Pattern — The Core of the Design

The vending machine's behaviour changes entirely based on its current state.

```java
interface VendingMachineState {
  void insertCoin(VendingMachine machine, Coin coin);
  void selectProduct(VendingMachine machine, String productCode);
  void dispense(VendingMachine machine);
  void cancel(VendingMachine machine);
}
```

### States

```java
class IdleState implements VendingMachineState {
  public void insertCoin(VendingMachine m, Coin coin) {
    m.addBalance(coin.getValue());
    m.setState(new HasMoneyState());
  }
  public void selectProduct(VendingMachine m, String code) {
    System.out.println("Please insert coin first");
  }
  // dispense / cancel → do nothing or print message
}

class HasMoneyState implements VendingMachineState {
  public void selectProduct(VendingMachine m, String code) {
    Product p = m.getProduct(code);
    if (p == null) { System.out.println("Invalid product"); return; }
    if (p.getCount() == 0) { System.out.println("Out of stock"); return; }
    if (m.getBalance() < p.getPrice()) { System.out.println("Insufficient funds"); return; }
    m.setSelectedProduct(p);
    m.setState(new ProductSelectedState());
  }
  public void cancel(VendingMachine m) {
    m.returnChange(m.getBalance());
    m.setState(new IdleState());
  }
}

class ProductSelectedState implements VendingMachineState {
  public void dispense(VendingMachine m) {
    Product p = m.getSelectedProduct();
    p.decrementCount();
    double change = m.getBalance() - p.getPrice();
    if (change > 0) m.returnChange(change);
    m.setState(new IdleState());
  }
}
```

---

## Supporting Classes

```java
class VendingMachine {
  private VendingMachineState currentState;
  private Map<String, Product> inventory;
  private double balance;
  private Product selectedProduct;
  // delegates all actions to currentState
}

class Product { String code, name; double price; int count; }

enum Coin { PENNY(0.01), NICKEL(0.05), DIME(0.10), QUARTER(0.25); }
```

---

## Change Dispenser (Greedy)

```java
double returnChange(double amount) {
  Coin[] coins = { Coin.QUARTER, Coin.DIME, Coin.NICKEL, Coin.PENNY };
  for (Coin c : coins) {
    while (amount >= c.getValue()) {
      dispense(c);
      amount -= c.getValue();
    }
  }
  return amount; // any residual (floating point) is absorbed
}
```

---

<div class="callout-interview">
**Q: "Why use the State Pattern here?"**

Because the same action (e.g., "select product") has completely different behaviour depending on the machine's state. Without State Pattern, you'd have if/else chains everywhere. State Pattern makes each state a separate class with its own logic — adding a new state (e.g., "maintenance mode") means adding a new class, not modifying existing ones.

**Q: "What happens if the machine runs out of change?"**

Add an `InsufficientChangeState`. Before moving to `ProductSelectedState`, check if the machine has enough coins to return the expected change. If not, move to `InsufficientChangeState`, which prompts for exact change or cancels the transaction.

**Q: "How do you make the machine thread-safe for concurrent use?"**

Vending machines are typically single-user physical devices. For a software simulation, synchronize the state transition methods. In a distributed system (smart vending IoT), use optimistic locking or a message queue to serialize transactions per machine ID.
</div>
