// @ts-check
/** @param {import("./types").PreflightElsCtx} ctx */
export function preflightElsModule(ctx){
  const { els, recordError } = ctx || {};
  try{
    const hasEl = (id) => Boolean((els && els[id]) || document.getElementById(id));
    const requiredAlways = [
      "scenarioName",
      "buildStamp",
      "selfTestGate",
      "persistenceStatus",
      "btnDiagnostics",
      "btnResetAll",
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

    const missing = required.filter((k) => !hasEl(k));
    if (missing.length) recordError("dom-preflight", `Missing required element(s): ${missing.join(", ")}`);
  } catch { /* ignore */ }
}
