# Design Traffic Control System — The Orchestra Conductor Analogy

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Design — low-level design** · Extra case study for [Chapter 3 · Low-Level Design](/tutorials/journey-03-low-level-design)

</div>
<!-- sdlc-stage:end -->

## The Orchestra Conductor Analogy

A traffic control system is like an orchestra conductor. Each intersection is a musician, each road is an instrument. The conductor must ensure no two instruments clash (no two green lights conflict), maintain rhythm (timing cycles), and adapt to the audience (traffic volume). A bad conductor causes chaos — a bad traffic system causes accidents.

---

## 1. Requirements

### Functional
- Control traffic lights at intersections (RED, YELLOW, GREEN)
- Ensure no conflicting directions get GREEN simultaneously
- Support timed cycles and sensor-triggered changes
- Emergency vehicle override (all RED except emergency path)
- Pedestrian crossing signals

### Non-Functional
- **Safety**: NEVER show GREEN for conflicting directions — this is life-critical
- **Real-time**: Light changes must happen within milliseconds
- **Fault tolerance**: Default to flashing RED (all-way stop) on failure
- **Scalability**: Support thousands of intersections in a city

---

## 2. State Machine — The Core Design

```mermaid
stateDiagram-v2
    [*] --> NS_Green
    NS_Green --> NS_Yellow: Timer (30s)
    NS_Yellow --> AllRed1: Timer (5s)
    AllRed1 --> EW_Green: Timer (2s)
    EW_Green --> EW_Yellow: Timer (30s)
    EW_Yellow --> AllRed2: Timer (5s)
    AllRed2 --> NS_Green: Timer (2s)

    note right of AllRed1: Safety buffer<br/>All directions RED<br/>for 2 seconds
    note right of NS_Green: North-South GREEN<br/>East-West RED
```

<div class="callout-warn">

**Warning**: The ALL-RED phase between transitions is non-negotiable. It accounts for vehicles that entered the intersection during YELLOW. Skipping it causes accidents. Typical duration: 1-3 seconds depending on intersection size.

</div>

---

## 3. Smart Traffic — Sensor-Based Adaptation

```mermaid
flowchart TB
    subgraph Sensors
        S1[Induction Loop<br/>Detects vehicles]
        S2[Camera<br/>Counts queue length]
        S3[Pedestrian Button]
        S4[Emergency Vehicle<br/>Detector]
    end

    subgraph Controller
        SM[State Machine]
        TA[Traffic Analyzer]
        EP[Emergency Priority]
    end

    S1 --> TA
    S2 --> TA
    S3 --> SM
    S4 --> EP
    TA -->|Adjust timing| SM
    EP -->|Override| SM
```

### Adaptive Timing Algorithm

```java
public int calculateGreenDuration(IntersectionData data) {
    int baseGreen = 30; // seconds
    int queueLength = data.getVehicleCount();
    int waitingTime = data.getMaxWaitTime();

    // Extend green if heavy traffic
    if (queueLength > 20) baseGreen += 15;
    else if (queueLength > 10) baseGreen += 8;

    // Cap at 60 seconds to prevent starvation
    return Math.min(baseGreen, 60);
}
```

<div class="callout-scenario">

**Scenario**: It's 2 AM. North-South road has zero traffic. East-West has one car waiting. Fixed timer would make that car wait 30 seconds for no reason. **Decision**: Use sensor-triggered mode at night — light stays GREEN for the direction with traffic. Changes only when a vehicle is detected on the other road. Saves fuel, reduces wait times, and is safer (less temptation to run red lights).

</div>

---

## 4. Emergency Vehicle Override

```mermaid
sequenceDiagram
    participant EV as Emergency Vehicle
    participant Det as Detector (500m range)
    participant Ctrl as Controller
    participant Lights as Traffic Lights

    EV->>Det: Siren + GPS signal detected
    Det->>Ctrl: Emergency approaching from NORTH
    Ctrl->>Lights: ALL RED immediately
    Note over Lights: 2-second safety buffer
    Ctrl->>Lights: NORTH = GREEN, all others RED
    EV->>Det: Vehicle passed intersection
    Det->>Ctrl: Emergency cleared
    Ctrl->>Lights: Resume normal cycle
```

<div class="callout-tip">

**Applying this** — In a real system, emergency preemption uses either optical sensors (detecting strobe lights) or GPS-based systems (vehicle broadcasts its position). The controller creates a "green wave" — turning multiple consecutive intersections green along the emergency route. This can reduce emergency response times by 20-30%.

</div>

---

## 5. Conflict Matrix — Safety Guarantee

The conflict matrix defines which signal phases can NEVER be green simultaneously:

| | North Straight | North Left | East Straight | East Left | Pedestrian N-S | Pedestrian E-W |
|---|---|---|---|---|---|---|
| **North Straight** | - | ✅ | ❌ | ❌ | ❌ | ✅ |
| **North Left** | ✅ | - | ❌ | ❌ | ❌ | ❌ |
| **East Straight** | ❌ | ❌ | - | ✅ | ✅ | ❌ |
| **East Left** | ❌ | ❌ | ✅ | - | ❌ | ❌ |

✅ = Can be green together | ❌ = CONFLICT — never green together

```java
// Safety check before ANY state transition
public boolean isSafeTransition(SignalPhase newPhase, Set<SignalPhase> currentGreen) {
    for (SignalPhase active : currentGreen) {
        if (conflictMatrix[active.ordinal()][newPhase.ordinal()]) {
            return false; // CONFLICT — block this transition
        }
    }
    return true;
}
```

<div class="callout-info">

**Key insight**: The conflict matrix is the ULTIMATE safety net. Even if the software has a bug, the hardware controller checks the conflict matrix before energizing any green signal. If a conflict is detected, the system goes to flashing RED (fail-safe mode). This is a hardware-level guarantee, not just software.

</div>

---

## 6. Centralized City-Wide Control

```mermaid
graph TB
    subgraph Central["Traffic Management Center"]
        TMC[Central Controller]
        AI[AI Traffic Optimizer]
        DASH[Dashboard / Monitoring]
    end

    subgraph Intersections
        I1[Intersection 1]
        I2[Intersection 2]
        I3[Intersection 3]
        I4[Intersection N]
    end

    TMC --> I1
    TMC --> I2
    TMC --> I3
    TMC --> I4
    I1 -->|Sensor data| TMC
    I2 -->|Sensor data| TMC
    AI -->|Optimized timings| TMC
```

**Green Wave**: Coordinate consecutive intersections so a vehicle traveling at the speed limit hits all green lights. This requires synchronizing cycle offsets across intersections on the same corridor.

---

<!-- practice-pack -->

## 🏢 Real-World Scenarios

<div class="callout-scenario">

**Scenario**: A city upgrades intersections to cloud-managed controllers. During an internet outage, several intersections lose their timing plans and drop into all-red, causing kilometres of gridlock. **Decision**: Safety and basic operation must be **local**: each controller stores its timing plans and runs autonomously; the cloud only pushes plan updates and collects telemetry. On any fault, the controller falls back to a safe local plan or flashing mode (flashing yellow for the main road, flashing red for the side road), and a hardware conflict monitor — independent of the software — prevents conflicting greens regardless of what the controller software does.

</div>

<div class="callout-scenario">

**Scenario**: An ambulance stuck at a red light loses 90 seconds per intersection on a cross-city run. **Decision**: Emergency vehicle preemption: the ambulance broadcasts its approach (GPS-based or optical/radio emitters); controllers on the route end conflicting phases safely (after minimum green and the yellow/all-red clearance — never instantly), give green to the ambulance's approach, then return to normal cycles with recovery logic. All preemptions are logged for audit.

</div>

## 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Why can't a light go straight from green to red, and why is there an "all-red" interval?

<details>
<summary>Show answer</summary>

Drivers need a yellow (change) interval to stop safely or clear the intersection — its length depends on approach speed. The all-red (clearance) interval gives vehicles that entered on yellow time to clear the intersection before conflicting traffic gets green. Both are safety constraints that every state transition must respect, including emergency preemption.

</details>

**L2.** What is a conflict matrix?

<details>
<summary>Show answer</summary>

A table of which movements (e.g., north-south through, east-west left turn, pedestrian crossings) can be green at the same time. The controller only selects phases made of compatible movements, and the hardware conflict monitor checks the actual signal outputs against it — if two conflicting greens ever appear, it forces the intersection into flashing mode.

</details>

**L3.** Name the difference between fixed-time, actuated, and adaptive signal control.

<details>
<summary>Show answer</summary>

**Fixed-time**: preset cycle lengths and splits by time of day. **Actuated**: sensors (loops, cameras) extend or skip phases based on detected vehicles — no green for an empty turn lane. **Adaptive**: a central or distributed system continuously adjusts timing across corridors based on measured flows (e.g., SCOOT, SCATS), optimizing for delay, stops, or coordination.

</details>

### 🟡 Medium — Apply it

**M1.** Model the intersection controller as a state machine in Java (LLD).

<details>
<summary>Show answer</summary>

`Phase` (set of compatible `Movement`s, min green, max green, yellow, all-red durations), `SignalState` (GREEN, YELLOW, ALL_RED per phase), `Controller` with a `PhaseSequence` and a tick-based state machine: `GREEN(phase) → YELLOW(phase) → ALL_RED → GREEN(nextPhase)`. A `PhaseSelector` strategy (fixed-time, actuated using `Detector` inputs) picks the next phase. A `ConflictMonitor` validates every output against the `ConflictMatrix`. Special modes: `PreemptionMode`, `FlashMode`, `ManualMode`. Inject a `Clock` so tests can simulate time.

</details>

**M2.** Design "green wave" coordination along a corridor of 8 intersections.

<details>
<summary>Show answer</summary>

Use a common cycle length for all intersections and set each intersection's offset (start of its main green relative to a shared reference time) to the travel time from the previous intersection at the target speed (distance / speed). Controllers need synchronized clocks (GPS or NTP) and the same cycle. Two-way corridors require compromise offsets (or favor the peak direction by time of day). Measure with travel-time data and adjust.

</details>

**M3.** A vehicle detector gets stuck "on" (always detects a car). What happens, and how do you handle it?

<details>
<summary>Show answer</summary>

An actuated controller keeps extending that phase to max green every cycle, so the other approaches wait longer than necessary and capacity is wasted. (The opposite fault, stuck "off", is worse for that movement: it may never get green at all.) Detect faults with plausibility checks (continuously occupied for longer than a threshold, no gaps all day, or no actuations for hours) → mark the detector failed, switch that movement to "recall" (behave as if demand always exists with fixed timing), and raise a maintenance alert.

</details>

### 🔴 High — Think like a senior

**H1.** Design the city-wide platform for 2,000 intersections: monitoring, plan deployment, and adaptive control.

<details>
<summary>Show answer</summary>

Edge: autonomous controllers with local plans, conflict monitors, and an agent that streams telemetry (phase changes, detector counts, faults) over MQTT or a standard like NTCIP/SNMP to the central system. Central: ingestion (Kafka), a time-series store for counts and phase logs, a traffic management dashboard, alerting on faults, and an optimization service that computes timing plans (corridor-level) from measured flows. Plan deployment is versioned, signed, validated against each intersection's conflict matrix and minimum timings before push, rolled out gradually, and controllers keep the previous plan for rollback. Security: network segmentation, mutual TLS, no direct internet exposure of controllers.

</details>

**H2.** Pedestrians complain they wait too long at a busy junction, while drivers complain about congestion. How do you decide the timing trade-off?

<details>
<summary>Show answer</summary>

Define the objective explicitly with stakeholders: minimize total person-delay (not just vehicle delay — a bus carries 50 people), with maximum wait caps for pedestrians and safety constraints (pedestrian walk + clearance times based on crossing distance and walking speed). Measure current delays per mode, simulate alternatives (e.g., in SUMO), then pilot: shorter cycles reduce pedestrian waits but add lost time per cycle; leading pedestrian intervals improve safety. Publish the results and revisit by time of day.

</details>

## 🛠️ Mini Project — Intersection Controller Simulator

**Goal**: A safety-first state machine with tests that prove it. 2-3 evenings.

**Build**

1. Java model: movements, conflict matrix, phases with min/max green, yellow, all-red; a tick-based controller with an injectable `Clock`.
2. Strategies: fixed-time and actuated (simulated detectors generating random arrivals).
3. Conflict monitor that throws (and switches to flash mode) if conflicting greens ever occur.
4. Emergency preemption: request from an approach → safe transition (respect min green and clearance) → green for the emergency approach → recovery.
5. Property-based tests (jqwik or randomized loops): over 1 million simulated seconds with random detector input and preemptions, no conflicting greens and no transition skipping yellow/all-red.
6. Optional: visualize the intersection in a simple web page or terminal UI.

**Acceptance criteria**: zero safety-property violations in randomized tests; average vehicle delay reported for fixed vs actuated control.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "What happens in the worst case where the system shows GREEN for conflicting directions?"**

This is a life-safety scenario. The system has multiple layers of protection: (1) **Software layer** — conflict matrix check before every transition. (2) **Hardware layer** — a Conflict Monitor Unit (CMU) is a separate hardware device that continuously monitors signal outputs. If it detects conflicting greens, it immediately forces ALL signals to flashing RED and disconnects the controller. (3) **Fail-safe default** — if the controller crashes or loses power, signals default to flashing RED (all-way stop). The CMU is independent of the controller software — even if the software is completely compromised, the hardware prevents dangerous states.

**Follow-up trap**: "Can you guarantee this with just software?" → No. Safety-critical systems always have hardware interlocks. Software can have bugs. The CMU is a simple, proven circuit that's been used for decades. It's the last line of defense.

</div>

<div class="callout-interview">

**Q: "How would you design this using design patterns?"**

I'd use the **State Pattern** for the traffic light states (Green, Yellow, Red, FlashingRed). Each state knows its duration and the next state. The **Observer Pattern** for sensors notifying the controller of vehicle detection. The **Strategy Pattern** for different timing algorithms (fixed timer, adaptive, emergency override). The **Command Pattern** for queuing and executing signal changes. This makes the system extensible — adding a new signal phase or sensor type doesn't require modifying existing code.

</div>

<div class="callout-interview">

**Q: "How do you determine the optimal timing for each phase?"**

Webster's formula is the classic approach: optimal cycle length = (1.5L + 5) / (1 - Y), where L is total lost time and Y is the sum of critical flow ratios. In practice, modern systems use reinforcement learning — the AI observes queue lengths, wait times, and throughput, then adjusts timings to minimize total delay. Google's Project Green Light uses AI to optimize traffic signals and has reduced stops by 30% and emissions by 10% at pilot intersections. The key metric is **intersection delay** — the average time a vehicle waits at the intersection.

</div>

---

## Quick Reference

| Concept | One-Liner |
|---------|-----------|
| Phase | A set of non-conflicting signal indications shown together |
| Cycle | One complete sequence of all phases |
| All-Red | Safety buffer where all directions are RED |
| Conflict Matrix | Defines which phases can never be green simultaneously |
| CMU | Hardware device that prevents conflicting greens |
| Green Wave | Synchronized signals for continuous flow on a corridor |
| Preemption | Emergency vehicle override of normal signal timing |
| Actuation | Sensor-triggered signal changes vs fixed timer |

---

> **A traffic control system's #1 job isn't moving cars faster — it's making sure no one dies. Safety first, efficiency second.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Extra case study — a safety-first state machine; ShopNorth makes illegal order transitions impossible in the same way.

**Continue the story:** [Chapter 3 · Low-Level Design](/tutorials/journey-03-low-level-design) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
