# Model Governance (Workstream 4)

Canonical governance modules:

- `js/core/assumptionBaselines.js`
- `js/core/modelGovernance.js`
- `js/core/confidence.js`

## Principles

- Forecast framing must include realism, data quality, and confidence context.
- UI surfaces render governance output but do not compute governance math.
- Baseline ranges and scoring rules live in core modules only.

## Current outputs

- Assumption realism score and flagged inputs.
- Data quality score (benchmarks, evidence, rolling-drift signals).
- Confidence score/band derived from realism, data quality, historical accuracy, and envelope stability.
- Top sensitivity drivers (when snapshot data exists).

## Integration seam

- Summary rendering computes governance once and passes it to validation and guardrail panels.
- Validation panel displays governance framing and warnings.
- Guardrails panel appends governance blocks alongside engine guardrails.
