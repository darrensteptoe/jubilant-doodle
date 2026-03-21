# Render Lifecycle Cleanse Plan (System-Level)

Date: 2026-03-21
Scope start: District editable modules (v2)

## Objective
Eliminate snap-back/revert failure class by enforcing one shared editable-control lifecycle:

1. Bind once to stable controls.
2. Dispatch actions only.
3. Re-read canonical selectors.
4. Sync existing controls in place.
5. Structural rerender only for structural row changes (add/remove/navigation), never ordinary field edits.

## New Standard Control Contract

### Canonical editable control lifecycle
1. `bind(control)` with delegated or direct listeners.
2. On edit event, dispatch domain action (`set*`, `update*`, `add*`, `remove*`).
3. On refresh, run `sync*InPlace` helpers:
   - do not replace control nodes
   - do not replace card roots
   - do not use local shadow state
4. Preserve active input on canonical resync (`document.activeElement` guard).

### Structural rerender rules
Allowed only when row structure changes:
- candidate row add/remove
- user split row add/remove
- candidate-history row add/remove
- stage/page remount

Not allowed for ordinary value edits or blur commits.

## Helpers/Patterns Being Retired (District editable runtime)

### Retire as ordinary-edit path
- full-table/template rebuild on every refresh for:
  - `syncDistrictV2CandidateTable`
  - `syncDistrictV2UserSplitTable`
  - `syncDistrictV2CandidateHistory`

### Keep only for structural change path
- `setInnerHtmlWithTrace(...)` branch guarded by row-structure signature comparison.

## District Modules Rewritten First
1. Race Context: in-place control sync only.
2. Electorate: in-place control sync only.
3. Ballot: row-structure signature gate + in-place row value sync.
4. Candidate History: row-structure signature gate + in-place row value sync.
5. Census editable controls: in-place control sync only.
6. Targeting editable controls: in-place control sync only.

## Enforcement Tests

### Added contract tests
- `js/app/v3/surfaces/district/renderLifecycle.contract.test.js`

What it enforces:
1. Candidate/UserSplit/History runtime sync functions must gate structural rerender with `structureSignature`.
2. Editable control sync helpers must be in-place (`syncSelectControlInPlace`, `syncInputControlInPlace`, `syncCheckboxControlInPlace`).
3. District editable runtime must avoid direct `.innerHTML =` writes outside known non-editable/setup exceptions.

## Next Audit Wave (post-District)
Apply same contract checks to other rebuilt editable modules:
- `js/app/v3/surfaces/turnout.js`
- `js/app/v3/surfaces/reach.js`
- `js/app/v3/surfaces/plan.js`
- any remaining editable surfaces with direct runtime `innerHTML` in ordinary edit paths.

Each module gets:
1. structural-vs-ordinary render map
2. in-place sync migration
3. contract test entry

