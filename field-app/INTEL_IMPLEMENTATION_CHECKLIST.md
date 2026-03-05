# Intel + Calibration Implementation Checklist

This is the execution order for the calibration/governance expansion.

## Phase 0: Governance lock (done)
- [x] Add governance contract doc.
  - `/Users/anakinskywalker/Downloads/field-app-40/MODEL_GOVERNANCE.md`

## Phase 1: Snapshot centralization
- [ ] Add canonical planning snapshot function:
  - target: `/Users/anakinskywalker/Downloads/field-app-40/js/core/electionSnapshot.js`
- [ ] Add canonical execution snapshot function:
  - target: `/Users/anakinskywalker/Downloads/field-app-40/js/core/executionSnapshot.js`
- [ ] Refactor render entrypoint to compute `snap` once and fan out to renderers:
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
- [ ] Shock scenario sampling toggle using `shockScenarios`.

## Phase 5: Capacity realism toggle
- [ ] Apply `capacityDecayEnabled` and `decayModel` in capacity snapshot pipeline.

## Phase 6: Feedback loop
- [ ] Ingest observed metrics.
- [ ] Compute drift and rank primary divergence.
- [ ] Produce non-destructive recommendations/draft patches.

## Phase 7: AI assistance (strictly non-math writes)
- [ ] Scenario summary brief.
- [ ] Scenario diff brief.
- [ ] Drift explanation brief.
- [ ] Sensitivity interpretation brief.

## Phase 8: Governance workflow
- [ ] Scenario lock/unlock flow.
- [ ] Critical change note requirement.
- [ ] Export bundle includes audit + calibration notes.

## Phase 9: Tests
- [ ] Snapshot equivalence across panels.
- [ ] No-UI-math guard (lint/grep gate).
- [ ] AI write-constraint schema validation.
- [ ] Seeded MC reproducibility guard.
