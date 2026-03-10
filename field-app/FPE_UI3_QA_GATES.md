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
- Current implementation: v3-native controls layout; workflow, benchmark, evidence, calibration, and feedback cards are native-bridged to legacy `intel*` handlers. Status stack is now native v3, and census now uses a native bridge shell with legacy sub-block mounts for dense map/table workflows.
- Remaining checks:
  - Census flow parity (load GEOs, fetch rows, aggregate, map rendering) in v3 bridge-shell context.
  - Calibration interactions and export/copy behavior under repeated edits.
  - Feedback-loop interactions and console-error sweep.

### Scenarios
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native scenario workspace controls bridged to legacy scenario IDs; comparison panel remains compatibility-mounted.
- Remaining checks:
  - Save/load/clone/delete scenario actions from v3 workspace.
  - Comparison grid visibility and diff counts under baseline/non-baseline states.
  - Summary panel refresh during rapid scenario switching.

### Decision Log
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native session/assumptions/options/recommendation cards bridged to legacy decision IDs; diagnostics rows remain compatibility-mounted.
- Remaining checks:
  - Session/objective/options actions under repeated edits.
  - Diagnostics panel updates (drift/risk/bottleneck/sensitivity/confidence) after reruns.
  - Recommendation export buttons and summary preview behavior.

### Data
- Status: In progress (B -> C native bridge pass started)
- Current implementation: v3-native data controls rendered in v3 markup with event/state bridge to legacy data IDs (no mounted legacy cards).
- Remaining checks:
  - Strict import toggle and restore-backup behavior.
  - Import/export button flows (JSON/CSV/copy summary) and banner visibility.
  - USB folder connect/load/save/disconnect behavior in v3 context.

## Execution Notes
- `js/core/*` remains unchanged for this phase.
- Right rail remains legacy and is slotted into v3 shell.
- Shared v3 utility helpers now centralize surface text/grid helper logic (`js/app/v3/surfaceUtils.js`) to reduce duplication before final native hardening.
- Bridge helper primitives (`bindClickProxy`, `syncButtonDisabled`, `syncSelectOptions`) are centralized in `js/app/v3/surfaceUtils.js` and reused by native-bridge surfaces.
- Bridge helper API expanded in `js/app/v3/surfaceUtils.js` with shared field/select/checkbox bind+sync utilities (`bindFieldProxy`, `bindSelectProxy`, `bindCheckboxProxy`, `syncFieldValue`, `syncSelectValue`, `syncCheckboxValue`).
- Added v3 QA smoke harness (`js/app/v3/qaGates.js`):
  - Runs automatically when clicking the v3 Diagnostics button (logs pass/fail table to console, then opens legacy diagnostics modal).
  - Can be run manually in-browser with `window.runV3QaSmoke()`.
- Added v3 stage persistence/cutover behavior (`js/app/v3/index.js`):
  - Active stage persists to local storage.
  - URL deep-link query (`?stage=<id>`) restores stage on reload.
  - v3 is default; legacy shell opens only via explicit URL mode flag (`?ui=legacy`).
- Phase 11 native bridge started on Data (`js/app/v3/surfaces/data.js`), replacing compatibility card mounts with native v3 controls wired to existing legacy handlers.
- Phase 11 native bridge expanded on Scenarios workspace (`js/app/v3/surfaces/scenarios.js`), while keeping comparison grid in compatibility mode.
- Phase 11 native bridge expanded on Controls (`js/app/v3/surfaces/controls.js`) for workflow, benchmark, evidence, and calibration cards.
- Phase 11 native bridge expanded on Decision Log (`js/app/v3/surfaces/decisionLog.js`) for session, assumptions, options, and recommendation cards.
- Hardening refactor: Controls, Decision Log, Scenarios, and Data now use the shared bridge helper API (reducing per-surface custom wiring code and keeping bridge behavior consistent).
- Legacy header actions migrated into native v3 card-body actions on primary modeling surfaces:
  - District: `Add candidate`
  - Outcome: `Compute Surface`
  - Turnout: `Refresh` (ROI comparison)
  - Plan: `Optimize`
- Decision Log diagnostics now includes a native v3 `Run snapshot` action proxy, replacing reliance on the legacy inline sensitivity button in mounted diagnostics rows.
- Module-level ON/OFF toggles now follow header placement convention (label-left, switch-right) on migrated cards: District electorate weighting, Turnout module, Plan timeline module, Controls census apply-adjustments, and Data strict import policy.
- Surface action styling is normalized to compact neutral controls (`Add candidate` style) for all non-topbar buttons, including legacy `.btn` elements mounted inside v3 cards.
- District surface is now a single-column wide workspace (`fpe-surface-frame--single`) and now hosts the Census assumptions surface (`#censusPhase1Card`) for maximum working room.
- Controls surface no longer mounts Census assumptions UI blocks; governance cards remain scoped to workflow/evidence/benchmark/calibration/feedback.
- Reach surface moved from strict 3-column to adaptive 2-row arrangement (two columns plus full-width results row) to reduce module scroll pressure.
- Controls feedback-loop action set (`Capture observed metrics`, `Generate drift recommendations`, `Apply top recommendation`, `Parse what-if request`) is now rendered as native v3 body actions instead of mounted legacy card header actions.
- Controls census card no longer mounts the full legacy card wrapper; it now renders a v3 bridge shell with native top actions (`Load GEO list`, `Fetch ACS rows`) and targeted legacy sub-block mounts.
- Controls census bridge now exposes native v3 body actions for GEO selection (`Apply GEOIDs`, `Select all`, `Clear selection`), aggregate exports (`Export CSV/JSON`), and election CSV workflow (`template downloads`, `dry-run`, `clear preview`) with proxy wiring to legacy handlers.
- Resolved duplicate ID conflict in Decision Log (`v3DecisionObjective`) and added focused-field sync guards in Controls/Decision Log bridge loops to prevent input jitter during periodic refresh.
- Static selector audits currently pass:
  - All legacy IDs referenced by v3 surface bridges are present in `index.html`.
  - No duplicate v3 `id=` attributes detected across `js/app/v3/surfaces/*.js`.
- Local environment currently lacks `node`, so automated JS build/typecheck was not executed here.
