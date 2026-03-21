# Post-Rebuild Compatibility Wrappers (H1)

## Wrapper inventory
| Wrapper | Path | Current dependency | Planned retirement trigger |
|---|---|---|---|
| District aggregate bridge reader | `readDistrictBridgeView()` in `js/app/v3/bridges/districtBridge.js` | Retired in H7; district bridge readers now require `getCanonicalView/getDerivedView` and no longer fallback through aggregate payload. | Completed: compatibility reader removed and callsites migrated. |
| Outcome aggregate bridge reader | `readOutcomeBridgeView()` in `js/app/v3/bridges/outcomeBridge.js` | Retired in H7; outcome bridge readers now require `getCanonicalView/getDerivedView` and no longer fallback through aggregate payload. | Completed: compatibility reader removed and callsites migrated. |
| Election Data combined compatibility view | `getView()` in `js/app/v3/bridges/electionDataBridge.js` | Existing consumers can still read a combined payload while canonical/derived readers exist. | Retire after all consumers are pinned to canonical or derived lane-specific readers. |
| Weather lane decision wrapper | `readWeatherRiskCanonicalView()` in `js/app/v3/bridges/weatherRiskBridge.js` | Reads weather from mixed decision bridge aggregate (`getView`). | Replace with dedicated weather runtime bridge exposing canonical/derived views. |
| Event lane decision wrapper | `readEventCalendarCanonicalView()` in `js/app/v3/bridges/eventCalendarBridge.js` | Reads event calendar from mixed decision bridge aggregate (`getView`). | Replace with dedicated event runtime bridge exposing canonical/derived views. |
| Surface barrel wrappers | `js/app/v3/surfaces/{district,data,outcome,electionData,decisionLog}.js` | Retired in H6 batch 2; stage mount now imports directory modules directly. | Completed: wrappers deleted after import migration. |
| District summary alias | `readDistrictSnapshot()` in `js/app/v3/stateBridge.js` | Retired by H12 verification; alias removed from tree. | Completed: no active callers and no alias export remains. |

## Wrapper policy
- Keep wrappers thin and side-effect free.
- No new wrappers without explicit migration deadline.
- Any wrapper retained must document replacement path and caller migration condition.
