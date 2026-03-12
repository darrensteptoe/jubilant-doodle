// @ts-check
export function applyStateToUiBindings({
  els,
  state,
  syncMcModeUI,
  syncGotvModeUI,
  applyThemeFromState,
}){
  els.scenarioName.value = state.scenarioName || "";
  els.raceType.value = state.raceType || "state_leg";
  els.electionDate.value = state.electionDate || "";
  els.weeksRemaining.value = state.weeksRemaining || "";
  els.mode.value = state.mode || "persuasion";

  els.universeBasis.value = state.universeBasis || "registered";
  els.universeSize.value = state.universeSize ?? "";
  els.sourceNote.value = state.sourceNote || "";

  els.turnoutA.value = state.turnoutA ?? "";
  els.turnoutB.value = state.turnoutB ?? "";
  els.bandWidth.value = state.bandWidth ?? "";

  els.undecidedPct.value = state.undecidedPct ?? "";
  els.undecidedMode.value = state.undecidedMode || "proportional";

  els.persuasionPct.value = state.persuasionPct ?? "";
  els.earlyVoteExp.value = state.earlyVoteExp ?? "";

  if (els.goalSupportIds) els.goalSupportIds.value = state.goalSupportIds ?? "";
  if (els.supportRatePct) els.supportRatePct.value = state.supportRatePct ?? "";
  if (els.contactRatePct) els.contactRatePct.value = state.contactRatePct ?? "";
  if (els.doorsPerHour) els.doorsPerHour.value = state.doorsPerHour ?? "";
  if (els.hoursPerShift) els.hoursPerShift.value = state.hoursPerShift ?? "";
  if (els.shiftsPerVolunteerPerWeek) els.shiftsPerVolunteerPerWeek.value = state.shiftsPerVolunteerPerWeek ?? "";

  if (els.universe16Enabled) els.universe16Enabled.checked = !!state.universeLayerEnabled;
  if (els.universe16DemPct) els.universe16DemPct.value = state.universeDemPct ?? "";
  if (els.universe16RepPct) els.universe16RepPct.value = state.universeRepPct ?? "";
  if (els.universe16NpaPct) els.universe16NpaPct.value = state.universeNpaPct ?? "";
  if (els.universe16OtherPct) els.universe16OtherPct.value = state.universeOtherPct ?? "";
  if (els.retentionFactor) els.retentionFactor.value = state.retentionFactor ?? "";

  if (els.orgCount) els.orgCount.value = state.orgCount ?? "";
  if (els.orgHoursPerWeek) els.orgHoursPerWeek.value = state.orgHoursPerWeek ?? "";
  if (els.volunteerMultBase) els.volunteerMultBase.value = state.volunteerMultBase ?? "";
  if (els.channelDoorPct) els.channelDoorPct.value = state.channelDoorPct ?? "";
  if (els.doorsPerHour3) els.doorsPerHour3.value = state.doorsPerHour3 ?? "";
  if (els.callsPerHour3) els.callsPerHour3.value = state.callsPerHour3 ?? "";
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.value = state.turnoutReliabilityPct ?? "";

  if (els.turnoutEnabled) els.turnoutEnabled.checked = !!state.turnoutEnabled;
  if (els.turnoutBaselinePct) els.turnoutBaselinePct.value = state.turnoutBaselinePct ?? "";
  if (els.turnoutTargetOverridePct) els.turnoutTargetOverridePct.value = state.turnoutTargetOverridePct ?? "";
  if (els.gotvMode) els.gotvMode.value = state.gotvMode || "basic";
  if (els.gotvLiftPP) els.gotvLiftPP.value = state.gotvLiftPP ?? "";
  if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.value = state.gotvMaxLiftPP ?? "";
  if (els.gotvDiminishing) els.gotvDiminishing.checked = !!state.gotvDiminishing;
  if (els.gotvLiftMin) els.gotvLiftMin.value = state.gotvLiftMin ?? "";
  if (els.gotvLiftMode) els.gotvLiftMode.value = state.gotvLiftMode ?? "";
  if (els.gotvLiftMax) els.gotvLiftMax.value = state.gotvLiftMax ?? "";
  if (els.gotvMaxLiftPP2) els.gotvMaxLiftPP2.value = state.gotvMaxLiftPP2 ?? "";

  if (els.mcMode) els.mcMode.value = state.mcMode || "basic";
  if (els.mcVolatility) els.mcVolatility.value = state.mcVolatility || "med";
  if (els.mcSeed) els.mcSeed.value = state.mcSeed || "";

  const setIf = (el, v) => { if (el) el.value = v ?? ""; };
  setIf(els.mcContactMin, state.mcContactMin);
  setIf(els.mcContactMode, state.mcContactMode);
  setIf(els.mcContactMax, state.mcContactMax);
  setIf(els.mcPersMin, state.mcPersMin);
  setIf(els.mcPersMode, state.mcPersMode);
  setIf(els.mcPersMax, state.mcPersMax);
  setIf(els.mcReliMin, state.mcReliMin);
  setIf(els.mcReliMode, state.mcReliMode);
  setIf(els.mcReliMax, state.mcReliMax);
  setIf(els.mcDphMin, state.mcDphMin);
  setIf(els.mcDphMode, state.mcDphMode);
  setIf(els.mcDphMax, state.mcDphMax);
  setIf(els.mcCphMin, state.mcCphMin);
  setIf(els.mcCphMode, state.mcCphMode);
  setIf(els.mcCphMax, state.mcCphMax);
  setIf(els.mcVolMin, state.mcVolMin);
  setIf(els.mcVolMode, state.mcVolMode);
  setIf(els.mcVolMax, state.mcVolMax);

  syncMcModeUI();
  syncGotvModeUI();

  if (els.roiDoorsEnabled) els.roiDoorsEnabled.checked = !!state.budget?.tactics?.doors?.enabled;
  if (els.roiDoorsCpa) els.roiDoorsCpa.value = state.budget?.tactics?.doors?.cpa ?? "";
  if (els.roiDoorsKind) els.roiDoorsKind.value = state.budget?.tactics?.doors?.kind || "persuasion";
  if (els.roiDoorsCr) els.roiDoorsCr.value = state.budget?.tactics?.doors?.crPct ?? "";
  if (els.roiDoorsSr) els.roiDoorsSr.value = state.budget?.tactics?.doors?.srPct ?? "";
  if (els.roiPhonesEnabled) els.roiPhonesEnabled.checked = !!state.budget?.tactics?.phones?.enabled;
  if (els.roiPhonesCpa) els.roiPhonesCpa.value = state.budget?.tactics?.phones?.cpa ?? "";
  if (els.roiPhonesKind) els.roiPhonesKind.value = state.budget?.tactics?.phones?.kind || "persuasion";
  if (els.roiPhonesCr) els.roiPhonesCr.value = state.budget?.tactics?.phones?.crPct ?? "";
  if (els.roiPhonesSr) els.roiPhonesSr.value = state.budget?.tactics?.phones?.srPct ?? "";
  if (els.roiTextsEnabled) els.roiTextsEnabled.checked = !!state.budget?.tactics?.texts?.enabled;
  if (els.roiTextsCpa) els.roiTextsCpa.value = state.budget?.tactics?.texts?.cpa ?? "";
  if (els.roiTextsKind) els.roiTextsKind.value = state.budget?.tactics?.texts?.kind || "persuasion";
  if (els.roiTextsCr) els.roiTextsCr.value = state.budget?.tactics?.texts?.crPct ?? "";
  if (els.roiTextsSr) els.roiTextsSr.value = state.budget?.tactics?.texts?.srPct ?? "";
  if (els.roiOverheadAmount) els.roiOverheadAmount.value = state.budget?.overheadAmount ?? "";
  if (els.roiIncludeOverhead) els.roiIncludeOverhead.checked = !!state.budget?.includeOverhead;

  if (els.optMode) els.optMode.value = state.budget?.optimize?.mode || "budget";
  if (els.optObjective) els.optObjective.value = state.budget?.optimize?.objective || "net";
  if (els.tlOptEnabled) els.tlOptEnabled.checked = !!state.budget?.optimize?.tlConstrainedEnabled;
  if (els.tlOptObjective) els.tlOptObjective.value = state.budget?.optimize?.tlConstrainedObjective || "max_net";
  if (els.optBudget) els.optBudget.value = state.budget?.optimize?.budgetAmount ?? "";
  if (els.optCapacity) els.optCapacity.value = state.budget?.optimize?.capacityAttempts ?? "";
  if (els.optStep) els.optStep.value = state.budget?.optimize?.step ?? 25;
  if (els.optUseDecay) els.optUseDecay.checked = !!state.budget?.optimize?.useDecay;

  if (els.timelineEnabled) els.timelineEnabled.checked = !!state.timelineEnabled;
  if (els.timelineActiveWeeks) els.timelineActiveWeeks.value = state.timelineActiveWeeks ?? "";
  if (els.timelineGotvWeeks) els.timelineGotvWeeks.value = state.timelineGotvWeeks ?? "";
  if (els.timelineStaffCount) els.timelineStaffCount.value = state.timelineStaffCount ?? "";
  if (els.timelineStaffHours) els.timelineStaffHours.value = state.timelineStaffHours ?? "";
  if (els.timelineVolCount) els.timelineVolCount.value = state.timelineVolCount ?? "";
  if (els.timelineVolHours) els.timelineVolHours.value = state.timelineVolHours ?? "";
  if (els.timelineRampEnabled) els.timelineRampEnabled.checked = !!state.timelineRampEnabled;
  if (els.timelineRampMode) els.timelineRampMode.value = state.timelineRampMode || "linear";
  if (els.timelineDoorsPerHour) els.timelineDoorsPerHour.value = state.timelineDoorsPerHour ?? "";
  if (els.timelineCallsPerHour) els.timelineCallsPerHour.value = state.timelineCallsPerHour ?? "";
  if (els.timelineTextsPerHour) els.timelineTextsPerHour.value = state.timelineTextsPerHour ?? "";

  if (els.toggleAdvDiag) els.toggleAdvDiag.checked = !!state.ui?.advDiag;
  if (els.advDiagBox) els.advDiagBox.hidden = !state.ui?.advDiag;
  if (els.toggleTraining) els.toggleTraining.checked = !!state.ui?.training;

  document.body.classList.toggle("training", !!state.ui?.training);
  applyThemeFromState();
}
