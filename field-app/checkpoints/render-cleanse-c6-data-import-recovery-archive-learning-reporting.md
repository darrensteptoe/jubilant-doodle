# C6 Checkpoint — Data Modules (Import/Export, Recovery, Forecast Archive, Learning, Reporting)

Date: 2026-03-21
Status: **FROZEN**

## Scope
- Data editable modules only (`js/app/v3/surfaces/data/*`)
- Included modules:
  - Import / Export
  - Recovery
  - Forecast Archive
  - Learning (read-only verification lane)
  - Reporting controls
- No C7+ work in this pass

## Contained inventory (render/bind/sync)

### Render owners
- `renderDataSurface`
- `refreshDataSummary`

### Binder owners
- `bindDataImportExportEvents`
- `bindDataRecoveryEvents`
- `bindDataForecastArchiveEvents`
- `bindDataReportingEvents`

### Sync owners
- `syncDataImportExportModule`
- `syncDataRecoveryModule`
- `syncDataForecastArchiveModule`
- `syncDataLearningModule`
- `syncDataReportingModule`
- shared in-place select helpers:
  - `replaceDataSelectOptionsInPlace`
  - `replaceArchiveSelectOptionsInPlace`
  - `replaceReportTypeOptionsInPlace`

## Ordinary-edit rerender/rebind audit
- One-time binder guard remains on Data root (`root.dataset.wired = "1"`).
- No District pending-write / stale-hold logic in C6 editable paths.
- Ordinary select edits are now in-place for:
  - restore-backup select
  - voter-adapter select
  - archive select
  - report-type select
- Import/Export draft controls now use Data bridge write/read path:
  - `setVoterImportDraft(...)` for writes
  - `view.voterImportDraft` for canonical control hydration
- Learning module remains read-only (no editable controls).

## Transitional helpers removed/retained
- Removed from ordinary-edit select sync paths:
  - direct `innerHTML` option rebuild in Data select sync helpers
- Retained (allowed structural output lane):
  - archive rows table body rebuild in `syncArchiveRows` (derived output table lane, not editable controls)
- No C6 pending-write helper retained.

## Tests added for C6

1. `js/app/v3/surfaces/data/renderLifecycle.contract.test.js`
- `c6 contract: data editable binders are one-time and hold-free`
- `c6 contract: data ordinary select sync updates options in place`
- `c6 contract: data trace harness covers import recovery archive reporting controls`
- `c6 contract: import/export draft writes flow through data bridge API`

2. `js/core/selectors/dataC6.persistence.test.js`
- `data c6: recovery strict-import flag persists after reopen snapshot`
- `data c6: forecast archive selection and entry persist after reopen snapshot`
- `data c6: runtime bridge keeps voter-import draft and reporting type on state-backed paths`

## Command results (exact)
- `node --test js/app/v3/surfaces/data/renderLifecycle.contract.test.js js/app/v3/surfaces/data/phase9.integrity.test.js` -> PASS (9/9)
- `node --test js/core/selectors/dataC6.persistence.test.js` -> PASS (3/3)
- `npm run build` -> PASS
  - bundle observed in build output: `dist/assets/index-yofRi3mO.js`

## Manual/browser parity (headless runtime)

Artifacts:
- `/tmp/data_c6_run1.log`
- `/tmp/data_c6_run2.log`
- `/tmp/data_c6_nav_outcome.log`
- `/tmp/data_c6_nav_back.log`

Bundle observed in browser logs:
- `assets/index-yofRi3mO.js`

C6 probe controls:
- Import/Export: `v3DataVoterSourceId`
- Recovery: `v3DataStrictToggle`
- Forecast Archive: `v3DataArchiveSelect`
- Reporting: `v3DataReportType`

Run1 (`dataDomTraceAuto=1`) trace highlights:
- `trace.auto.c6.post` for all four controls with:
  - `replacedSinceReference=false`
  - `siblingReplacementMap=false` for sibling modules
- Canonical + DOM parity after probe:
  - `v3DataVoterSourceId`: `c6-source-probe`
  - `v3DataStrictToggle`: `true`
  - `v3DataArchiveSelect`: selected hash value retained
  - `v3DataReportType`: `client_standard`

Refresh/reopen (`dataDomTraceAuto=0`) and navigation-back:
- `trace.init` retains canonical values for all four controls after reload and after Outcome->Data navigation back.
- Navigation-away run confirms Outcome stage mount path is active in `/tmp/data_c6_nav_outcome.log`.

## C6 Scorecard
- canonical read source clean for probed controls: **YES**
- in-place sync clean for ordinary editable controls: **YES**
- DOM identity preserved for probed controls: **YES**
- cross-module destructive rerender on ordinary edits: **NO**
- hold/pending-write/stale-sync logic in editable path: **NO**
- persistence parity (blur + refresh + navigation): **YES**
- subsystem frozen: **YES**
