# Post-Rebuild Cleanup Inventory (H1)

## Classification legend
- `remove now`: safe retirement candidate with no active caller dependency.
- `remove later`: transitional path still referenced by active runtime wiring.
- `keep`: required for current runtime/fallback behavior.

## Inventory
| Item | Path | Classification | Decision | Justification |
|---|---|---|---|---|
| District summary alias wrapper | `js/app/v3/stateBridge.js` (`readDistrictSnapshot`) | compatibility helper | remove now (retired in H12) | Alias no longer exists in tree; `readDistrictSummarySnapshot` is the canonical reader. |
| Legacy bridge aggregate fallback | `js/app/v3/bridges/districtBridge.js` (`readDistrictBridgeView`) | bridge compatibility | remove now (retired in H7) | District runtime now depends on split canonical/derived bridge readers; aggregate reader removed. |
| Legacy bridge aggregate fallback | `js/app/v3/bridges/outcomeBridge.js` (`readOutcomeBridgeView`) | bridge compatibility | remove now (retired in H7) | Outcome runtime now depends on split canonical/derived bridge readers; aggregate reader removed. |
| Mixed decision-bridge weather lane | `js/app/v3/bridges/weatherRiskBridge.js` (`api.getView()` extraction) | mixed bridge dependency | remove later | Weather still reads through decision aggregate bridge in runtime. |
| Mixed decision-bridge event lane | `js/app/v3/bridges/eventCalendarBridge.js` (`api.getView()` extraction) | mixed bridge dependency | remove later | Event calendar still reads through decision aggregate bridge in runtime. |
| Surface re-export wrappers | `js/app/v3/surfaces/{district,data,outcome,electionData,decisionLog}.js` | module compatibility wrappers | remove now (retired in H6 batch 2) | Stage mount now imports directory entries directly (`./surfaces/*/index.js`); wrapper files removed. |
| Legacy rail mount shim | `js/app/v3/stageMount.js` (`legacyResultsSidebar` move/hide helpers) | legacy shell compatibility | remove later | Required while legacy right-rail fallback remains in runtime. |
| Hidden legacy shell root | `index.html` (`#legacyShellRoot`) | legacy fallback shell | keep | Needed for compatibility mode and staged fallback boot path. |
| Stylesheet fallback duplicate | `styles-fpe-v3.css` + `js/styles-fpe-v3.css` | fallback asset | keep | Primary stylesheet includes explicit JS-path fallback loader; duplicate remains intentional. |
| Large runtime orchestration hub | `js/appRuntime.js` | orchestration concentration | remove later (reduce) | Functional but oversized; continue reducing responsibilities in follow-on pruning phases. |
