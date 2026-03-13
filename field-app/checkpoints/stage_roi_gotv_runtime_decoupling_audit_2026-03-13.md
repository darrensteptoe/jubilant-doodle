# Stage-ROI/GOTV Runtime Decoupling Audit (2026-03-13)

Scope: runtime/update paths for legacy `stage-roi` and `stage-gotv` IDs.  
Goal: keep model/render state live when legacy ROI/GOTV nodes are partially or fully absent.

## Changes applied in this pass

- `js/app/render/executionAnalysis.js`
  - conversion panel now writes a runtime cache (`state.ui.lastConversion`) for:
    - `conversationsNeeded`
    - `doorsNeeded`
    - `doorsPerShift`
    - `totalShifts`
    - `shiftsPerWeek`
    - `volunteersNeeded`
    - feasibility banner state (`kind/text/shown`)
  - this keeps workload/feasibility context available beyond legacy `out*` DOM writes.

- `js/app/weeklyOpsPanels.js`
  - weekly summary panel now writes `state.ui.lastWeeklyOps` with:
    - required/achievable weekly volume
    - gap
    - constraint + note
    - banner state (`kind/text/shown`)
  - this provides a non-DOM source for weekly execution context.

- `js/app/v3/kpiBridge.js`
  - bottleneck inference now reads weekly gap from Reach bridge view first:
    - `reachView.weekly.gapPerWeek|gap`
    - `reachView.summary.gapPerWeek|gap`
  - legacy `#wkGapPerWeek` is retained as compatibility fallback only.
  - legacy `#wkConstraint/#optBinding` fallback labels were removed from KPI bottleneck text resolution.

## Current status

- Runtime model values for conversion and weekly execution now persist in `state.ui` caches even if legacy ROI/GOTV panels are hidden/unmounted.
- V3 KPI bottleneck logic is now primarily bridge-driven for gap checks (reduced legacy weekly DOM dependence).

## Remaining intentional coupling

- Runtime still writes to legacy ROI/GOTV nodes when present (for parity and rollback safety).
- Legacy ROI/GOTV containers remain hidden stubs and are not yet deleted.

## Next safe step

1. Switch any remaining runtime readers that still parse legacy ROI/GOTV output text to bridge/cache sources first.
2. Keep legacy writes during overlap for rollback safety.
3. Delete legacy `stage-roi`/`stage-gotv` markup only after QA confirms no runtime read-path dependency.
