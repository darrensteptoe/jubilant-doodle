# Full Rewire Phase 5 - District Full Rebuild

## Scope
- Moved District surface implementation to `js/app/v3/surfaces/district/index.js` with compatibility entry at `js/app/v3/surfaces/district.js`.
- Decomposed District rendering into module files:
  - `raceSetup.js`
  - `templateProfile.js`
  - `ballot.js`
  - `candidateHistory.js`
  - `electionDataSummary.js`
  - `targetingConfig.js`
  - `censusConfig.js`
  - `summary.js`
- Added District phase integrity assertions in `phase5.integrity.test.js`.

## Canonical/Derived lane split
- Controls hydrate from canonical readers:
  - `readDistrictControlSnapshot`
  - `readDistrictTemplateSnapshot`
  - `readDistrictFormSnapshot`
  - `readDistrictBallotSnapshot`
  - `readDistrictTargetingConfigSnapshot`
  - `readDistrictCensusConfigSnapshot`
- Outputs hydrate from derived readers:
  - `readDistrictSummarySnapshot`
  - `readDistrictTargetingResultsSnapshot`
  - `readDistrictCensusResultsSnapshot`
  - `readDistrictElectionDataSummarySnapshot`

## Bridge updates
- `districtBridgeDerivedView` now computes from `computeElectionSnapshot({ state })` instead of `lastRenderCtx`.
- Added canonical+derived `electionData` summary payload to district bridge views.
- Added state bridge reader `readDistrictElectionDataSummarySnapshot`.
- Added state bridge reader `readDistrictSummarySnapshot` and kept `readDistrictSnapshot` as a compatibility wrapper.

## Layout and module orchestration
- District remains on center-stack full-width layout contract.
- Election Data summary card is now a first-class District center module and included in District analysis stack.

## Interaction inventory and gates
- Updated district source references in `interaction/interaction-inventory.csv` from `surfaces/district.js` to `surfaces/district/index.js`.
- Updated `scripts/district-integrity.mjs` to validate the decomposed District entry path and summary reader usage.
