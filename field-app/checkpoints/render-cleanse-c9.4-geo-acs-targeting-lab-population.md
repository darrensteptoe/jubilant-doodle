# C9.4 Freeze — GEO/ACS -> Targeting Lab Population Fix

Date: 2026-03-21  
Scope: C9.4 only (District GEO/ACS load path into Targeting Lab)

## Scope completed
- Fixed District targeting-gate can-run logic to use canonical census selection with runtime fallback when canonical selection is temporarily behind runtime GEO/ACS rows.
- Added explicit non-silent targeting status for empty-row state:
  - `Load ACS rows before running targeting.`
- Added canonical census-selection sync calls in District census bridge mutation paths so runtime GEO/ACS selection updates are mirrored into canonical `domains.census.selection`.
- Kept scope contained to C9.4 (no C9.5+ page-order/CSS work).

## Root cause
- The District bridge can-run path relied only on canonical census loaded-row count.
- Runtime GEO/ACS row availability could exist before canonical selection reflected it.
- Result: Targeting Lab remained in a silent/disabled state despite runtime row presence.

## Files changed
- `js/appRuntime.js`
- `js/core/selectors/districtMirrorCompatibilityLayer.test.js`

## Tests/checks run
- `node --test js/core/selectors/districtMirrorCompatibilityLayer.test.js` -> pass (9/9)
- `node --test js/app/v3/surfaces/district/renderLifecycle.contract.test.js` -> pass (13/13)
- `npm run check:interaction-integrity` -> pass (`total=113 pass=113 fail=0`)
- `npm run build` -> pass

## Browser/manual parity evidence
- Preview runtime: `http://127.0.0.1:4182/`
- District DOM capture: `/tmp/c94_district.log`
- Observed loaded bundle in browser DOM:
  - `/assets/index-CVYCiR-V.js`
- Confirmed District V2 targeting no-row state now renders explicit guidance:
  - `#v3DistrictV2TargetingStatus` = `Load ACS rows before running targeting.`
  - `#v3DistrictV2TargetingResultsTbody` placeholder still shows ranked-GEO instruction without silent blank state.

## Transitional compatibility paths touched
- District runtime mirror paths remain transitional and intentionally retained.
- C9.4 only tightened synchronization between runtime census selection and canonical census selection.

## Freeze decision
C9.4 frozen.
