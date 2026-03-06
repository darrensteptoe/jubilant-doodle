# Intel + Calibration Implementation Checklist

This is the execution order for the calibration/governance expansion.

## Phase 0: Governance lock (done)
- [x] Add governance contract doc.
  - `/Users/anakinskywalker/Downloads/field-app-40/MODEL_GOVERNANCE.md`

## Phase 1: Snapshot centralization
- [x] Add canonical planning snapshot function:
  - target: `/Users/anakinskywalker/Downloads/field-app-40/js/core/electionSnapshot.js`
- [x] Add canonical execution snapshot function:
  - target: `/Users/anakinskywalker/Downloads/field-app-40/js/core/executionSnapshot.js`
- [x] Refactor render entrypoint to compute `snap` once and fan out to renderers:
  - target: `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderMain.js`

## Phase 2: Intel state schema (done - foundation)
- [x] Add runtime intel defaults + normalizer:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/intelState.js`
- [x] Add default-state plumbing:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/defaultState.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/state.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/normalizeLoadedState.js`
- [x] Add migration support:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/migrate.js`
- [x] Add formal JSON Schema draft:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/schemas/intelState.v1.schema.json`

## Phase 3: Benchmarks + evidence credibility
- [x] Benchmarks UI and warnings sourced from `intelState.benchmarks`.
- [x] Evidence requirement flow for critical input changes.
- [x] Calibration source brief generator.

## Phase 4: MC calibration toggles
- [x] Distribution toggle (`triangular` default, optional `uniform`/`normal`).
- [x] Correlated shocks toggle using `correlationModels`.
- [x] Shock scenario sampling toggle using `shockScenarios`.

## Phase 5: Capacity realism toggle
- [x] Apply `capacityDecayEnabled` and `decayModel` in capacity snapshot pipeline.

## Phase 6: Feedback loop
- [x] Ingest observed metrics.
- [x] Compute drift and rank primary divergence.
- [x] Produce non-destructive recommendations/draft patches.

## Phase 7: AI assistance (strictly non-math writes)
- [x] Scenario summary brief.
- [x] Scenario diff brief.
- [x] Drift explanation brief.
- [x] Sensitivity interpretation brief.
- [x] What-if request parser writes `intelRequests` metadata only (no core math mutation).

## Phase 8: Governance workflow
- [x] Scenario lock/unlock flow.
- [x] Critical change note requirement.
- [x] Export bundle includes audit + calibration notes.

## Phase 9: Tests
- [x] Snapshot equivalence across panels.
- [x] No-UI-math guard (lint/grep gate).
- [x] AI write-constraint schema validation.
- [x] Seeded MC reproducibility guard.

## Phase 9.1: Post-phase architecture cleanup
- [x] Collapse stale duplicate render modules into compatibility wrappers so only one implementation path remains:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/render/optimization.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/render/timeline.js`
