# C7 Checkpoint — App-wide Render Helper Retirement + Legacy UI-path Cleanup

Date: 2026-03-21
Status: **FROZEN**

## Scope
- App-wide helper retirement audit after C1-C6 freezes.
- Legacy editable-path helper classification.
- District completeness gap inventory for missing/deferred modules/features.
- No CSS/layout standardization work in this phase.

## C7 helper retirement/classification

### Safe to remove now (executed)
- Removed dead helper constant `DATA_ACTIONS` from `js/app/v3/surfaces/data/index.js`.
  - Reason: constant had zero runtime references.

### Transitional but still needed
- `js/app/v3/surfaces/district/index.js` compatibility export (`renderDistrictSurface` -> `renderDistrictV2Surface`).
  - Reason: interaction inventory and drift checks still reference this path.
- District compatibility mirror writes in `js/appRuntime.js` (covered by `js/core/selectors/districtMirrorCompatibilityLayer.test.js`).
  - Reason: transitional support for derived summary/model-input/Outcome dependencies until mirror-read migration lands.
- `setInnerHtmlWithTrace(...)` signature-gated structural render in `js/app/v3/surfaces/districtV2/index.js` for ballot/history/census-targeting result tables.
  - Reason: still required for structural row changes (add/remove/result table replacement), not ordinary edit hydration.

### Needs replacement first
- District selector expectations in `js/app/v3/qaGates.js` still target legacy District IDs (for example `#v3DistrictTurnoutA`, `#v3CensusMapShell`).
  - Replacement needed before deleting District compatibility path assumptions.
- `interaction/interaction-inventory.csv` District source-path entries still point to `js/app/v3/surfaces/district/index.js` compatibility path.
  - Replacement needed before retiring District wrapper file.

## District completeness gap inventory
- Full inventory file: `checkpoints/district-v2-completeness-gaps.md`
- Required gaps explicitly captured:
  - Turnout Baseline card missing in District V2 UI (underlying data/action paths still exist).
  - Census map shell/status lane missing in District V2 UI (map status fields still exist in bridge snapshots).
  - VTD map intake/status UI lane missing (overlay toggle remains; ZIP/status lane absent).
  - Census advisory/election preview derived rows exist but are not visibly rendered.
  - Legacy QA selector expectations still target pre-V2 District IDs.

## Commands run and exact results
- `node --test js/app/v3/surfaces/district/renderLifecycle.contract.test.js js/app/v3/surfaces/data/renderLifecycle.contract.test.js js/app/v3/surfaces/outcome/renderLifecycle.contract.test.js js/app/v3/surfaces/warRoom/renderLifecycle.contract.test.js`
  - PASS (20/20)
- `node --test js/core/selectors/districtV2.persistence.test.js js/core/selectors/districtReplacementCards.persistence.test.js js/core/selectors/districtRaceContextPersistence.test.js js/core/selectors/warRoomC5.persistence.test.js js/core/selectors/outcomeV3.persistence.test.js js/core/selectors/dataC6.persistence.test.js`
  - PASS (34/34)
- `npm run check:interaction-integrity`
  - PASS (`total=113 pass=113 fail=0 high_priority_missing=0`)
- `npm run build`
  - PASS (bundle includes `dist/assets/index-yofRi3mO.js`)

## C7 scorecard
- app-wide helper retirement classification complete: **YES**
- safe-now retirements executed: **YES**
- transitional helper map explicit: **YES**
- District completeness gaps documented: **YES**
- verification gates green: **YES**
- C7 frozen: **YES**
