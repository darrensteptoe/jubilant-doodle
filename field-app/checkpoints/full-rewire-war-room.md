# Phase 8 - War Room / Decision Log Decomposition

## Scope landed
- Introduced a dedicated `warRoom` surface module directory.
- Converted `decisionLog` surface export into a compatibility wrapper to the new `warRoom` surface.
- Split War Room orchestration responsibilities across module files:
  - `decisionSessions`
  - `diagnostics`
  - `weatherRisk`
  - `eventCalendar`
  - `actionLog`
- Moved sync and event-binding responsibilities out of the surface index into module-level orchestrators.
- Added boundary tests that enforce weather/event state ownership separation in canonical actions.

## Files
- `js/app/v3/surfaces/warRoom/index.js`
- `js/app/v3/surfaces/warRoom/decisionSessions.js`
- `js/app/v3/surfaces/warRoom/diagnostics.js`
- `js/app/v3/surfaces/warRoom/weatherRisk.js`
- `js/app/v3/surfaces/warRoom/eventCalendar.js`
- `js/app/v3/surfaces/warRoom/actionLog.js`
- `js/app/v3/surfaces/decisionLog.js`
- `js/app/v3/surfaces/warRoom/phase8.integrity.test.js`
- `js/core/actions/phase8.boundary.test.js`
- `js/app/v3/surfaces/layoutContract.test.js`

## Test intent
- weather module must not own event fields
- event module must not own weather fields
- weather/event action boundaries remain isolated at domain level
- action sequences preserve unrelated canonical state
- war room surface uses full-width center stack contract
