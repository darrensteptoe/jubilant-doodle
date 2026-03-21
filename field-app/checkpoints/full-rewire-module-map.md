# Phase 0A — Full Rewire Module Decomposition Map

Date: 2026-03-20

## Audit Scope

- `js/app/v3/surfaces/*.js`
- `js/appRuntime.js`
- `js/app/v3/stateBridge.js`
- `js/app/censusPhase1.js`
- `js/core/censusModule.js`
- `styles-fpe-v3.css`

## Decomposition Matrix

| Module (current) | Current owning page | Current state owner | Current mutation owner | Current derived owner | Target standalone boundary | Target domain slice | Target selector pair | Target type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Race setup (race type/date/weeks/mode) | `district` surface | top-level state (`raceType`, `electionDate`, `weeksRemaining`, `mode`) | `districtBridgeSetFormField` in `js/appRuntime.js` | `districtBridgeCanonicalView.form` + runtime summaries | `js/app/v3/surfaces/district/raceSetup.js` | `district` | `selectDistrictCanonicalView` + `selectDistrictDerivedView` | surface module |
| Template profile (office/election/seat/partisanship/salience) | `district` surface | `state.templateMeta` + `state.ui.assumptionsProfile` | `districtBridgeSetFormField` + `districtBridgeApplyTemplateDefaults` | `districtBridgeCanonicalView.template` + derived template badges | `js/app/v3/surfaces/district/templateProfile.js` | `district` + `assumptions` | `selectDistrictCanonicalView` + `selectDistrictDerivedView` | surface module |
| Ballot baseline (candidates/undecided/user split) | `district` surface | `state.candidates`, `state.undecided*`, `state.userSplit`, `state.yourCandidateId` | `districtBridgeAdd/Update/RemoveCandidate`, `districtBridgeSetUserSplit`, `districtBridgeSetFormField` | `districtBridgeDerivedView.ballot` | `js/app/v3/surfaces/district/ballot.js` | `ballot` | `selectDistrictCanonicalView` + `selectDistrictDerivedView` | surface module |
| Candidate history baseline | `district` surface | `state.candidateHistory` | `districtBridgeAdd/Update/RemoveCandidateHistoryRecord` | win math output via `lastRenderCtx.res.validation.candidateHistory` + `candidateHistoryImpact` | `js/app/v3/surfaces/district/candidateHistory.js` | `candidateHistory` | `selectDistrictCanonicalView` + `selectDistrictDerivedView` | surface module |
| Census config + context controls | `district` surface (proxy) | `state.census` | `districtBridgeSetCensus*` and fallback patching in `districtBridgePatchCensusBridgeField` | `districtBridgeCanonicalView.census.config` | `js/app/v3/surfaces/district/censusConfig.js` and shared census module | `census` | `selectCensusCanonicalView` + `selectCensusDerivedView` | surface module |
| Census results/advisories/map status | `district` surface (proxy) | mixed: `state.census` + bridge-only fields from Census runtime | `censusPhase1` runtime + fallback bridge patching | `districtBridgeDerivedView.census` (includes `bridge*` fields) | `js/app/v3/surfaces/district/censusConfig.js` + derived panel submodule | `census` | `selectCensusCanonicalView` + `selectCensusDerivedView` | surface module |
| Targeting config | `district` surface | `state.targeting` | `districtBridgeSetTargetingField`, `applyTargetModelPreset`, `resetTargetingWeightsToPreset` | `districtBridgeCanonicalView.targeting.config` | `js/app/v3/surfaces/district/targetingConfig.js` | `targeting` | `selectTargetingCanonicalView` + `selectTargetingDerivedView` | surface module |
| Targeting results table/status | `district` surface | `state.targeting.lastRows/lastMeta` | `districtBridgeRunTargeting` | `districtBridgeDerivedView.targeting` | `js/app/v3/surfaces/district/targetingConfig.js` (results subpanel) | `targeting` | `selectTargetingCanonicalView` + `selectTargetingDerivedView` | surface module |
| District summary tiles | `district` surface | mixed: `state` + derived engine output | none (read-only render) | `districtBridgeDerivedView.summary` | `js/app/v3/surfaces/district/summary.js` | `district` + `outcome` | `selectDistrictDerivedView` | surface module |
| Election CSV summary in District | `district` surface (inside Census card) | currently under `state.census` bridge fields | `censusPhase1` dry-run actions via runtime bridge | `districtBridgeDerivedView.census.election*` | `js/app/v3/surfaces/district/electionDataSummary.js` | `electionData` | `selectElectionDataCanonicalView` + `selectElectionDataDerivedView` | surface module |
| Decision sessions + options | `decisionLog` surface | `state.ui.decision.*` | `decisionBridge*Session/*Option` handlers | `decisionBridgeStateView` summary/diagnostics | `js/app/v3/surfaces/warRoom/decisionSessions.js` | `governance` + `scenarios` | `selectEventCalendarCanonicalView` + `selectEventCalendarDerivedView` (for decision context), plus dedicated decision selectors later | surface module |
| War room diagnostics | `decisionLog` surface | derived from `lastRenderCtx`, `state.ui` diagnostics snapshots | computed via `decisionBridgeDiagnosticsSnapshot` | `buildDecisionDiagnosticsSnapshotView` output | `js/app/v3/surfaces/warRoom/diagnostics.js` | `governance` + `audit` | `selectOutcomeDerivedView` + decision diagnostics selector | surface module |
| War room weather | `decisionLog` surface | `state.warRoom.weather*` and `weatherAdjustment` | `decisionBridgeSetWeather*`, `decisionBridgeRefreshWeather` | `buildWarRoomWeatherView` | `js/app/v3/surfaces/warRoom/weatherRisk.js` | `weatherRisk` | `selectWeatherRiskCanonicalView` + `selectWeatherRiskDerivedView` | surface module |
| War room event calendar | `decisionLog` surface | `state.warRoom.eventCalendar.*` | `decisionBridgeSetEvent*`, save/load/delete event handlers | `buildEventCalendarView` | `js/app/v3/surfaces/warRoom/eventCalendar.js` | `eventCalendar` | `selectEventCalendarCanonicalView` + `selectEventCalendarDerivedView` | surface module |
| War room action log | `decisionLog` surface | `state.ui.decision.sessions[*].warRoom.decisionLog` | `decisionBridgeLogDecision`, `decisionBridgeSetDecisionLogStatus` | `buildWarRoomDecisionLogRowsView` | `js/app/v3/surfaces/warRoom/actionLog.js` | `governance` | decision log canonical/derived selectors (new) | surface module |
| Data import/export/policy | `data` surface | mixed: top-level state + `state.ui.strictImport` + transient bridge locals | `dataBridgeTrigger`, `dataBridgeSetStrictImport`, save/load handlers | `dataBridgeStateView` | `js/app/v3/surfaces/data/importExport.js` | `recovery` + `audit` | `selectDataCanonicalView` + `selectDataDerivedView` (new) | surface module |
| Data recovery/backups/storage | `data` surface | backup list from storage + state context | `dataBridgeRestoreBackup`, USB handlers | `dataBridgeStateView.forecastArchive/controls` | `js/app/v3/surfaces/data/recovery.js` | `recovery` | `selectDataCanonicalView` + `selectDataDerivedView` | surface module |
| Forecast archive + learning | `data` surface | forecast archive store + `state.ui.reporting` / audit snapshots | `dataBridgeSaveArchiveActual`, `dataBridgeRefreshArchive` | `buildForecastArchive*` + `buildModelLearningFromArchive` | `js/app/v3/surfaces/data/forecastArchive.js` + `learning.js` | `forecastArchive` + `audit` | `selectOutcomeCanonicalView` + `selectOutcomeDerivedView` plus archive selectors | surface module |
| Reporting compose/export | `data` surface | `state.ui.reporting.*` | `dataBridgeSetReportType`, `dataBridgeComposeReport`, `dataBridgeExportReportPdf` | report selectors/composer output | `js/app/v3/surfaces/data/reporting.js` | `audit` + `governance` | reporting canonical/derived selectors (new) | surface module |
| Outcome drivers (inputs) | `outcome` surface | top-level outcome-related inputs (`orgCount`, throughput, MC params) | `outcomeBridgeSetField` | `outcomeBridgeCanonicalView.inputs` | `js/app/v3/surfaces/outcome/forecast.js` | `outcome` + `fieldCapacity` | `selectOutcomeCanonicalView` | surface module |
| Outcome forecast + confidence | `outcome` surface | `state.mcLast`, `state.ui.mcMeta`, governance snapshots | `outcomeBridgeRunMc`, `outcomeBridgeRerunMc` | `outcomeBridgeDerivedView.mc/governance` (uses `lastRenderCtx`) | `js/app/v3/surfaces/outcome/governance.js` | `outcome` + `governance` | `selectOutcomeCanonicalView` + `selectOutcomeDerivedView` | surface module |
| Sensitivity + surface analysis | `outcome` surface | `state.ui.lastOutcomeSensitivityRows`, `state.ui.lastOutcomeSurfaceRows` | `decisionBridgeRunSensitivitySnapshot`, `outcomeBridgeComputeSurface` | `outcomeBridgeDerivedView.sensitivityRows/surfaceRows` | `js/app/v3/surfaces/outcome/sensitivity.js` + `surface.js` | `outcome` | `selectOutcomeCanonicalView` + `selectOutcomeDerivedView` | surface module |
| Reach multi-concern card stack | `reach` surface | mixed top-level assumptions + `state.ui` caches + legacy mirrors | `reachBridgeSetField`/override/import/apply actions | `reachBridgeStateView` with cached context from `lastRenderCtx` | split into field-capacity + freshness + actions modules in future | `fieldCapacity` + `assumptions` + `audit` | `selectFieldCapacityCanonicalView` + `selectFieldCapacityDerivedView` (new) | shared component group |
| Turnout multi-concern stack | `turnout` surface | turnout and ROI fields in top-level + budget tactics | `turnoutBridgeSetField` | `turnoutBridgeStateView` (getView only) | future turnout decomposition under outcome/targeting | `assumptions` + `outcome` | `selectTurnoutCanonicalView` + `selectTurnoutDerivedView` (new) | shared component group |
| Plan multi-concern stack | `plan` surface | optimizer/timeline in top-level state | `planBridgeSetField`, `planBridgeRunOptimize` | `planBridgeStateView` (getView only) | future decomposition to execution modules | `fieldCapacity` + `outcome` | `selectPlanCanonicalView` + `selectPlanDerivedView` (new) | shared component group |

## Monolith Files Requiring Directory Split (per rebuild directive)

- `js/app/v3/surfaces/district.js`
- `js/app/v3/surfaces/decisionLog.js`
- `js/app/v3/surfaces/data.js`
- `js/app/v3/surfaces/outcome.js`

## Current Layout Constraint Findings (center-column health)

- Layout shells are currently page-specific (`two-col`, `three-col`, and district-specific nested grids), not one center-column contract.
- District already uses explicit mixed-width internal grids (`fpe-district-grid` and `fpe-district-analysis-grid`) that create non-uniform module widths.
- War Room/Data/Outcome all render multi-column card mosaics via `createSurfaceFrame("three-col")`.
- There is no reusable center-module shell component enforcing one width/spacing standard across rewritten surfaces.

## Phase 0A Gate Result

- Behavior-changing code: none.
- This file is an audit artifact only.
