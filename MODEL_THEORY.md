
# Model Theory

This document explains what the Field Path Engine is *actually calculating* and why.

## Core objects

- **Universe**: the population you are modeling (registered voters, likely voters, etc.)
- **Vote share**: baseline support percentages across candidates + undecided
- **Win threshold**: the vote count needed to win (usually 50% + 1 of expected turnout, depending on rules)
- **Levers**:
  - **Persuasion**: converting undecided/opposition to your candidate (net shift)
  - **Turnout / GOTV**: increasing supportive voters who actually vote (net votes)

The app keeps the deterministic backbone so you can answer:
> “If I do X more of tactic Y, what does it do to my win probability or expected margin?”

## Win math (baseline → votes)

Given:
- Expected turnout (or turnout rate × universe size)
- Candidate baseline shares
- Undecided handling rule

The app computes:
- Votes per candidate
- Your vote count and share
- Votes required to reach the win threshold
- Margin and “gap to close”

Why this matters:
- Field plans are only meaningful relative to a **clear gap**.

## Persuasion math (net votes)

Persuasion is modeled as a **net shift** per effective contact:
- Attempts → contacts (contact rate)
- Contacts → conversions (persuasion rate)
- Conversions are treated as net votes gained (accounting for who you are persuading)

Why it’s included:
- It separates *work performed* (attempts) from *work that matters* (net votes).
- It forces realistic planning: you can’t claim 10,000 “attempts” equals 10,000 votes.

## Turnout / GOTV math (lift)

Turnout is modeled using baseline turnout rates and a lift mechanism.
The key is that GOTV produces **additional votes**, not vote share changes in a vacuum.

Why it’s included:
- In many races, persuasion saturates quickly; GOTV can be the cheaper lever.
- It allows mixing persuasion and GOTV in one plan.

## ROI and cost layer

Each tactic has:
- Cost per attempt (or per unit)
- Capacity ceiling (max attempts possible)
- Contact + conversion assumptions

The app derives:
- Cost per net vote
- Net votes per $1,000
- Total cost to close the gap under a given tactic mix

Why it’s included:
- Many “plans” fail because they ignore cost/capacity reality.
- ROI is the bridge between strategy and feasibility.

## Optimization

The optimizer chooses the tactic mix that maximizes net votes (or minimizes cost to hit a target),
subject to:
- budget
- capacity ceilings
- timeline feasibility (optional)

Why it’s included:
- Humans are bad at “knapsack” style mixing under constraints.
- It prevents a plan from over-allocating an impossible tactic.

## Monte Carlo stress testing

When enabled, the app runs many simulations with controlled randomness to see how outcomes vary
under uncertainty (volatility / min-mode-max assumptions).

Why it’s included:
- Expected value can hide risk.
- Planning needs “how often do we win?” not just “what’s the average?”

## Timeline feasibility

Timeline inputs cap attempts by what can realistically be produced before Election Day.

Why it’s included:
- The best ROI plan is useless if it can’t physically be executed.

## Integrity and trust

- Deterministic export guarantees state is reproducible.
- Snapshot hashing detects corruption or drift.
- Self-tests detect regression in the math.

This is the “trust chain” you want before making decisions off the numbers.
