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

## Phase 10: Architecture hardening (in progress)
- [x] Canonicalize budget-shape guard into one shared helper:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/state.js` (`ensureBudgetShape`)
  - reused by:
    - `/Users/anakinskywalker/Downloads/field-app-40/js/app/normalizeLoadedState.js`
    - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEvents.js`
- [x] Clarify normalize naming at app entrypoint:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`
  - local wrapper renamed to `normalizeLoadedScenarioRuntime(...)` to distinguish from module normalizer.
- [x] Extract Operations Capacity Outlook orchestration from `app.js` into dedicated module and wire through controller:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/operationsCapacityOutlook.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`
- [x] Extract debug bundle assembly/copy from `app.js` into dedicated module:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/debugBundle.js`
  - wrapper retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Document root re-export layer as compatibility-only and set canonical import policy:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/IMPORT_PATH_POLICY.md`
  - shim headers added across root compatibility exports in `/Users/anakinskywalker/Downloads/field-app-40/js/*.js`
- [x] Remove stale HTML scar tissue file:
  - deleted `/Users/anakinskywalker/Downloads/field-app-40/index-original.html`
- [x] Extract backup/recovery orchestration from `app.js` into dedicated controller:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/backupRecovery.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Extract candidate table/select/split rebuild UI orchestration from `app.js`:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/candidateUi.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Extract diagnostics/error-capture runtime orchestration from `app.js`:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/diagnosticsRuntime.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Extract scenario lock UI/domain guard logic from `app.js`:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/scenarioLockUi.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Collapse twCap helper passthrough wrappers in `app.js` into a single adapter map:
  - direct helper wiring to `/Users/anakinskywalker/Downloads/field-app-40/js/app/operationsCapacityOutlook.js` controller
  - removed duplicated local passthrough function set from `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`.
- [x] Extract shared text/visibility DOM helpers out of `app.js`:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/uiText.js`
  - `app.js` now imports these helpers instead of defining local duplicates.
- [x] Extract effective-input compiler and decay parsing from `app.js` into dedicated module:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/effectiveInputs.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Extract Monte Carlo stale/hash state handlers from `app.js` into dedicated controller:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/mcState.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Extract scenario/decision orchestration block from `app.js` into dedicated controller:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/scenarioDecisionController.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Extract Monte Carlo envelope/freshness orchestration block from `app.js` into dedicated controller:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/mcEnvelopeController.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring.
- [x] Extract Monte Carlo run/runtime orchestration (run-now + legacy/named-args adapter) from `app.js`:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/mcRuntimeController.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` for existing wiring/signatures.
- [x] Extract dev/self-test patched-state helper from `app.js`:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/statePatch.js`
  - wrapper retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`.
- [x] Extract planning runtime adapters from `app.js` (need-votes/capacity wrappers + stage render orchestrators):
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/planningRuntimeController.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`.
- [x] Extract weekly execution/runtime helper block from `app.js`:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/executionWeeklyController.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`.
- [x] Extract execution/risk panel orchestration block from `app.js` (E1–E6 + rolling calibration actions):
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/executionRiskController.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`.
- [x] Extract summary render orchestration block from `app.js` (stress/validation/assumptions/guardrails + assumptions view helpers):
  - `/Users/anakinskywalker/Downloads/field-app-40/js/app/summaryRenderController.js`
  - wrappers retained in `/Users/anakinskywalker/Downloads/field-app-40/js/app.js`.

## Phase 11: A-grade structural backlog (deferred until Phase 0-10 complete)
Execution order below is fixed and must be followed in sequence.

1. [x] Delete orphaned runtime landmines
   - `/Users/anakinskywalker/Downloads/field-app-40/js/wireEvents.js` already absent; verified no active import-path references.
2. [x] Doc artifact cleanup
   - normalized absolute local paths in `/Users/anakinskywalker/Downloads/field-app-40/js/features/operations/README.md`.
3. [x] Consolidate micro-file clusters
   - Monte Carlo app cluster consolidated into `/Users/anakinskywalker/Downloads/field-app-40/js/app/monteCarloApp.js`.
   - Decision-session cluster consolidated into `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionSessionApp.js`.
   - Legacy micro-file paths kept as compatibility shims to preserve import stability.
4. [x] JSDoc type the `ctx` pattern
   - introduced shared app-layer context contracts in `/Users/anakinskywalker/Downloads/field-app-40/js/app/types.d.ts`.
   - added `@ts-check` and typed `@param` context annotations across `ctx` entry modules (`wireEvents*`, render/init/bindings/runtime adapters).
5. [x] Expand self-test coverage for currently under-tested core modules
   - added deterministic coverage for `winMath`, `rng`, `robust`, `explainMap`, `importQuality`, and `executionPlanner` in `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`.
6. [x] Formalize Operations/Engine seam
   - added `OperationsCapacityInput` contract + validator in:
     - `/Users/anakinskywalker/Downloads/field-app-40/js/features/operations/io.js` (`validateOperationsCapacityInput`)
   - enforced seam validation at compiler handoff:
     - `/Users/anakinskywalker/Downloads/field-app-40/js/app/effectiveInputs.js`
   - added self-test coverage for seam validity + engine acceptance:
     - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
7. [ ] TypeScript + Vite migration (last)
   - Phase A: add Vite build/dev pipeline. ✅
     - `/Users/anakinskywalker/Downloads/field-app-40/package.json`
     - `/Users/anakinskywalker/Downloads/field-app-40/vite.config.js`
     - `/Users/anakinskywalker/Downloads/field-app-40/tsconfig.json` (`allowJs` + `checkJs` scaffolding)
   - Phase B: staged TS migration bottom-up from `core/*`. (in progress)
     - added `@ts-check` + JSDoc typing on core foundation modules:
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/utils.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/rng.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/modelInput.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/voteProduction.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/explainMap.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/confidenceEnvelope.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/hash.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/turnout.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/universeLayer.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/budget.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/executionPlanner.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/robust.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/timeline.js`
      - added shared core type declarations:
        - `/Users/anakinskywalker/Downloads/field-app-40/js/core/types.d.ts`
