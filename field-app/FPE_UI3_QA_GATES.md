# FPE UI 3.0 QA Gates

Date: 2026-03-10
Scope: UI architecture migration only (engine and right rail frozen)

## Gate Template (Required Per Surface)

### 1) Functional
- Controls respond to input changes.
- Outputs update after each control change.
- Stage navigation works and preserves state.
- No broken element IDs required by runtime bindings.
- No JS errors in browser console.

### 2) Visual
- Uses v3 spacing tokens (no arbitrary margins).
- No legacy shell styling leaks into v3 cards.
- No overlaps or clipped controls.
- Right rail fits and scrolls in slot.
- Mobile/compact layout remains usable.

### 3) Structural
- Surface answers one clear operator question.
- Primary controls are immediately visible.
- Advanced/secondary controls are clearly separated.
- Summary section reflects current assumptions.

### 4) Regression
- Same inputs produce same key outputs as legacy shell.
- KPI strip values match right-rail/source values.
- Scenario name edits sync between v3 and legacy model input.

## Current Surface Status

### District
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native card structure with legacy field-level mounts.
- Remaining checks:
  - Manual browser regression against legacy values.
  - Console error sweep after stage switching loops.

### Reach
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native card layout with targeted field/block mounts.
- Remaining checks:
  - Manual browser regression against legacy values for weekly outputs.
  - Console error sweep after repeated stage switching.
  - Visual pass for 3-column scanability at 1280 and 1024 widths.

### Outcome
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native outcome cards with targeted simulation/output mounts.
- Remaining checks:
  - Monte Carlo run/re-run interactions from v3 shell.
  - Risk framing consistency with right rail.
  - Regression check for confidence-envelope and sensitivity values.

### Turnout
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native turnout layout with targeted ROI/turnout mounts.
- Remaining checks:
  - ROI table refresh behavior under control changes.
  - Turnout summary consistency across mode toggles.
  - Regression check for turnout banner and realized-vote readouts.

### Plan
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native plan layout with targeted workload/optimization/timeline mounts.
- Remaining checks:
  - Timeline-constrained optimization flow.
  - Workload translator regression against legacy values.
  - Decision-intelligence panel behavior and constraint summaries.

### Controls
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native controls layout with targeted governance/census/evidence mounts.
- Remaining checks:
  - Census flow parity (load GEOs, fetch rows, aggregate, map rendering) in v3 mount context.
  - Governance workflow checks (lock toggles, evidence attach, benchmark save).
  - Calibration + feedback-loop interactions and console-error sweep.

### Scenarios
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native scenario workspace/comparison cards with targeted mounts.
- Remaining checks:
  - Save/load/clone/delete scenario actions from v3 workspace.
  - Comparison grid visibility and diff counts under baseline/non-baseline states.
  - Summary panel refresh during rapid scenario switching.

### Decision Log
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native decision cards with targeted row-level mounts.
- Remaining checks:
  - Session/objective/options actions under repeated edits.
  - Diagnostics panel updates (drift/risk/bottleneck/sensitivity/confidence) after reruns.
  - Recommendation export buttons and summary preview behavior.

### Data
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native data cards with targeted policy/import/storage mounts.
- Remaining checks:
  - Strict import toggle and restore-backup behavior.
  - Import/export button flows (JSON/CSV/copy summary) and banner visibility.
  - USB folder connect/load/save/disconnect behavior in v3 context.

## Execution Notes
- `js/core/*` remains unchanged for this phase.
- Right rail remains legacy and is slotted into v3 shell.
- Local environment currently lacks `node`, so automated JS build/typecheck was not executed here.
