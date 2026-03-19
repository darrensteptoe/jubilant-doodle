# Core-Safe Boundary

Date: 2026-03-18
Scope: Rebuild governance contract for FPE V3 architecture work.

## Purpose
Lock the boundary between sacred model math and rebuildable orchestration/UI/data layers so we can keep shipping in-order without corrupting deterministic engine behavior.

## Sacred Core (Freeze)
These modules are treated as sacred and must not be rewritten during rebuild work unless a critical correctness defect requires it:

- `js/core/model.js`
- `js/core/monteCarlo.js`
- `js/core/winMath.js`
- `js/core/turnout.js`
- `js/core/rng.js`

Additional stability expectation:

- Existing deterministic output contracts and golden behavior must remain intact.

## Canonical Calculation Rule

- New calculations must live in canonical modules (`js/core/*` or dedicated runtime state modules), never in render glue.
- Formulas must not be duplicated across files.
- If a value already exists in canonical state/module output, reference it; do not recreate it.
- V3 surfaces render, format, and dispatch actions. They do not own model math.

## Rebuildable Layers (Allowed Change Surface)
The following layers are intentionally rebuildable and can evolve as long as they respect the sacred-core boundary:

- App state shape and normalization (`js/app/state.js`, `js/app/defaultState.js`, `js/app/normalizeLoadedState.js`)
- Context and persistence scoping (`js/storage.js`, `js/app/activeContext.js`, operations context/store modules)
- Operations schema/role modeling (`js/features/operations/*`, `js/operations*.js`, `js/organizer.js`)
- Template/archetype system (`js/app/templateRegistry.js`, `js/app/templateResolver.js`, assumptions wiring)
- Governance/confidence/reporting composition (`js/core/modelGovernance.js`, `js/core/confidence.js`, view helpers)
- Targeting feature/scoring pipeline (`js/core/targetFeatureRegistry.js`, `js/core/targetFeatureEngine.js`, `js/core/targetModels.js`)
- Budget/channel-cost modeling (`js/core/channelCosts.js`, optimizer integration modules)
- Learning/audit substrate (`js/core/forecastArchive.js`, `js/core/modelAudit.js`, `js/core/learningLoop.js`)
- V3 shell and surface composition (`js/app/v3/*`, stage ownership/mounting)

## Test Gates

### Sacred Gates (Must Stay Green)

- `node js/core/selfTest.js`
- `node js/core/selfTestSuites/rebuildContracts.js`
- `npm run check:canonical-math`
- `npm run build`
- One-command gate runner: `npm run gate:rebuild`
- Release gate runner: `npm run gate:release`

These are release-blocking for rebuild work touching canonical contracts.

### Expansion Suites (Must Expand Over Time)

- `js/core/selfTestSuites/rebuildContracts.js`:
  - context scoping
  - operations role rollups
  - template/archetype behavior
  - governance/confidence outputs
  - targeting pipeline
  - channel-cost and optimizer objective paths
  - voter-data layer contracts
  - learning/audit contracts
- Focused suite modules (for targeted subsystems), including:
  - `js/core/selfTestSuites/targeting.js`
  - `js/core/selfTestSuites/voterDataLayer.js`
  - `js/core/selfTestSuites/censusPhase1.js`

## Voter Data Placement Rule (Phase 0.5 Alignment)
Voter-file integration is foundational infrastructure, not a side project. It belongs as canonical input infrastructure for targeting/governance/uplift and follows:

- import broad, persist narrow
- canonical identity + geography + decision-useful fields only
- no warehouse-style raw-field parity goal

Canonical source:

- `js/core/voterDataLayer.js`

## Change Control
When a change crosses this boundary, default action is:

1. move/implement math in a canonical module first,
2. update runtime bridge/state wiring second,
3. keep surface/render files calculation-light,
4. add/extend rebuild-contract tests for the new canonical behavior.
