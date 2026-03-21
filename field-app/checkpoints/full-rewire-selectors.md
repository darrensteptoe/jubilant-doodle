# Phase 3 — Full Rewire Selector / Derivation Layer

Date: 2026-03-20

## Deliverables Landed

Selector modules added under `js/core/selectors/*`:

- `js/core/selectors/_core.js`
- `js/core/selectors/districtCanonical.js`
- `js/core/selectors/districtDerived.js`
- `js/core/selectors/electionDataCanonical.js`
- `js/core/selectors/electionDataDerived.js`
- `js/core/selectors/targetingCanonical.js`
- `js/core/selectors/targetingDerived.js`
- `js/core/selectors/censusCanonical.js`
- `js/core/selectors/censusDerived.js`
- `js/core/selectors/weatherRiskCanonical.js`
- `js/core/selectors/weatherRiskDerived.js`
- `js/core/selectors/eventCalendarCanonical.js`
- `js/core/selectors/eventCalendarDerived.js`
- `js/core/selectors/outcomeCanonical.js`
- `js/core/selectors/outcomeDerived.js`
- `js/core/selectors/index.js`

Selector tests:

- `js/core/selectors/selectors.test.js`

## Canonical Selectors

Canonical selectors now expose editable/config ownership snapshots by domain:

- `selectDistrictCanonicalView`
- `selectElectionDataCanonicalView`
- `selectTargetingCanonicalView`
- `selectCensusCanonicalView`
- `selectWeatherRiskCanonicalView`
- `selectEventCalendarCanonicalView`
- `selectOutcomeCanonicalView`

Each canonical selector:

- normalizes incoming state through canonical schema guard (`ensureCanonicalState`)
- reads from canonical domain ownership only
- returns cloned snapshots to prevent accidental external mutation of state references

## Derived Selectors

Derived selectors now expose output/status/result summaries by domain:

- `selectDistrictDerivedView`
- `selectElectionDataDerivedView`
- `selectTargetingDerivedView`
- `selectCensusDerivedView`
- `selectWeatherRiskDerivedView`
- `selectEventCalendarDerivedView`
- `selectOutcomeDerivedView`

Derived selectors are pure read transforms over canonical state and compute:

- district support/turnout/history/election-data summaries
- election data coverage/totals/quality/benchmark summaries
- targeting status/performance/composition summaries
- census fetch/map/aggregate summaries
- weather risk status/forecast/risk summaries
- event calendar summary/upcoming event views
- outcome MC/sensitivity/surface summaries

## Determinism and Purity Guarantees

`js/core/selectors/selectors.test.js` validates:

- same input returns same output (determinism)
- selectors do not mutate input state
- canonical selectors do not depend on render-derived noise (`lastRenderCtx`, cache shims)
- derived selectors do not expose editable-owner root keys (`form`, `config`, `controls`, etc.)

## Phase 3 Stop/Go Decision

- Canonical/derived selector pair coverage exists for all required major modules.
- Selector purity and determinism are test-backed.
- Ready to proceed to layout standardization and module bridge/surface rewires.
