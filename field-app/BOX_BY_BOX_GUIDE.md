
# Box-by-Box Guide

This is the operational “how to use every box” guide, with the *why* behind each field.

## 1) Scenario setup

**Purpose:** establish the planning context so every downstream assumption has a consistent frame.

### Race template vs office level

- **Race template**
  - What it does: sets planning defaults and guidance language.
  - What it does *not* do: it does not change core deterministic math, Monte Carlo behavior, optimizer math, or scenario compare math.
  - Correct usage: start from the closest honest race context, then override where local evidence is stronger.
- **Office level**
  - Why it matters: office level changes uncertainty posture, persuadable headroom assumptions, early-vote expectations, and how cautiously leadership should read toplines.
  - Core principle: a statewide race is not just a bigger district race.

### Race setup explainer (exact app language)

“Templates set planning defaults and guidance language. They do not change core math. Use them to start from a realistic race context, then override where local evidence justifies it.”

### Why statewide executive differs from district federal

- **Governor / Statewide Executive**
  - Broader and more uneven coalition map.
  - More regional variance and vote-mode asymmetry.
  - Greater risk of “safe topline, weak regional depth.”
- **U.S. House / Congressional**
  - Usually more geographically legible.
  - Easier to segment and monitor district performance.
  - Still volatile, but less map-wide heterogeneity than statewide executive.

### Band width by office type (planning default, not truth)

- City / Municipal Executive: `2 / 4 / 6`
- City / Municipal Legislative: `2 / 4 / 6`
- Countywide: `3 / 5 / 8`
- State House: `3 / 5 / 8`
- State Senate: `3 / 6 / 9`
- U.S. House / Congressional: `4 / 6 / 10`
- Governor / Statewide Executive: `5 / 8 / 12`
- U.S. Senate / Statewide Federal: `5 / 8 / 12`
- Judicial / Other: `4 / 7 / 11`

### What band width means

- `bandWidth` is uncertainty spread around turnout baseline, not vote share.
- Wider does not mean pessimistic; it means honest variance framing.
- Narrower does not mean better; it means stronger certainty claims, which require stronger evidence.

### When to tighten defaults

- Tighten when polling quality is high, vote history is stable, execution is disciplined, and regional signal is strong.
- Tighten only when those conditions hold together, not when leadership pressure prefers a cleaner narrative.

### When to widen defaults

- Widen when environment volatility is high, coalition stability is weak, vote-mode behavior is shifting, or regional certainty is thin.
- Widening is often the correct move before major reallocations.

### Other setup fields

- **Election date / weeks remaining**
  - What it does: determines time remaining and drives timeline feasibility.
  - Why: a plan is only meaningful relative to time constraints.
- **Mode**
  - What it does: selects expected vs conservative handling for uncertainty (depends on your UI mode).
  - Why: you need to distinguish “best estimate” from “risk-aware estimate.”

## 2) Universe

**Purpose:** define the population and scale. Everything (votes, cost per vote, plan size) depends on it.

- **Universe basis**
  - Examples: registered voters, expected voters, likely voters.
  - Why: picking the wrong basis makes every output misleading.
- **Universe size**
  - Why: vote counts scale linearly; being off by 20% changes plan size by 20%.
- **Source note**
  - Why: if you revisit later, you need to remember whether the number came from voter file, SOS, or a guess.

## 3) Persuasion universe

**Purpose:** define what fraction of the universe is persuadable.

- **Persuasion %**
  - Why: persuasion has a ceiling. Without it, plans pretend you can persuade everyone.
- **Early vote expectation**
  - Why: early vote reduces what remains “movable” late. It shapes the remaining universe.

## 4) Candidates & vote landscape

**Purpose:** establish baseline support and undecided distribution.

- Candidate rows (name + baseline share)
  - Why: you must start from a baseline; otherwise “net vote gains” have no anchor.
- **Undecided %**
  - Why: persuasion usually targets undecided first; this is the pool.
- **Undecided mode / user split**
  - Why: undecided handling is one of the biggest hidden assumptions in field planning.
  - Common options:
    - proportional allocation
    - break late against you
    - user-defined split

## 5) Turnout baseline (last two comparable cycles)

**Purpose:** encode turnout reality using historical anchors.

- **Turnout A / Turnout B**
  - Why: single-cycle turnout can be an outlier; two anchors give a realistic band.
- **Bandwidth / expected**
  - Why: forces you to acknowledge uncertainty instead of assuming one turnout number.

## 6) Win path (Expected)

**Purpose:** the core dashboard: where are you now, what do you need.

Outputs typically include:
- win threshold
- your expected votes / share
- persuasion votes needed
- status indicators (ahead/behind)

Why this box exists:
- It keeps every downstream plan tied to one question:
  “How many votes do we need, and which lever is cheapest/feasible?”

## 7) Sensitivity (what moves the outcome)

**Purpose:** tell you which assumption is driving the result most.

Why:
- It prevents false certainty.
- It tells you what to measure first in real life (contact rate, persuasion rate, turnout).

## 8) Explainability

**Purpose:** translate the model into words you can use with a client or internal team.

Why:
- A plan that can’t be explained is a plan that can’t be trusted or executed.

## 9) Assumptions snapshot

**Purpose:** freeze key parameters so you can compare runs and detect drift.

Why:
- People tweak numbers and forget what changed. This box prevents that.

## 10) Warnings & guardrails

**Purpose:** catch invalid states and “looks plausible but impossible” plans.

Why:
- The most dangerous failures are silent failures.
- Guardrails are cheaper than debugging a bad plan mid-campaign.

## 11) Budget inputs (Phase 4)

**Purpose:** turn tactics into dollars and net votes.

Typical fields:
- budgets (total and/or by bucket)
- overhead (optional)
- cost per attempt per tactic
Why:
- A plan without cost is a wish.

## 12) ROI comparison

**Purpose:** compare tactics on cost per net vote and net votes per $.

Why:
- Prevents “pet tactic bias.”
- Highlights diminishing returns when a tactic hits capacity.

## 13) Turnout / GOTV (Phase 6)

**Purpose:** model turnout lift as a lever.

Why:
- GOTV is often the cheapest late-stage lever when persuasion saturates.

## 14) Optimization (Phase 5)

**Purpose:** find the best mix under constraints.

Why:
- Humans mix poorly under multiple constraints.
- Optimizer makes tradeoffs explicit.

## 15) Snapshot integrity

**Purpose:** ensure an exported scenario re-imports to the same outcome.

Why:
- Without integrity checks, you can’t trust exports across time/versions.

## 16) Timeline / Production (Phase 7)

**Purpose:** cap attempts by physical execution limits before Election Day.

Why:
- Many plans are mathematically correct and operationally impossible.

## 17) Decision Intelligence (Phase 12)

**Purpose:** identify bottlenecks + marginal leverage.

Why:
- Helps choose *what to fix first* (capacity, contact rate, persuasion rate, budget).

## 18) Stress test summary (client style)

**Purpose:** generate a coherent narrative and key KPIs.

Why:
- You want a consistent “executive summary” output that matches the model.

## 19) Validation

**Purpose:** show that inputs are in-range and coherent.

Why:
- Inputs are the #1 source of error in planning tools.

## 20) Conversion + contact math (Phase 2)

**Purpose:** bridge from attempts → contacts → conversions.

Why:
- Attempts are not votes. This box makes that explicit.

## 21) Scenario Compare (Phase 13)

**Purpose:** compare scenarios side-by-side.

Why:
- Field planning is about tradeoffs; comparison makes those tradeoffs visible.
