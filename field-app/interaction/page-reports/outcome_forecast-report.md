# Outcome / Forecast Interaction Integrity Report

Generated: 2026-03-20T06:09:49.776Z
Tier: tier1
Surface key: outcome_forecast

## Summary
- Controls audited: 4
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| outcome_mc_mode_selector (Outcome MC mode selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.mcMode | none | none |
| outcome_mc_volatility_selector (Outcome MC volatility selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.mcVolatility | none | none |
| outcome_surface_lever_selector (Outcome surface lever selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.outcomeSurfaceInputs.surfaceLever | none | none |
| outcome_surface_mode_selector (Outcome surface mode selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.outcomeSurfaceInputs.surfaceMode | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
