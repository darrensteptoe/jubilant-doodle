# Phase 22.5 — Pre-Hardening Major Audit

Date: 2026-03-19

This is the required readiness checkpoint before Phases 23–27.
Final hardening remains deferred until this audit is reviewed.

## Audit Scope Executed
- Interaction integrity: `npm run check:interaction-integrity` and `npm run check:interaction-integrity:strict`
- Page-tier interaction stability: `npm run check:interaction-pages`
- Model coverage verification: `verifyModelCoverage()` in `js/app/modelRegistry.js`
- Targeting/model self-tests: `node js/core/selfTestSuites/targeting.js`
- Legacy dependency grep across runtime + v3 surfaces + markup

## Headline Status
- Interactions: 113/113 pass, high-priority 15/15 pass.
- Tier 1 interaction stability: pass (`tier1_stable=yes`).
- Model coverage: complete (15/15 required models represented, no missing owners).
- Remaining pre-hardening risk is primarily legacy compatibility scaffolding and release-gate strict build warning behavior.

## Required Issue Inventory

### active defect to fix now
- `BUILD_GATE_STRICT_CHUNK_WARNING`
  - status: open
  - severity: warning-now / blocker-at-freeze
  - evidence: `npm run gate:rebuild` fails on strict warning promotion (`(!) Some chunks are larger than 2000 kB`)
  - canonical owner: build/release gate policy (`scripts/gate-rebuild.mjs`, Vite chunking settings)
  - reason: not a business-logic defect, but will block freeze gauntlet unless addressed or explicitly accepted.

### expected future-phase item
- `SOCIAL_PRESSURE_MODEL_PLANNED`
  - status: expected
  - evidence: `js/app/modelRegistry.js` marks `socialPressure` as `planned` metadata-only.
  - canonical owner: Phase 23+ prioritization, only if promoted from planned.
  - reason: allowed by Phase 22 rules when classified honestly.
- `FINAL_HARDENING_ARTIFACTS_NOT_STARTED`
  - status: expected
  - evidence: Phases 23–27 artifacts (`/prune`, `/contracts`, `/diagnostics`, `/audit`) are intentionally not active yet.
  - canonical owner: future hardening phases by sequence.

### legacy dependency
- `LEGACY_RIGHT_RAIL_ATTACHMENT`
  - status: open transitional dependency
  - evidence: `js/app/v3/stageMount.js` mounts `#legacyResultsSidebar` into v3 slot.
  - canonical owner: v3 shell/stage mount retirement pass before freeze.
- `LEGACY_TRAINING_TOGGLE_BRIDGE`
  - status: open transitional dependency
  - evidence: `js/app/v3/index.js` writes to hidden `#toggleTraining`; `index.html` still hosts the legacy node.
  - canonical owner: doctrine/playbook cutover retirement pass.
- `LEGACY_STAGE_ALIAS_MAP`
  - status: open transitional dependency
  - evidence: `js/app/v3/stageRegistry.js` still keeps `legacyStageIds` alias map.
  - canonical owner: final legacy shell disconnect pass.
- `LEGACY_SEED_AND_POOL_NODES`
  - status: open transitional dependency
  - evidence: `index.html` still includes `#legacyShellRoot`, `#legacyDomPool`, `#legacySetupSourceSeed`, `#legacyChecksSourceSeed`.
  - canonical owner: Phase 26 RG-06 legacy disconnect + Phase 27 freeze gate.

### duplicate truth path
- `THEME_COMPAT_DUAL_STATE`
  - status: open compatibility dual path
  - evidence: `js/appRuntime.js` keeps legacy `state.ui.dark` while canonical mode is system/theme-mode driven.
  - canonical owner: runtime theme canonicalization during hardening.
- `TRAINING_STATE_MULTI_PATH`
  - status: open compatibility dual path
  - evidence: training state can be reflected via shell bridge, body class (`training`), and legacy toggle node.
  - canonical owner: playbook-only canonicalization and legacy toggle retirement.
- `USB_STATUS_LEGACY_FALLBACK`
  - status: open compatibility read fallback
  - evidence: `js/appRuntime.js` reads `els.usbStorageStatus` as fallback despite canonical data-bridge status.
  - canonical owner: data bridge fallback prune in hardening.

### risky hardening candidate
- `HARDENING_LEGACY_COMPAT_CHECKS_AS_FINAL`
  - status: risk
  - evidence: `js/app/v3/qaGates.js` currently contains many checks tied to legacy node presence/retirement scaffolding.
  - risk: hardening too early could cement transitional compatibility assumptions.
  - mitigation: run Phase 26 RG-06 legacy disconnect first, then lock contracts/diagnostics.
- `REPORTING_FREEZE_WITHOUT_PREHARDENING_REVIEW`
  - status: risk
  - evidence: report layer is now canonically wired, but hardening before this audit review could lock in unresolved legacy dependencies.
  - mitigation: complete this audit review, then begin Phase 23 prune/canonicalization.

### unknown root cause
- none at this checkpoint.

## Readiness Decision
- Approved to proceed to Phase 23 only after this report is reviewed.
- Final hardening remains blocked until:
  - legacy dependency inventory above has explicit keep/remove decisions
  - strict build warning policy has a documented resolution path
  - no new duplicate truth paths are introduced during prune/canonicalization

## Hardening Safety Rule Reminder
For each hardening change in Phases 23–27, classify as:
- observability
- enforcement
- prune
- canonicalization
- behavior change

Any `behavior change` must be explicitly justified in hardening summary.
Diagnostics/contracts must observe/elevate and must not silently mutate business logic.
