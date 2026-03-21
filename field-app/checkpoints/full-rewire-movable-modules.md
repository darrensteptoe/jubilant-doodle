# Phase 0A — Full Rewire Movable Modules Map

Date: 2026-03-20

## Purpose

Identify modules that must become independently movable and what currently blocks safe movement.

## Movability Inventory

| Target module | Current location | Current hard dependencies | Current coupling risk | Required decoupling work | Target landing type |
| --- | --- | --- | --- | --- | --- |
| District race setup | `js/app/v3/surfaces/district.js` | district bridge `getView/getCanonicalView/getDerivedView`, shared DOM ids | medium | isolate to own file and consume canonical selector snapshot only | district surface module |
| District template profile | `js/app/v3/surfaces/district.js` | template defaults in appRuntime, assumptions profile in `state.ui` | medium | dedicated actions/selectors for template dimensions and override metadata | district surface module |
| District ballot | `js/app/v3/surfaces/district.js` | direct dependence on district bridge methods and mixed combined view fallback | high | separate ballot actions + canonical selector; stop combined view fallback | district surface module |
| District candidate history | `js/app/v3/surfaces/district.js` | `candidateHistory` writes in appRuntime; derived confidence from `lastRenderCtx` | high | canonical history domain + derived history selector pipeline | district surface module |
| District census config | `js/app/v3/surfaces/district.js` | relies on Census runtime API fallback and `state.census` bridge fields | high | dedicated census module contract (`getCanonicalView/getDerivedView`) | district surface module |
| District election data summary | inside District census card | election CSV currently embedded in census dry-run state | high | promote to `electionData` domain and standalone summary consumer | district submodule |
| District targeting config/results | `js/app/v3/surfaces/district.js` | targeting state and run action coupled to district bridge | medium | targeting actions/selectors separated from district orchestration | district surface module |
| District summary | `js/app/v3/surfaces/district.js` | summary values currently built from bridge-derived output | medium | summary selector consumes district derived selector only | district surface module |
| War Room decision sessions | `js/app/v3/surfaces/decisionLog.js` | decision + weather + events all in one `getView()` payload | high | split decision sessions from diagnostics/weather/events/action log | warRoom module |
| War Room diagnostics | `js/app/v3/surfaces/decisionLog.js` | diagnostics rely on `lastRenderCtx` and session view bundling | high | dedicated diagnostics selector with explicit inputs | warRoom module |
| War Room weather risk | `js/app/v3/surfaces/decisionLog.js` | weather nested in decision bridge state view | high | weather bridge/module separation and domain ownership | warRoom module |
| War Room event calendar | `js/app/v3/surfaces/decisionLog.js` | event calendar nested in decision bridge state view | high | event calendar bridge/module separation and domain ownership | warRoom module |
| War Room action log | `js/app/v3/surfaces/decisionLog.js` | action log tied to decision session warRoom payload | medium | isolate decision-log rows/actions in dedicated module | warRoom module |
| Data import/export | `js/app/v3/surfaces/data.js` | mixed Data bridge payload with reporting/archive/recovery | high | split import/export actions and selectors from archive/reporting | data module |
| Data recovery | `js/app/v3/surfaces/data.js` | backup/USB status mixed with other data sections | medium | dedicated recovery module and recovery domain ownership | data module |
| Forecast archive | `js/app/v3/surfaces/data.js` | archive + reporting + learning in same view object | medium | explicit forecastArchive selectors and actions | data module |
| Learning | `js/app/v3/surfaces/data.js` | coupled to archive/reporting state view | medium | own submodule reading derived archive outputs | data module |
| Reporting | `js/app/v3/surfaces/data.js` | compose/export and preview coupled to same bridge object | medium | reporting module with dedicated canonical/derived selectors | data module |
| Outcome forecast | `js/app/v3/surfaces/outcome.js` | combined outcome bridge with getView compatibility reads | medium | forecast submodule consuming canonical outcome selectors | outcome module |
| Outcome governance | `js/app/v3/surfaces/outcome.js` | governance derived path depends on `lastRenderCtx` | high | derived governance selector from canonical outputs only | outcome module |
| Outcome sensitivity | `js/app/v3/surfaces/outcome.js` | sensitivity data partly from decision bridge caches | high | sensitivity selector and action boundary in outcome domain | outcome module |
| Outcome surface/stress | `js/app/v3/surfaces/outcome.js` | runtime write/read coupling in `state.ui.lastOutcomeSurface*` | medium | dedicated surface action path + derived selector | outcome module |
| Standalone Election Data workspace | currently absent (only Census dry-run + district census panel) | Census runtime + bridge-only election fields | critical | create new electionData surface, bridge, domain, actions, selectors | top-level surface |

## Module Moveability Readiness Classes

- `Critical`: currently blocked by cross-domain ownership and/or mixed hydration (`district candidate history`, `district election CSV`, `warRoom weather/event`, `standalone electionData`).
- `High`: blocked by bundled bridge payloads and shared write handlers (`decision sessions`, `data import/export`, `outcome governance`).
- `Medium`: mostly structural split with contract alignment needed (`district race setup`, `forecast archive`, `reporting`).

## Required Guardrails Before Move Operations

- module mount/unmount tests per movable module
- explicit module boundary tests (cross-domain write attempts fail)
- canonical-state persistence tests through stage navigation
- bridge-level canonical/derived contract tests for moved modules

## Phase 0A Gate Result

- Behavior-changing code: none.
- This file is an audit artifact only.
