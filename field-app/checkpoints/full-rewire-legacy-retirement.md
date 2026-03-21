# Phase 11 - App-wide Bridge Cleanup and Legacy Retirement

## Scope landed
- Added bridge modules under `js/app/v3/bridges/` for key rewritten domains:
  - `districtBridge`
  - `outcomeBridge`
  - `weatherRiskBridge`
  - `eventCalendarBridge`
- Moved Outcome surface bridge access behind `outcomeBridge` helpers.
- Removed direct `window.__FPE_OUTCOME_API__` access from Outcome surface and KPI bridge.
- Moved District bridge read/write access in `stateBridge` behind `districtBridge` helpers.
- Kept `getView()` only as compatibility fallback in bridge modules; canonical/derived readers are now preferred.
- Added bridge-cleanup integrity tests to lock this contract.

## Legacy paths retired in this phase
- Direct Outcome bridge key usage in:
  - `js/app/v3/surfaces/outcome/index.js`
  - `js/app/v3/kpiBridge.js`
- Direct District bridge key usage in:
  - `js/app/v3/stateBridge.js`

## Temporary compatibility layers retained (explicit)
- `getView()` fallback remains in bridge modules where canonical/derived methods may be absent in transitional runtime paths.
- Runtime bridge installation/implementation remains in `js/appRuntime.js` for now; this phase centralizes callers but does not yet move runtime bridge implementation out of appRuntime.
- Decision bridge currently exposes mixed weather/event access through `__FPE_DECISION_API__`; dedicated `weatherRiskBridge` and `eventCalendarBridge` wrappers now isolate callers while runtime internals remain transitional.

## Files
- `js/app/v3/bridges/districtBridge.js`
- `js/app/v3/bridges/outcomeBridge.js`
- `js/app/v3/bridges/weatherRiskBridge.js`
- `js/app/v3/bridges/eventCalendarBridge.js`
- `js/app/v3/bridges/phase11.cleanup.test.js`
- `js/app/v3/surfaces/outcome/index.js`
- `js/app/v3/kpiBridge.js`
- `js/app/v3/stateBridge.js`
- `checkpoints/full-rewire-legacy-retirement.md`

## Test intent
- Canonical/derived bridge readers are preferred, with explicit compatibility fallback.
- Rewritten surfaces/modules avoid direct global bridge key coupling.
- Bridge wrappers expose weather/event action boundaries as dedicated modules.
- District/state bridge integration uses shared bridge module ownership.
