# Post-Rebuild Module Boundary Enforcement (H5)

## Scope landed
- Added H5 boundary suite:
  - `js/core/actions/moduleBoundaries.test.js`
- Added optional runtime boundary assertion behavior in action core:
  - `js/core/actions/_core.js`
  - `mutateDomain` now supports optional domain-boundary enforcement (`enforceBoundary` or `__FPE_DEV_BOUNDARY_ASSERTIONS__`).
- Boundary enforcement now uses canonical ownership assertion utility for changed-domain checks.

## Boundary rules covered in tests
1. weatherRisk must not mutate eventCalendar directly
2. eventCalendar must not mutate weatherRisk directly
3. electionData must not write directly into district domain
4. district summary reader must consume selector/bridge lanes, not raw cache globals
5. forecastArchive must not own recovery/import state
6. reporting module must not own recovery controls
7. intentional cross-domain mutation fails loudly when boundary enforcement is enabled

## Runtime assertion behavior
- `mutateDomain` captures a pre-mutation snapshot when boundary assertions/tracing are enabled.
- When boundary enforcement is on, mutation results are validated against allowed domain writes.
- Default behavior remains non-blocking unless explicitly enabled (`enforceBoundary: true`) or via dev global toggle (`__FPE_DEV_BOUNDARY_ASSERTIONS__ = true`).

## Commands and outcomes
- `node --test js/core/actions/moduleBoundaries.test.js`
  - PASS (`8 passed, 0 failed`)
- `node --test js/core/state/writeTrace.test.js`
  - PASS (`4 passed, 0 failed`)
- `node --test js/core/state/fallbackGuards.test.js`
  - PASS (`5 passed, 0 failed`)
- `npm run build`
  - PASS (`vite build` completed)
