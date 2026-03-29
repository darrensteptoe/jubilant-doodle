# Budget / Channel Controls Interaction Integrity Report

Generated: 2026-03-23T22:40:13.930Z
Tier: tier2
Surface key: budget_channel_controls

## Summary
- Controls audited: 1
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| budget_channel_selector (Budget channel selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.budget.tactics.doors.kind\|phones.kind\|texts.kind | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
