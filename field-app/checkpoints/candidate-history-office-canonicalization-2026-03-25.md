# Candidate-History Office Canonicalization Hardening (2026-03-25)

Status: complete (compatibility hardening pass)

## Canonical office mapping (candidate-history)
- Added a shared candidate-history office canonicalizer in `js/core/candidateHistoryBaseline.js`.
- Canonical candidate-history office IDs enforced:
  - `municipal_executive`
  - `municipal_legislative`
  - `countywide`
  - `state_house`
  - `state_senate`
  - `congressional_district`
  - `statewide_executive`
  - `statewide_federal`
  - `judicial_other`
  - `custom_context`
- Canonicalizer covers required aliases including:
  - `governor` / `gov` / `statewide governor` -> `statewide_executive`
  - `u.s. senate` / `us senate` -> `statewide_federal`
  - `u.s. house` / `us house` / `congressional` -> `congressional_district`
  - `state house` / `state rep` -> `state_house`
  - `state senate` -> `state_senate`
  - `mayor` -> `municipal_executive`
  - `city council` / `ward` / `alderman` -> `municipal_legislative`
  - `judge` / `judicial` -> `judicial_other`

## Compatibility handling for legacy race buckets
- Legacy race buckets are kept as compatibility inputs only and mapped immediately when used for candidate-history office context:
  - `federal` -> `congressional_district`
  - `state_leg` -> `state_house`
  - `municipal` -> `municipal_legislative`
  - `county` -> `countywide`
- Candidate-history matching now compares canonicalized office keys instead of brittle raw-lowercase text.
- Model-input office context now prefers template canonical context (`templateMeta.appliedTemplateId` / `officeLevel`) before falling back to legacy tokens.

## Remaining intentional legacy paths
- `state.raceType` legacy tokens remain intentional compatibility state for older saved snapshots and existing template resolver contracts.
- Template resolver (`js/app/templateResolver.js`) continues to accept legacy race buckets as input and resolves them to modern template IDs.
- Benchmarks/data-source compatibility paths still accept legacy race buckets where upstream dataset vocabularies remain legacy-facing.

## Scope notes
- No changes to support-adjustment formulas, deterministic win math structure, Monte Carlo, optimizer, exports, or unrelated UI architecture.
- UI candidate-history office entry is now canonical-option driven (select path) while preserving compatibility for previously stored unknown values.
