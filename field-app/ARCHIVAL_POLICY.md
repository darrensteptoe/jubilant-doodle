# Archival Policy (Conservative)

Scope: safe folder organization without changing runtime behavior.

## Decision Order

1. Prove whether a path is active runtime, test/gate input, packaging input/output, or historical record.
2. If active or hard-wired, keep path unchanged.
3. If historical and intentionally preserved, keep path unchanged.
4. If relevance is uncertain, do not move; document and defer.
5. Move only when evidence is strong and risk is low.

## Never Move in Routine Organization Passes

- `js/` active runtime tree
- Active HTML entrypoints
- `interaction/`
- `prune/`
- `audit/`
- `checkpoints/`
- `recovery-snapshots/`
- `release/`
- `dist/`

## Allowed Organization Actions

- Add mapping/retention docs
- Add folder-purpose README notes
- Define future archive destination
- Remove proven irrelevant zero-risk clutter

## Archive Destination (Future)

- `_archive_candidates/` is reserved for future archival-only items.
- Preserve relative structure when moving groups of files.
- Add a move log entry for each archived item:
  - source path
  - destination path
  - evidence of non-reference
  - risk rating
  - validation run used after change

## Required Proof Before Any Move

- No runtime import/reference
- No HTML script/module reference
- No dynamic string lookup reference
- No test/gate/package script reference
- No canonical documentation/closeout requirement

## Validation Baseline After Any Change

Run the full baseline matrix used for freeze/hardening passes:

- `node --test js/app/templateResolver.test.js`
- `node --test js/app/renderAssumptions.contract.test.js`
- `node --test js/core/reporting/composeReport.test.js`
- `node --test js/core/reporting/goldenReports.test.js`
- `node --test js/core/selectors/districtRaceContextPersistence.test.js`
- `node --test js/core/selectors/districtV2.persistence.test.js`
- `node --test js/core/selectors/dataC6.persistence.test.js`
- `node --test js/app/v3/c9.shellLayout.contract.test.js`
- `node --test js/app/v3/surfaces/layoutContract.test.js`
- `node --test js/app/v3/surfaces/warRoom/phase8.integrity.test.js`
- `node --test js/app/v3/surfaces/warRoom/renderLifecycle.contract.test.js`
- `node --test js/app/v3/surfaces/turnout.contract.test.js`
- `node --test js/app/v3/surfaces/data/renderLifecycle.contract.test.js`
- `node --test js/app/v3/surfaces/data/phase9.integrity.test.js`
- `node --test js/app/v3/surfaces/data/reportingGuidance.contract.test.js`
- `node scripts/gate-architectural-drift.mjs`
- `npm run check:canonical-math`

## Operating Principle

Preserve live wiring.
Organization should improve clarity, not mutate production behavior.
