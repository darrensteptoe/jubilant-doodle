# Census Advisory Canon-Lock Restoration (District V2)

## Scope
- Added a District V2 Census advisory/assumptions analysis section in the current V3 surface structure.
- Kept advisory calculations in canon runtime logic.
- Reused existing bridge-derived advisory rows/status and assumption/apply status channels.

## Non-goals enforced
- No election CSV upload/preview UI added to District V2 Census advisory section.
- No advisory math moved into UI layer.
- No legacy architecture rollback.

## Canon calculation sources
- `js/core/censusModule.js`
  - `buildCensusAssumptionAdvisory(...)`
  - `evaluateCensusPaceAgainstAdvisory(...)`
  - `buildCensusPaceFeasibilitySnapshot(...)`
- `js/app/censusPhase1.js`
  - Canon advisory row construction and formatting
  - Canon advisory status synthesis
  - Bridge payload publication (`bridgeAdvisoryRows`, `bridgeAdvisoryStatusText`)

## Field-by-field canon output mapping
All required advisory outputs are emitted from canon advisory row construction in `js/app/censusPhase1.js` (labels at lines 2003-2038), backed by `buildCensusPaceFeasibilitySnapshot(...)` and related advisory functions in `js/core/censusModule.js`.

1. Field speed index -> `advisory.indices.fieldSpeed` (+ band)
2. Persuasion environment -> `advisory.indices.persuasionEnvironment` (+ band)
3. Turnout elasticity -> `advisory.indices.turnoutElasticity` (+ band)
4. Turnout potential index -> `advisory.indices.turnoutPotential` (+ band)
5. Field difficulty -> `advisory.indices.fieldDifficulty` (+ band)
6. Density ratio -> `advisory.indices.densityRatio` (+ density band label)
7. Vehicle availability / no vehicle share -> `advisory.indices.vehicleAvailability`, `advisory.indices.noVehicleShare`
8. Long commute / super commute -> `advisory.indices.longCommuteShare`, `advisory.indices.superCommuteShare`
9. No internet share -> `advisory.indices.noInternetShare`
10. Poverty share -> `advisory.indices.povertyShare`
11. Walkability factor -> `advisory.indices.walkability`
12. Contact probability modifier -> `advisory.multipliers.contactRate`
13. Estimated doors/hour factor -> `advisory.indices.estimatedDoorsPerHourFactor`
14. Age distribution -> `advisory.indices.ageDistribution`
15. Advisory doors/hour multiplier -> `advisory.multipliers.doorsPerHour` (+ APH delta)
16. Current blended APH -> `advisory.aph.base`
17. Achievable APH band (p25/p50/p75) -> `advisory.aph.range.low/mid/high`
18. Environment-adjusted APH (p50) -> `advisory.aph.adjusted`
19. Required APH to hit goal -> `advisoryPace.requiredAph`
20. APH feasibility -> `advisoryPace` feasibility/severity text against achievable range

## New District V2 advisory surface wiring
- UI shell and operator guidance:
  - `js/app/v3/surfaces/districtV2/censusConfig.js`
  - `v3DistrictV2CensusAdvisoryStatusSummary`
  - `v3DistrictV2CensusAssumptionProvenance`
  - `v3DistrictV2CensusApplyAdjustmentsStatus`
  - `v3DistrictV2CensusAdvisoryTbody`
- Sync layer:
  - `js/app/v3/surfaces/districtV2/index.js`
  - `syncDistrictV2Census(...)` writes advisory/provenance/apply statuses and rows
  - `renderDistrictV2CensusAdvisoryRows(...)` renders bridge rows only

## Downstream information flow (canon-aligned)
1. Canon advisory computed in `js/core/censusModule.js`
2. Advisory/status rows assembled in `js/app/censusPhase1.js`
3. Published on runtime census bridge fields:
   - `bridgeAdvisoryRows`
   - `bridgeAdvisoryStatusText`
4. District derived bridge view exposes census advisory fields in `js/appRuntime.js`
5. V3 bridge snapshots normalize/read these in `js/app/v3/stateBridge.js`
6. District V2 Census UI syncs and renders advisory status/rows in `js/app/v3/surfaces/districtV2/index.js`
7. Assumption provenance/apply-adjustments status stays connected through the same bridge chain and remains visible in advisory section

## Election Data vs Census boundary
- District V2 Census advisory section does not restore election preview/advisory UI.
- Election preview table IDs/labels remain absent from `js/app/v3/surfaces/districtV2/censusConfig.js`.
- Census advisory remains ACS/geography/operating-conditions focused.

## Canon-lock confirmation
- Advisory section uses existing canon advisory outputs and status text from runtime bridge.
- No new substitute formulas introduced in District V2 UI layer.
- No placeholder-only advisory table: rows come from canon runtime advisory builder.
