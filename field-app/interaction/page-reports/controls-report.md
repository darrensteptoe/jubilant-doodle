# Controls Interaction Integrity Report

Generated: 2026-03-23T22:40:13.930Z
Tier: tier1
Surface key: controls

## Summary
- Controls audited: 2
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| manual_intelligence_selector (Manual intelligence selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.intelState.uiSelections.auditId\|benchmarkRef | none | none |
| intel_brief_kind_selector (Intel brief kind selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.intelState.uiSelections.briefKind | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
