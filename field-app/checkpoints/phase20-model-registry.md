# Phase 20 - Model Registry / Canonical Model Map

Date: 2026-03-19

## Scope
- Added canonical metadata-only model registry.
- Wired model definitions into the intelligence panel so doctrine/playbook/message/glossary can reference model definitions without duplicating math.
- Added self-test coverage checks for required model IDs and owner metadata.

## Canonical Files
- `js/app/modelRegistry.js`
- `js/app/intelligenceRegistry.js`
- `js/app/intelligenceState.js`
- `js/app/intelligenceResolver.js`
- `js/app/intelligenceRenderer.js`
- `js/app/intelligenceInteractions.js`
- `js/app/intelligenceIndices.js`
- `js/app/moduleDoctrineRegistry.js`
- `js/app/playbookRegistry.js`
- `js/core/selfTestSuites/targeting.js`

## Coverage Snapshot
`verifyModelCoverage()` output:
- total models: 15
- required models: 15
- missing required: 0
- invalid status: 0
- unresolved canonical owner: 0
- status counts:
  - implemented: 6
  - partiallyImplemented: 8
  - planned: 1
  - absorbed: 0

## Notes
- Registry entries are metadata only; no duplicate math introduced.
- `masterTargetingEquation` is marked `partiallyImplemented` pending Phase 21 lock.
- `socialPressure` remains `planned` and intentionally metadata-only.
