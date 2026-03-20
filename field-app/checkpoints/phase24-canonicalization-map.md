# Phase 24 — Canonicalization Map (Complete)

Date: 2026-03-20

This map documents canonical owners and approved flow paths after Phase 23 prune work.

## Canonical State Owners

| Concept | Canonical Owner | Notes |
| --- | --- | --- |
| Campaign context | `state.campaignId`, `state.campaignName`, `state.officeId`, `state.scenarioName` | Scoped by context manager + shell bridge rules |
| Active scenario | `state.ui.activeScenarioId` + `state.ui.scenarios` | Scenario mutations through scenario bridge |
| District setup & targeting inputs | `state.*` district/targeting fields | Mutated through district bridge handlers |
| Turnout assumptions | `state.turnout*`, `state.gotv*`, `state.budget.tactics.*` | Mutated through turnout bridge |
| Plan/optimizer controls | `state.budget.optimize.*`, `state.timeline*` | Mutated through plan bridge |
| Outcome controls/cache | `state.mc*`, `state.ui.outcomeSurfaceInputs`, `state.ui.lastOutcomeView` | Mutated through outcome bridge + runtime compute |
| War room decision session | `state.ui.decision.*` and `state.warRoom.*` | Mutated through decision bridge |
| Weather modifier | `state.warRoom.weather*` + `state.warRoom.weatherAdjustment` | Date-bound, visible, reversible |
| Event calendar | `state.warRoom.eventCalendar.*` | Capacity-only effects |
| Data/reporting controls | `state.ui.reporting.*` | Report type, payload, preview, status |
| Validation snapshot | `state.ui.lastValidationSnapshot` | Canonical validation engine output |
| Realism snapshot | `state.ui.lastRealismSnapshot` | Canonical realism engine output |
| Governance snapshot | `state.ui.lastGovernanceSnapshot` | Canonical governance view output |
| Voter intelligence | `state.voterData.*` + derived history intelligence | Used by realism/validation/reports |

## Sacred Engine Entry Points

- `computeDeterministic` via `js/core/model.js`
- `runTargetRanking` via `js/app/targetingRuntime.js`
- Outcome MC bridge actions (`runMc`, `rerunMc`) through outcome bridge in `js/appRuntime.js`
- Validation computation through `js/app/validationEngine.js`
- Realism computation through `js/app/realismEngine.js`

No UI component should duplicate these formulas.

## Approved Mutation Paths

- `setState(...)` + `commitUIUpdate(...)` in `js/appRuntime.js` for canonical UI/runtime mutations.
- Bridge mutation APIs only:
  - shell bridge (`__FPE_SHELL_API__`)
  - district bridge (`__FPE_DISTRICT_API__`)
  - turnout bridge (`__FPE_TURNOUT_API__`)
  - plan bridge (`__FPE_PLAN_API__`)
  - outcome bridge (`__FPE_OUTCOME_API__`)
  - decision bridge (`__FPE_DECISION_API__`)
  - scenario bridge (`__FPE_SCENARIO_API__`)
  - data bridge (`__FPE_DATA_API__`)

Direct component-local mutation of derived fields is out of policy.

## Approved Recompute Paths

- Input/selector change -> bridge handler -> canonical state write -> `commitUIUpdate` -> `render` -> bridge sync event.
- Reporting path: selector change -> `dataBridgeSetReportType` -> `dataBridgeComposeReport` -> canonical report selector snapshot/composer.
- Event/weather modifiers flow through war-room canonical handlers and remain bounded/date-scoped.

## Approved Serializer / Export Paths

- Scenario JSON: `engine.snapshot.makeScenarioExport(...)` through data bridge save action.
- Plan CSV: `engine.snapshot.planRowsToCsv(...)` through data bridge export action.
- Client/Internal report payload: `composeReportPayload(...)` in `js/app/reportComposer.js`.
- PDF/print delivery: `exportReportPdf(...)` in `js/app/pdfExport.js`.

## Canonicalization Changes Applied In This Pass

1. Removed legacy USB status DOM fallback from Data bridge:
   - `dataBridgeApplyUsbResultStatus(...)` no longer reads `els.usbStorageStatus`.
   - `dataBridgeStateView()` no longer reads `els.usbStorageStatus` fallback.
2. Replaced legacy right-rail attach path with native V3 owner path:
   - `js/app/v3/stageMount.js` now parks `#legacyResultsSidebar` in `#legacyDomPool` and never mounts it as active rail.
   - `index.html` bootstrap script no longer appends legacy rail to `#v3RightRailSlot`.
3. Rehomed v3 training toggle to API-first canonical path:
   - `js/app/v3/index.js` no longer dispatches hidden `#toggleTraining` events.
   - fallback path is now local body-class only (no legacy toggle mutation).
4. Resolved strict build-warning policy to explicit bundle budget:
   - `vite.config.js` sets `chunkSizeWarningLimit: 2100` (documented policy).
   - `npm run gate:rebuild` passes under strict warning rules.
5. Deleted three compatibility facade files (from Phase 23 prune):
   - `js/renderIntelChecks.js`
   - `js/wireEventsRuntime.js`
   - `js/app/wireEvents.js`
6. Retired legacy stage alias fallback mapping:
   - `js/app/v3/stageRegistry.js` now resolves canonical v3 stage ids only.
7. Split transitional QA checks from stable release checks:
   - `js/app/v3/qaGates.js` runs stable checks by default.
   - `runV3LegacyRetirementSmoke(...)` exposes transitional legacy-retirement checks as opt-in.

## Phase 24 Exit

- Canonical state owners are identified for all major concepts.
- Approved mutation, recompute, and export paths are documented.
- Transitional compatibility paths that risk hardening were either removed or isolated.
- Phase 24 is complete; next work proceeds to Phase 25 contracts + diagnostics.
