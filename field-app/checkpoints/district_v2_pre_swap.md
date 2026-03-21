# District V2 Pre-Swap Report (2026-03-21)

## 1. New files added
- `js/app/v3/surfaces/districtV2/index.js`
- `js/app/v3/surfaces/districtV2/raceContext.js`
- `js/app/v3/surfaces/districtV2/electorate.js`
- `js/app/v3/surfaces/districtV2/ballot.js`
- `js/app/v3/surfaces/districtV2/candidateHistory.js`
- `js/app/v3/surfaces/districtV2/targetingConfig.js`
- `js/app/v3/surfaces/districtV2/censusConfig.js`
- `js/app/v3/surfaces/districtV2/electionDataSummary.js`
- `js/app/v3/surfaces/districtV2/summary.js`
- `js/app/v3/surfaces/districtV2/mount-isolation.test.js`
- `js/core/selectors/districtV2.persistence.test.js`

## 2. Old files bypassed (temporary)
- Active legacy District surface remains at `js/app/v3/surfaces/district/index.js` during temporary route validation.
- Legacy surface now includes temporary mount marker: `[district_legacy] mounted`.

## 3. Temporary route/stage wiring (`district_v2`)
- `js/app/v3/stageRegistry.js`
  - Added stage id: `district_v2`
  - Surface key: `districtV2`
- `js/app/v3/stageMount.js`
  - Added renderer import: `renderDistrictV2Surface`
  - Added surface map entry: `districtV2: renderDistrictV2Surface`
- Direct path for isolated mount verification:
  - `?stage=district_v2`

## 4. Browser verification status before swap
Manual browser verification by this agent is **not executable** in this environment.
Automated verification completed:
- `node --test js/app/v3/surfaces/districtV2/mount-isolation.test.js js/core/selectors/districtV2.persistence.test.js` (PASS 8/8)
- `npm run check:district-integrity` (PASS)
- `npm run check:contracts` (PASS)
- `npm run check:interaction-integrity` (PASS)
- `npm run check:interaction-pages` (PASS)
- `npm run build` (PASS)

## 5. Planned swap changes (`district_v2` -> `district`)
- Set `district` stage surface to `districtV2`.
- Remove temporary `district_v2` stage entry.
- Remove legacy district renderer from stage mount map.
- Replace `js/app/v3/surfaces/district/index.js` with a thin compatibility export to `districtV2`.
- Remove old district module implementation files after route swap.
