# Post-Rebuild Ownership Enforcement (H2)

## Scope landed
- Added ownership assertion utilities in `js/core/state/ownershipAssertions.js`.
- Added ownership contract tests in `js/core/state/ownershipAssertions.test.js`.
- Added intentional violation fixtures to prove loud failures for duplicate ownership, cross-domain writes, and lane leakage.

## Assertion utilities added
- `assertUniqueFieldOwnership(...)`
  - Verifies one-owner-per-field across canonical domains.
  - Throws on unknown domain assignments and duplicate owners.
- `assertActionMutationOwnership(...)`
  - Verifies post-action state changes are limited to allowed canonical domains.
  - Throws on unauthorized cross-domain mutations.
- `assertBridgeCanonicalLane(...)`
  - Verifies canonical bridge payloads do not expose derived-only keys.
- `assertBridgeDerivedLane(...)`
  - Verifies derived bridge payloads do not expose canonical input keys.
- `assertDerivedViewDoesNotExposeEditableFields(...)`
  - Verifies derived payloads do not leak editable control truth.

## Intentional failure coverage
Tests intentionally trigger and assert throws for:
- duplicate canonical ownership entries
- cross-domain write drift (`district` action mutating `targeting`)
- canonical bridge payload containing derived lane keys
- derived bridge payload containing canonical lane keys
- derived payload exposing editable controls

## Commands and outcomes
- `node --test js/core/state/ownershipAssertions.test.js`
  - PASS (`7 passed, 0 failed`)
- `npm run check:contracts`
  - PASS (`contracts-diagnostics-check: ok entries=5 blockers=0 violations=3 warnings=2 info=0`)
- `npm run build`
  - PASS (`vite build` completed)
- `npm run gate:rebuild`
  - PASS (`strict-gate: PASS`)

## Notes
- Enforcement utilities currently run through tests/contracts and are ready to be consumed by additional hardening gates (drift checks, wrapper retirement gates, and module-boundary checks).
