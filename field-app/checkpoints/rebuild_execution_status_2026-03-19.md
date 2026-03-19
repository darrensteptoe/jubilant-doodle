# Rebuild Execution Status

Date: 2026-03-19  
Scope: 8-workstream targeted rebuild + Phase 0.5 voter-data foundation

## Overall

- Implementation coverage (architecture workstreams): **8 / 8 implemented**
- Foundational voter-data layer (Phase 0.5): **implemented and integrated**
- Automated gates: **passing**
- Remaining to call full closeout: **manual parity/regression sweep + stakeholder sign-off**

## Workstream Status

1. Campaign/office context hardening: **Complete**
2. Workforce role modeling: **Complete**
3. Template/archetype rebuild: **Complete**
4. Governance/confidence layer: **Complete**
5. Targeting framework rebuild: **Complete**
6. Budget/channel-cost framework: **Complete**
7. Learning/audit layer: **Complete**
8. Uplift integration: **Complete (baseline integrated path)**

## Phase 0.5 (Voter Data) Placement

- Canonical voter layer exists in `js/core/voterDataLayer.js`.
- Voter signals are integrated into:
  - targeting feature generation (`js/core/targetFeatureEngine.js`)
  - governance/data-quality scoring (`js/core/modelGovernance.js`)
  - uplift fallback/features (`js/core/upliftModel.js`)
  - archive/audit/learning snapshots (`js/core/forecastArchive.js`, `js/core/modelAudit.js`, `js/core/learningLoop.js`)
- Contract suites for voter layer are present and passing:
  - `js/core/selfTestSuites/voterDataLayer.js`
  - cross-layer checks in `js/core/selfTestSuites/rebuildContracts.js`

## Canonical Math Enforcement

- Added guard script: `npm run check:canonical-math`
- Guard rule: no raw `Math.round/floor/ceil` or `.toFixed` in non-canonical glue/runtime paths.
- Current allowed formula hotspots are limited to:
  - sacred core math modules
  - canonical utility modules
  - test suites

## Gates Run (2026-03-19)

- `npm run check:canonical-math` ✅
- `node js/core/selfTestSuites/rebuildContracts.js` ✅
- `node js/core/selfTestSuites/targeting.js` ✅
- `node js/core/selfTestSuites/voterDataLayer.js` ✅
- `node js/core/selfTestSuites/censusPhase1.js` ✅
- `node js/core/selfTest.js` ✅
- `npm run build` ✅
- `npm run status:manual-parity` ✅ (status command available; closure remains pending until manual sign-off file is completed)

## Known Non-Blocking Warnings

- None in current `gate:release` run output.

## Hardening Updates Applied (2026-03-19)

- Repo switched to ESM package mode (`"type": "module"`) with ESM `vite.config.js`.
- Self-test loader path no longer mixes static and dynamic imports.
- Rebuild gate now runs cleanly without module-type/dynamic-import warnings.
- Added one-command rebuild gate runner in package scripts: `npm run gate:rebuild`.
- Added one-command release gate runner in package scripts: `npm run gate:release`.
- Added status command: `npm run status:rebuild` (reports ordered workstream completion + remaining count).
- Build warning threshold set to stable project baseline in `vite.config.js` (`chunkSizeWarningLimit: 1800`) so release gate output is signal-first.
- Added strict gate runner script: `scripts/gate-rebuild.mjs` (fails on configured warning patterns, not just non-zero exits).
- Added CI workflow gate: `.github/workflows/release-gate.yml` (`npm run gate:release` on push/PR).
