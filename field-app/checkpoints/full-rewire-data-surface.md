# Phase 9 - Data Surface Decomposition

## Scope landed
- Split Data surface into a dedicated `data/` module directory.
- Converted `data.js` into a compatibility wrapper to `./data/index.js`.
- Kept Data as an orchestration shell and lane-split sync/event responsibilities across modules:
  - `importExport`
  - `recovery`
  - `forecastArchive`
  - `learning`
  - `reporting`
- Removed in-index mixed event wiring for recovery/archive/reporting/import controls and routed those through module-level binders.
- Added explicit module-boundary integrity checks so recovery/reporting/archive/import lanes cannot silently re-merge.

## Files
- `js/app/v3/surfaces/data/index.js`
- `js/app/v3/surfaces/data/importExport.js`
- `js/app/v3/surfaces/data/recovery.js`
- `js/app/v3/surfaces/data/forecastArchive.js`
- `js/app/v3/surfaces/data/learning.js`
- `js/app/v3/surfaces/data/reporting.js`
- `js/app/v3/surfaces/data.js`
- `js/app/v3/surfaces/data/phase9.integrity.test.js`
- `js/app/v3/surfaces/layoutContract.test.js`

## Test intent
- Data surface decomposition is enforced at import/orchestration level.
- Recovery module must not own reporting or archive fields.
- Forecast archive module must not own import/export fields.
- Import/export module must not own recovery/archive fields.
- Reporting module must not own recovery/archive fields.
- Data surface retains full-width center stack contract.
