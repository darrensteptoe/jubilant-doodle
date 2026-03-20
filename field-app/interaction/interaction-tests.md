# Phase 12.25.A - Interaction Integrity Test Harness

## Goal
Validate canonical interaction correctness for significant controls:
- population
- state write path
- recompute path
- live render propagation
- persistence/stickiness
- output/report propagation
- legacy-independence

This harness treats non-populating controls and stale live updates as canonical-flow defects.

## Harness Helpers
Implemented in `scripts/interaction-integrity.mjs`:
- `interactionPopulateCheck(...)`
- `interactionStateWriteCheck(...)`
- `interactionRecomputeCheck(...)`
- `interactionRenderCheck(...)`
- `interactionPersistenceCheck(...)`
- `interactionOutputCheck(...)`
- `interactionLegacyDependencyCheck(...)`

## Inventory + Results Artifacts
- Inventory: `interaction/interaction-inventory.csv`
- Results JSON: `interaction/interaction-results.json`
- This matrix: `interaction/interaction-tests.md`

## Run
- Non-strict: `npm run check:interaction-integrity`
- Strict gate: `npm run check:interaction-integrity:strict`
- Page-level tier reports: `npm run check:interaction-pages`

## Failure Classifications
- `NO_OPTIONS`
- `WRONG_OPTIONS`
- `WRONG_STATE_PATH`
- `NO_STATE_WRITE`
- `DUPLICATE_STATE_WRITE`
- `NO_RECOMPUTE`
- `STALE_RENDER`
- `OUTPUT_MISMATCH`
- `LEGACY_DEPENDENCY`
- `NO_PERSISTENCE`
- `WRONG_PERSISTENCE_SCOPE`
- `INVALID_EMPTY_STATE`
- `HIDDEN_SIDE_EFFECT`

## High-Priority Matrix
Legend: `P=pass`, `F=fail`

| control | Pop | State | Recompute | Render | Persistence | Legacy | overall | canonical owner | root cause / failure codes |
|---|---|---|---|---|---|---|---|---|---|
| campaign_selector | P | P | P | P | P | P | PASS | `state.campaignId` | - |
| office_selector | P | P | P | P | P | P | PASS | `state.officeId` | - |
| scenario_selector | P | P | P | P | P | P | PASS | `state.ui.scenarioUiSelectedId` | - |
| template_archetype_dropdown | P | P | P | P | P | P | PASS | `state.raceType` | - |
| targeting_model_dropdown | P | P | P | P | P | P | PASS | `state.targeting.modelId|state.targeting.presetId` | - |
| support_turnout_threshold_controls | P | P | P | P | P | P | PASS | `state.turnoutBaselinePct|state.turnoutTargetOverridePct` | - |
| workforce_role_selector | P | P | P | P | P | P | PASS | `indexeddb:operations.persons[].workforceRole` | - |
| budget_channel_selector | P | P | P | P | P | P | PASS | `state.budget.tactics.doors.kind|phones.kind|texts.kind` | - |
| weather_zip_selector | P | P | P | P | P | P | PASS | `state.warRoom.weather.officeZip|overrideZip|useOverrideZip` | - |
| weather_mode_toggle | P | P | P | P | P | P | PASS | `state.warRoom.weatherAdjustment.mode` | - |
| event_category_selector | P | P | P | P | P | P | PASS | `state.warRoom.eventCalendar.draft.category` | - |
| event_apply_to_model_toggle | P | P | P | P | P | P | PASS | `state.warRoom.eventCalendar.events[].applyToModel` | - |
| report_type_selector | P | P | P | P | P | P | PASS | `state.ui.reporting.request.type` | - |
| manual_intelligence_selector | P | P | P | P | P | P | PASS | `state.intelState.uiSelections.auditId|benchmarkRef` | - |
| known_live_update_control_plan_mode | P | P | P | P | P | P | PASS | `state.budget.optimize.mode` | - |

## Additional Failing Controls (Non-High-Priority)
- none

## Current Summary
From `interaction/interaction-results.json`:
- Total controls checked: `113`
- Pass: `113`
- Fail: `0`
- High-priority represented: `15/15`
- High-priority pass: `15`
- High-priority fail: `0`

## District Focus Follow-Up
- District controls audited in focused page report: `56`
- Targeting controls audited in dedicated page report: `15`
- District + Targeting A-F failures: `0`
- District report artifact: `interaction/district-page-report.md`
- District-specific root-cause fixes applied:
  - canonical setup dropdown option sources (`raceType`, `mode`, `universeBasis`, `undecidedMode`)
  - stale empty-select rehydration handling
  - census state-write persistence (`setField`, `setGeoSelection`) for sticky behavior
  - candidate-history baseline controls fully wired (`populate -> state write -> recompute -> render -> persistence`)

## Tiered Extension (Beyond District)
- Page-level reports generated under: `interaction/page-reports/`
- Tiered index and gate: `interaction/page-reports/README.md`
- Tier 1 interaction-stable (available surfaces): `YES`
- Tier 2 remaining planned-phase fails: `none`

## Exit-Criteria Mapping
- Significant controls inventoried: complete for all currently implemented surfaces.
- High-priority controls tested first: complete.
- Broken controls traced to root cause: complete in matrix + JSON.
- Legacy-dependent controls identified: complete from current inventory state.
- Non-populating/stale controls treated as structural defects: complete (fail classifications).
- Clear pass/fail map: complete (CSV + JSON + matrix + page reports).
