# C1 Checkpoint — District Shell + Race Context + Electorate

Date: 2026-03-21
Status: **FROZEN**

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

Observed from live bundles `index-DYZ8lHTX.js` (pre-fix) and `index-nMGkFB64.js` (post-fix):
1. Control node identity after blur remains stable for C1 controls in both traces:
   - `v3DistrictV2RaceType`: `replacedSinceReference=false`
   - `v3DistrictV2ElectionDate`: `replacedSinceReference=false`
   - `v3DistrictV2UniverseSize`: `replacedSinceReference=false`
2. Race/Electorate MutationObserver shows option-node churn but no removed control-node subtree replacement (`withRemovedNodes=0`).
3. Root cause was confirmed and fixed:
   - live District bridge path threw `ReferenceError: cleanText is not defined` on `setFormField`
   - this prevented canonical updates and caused controls to re-sync to unchanged defaults
   - this was **not** caused by DOM node replacement
4. Post-fix trace parity is green:
   - RaceType persists (`state_leg` → `federal`)
   - ElectionDate persists (`""` → `2030-11-05`)
   - UniverseSize persists (`0` → `111`)
   - no C1 snap-back observed after blur in trace output

## C1 Scorecard

- canonical read source clean: **YES**
- in-place sync clean (ordinary edit path): **YES**
- DOM identity preserved on blur: **YES**
- structural rerender isolated in C1 controls: **YES**
- value persistence parity in live browser path: **YES**
- subsystem frozen: **YES**

## Next action before C2

C1 is frozen. Proceed to C2 only (District Ballot + Candidate History) with the contained cleanse method.
