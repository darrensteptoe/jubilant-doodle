# Model Governance

This project uses a strict separation of concerns to prevent model drift.

## Non-negotiables

1. Core deterministic math and Monte Carlo are the only numeric truth sources.
2. UI modules must render snapshots and never recompute planning math.
3. AI/intel features may annotate, explain, and recommend, but may not directly mutate core model inputs.
4. Every recommendation and calibration change must be auditable (`who/what/when/why`).
5. Import/export and migration must preserve reproducibility.

## Source-of-truth boundaries

- Core model truth:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/model.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/winMath.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/monteCarlo.js`
- Snapshot and integrity:
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/migrate.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/export.js`
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/hash.js`
- Intel metadata layer (non-math):
  - `/Users/anakinskywalker/Downloads/field-app-40/js/core/intelState.js`

## AI write contract

AI-allowed targets:
- `scenario.intelState.flags[]`
- `scenario.intelState.briefs[]`
- `scenario.intelState.recommendations[]`
- `scenario.intelState.audit[]`
- `scenario.intelState.observedMetrics[]`

AI-forbidden targets:
- Top-level numeric model inputs (turnout, persuasion, rates, capacity, budget, timeline, MC inputs)
- Deterministic/MC outputs
- Snapshot hash fields

## Change controls

1. If a recommendation proposes changing a core assumption, it must be a draft only.
2. Core assumption updates require explicit user action.
3. Applied updates must append an audit entry with evidence reference(s).

## Verification gates

Before release:
1. Self-Test pass.
2. Robust smoke pass.
3. No new runtime errors in diagnostics.
4. Export -> import -> export roundtrip remains stable.
