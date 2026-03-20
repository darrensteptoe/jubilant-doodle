# Phase 21.25 - Ballot Baseline With Past Candidate Results

Status: complete (feature scope), hardening deferred per phase order.

## What was implemented
- Added canonical candidate-history baseline layer (`state.candidateHistory[]`) with required record fields:
  - `office`
  - `cycleYear`
  - `electionType`
  - `candidateName`
  - `party`
  - `incumbencyStatus`
  - `voteShare`
  - `margin`
  - `turnoutContext`
  - `repeatCandidate`
  - `overUnderPerformancePct`
- Wired District page controls to canonical mutation paths via District bridge:
  - add/update/remove candidate-history rows
  - no legacy shell callback dependency
- Integrated candidate-history into canonical ballot-baseline computation (not a parallel forecast engine):
  - deterministic support adjustment from historical over/underperformance + incumbency + repeat-candidate signal
  - normalized back to baseline support-share total
  - influence flows through standard expected-vote and persuasion-need outputs
- Added candidate-history confidence/coverage signals:
  - validation output (`res.validation.candidateHistory`)
  - expected-output impact payload (`res.expected.candidateHistoryImpact`)
- Added confidence degradation behavior for incomplete or missing candidate-history data:
  - validation warnings/critical readiness issues
  - governance data-quality penalty integration
- Threaded candidate-history into downstream canonical consumers:
  - template profile surface context
  - scenario persistence/compare inputs
  - war-room diagnostics via shared forecast/MC path
  - archive/export summary fields

## Key files changed
- `js/core/candidateHistoryBaseline.js` (new)
- `js/core/winMath.js`
- `js/core/modelInput.js`
- `js/core/types.d.ts`
- `js/app/defaultState.js`
- `js/app/normalizeLoadedState.js`
- `js/appRuntime.js`
- `js/app/v3/stateBridge.js`
- `js/app/v3/surfaces/district.js`
- `js/app/validationRules.js`
- `js/core/validationView.js`
- `js/core/modelGovernance.js`
- `js/core/forecastArchive.js`
- `js/export.js`
- `js/core/selfTestSuites/targeting.js`
- `interaction/interaction-inventory.csv`
- `interaction/interaction-results.json`
- `interaction/district-page-report.md`
- `interaction/interaction-tests.md`

## Validation executed
- `node js/core/selfTestSuites/targeting.js`
- `npm run check:interaction-integrity`
- `npm run check:interaction-pages`
- `npm run gate:rebuild`

## Result
- District candidate-history controls pass A-F interaction integrity checks.
- Tier-1 interaction stability remains `YES`.
- Remaining interaction fail is unchanged and expected for future Phase 21.5 (`report_type_selector`).
