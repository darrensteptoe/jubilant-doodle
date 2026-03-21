# District V2 DOM Lifecycle Audit (2026-03-21)

## Scope

Focused controls:
- `v3DistrictV2RaceType` (Race Template)
- `v3DistrictV2ElectionDate` (Election Date)
- `v3DistrictV2UniverseSize` (Universe Size)

## Static rebuild map

### Race Context module
- File: `js/app/v3/surfaces/districtV2/raceContext.js`
- `innerHTML` usage is construction-time only inside `renderDistrictV2RaceContextCard(...)`.
- No race-context card root `innerHTML` replacement in `refreshDistrictV2Surface()` path.

### Electorate module
- File: `js/app/v3/surfaces/districtV2/electorate.js`
- `innerHTML` usage is construction-time only inside `renderDistrictV2ElectorateCard(...)`.
- No electorate card root `innerHTML` replacement in `refreshDistrictV2Surface()` path.

### Ballot module
- Runtime row rebuilds occur in:
  - `syncDistrictV2CandidateTable(...)`
  - `syncDistrictV2UserSplitTable(...)`
- These rebuild table/list containers via `innerHTML` writes.

### Candidate History module
- Runtime row rebuilds occur in:
  - `syncDistrictV2CandidateHistory(...)`
- This rebuilds candidate-history table body via `innerHTML` writes.

## Instrumentation added

File: `js/app/v3/surfaces/districtV2/index.js`

1. Control identity trace for blur/change/input/focus on:
- race template
- election date
- universe size

Logs include:
- control id
- node token identity
- whether node changed since blur reference
- DOM value
- canonical value
- persisted value

2. MutationObserver on card roots:
- race context card root
- electorate card root

Logs include:
- scope/root
- mutation target
- added/removed node ids

3. `innerHTML` write tracing on runtime rebuild paths:
- ballot rows/user split rows
- candidate history rows
- targeting result rows
- census aggregate rows
- select option-list refresh writes

## Runtime toggle

Global helper:
- `window.__FPE_DISTRICT_V2_TRACE__.enable()`
- `window.__FPE_DISTRICT_V2_TRACE__.disable()`
- `window.__FPE_DISTRICT_V2_TRACE__.readControlSnapshot(controlId)`

Default state for this audit pass:
- tracing enabled unless explicitly disabled (`districtDomTrace=0` or runtime disable call).

