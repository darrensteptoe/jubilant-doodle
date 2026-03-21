# Post-Rebuild Complexity Guardrails (H9)

## Scope landed
- Added warning-level complexity and file-size guardrail scanner:
  - `scripts/check-complexity-guardrails.mjs`
- Added npm command:
  - `npm run check:complexity-guardrails`
- Added machine-readable and human-readable report outputs:
  - `audit/complexity-guardrails.json`
  - `audit/complexity-guardrails.md`

## Thresholds
- Surface file line warning: `> 700`
- Bridge file line warning: `> 160`
- Selector file line warning: `> 140`
- Runtime file line warning: `> 1200`
- Function complexity warning: decision points `> 36` with function lines `>= 40`
- Function length warning: function lines `> 220`

## Exceptions
- `js/appRuntime.js`
  - reason: staged orchestration shrink path is already tracked in follow-on pruning/hardening work.

## Mode behavior
- Default mode: warning/reporting only (non-blocking).
- Optional strict mode: `node scripts/check-complexity-guardrails.mjs --strict` fails when warnings are present.

## Verification commands
- `npm run check:complexity-guardrails`
- `npm run build`

## Results
- `npm run check:complexity-guardrails`
  - PASS (warning mode): `files=61 file_warnings=10 function_warnings=37 exceptions=1`
  - report artifacts:
    - `audit/complexity-guardrails.json`
    - `audit/complexity-guardrails.md`
- `npm run build`
  - PASS (`vite build`; 321 modules transformed)
