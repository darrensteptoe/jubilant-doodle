function asNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(v){
  if (v == null || !Number.isFinite(v)) return null;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function fmtMaybeInt(v, fmtInt){
  if (v == null || !Number.isFinite(v)) return "\u2014";
  return fmtInt(Math.round(v));
}

function fmtSignedInt(v, fmtInt){
  if (v == null || !Number.isFinite(v)) return "\u2014";
  const n = Math.round(v);
  if (n > 0) return `+${fmtInt(n)}`;
  if (n < 0) return `-${fmtInt(Math.abs(n))}`;
  return "0";
}

function fmtPct01(v){
  if (v == null || !Number.isFinite(v)) return "\u2014";
  return `${(v * 100).toFixed(1)}%`;
}

function explainListOrDash(arr){
  return Array.isArray(arr) && arr.length ? arr.join(", ") : "\u2014";
}

function buildExplainLines(explainNode){
  if (!explainNode || typeof explainNode !== "object") return null;
  return {
    formula: explainNode.module || "\u2014",
    upstream: explainListOrDash(explainNode.inputs),
    dependsOn: explainListOrDash(explainNode.dependsOn),
    note: String(explainNode.note || "").trim() || "\u2014",
  };
}

function buildTraceItems({ state, res, weeks, fmtInt }){
  const explain = (res && typeof res === "object" && res.explain && typeof res.explain === "object")
    ? res.explain
    : null;

  const persuasionNeed = asNum(res?.expected?.persuasionNeed);
  const manualGoal = asNum(state?.goalSupportIds);
  const goalSource = (manualGoal != null && manualGoal >= 0) ? "goalSupportIds (manual)" : "persuasionNeed (auto)";
  const goal = (manualGoal != null && manualGoal >= 0) ? manualGoal : ((persuasionNeed != null && persuasionNeed > 0) ? persuasionNeed : 0);

  const supportRatePct = asNum(state?.supportRatePct);
  const contactRatePct = asNum(state?.contactRatePct);
  const supportRate = (supportRatePct != null && supportRatePct > 0) ? (supportRatePct / 100) : null;
  const contactRate = (contactRatePct != null && contactRatePct > 0) ? (contactRatePct / 100) : null;
  const reqConvosWeek = (goal > 0 && supportRate != null && weeks > 0) ? (goal / supportRate / weeks) : null;
  const reqAttemptsWeek = (reqConvosWeek != null && contactRate != null) ? (reqConvosWeek / contactRate) : null;

  const orgCount = asNum(state?.orgCount);
  const orgHoursPerWeek = asNum(state?.orgHoursPerWeek);
  const volunteerMult = asNum(state?.volunteerMultBase);
  const doorSharePct = asNum(state?.channelDoorPct);
  const doorsPerHour = asNum(state?.doorsPerHour3);
  const callsPerHour = asNum(state?.callsPerHour3);
  const doorShare = clamp01((doorSharePct == null) ? null : (doorSharePct / 100));
  const blendedAttemptsPerHour = (doorShare != null && doorsPerHour != null && callsPerHour != null)
    ? (doorShare * doorsPerHour + (1 - doorShare) * callsPerHour)
    : null;

  const capacityPerWeek = (
    orgCount != null && orgHoursPerWeek != null && volunteerMult != null && blendedAttemptsPerHour != null
  ) ? (orgCount * orgHoursPerWeek * blendedAttemptsPerHour * volunteerMult) : null;
  const gapPerWeek = (reqAttemptsWeek != null && capacityPerWeek != null) ? (reqAttemptsWeek - capacityPerWeek) : null;

  const mcWinProb = asNum(state?.mcLast?.winProb);
  const mcRuns = asNum(state?.mcLast?.runs);

  const overrideEnabled = !!state?.twCapOverrideEnabled;
  const overrideModeRaw = String(state?.twCapOverrideMode || "baseline");
  const overrideMode = ["baseline", "ramp", "scheduled", "max"].includes(overrideModeRaw) ? overrideModeRaw : "baseline";
  const overrideText = overrideEnabled ? `ON (${overrideMode})` : "OFF (baseline)";

  return [
    {
      title: "Win threshold",
      value: fmtMaybeInt(asNum(res?.expected?.winThreshold), fmtInt),
      outputs: "kpiWinThreshold-sidebar",
      formula: "max(projected opponent votes after undecided allocation) + 1",
      upstream: "turnoutA/turnoutB/bandWidth, candidates[].supportPct, undecidedMode/userSplit",
      downstream: "kpiPersuasionNeed-sidebar",
      explain: buildExplainLines(explain?.["expected.winThreshold"]),
    },
    {
      title: "Persuasion votes needed",
      value: fmtMaybeInt(persuasionNeed, fmtInt),
      outputs: "kpiPersuasionNeed-sidebar, wkGoal",
      formula: "max(0, winThreshold - yourProjectedVotes)",
      upstream: "win threshold inputs + yourCandidateId + candidate support distribution",
      downstream: "wkConvosPerWeek, wkAttemptsPerWeek, p3GapContacts, wkGapPerWeek",
      explain: buildExplainLines(explain?.["expected.persuasionNeed"]),
    },
    {
      title: "Required attempts per week",
      value: fmtMaybeInt(reqAttemptsWeek, fmtInt),
      outputs: "wkAttemptsPerWeek",
      formula: "goal / supportRate / contactRate / weeksRemaining",
      upstream: `${goalSource}, supportRatePct, contactRatePct, weeksRemaining/electionDate`,
      downstream: "p3GapContacts, wkGapPerWeek, weekly action recommendations",
    },
    {
      title: "Capacity contacts possible per week",
      value: fmtMaybeInt(capacityPerWeek, fmtInt),
      outputs: "p3CapContacts, wkCapacityPerWeek",
      formula: "orgCount * orgHoursPerWeek * blendedProductivity * volunteerMultiplier",
      upstream: "orgCount, orgHoursPerWeek, channelDoorPct, doorsPerHour3, callsPerHour3, volunteerMultBase",
      downstream: "p3GapContacts, wkGapPerWeek, bottleneck attribution",
    },
    {
      title: "Gap vs required contacts (per week)",
      value: fmtSignedInt(gapPerWeek, fmtInt),
      outputs: "p3GapContacts, wkGapPerWeek",
      formula: "requiredAttemptsPerWeek - capacityContactsPerWeek",
      upstream: "required attempts trace + capacity trace",
      downstream: "pace status, actions list, bottleneck/constraints messaging",
    },
    {
      title: "Monte Carlo win probability",
      value: `${fmtPct01(mcWinProb)}${mcRuns != null ? ` (${fmtMaybeInt(mcRuns, fmtInt)} runs)` : ""}`,
      outputs: "mcWinProb-sidebar, riskBandTag-sidebar",
      formula: "count(simulatedMargins >= 0) / runs",
      upstream: "all deterministic inputs + mcMode + mcVolatility + mcSeed + runs",
      downstream: "risk framing, decision confidence, scenario comparison context",
      explain: buildExplainLines(explain?.stressSummary),
    },
    {
      title: "Operations capacity override source",
      value: overrideText,
      outputs: "twCapOutlookActiveSource",
      formula: "if overrideEnabled then selected operations source else baseline capacity",
      upstream: "twCapOverrideEnabled, twCapOverrideMode, twCapOverrideHorizonWeeks, Operations records",
      downstream: "effective capacity -> wkCapacityPerWeek/p3CapContacts -> gap and MC staleness",
    },
  ];
}

function appendLine(parent, label, value){
  const div = document.createElement("div");
  div.className = "impact-trace-line";
  div.textContent = `${label}: ${value}`;
  parent.appendChild(div);
}

export function renderImpactTracePanel({ els, state, res, weeks, fmtInt }){
  if (!els?.impactTraceList) return;

  const list = els.impactTraceList;
  list.innerHTML = "";

  const items = buildTraceItems({
    state: state || {},
    res: res || {},
    weeks: Number.isFinite(Number(weeks)) ? Number(weeks) : 0,
    fmtInt,
  });

  for (const item of items){
    const box = document.createElement("section");
    box.className = "impact-trace-item";

    const head = document.createElement("div");
    head.className = "impact-trace-head";

    const title = document.createElement("span");
    title.textContent = item.title;
    head.appendChild(title);

    const value = document.createElement("span");
    value.className = "impact-trace-value";
    value.textContent = item.value;
    head.appendChild(value);

    box.appendChild(head);
    appendLine(box, "Cells", item.outputs);
    if (item.explain){
      appendLine(box, "Formula", item.explain.formula);
      appendLine(box, "Upstream inputs", item.explain.upstream);
      appendLine(box, "Depends on", item.explain.dependsOn);
      appendLine(box, "Explain note", item.explain.note);
      appendLine(box, "Downstream effects", item.downstream);
    } else {
      appendLine(box, "Formula", item.formula);
      appendLine(box, "Upstream inputs", item.upstream);
      appendLine(box, "Downstream effects", item.downstream);
    }

    list.appendChild(box);
  }
}
