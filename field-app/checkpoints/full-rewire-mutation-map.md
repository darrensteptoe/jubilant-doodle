# Phase 0B — Full Rewire Mutation Map

Date: 2026-03-20

## Scope

Mutation inventory across runtime and bridge paths that write canonical state.

## Global Mutation Primitives

| Primitive | File | Behavior | Risk |
| --- | --- | --- | --- |
| `setState(patchFn)` | `js/appRuntime.js` | shallow-clones state + deep-clones `state.ui`, applies patch function, commits UI update | broad write surface; used by many bridges |
| `mutateState(patchFn)` | `js/appRuntime.js` | alias over `setState` with mutation semantics | no domain-level action modules yet |
| direct assignment paths (`state = ...`) | `js/appRuntime.js` | rehydrate/reset/import and scenario load flows replace full state object | can bypass per-domain ownership checks |

## Bridge Mutation Inventory

| Bridge | Entry points (writes) | Current slices written | Notes |
| --- | --- | --- | --- |
| Shell (`__FPE_SHELL_API__`) | `setScenarioName`, `setContext`, `setPlaybookEnabled`, `setTrainingEnabled`, `resetScenario` | context fields, `ui` toggles, whole-state replace on reset/context scope change | writes span campaign/scenario/ui domains |
| Scenario (`__FPE_SCENARIO_API__`) | select/save/clone/load/delete + intel workflow methods | `ui.scenarios`, active scenario ids, full scenario rehydrate on load | scenario operations mutate both scenario registry and full state |
| District (`__FPE_DISTRICT_API__`) | form/template/candidate/user split/history/targeting/census methods | district, ballot, candidateHistory, targeting, census slices (and some top-level fields) | largest cross-domain writer surface |
| Reach (`__FPE_REACH_API__`) | `setField`, override controls, daily log import/apply/undo/applyLever | assumptions, throughput, timeline and `ui` caches | mixed operational + derived cache writes |
| Turnout (`__FPE_TURNOUT_API__`) | `setField`, `refreshRoi` | turnout + GOTV + budget tactic fields | writes occur through one generic field switch |
| Plan (`__FPE_PLAN_API__`) | `setField`, `runOptimize` | optimizer + timeline fields | writes and recompute coupled in page bridge |
| Outcome (`__FPE_OUTCOME_API__`) | `setField`, `runMc`, `rerunMc`, `computeSurface` | outcome inputs, MC fields, `ui.lastOutcomeSurface*` caches | combines canonical inputs and derived cache writes |
| Decision (`__FPE_DECISION_API__`) | session/option fields, recommendation, weather/event actions, sensitivity run | `ui.decision`, `warRoom.weather*`, `warRoom.eventCalendar*`, `ui.e4Sensitivity` | decision bridge currently owns weather + event + action log writes |
| Data (`__FPE_DATA_API__`) | strict import toggle, restore backup, report actions, archive actual, voter import | `ui.strictImport`, `ui.reporting`, `voterData`, full-state import/restore flows | data bridge mixes recovery + reporting + import concerns |
| Census runtime (`__FPE_CENSUS_RUNTIME_API__`) | `setField`, `setGeoSelection`, `setFile`, `triggerAction` | `state.census` and runtime file caches | district bridge falls back to patching bridge-only census fields when runtime unavailable |

## Non-Bridge Mutation Surfaces

| Location | Mutation behavior | Slices touched |
| --- | --- | --- |
| `wireEventsOrchestratorModule(...)` integration in `appRuntime` | legacy UI controls can mutate state through runtime wiring | broad (district/reach/turnout/plan/outcome/scenario) |
| `dataBridgeApplyImportedScenario` | imported scenario replaces full runtime state | all domains |
| `scenarioBridgeLoad` | loads selected scenario inputs into full state | all domains |
| `shellBridgeSetContext` scope-change branch | rehydrates state from storage or defaults | all domains |

## Mixed-Concern Mutation Hotspots

| Hotspot | Why it is mixed | Required rewrite direction |
| --- | --- | --- |
| `districtBridgeSetFormField` | one switch writes district, ballot, structure, turnout, template concerns | split to domain actions (`district`, `ballot`, `assumptions`) |
| `districtBridgePatchCensusBridgeField` | writes canonical census config and bridge-only UI transport fields together | move UI transport to derived selector output; keep canonical census inputs only |
| `decisionBridgeUpdateSessionField` | writes session core fields and war-room nested fields in same handler | split decision session actions from weather/event/action-log actions |
| `outcomeBridgeSetField` | writes canonical MC inputs and also syncs legacy controls/surface inputs | separate canonical action layer from compatibility sync layer |
| `dataBridgeStateView`/reporting actions | reporting compose/export and recovery/storage controls coupled in one bridge | split into data sub-bridges/actions by domain |

## Mutation Map Stop/Go Decision

- All current writer entry points have been inventoried.
- Mixed writer hotspots are identified for Phase 2 action-module extraction.
- Ready for schema ownership landing (Phase 1) and action-layer rebuild (Phase 2).
