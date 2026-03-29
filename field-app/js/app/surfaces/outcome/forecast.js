export function wireOutcomeForecastControls(context = {}) {
  const {
    bindOutcomeInputField,
    bindOutcomeSelectField,
    bindOutcomeAction,
  } = context;

  if (
    typeof bindOutcomeInputField !== "function"
    || typeof bindOutcomeSelectField !== "function"
    || typeof bindOutcomeAction !== "function"
  ) {
    return;
  }

  bindOutcomeInputField("v3OutcomeOrgCount", "orgCount");
  bindOutcomeInputField("v3OutcomeOrgHours", "orgHoursPerWeek");
  bindOutcomeInputField("v3OutcomeVolunteerMult", "volunteerMultBase");
  bindOutcomeInputField("v3OutcomeDoorShare", "channelDoorPct");
  bindOutcomeInputField("v3OutcomeDoorsPerHour", "doorsPerHour3");
  bindOutcomeInputField("v3OutcomeCallsPerHour", "callsPerHour3");

  bindOutcomeSelectField("v3OutcomeMcMode", "mcMode");
  bindOutcomeInputField("v3OutcomeMcSeed", "mcSeed");
  bindOutcomeSelectField("v3OutcomeMcVolatility", "mcVolatility");
  bindOutcomeInputField("v3OutcomeTurnoutReliabilityPct", "turnoutReliabilityPct");

  bindOutcomeInputField("v3OutcomeMcContactMin", "mcContactMin");
  bindOutcomeInputField("v3OutcomeMcContactMode", "mcContactMode");
  bindOutcomeInputField("v3OutcomeMcContactMax", "mcContactMax");
  bindOutcomeInputField("v3OutcomeMcPersMin", "mcPersMin");
  bindOutcomeInputField("v3OutcomeMcPersMode", "mcPersMode");
  bindOutcomeInputField("v3OutcomeMcPersMax", "mcPersMax");
  bindOutcomeInputField("v3OutcomeMcReliMin", "mcReliMin");
  bindOutcomeInputField("v3OutcomeMcReliMode", "mcReliMode");
  bindOutcomeInputField("v3OutcomeMcReliMax", "mcReliMax");
  bindOutcomeInputField("v3OutcomeMcDphMin", "mcDphMin");
  bindOutcomeInputField("v3OutcomeMcDphMode", "mcDphMode");
  bindOutcomeInputField("v3OutcomeMcDphMax", "mcDphMax");
  bindOutcomeInputField("v3OutcomeMcCphMin", "mcCphMin");
  bindOutcomeInputField("v3OutcomeMcCphMode", "mcCphMode");
  bindOutcomeInputField("v3OutcomeMcCphMax", "mcCphMax");
  bindOutcomeInputField("v3OutcomeMcVolMin", "mcVolMin");
  bindOutcomeInputField("v3OutcomeMcVolMode", "mcVolMode");
  bindOutcomeInputField("v3OutcomeMcVolMax", "mcVolMax");

  bindOutcomeAction("v3BtnOutcomeRun", "runMc");
  bindOutcomeAction("v3BtnOutcomeRerun", "rerunMc");
  bindOutcomeAction("v3BtnComputeSurface", "computeSurface");

  bindOutcomeSelectField("v3OutcomeSurfaceLever", "surfaceLever");
  bindOutcomeSelectField("v3OutcomeSurfaceMode", "surfaceMode");
  bindOutcomeInputField("v3OutcomeSurfaceMin", "surfaceMin");
  bindOutcomeInputField("v3OutcomeSurfaceMax", "surfaceMax");
  bindOutcomeInputField("v3OutcomeSurfaceSteps", "surfaceSteps");
  bindOutcomeInputField("v3OutcomeSurfaceTarget", "surfaceTarget");
}

export function syncOutcomeForecastCanonicalSnapshot(context = {}) {
  const {
    hasBridgeInputs,
    outcomeControlView,
    applyOutcomeControlView,
  } = context;

  if (!hasBridgeInputs || typeof applyOutcomeControlView !== "function") {
    return;
  }

  applyOutcomeControlView(outcomeControlView);
}

export function syncOutcomeForecastRunControls(context = {}) {
  const {
    hasBridgeInputs,
    outcomeControlView,
    hasBridgeControls,
    setOutcomeControlDisabled,
  } = context;

  if (typeof setOutcomeControlDisabled !== "function") {
    return;
  }

  const mcRunsInput = document.getElementById("v3OutcomeMcRuns");
  if (mcRunsInput instanceof HTMLInputElement) {
    if (document.activeElement !== mcRunsInput) {
      const runsValue = hasBridgeInputs ? String(outcomeControlView?.inputs?.mcRuns ?? "10000") : "10000";
      mcRunsInput.value = runsValue;
    }
    mcRunsInput.disabled = true;
  }

  if (hasBridgeControls) {
    setOutcomeControlDisabled("v3BtnOutcomeRun", !!outcomeControlView?.controls?.runDisabled);
    setOutcomeControlDisabled("v3BtnOutcomeRerun", !!outcomeControlView?.controls?.rerunDisabled);
    setOutcomeControlDisabled("v3BtnComputeSurface", !!outcomeControlView?.controls?.surfaceDisabled);
  }
}
