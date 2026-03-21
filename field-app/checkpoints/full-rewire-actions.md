# Phase 2 — Full Rewire Shared Mutation Layer

Date: 2026-03-20

## Deliverables Landed

Action modules added under `js/core/actions/*`:

- `js/core/actions/_core.js`
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
- `js/core/actions/index.js`

Action tests:

- `js/core/actions/actions.test.js`

## Shared Mutation Contract

`_core.js` now provides a common mutation contract for all domain actions:

- `ensureCanonicalState(state)` migrates legacy or canonical input to canonical schema.
- `mutateDomain(state, domain, mutateFn, options)` enforces:
  - one-domain write per action
  - root revision bump
  - target domain revision bump
  - updated timestamp refresh
  - scenario lock guard (`campaign.contextLock.scenario`)
- `makeActionResult(...)` standardizes result payload shape (`changed`, `blocked`, `reason`).

This establishes a deterministic action entrypoint for canonical state writes.

## Domain Action Coverage

### District

- `updateDistrictFormField`
- `updateDistrictTemplateField`
- `applyDistrictTemplate`
- `updateDistrictUniverseField`

### Ballot

- `addBallotCandidate`
- `updateBallotCandidate`
- `removeBallotCandidate`
- `updateBallotUserSplit`
- `setBallotUndecided`
- `replaceBallotCandidates`

### Candidate History

- `addCandidateHistoryRecord`
- `updateCandidateHistoryRecord`
- `removeCandidateHistoryRecord`

### Targeting

- `updateTargetingConfig`
- `updateTargetingCriteria`
- `updateTargetingWeights`
- `applyTargetingRunResult`

### Census

- `updateCensusConfig`
- `updateCensusSelection`
- `setCensusRuntimeResults`

### Election Data

- `importElectionDataFile`
- `mapElectionDataColumns`
- `reconcileElectionDataCandidates`
- `reconcileElectionDataGeographies`
- `applyElectionBenchmarks`

### Weather Risk

- `updateWeatherRiskConfig`
- `applyWeatherRiskSnapshot`
- `updateWeatherRiskAdjustment`

### Event Calendar

- `updateEventCalendarFilters`
- `saveEventCalendarEvent`
- `deleteEventCalendarEvent`

### Forecast Archive

- `saveForecastArchiveActual`
- `selectForecastArchiveEntry`

### Outcome

- `updateOutcomeControlField`
- `runOutcomeMc`
- `updateOutcomeSurface`

## Input Normalization + Revision Discipline

Actions now normalize payload inputs at write boundaries:

- numeric fields are coerced with finite checks
- boolean fields normalize from common truthy tokens
- text fields are trimmed
- row/event payloads are cloned before storage

Revision discipline:

- all successful writes increment top-level canonical `revision`
- all successful writes increment target domain `revision`
- no-op writes do not increment revisions

## No-Unrelated-Slice-Drift Rule

`mutateDomain` only replaces:

- root state object
- `domains` object
- one mutated domain object

Unrelated domain object references remain unchanged, enabling strict drift tests.

## Phase 2 Tests Added

`js/core/actions/actions.test.js` covers:

- field updates and slice drift assertions
- row add/remove/edit for ballot and candidate history
- district template application
- election CSV import, column mapping, candidate reconciliation, geography reconciliation
- benchmark apply payload
- scenario lock behavior (blocked mutation)
- cross-domain action coverage (census, weather, event calendar, forecast archive, outcome)

## Phase 2 Stop/Go Decision

- Shared mutation layer exists and is test-backed for canonical domain actions.
- Action modules are ready for selector/bridge integration phases.
- Ready for Phase 3 selector-layer implementation.
