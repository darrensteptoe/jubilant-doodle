# C1 Checkpoint — District Shell + Race Context + Electorate

Date: 2026-03-21
Status: **NOT FROZEN** (manual parity failure remains)

## Scope
- District shell wrapper
- Race Context editable controls
- Electorate editable controls

## What changed in C1 pass

1. Codified subsystem contract docs:
   - `checkpoints/render-control-contract.md`
   - `checkpoints/render-cleanse-inventory.md`
2. Added/extended render contract tests for C1 controls:
   - `js/app/v3/surfaces/district/renderLifecycle.contract.test.js`
3. Added in-place sync contract checks in tests for:
   - bind-once semantics
   - no ordinary structural rerender in Race Context/Electorate sync paths
   - identity trace hook presence

## Automated test results (C1-relevant)

- `npm run check:render-lifecycle-contract` → PASS (5/5)
- `node --test js/core/selectors/districtRaceContextPersistence.test.js js/core/selectors/districtV2.persistence.test.js js/core/selectors/districtReplacementCards.persistence.test.js` → PASS (21/21)
- `npm run check:district-integrity` → PASS
- `npm run check:interaction-integrity` → PASS
- `npm run check:contracts` → PASS
- `npm run build` → PASS

## Browser/manual parity trace (headless live bundle)

Artifacts:
- `checkpoints/render-cleanse-c1-district-dom-trace.log`
- `checkpoints/render-cleanse-c1-district-dom-summary.json`

Observed from live bundle `index-DYZ8lHTX.js`:
1. Control node identity after blur remains stable for C1 controls:
   - `v3DistrictV2RaceType`: `replacedSinceReference=false`
   - `v3DistrictV2ElectionDate`: `replacedSinceReference=false`
   - `v3DistrictV2UniverseSize`: `replacedSinceReference=false`
2. Race/Electorate MutationObserver shows option-node churn but no removed control-node subtree replacement (`withRemovedNodes=0`).
3. Persistence parity still fails in live trace auto-probe:
   - attempted RaceType `federal` reverts to `state_leg`
   - attempted ElectionDate `2030-11-05` reverts to empty
   - attempted UniverseSize `111` reverts to `0`

## C1 Scorecard

- canonical read source clean: **YES**
- in-place sync clean (ordinary edit path): **YES**
- DOM identity preserved on blur: **YES**
- structural rerender isolated in C1 controls: **YES**
- value persistence parity in live browser path: **NO**
- subsystem frozen: **NO**

## Next action before C2

Keep C1 active and identify overwrite cause after action dispatch for Race Context/Electorate values (value overwrite without node replacement). Do not advance to C2 until C1 persistence parity is green.

