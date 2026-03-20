# Phase 23 — Pre-Audit Prune Decisions

Date: 2026-03-20

## Scope
This pass executes the required relevance/prune checkpoint before canonicalization/contracts.
No new business features were added.

Artifacts:
- `prune/relevance-matrix.csv`
- `prune/prune-decisions.md`

## Matrix Coverage Summary
From `prune/relevance-matrix.csv`:
- Total classified artifacts: 141
- `KEEP`: 137
- `KEEP_BUT_SIMPLIFY`: 0
- `KEEP_BUT_REHOME`: 0
- `REPLACE`: 0
- `REMOVE`: 4

Included artifact types:
- input controls (from full interaction inventory)
- helper runtime paths
- formula owners
- warning layer
- render surfaces
- export/report surfaces
- registry layers
- diagnostic/build prep paths

## Executed Prune Actions (Done In Phase 23)

### REMOVE (executed now)
1. `js/renderIntelChecks.js`
2. `js/wireEventsRuntime.js`
3. `js/app/wireEvents.js`

Rationale:
- Each file was a compatibility facade only.
- Runtime imports already resolve to canonical owners (`js/app/renderIntelChecks.js`, `js/app/wireEventsRuntime.js`).
- No HTML/runtime entry references require these facades.

Validation after removal:
- `npm run build` ✅
- `npm run check:interaction-integrity` ✅
- `npm run check:interaction-pages` ✅

### KEEP_BUT_SIMPLIFY (executed now)
1. `usb_status_legacy_fallback` -> canonicalized as `usb_status_canonical_owner` in matrix

Applied change:
- `js/appRuntime.js` no longer reads legacy `els.usbStorageStatus` as a fallback in Data bridge status paths.

Result:
- Data USB status now resolves from canonical bridge state only (`dataBridgeUsbStatusText`).

## High-Priority Non-Delete Decisions

### REPLACE (completed in this pass)
- `v3_legacy_right_rail_attach` replaced by native owner path:
  - `js/app/v3/stageMount.js` now parks legacy rail in `legacyDomPool` and never mounts it as live rail.
  - `index.html` bootstrap no longer appends legacy rail to `#v3RightRailSlot`.
  - Matrix row now tracked as `v3_right_rail_native_owner` (`KEEP`).

### KEEP_BUT_REHOME (completed in this pass)
- `v3_stage_legacy_alias_map` -> canonicalized as `v3_stage_registry_canonical_only`:
  - `js/app/v3/stageRegistry.js` removed legacy alias fallback and keeps canonical v3 stage id resolution only.

### KEEP_BUT_REHOME (completed in this pass)
- `training_toggle_legacy_bridge` rehomed to API-first path:
  - `js/app/v3/index.js` no longer dispatches hidden `toggleTraining` input/change events.
  - v3 now uses shell bridge API first and falls back to body class only.
  - Matrix row now tracked as `training_toggle_bridge_api_first` (`KEEP`).

### KEEP_BUT_SIMPLIFY (completed in this pass)
- `strict_chunk_warning_policy` -> resolved as explicit budgeted strict gate:
  - `vite.config.js` now sets `chunkSizeWarningLimit: 2100` with policy comment.
  - `npm run gate:rebuild` now passes under strict warning rules.
  - Matrix row now tracked as `strict_chunk_warning_budget` (`KEEP`).
- `qa_gates_legacy_node_checks` -> canonicalized as `qa_gates_stable_vs_transitional_split`:
  - `js/app/v3/qaGates.js` now separates stable checks from transitional legacy-retirement checks.
  - `runV3QaSmoke(...)` runs stable checks by default.
  - `runV3LegacyRetirementSmoke(...)` runs legacy-retirement checks explicitly.
- `summary_export_text` -> audited canonical as `KEEP`:
  - `js/export.js` summary formatter reads canonical snapshot/reporting payload values and performs formatting only.
  - no independent business-logic formula path introduced in summary export.

### REMOVE (planned, not executed in this pass)
- `render_file_warning_text` (`js/app/v3/surfaces/*`)
  - Decision: remove inline meaning text in render surfaces where present; resolve via canonical message/intelligence registries.
  - Reason not bulk-executed now: requires controlled sweep to avoid meaning regressions during live feature flow.

## Canonical Formula/Model Protection Decisions
All core formula owners were marked `KEEP` and explicitly protected from duplication:
- `js/core/targetFeatureEngine.js` (master targeting law)
- `js/core/targetModels.js` (support/turnout signals)
- `js/core/model.js` (capacity/workforce)
- `js/core/channelCosts.js` (cost realism path)
- `js/app/modelReadiness.js` (readiness scoring)
- `js/app/realismEngine.js` (plausibility scoring)

## Risk Notes
- Legacy shell dependencies remain explicitly inventoried and must be eliminated before Phase 27 freeze.

## Phase Boundary Confirmation
- This pass is Phase 23 (prune/relevance) only.
- Contracts/diagnostics work (Phase 25) has not started.
- No hardening-time behavior mutation was introduced in this prune pass.
