# Turnout Interaction Integrity Report

Generated: 2026-03-23T22:40:13.930Z
Tier: tier1
Surface key: turnout

## Summary
- Controls audited: 3
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| support_turnout_threshold_controls (Support turnout threshold controls) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.turnoutBaselinePct\|state.turnoutTargetOverridePct | none | none |
| turnout_mode_selector (GOTV mode selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.gotvMode | none | none |
| turnout_diminishing_toggle (Diminishing returns toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.gotvDiminishing | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
