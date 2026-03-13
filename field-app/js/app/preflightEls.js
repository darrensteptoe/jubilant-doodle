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
      "raceType",
      "electionDate",
      "weeksRemaining",
      "mode",
      "universeSize",
      "turnoutA",
      "turnoutB",
      "bandWidth",
      "btnAddCandidate",
      "yourCandidate",
      "candTbody",
      "undecidedPct",
      "undecidedMode",
      "persuasionPct",
      "earlyVoteExp",
    ];
    const requiredCensus = [
      "censusPhase1Card",
      "censusApiKey",
      "censusAcsYear",
      "censusResolution",
      "censusMetricSet",
      "censusStateFips",
      "censusCountyFips",
      "censusPlaceFips",
      "censusContextHint",
      "btnCensusLoadGeo",
      "btnCensusFetchRows",
      "censusGeoSelect",
      "censusAggregateTbody",
      "censusAdvisoryTbody",
      "censusAdvisoryStatus",
      "censusMap",
      "censusMapStatus",
      "btnCensusLoadMap",
      "btnCensusClearMap",
      "btnCensusSetRaceFootprint",
      "btnCensusClearRaceFootprint",
      "censusApplyAdjustmentsToggle",
      "censusApplyAdjustmentsStatus",
    ];
    const requiredTargeting = [
      "targetingGeoLevel",
      "targetingModelId",
      "targetingWeightVotePotential",
      "targetingWeightTurnoutOpportunity",
      "targetingWeightPersuasionIndex",
      "targetingWeightFieldEfficiency",
      "btnTargetingResetWeights",
      "btnRunTargeting",
      "targetingStatus",
      "targetingMeta",
      "targetingResultsTbody",
    ];

    const required = [...requiredAlways];
    if (hasEl("censusPhase1Card")){
      required.push(...requiredCensus);
    }
    if (hasEl("targetingResultsTbody") || hasEl("targetingModelId") || hasEl("btnRunTargeting")){
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
