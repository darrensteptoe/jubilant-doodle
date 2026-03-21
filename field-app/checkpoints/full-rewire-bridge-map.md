# Phase 0B — Full Rewire Bridge Map

Date: 2026-03-20

## Bridge Contract Inventory

| Bridge key | Install location | Read contract today | Write contract today | Canonical/derived split status | Gap to target contract |
| --- | --- | --- | --- | --- | --- |
| `__FPE_SHELL_API__` | `installShellBridge` in `js/appRuntime.js` | `getView()` only | context/training/reset mutators | no split | add `getCanonicalView`/`getDerivedView` for shell context/system status |
| `__FPE_SCENARIO_API__` | `installScenarioBridge` | `getView()`, `getLiveInputs()`, `getLiveOutputs()` | scenario/intel mutators | partial (inputs/outputs helpers) | formal canonical/derived selectors needed |
| `__FPE_DATA_API__` | `installDataBridge` | `getView()` only | import/export/recovery/reporting mutators | no split | split into canonical data config + derived status/report/archive views |
| `__FPE_DISTRICT_API__` | `installDistrictBridge` | `getCanonicalView()`, `getDerivedView()`, `getView()` | district/ballot/history/targeting/census mutators | split exists but `getView()` heavily used | enforce canonical/derived consumers and keep `getView()` compatibility-only |
| `__FPE_REACH_API__` | `installReachBridge` | `getView()` only | reach mutators | no split | add fieldCapacity canonical/derived bridge contract |
| `__FPE_TURNOUT_API__` | `installTurnoutBridge` | `getView()` only | turnout mutators | no split | add turnout canonical/derived bridge contract |
| `__FPE_PLAN_API__` | `installPlanBridge` | `getView()` only | plan mutators | no split | add plan canonical/derived bridge contract |
| `__FPE_OUTCOME_API__` | `installOutcomeBridge` | `getCanonicalView()`, `getDerivedView()`, `getView()` | outcome mutators | split exists but mixed consumers remain | enforce canonical/derived routing; make `getView()` thin wrapper |
| `__FPE_DECISION_API__` | `installDecisionBridge` | `getView()` only | decision/weather/event mutators | no split | split decision diagnostics/weather/events/action log contracts |
| `__FPE_CENSUS_RUNTIME_API__` | `js/app/censusPhase1.js` | `getView()`, `getRowsForState()` | setField/setGeoSelection/setFile/triggerAction | runtime-only side bridge | promote Census/ElectionData bridges in v3 contract layer |

## Bridge Consumer Inventory (current readers)

| Consumer file | Bridge read style | Mixed-read risk |
| --- | --- | --- |
| `js/app/v3/stateBridge.js` | reads district canonical/derived when available, falls back to `getView()` | medium |
| `js/app/v3/surfaces/district.js` | primarily uses snapshot readers in `stateBridge.js` | medium (fallback behavior in snapshots) |
| `js/app/v3/surfaces/outcome.js` | attempts canonical/derived reads, still falls back to `getView()` | high |
| `js/app/v3/surfaces/decisionLog.js` | `api.getView()` | high |
| `js/app/v3/surfaces/reach.js` | `api.getView()` | high |
| `js/app/v3/surfaces/turnout.js` | `api.getView()` | high |
| `js/app/v3/surfaces/plan.js` | `api.getView()` | high |
| `js/app/v3/surfaces/controls.js` | `api.getView()` | medium |
| `js/app/v3/surfaces/data.js` | `api.getView()` | high |
| `js/app/v3/kpiBridge.js` | `getView()` on reach/outcome bridges | medium |
| `js/app/v3/index.js` | `getView()` on shell bridge | low |

## Explicit Mixed Bridge Payload Patterns

| Pattern | Current implementation | Required fix |
| --- | --- | --- |
| Combined district payload | `districtBridgeCombinedView()` returns flattened mixed object with `canonical` and `derived` plus merged fields | keep wrapper but remove as primary dependency for surfaces |
| Combined outcome payload | `outcomeBridgeCombinedView()` returns mixed view with both control and output fields | route controls to canonical selector and outputs to derived selector |
| Census bridge transport fields in canonical state | district bridge canonical view includes `state.census` config containing bridge transport keys | move transport/status rows into derived selectors and keep canonical inputs pure |
| Fallback to `getView()` in canonical readers | multiple surfaces use `getView()` when split methods absent | replace with explicit module bridge interfaces and thin compatibility adapter |

## Required Target Bridge End-State

Per rewritten major module/page bridge:

- `getCanonicalView()`
- `getDerivedView()`
- `getView()` compatibility wrapper only

Required bridge set after rewire:

- `js/app/v3/bridges/districtBridge.js`
- `js/app/v3/bridges/electionDataBridge.js`
- `js/app/v3/bridges/outcomeBridge.js`
- `js/app/v3/bridges/weatherRiskBridge.js`
- `js/app/v3/bridges/eventCalendarBridge.js`

## Bridge Map Stop/Go Decision

- Bridge readers/writers are fully inventoried.
- Mixed bridge usage and fallback points are identified.
- Ready for split-bridge implementation phases after schema/action/selectors land.
