# Phase 25 — Contracts + Diagnostics (Complete)

Date: 2026-03-20

## Scope
Implemented canonical contract enforcement/elevation scaffolding and diagnostics logging without mutating business logic.

This pass is observability/enforcement only.
No new campaign math or feature behavior was introduced.

## Required Artifacts Created

Contracts:
- `contracts/flowContracts.js`
- `contracts/stateContracts.js`
- `contracts/outputContracts.js`
- `contracts/boundaryContracts.js`

Diagnostics:
- `diagnostics/diagnosticStore.js`
- `diagnostics/diagnosticEngine.js`
- `diagnostics/diagnosticFormatters.js`
- `diagnostics/diagnosticPanel.js`

Support:
- `scripts/check-contract-diagnostics.mjs`
- `package.json` script: `check:contracts`

## Runtime Wiring Added

Canonical flow instrumentation now emits diagnostics events from:
- `setState(...)` -> `state_write`
- `commitUIUpdate(...)` -> `commit_ui_update`
- `render()` -> `render_complete`
- `notifyBridgeSync(...)` -> `bridge_sync`
- `shellBridgeSetContext(...)` -> `context_update`
- scope-changing/state-import rehydrate paths -> `state_rehydrated`
- `dataBridgeComposeReport(...)` -> `report_composed`
- `dataBridgeExportReportPdf(...)` -> `report_exported`

Diagnostics modal integration:
- `js/app/diagnosticsRuntime.js` now appends contract diagnostics summary + findings into the existing diagnostics panel.

## Contract Coverage Implemented

Flow Contracts:
- recompute missing after state change
- bridge sync before render completion
- repeated writes before recompute closure
- validation bypass hook for critical actions

State Contracts:
- unauthorized `setState` mutation outside `state.ui`
- derived snapshot direct mutation detection
- context scope required on write (campaign/office)

Output/Render/Formula Contracts:
- report context mismatch vs active scope
- report composed without canonical snapshot
- report missing validation/realism links
- stale render lifecycle marker check

Boundary Contracts:
- context update with missing required scope
- unknown bridge sync source
- selector value outside canonical options (hook)
- reset/clone/delete invariant failure (hook)
- persisted/rehydrated identity violation (hook)
- legacy dependency flag event (hook)
- state rehydration scope change without context action

## Safety Rule Compliance

- Diagnostics are read-only relative to business logic.
- Contracts elevate via diagnostics entries only.
- No silent mutation or auto-repair behavior was added.

## Validation

Executed:
- `npm run check:contracts` ✅
- `npm run check:interaction-integrity` ✅
- `npm run check:interaction-pages` ✅ (`tier1_stable=yes`)
- `npm run check:canonical-math` ✅
- `npm run build` ✅
- `npm run gate:rebuild` ✅

## Phase Boundary

- Phase 25 is complete.
- Phase 26 (Audit Layer + Release Gauntlet) is next.
- Freeze (Phase 27) remains gated on Phase 26 completion and RG-06 legacy-disconnect pass.

