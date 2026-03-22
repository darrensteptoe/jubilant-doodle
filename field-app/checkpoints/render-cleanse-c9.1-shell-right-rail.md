# C9.1 Freeze — Shell and Right Rail Behavior

Date: 2026-03-21  
Scope: Shell/rail only

## Scope completed
- Hidden runtime/debug banner in normal UI (`#v3RuntimeDiagnostics[hidden]`).
- Removed top-strip glossary shortcut cluster from shell chrome.
- Set right rail default mode to `Results`.
- Added manual-intent auto-switch for glossary/manual/help selectors.
- Preserved explicit switch-back to `Results`.
- Removed universe/source-note rows from rail metadata.
- Reordered right rail sections with validation/guardrails before MC+risk and stress after risk.

## Tests/checks run
- `node --test js/app/v3/c9.shellLayout.contract.test.js` → pass
- `npm run check:interaction-integrity` → pass
- `npm run build` → pass

## Browser/manual parity evidence
- `/tmp/c9_district.log`
  - `#v3RuntimeDiagnostics` hidden
  - right rail Results toggle active by default (`aria-pressed="true"`)
  - rail section order in rendered DOM:
    - Win path
    - Input validation
    - Data checks & guardrails
    - Monte Carlo win probability
    - Risk framing
    - Stress test summary
  - metadata rows for universe/source note absent

## Freeze decision
C9.1 frozen.
