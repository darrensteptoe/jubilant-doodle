Field App Runtime Package

Generated: 2026-03-23T22:40:13.280Z
Source path: /Users/anakinskywalker/Downloads/field-app-40
Active runtime bundle: dist/assets/index-D_xTJd1z.js
Build verification: PASS

Verified built assets:
- dist/assets/build-D8U74VRh.js
- dist/assets/censusPhase1-CQ6y4u4v.js
- dist/assets/index-D_xTJd1z.js
- dist/assets/io-20lfPSXr.js
- dist/assets/operations-CQCIppQZ.js
- dist/assets/operationsPipeline-Cju-AW2K.js
- dist/assets/operationsRamp-Ckxhckh3.js
- dist/assets/operationsShifts-CfgVqaMT.js
- dist/assets/operationsTurf-C_udtR2y.js
- dist/assets/organizer-k_gz4XMd.js
- dist/assets/preload-helper-C-ObvbrE.js
- dist/assets/store-C16ymedL.js
- dist/assets/time-DMzu12fF.js
- dist/assets/twCapHelpers-Cz8gv3TZ.js
- dist/assets/view-CEp4BHYU.js

Verified UI markers:
- PASS: Reporting Workflow (dist/assets/index-D_xTJd1z.js)
- PASS: Lit Drop tactic (dist/assets/index-D_xTJd1z.js)
- PASS: Mail tactic (dist/assets/index-D_xTJd1z.js)
- PASS: Channel cost realism (dist/assets/index-D_xTJd1z.js)
- PASS: How to read this forecast (dist/assets/index-D_xTJd1z.js)
- PASS: How to use trust correctly (dist/assets/index-D_xTJd1z.js)
- PASS: How to use benchmark data without fooling yourself (dist/assets/index-D_xTJd1z.js)

Runtime payload:
- dist/

Excluded from deploy package:
- .git
- __MACOSX
- .DS_Store
- node_modules
- checkpoints
- recovery-snapshots
- audit
- interaction
- prune

Notes:
- This package is runtime-only and intentionally excludes workspace artifacts.
- Keep working repository history/checkpoints in source, not in deploy artifact.

Release verification:
This runtime package was built from the current source and verified against key visible UI markers. If the live app does not show recently added surfaces or wording, the most likely cause is that an older built artifact is still being served.

Release verification checklist:
- Rebuild the app before packaging.
- Deploy the newest `dist` output, not an older extracted folder.
- Hard refresh the browser after deploy.
- If a feature exists in source but not on screen, verify the built asset and hosting path before assuming the code is missing.
