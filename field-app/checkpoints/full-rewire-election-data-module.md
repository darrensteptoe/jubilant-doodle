# Phase 6 — Election Data Module

## Scope landed
- Promoted Election CSV workflow into first-class `electionData` canonical domain flow.
- Added dedicated election-data core pipeline modules:
  - `importCsv`
  - `mapColumns`
  - `normalizeRows`
  - `reconcileCandidates`
  - `reconcileGeographies`
  - `benchmarks`
  - `quality`
- Rewired election-data actions to use explicit pipeline stages and deterministic recompute.
- Added dedicated V3 election-data bridge (`__FPE_ELECTION_DATA_API__`) with split contract:
  - `getCanonicalView()`
  - `getDerivedView()`
  - `getView()` compatibility wrapper
- Added standalone V3 Election Data surface with decomposition:
  - `importPanel`
  - `columnMapping`
  - `normalizedPreview`
  - `candidateReconciliation`
  - `geographyReconciliation`
  - `benchmarks`
  - `qualityPanel`
- Added `election-data` stage registration + mount wiring.

## Canonical ownership emphasis
- All Election Data writes route through bridge actions:
  - import
  - map columns
  - reconcile candidates
  - reconcile geographies
  - apply benchmarks
- Surface controls hydrate from canonical/derived bridge snapshots, not render cache.

## Layout contract
- Election Data surface uses center-stack full-width shell:
  - `createCenterStackFrame`
  - `createCenterStackColumn`
  - `createCenterModuleCard`

## Test coverage added
- Core election data workflow tests:
  - import valid CSV
  - reject malformed CSV
  - map columns
  - normalize rows
  - reconcile candidates
  - reconcile geographies
  - benchmark generation
  - downstream selector payload availability
- Surface decomposition + bridge routing + layout contract assertions.
