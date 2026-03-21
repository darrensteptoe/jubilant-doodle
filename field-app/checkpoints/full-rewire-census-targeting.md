# Phase 7 - Census and Targeting Rewire

## Scope landed
- Kept `census.config` and `census.selection` as canonical owner lanes for Census inputs.
- Kept `census.runtime` as derived/status lane and surfaced it only via derived selectors.
- Expanded Targeting canonical selector to consume upstream canonical inputs from:
  - `district` (race + turnout context)
  - `census` (scope + loaded GEO state)
  - `electionData` (quality + benchmark/downstream targeting recommendations)
- Expanded Targeting derived selector to compute:
  - upstream readiness flags
  - stale-upstream detection (`staleSinceUpstreamChange`)
  - election-influence coverage metrics and explanation text
  - recommendation guidance (`recommendedMinScore`)

## Files
- `js/core/selectors/targetingCanonical.js`
- `js/core/selectors/targetingDerived.js`
- `js/core/selectors/phase7.integration.test.js`
- `js/app/v3/surfaces/district/phase7.integrity.test.js`

## Test intent
- Targeting config persistence
- Census config persistence
- District/Census/Election canonical propagation into Targeting canonical view
- Targeting derived recompute behavior when upstream Census/Election inputs change
- District center-stack layout consistency for Census + Targeting cards

