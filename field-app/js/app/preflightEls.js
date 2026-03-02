export function preflightElsModule(ctx){
  const { els, recordError } = ctx || {};
  try{
    const required = [
      "scenarioName",
      "buildStamp",
      "selfTestGate",
      "btnDiagnostics",
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
    const missing = required.filter((k) => els[k] == null);
    if (missing.length) recordError("dom-preflight", `Missing required element(s): ${missing.join(", ")}`);
  } catch { /* ignore */ }
}
