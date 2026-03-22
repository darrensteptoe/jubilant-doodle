# C9.2 Freeze — Top-Row Relocation and Summary Placement

Date: 2026-03-21  
Scope: Campaign context row placement + summary placement

## Scope completed
- Campaign context row (`Campaign ID`, `Campaign name`, `Office ID`, `Active scenario`) is now Data-stage scoped only.
  - Added `#v3DataContextSection` in shell below page title.
  - Visibility is controlled by stage: visible only when `activeStageId === "data"`.
- Summary-at-top placement and Election Data summary placement remain enforced:
  - District summary at top.
  - Election Data summary on Election Data page, not District.

## Files changed in C9.2 patch
- `js/app/v3/shell.js`
- `js/app/v3/stageMount.js`
- `js/app/v3/c9.shellLayout.contract.test.js`

## Tests/checks run
- `node --test js/app/v3/c9.shellLayout.contract.test.js` → pass (6/6)
- `npm run check:interaction-integrity` → pass (`total=113 pass=113 fail=0`)
- `npm run build` → pass

## Browser/manual parity evidence
- `/tmp/c92_district.log`
  - `#v3DataContextSection` present but `hidden`.
- `/tmp/c92_data.log`
  - `#v3DataContextSection` visible (no `hidden` attribute) under Data page heading.

## Freeze decision
C9.2 frozen.
