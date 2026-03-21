# Plan / Optimizer Interaction Integrity Report

Generated: 2026-03-21T08:04:07.216Z
Tier: tier1
Surface key: plan_optimizer

## Summary
- Controls audited: 4
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| known_live_update_control_plan_mode (Plan mode selector live update) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.budget.optimize.mode | none | none |
| plan_objective_selector (Plan objective selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.budget.optimize.objective | none | none |
| plan_tl_objective_selector (Plan timeline objective selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.budget.optimize.tlConstrainedObjective | none | none |
| plan_timeline_toggle (Timeline module toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.timelineEnabled | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
