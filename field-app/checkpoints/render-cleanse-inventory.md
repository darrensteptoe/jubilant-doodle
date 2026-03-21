# Render Cleanse Inventory

Date: 2026-03-21
Program: contained subsystem refresh

## C1 Target (current pass)

### Subsystem
District shell + Race Context + Electorate

### Render owners
- `renderDistrictV2Surface` (`js/app/v3/surfaces/districtV2/index.js`)
- `renderDistrictV2RaceContextCard` (`js/app/v3/surfaces/districtV2/raceContext.js`)
- `renderDistrictV2ElectorateCard` (`js/app/v3/surfaces/districtV2/electorate.js`)

### Binder owners
- `bindDistrictV2FormSelect`
- `bindDistrictV2FormField`
- `bindDistrictV2FormCheckbox`

All in `js/app/v3/surfaces/districtV2/index.js`.

### Sync owners
- `syncDistrictV2RaceContext`
- `syncDistrictV2Electorate`
- shared in-place helpers:
  - `syncSelectControlInPlace`
  - `syncInputControlInPlace`
  - `syncCheckboxControlInPlace`
  - `replaceSelectOptionsInPlace`

### Action/state dependencies
- Action dispatch path: `setDistrictFormField(...)`
- Canonical reads used by shell refresh:
  - `readDistrictTemplateSnapshot`
  - `readDistrictFormSnapshot`
  - `readDistrictControlSnapshot`

### Ordinary edit rerender risk audit (C1)
- Race Context ordinary edit flow:
  - no `setInnerHtmlWithTrace` call in `syncDistrictV2RaceContext`
  - in-place select/input sync only
- Electorate ordinary edit flow:
  - no `setInnerHtmlWithTrace` call in `syncDistrictV2Electorate`
  - in-place input/select/checkbox sync only

### Structural rerender currently outside C1 scope
- Ballot/CandidateHistory row sections (C2 scope)
- Targeting/Census result tables (derived output tables)

## C2 Target (completed)

### Subsystem
District Ballot + Candidate History

### Structural helpers identified
- `syncDistrictV2CandidateTable`
- `syncDistrictV2UserSplitTable`
- `syncDistrictV2CandidateHistory`

Status in tree: signature-gated structural rerender + in-place row value sync.

### C2 ordinary edit rerender/rebind audit
- Ballot:
  - `bindDistrictV2BallotHandlers` uses delegated `change/click` handlers with one-time bind guards.
  - `syncDistrictV2CandidateTable` and `syncDistrictV2UserSplitTable` only call `setInnerHtmlWithTrace` on structure-signature change.
  - ordinary value edits sync existing nodes in place (`syncInputControlInPlace`) with no row-root replacement.
- Candidate History:
  - `bindDistrictV2CandidateHistoryHandlers` uses delegated `change/click` handlers with one-time bind guards.
  - `syncDistrictV2CandidateHistory` only calls `setInnerHtmlWithTrace` on structure-signature change.
  - ordinary row edits sync existing inputs/selects/checkboxes in place.

### C2 parity outcome
- C2 trace auto-probe confirms:
  - ballot candidate support edit updates canonical and keeps same node identity.
  - candidate-history margin edit updates canonical and keeps same node identity.
  - no bridge throw in C2 edit flow.

## C3 Target (completed)

### Subsystem
District Census + Targeting editable controls

### Status
Frozen (2026-03-21)

### Editable sync owners
- `syncDistrictV2Targeting`
- `syncDistrictV2Census`
- binders: `bindDistrictV2Targeting*`, `bindDistrictV2Census*`

### Structural output renderers (allowed when output rows change)
- `renderDistrictV2TargetingRows`
- `renderDistrictV2CensusAggregateRows`

### C3 ordinary edit rerender/rebind audit
- Targeting:
  - binders are one-time (`data-v3DistrictV2Bound`) and dispatch through `setDistrictTargetingField` / `applyDistrictTargetingPreset`.
  - ordinary editable control sync in `syncDistrictV2Targeting` uses in-place helpers (`syncSelectOptions`, `syncInputValueFromRaw`, `syncCheckboxCheckedFromRaw`).
  - no pending-write hold logic in editable flow.
- Census:
  - binders are one-time (`data-v3DistrictV2Bound`) and dispatch through `setDistrictCensusField` / `setDistrictCensusGeoSelection`.
  - ordinary editable control sync in `syncDistrictV2Census` uses in-place helpers (`syncSelectOptions`, `syncInputValueFromRaw`, `syncMultiSelectOptions`, `syncCheckboxCheckedFromRaw`).
  - no pending-write hold logic in editable flow.

### C3 parity outcome
- C3 trace auto-probe confirms in browser runtime:
  - Census Resolution select updates canonical and keeps same node identity.
  - Census GEO Search input updates canonical and keeps same node identity.
  - Targeting Geo Level select updates canonical and keeps same node identity.
  - Targeting Top N numeric input updates canonical and keeps same node identity.
- Observed structural updates remain limited to derived result tables (`TargetingResultsTbody`, `CensusAggregateTbody`).

## C4-C6 Inventory Targets (next waves)

### Outcome editable controls (C4)
- `js/app/v3/surfaces/outcome/index.js`

### War Room editable controls (C5)
- `js/app/v3/surfaces/warRoom/index.js`
- module splits under `js/app/v3/surfaces/warRoom/`

### Data editable controls (C6)
- `js/app/v3/surfaces/data/index.js`
- module splits under `js/app/v3/surfaces/data/`

## Shared helper retirement candidates (C7)

Retire after all subsystem freezes:
- legacy direct `innerHTML` editable refresh helpers
- duplicate binder/sync utilities superseded by in-place contract
- transitional compatibility render paths no longer referenced
