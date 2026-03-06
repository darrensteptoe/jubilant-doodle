export function hashMcInputsModule(args){
  const {
    state,
    res,
    weeks,
    deriveNeedVotes,
    safeNum,
    canonicalDoorsPerHourFromSnap,
  } = args || {};

  const needVotes = deriveNeedVotes(res);
  const payload = {
    weeks,
    needVotes,
    // Capacity
    orgCount: safeNum(state.orgCount),
    orgHoursPerWeek: safeNum(state.orgHoursPerWeek),
    volunteerMultBase: safeNum(state.volunteerMultBase),
    channelDoorPct: safeNum(state.channelDoorPct),
    doorsPerHour3: canonicalDoorsPerHourFromSnap(state),
    callsPerHour3: safeNum(state.callsPerHour3),
    // Base rates (Phase 2 + p3)
    contactRatePct: safeNum(state.contactRatePct),
    supportRatePct: safeNum(state.supportRatePct),
    turnoutReliabilityPct: safeNum(state.turnoutReliabilityPct),

    // Universe composition + retention
    universeLayerEnabled: !!state.universeLayerEnabled,
    universeDemPct: safeNum(state.universeDemPct),
    universeRepPct: safeNum(state.universeRepPct),
    universeNpaPct: safeNum(state.universeNpaPct),
    universeOtherPct: safeNum(state.universeOtherPct),
    retentionFactor: safeNum(state.retentionFactor),

    // Turnout / GOTV
    turnoutEnabled: !!state.turnoutEnabled,
    turnoutBaselinePct: safeNum(state.turnoutBaselinePct),
    turnoutTargetOverridePct: state.turnoutTargetOverridePct ?? "",
    gotvMode: state.gotvMode || "basic",
    gotvLiftPP: safeNum(state.gotvLiftPP),
    gotvMaxLiftPP: safeNum(state.gotvMaxLiftPP),
    gotvDiminishing: !!state.gotvDiminishing,
    gotvLiftMin: safeNum(state.gotvLiftMin),
    gotvLiftMode: safeNum(state.gotvLiftMode),
    gotvLiftMax: safeNum(state.gotvLiftMax),
    gotvMaxLiftPP2: safeNum(state.gotvMaxLiftPP2),

    // MC config
    mcMode: state.mcMode || "basic",
    mcVolatility: state.mcVolatility || "med",
    mcSeed: state.mcSeed || "",

    // Advanced ranges
    mcContactMin: safeNum(state.mcContactMin),
    mcContactMode: safeNum(state.mcContactMode),
    mcContactMax: safeNum(state.mcContactMax),
    mcPersMin: safeNum(state.mcPersMin),
    mcPersMode: safeNum(state.mcPersMode),
    mcPersMax: safeNum(state.mcPersMax),
    mcReliMin: safeNum(state.mcReliMin),
    mcReliMode: safeNum(state.mcReliMode),
    mcReliMax: safeNum(state.mcReliMax),
    mcDphMin: safeNum(state.mcDphMin),
    mcDphMode: safeNum(state.mcDphMode),
    mcDphMax: safeNum(state.mcDphMax),
    mcCphMin: safeNum(state.mcCphMin),
    mcCphMode: safeNum(state.mcCphMode),
    mcCphMax: safeNum(state.mcCphMax),
    mcVolMin: safeNum(state.mcVolMin),
    mcVolMode: safeNum(state.mcVolMode),
    mcVolMax: safeNum(state.mcVolMax),
  };
  return JSON.stringify(payload);
}
