# Repository Map (Safety-First)

This document is a conservative map of repository paths for organization and archival decisions.

Operating rule: path stability takes priority over aesthetics.

## 1) Active Production Paths

These are part of live runtime/build entry or active source.

- `index.html`, `organizer.html`, `operations.html`, `operations-pipeline.html`, `operations-shifts.html`, `operations-turf.html`, `operations-ramp.html`, `third-wing-*.html`, `camio.html`
- `js/`
- `styles.css`, `styles-shell.css`, `styles-fpe-v3.css`
- `assets/`
- `contracts/`
- `diagnostics/`
- `scenarios/`
- `scripts/`

Stability policy:
- Do not rename or move in organizational-only passes.
- Treat as live wiring unless a dedicated migration plan updates every reference.

## 2) Gate / Test / Packaging Paths

These paths are required by current scripts/gates/packaging flow.

- `interaction/`
  - referenced by `scripts/interaction-integrity.mjs`
  - referenced by `scripts/interaction-page-reports.mjs`
- `prune/`
  - required by `scripts/freeze-gate.mjs`
- `audit/`
  - required by `scripts/freeze-gate.mjs`
  - populated by multiple gate scripts
- `dist/`
  - required by `scripts/check-built-artifact.mjs`
  - packaged by `scripts/package-runtime-bundle.mjs`
- `release/`
  - output destination in `scripts/package-runtime-bundle.mjs`
- `.deployignore`
  - read by `scripts/package-runtime-bundle.mjs`

Stability policy:
- No moves/renames in organization passes.
- Keep filenames and relative layout stable.

## 3) Historical / Recovery / Release Record Paths

These exist to preserve restore, closeout, and deployment history.

- `checkpoints/`
  - read by status/parity scripts (`scripts/rebuild-status.mjs`, `scripts/manual-parity-status.mjs`, `scripts/new-manual-parity-log.mjs`)
- `recovery-snapshots/`
  - lockpoint snapshots and restore records
- `release/field-app-40-runtime-<timestamp>/`
  - historical runtime package outputs

Stability policy:
- Preserve as historical records.
- Do not reshuffle by default.

## 4) Candidate Archive-Only Paths (Future-Facing)

No existing folders were moved in this pass.

For future non-live, non-gate, non-historical clutter:
- use `_archive_candidates/` (see `_archive_candidates/README.md`)
- only after proof of non-reference in runtime/tests/scripts/packaging/docs

## 5) Untouched Because Hard-Wired

These are explicitly treated as hard-wired in current automation/contracts:

- `interaction/`
- `prune/`
- `audit/`
- `checkpoints/`
- `recovery-snapshots/`
- `release/`
- `dist/`

Plus all HTML entrypoints and active `js/` runtime tree.

## 6) Safe Organization Pattern

Preferred:
- add documentation for folder purpose and retention
- classify future artifacts before any move
- quarantine only with evidence and explicit validation

Avoid:
- live path rewrites in mixed feature/hardening phases
- moving gate-linked records for cosmetic reasons
