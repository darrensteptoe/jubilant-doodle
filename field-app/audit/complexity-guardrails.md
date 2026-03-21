# Complexity Guardrail Report

Generated: 2026-03-21T04:44:42.649Z
Mode: warn

## Thresholds

- Surface file line warning: > 700
- Bridge file line warning: > 160
- Selector file line warning: > 140
- Runtime file line warning: > 1200
- Function complexity warning: decision points > 36 and lines >= 40
- Function length warning: lines > 220

## Summary

- Files scanned: 61
- File warnings: 10
- Function warnings: 37
- Exception files: 1
- Total warnings: 47

## File Warnings

| Category | File | Lines | Threshold |
| --- | --- | --- | --- |
| surface | `js/app/v3/surfaces/district/index.js` | 2841 | 700 |
| surface | `js/app/v3/surfaces/controls.js` | 2182 | 700 |
| surface | `js/app/v3/surfaces/warRoom/index.js` | 1380 | 700 |
| surface | `js/app/v3/surfaces/plan.js` | 1159 | 700 |
| surface | `js/app/v3/surfaces/data/index.js` | 913 | 700 |
| surface | `js/app/v3/surfaces/reach.js` | 882 | 700 |
| surface | `js/app/v3/surfaces/outcome/index.js` | 839 | 700 |
| surface | `js/app/v3/surfaces/turnout.js` | 732 | 700 |
| bridge | `js/app/v3/bridges/electionDataBridge.js` | 220 | 160 |
| selector | `js/core/selectors/targetingDerived.js` | 157 | 140 |

## Function Warnings

| Category | File:Line | Function | Lines | DecisionPts | Reason |
| --- | --- | --- | --- | --- | --- |
| runtime | `js/appRuntime.js:4079` | `districtBridgeDerivedView` | 175 | 204 | complexity |
| runtime | `js/appRuntime.js:3894` | `districtBridgeCanonicalView` | 184 | 202 | complexity |
| runtime | `js/appRuntime.js:4255` | `districtBridgeCombinedView` | 99 | 194 | complexity |
| surface | `js/app/v3/surfaces/plan.js:525` | `refreshPlanSummary` | 131 | 155 | complexity |
| runtime | `js/appRuntime.js:7403` | `decisionBridgeStateView` | 93 | 111 | complexity |
| runtime | `js/appRuntime.js:900` | `shellBridgeBuildPlaybookSignals` | 139 | 104 | complexity |
| runtime | `js/appRuntime.js:6847` | `outcomeBridgeDerivedView` | 83 | 82 | complexity |
| runtime | `js/appRuntime.js:1091` | `shellBridgeSetContext` | 118 | 80 | complexity |
| runtime | `js/appRuntime.js:5474` | `reachBridgeStateView` | 110 | 79 | complexity |
| surface | `js/app/v3/surfaces/outcome/index.js:435` | `refreshOutcomeSummary` | 163 | 78 | complexity |
| runtime | `js/appRuntime.js:5850` | `turnoutBridgeStateView` | 74 | 75 | complexity |
| runtime | `js/appRuntime.js:1552` | `dataBridgeStateView` | 124 | 73 | complexity |
| runtime | `js/appRuntime.js:3805` | `districtBridgeBuildCensusDisabledMap` | 67 | 68 | complexity |
| runtime | `js/app/v3/stateBridge.js:216` | `readDistrictBallotSnapshot` | 58 | 64 | complexity |
| surface | `js/app/v3/surfaces/district/index.js:1067` | `syncDistrictCandidateHistoryTable` | 225 | 62 | line+complexity |
| runtime | `js/appRuntime.js:6734` | `outcomeBridgeCanonicalView` | 78 | 58 | complexity |
| surface | `js/app/v3/surfaces/controls.js:1082` | `wireControlsCalibrationBridge` | 182 | 57 | complexity |
| runtime | `js/appRuntime.js:4636` | `districtBridgeSetFormField` | 180 | 52 | complexity |
| runtime | `js/appRuntime.js:4409` | `districtBridgePatchCensusBridgeField` | 116 | 52 | complexity |
| runtime | `js/appRuntime.js:3705` | `districtBridgeBuildCensusConfigOptions` | 99 | 52 | complexity |
| surface | `js/app/v3/surfaces/warRoom/index.js:43` | `renderWarRoomSurface` | 754 | 50 | line+complexity |
| surface | `js/app/v3/surfaces/controls.js:1265` | `syncControlsCalibrationBridge` | 159 | 50 | complexity |
| runtime | `js/appRuntime.js:5957` | `turnoutBridgeSetField` | 111 | 49 | complexity |
| runtime | `js/appRuntime.js:6297` | `planBridgeSetField` | 87 | 49 | complexity |
| surface | `js/app/v3/surfaces/controls.js:85` | `renderControlsSurface` | 495 | 47 | line+complexity |
| surface | `js/app/v3/surfaces/scenarios.js:267` | `wireScenariosEvents` | 75 | 46 | complexity |
| runtime | `js/appRuntime.js:7288` | `decisionBridgeCurrentSnapshot` | 91 | 44 | complexity |
| runtime | `js/appRuntime.js:6963` | `outcomeBridgeSetField` | 109 | 43 | complexity |
| runtime | `js/app/v3/index.js:384` | `syncContextMirror` | 80 | 43 | complexity |
| surface | `js/app/v3/surfaces/controls.js:1425` | `wireControlsFeedbackBridge` | 84 | 41 | complexity |
| runtime | `js/appRuntime.js:1456` | `dataBridgeImportJsonFile` | 95 | 40 | complexity |
| runtime | `js/app/v3/stateBridge.js:303` | `normalizeDistrictTargetingSnapshotFromView` | 45 | 40 | complexity |
| surface | `js/app/v3/surfaces/turnout.js:30` | `renderTurnoutSurface` | 307 | 24 | line |
| surface | `js/app/v3/surfaces/plan.js:48` | `renderPlanSurface` | 448 | 21 | line |
| surface | `js/app/v3/surfaces/outcome/index.js:59` | `renderOutcomeSurface` | 367 | 18 | line |
| surface | `js/app/v3/surfaces/data/index.js:73` | `renderDataSurface` | 544 | 17 | line |
| surface | `js/app/v3/surfaces/reach.js:22` | `renderReachSurface` | 312 | 10 | line |

## Exceptions

| Category | File | Lines | Threshold | Reason |
| --- | --- | --- | --- | --- |
| runtime | `js/appRuntime.js` | 8784 | 1200 | Known orchestration hub in staged shrink path; tracked separately in pruning. |

