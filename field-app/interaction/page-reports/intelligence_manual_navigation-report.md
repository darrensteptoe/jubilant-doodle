# Intelligence / Manual Navigation Interaction Integrity Report

Generated: 2026-03-21T05:42:54.314Z
Tier: tier3
Surface key: intelligence_manual_navigation

## Summary
- Controls audited: 2
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| intelligence_model_mode_tab (Intelligence model mode tab) | PASS | PASS | PASS | PASS | PASS | PASS | none | state.ui.intelligence.mode\|state.ui.intelligence.modelId | none | none |
| nav_stage_tab (Navigation stage tab) | PASS | PASS | PASS | PASS | PASS | PASS | localStorage:ui-stage | localStorage:fpe-ui-v3-stage::{campaignId::officeId} + query.stage | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
