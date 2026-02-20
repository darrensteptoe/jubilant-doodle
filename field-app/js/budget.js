// Phase 4 — Budget + ROI (deterministic cost layer)
// Design rule: this module NEVER mutates Phase 1–3 outcomes. It only computes cost lenses.

export function computeRoiRows({
  goalNetVotes,
  baseRates,
  tactics,
  overheadAmount = 0,
  includeOverhead = false,
  caps = null,
  mcLast = null,
  turnoutModel = null,
}){
  const rows = [];

  const need = (goalNetVotes != null && isFinite(goalNetVotes)) ? Math.max(0, goalNetVotes) : null;

  const baseCr = baseRates?.cr ?? null;
  const baseSr = baseRates?.sr ?? null;
  const baseTr = baseRates?.tr ?? null;

  const turnoutEnabled = !!turnoutModel?.enabled;
  const gotvLiftPP = (turnoutEnabled && turnoutModel?.liftPerContactPP != null) ? Math.max(0, Number(turnoutModel.liftPerContactPP)) : 0;
  const gotvMaxLiftPP = (turnoutEnabled && turnoutModel?.maxLiftPP != null) ? Math.max(0, Number(turnoutModel.maxLiftPP)) : 0;
  const baseTurnoutPct = (turnoutEnabled && turnoutModel?.baselineTurnoutPct != null) ? Math.max(0, Math.min(100, Number(turnoutModel.baselineTurnoutPct))) : 0;
  const maxAdditionalPP = turnoutEnabled ? Math.max(0, Math.min(gotvMaxLiftPP, 100 - baseTurnoutPct)) : 0;


  const ratesOkBase = (need != null) && (need > 0) && (baseCr != null && baseCr > 0) && (baseSr != null && baseSr > 0) && (baseTr != null && baseTr > 0);

  const addRow = (key, label) => {
    const t = tactics?.[key];
    if (!t?.enabled) return;

    const tCr = pctOverrideToDecimal(t?.crPct, baseCr);
    const tSr = pctOverrideToDecimal(t?.srPct, baseSr);
    const tTr = baseTr;

    const ratesOk = (need != null) && (need > 0) && (tCr != null && tCr > 0) && (tSr != null && tSr > 0) && (tTr != null && tTr > 0);

    const kind = (t?.kind || "persuasion"); // persuasion | gotv | hybrid

    // Turnout-adjusted value-per-attempt (Phase 6). Conservative per-attempt lens (no saturation in ROI table).
    let turnoutAdjustedNetVotesPerAttempt = null;
    if (!turnoutEnabled){
      turnoutAdjustedNetVotesPerAttempt = (tCr != null && tSr != null && tTr != null) ? (tCr * tSr * tTr) : 0;
    } else if (kind === "gotv"){
      turnoutAdjustedNetVotesPerAttempt = (tCr != null) ? (tCr * (gotvLiftPP / 100)) : 0;
    } else {
      const effTr = (tTr != null) ? Math.min(1, tTr + (Math.min(maxAdditionalPP, gotvLiftPP) / 100)) : null;
      turnoutAdjustedNetVotesPerAttempt = (tCr != null && tSr != null && effTr != null) ? (tCr * tSr * effTr) : 0;
    }

    let requiredAttempts = null;
    let requiredAttemptsTA = null;
    if (ratesOk){
      requiredAttempts = need / (tCr * tSr * tTr);
      if (!isFinite(requiredAttempts) || requiredAttempts <= 0) requiredAttempts = null;
    }

    if (turnoutAdjustedNetVotesPerAttempt != null && isFinite(turnoutAdjustedNetVotesPerAttempt) && turnoutAdjustedNetVotesPerAttempt > 0 && need != null && need > 0){
      requiredAttemptsTA = need / turnoutAdjustedNetVotesPerAttempt;
      if (!isFinite(requiredAttemptsTA) || requiredAttemptsTA <= 0) requiredAttemptsTA = null;
    }

    const overheadPerAttempt = (includeOverhead && overheadAmount > 0 && requiredAttempts != null)
      ? (overheadAmount / requiredAttempts)
      : 0;

    const baseCpa = (t.cpa != null && isFinite(t.cpa)) ? Math.max(0, t.cpa) : 0;
    const cpa = baseCpa + overheadPerAttempt;

    let costPerNetVote = null;
    let totalCost = null;
    let costPerTurnoutAdjustedNetVote = null;

    if (ratesOk && cpa > 0 && requiredAttempts != null){
      costPerNetVote = cpa / (tCr * tSr * tTr);
      totalCost = requiredAttempts * cpa;
    }

    if (turnoutEnabled && cpa > 0 && requiredAttemptsTA != null && turnoutAdjustedNetVotesPerAttempt != null && turnoutAdjustedNetVotesPerAttempt > 0){
      costPerTurnoutAdjustedNetVote = cpa / turnoutAdjustedNetVotesPerAttempt;
    }

    // Capacity feasibility: compare required attempts (to close gap) vs cap ceiling.
    let feasibilityText = "—";
    const capForTactic = (caps && typeof caps === "object")
      ? (caps[key] ?? caps.total ?? null)
      : null;

    if (requiredAttempts == null){
      feasibilityText = (need === 0) ? "No gap" : "Missing rates";
    } else if (capForTactic == null){
      feasibilityText = "Ceiling unknown";
    } else {
      feasibilityText = (requiredAttempts <= capForTactic) ? "Feasible (base)" : "Capacity shortfall";
    }

    rows.push({
      key,
      label,
      cpa: (cpa > 0) ? cpa : null,
      costPerNetVote,
      totalCost,
      turnoutAdjustedNetVotesPerAttempt,
      costPerTurnoutAdjustedNetVote,
      feasibilityText,
      // surface which rates were used (optional for future tooltips)
      used: { cr: tCr, sr: tSr, tr: tTr },
    });
  };

  addRow("doors", "Doors");
  addRow("phones", "Phones");
  addRow("texts", "Texts");

  // Sort by cost per net vote (ascending), pushing nulls to bottom
  rows.sort((a,b) => {
    const av = (a.costPerNetVote == null) ? Infinity : a.costPerNetVote;
    const bv = (b.costPerNetVote == null) ? Infinity : b.costPerNetVote;
    return av - bv;
  });

  const banner = buildBanner({ need, ratesOkBase, overheadAmount, includeOverhead, mcLast });

  return { rows, banner };
}

function pctOverrideToDecimal(pctMaybe, fallbackDecimal){
  if (pctMaybe == null || pctMaybe === "" || !isFinite(pctMaybe)) return fallbackDecimal;
  const v = Math.max(0, Math.min(100, Number(pctMaybe)));
  return v / 100;
}


function buildBanner({ need, ratesOkBase, overheadAmount, includeOverhead, mcLast }){
  if (need == null){
    return { kind: "warn", text: "ROI: Enter a valid universe + support inputs so the model can compute persuasion need." };
  }
  if (need === 0){
    return { kind: "ok", text: "ROI: Under current assumptions, no net persuasion votes are required (gap = 0)." };
  }
  if (!ratesOkBase){
    return { kind: "warn", text: "ROI: Enter Phase 2 Contact rate + Support rate and Phase 3 Turnout reliability to compute ROI." };
  }
  if (includeOverhead && overheadAmount > 0){
    return { kind: "ok", text: "ROI: Overhead allocation is ON (spread deterministically across the gap-closure plan for each tactic)." };
  }
  if (mcLast && mcLast.median != null && mcLast.needVotes != null){
    const deliveredMedian = mcLast.needVotes + mcLast.median;
    if (isFinite(deliveredMedian) && deliveredMedian > 0){
      return { kind: "warn", text: "ROI: Monte Carlo results exist — interpret ROI alongside risk (median and downside outcomes can change delivered net votes)." };
    }
  }
  return { kind: "ok", text: "ROI: Deterministic cost lens using Attempts → Conversations → Support IDs → Net Votes. You can override CR/SR per channel in Phase 4B." };
}

function fmtSignedLocal(v){
  if (v == null || !isFinite(v)) return "—";
  const n = Math.round(v);
  if (n === 0) return "0";
  return (n > 0 ? "+" : "−") + Math.abs(n).toLocaleString();
}


// Phase 5 — Optimization helper (pure; does not change ROI math)
// Returns enabled tactics with per-attempt deterministic cost + net-vote yield,
// using the SAME CR/SR override logic as Phase 4B ROI.
export function buildOptimizationTactics({ baseRates, tactics, turnoutModel, universeSize, targetUniversePct }){
  const baseCr = baseRates?.cr ?? null;
  const baseSr = baseRates?.sr ?? null;
  const baseTr = baseRates?.tr ?? null;

  const turnoutEnabled = !!turnoutModel?.enabled;
  const gotvLiftPP = (turnoutEnabled && turnoutModel?.liftPerContactPP != null) ? Math.max(0, Number(turnoutModel.liftPerContactPP)) : 0;
  const gotvMaxLiftPP = (turnoutEnabled && turnoutModel?.maxLiftPP != null) ? Math.max(0, Number(turnoutModel.maxLiftPP)) : 0;
  const baselineTurnoutPct = (turnoutEnabled && turnoutModel?.baselineTurnoutPct != null) ? Math.max(0, Math.min(100, Number(turnoutModel.baselineTurnoutPct))) : 0;
  const maxAdditionalPP = turnoutEnabled ? Math.max(0, Math.min(gotvMaxLiftPP, 100 - baselineTurnoutPct)) : 0;

  const U = (universeSize != null && isFinite(universeSize) && universeSize > 0) ? Number(universeSize) : null;
  const tuPct = (targetUniversePct != null && isFinite(targetUniversePct)) ? Math.max(0, Math.min(100, Number(targetUniversePct))) : null;
  const targetUniverseSize = (U != null && tuPct != null) ? Math.round(U * (tuPct / 100)) : null;


  const out = [];

  const add = (key, label) => {
    const t = tactics?.[key];
    if (!t?.enabled) return;

    const cr = pctOverrideToDecimal(t?.crPct, baseCr);
    const sr = pctOverrideToDecimal(t?.srPct, baseSr);
    const tr = baseTr;

    const netVotesPerAttempt = (cr != null && cr > 0 && sr != null && sr > 0 && tr != null && tr > 0)
      ? (cr * sr * tr)
      : 0;

    const costPerAttempt = (t?.cpa != null && isFinite(t.cpa)) ? Math.max(0, Number(t.cpa)) : 0;

    const kind = (t?.kind || "persuasion"); // persuasion | gotv | hybrid

    let turnoutAdjustedNetVotesPerAttempt = netVotesPerAttempt;
    let maxAttempts = null;

    if (turnoutEnabled){
      if (kind === "gotv"){
        turnoutAdjustedNetVotesPerAttempt = (cr != null && cr > 0) ? (cr * (gotvLiftPP / 100)) : 0;

        // Linear saturation cap: ceiling reached when (contacts / targetUniverse) * liftPP = maxAdditionalPP
        // contacts = attempts * cr
        if (targetUniverseSize != null && targetUniverseSize > 0 && cr != null && cr > 0 && gotvLiftPP > 0 && maxAdditionalPP > 0){
          const capContacts = targetUniverseSize * (maxAdditionalPP / gotvLiftPP);
          const capAttempts = capContacts / cr;
          if (isFinite(capAttempts) && capAttempts > 0) maxAttempts = Math.ceil(capAttempts);
        }
      } else if (kind === "hybrid"){
        const effTr = (tr != null) ? Math.min(1, tr + (Math.min(maxAdditionalPP, gotvLiftPP) / 100)) : tr;
        turnoutAdjustedNetVotesPerAttempt = (cr != null && cr > 0 && sr != null && sr > 0 && effTr != null && effTr > 0)
          ? (cr * sr * effTr)
          : 0;
      } else {
        // persuasion-only: unchanged (TR already captures baseline voting reliability)
        turnoutAdjustedNetVotesPerAttempt = netVotesPerAttempt;
      }
    }

    out.push({
      id: key,
      label,
      kind,
      costPerAttempt,
      netVotesPerAttempt,
      turnoutAdjustedNetVotesPerAttempt,
      maxAttempts,
      // keep debug parity with ROI layer
      used: { cr, sr, tr }
    });
  };

  add("doors", "Doors");
  add("phones", "Phones");
  add("texts", "Texts");

  return out;
}
