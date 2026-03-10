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
- Status: Hybrid (B)
- Current implementation: legacy card mounts inside v3 wrapper cards.
- Remaining checks:
  - Functional walkthrough for all weekly ops controls.
  - Visual pass for 3-column scanability at 1280 and 1024 widths.

### Outcome
- Status: Hybrid (B)
- Current implementation: forecast and explain cards mounted into v3 layout.
- Remaining checks:
  - Monte Carlo run/re-run interactions from v3 shell.
  - Risk framing consistency with right rail.

### Turnout
- Status: Hybrid-plus (B+)
- Current implementation: v3 layout cards with targeted mounts + v3 summary card.
- Remaining checks:
  - ROI table refresh behavior under control changes.
  - Turnout summary consistency across mode toggles.

### Plan
- Status: Hybrid (B)
- Current implementation: workload/optimizer/freshness cards mounted into v3 layout.
- Remaining checks:
  - Timeline-constrained optimization flow.
  - Freshness imports/exports and action buttons.

### Controls
- Status: Hybrid (B)
- Current implementation: stage-body mount in v3 card.

### Scenarios
- Status: Hybrid (B)
- Current implementation: stage-body mount in v3 card.

### Decision Log
- Status: Hybrid (B)
- Current implementation: stage-body mount in v3 card.

### Data
- Status: Hybrid (B)
- Current implementation: stage-body mount in v3 card.

## Execution Notes
- `js/core/*` remains unchanged for this phase.
- Right rail remains legacy and is slotted into v3 shell.
- Local environment currently lacks `node`, so automated JS build/typecheck was not executed here.
