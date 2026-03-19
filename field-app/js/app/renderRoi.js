// @ts-check
import { resolveFeatureFlags } from "../core/featureFlags.js";
import {
  buildTimelineTacticKindsMapFromState,
  computeTimelineCapsSummaryFromState,
} from "../core/timelineCapsInput.js";
import { resolveCanonicalCallsPerHour, resolveCanonicalDoorShareUnit } from "../core/throughput.js";
import {
  buildTurnoutModelFromState,
  computeGotvAddedVotes,
  computeTargetUniverseSize,
} from "../core/voteProduction.js";
import {
  buildRoiTableRowsView,
  buildRoiTurnoutDisabledSummary,
  buildRoiTurnoutSummary,
  computeRoiContactsAtCapacity,
  formatRoiNeedVotesText,
} from "../core/roiView.js";

export function renderRoiModule(args){
  const {
    els,
    state,
    res,
    weeks,
    deriveNeedVotes,
    getEffectiveBaseRates,
    computeCapacityBreakdown,
    safeNum,
    canonicalDoorsPerHourFromSnap,
    engine,
    computeAvgLiftPP,
    fmtInt,
  } = args || {};

  const features = resolveFeatureFlags(state || {});

  const needVotes = deriveNeedVotes(res);
  const eff = getEffectiveBaseRates();
  const cr = eff.cr;
  const sr = eff.sr;
  const tr = eff.tr;

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  const capacityDecay = {
    enabled: !!features.capacityDecayEnabled,
    type: String(state?.intelState?.expertToggles?.decayModel?.type || "linear"),
    weeklyDecayPct: safeNum(state?.intelState?.expertToggles?.decayModel?.weeklyDecayPct),
    floorPctOfBaseline: safeNum(state?.intelState?.expertToggles?.decayModel?.floorPctOfBaseline),
  };
  const capBreakdown = computeCapacityBreakdown({
    weeks: w,
    orgCount: safeNum(state.orgCount),
    orgHoursPerWeek: safeNum(state.orgHoursPerWeek),
    volunteerMult: safeNum(state.volunteerMultBase),
    doorShare: resolveCanonicalDoorShareUnit(state),
    doorsPerHour: canonicalDoorsPerHourFromSnap(state),
    callsPerHour: resolveCanonicalCallsPerHour(state, { toNumber: safeNum }),
    capacityDecay,
  });
  const baseCapAttempts = capBreakdown?.total ?? null;

  const budget = state.budget || {};
  const opt = budget.optimize || {};
  const tactics = budget.tactics || {};
  const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
  const includeOverhead = !!budget.includeOverhead;

  const mcLast = state.mcLast || null;

  const turnoutModel = buildTurnoutModelFromState(state, {
    enabled: !!features.turnoutModelingEnabled,
    includeDisabled: true,
  }) || {
    enabled: false,
    baselineTurnoutPct: null,
    liftPerContactPP: null,
    maxLiftPP: null,
    useDiminishing: false,
  };

  const tlConstrainedOn = !!opt.tlConstrainedEnabled;
  const timelineEnabled = !!features.timelineEnabled;
  const timelineCapsOn = tlConstrainedOn && timelineEnabled;
  let capAttempts = baseCapAttempts;
  let capByTactic = {
    doors: capBreakdown?.doors ?? null,
    phones: capBreakdown?.phones ?? null,
    texts: null,
    litDrop: null,
    mail: null,
  };

  if (timelineCapsOn){
    const capsSummary = computeTimelineCapsSummaryFromState({
      state,
      weeksRemaining: weeks ?? 0,
      enabled: true,
      tacticKinds: buildTimelineTacticKindsMapFromState(state),
      computeMaxAttemptsByTactic: (capsInput) => engine.computeMaxAttemptsByTactic(capsInput),
    });
    if (capsSummary.maxAttemptsByTactic){
      const timelineCapsByTactic = capsSummary.capsByTactic || {};
      capByTactic = { ...capByTactic, ...timelineCapsByTactic };
      capAttempts = (capsSummary.totalAttempts != null) ? capsSummary.totalAttempts : baseCapAttempts;
    }
  }

  const { rows, banner } = engine.computeRoiRows({
    goalObjectiveValue: needVotes,
    baseRates: { cr, sr, tr },
    tactics,
    overheadAmount,
    includeOverhead,
    caps: { total: capAttempts, ...capByTactic },
    mcLast,
    turnoutModel,
    workforce: state?.ui?.twCapOutlookLatest?.workforce || null,
  });

  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  state.ui.lastRoiRows = structuredClone(Array.isArray(rows) ? rows : []);
  state.ui.lastRoiBanner = banner
    ? { kind: String(banner.kind || ""), text: String(banner.text || "") }
    : null;

  if (els.roiBanner){
    if (banner){
      els.roiBanner.hidden = false;
      els.roiBanner.className = `banner ${banner.kind}`;
      els.roiBanner.textContent = banner.text;
    } else {
      els.roiBanner.hidden = true;
    }
  }

  const needVotesText = formatRoiNeedVotesText(needVotes, {
    formatInt: fmtInt,
  });
  if (turnoutModel.enabled){
    const targetUniverseSize = computeTargetUniverseSize({
      universeSize: safeNum(state.universeSize),
      targetUniversePct: safeNum(state.persuasionPct),
    });
    const contacts = computeRoiContactsAtCapacity(capAttempts, cr);

    const avgLiftPP = computeAvgLiftPP({
      baselineTurnoutPct: turnoutModel.baselineTurnoutPct,
      liftPerContactPP: turnoutModel.liftPerContactPP,
      maxLiftPP: turnoutModel.maxLiftPP,
      contacts,
      universeSize: targetUniverseSize || 0,
      useDiminishing: turnoutModel.useDiminishing,
    });

    const gotvAddedVotes = computeGotvAddedVotes({
      targetUniverseSize,
      avgLiftPP,
    }) ?? 0;
    const turnoutSummary = buildRoiTurnoutSummary({
      baselineTurnoutPct: turnoutModel.baselineTurnoutPct,
      avgLiftPP,
      gotvAddedVotes,
      needVotesText,
      formatInt: fmtInt,
    });

    state.ui.lastTurnout = turnoutSummary;

    if (els.turnoutSummary){
      els.turnoutSummary.hidden = false;
      els.turnoutSummary.className = "banner ok";
      els.turnoutSummary.textContent = turnoutSummary.summaryText;
    }
  } else {
    state.ui.lastTurnout = buildRoiTurnoutDisabledSummary(needVotesText);

    if (els.turnoutSummary){
      els.turnoutSummary.hidden = true;
    }
  }

  const roiTbody = els?.roiTbody;
  if (roiTbody instanceof HTMLElement) {
    roiTbody.innerHTML = "";
    const roiRowsView = buildRoiTableRowsView(rows, {
      turnoutEnabled: turnoutModel.enabled,
      formatInt: fmtInt,
    });
    if (!roiRowsView.length){
      const trEl = document.createElement("tr");
      trEl.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td>';
      roiTbody.appendChild(trEl);
      return;
    }

    for (const rowView of roiRowsView){
      const trEl = document.createElement("tr");

      const td0 = document.createElement("td");
      td0.textContent = rowView.label;

      const td1 = document.createElement("td");
      td1.className = "num";
      td1.textContent = rowView.cpaText;

      const td2 = document.createElement("td");
      td2.className = "num";
      td2.textContent = rowView.costPerNetVoteText;

      const td2b = document.createElement("td");
      td2b.className = "num";
      td2b.textContent = rowView.costPerTurnoutAdjustedNetVoteText;

      const td3 = document.createElement("td");
      td3.className = "num";
      td3.textContent = rowView.totalCostText;

      const td4 = document.createElement("td");
      td4.textContent = rowView.feasibilityText;

      trEl.appendChild(td0);
      trEl.appendChild(td1);
      trEl.appendChild(td2);
      trEl.appendChild(td2b);
      trEl.appendChild(td3);
      trEl.appendChild(td4);

      roiTbody.appendChild(trEl);
    }
  }
}
