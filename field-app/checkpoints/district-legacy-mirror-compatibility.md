# District Legacy Mirror Compatibility Layer (Transitional)

Date: 2026-03-21
Status: Temporary compatibility only (not canonical truth)

## Why this layer remains
Remaining District mirror writes in `js/appRuntime.js` are still required by active legacy read paths that have not yet been migrated to domain selectors/domain-model adapters.

## Transitional dependencies
1. District derived bridge view
- `districtBridgeDerivedView()` consumes compatibility mirror fields for summary/ballot status fallbacks (for example universe/turnout/candidate table and candidate-history-derived messaging).

2. Election/model input builders
- `computeElectionSnapshot({ state })` and `buildModelInputFromState()/buildModelInputFromSnapshot()` still consume top-level planning fields (`candidates`, `undecidedPct`, `userSplit`, turnout/universe/template inputs).

3. Outcome MC/surface/confidence paths
- Outcome bridge and MC/sensitivity flows still call planning/model-input builders against whole-state snapshots, so District mirror values still influence downstream outcome calculations.

## Scope note for `districtPendingWrites`
- `districtPendingWrites` is no longer part of replacement Race Context / Electorate / Ballot / Candidate History control persistence.
- It remains active only in District Targeting/Census binders as a transitional stale-sync hold path.

## Migration intent (separate follow-up)
Do not remove this layer in the current fix. After manual verification is complete, execute a separate migration to replace legacy mirror read paths with domain selectors or an explicit domain->model adapter, then retire mirror writes safely.
