// @ts-check
/** @param {import("./types").PreflightElsCtx} ctx */
export function preflightElsModule(ctx){
  const { els, recordError } = ctx || {};
  try{
    const hasEl = (id) => Boolean((els && els[id]) || document.getElementById(id));
    const requiredAlways = [
      ["scenarioName", "v3ScenarioName"],
      ["buildStamp", "v3BuildStamp"],
      "selfTestGate",
      "persistenceStatus",
      ["btnDiagnostics", "v3BtnDiagnostics"],
      ["btnResetAll", "v3BtnReset"],
      "diagModal",
      "diagErrors",
      "btnDiagClose",
      "btnCopyDebug",
      ["raceType", "v3DistrictRaceType"],
      ["electionDate", "v3DistrictElectionDate"],
      ["weeksRemaining", "v3DistrictWeeksRemaining"],
      ["mode", "v3DistrictMode"],
      ["universeSize", "v3DistrictUniverseSize"],
      ["turnoutA", "v3DistrictTurnoutA"],
      ["turnoutB", "v3DistrictTurnoutB"],
      ["bandWidth", "v3DistrictBandWidth"],
      ["btnAddCandidate", "v3BtnAddCandidate"],
      ["yourCandidate", "v3DistrictYourCandidate"],
      ["candTbody", "v3DistrictCandTbody"],
      ["undecidedPct", "v3DistrictUndecidedPct"],
      ["undecidedMode", "v3DistrictUndecidedMode"],
      "persuasionPct",
      "earlyVoteExp",
    ];
    const requiredCensus = [
      ["censusPhase1Card", "v3DistrictCensusShell"],
      ["censusApiKey", "v3CensusApiKey"],
      ["censusAcsYear", "v3CensusAcsYear"],
      ["censusResolution", "v3CensusResolution"],
      ["censusMetricSet", "v3CensusMetricSet"],
      ["censusStateFips", "v3CensusStateFips"],
      ["censusCountyFips", "v3CensusCountyFips"],
      ["censusPlaceFips", "v3CensusPlaceFips"],
      ["censusContextHint", "v3CensusContextHint"],
      ["btnCensusLoadGeo", "v3BtnCensusLoadGeo"],
      ["btnCensusFetchRows", "v3BtnCensusFetchRows"],
      ["censusGeoSelect", "v3CensusGeoSelect"],
      ["censusAggregateTbody", "v3CensusAggregateTbody"],
      ["censusAdvisoryTbody", "v3CensusAdvisoryTbody"],
      ["censusAdvisoryStatus", "v3CensusAdvisoryStatus"],
      ["censusMap", "v3CensusMapHost"],
      ["censusMapStatus", "v3CensusMapStatus"],
      ["btnCensusLoadMap", "v3BtnCensusLoadMap"],
      ["btnCensusClearMap", "v3BtnCensusClearMap"],
      ["btnCensusSetRaceFootprint", "v3BtnCensusSetRaceFootprint"],
      ["btnCensusClearRaceFootprint", "v3BtnCensusClearRaceFootprint"],
      ["censusApplyAdjustmentsToggle", "v3CensusApplyAdjustmentsToggle"],
      ["censusApplyAdjustmentsStatus", "v3CensusApplyAdjustmentsStatus"],
    ];
    const requiredTargeting = [
      ["targetingGeoLevel", "v3DistrictTargetingGeoLevel"],
      ["targetingModelId", "v3DistrictTargetingModelId"],
      ["targetingWeightVotePotential", "v3DistrictTargetingWeightVotePotential"],
      ["targetingWeightTurnoutOpportunity", "v3DistrictTargetingWeightTurnoutOpportunity"],
      ["targetingWeightPersuasionIndex", "v3DistrictTargetingWeightPersuasionIndex"],
      ["targetingWeightFieldEfficiency", "v3DistrictTargetingWeightFieldEfficiency"],
      ["btnTargetingResetWeights", "v3BtnDistrictTargetingResetWeights"],
      ["btnRunTargeting", "v3BtnDistrictRunTargeting"],
      ["targetingStatus", "v3DistrictTargetingStatus"],
      ["targetingMeta", "v3DistrictTargetingMeta"],
      ["targetingResultsTbody", "v3DistrictTargetingResultsTbody"],
    ];

    const required = [...requiredAlways];
    if (hasEl("censusPhase1Card") || hasEl("v3DistrictCensusShell")){
      required.push(...requiredCensus);
    }
    if (
      hasEl("targetingResultsTbody") ||
      hasEl("targetingModelId") ||
      hasEl("btnRunTargeting") ||
      hasEl("v3DistrictTargetingResultsTbody") ||
      hasEl("v3DistrictTargetingModelId") ||
      hasEl("v3BtnDistrictRunTargeting")
    ){
      required.push(...requiredTargeting);
    }

    const missing = required
      .filter((req) => {
        if (Array.isArray(req)) return !req.some((id) => hasEl(id));
        return !hasEl(req);
      })
      .map((req) => Array.isArray(req) ? req.join(" or ") : req);
    if (missing.length) recordError("dom-preflight", `Missing required element(s): ${missing.join(", ")}`);
  } catch { /* ignore */ }
}
