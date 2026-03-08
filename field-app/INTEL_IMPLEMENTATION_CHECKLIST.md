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
7. [x] TypeScript + Vite migration (last)
   - Phase A: add Vite build/dev pipeline. ✅
     - `/Users/anakinskywalker/Downloads/field-app-40/package.json`
     - `/Users/anakinskywalker/Downloads/field-app-40/vite.config.js`
     - `/Users/anakinskywalker/Downloads/field-app-40/tsconfig.json` (`allowJs` + `checkJs` scaffolding)
   - Phase B: staged TS migration bottom-up from `core/*`. (completed for JS+JSDoc typing contract)
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
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/timelineOptimizer.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/optimize.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/optimizer.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/risk.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/snapshot.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestGate.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/importPolicy.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/migrate.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/marginalValue.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/sensitivitySurface.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/importQuality.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/intelState.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/decisionIntelligence.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/fixtures.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/monteCarlo.js`
      - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
      - `/Users/anakinskywalker/Downloads/field-app-40/js/core/winMath.js`
     - extended `@ts-check` typing to app-state/engine boundary modules:
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/state.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/normalizeLoadedState.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/modelInput.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/selectors.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/effectiveInputs.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/featureFlags.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/assumptionsProfile.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/backupRecovery.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/candidateUi.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/diagnosticsRuntime.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/scenarioLockUi.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/debugBundle.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/dailyLog.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/forecastDates.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/statePatch.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/assumptionsViewHelpers.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/composeSetupStage.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/normalizeStageLayout.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/scenarioRegistry.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/scenarioState.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionScaffold.js` (shim typing)
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionScaffoldState.js` (shim typing)
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionSessionActions.js` (shim typing)
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionSessionBindings.js` (shim typing)
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionSessionRender.js` (shim typing)
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionSessionSummary.js` (shim typing)
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/decisionSummaryRender.js` (shim typing)
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/diagnosticsBuilders.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/scenarioCompareHelpers.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/stateNormalizationHelpers.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/themeMode.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/uiStageHelpers.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/uiText.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/twCapHelpers.js`
     - completed app-layer `@ts-check` coverage sweep:
       - all `/Users/anakinskywalker/Downloads/field-app-40/js/app/**/*.js` files now include `// @ts-check` (0 remaining without header).
     - completed global JS `@ts-check` coverage sweep:
       - all `/Users/anakinskywalker/Downloads/field-app-40/js/**/*.js` files now include `// @ts-check` (0 remaining without header).
     - added shared core type declarations:
        - `/Users/anakinskywalker/Downloads/field-app-40/js/core/types.d.ts`
   - completion note:
     - Vite pipeline is active and `checkJs` coverage is now complete across `/Users/anakinskywalker/Downloads/field-app-40/js/**/*.js` with shared `.d.ts` contracts.
     - Full physical `.js` -> `.ts` file renaming/transpile migration is intentionally deferred to a separate future project track to avoid runtime-path churn during active feature hardening.
   - post-completion tighten-ups (completed):
     - split oversized orchestrator entry files into facade + runtime implementation modules:
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app.js` -> `/Users/anakinskywalker/Downloads/field-app-40/js/appRuntime.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEvents.js` -> `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsRuntime.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/app/intelControls.js` -> `/Users/anakinskywalker/Downloads/field-app-40/js/app/intelControlsRuntime.js`
     - removed root core shim layer and standardized imports to `js/core/*` (deleted 18 compatibility re-export files).
     - split self-test hardening blocks into dedicated suites with aggregator runner:
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/phase115A.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
       - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js` remains canonical runner.
     - tightened TypeScript check config (non-breaking):
       - `/Users/anakinskywalker/Downloads/field-app-40/tsconfig.json` (`forceConsistentCasingInFileNames`, `noFallthroughCasesInSwitch`, `skipLibCheck`).

## Phase 12: District + Election data contract foundation (in progress)
Execution order for MIT precinct + Census integration begins here.

1. [x] Add scenario-level district data contract module:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtData.js`
   - introduces `useDistrictIntel`, `dataRefs`, `geoPack`, `districtIntelPack` defaults + normalizers.
2. [x] Wire contract defaults/normalization across all state entry points:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/defaultState.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/state.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/normalizeLoadedState.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/migrate.js`
3. [x] Expose district data contract validator via engine snapshot facade:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
4. [x] Enforce district data contract checks during import and backup restore:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsRuntime.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/backupRecovery.js`
5. [x] Add release-hardening self-tests for migration + normalization of district data contract:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
6. [x] Add formal schema artifact for tooling/reference:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/schemas/districtData.v1.schema.json`
7. [x] Add boundary/crosswalk catalog scaffold + quality gates (contract layer only):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtData.js`
   - `dataCatalog.boundarySets[]`, `dataCatalog.crosswalks[]`
   - enforced gates for `pinned_verified`: verified crosswalk + coverage/unmatched/drift thresholds.
8. [x] Add dataset-catalog + ingest/join scaffolding (contract layer only):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtData.js`
   - `dataCatalog.censusDatasets[]`, `dataCatalog.electionDatasets[]` + pinned verification/coverage gates.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtIngest.js` (manifest normalize/validate adapters).
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/precinctCensusJoin.js` (deterministic weighted allocation + reconciliation).
   - self-tests in `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`.
9. [x] Add Data Source Registry layer (latest/verified deterministic view):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/dataSourceRegistry.js`
   - exposes normalized registry + policy resolver (`manual`, `pinned_verified`, `latest_verified`) for dataset/boundary/crosswalk IDs.
   - exposed via `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js` snapshot facade.
10. [x] Add Area Resolver contract + deterministic cache keying scaffold:
    - `/Users/anakinskywalker/Downloads/field-app-40/js/core/areaResolver.js`
    - canonical area selection normalization (type/FIPS/district/resolution).
    - deterministic cache key includes `type + id + boundarySetId + boundaryVintage + resolution`.
    - derived context helper resolves boundary vintage via registry for stable cache identity.
    - self-tests added in `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`.
11. [x] Wire policy behavior into runtime import/restore with fallback messaging:
    - `/Users/anakinskywalker/Downloads/field-app-40/js/app/dataRefPolicyRuntime.js`
    - import and backup-restore paths now apply `latest_verified` resolver before district-contract validation.
    - fallback notes are surfaced through import warning banner messaging.
    - pinned/manual paths remain strict and do not rewrite explicit refs.
12. [x] Add targeted tests for boundary vintage mismatch + latest→pinned materialization:
    - boundary mismatch detection covered via `/Users/anakinskywalker/Downloads/field-app-40/js/core/areaResolver.js`.
    - `latest_verified` to pinned materialization helper in `/Users/anakinskywalker/Downloads/field-app-40/js/core/dataSourceRegistry.js`.
    - regression tests added in `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`.

## Phase 13: MIT precinct + Census evidence compiler (in progress)
Execution order for the first functional district-evidence layer.

1. [x] Add deterministic district evidence compiler (contract + linkage + candidate totals):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtEvidence.js`
   - emits:
     - precinct↔GEO linkage rows (`precinctToGeo`)
     - weighted candidate vote totals/shares (`candidateTotals`)
     - per-GEO merged election+census rows (`geoRows`)
     - competitiveness/persuasion signal (`persuasionSignal`).
2. [x] Expose compiler through engine snapshot facade:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
3. [x] Add release-hardening self-tests for deterministic rollups + persuasion signal derivation:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
4. [x] Add Stage 9 read-only District Evidence panel wired to compiler output:
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html` (`intelDistrictEvidenceCard`)
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/summaryRenderController.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
5. [x] Bind district evidence input selection to active `dataRefs` (deterministic resolver):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtEvidenceInputs.js`
   - exposed via `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js` snapshot facade.
   - used by `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js` with inline-input fallback.
   - regression tests in `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`.
6. [x] Add deterministic similar-race election dataset compatibility ranking (for MIT precinct selection):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/dataSourceRegistry.js`
   - adds `scoreElectionDatasetCompatibility(...)` and `rankElectionDatasetsForScenario(...)`.
   - `latest_verified` election fallback now prefers compatibility-ranked verified datasets before generic latest fallback.
   - metadata pass-through added for election datasets (`officeType`, `raceType`, `electionDate`, `cycleYear`) via:
     - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtIngest.js`
     - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtData.js`
   - exposed via `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js` snapshot facade.
   - regression tests in `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`.
7. [x] Surface deterministic election-data selection status in Stage 9 (read-only):
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html` (`intelDistrictEvidenceSelectedElection`, `intelDistrictEvidenceDatasetRankTbody`)
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
   - shows selected election dataset, compatibility rank position, and top compatible alternatives without mutating math/state.
8. [x] Add Stage 9 deterministic data-ref controls (mode + refs + pin workflow):
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html` (`intelDataRefMode`, `intelDataRefBoundarySet`, `intelDataRefCrosswalkVersion`, `intelDataRefCensusDataset`, `intelDataRefElectionDataset`, `btnIntelDataRefSelectTopElection`, `btnIntelDataRefsPin`)
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsRuntime.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsOrchestrator.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/types.d.ts`
   - behavior:
     - deterministic selector population from `dataCatalog` registry,
     - explicit `dataRefs` updates from Stage 9 controls,
     - one-click "top compatible election" selection,
     - one-click `latest_verified` materialization to `pinned_verified` via engine snapshot contract.
9. [x] Connect District Intel assumptions into runtime planning inputs (toggle + generator):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtIntelBuilder.js`
     - adds deterministic pack builder from district evidence:
       - `buildDistrictIntelPackFromEvidence(...)`
     - adds runtime adapters:
       - `applyDistrictIntelRateOverrides(...)`
       - `applyDistrictIntelCapacityOverrides(...)`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes builder/adapters through snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/selectors.js`
     - applies district-intel rate override to effective SR path.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/effectiveInputs.js`
     - applies district-intel capacity override to effective org/doors path.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsRuntime.js`
     - adds Stage 9 controls:
       - `Use district-intel assumptions` toggle
       - `Generate assumptions` action
       - status + summary readouts for generated pack.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
     - adds regression tests covering builder output bounds and toggle-driven application behavior.
10. [x] Add Stage 9 per-GEO layer table (candidate margin visibility by census GEO):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtEvidence.js`
     - adds `summarizeGeoEvidenceLayers(...)` deterministic helper for GEO-level vote/margin rows.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes `summarizeGeoEvidenceLayers` via snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - renders read-only GEO rows (votes, top candidate, margin, precinct-links, data flags).
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
     - adds regression test for deterministic GEO summary ranking + margin fields.
11. [x] Add deterministic election narrowing filters for similar-race selection:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtData.js`
     - extends `dataRefs` contract with:
       - `electionStrictSimilarity`
       - `electionMaxYearDelta`
       - `electionMinCoveragePct`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/dataSourceRegistry.js`
     - compatibility scoring/ranking now supports deterministic filter constraints.
     - `latest_verified` resolver applies these filters when selecting fallback election datasets.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsRuntime.js`
     - adds Stage 9 controls for strict similarity, max cycle gap, and min coverage.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
     - adds regression test verifying filter-constrained ranking + resolver behavior.
12. [x] Add active data-ref alignment diagnostics (boundary/crosswalk/census/election coherence):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/dataSourceRegistry.js`
     - adds `diagnoseDataRefAlignment(...)` with deterministic warnings for:
       - missing refs,
       - boundary-crosswalk mismatch,
       - dataset boundary mismatch,
       - election year-gap/filter violations,
       - low coverage signals.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes alignment diagnostics through snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - renders alignment summary + detail lines in Stage 9.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
     - adds regression test for mismatch/year-gap warning behavior.
13. [x] Add dataset freshness diagnostics for selected refs (age-days + stale warnings):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/dataSourceRegistry.js`
     - `diagnoseDataRefAlignment(...)` now reports selected metadata with `ageDays` and stale/no-refresh warnings.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - Stage 9 alignment detail now surfaces per-source age (`Boundary/Crosswalk/Census/Election Nd`).
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
     - adds deterministic freshness-age regression coverage via fixed `nowIso`.
14. [x] Upgrade Stage 9 election compatibility table with explicit year-gap + coverage columns:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/dataSourceRegistry.js`
     - ranking rows now include `yearGap`, `targetYear`, `datasetYear`, and `coveragePct`.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - table now shows year-gap and coverage alongside compatibility score.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
     - asserts rank metadata fields for deterministic compatibility output.
15. [x] Add Stage 9 read-only centroid map layer for GEO verification (no turf cutting):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtEvidence.js`
     - adds deterministic centroid extraction + `buildGeoEvidenceMapLayer(...)`.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes map-layer builder through snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - renders read-only SVG centroid map and explicit unavailable-state messaging.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
     - adds deterministic coverage for map-layer points/bounds and missing-centroid behavior.
16. [x] Add Stage 9 precinct-layer vote summary (precinct↔GEO relationship visibility):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtEvidence.js`
     - adds deterministic `summarizePrecinctEvidenceLayers(...)`.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes precinct-layer summary through snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - renders read-only precinct table (votes, top candidate, margin, mapped GEO count, district weight, top GEO links).
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
     - adds deterministic regression coverage for precinct-layer ordering and weight math.
17. [x] Add Stage 9 deterministic area + resolution controls with resolver-key visibility:
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
     - adds Area Type, Resolution, State/District/County/Place IDs, and area label controls.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - renders active normalized area context + deterministic resolver cache key and notes.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsRuntime.js`
     - wires area/resolution events, normalizes IDs, and marks district-intel assumptions stale on area changes.
18. [x] Add Stage 9 GEO opportunity ranking table (read-only targeting cue):
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtEvidence.js`
     - adds deterministic `summarizeGeoOpportunityLayers(...)` (composite score from competitiveness + vote mass + density proxy).
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes GEO opportunity summarizer through snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - renders read-only rank table (opportunity, competitiveness, vote mass, density, margin, reasons).
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
     - adds deterministic regression coverage for opportunity ordering + reason tags.
19. [x] Add Stage 9 JSON ingest controls for MIT/Census manifests + evidence rows:
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
     - adds manifest/evidence import controls and ingest status line in District Evidence card.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/wireEventsRuntime.js`
     - validates/imports Census and Election manifests into `dataCatalog` via engine snapshot helpers.
     - imports crosswalk/precinct/census rows into `geoPack.district.evidenceStore` keyed by active refs (or inline fallback).
     - marks district-intel pack stale after evidence-row changes for deterministic regeneration flow.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes district-ingest manifest normalize/validate/catalog-entry helpers via snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - disables manifest import buttons when ingest helpers are unavailable in engine snapshot.
20. [x] Add deterministic evidence-input summary readout for active refs:
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/districtEvidenceInputs.js`
     - adds `summarizeDistrictEvidenceInputs(...)` with source mode, row counts, readiness, and notes.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/engine.js`
     - exposes input-summary helper via snapshot facade.
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - renders active input summary line (mode + election/crosswalk/census counts) with ready/warn/muted status.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTest.js`
     - adds deterministic tests for ready and missing-layer summary behavior.
21. [x] Add district-intel provenance alignment visibility + warning guard:
   - `/Users/anakinskywalker/Downloads/field-app-40/index.html`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/ui/els.js`
   - `/Users/anakinskywalker/Downloads/field-app-40/js/app/renderIntelChecks.js`
     - shows explicit alignment line and warns when generated pack provenance differs from active refs.
   - `/Users/anakinskywalker/Downloads/field-app-40/js/core/selfTestSuites/releaseHardening.js`
     - adds deterministic contract warning test for provenance drift.
