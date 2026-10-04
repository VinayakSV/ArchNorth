# Design ATM System — The Vending Machine With Trust Issues

## The Vending Machine Analogy

An ATM is like a vending machine — but instead of snacks, it dispenses cash. And instead of trusting you with a coin, it needs to verify your identity, check your bank balance, ensure the cash drawer has enough money, record every transaction, and handle the case where the machine jams mid-dispensing. Oh, and it must do all this while being offline-resilient, tamper-proof, and available 24/7.

---

## 1. Requirements

### Functional
- Authenticate user via card + 4-digit PIN
- Check account balance
- Withdraw cash (with denomination selection)
- Deposit cash/checks
- Transfer between accounts
- Print mini-statement / receipt

### Non-Functional
- **Availability**: 99.99% — ATMs must work 24/7
- **Security**: Encrypted communication, tamper detection
- **Consistency**: Account balance must be accurate (no double-dispensing)
- **Offline resilience**: Handle temporary network failures gracefully
- **Concurrency**: One transaction per ATM at a time, but millions of ATMs globally

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph ATM["ATM Machine"]
        CR[Card Reader]
        KP[Keypad / Touchscreen]
        CD[Cash Dispenser]
        RP[Receipt Printer]
        AC[ATM Controller]
    end

    subgraph Network
        LB[Load Balancer]
    end

    subgraph Backend["Bank Backend"]
        AG[ATM Gateway Service]
        AS[Auth Service]
        TS[Transaction Service]
        BS[Balance Service]
        NS[Notification Service]
    end

    subgraph Data
        DB[(Core Banking DB)]
        AL[(Audit Log)]
        KF[Kafka - Events]
    end

    AC -->|Encrypted| LB
    LB --> AG
    AG --> AS
    AG --> TS
    AG --> BS
    TS --> DB
    TS --> AL
    TS --> KF
    KF --> NS
```

---

## 3. ATM State Machine — The Heart of the Design

Every ATM transaction follows a strict state machine:

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> CardInserted: Insert Card
    CardInserted --> PINEntry: Card Read OK
    CardInserted --> CardEjected: Card Read Failed
    PINEntry --> Authenticated: PIN Valid
    PINEntry --> PINRetry: PIN Invalid (attempt < 3)
    PINRetry --> PINEntry: Retry
    PINEntry --> CardRetained: 3 Failed Attempts
    Authenticated --> MenuSelection: Show Menu
    MenuSelection --> BalanceInquiry: Check Balance
    MenuSelection --> WithdrawalFlow: Withdraw
    MenuSelection --> DepositFlow: Deposit
    WithdrawalFlow --> Dispensing: Approved
    WithdrawalFlow --> Declined: Insufficient Funds
    Dispensing --> TransactionComplete: Cash Taken
    Dispensing --> CashRetracted: Cash Not Taken (30s timeout)
    TransactionComplete --> AnotherTransaction: Yes
    TransactionComplete --> CardEjected: No
    AnotherTransaction --> MenuSelection
    CardEjected --> [*]
    CardRetained --> [*]
    Declined --> MenuSelection
```

<div class="callout-info">

**Key insight**: The state machine ensures the ATM can NEVER be in an ambiguous state. Every possible scenario (timeout, failure, user abandonment) has a defined transition. This is critical for financial systems.

</div>

---

## 4. The Withdrawal Flow — Where It Gets Tricky

```mermaid
sequenceDiagram
    participant User
    participant ATM
    participant Gateway as ATM Gateway
    participant TxnSvc as Transaction Service
    participant DB as Core Banking DB
    participant Dispenser as Cash Dispenser

    User->>ATM: Withdraw ₹5,000
    ATM->>Gateway: POST /withdraw {card, amount, atm_id}
    Gateway->>TxnSvc: Create transaction (PENDING)
    TxnSvc->>DB: BEGIN TRANSACTION
    TxnSvc->>DB: SELECT balance WHERE account_id = X FOR UPDATE
    Note over DB: Row locked — no other ATM can modify
    alt Balance >= 5000
        TxnSvc->>DB: UPDATE balance = balance - 5000
        TxnSvc->>DB: INSERT INTO transactions (DEBIT, 5000, PENDING)
        TxnSvc->>DB: COMMIT
        TxnSvc->>Gateway: APPROVED
        Gateway->>ATM: Dispense ₹5,000
        ATM->>Dispenser: Dispense cash
        alt Cash dispensed successfully
            Dispenser->>ATM: SUCCESS
            ATM->>Gateway: Dispensing confirmed
            Gateway->>TxnSvc: Mark transaction COMPLETED
        else Dispenser jammed
            Dispenser->>ATM: FAILURE
            ATM->>Gateway: Dispensing failed
            Gateway->>TxnSvc: REVERSE transaction
            TxnSvc->>DB: UPDATE balance = balance + 5000
            TxnSvc->>DB: INSERT reversal record
            ATM->>User: "Transaction failed. Amount not deducted."
        end
    else Insufficient balance
        TxnSvc->>DB: ROLLBACK
        TxnSvc->>Gateway: DECLINED
        Gateway->>ATM: Show "Insufficient funds"
    end
```

<div class="callout-warn">

**Warning**: The most dangerous scenario is: money deducted from account BUT cash not dispensed. This is why the transaction is marked PENDING until the dispenser confirms. If dispensing fails, an automatic reversal kicks in. If the ATM crashes mid-dispensing, a reconciliation job detects PENDING transactions older than 5 minutes and reverses them.

</div>

---

## 5. Handling the "Money Deducted But Not Received" Problem

This is the #1 customer complaint. Here's how to handle it:

```mermaid
flowchart TB
    A[Transaction marked PENDING] --> B{Cash dispensed?}
    B -->|Yes, user took it| C[Mark COMPLETED]
    B -->|Yes, user didn't take it in 30s| D[Retract cash, mark REVERSED]
    B -->|No, dispenser jammed| E[Mark FAILED, auto-reverse]
    B -->|Unknown, ATM crashed| F[Reconciliation Job]
    F --> G{PENDING > 5 min?}
    G -->|Yes| H[Auto-reverse + alert ops team]
    G -->|No| I[Wait for ATM to reconnect]
```

<div class="callout-scenario">

**Scenario**: User withdraws ₹10,000. Bank deducts the amount. ATM dispenser jams after dispensing only ₹5,000. **Decision**: The ATM detects partial dispensing via cash counter sensors. It reports to the gateway: "Dispensed ₹5,000 of ₹10,000." The transaction service reverses ₹5,000 and marks the transaction as PARTIAL. The user gets ₹5,000 cash + ₹5,000 reversed to account. An alert is raised for the ops team to refill/fix the dispenser.

</div>

---

## 6. Class Design (LLD)

```mermaid
classDiagram
    class ATM {
        -String atmId
        -String location
        -ATMState currentState
        -CashDispenser dispenser
        -CardReader cardReader
        +authenticateUser(card, pin)
        +processWithdrawal(amount)
        +checkBalance()
        +ejectCard()
    }

    class CashDispenser {
        -Map~Denomination, Integer~ cashInventory
        +dispenseCash(amount) boolean
        +canDispense(amount) boolean
        +getAvailableDenominations() List
    }

    class CardReader {
        +readCard() CardInfo
        +ejectCard()
        +retainCard()
    }

    class Transaction {
        -String txnId
        -String accountId
        -TransactionType type
        -BigDecimal amount
        -TransactionStatus status
        -LocalDateTime timestamp
    }

    class Account {
        -String accountId
        -BigDecimal balance
        -String pin
        +debit(amount) boolean
        +credit(amount) boolean
        +getBalance() BigDecimal
    }

    ATM --> CashDispenser
    ATM --> CardReader
    ATM --> Transaction
    Transaction --> Account
```

### Cash Dispensing Algorithm

```java
// Greedy algorithm — use largest denominations first
public Map<Integer, Integer> calculateDenominations(int amount) {
    int[] denominations = {2000, 500, 200, 100};
    Map<Integer, Integer> result = new LinkedHashMap<>();

    for (int denom : denominations) {
        int available = cashInventory.getOrDefault(denom, 0);
        int needed = amount / denom;
        int used = Math.min(needed, available);

        if (used > 0) {
            result.put(denom, used);
            amount -= used * denom;
        }
    }

    if (amount > 0) {
        throw new InsufficientCashException("ATM cannot dispense exact amount");
    }
    return result;
}
```

<div class="callout-interview">

**Q: "What if the ATM has ₹500 notes but the user wants ₹300?"**

The ATM should check if it CAN dispense the exact amount before deducting from the account. If the smallest denomination is ₹500 and the user wants ₹300, show "Amount must be a multiple of ₹500" BEFORE processing. Never deduct first and figure out dispensing later.

</div>

---

## 7. Security Considerations

| Threat | Mitigation |
|--------|-----------|
| PIN interception | End-to-end encryption (ATM to bank), PIN block encryption using 3DES/AES |
| Card skimming | EMV chip cards (not magnetic stripe), jitter on card reader |
| Physical tampering | Tamper sensors, ink-staining cash on forced entry |
| Replay attacks | Unique transaction ID + timestamp + nonce for every request |
| Man-in-the-middle | TLS 1.3 with certificate pinning |
| Brute force PIN | Lock card after 3 failed attempts, retain card |

<div class="callout-tip">

**Applying this** — In your design, always mention that the PIN is NEVER stored or transmitted in plain text. It's encrypted at the keypad hardware level using a Hardware Security Module (HSM). The bank only receives an encrypted PIN block and validates it against the stored hash.

</div>

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A bank's ATM network sees a cluster of complaints: "account debited, no cash dispensed." Investigation shows the cash dispenser jammed after the core banking system approved and debited the withdrawal, and the ATM's reversal message was lost because the network dropped at the same moment. **Decision**: Reversals must be **durable and retried**: the ATM writes the failed-dispense event to its local journal before anything else, retries the reversal message until acknowledged (idempotent by transaction reference), and the bank runs end-of-day reconciliation of switch/host logs vs the ATM's electronic journal and cash counters. Any mismatch auto-creates a dispute case and credits the customer within the regulatory turnaround time.

</div>

<div class="callout-scenario">

**Scenario**: Criminals attach a skimmer to an ATM's card slot and a pinhole camera above the keypad. **Decision**: Defense in depth across hardware and software: EMV chip transactions (cloned magstripe data alone is less useful), anti-skimming devices on the card reader, keypad shields, encrypted PIN pads (the PIN is encrypted inside the keypad hardware and never exists in plain text in the ATM's software), host-side fraud detection on unusual withdrawal patterns, and tamper sensors that take the ATM out of service and alert operations.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** List the states of an ATM session from card insertion to completion.

<details>
<summary>Show answer</summary>

`IDLE → CARD_INSERTED → PIN_ENTRY → AUTHENTICATED → TRANSACTION_SELECTED → PROCESSING → (DISPENSING) → PRINTING_RECEIPT → EJECTING_CARD → IDLE`, plus error states: `CARD_RETAINED` (too many wrong PINs or a hot-listed card), `OUT_OF_SERVICE` (cash out, hardware fault, tamper), and timeouts that eject the card and return to `IDLE`.

</details>

**L2.** Why does the ATM never verify the PIN itself?

<details>
<summary>Show answer</summary>

The ATM is an untrusted field device. The PIN is encrypted in the PIN pad (hardware security module) into a PIN block and sent to the issuer's host, which verifies it in its own HSM. Keeping verification at the bank means a compromised ATM can't reveal or validate PINs offline, and wrong-attempt counts are tracked centrally per card.

</details>

**L3.** In what order should the ATM perform debit and dispense, and why?

<details>
<summary>Show answer</summary>

Authorize (and hold/debit) with the host first, then dispense, then confirm completion. Dispensing first risks giving out cash for an unauthorized or insufficient-funds account. The cost of this order is the "debited but not dispensed" case, which is handled with a reversal message and reconciliation — a recoverable software problem, unlike cash already handed over.

</details>

### 🟡 Medium — Apply it

**M1.** Design the dispense logic to give ₹4,700 with cassettes of ₹2,000, ₹500, and ₹100 notes, each with limited counts.

<details>
<summary>Show answer</summary>

Try denominations from largest to smallest, taking `min(count available, remaining / denomination)` of each (2 × ₹2,000, 1 × ₹500, 2 × ₹100). Greedy works for this set, but with limited counts or other denominations it can fail where a solution exists (e.g., ₹600 with only ₹500 and ₹200 notes: greedy takes ₹500 then can't make ₹100, while 3 × ₹200 works). A robust implementation falls back to a small bounded search/DP over counts when greedy fails, and validates the amount is dispensable before authorizing with the host.

</details>

**M2.** Model the classes for an ATM in Java (LLD).

<details>
<summary>Show answer</summary>

`ATM` (context, holds current `ATMState`), `ATMState` interface with `insertCard`, `enterPin`, `selectTransaction`, `cancel` implemented by `IdleState`, `CardInsertedState`, `AuthenticatedState`, etc. (State pattern). Hardware abstractions: `CardReader`, `PinPad`, `CashDispenser` (with `Cassette` per denomination), `ReceiptPrinter`. `BankService` interface (authorize, confirm, reverse) so the host can be mocked. `Transaction` hierarchy: `Withdrawal`, `BalanceInquiry`, `Deposit`, `Transfer`. `DispenseStrategy` for note selection. An `ElectronicJournal` logs every step for reconciliation.

</details>

**M3.** What happens if the customer doesn't take the cash within 30 seconds?

<details>
<summary>Show answer</summary>

Many ATMs **retract** the cash into a reject/retract bin, record it in the electronic journal, and send a reversal or "partial/zero dispense" notification to the host so the account is credited back, subject to reconciliation (cash counters vs journal). Some banks and regions disable retraction due to fraud (thieves exploiting it) and instead rely on cameras and reconciliation. Either way it's a state with a timeout, a journal entry, and a host message.

</details>

### 🔴 High — Think like a senior

**H1.** The ATM loses its connection to the bank for 10 minutes. Should it still dispense cash?

<details>
<summary>Show answer</summary>

Generally no: without host authorization there's no PIN verification or balance check, so the ATM goes out of service for withdrawals (perhaps allowing nothing at all). Some networks support **stand-in processing** — the card network or acquirer approves within issuer-set limits when the issuer host is unreachable, then sends advice messages later — but that's a network-level decision with fraud limits, not the ATM deciding alone. Messages in flight when the link dropped must be reconciled with reversals once connectivity returns.

</details>

**H2.** Design the reconciliation process between ATMs, the switch, and core banking.

<details>
<summary>Show answer</summary>

Three sources: the ATM's electronic journal and cassette counters, the switch's transaction log, and core banking postings. Daily (and on cash replenishment): match by transaction reference and amount; classify unmatched items (approved at host but no dispense, dispensed but no posting, duplicates, partial dispenses). Auto-resolve well-understood categories (e.g., debited + journal shows dispense failure → credit customer), queue the rest for operations with evidence. Check physical cash: starting load − dispensed per journal = remaining count at replenishment. Track metrics: unmatched rate per ATM (a high rate signals hardware faults or fraud), average resolution time against regulatory deadlines.

</details>

## 🛠️ Mini Project — ATM Simulator with State Pattern

**Goal**: A clean, testable LLD you can walk through in an interview. 2-3 evenings.

**Build**

1. Java 17+ console or Spring Boot app: `ATM` context with State pattern classes, `CashDispenser` with cassettes, `DispenseStrategy` (greedy with bounded-search fallback), and a `BankService` interface with an in-memory implementation (accounts, PINs hashed, daily limit, wrong-PIN counter).
2. Flows: withdrawal, balance inquiry, PIN change, cancel at any step, card retention after 3 wrong PINs, out-of-cash state.
3. Failure injection: `CashDispenser` can jam; the ATM must send a reversal and journal it; the bank applies reversals idempotently.
4. Electronic journal + a reconciliation job that compares journal vs bank postings and reports mismatches.
5. Unit tests for every state transition, the dispense algorithm (including cases greedy fails), and duplicate reversal messages.

**Acceptance criteria**: a state diagram in the README matching the code, 100% of transitions tested, and a reconciliation report showing zero unexplained mismatches after a randomized simulation with injected jams.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What happens during a transaction timeout — money deducted but ATM didn't get the response?"**

The ATM sends the withdrawal request and starts a timer (say 30 seconds). If no response arrives, the ATM shows "Transaction could not be completed" and ejects the card WITHOUT dispensing cash. On the bank side, the transaction is in PENDING state. A reconciliation service runs every 5 minutes — it finds PENDING transactions where the ATM never confirmed dispensing, and auto-reverses them. The customer sees the amount credited back within 5-30 minutes. For immediate resolution, the customer can call the bank and the support team can see the PENDING status and trigger manual reversal.

**Follow-up trap**: "What if the response was sent but the ATM's network dropped before receiving it?" → This is why the bank marks it PENDING, not COMPLETED. The ATM must explicitly confirm "cash dispensed" for the transaction to be marked COMPLETED. No confirmation = auto-reversal.

</div>

<div class="callout-interview">

**Q: "How do you handle concurrent withdrawals from the same account at two different ATMs?"**

Database-level row locking. When ATM-1 initiates a withdrawal, the transaction service does `SELECT balance FROM accounts WHERE id = X FOR UPDATE`. This acquires an exclusive lock on that row. If ATM-2 tries to withdraw simultaneously, its query blocks until ATM-1's transaction commits or rolls back. This ensures the balance check and deduction are atomic. At scale, I'd use optimistic locking with version numbers — `UPDATE accounts SET balance = balance - 5000, version = version + 1 WHERE id = X AND version = 42`. If the version doesn't match, retry.

</div>

<div class="callout-interview">

**Q: "How would you design the ATM to work during network outages?"**

Offline mode with limits. The ATM stores a local cache of recently authenticated cards with their encrypted PINs and a pre-approved offline withdrawal limit (e.g., ₹5,000). During network outage, the ATM authenticates locally, allows withdrawals up to the offline limit, and queues transactions locally. When network restores, it syncs all queued transactions with the bank. The risk is that the account might be overdrawn if the user withdrew at multiple offline ATMs. Banks accept this risk for small amounts and reconcile later. The offline limit is configurable per card/account.

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| State Machine | Every ATM interaction follows defined states and transitions |
| PENDING Transaction | Deducted but not yet confirmed dispensed — auto-reverses if unconfirmed |
| FOR UPDATE | SQL row lock to prevent concurrent modifications |
| HSM | Hardware Security Module — encrypts PIN at hardware level |
| Reconciliation | Background job that detects and fixes stuck transactions |
| Denomination Algorithm | Greedy approach — largest notes first |
| Offline Mode | Limited transactions cached locally during network outage |
| Card Retention | Card kept by ATM after 3 failed PIN attempts |

---

> **An ATM is a trust machine — it must guarantee that every rupee deducted from your account ends up in your hand, or back in your account. There is no third option.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Extra case study — state machines plus reconciliation, the same pair ShopNorth uses for orders and payment settlements.

**Continue the story:** [Chapter 3 · Low-Level Design](/tutorials/journey-03-low-level-design) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
