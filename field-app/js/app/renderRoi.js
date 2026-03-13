// @ts-check
import { resolveFeatureFlags } from "../core/featureFlags.js";

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
    clamp,
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
    doorShare: (() => {
      const v = safeNum(state.channelDoorPct);
      return (v != null) ? clamp(v, 0, 100) / 100 : null;
    })(),
    doorsPerHour: canonicalDoorsPerHourFromSnap(state),
    callsPerHour: safeNum(state.callsPerHour3),
    capacityDecay,
  });
  const baseCapAttempts = capBreakdown?.total ?? null;

  const budget = state.budget || {};
  const opt = budget.optimize || {};
  const tactics = budget.tactics || {};
  const overheadAmount = safeNum(budget.overheadAmount) ?? 0;
  const includeOverhead = !!budget.includeOverhead;

  const mcLast = state.mcLast || null;

  const turnoutModel = {
    enabled: !!features.turnoutModelingEnabled,
    baselineTurnoutPct: (safeNum(state.turnoutTargetOverridePct) != null) ? safeNum(state.turnoutTargetOverridePct) : safeNum(state.turnoutBaselinePct),
    liftPerContactPP: (state.gotvMode === "advanced") ? safeNum(state.gotvLiftMode) : safeNum(state.gotvLiftPP),
    maxLiftPP: (state.gotvMode === "advanced") ? safeNum(state.gotvMaxLiftPP2) : safeNum(state.gotvMaxLiftPP),
    useDiminishing: !!state.gotvDiminishing,
  };

  const tlConstrainedOn = !!opt.tlConstrainedEnabled;
  const timelineEnabled = !!features.timelineEnabled;
  const timelineCapsOn = tlConstrainedOn && timelineEnabled;
  let capAttempts = baseCapAttempts;
  let capByTactic = {
    doors: capBreakdown?.doors ?? null,
    phones: capBreakdown?.phones ?? null,
    texts: null,
  };

  if (timelineCapsOn){
    const capsInput = {
      enabled: true,
      weeksRemaining: weeks ?? 0,
      activeWeeksOverride: safeNum(state.timelineActiveWeeks),
      gotvWindowWeeks: safeNum(state.timelineGotvWeeks),
      staffing: {
        staff: safeNum(state.timelineStaffCount) ?? 0,
        volunteers: safeNum(state.timelineVolCount) ?? 0,
        staffHours: safeNum(state.timelineStaffHours) ?? 0,
        volunteerHours: safeNum(state.timelineVolHours) ?? 0,
      },
      throughput: {
        doors: safeNum(state.timelineDoorsPerHour) ?? 0,
        phones: safeNum(state.timelineCallsPerHour) ?? 0,
        texts: safeNum(state.timelineTextsPerHour) ?? 0,
      },
      tacticKinds: {
        doors: tactics?.doors?.kind || "persuasion",
        phones: tactics?.phones?.kind || "persuasion",
        texts: tactics?.texts?.kind || "persuasion",
      }
    };
    const capsWrap = engine.computeMaxAttemptsByTactic(capsInput);
    const tCaps = (capsWrap && capsWrap.enabled && capsWrap.maxAttemptsByTactic && typeof capsWrap.maxAttemptsByTactic === "object")
      ? capsWrap.maxAttemptsByTactic
      : null;
    if (tCaps){
      const doorsCap = (Number.isFinite(Number(tCaps.doors)) && Number(tCaps.doors) >= 0) ? Number(tCaps.doors) : null;
      const phonesCap = (Number.isFinite(Number(tCaps.phones)) && Number(tCaps.phones) >= 0) ? Number(tCaps.phones) : null;
      const textsCap = (Number.isFinite(Number(tCaps.texts)) && Number(tCaps.texts) >= 0) ? Number(tCaps.texts) : null;
      capByTactic = { doors: doorsCap, phones: phonesCap, texts: textsCap };
      const total = [doorsCap, phonesCap, textsCap].reduce((sum, v) => sum + ((v == null) ? 0 : v), 0);
      capAttempts = (Number.isFinite(total) && total >= 0) ? total : baseCapAttempts;
    }
  }

  const { rows, banner } = engine.computeRoiRows({
    goalNetVotes: needVotes,
    baseRates: { cr, sr, tr },
    tactics,
    overheadAmount,
    includeOverhead,
    caps: { total: capAttempts, doors: capByTactic.doors, phones: capByTactic.phones, texts: capByTactic.texts },
    mcLast,
    turnoutModel,
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

  if (els.turnoutSummary){
    if (turnoutModel.enabled){
      const U = safeNum(state.universeSize);
      const tuPct = safeNum(state.persuasionPct);
      const targetUniverseSize = (U != null && tuPct != null) ? Math.round(U * (clamp(tuPct, 0, 100) / 100)) : null;
      const contacts = (capAttempts != null && cr != null) ? Math.max(0, capAttempts * cr) : 0;

      const avgLiftPP = computeAvgLiftPP({
        baselineTurnoutPct: turnoutModel.baselineTurnoutPct,
        liftPerContactPP: turnoutModel.liftPerContactPP,
        maxLiftPP: turnoutModel.maxLiftPP,
        contacts,
        universeSize: targetUniverseSize || 0,
        useDiminishing: turnoutModel.useDiminishing,
      });

      const gotvAddedVotes = (targetUniverseSize != null) ? Math.round(targetUniverseSize * (avgLiftPP / 100)) : 0;
      const baseTxt = (turnoutModel.baselineTurnoutPct != null && isFinite(turnoutModel.baselineTurnoutPct)) ? `${Number(turnoutModel.baselineTurnoutPct).toFixed(1)}%` : "—";

      els.turnoutSummary.hidden = false;
      els.turnoutSummary.className = "banner ok";
      els.turnoutSummary.textContent = `Turnout enabled: baseline ${baseTxt} · modeled avg lift ${avgLiftPP.toFixed(1)}pp · implied +${fmtInt(gotvAddedVotes)} votes (at capacity ceiling).`;
    } else {
      els.turnoutSummary.hidden = true;
    }
  }

  const roiTbody = els?.roiTbody;
  if (!(roiTbody instanceof HTMLElement)) {
    return;
  }
  roiTbody.innerHTML = "";
  if (!rows.length){
    const trEl = document.createElement("tr");
    trEl.innerHTML = '<td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="muted">—</td>';
    roiTbody.appendChild(trEl);
    return;
  }

  for (const r of rows){
    const trEl = document.createElement("tr");

    const td0 = document.createElement("td");
    td0.textContent = r.label;

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = r.cpa == null ? "—" : `$${r.cpa.toFixed(2)}`;

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = r.costPerNetVote == null ? "—" : `$${r.costPerNetVote.toFixed(2)}`;

    const td2b = document.createElement("td");
    td2b.className = "num";
    td2b.textContent = (!turnoutModel.enabled || r.costPerTurnoutAdjustedNetVote == null) ? "—" : `$${r.costPerTurnoutAdjustedNetVote.toFixed(2)}`;

    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = r.totalCost == null ? "—" : `$${fmtInt(Math.round(r.totalCost))}`;

    const td4 = document.createElement("td");
    td4.textContent = r.feasibilityText || "—";

    trEl.appendChild(td0);
    trEl.appendChild(td1);
    trEl.appendChild(td2);
    trEl.appendChild(td2b);
    trEl.appendChild(td3);
    trEl.appendChild(td4);

    roiTbody.appendChild(trEl);
  }
}
