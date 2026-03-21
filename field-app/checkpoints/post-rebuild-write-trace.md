# Post-Rebuild Write Path Traceability (H3)

## Scope landed
- Added recompute invalidation rule map:
  - `js/core/state/recomputeInvalidationMap.js`
- Added write-path trace recorder:
  - `js/core/state/writeTrace.js`
- Wired optional trace emission into canonical action mutation core:
  - `js/core/actions/_core.js` (`mutateDomain` emits trace only when `traceLayer` is supplied)
- Added H3 tracing tests:
  - `js/core/state/writeTrace.test.js`

## Structured trace payload
Each traced mutation now records:
- source module/surface
- action name
- canonical slice touched (`domains.<domain>`)
- app revision before/after
- domain revision before/after
- downstream selectors invalidated
- downstream module refresh targets
- bridge refresh targets
- dirty canonical domains actually changed

## Recompute invalidation rules
- Rules are domain-owned and deterministic (`resolveRecomputeInvalidations`).
- Output includes three lanes:
  - `selectors`
  - `modules`
  - `bridges`
- Election import has explicit downstream override (`reporting` module inclusion) to make downstream effects legible.

## Dev/debug behavior
- Trace recorder is quiet by default.
- Tracing activates only when `createWriteTraceLayer({ enabled: true })` is used and passed via action options.
- No new console noise added to normal runtime flow.

## Test coverage added
`js/core/state/writeTrace.test.js` verifies:
1. mutation emits expected structured trace
2. expected downstream invalidations are recorded
3. unrelated modules are not marked dirty
4. disabled trace mode records nothing

## Commands and outcomes
- `node --test js/core/state/writeTrace.test.js`
  - PASS (`4 passed, 0 failed`)
- `npm run build`
  - PASS (`vite build` completed)
