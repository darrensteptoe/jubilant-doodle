# Post-Rebuild Wrapper Retirement (H7)

## Scope completed
- Retired district aggregate compatibility reader:
  - removed `readDistrictBridgeView()` from `js/app/v3/bridges/districtBridge.js`
- Retired outcome aggregate compatibility reader:
  - removed `readOutcomeBridgeView()` from `js/app/v3/bridges/outcomeBridge.js`
- Migrated final callsites off retired outcome compatibility reader:
  - `js/app/v3/kpiBridge.js`
  - `js/app/v3/surfaces/outcome/index.js`

## Remaining wrappers and status
- `js/app/v3/bridges/electionDataBridge.js` `getView()`: retained for now (state bridge and QA probes still include aggregate fallback paths).
- `js/app/v3/bridges/weatherRiskBridge.js` decision aggregate extraction: retained until dedicated weather canonical/derived contract exists.
- `js/app/v3/bridges/eventCalendarBridge.js` decision aggregate extraction: retained until dedicated event canonical/derived contract exists.

## Test coverage added/updated
- Added: `js/app/v3/bridges/h7.wrapper-retirement.test.js`
  - asserts removed bridge readers are not present
  - asserts no `getView` fallback remains in district/outcome bridge readers
  - asserts outcome callsites no longer reference `readOutcomeBridgeView`
- Updated: `js/app/v3/bridges/phase11.cleanup.test.js`
  - now asserts no aggregate compatibility readers for district/outcome
  - asserts KPI bridge consumes derived outcome view only
- Updated: `js/app/v3/surfaces/outcome/phase10.integrity.test.js`
  - now asserts canonical/derived lane usage without compatibility aggregate fallback

## Verification commands
- `node --test js/app/v3/bridges/h7.wrapper-retirement.test.js`
- `node --test js/app/v3/bridges/phase11.cleanup.test.js`
- `node --test js/app/v3/surfaces/outcome/phase10.integrity.test.js`
- `npm run build`
