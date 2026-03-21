# Phase 0B — Full Rewire Ownership Map

Date: 2026-03-20

## Scope

- Current runtime ownership in `js/appRuntime.js`, `js/app/defaultState.js`, `js/app/normalizeLoadedState.js`
- Current bridge/surface read paths in `js/app/v3/stateBridge.js` and `js/app/v3/surfaces/*.js`

## Current Truth Ownership (as implemented today)

| Concern | Current canonical owner (today) | Ownership issue | Required target owner |
| --- | --- | --- | --- |
| Campaign context | top-level state (`campaignId`, `campaignName`, `officeId`) | none (single owner) | `campaign` domain |
| District race/electorate inputs | top-level state fields (`raceType`, `electionDate`, `weeksRemaining`, `mode`, `universe*`, turnout anchors) | owner is broad top-level, not domain-scoped | `district` domain |
| Ballot controls | top-level state (`candidates`, `yourCandidateId`, `undecided*`, `userSplit`) | cross-concern keys co-located with district + outcome keys | `ballot` domain |
| Candidate history rows | top-level `candidateHistory` | no domain isolation, derived confidence sourced elsewhere | `candidateHistory` domain |
| Targeting config/results | `state.targeting` | currently coupled to district bridge lifecycle | `targeting` domain |
| Census config/results | `state.census` | bridge-only status/preview fields mixed into same object | `census` domain |
| Election CSV workflow | currently embedded under Census runtime/bridge fields | not first-class owner; mixed with census context and UI bridge artifacts | `electionData` domain |
| Outcome controls | top-level `mc*`, `org*`, throughput fields | mixed with non-outcome concerns | `outcome` + `fieldCapacity` domains |
| Outcome derived caches | `state.ui.lastOutcome*` and `state.mcLast` | derived cached fields mixed with UI state object | `outcome` derived selector pipeline |
| Weather risk | `state.warRoom.weather*` and `weatherAdjustment` | nested under decision/warRoom object | `weatherRisk` domain |
| Event calendar | `state.warRoom.eventCalendar.*` | nested under decision/warRoom object | `eventCalendar` domain |
| Forecast archive/reporting | `state.ui.reporting.*` + archive store | mixed domain ownership under UI | `forecastArchive` + `audit` domains |
| Governance/diagnostics snapshots | `state.ui.lastGovernanceSnapshot`, `state.ui.lastDiagnostics`, etc. | derived snapshots treated as semi-stateful owner fields | `governance`/`audit` derived selectors |
| Scenario sessions | `state.ui.scenarios` and `state.ui.decision` | shared UI bucket ownership | `scenarios` + `governance` domains |
| UI toggles/layout prefs | `state.ui.*` | broad catch-all currently owns non-UI concerns too | `ui` domain only |

## Mixed Canonical/Derived Hydration Inventory

| Path | Current behavior | Why mixed hydration exists | Required correction |
| --- | --- | --- | --- |
| `districtBridgeCombinedView()` | returns merged canonical + derived + compatibility fields in one object | consumers can render controls and outputs from same payload | keep `getView()` thin compatibility only; canonical/derived selectors become primary |
| `outcomeBridgeCombinedView()` | merges canonical inputs + derived MC/governance/sensitivity/surface output | `getView()` consumers can accidentally hydrate controls from mixed object | enforce canonical-only control reads and derived-only output reads |
| `js/app/v3/stateBridge.js` district snapshot helpers | some helpers resolve summary/template through both canonical and derived objects | compatibility fallback to `getView()` blurs ownership | expose explicit canonical/derived readers only |
| `js/app/v3/surfaces/outcome.js` | bridge-derived values are mixed with UI fallback derivations in render path | render layer performs fallback derivation when bridge values missing | derived selector output must be complete and authoritative |
| `js/app/v3/surfaces/turnout.js` | bridge summary uses bridge output then snapshot fallback text | fallback enables render-derived hydration | remove fallback text ownership from surface layer |
| `js/app/v3/surfaces/plan.js` / `reach.js` / `decisionLog.js` | primarily consume `api.getView()` only | no canonical vs derived contract at module boundary | add split bridge contracts per major module |

## `lastRenderCtx` / Render-Cache Dependency Inventory

| Location | Current dependency on render-derived context | Impact | Target state |
| --- | --- | --- | --- |
| `districtBridgeDerivedView` in `js/appRuntime.js` | reads `lastRenderCtx.res` for support/turnout/history impact | derived outputs tied to runtime cache object | move derivation into pure selectors fed by canonical state + deterministic engine outputs |
| `outcomeBridgeDerivedGovernanceView` in `js/appRuntime.js` | computes governance using `lastRenderCtx.res/weeks` | derived ownership tied to runtime cache | outcome derived selectors compute from canonical + engine pipeline |
| `decisionBridgeDiagnosticsSnapshot` in `js/appRuntime.js` | reads `lastRenderCtx.executionSnapshot/weeklyContext/weeks` | diagnostics tied to render cache lifecycle | diagnostics selectors consume deterministic derived snapshot registry |
| `reachBridgeResolveContext` in `js/appRuntime.js` | builds context from `lastRenderCtx` then fallback compute | mixed cache + recompute path in bridge | canonical selector pipeline for field-capacity derived views |
| report composition (`dataBridgeComposeReport`) | passes `lastRenderCtx` into composer | reporting payload depends on render cache source | reporting derived selector should consume canonical snapshot registry |

## Bridge Payload Fields That Are Actually UI/Bridge Caches

Current `state.census` carries bridge-centric fields used for UI transport:

- `bridgeApiKey`
- `bridgeGeoPaste`
- `bridgeElectionCsvPrecinctFilter`
- `bridgeStateOptions`
- `bridgeCountyOptions`
- `bridgePlaceOptions`
- `bridgeTractFilterOptions`
- `bridgeSelectionSetOptions`
- `bridgeGeoSelectOptions`
- `bridgeAggregateRows`
- `bridgeAdvisoryRows`
- `bridgeElectionPreviewRows`
- `bridgeAdvisoryStatusText`
- `bridgeElectionCsvGuideStatusText`
- `bridgeElectionCsvDryRunStatusText`
- `bridgeElectionCsvPreviewMetaText`
- `bridgeMapStatusText`
- `bridgeMapQaVtdZipStatusText`

These fields represent mixed owner concerns and must be split into canonical domain state + derived selector outputs.

## Ownership Stop/Go Decision (Phase 0B)

- Ownership mapping complete for current architecture.
- Mixed hydration and render-cache dependencies are explicitly identified.
- Ready to move to schema/domain ownership implementation (Phase 1).
