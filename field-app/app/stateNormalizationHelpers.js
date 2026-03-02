export function canonicalDoorsPerHourFromSnapModule(snap, safeNum){
  const s = snap || {};
  const canonical = safeNum(s.doorsPerHour3);
  if (canonical != null && isFinite(canonical)) return canonical;
  const legacy = safeNum(s.doorsPerHour);
  if (legacy != null && isFinite(legacy)) return legacy;
  return null;
}

export function setCanonicalDoorsPerHourModule(target, value, safeNum){
  if (!target || typeof target !== "object") return;
  const n = safeNum(value);
  const next = (n != null && isFinite(n)) ? n : "";
  target.doorsPerHour3 = next;
  target.doorsPerHour = next;
}

export function requiredScenarioKeysMissingModule(scen){
  const required = [
    "scenarioName","raceType","electionDate","weeksRemaining","mode",
    "universeBasis","universeSize","turnoutA","turnoutB","bandWidth",
    "candidates","undecidedPct","yourCandidateId","undecidedMode","persuasionPct",
    "earlyVoteExp","supportRatePct","contactRatePct","turnoutReliabilityPct",
    "universeLayerEnabled","universeDemPct","universeRepPct","universeNpaPct","universeOtherPct","retentionFactor",
    "mcMode","mcVolatility","mcSeed","budget","timelineEnabled","ui"
  ];
  const missing = [];
  if (!scen || typeof scen !== "object") return required.slice();
  for (const k of required){
    if (!(k in scen)) missing.push(k);
  }
  return missing;
}
