# Admin / Supporting Surfaces Interaction Integrity Report

Generated: 2026-03-22T01:56:41.365Z
Tier: tier3
Surface key: admin_support

## Summary
- Controls audited: 4
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| campaign_selector (Campaign selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId scoped shell context | state.campaignId | none | none |
| office_selector (Office selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId scoped shell context | state.officeId | none | none |
| reach_override_mode_selector (Reach capacity override mode selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.twCapOverrideMode | none | none |
| reach_override_enabled_toggle (Reach override enabled toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.twCapOverrideEnabled | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
