# Phase 1 — Full Rewire Canonical State Schema

Date: 2026-03-20

## Scope

- Canonical schema implementation: `js/core/state/schema.js`
- Ownership registry and duplicate-owner assertions: `FIELD_OWNERSHIP_REGISTRY`, `findDuplicateFieldOwnership`
- Legacy migration entrypoint: `migrateLegacyStateToCanonical(...)`

## Canonical Domain Ownership

Each editable field is assigned to one canonical domain in `FIELD_OWNERSHIP_REGISTRY`:

- `campaign`: campaign context identity and scenario naming
- `district`: race setup, template profile, district form, universe composition
- `assumptions`: persuasion/contact/turnout assumptions
- `ballot`: candidate rows, undecided config, user split ownership
- `candidateHistory`: historical candidate records and coverage signals
- `targeting`: targeting config/criteria/weights/runtime result rows
- `census`: census config, selection context, census runtime result payload
- `electionData`: election CSV import/mapping/rows/reconciliation refs/QA/benchmarks
- `outcome`: MC controls and outcome runtime caches
- `fieldCapacity`: staffing and channel throughput capacity inputs
- `weatherRisk`: weather ingest and model adjustment controls
- `eventCalendar`: calendar filters/draft/events/status summaries
- `forecastArchive`: archive entries and archive summaries
- `recovery`: import/backup recovery policy and status
- `governance`: governance snapshots and recommendation state
- `scenarios`: active/selected scenario references and scenario records
- `audit`: validation/realism/diagnostics findings
- `ui`: strictly UI display/navigation preferences

## `electionData` Canonical Schema (First-Class Domain)

Canonical `domains.electionData` now defines:

- import metadata: `import.fileName`, `fileSize`, `fileHash`, `importedAt`, `format`, status fields
- mapping state: `schemaMapping.requiredColumns`, `optionalColumns`, `columnMap`, mapped/unmapped columns
- records: `rawRows`, `normalizedRows`
- normalized references:
  - `geographyRefs.{byId,order}`
  - `candidateRefs.{byId,order}`
  - `partyRefs.{byId,order}`
- race meta: office, district, election type/date, cycle year
- turnout/vote totals: ballots, registered voters, write-ins/undervotes/overvotes
- QA and quality: warning/error lists plus score/confidence/completeness
- benchmark outputs:
  - historical race benchmarks
  - turnout baselines
  - volatility bands
  - party baseline context
  - comparable race pools
  - repeat candidate performance
  - precinct performance distributions
  - geography rollups
  - benchmark suggestions
  - downstream recommendation payloads (`district`, `targeting`, `outcome`)

## Normalized Candidate + Geography References

`normalizeElectionDataSlice(...)` computes deterministic normalized references:

- candidate identity is normalized to `candidateRefs.byId[candidateId]`
- geography identity is normalized to `geographyRefs.byId[geographyId]`
- party identity is normalized to `partyRefs.byId[partyId]`
- canonical `jurisdictionKeys` are deduped from normalized rows
- turnout/vote summaries and quality score derive directly from normalized rows + QA warnings

## Migration Path (Current State -> Canonical Domains)

`migrateLegacyStateToCanonical(legacyState)` supports:

1. Existing canonical payloads (`schemaVersion === CANONICAL_SCHEMA_VERSION`) and normalizes `electionData`.
2. Legacy flat state migration:
   - maps district, ballot, candidate history, targeting, census, outcome, weather, event, reporting, scenario, audit, and ui fields into domain slices.
   - migrates Census election dry-run bridge payload (`bridgeElectionPreviewRows`, `bridgeElectionCsv*`) into first-class canonical `electionData` via `coerceLegacyElectionPreviewRows(...)`.
   - preserves revision and stamps `updatedAt`.

## Phase 1 Tests Added

New schema tests in `js/core/state/schema.test.js` verify:

- canonical defaults and domain presence
- migration shape from legacy state into canonical domains
- duplicate field-ownership detection (must be empty)
- electionData normalization shape (refs/totals/quality)

## Phase 1 Stop/Go Decision

- Canonical state schema and migration path are implemented.
- Ownership registry and duplicate-owner checks are in place.
- Election data is promoted into a first-class canonical domain schema (state-level).
- Ready for gate command execution and verification.
