# Phase 0B — Full Rewire Election Data Map

Date: 2026-03-20

## Current Election Data Footprint (Pre-Promotion)

Election data is currently implemented as a Census-adjacent dry-run workflow, not a first-class domain.

## Touchpoint Inventory

| Layer | File(s) | Current capability | Current owner |
| --- | --- | --- | --- |
| Schema/template helpers | `js/core/censusModule.js` (`getElectionCsvUploadGuide`, `buildElectionCsvTemplate`, `buildElectionCsvWideTemplate`) | Election CSV guide + templates | Census module |
| CSV parsing | `js/core/censusModule.js` (`parseCsvText`, `detectElectionCsvFormat`, `normalizeElectionCsvRows`) | parse + format detect + normalize long/wide rows | Census module |
| Dry-run execution/state | `js/app/censusPhase1.js` (`electionCsvDryRun` object and handlers) | file pick, dry-run status, preview rows, precinct filter | Census runtime |
| Bridge transport | `js/app/censusPhase1.js` -> `state.census.bridgeElection*` | preview/status text transported into state for district proxy | Census runtime |
| District bridge exposure | `js/appRuntime.js` (`districtBridgeDerivedView.census.*`) | passes election guide/dry-run/preview as census-derived text/rows | District bridge |
| District UI rendering | `js/app/v3/surfaces/district.js` (Census proxy card) | shows election dry-run statuses and preview table | District surface |
| Related election adapters | `js/core/electionProviderAdapter.js`, `js/core/districtEvidence*.js`, `js/core/precinctCensusJoin.js` | election precinct normalization and evidence joins | Core evidence modules |

## Current Canonical Ownership Reality

| Data category | Current storage location | Problem |
| --- | --- | --- |
| file metadata | runtime locals in `censusPhase1` + bridge text fields | not canonical and not domain-owned |
| column mapping | inferred in parser execution only | no persisted first-class mapping object |
| raw rows | ephemeral dry-run records | no stable canonical row store |
| normalized rows | preview rows in bridge transport format | flattened for display, not reusable domain object |
| candidate/geography reconciliation | not explicit; candidate names/geographies passed through parser | no dedicated reconciliation pipeline |
| quality/confidence score | warning/error strings only | no domain-level quality scoring object |
| downstream recommendations | not modeled | District/Targeting/Outcome consume little/no structured election-data output |

## Mixed-Hydration and Coupling Findings

- Election data UI lives inside District Census card, so it is page-coupled and cannot move independently.
- Election dry-run fields are stored as `state.census.bridge*` transport keys, mixing canonical config and derived UI payloads.
- District bridge exposes election outputs under `census` derived output, so Election data has no standalone bridge contract.
- No dedicated selector pair exists (`canonical` vs `derived`) for election data.

## Required Promotion Mapping (Target)

| Current concern | Target domain/module |
| --- | --- |
| upload metadata + import status | `electionData.import` |
| mapping configuration | `electionData.schemaMapping` |
| raw parsed rows | `electionData.rawRows` |
| normalized records | `electionData.normalizedRows` |
| candidate reconciliation | `electionData.candidateMap` + `reconcileCandidates` logic |
| geography reconciliation | `electionData.geographyMap` + `reconcileGeographies` logic |
| benchmark outputs | `electionData.benchmarks` |
| QA/confidence scoring | `electionData.quality` |
| downstream recommendations | `electionData.downstreamRecommendations.{district,targeting,outcome}` |

## Planned Module Split for Promotion

Core logic targets:

- `js/core/electionData/importCsv.js`
- `js/core/electionData/mapColumns.js`
- `js/core/electionData/normalizeRows.js`
- `js/core/electionData/reconcileCandidates.js`
- `js/core/electionData/reconcileGeographies.js`
- `js/core/electionData/benchmarks.js`
- `js/core/electionData/quality.js`

State/selectors/actions targets:

- `js/core/actions/electionData.js`
- `js/core/selectors/electionDataCanonical.js`
- `js/core/selectors/electionDataDerived.js`

Bridge/UI targets:

- `js/app/v3/bridges/electionDataBridge.js`
- `js/app/v3/surfaces/electionData/index.js`
- `js/app/v3/surfaces/electionData/importPanel.js`
- `js/app/v3/surfaces/electionData/columnMapping.js`
- `js/app/v3/surfaces/electionData/normalizedPreview.js`
- `js/app/v3/surfaces/electionData/candidateReconciliation.js`
- `js/app/v3/surfaces/electionData/geographyReconciliation.js`
- `js/app/v3/surfaces/electionData/benchmarks.js`
- `js/app/v3/surfaces/electionData/qualityPanel.js`

## Migration Direction (from current state)

1. Preserve current Census CSV parser behavior as compatibility source.
2. Move parsed/dry-run payload into canonical `electionData` slice.
3. Replace `state.census.bridgeElection*` transport fields with `electionData` canonical + derived selector output.
4. Keep District with an Election Data summary consumer module only.
5. Add Targeting and Outcome explanation hooks driven by `electionData` derived outputs.

## Election Data Map Stop/Go Decision

- Election CSV touchpoints are fully inventoried.
- Current ownership and coupling faults are explicitly mapped.
- Ready for Phase 6 promotion work after schema/actions/selectors groundwork.
