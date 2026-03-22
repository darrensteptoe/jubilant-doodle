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

## C4 Target (completed)

### Subsystem
Outcome editable controls

### Status
Frozen (2026-03-21)

### Render owners
- `renderOutcomeSurface`
- `applyOutcomeControlView`

### Binder owners
- `bindOutcomeInputField`
- `bindOutcomeSelectField`

### Sync owners
- `syncOutcomeInputValue`
- `syncOutcomeSelectOptions`
- `replaceOutcomeSelectOptionsInPlace`

### C4 ordinary edit rerender/rebind audit
- Binders are one-time (`data-v3OutcomeBound`) and hold-free.
- Ordinary editable sync path does not replace control nodes.
- `syncOutcomeSelectOptions` now uses in-place option mutation (`replaceOutcomeSelectOptionsInPlace`) instead of select `innerHTML` replacement.
- No `markDistrictPendingWrite`, `shouldHoldDistrictControlSync`, or `districtPendingWrites` in Outcome editable paths.

### C4 parity outcome
- C4 trace auto-probe confirms:
  - dropdown (`v3OutcomeMcMode`) updates canonical and keeps same node identity.
  - numeric input (`v3OutcomeOrgCount`) updates canonical and keeps same node identity.
- Refresh/reopen parity confirms persisted values remain after reload on same profile.
- Stage-navigation parity confirms persisted values remain after opening another stage and returning to Outcome.

## C5 Target (completed)

### Subsystem
War Room / Decision Sessions / Diagnostics / Weather Risk / Event Calendar editable controls

### Status
Frozen (2026-03-21)

### Render owners
- `renderWarRoomSurface`
- `refreshDecisionSummary`

### Binder owners
- `bindWarRoomDecisionSessionEvents`
- `bindWarRoomDiagnosticsEvents`
- `bindWarRoomWeatherRiskEvents`
- `bindWarRoomEventCalendarEvents`

### Sync owners
- `syncSelect`
- `replaceWarRoomSelectOptionsInPlace`
- `syncInput`
- `setChecked`

### C5 ordinary edit rerender/rebind audit
- Decision session/weather/event editable controls are synced in place with active-element guards.
- `syncSelect` now uses in-place option mutation (`replaceWarRoomSelectOptionsInPlace`) instead of select `innerHTML` replacement.
- No District pending-write or stale-hold logic in C5 editable paths.

### C5 parity outcome
- War Room trace auto-probe confirms:
  - decision budget (`v3DecisionBudget`) updates canonical and keeps same node identity.
  - weather office ZIP (`v3DecisionWeatherOfficeZip`) updates canonical and keeps same node identity.
  - event title (`v3DecisionEventTitle`) updates canonical and keeps same node identity.
- Cross-module trace checks (`trace.auto.c5.post`, `trace.auto.c5.diagnostics.post`) show `siblingReplacementMap=false` across modules during ordinary edits/actions.
- Diagnostics module has actions but no dedicated editable text/select field; action-path parity was captured via `v3BtnDecisionCaptureReview`.
- Refresh/reopen and cross-stage navigation parity retained C5 values.

## C6 Target (completed)

### Subsystem
Data page editable modules:
- Import / Export
- Recovery
- Forecast Archive
- Learning (read-only verification lane)
- Reporting controls

### Status
Frozen (2026-03-21)

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
- in-place select helpers:
  - `replaceDataSelectOptionsInPlace`
  - `replaceArchiveSelectOptionsInPlace`
  - `replaceReportTypeOptionsInPlace`

### C6 ordinary edit rerender/rebind audit
- Data root bind remains one-time (`root.dataset.wired = "1"`).
- No District pending-write / stale-hold helpers in Data editable paths.
- Ordinary editable select sync now uses in-place option mutation for:
  - backup select
  - voter adapter select
  - archive select
  - report type select
- Import/Export voter-draft controls (`adapterId`, `sourceId`) now dispatch through Data bridge API (`setVoterImportDraft`) and are read back via bridge view snapshot.
- Structural row rebuild remains only in archive output table renderer (`syncArchiveRows`) and is treated as derived-output structural rendering, not editable control hydration.

### C6 parity outcome
- C6 trace auto-probe confirms for Data controls:
  - Import/Export (`v3DataVoterSourceId`) updates canonical and keeps same node identity.
  - Recovery (`v3DataStrictToggle`) updates canonical and keeps same node identity.
  - Forecast Archive (`v3DataArchiveSelect`) updates canonical and keeps same node identity.
  - Reporting (`v3DataReportType`) updates canonical and keeps same node identity.
- `trace.auto.c6.post` shows `replacedSinceReference=false` and `siblingReplacementMap=false` for ordinary edits across modules.
- Refresh/reopen and navigation-back traces retain canonical values for all four C6 probe controls.

## C7 Target (completed)

### Subsystem
App-wide render-helper retirement + legacy UI-path cleanup + District completeness gap inventory

### Status
Frozen (2026-03-21)

### C7 retirement result
- Safe remove now:
  - removed unused `DATA_ACTIONS` helper constant from `js/app/v3/surfaces/data/index.js`.
- Transitional keep:
  - District compatibility export in `js/app/v3/surfaces/district/index.js` retained while interaction inventory and drift checks still target that path.
  - District runtime mirror layer in `js/appRuntime.js` retained as transitional derived/model-input compatibility lane.
  - District structural row render helpers (`setInnerHtmlWithTrace` signature-gated usage for ballot/history/result rows) retained for row add/remove structural changes.
- Needs replacement first:
  - District selector expectations in `js/app/v3/qaGates.js` still reference legacy District IDs and should be migrated to `districtV2` selectors before helper retirement.
  - Interaction inventory file path references still point to compatibility path (`js/app/v3/surfaces/district/index.js`) and should move to `districtV2` path before wrapper deletion.

### District completeness audit result
- Captured in `checkpoints/district-v2-completeness-gaps.md`.

## C9 Target (completed)

### Subsystem
Final visual/layout/rail/map polish on frozen C1-C8 architecture

### Status
Frozen (2026-03-21)

### C9 scope completion
- Shell cleanup:
  - removed global top-strip glossary shortcuts from live chrome
  - hid runtime diagnostics by default
  - removed visible topbar build badge from normal UI
- Right rail:
  - default mode = Results
  - manual intent triggers switch to Manual
  - explicit user switch-back to Results preserved
  - metadata block reduced to snapshot hash
  - section order updated (validation/guardrails before MC+risk, stress below risk)
- Page ordering/layout:
  - District, Election Data, Outcome, Reach, Turnout, Plan, Scenarios, Controls, War Room, Data reordered per summary-first/density rules
  - `two-col-balanced` layout introduced for Scenarios
- District map lane polish:
  - map status/shell/VTD ZIP lanes retained and polished
  - map labels lane added and wired without legacy advisory preview restoration
- Boundary preservation:
  - Election Data summary moved to Election Data page
  - District keeps compact election-data context only

### C9 regression contract status
- district/outcome/war-room/data render lifecycle contracts: pass
- District replacement/persistence suites: pass
- interaction integrity + interaction pages + district integrity: pass
- build: pass
- dedicated C9 shell/layout contract: pass

### C9 checkpoint
- `checkpoints/render-cleanse-c9-final-visual-layout-rail-map.md`

## C9 Mini-phase status (reset to contained sequence)

### C9.1 — Shell + right rail
- Frozen (2026-03-21)
- Checkpoint: `checkpoints/render-cleanse-c9.1-shell-right-rail.md`

### C9.2 — Context-row relocation + summary placement
- Frozen (2026-03-21)
- Checkpoint: `checkpoints/render-cleanse-c9.2-context-summary-placement.md`

### C9.3+
- C9.3 — District Census map restoration
  - Frozen (2026-03-21)
  - Checkpoint: `checkpoints/render-cleanse-c9.3-district-census-map-restoration.md`
- C9.4+ not started in this pass.
- Required missing/deferred items enumerated:
  - Turnout Baseline card controls
  - Census map shell + map status strip
  - VTD ZIP intake/status UI lane
  - Census advisory/election preview result tables
