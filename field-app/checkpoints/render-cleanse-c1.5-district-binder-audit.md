# Render Cleanse C1.5 — District V2 Binder Audit (2026-03-21)

## Scope
Narrow live binder audit for:
- `v3DistrictV2RaceType`
- `v3DistrictV2ElectionDate`
- `v3DistrictV2UniverseSize`

No broad architecture changes were made in this pass.

## Runtime Under Test
- URL: `http://127.0.0.1:4177/?stage=district&districtDomTrace=1&districtDomTraceAuto=1&districtBinderAudit=1`
- Built asset observed: `assets/index-BXAIf4D8.js`
- Browser log capture: `/tmp/district_c15c_browser.log`

## Questions + Answers

1. Is the visible DOM node the exact node that the binder attaches to?
- Yes. Binder lookup/attach and `getElementById` resolve the same node token for each target control.

2. Are there duplicate IDs or duplicate matching nodes for those controls?
- No. `lookupCount: 1`, `hasDuplicateId: false` for all three target controls.

3. Does the change/blur event fire on the visible node?
- Yes. `binder.event` logs fire for all three controls from the same bound node token.

4. Does the bound handler run for that exact node?
- Yes. Handler logs record event values from the same node token that was attached.

5. Does the handler dispatch the correct action payload?
- Yes. Dispatched payload values are correct:
  - raceType: `federal`
  - electionDate: `2030-11-05`
  - universeSize: `111`

6. Does canonical state change in the live runtime immediately after dispatch?
- No. Canonical before/after is unchanged for each target control.

7. If not, what is the first step where the value is lost?
- First failure occurs inside District bridge call to `setFormField`.
- The bridge throws before canonical update:
  - `eventType: method_throw`
  - `method: setFormField`
  - `errorName: ReferenceError`
  - `message: cleanText is not defined`

## Evidence (from browser log)
- Binder events and dispatch attempts for targets: `/tmp/district_c15c_browser.log` lines ~565-617.
- Bridge throw details:
  - `"eventType":"method_throw","method":"setFormField","errorName":"ReferenceError","message":"cleanText is not defined"`
- Canonical remains default after dispatch (`state_leg`, empty date, `0` universe size).

## Code Correlation
- Throw occurs in runtime `setFormField` path (`districtBridgeSetFormField`) where `cleanText(...)` is called.
- Source reference:
  - `js/appRuntime.js` around line `5035` and subsequent condition branches.
- `cleanText` helper is referenced in `js/appRuntime.js` but no `cleanText` definition is present in that file.

## Result
C1 remains blocked and not frozen.

The issue is not node replacement or duplicate-node binding. The first failing step is a bridge runtime exception in `setFormField`, which prevents canonical state updates for the audited controls.
