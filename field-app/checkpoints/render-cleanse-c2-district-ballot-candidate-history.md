# C2 Checkpoint — District Ballot + Candidate History

Date: 2026-03-21
Status: **FROZEN**

## Scope
- District Ballot module
- District Candidate History module

## Contained inventory (render/bind/sync)

### Render owners
- `syncDistrictV2Ballot`
- `syncDistrictV2CandidateTable`
- `syncDistrictV2UserSplitTable`
- `syncDistrictV2CandidateHistory`

All in `js/app/v3/surfaces/districtV2/index.js`.

### Binder owners
- `bindDistrictV2BallotHandlers` (delegated `change`/`click` on candidate/user-split regions)
- `bindDistrictV2CandidateHistoryHandlers` (delegated `change`/`click` on history table)

### Sync owners
- In-place sync helpers used by ordinary edit paths:
  - `syncInputControlInPlace`
  - `syncSelectControlInPlace`
  - `syncCheckboxControlInPlace`
- Structural rerender gate:
  - row-signature compare before `setInnerHtmlWithTrace(...)`

## Ordinary-edit rerender/rebind audit
- Ballot ordinary edits:
  - no structural rerender when candidate/user-split row membership is unchanged
  - delegated binders stay one-time and are not reattached in ordinary edits
- Candidate History ordinary edits:
  - no structural rerender when history row membership is unchanged
  - delegated binders stay one-time and are not reattached in ordinary edits

## Tests added/updated for C2

1. Render lifecycle contract tests (`js/app/v3/surfaces/district/renderLifecycle.contract.test.js`)
- `c2 contract: ballot ordinary edits use in-place sync paths after structure gate`
- `c2 contract: candidate history ordinary edits use in-place sync path after structure gate`

2. Persistence tests (`js/core/selectors/districtV2.persistence.test.js`)
- `district_v2 C2 ballot row edits persist with row-level isolation after reopen`
- `district_v2 C2 candidate-history row edits persist with row-level isolation after reopen`

## Command results
- `npm run check:render-lifecycle-contract` -> PASS (7/7)
- `node --test js/core/selectors/districtV2.persistence.test.js js/core/selectors/districtReplacementCards.persistence.test.js js/core/selectors/districtRaceContextPersistence.test.js` -> PASS (23/23)
- `npm run build` -> PASS

## Manual browser parity (headless live bundle)

Artifacts:
- `/tmp/district_c2_browser.log`
- live bundle: `assets/index-CqkKUVYo.js`

Observed:
1. Ballot candidate support probe
- `trace.auto.c2.set` then `trace.auto.c2.post`
- canonical value updates: `35 -> 42.5`
- node identity preserved: `replacedSinceReference=false`

2. Candidate History margin probe
- `trace.auto.c2.set` then `trace.auto.c2.post`
- canonical value updates: `0 -> 2.4`
- node identity preserved: `replacedSinceReference=false`

3. Structural rerender behavior
- candidate-history row add during probe emits mutation with `added=["TR"]` (structural change, allowed)
- no evidence of destructive node replacement for ordinary in-row edits

4. Bridge/runtime health
- no `method_throw` observed in C2 trace

## C2 Scorecard
- canonical read source clean: **YES**
- in-place sync clean for ordinary edits: **YES**
- DOM identity preserved for probed editable row fields: **YES**
- structural rerender isolated to row-structure changes: **YES**
- persistence parity (ballot/history): **YES**
- subsystem frozen: **YES**
