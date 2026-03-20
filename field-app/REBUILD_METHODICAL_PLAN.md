# Rebuild Plan (Methodical + Safe)

## Addendum Sequence Guard
- Active addendum phase order is tracked in `/Users/anakinskywalker/Downloads/field-app-40/ADDENDUM_PHASE_SEQUENCE.md`.
- Final hardening remains deferred until the explicit pre-hardening checkpoint (`Phase 22.5`) is complete and reviewed.

## Lockpoint (Do Not Delete)
- Snapshot: `/Users/anakinskywalker/Downloads/field-app-40/recovery-snapshots/lock-20260224T043932Z`
- Manifest: `/Users/anakinskywalker/Downloads/field-app-40/recovery-snapshots/lock-20260224T043932Z/SHA256SUMS.txt`
- Pointer: `/Users/anakinskywalker/Downloads/field-app-40/recovery-snapshots/LOCKPOINT_CURRENT.txt`

## Non-Negotiables
- Do not rewrite core deterministic engine math.
- Do not rewrite Monte Carlo kernel.
- Do not break self-test gates, scenario integrity, or import/export roundtrip behavior.
- Any high-risk change must be feature-flagged and OFF by default until validated.

## Operating Principle
- Rebuild wrappers, not core.
- Replace weak subsystems one-by-one behind stable interfaces.
- Ship each phase only after passing gates.

## Validation Gates (Every Phase)
1. Self-Test: pass.
2. Robust Smoke: unchanged objective/score behavior.
3. Manual smoke (critical UI paths only):
   - Main planner render
   - Scenario save/load
   - MC run/re-run
   - Operations hub CRUD/import/export
4. Diagnostics: no new uncaught runtime errors.

## Phase Order

### Phase 0 — Baseline Capture (Read-Only)
- [x] Record current self-test + smoke outputs in a checkpoint note.
- [x] Record known acceptable warnings/errors (if any).

### Phase 1 — Persistence Service (Targeted Rebuild)
- [x] Create a persistence adapter with explicit write success/failure return.
- [x] Route state save and backup save through adapter.
- [x] Add non-intrusive status indicator for failed persistence.
- [x] Keep external behavior unchanged unless failure occurs.

Exit criteria:
- No silent save failure path remains.
- Existing save/load behavior works with same UX.

### Phase 2 — Operations Metrics Cache (Targeted Rebuild)
- [x] Create `operationsMetrics` module that computes rollups once per data version.
- [x] Invalidate cache only on relevant Operations writes/imports.
- [x] Main app reads precomputed summary (no full-store scan in hot render loop).

Exit criteria:
- Main render path no longer pulls all Operations stores each repaint.
- Operations Hub and main app show consistent summary values.

### Phase 3 — Explainability/Impact Layer (Targeted Rebuild)
- [x] Add dependency registry for key outputs (what inputs drive each KPI).
- [x] Add compact “impact trace” UI for critical cards/messages.
- [x] Show: formula sources + upstream fields + downstream impacted cells.

Exit criteria:
- User can see “if this changes, these exact outputs move.”

### Phase 4 — Information Architecture + Layout Reorder (UI Rebuild)
- [ ] Reorder modules by campaign workflow, not legacy phase splits. *(Pass A in progress: nav/stage terminology + grouping updated)*
- [ ] Keep right sidebar for aggregate readouts, sorted by operational sequence. *(Pass A in progress: universe/source moved out of metadata inputs; sidebar now aggregate-only for these fields)*
- [ ] Merge related sections (e.g., universe + persuasion universe context) onto same working surface where it reduces navigation cost.
- [ ] Preserve current visual style where strong (Operations Hub shell pattern).

Exit criteria:
- No clipped/squished/hidden panels.
- Reduced navigation hops for core tasks.
- Readability and scan order improved on desktop + tablet widths.

### Phase 5 — Visual Clarity Pass (Low Risk)
- [ ] Add only necessary graphics (trend bars/sparklines/compact comparison visuals).
- [ ] No decorative charts that add noise.

Exit criteria:
- Graphics are explanatory, not ornamental.

### Phase 6 — Final Hardening
- [ ] Re-run full validation gates.
- [ ] Produce final release checkpoint and lockpoint.
- [ ] Freeze interfaces for future feature additions.

## Scope Control Rules
- If a change touches engine math or MC internals, stop and re-approve before proceeding.
- If any phase causes deterministic drift, rollback to lockpoint and re-scope.
- No multi-phase changes in a single commit-sized pass.

## Progress Tracking
- We will complete one phase at a time and mark this file as we go.

## Current Status
- Phase 0 captured in `/Users/anakinskywalker/Downloads/field-app-40/RELEASE_CHECKPOINT_2026-02-24.md`.
- Phase 1 code changes are complete and isolated to storage + save status UI.
- Phase 2 code changes are complete: Operations snapshot cache + store revision invalidation.
- Phase 3 code changes are complete: impact trace panel for key outputs with explicit upstream/downstream links.
- Phase 4 has started (Pass A): workflow-oriented naming and control relocation (`Strict import`, backups, import/export controls moved to Data & Integrity stage).
- Phase gate validation still required in-browser:
  - Self-Test
  - Robust Smoke
  - Planner/Scenario/MC smoke
  - Operations hub CRUD/import/export smoke
