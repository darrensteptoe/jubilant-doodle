# District V2 Completeness Gaps (C8 Update)

Date: 2026-03-21  
Scope: District V2 rendered modules vs intended District feature set after C8 restoration

## Current District V2 rendered modules
- Race context
- Electorate
- Turnout baseline
- Ballot
- Candidate history
- Targeting config
- Census assumptions (including map shell/status + VTD ZIP lane)
- Election data summary
- District summary

## Completeness status

| Module/feature | C8 status | Underlying data/logic exists | Omission type | Intentionally deferred | Recommended next phase | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Turnout Baseline card (`turnoutA`, `turnoutB`, `bandWidth`) | Restored | Yes | None (restored) | No | Keep in C8 freeze set | `js/app/v3/surfaces/districtV2/turnoutBaseline.js`, `js/app/v3/surfaces/districtV2/index.js` (`syncDistrictV2TurnoutBaseline`, `bindDistrictV2TurnoutBaselineHandlers`) |
| Census map shell + status lane | Restored | Yes | None (restored) | No | Keep in C8 freeze set | `js/app/v3/surfaces/districtV2/censusConfig.js` (`v3DistrictV2CensusMapShell`, `v3DistrictV2CensusMapStatus`), `js/app/v3/surfaces/districtV2/index.js` (`syncDistrictV2Census`) |
| VTD ZIP intake + status lane | Restored | Yes | None (restored) | No | Keep in C8 freeze set | `js/app/v3/surfaces/districtV2/censusConfig.js` (`v3DistrictV2CensusMapQaVtdZip`, `v3DistrictV2CensusMapQaVtdZipStatus`), `js/app/v3/surfaces/districtV2/index.js` (`bindDistrictV2CensusFile`, `clearVtdZip` action wire) |
| Right-rail Race Context parity (template/office/election/seat/partisanship + election date) | Restored | Yes | None (restored) | No | Keep in C8 freeze set | `js/app/renderAssumptions.js` now reads `selectDistrictCanonicalView(state)` and renders explicit race-context canonical rows |
| Census advisory/election preview tables in District Census UI | Not restored by design | Yes | Intentional omission | Yes | Keep deferred; retain Election Data-first separation | `js/app/v3/surfaces/districtV2/censusConfig.js` has no advisory/election preview table nodes |
| Legacy District QA selectors targeting pre-V2 IDs | Restored to V2 selectors | Yes | None (updated) | No | Keep current | `js/app/v3/qaGates.js` district `STAGE_EXPECTATIONS` migrated to `v3DistrictV2*` selectors |

## Notes
- C8 intentionally keeps Census focused on geography/demography/map/VTD lanes.
- C8 intentionally avoids reintroducing old Census election advisory/preview UI; Election Data remains the election-results interpretation lane.
