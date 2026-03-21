# Post-Rebuild Baseline (H1)

## Baseline snapshot
- Captured: 2026-03-20 (America/Chicago)
- Scope: rebuilt app shell + domain actions/selectors + bridge contracts + decomposed v3 surfaces.
- Known-good gate status in this block: `npm run gate:rebuild` passed (`strict-gate: PASS`).

## Major module inventory

### Core state
- `js/core/state/schema.js`
- `js/core/state/schema.test.js`
- `js/core/state/ownershipAssertions.js`
- `js/core/state/ownershipAssertions.test.js`

### Core action modules
- `js/core/actions/district.js`
- `js/core/actions/ballot.js`
- `js/core/actions/candidateHistory.js`
- `js/core/actions/targeting.js`
- `js/core/actions/census.js`
- `js/core/actions/electionData.js`
- `js/core/actions/weatherRisk.js`
- `js/core/actions/eventCalendar.js`
- `js/core/actions/forecastArchive.js`
- `js/core/actions/outcome.js`

### Selector inventory
- Canonical: `districtCanonical`, `electionDataCanonical`, `targetingCanonical`, `censusCanonical`, `weatherRiskCanonical`, `eventCalendarCanonical`, `outcomeCanonical`
- Derived: `districtDerived`, `electionDataDerived`, `targetingDerived`, `censusDerived`, `weatherRiskDerived`, `eventCalendarDerived`, `outcomeDerived`

### Bridge contract inventory (rewritten)
- `js/app/v3/bridges/districtBridge.js`
  - `readDistrictCanonicalBridgeView()`
  - `readDistrictDerivedBridgeView()`
  - `readDistrictBridgeView()` compatibility fallback
- `js/app/v3/bridges/electionDataBridge.js`
  - `getCanonicalView()`
  - `getDerivedView()`
  - `getView()` compatibility aggregate
- `js/app/v3/bridges/outcomeBridge.js`
  - `readOutcomeCanonicalBridgeView()`
  - `readOutcomeDerivedBridgeView()`
  - `readOutcomeBridgeView()` compatibility fallback
- `js/app/v3/bridges/weatherRiskBridge.js`
  - decision-bridge wrapper (`readWeatherRiskCanonicalView`, mutation wrappers)
- `js/app/v3/bridges/eventCalendarBridge.js`
  - decision-bridge wrapper (`readEventCalendarCanonicalView`, mutation wrappers)

### Rewritten/decomposed v3 surface directories
- `js/app/v3/surfaces/district/`
- `js/app/v3/surfaces/warRoom/`
- `js/app/v3/surfaces/data/`
- `js/app/v3/surfaces/outcome/`
- `js/app/v3/surfaces/electionData/`

## Current test/gate status (actual)
- `node --test js/core/state/ownershipAssertions.test.js`
  - PASS (7 tests, 0 fail)
- `npm run check:contracts`
  - PASS (`contracts-diagnostics-check: ok entries=5 blockers=0 violations=3 warnings=2 info=0`)
- `npm run build`
  - PASS (`vite build` completed)
- `npm run gate:rebuild`
  - PASS (`strict-gate: PASS`)

## Rollback/checkpoint reference
- Existing rebuild checkpoint docs are present under `checkpoints/` including `release_checkpoint_2026-03-19.md` and `full-rewire-legacy-retirement.md`.
