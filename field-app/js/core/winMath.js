// @ts-check
import { clamp, safeNum, fmtInt } from "./utils.js";
import {
  applyCandidateHistorySupportAdjustments,
  deriveCandidateHistoryBaseline,
  normalizeCandidateHistoryRecords,
} from "./candidateHistoryBaseline.js";

/**
 * @typedef {object} WinMathInputCandidate
 * @property {string} id
 * @property {string=} name
 * @property {number | null | undefined=} supportPct
 */

/**
 * @typedef {object} WinMathInput
 * @property {number | null | undefined} universeSize
 * @property {number | null | undefined} turnoutA
 * @property {number | null | undefined} turnoutB
 * @property {number | null | undefined} bandWidth
 * @property {WinMathInputCandidate[]} candidates
 * @property {string=} office
 * @property {string=} electionType
 * @property {Array<Record<string, any>>=} candidateHistory
 * @property {number | null | undefined} undecidedPct
 * @property {string=} yourCandidateId
 * @property {string=} undecidedMode
 * @property {Record<string, number>=} userSplit
 * @property {number | null | undefined=} persuasionPct
 * @property {number | null | undefined=} earlyVoteExp
 */

/**
 * @param {WinMathInput} input
 */
export function computeAll(input){
  const raw = {
    office: String(input.office || "").trim(),
    electionType: String(input.electionType || "").trim().toLowerCase(),
    universeSize: safeNum(input.universeSize),
    turnoutA: safeNum(input.turnoutA),
    turnoutB: safeNum(input.turnoutB),
    bandWidth: safeNum(input.bandWidth),
    candidates: Array.isArray(input.candidates) ? input.candidates : [],
    candidateHistory: normalizeCandidateHistoryRecords(input.candidateHistory),
    undecidedPct: safeNum(input.undecidedPct),
    yourCandidateId: input.yourCandidateId,
    undecidedMode: input.undecidedMode || "proportional",
    userSplit: input.userSplit || {},
    persuasionPct: safeNum(input.persuasionPct),
    earlyVoteExp: safeNum(input.earlyVoteExp),
  };

  const validation = validateInputs(raw);
  const candidateHistory = deriveCandidateHistoryBaseline({
    records: raw.candidateHistory,
    candidates: validation.candidates,
    yourCandidateId: raw.yourCandidateId,
    office: raw.office,
    electionType: raw.electionType,
  });
  validation.candidateHistory = {
    recordCount: candidateHistory.recordCount,
    filteredRecordCount: candidateHistory.filteredRecordCount,
    matchedRecordCount: candidateHistory.matchedRecordCount,
    missingFieldCount: candidateHistory.missingFieldCount,
    incompleteRecordCount: candidateHistory.incompleteRecordCount,
    coverageScore: candidateHistory.coverageScore,
    coverageBand: candidateHistory.coverageBand,
    confidenceBand: candidateHistory.confidenceBand,
    incumbentEffectPresent: candidateHistory.incumbentEffectPresent,
    repeatEffectPresent: candidateHistory.repeatEffectPresent,
    deviationPresent: candidateHistory.deviationPresent,
    notes: Array.isArray(candidateHistory.notes) ? candidateHistory.notes.slice() : [],
  };
  const turnout = computeTurnout(raw);
  const expected = computeExpected(raw, turnout, validation, candidateHistory);

  const stressSummary = computeStressSummary(raw, turnout, expected, validation);
  const guardrails = computeGuardrails(raw, turnout, expected, validation);

  return {
    raw,
    validation,
    turnout,
    expected,
    stressSummary,
    guardrails,
  };
}

function validateInputs(raw){
  const universeOk = raw.universeSize != null && raw.universeSize > 0;

  const turnoutOk = raw.turnoutA != null && raw.turnoutB != null && raw.bandWidth != null;
  const turnoutAOk = raw.turnoutA != null && raw.turnoutA >= 0 && raw.turnoutA <= 100;
  const turnoutBOk = raw.turnoutB != null && raw.turnoutB >= 0 && raw.turnoutB <= 100;
  const bandOk = raw.bandWidth != null && raw.bandWidth >= 0 && raw.bandWidth <= 25;

  const candidates = raw.candidates.map(c => ({
    id: c.id,
    name: (c.name || "").trim() || "Candidate",
    supportPct: safeNum(c.supportPct),
  }));

  const supportSum = candidates.reduce((a,c) => a + (c.supportPct ?? 0), 0);
  const undec = raw.undecidedPct ?? 0;
  const total = supportSum + undec;

  const candidateTableOk = candidates.length >= 2 && Math.abs(total - 100) <= 0.05;
  const candidateTableMsg = `Totals must equal 100%. Current total: ${total.toFixed(1)}%.`;

  let userSplitOk = true;
  let userSplitMsg = "";
  if (raw.undecidedMode === "user_defined"){
    const splitSum = candidates.reduce((a,c) => a + (safeNum(raw.userSplit[c.id]) ?? 0), 0);
    userSplitOk = Math.abs(splitSum - 100) <= 0.05;
    userSplitMsg = `User-defined split must total 100%. Current split total: ${splitSum.toFixed(1)}%.`;
  }

  const persuasionOk = raw.persuasionPct != null && raw.persuasionPct >= 0 && raw.persuasionPct <= 100;

  return {
    universeOk,
    turnoutOk: turnoutOk && turnoutAOk && turnoutBOk && bandOk,
    candidateTableOk,
    candidateTableMsg,
    userSplitOk,
    userSplitMsg,
    persuasionOk,
    supportTotalPct: (candidates.length ? total : null),
    candidates,
  };
}

function computeTurnout(raw){
  if (raw.turnoutA == null || raw.turnoutB == null) {
    return {
      expectedPct: null, bestPct: null, worstPct: null,
      votesPer1pct: raw.universeSize ? raw.universeSize * 0.01 : null,
      bandVotesText: null,
    };
  }

  const exp = (raw.turnoutA + raw.turnoutB) / 2;
  const bw = raw.bandWidth ?? 0;

  const best = clamp(exp + bw, 0, 100);
  const worst = clamp(exp - bw, 0, 100);

  const votesPer1pct = raw.universeSize ? raw.universeSize * 0.01 : null;

  let bandVotesText = null;
  if (raw.universeSize && raw.universeSize > 0){
    const bestVotes = Math.round(raw.universeSize * (best / 100));
    const expVotes = Math.round(raw.universeSize * (exp / 100));
    const worstVotes = Math.round(raw.universeSize * (worst / 100));
    bandVotesText = `Best ${fmtInt(bestVotes)} · Expected ${fmtInt(expVotes)} · Worst ${fmtInt(worstVotes)}`;
  }

  return {
    expectedPct: exp,
    bestPct: best,
    worstPct: worst,
    votesPer1pct,
    bandVotesText,
  };
}

function computeExpected(raw, turnout, validation, candidateHistory){
  const out = {
    turnoutVotes: null,
    earlyVotes: null,
    edVotes: null,
    earlyNote: null,

    winThreshold: null,
    yourVotes: null,
    yourShareText: null,
    persuasionNeed: null,
    persuasionStatus: null,

    persuasionUniverse: null,
    persuasionUniverseCheck: null,
    candidateHistoryImpact: {
      enabled: false,
      recordCount: 0,
      filteredRecordCount: 0,
      matchedRecordCount: 0,
      coverageBand: "none",
      confidenceBand: "missing",
      yourSupportDeltaPct: 0,
      yourVotesDelta: 0,
      notes: [],
    },
  };

  if (!validation.universeOk || turnout.expectedPct == null) return out;
  if (!validation.candidateTableOk) return out;
  if (raw.undecidedMode === "user_defined" && !validation.userSplitOk) return out;

  const U = raw.universeSize;
  const turnoutVotes = Math.round(U * (turnout.expectedPct / 100));
  out.turnoutVotes = turnoutVotes;

  const earlyPct = clamp(raw.earlyVoteExp ?? 0, 0, 100);
  const earlyVotes = Math.round(turnoutVotes * (earlyPct / 100));
  const edVotes = turnoutVotes - earlyVotes;
  out.earlyVotes = earlyVotes;
  out.edVotes = edVotes;

  if (earlyPct >= 50) out.earlyNote = "High early vote share may compress persuasion window.";
  else if (earlyPct >= 40) out.earlyNote = "Moderate early vote share; front-load persuasion where possible.";
  else out.earlyNote = "Early vote share within typical range (monitor).";

  const candidateHistoryInfo = candidateHistory && typeof candidateHistory === "object" ? candidateHistory : null;
  const historyRecords = Number(candidateHistoryInfo?.recordCount || 0);
  const baselineVotes = computeCandidateVotes(raw, turnoutVotes, validation.candidates);
  let adjustedCandidates = validation.candidates;
  if (candidateHistoryInfo && historyRecords > 0){
    const adjusted = applyCandidateHistorySupportAdjustments(
      validation.candidates,
      candidateHistoryInfo.adjustmentsByCandidateId,
    );
    adjustedCandidates = Array.isArray(adjusted?.adjustedCandidates)
      ? adjusted.adjustedCandidates
      : validation.candidates;
  }
  const adjustedVotes = computeCandidateVotes(raw, turnoutVotes, adjustedCandidates);

  const your = adjustedVotes.find(v => v.id === raw.yourCandidateId) || adjustedVotes[0];
  out.yourVotes = your?.votes ?? null;
  out.yourShareText = your ? `${(100 * (your.votes / Math.max(1, turnoutVotes))).toFixed(1)}% of turnout` : null;

  const sorted = [...adjustedVotes].sort((a,b) => b.votes - a.votes);
  const topCompetitor = sorted.find(v => v.id !== your.id) || sorted[0];
  if (!topCompetitor) return out;

  out.winThreshold = topCompetitor.votes + 1;

  const need = out.winThreshold - out.yourVotes;
  out.persuasionNeed = need > 0 ? need : 0;

  if (need <= 0){
    out.persuasionStatus = "Currently projected to win under expected assumptions.";
  } else {
    out.persuasionStatus = "Net votes required above current projection (under expected assumptions).";
  }

  if (candidateHistoryInfo){
    const baselineYour = baselineVotes.find((row) => row.id === your?.id) || baselineVotes[0] || null;
    const yourVotesDelta = (
      your && baselineYour
        ? ((Number(your.votes) || 0) - (Number(baselineYour.votes) || 0))
        : 0
    );
    const yourDeltaSupport = Number(candidateHistoryInfo?.yourCandidateDeltaSupportPct || 0);
    out.candidateHistoryImpact = {
      enabled: historyRecords > 0,
      recordCount: historyRecords,
      filteredRecordCount: Number(candidateHistoryInfo?.filteredRecordCount || 0),
      matchedRecordCount: Number(candidateHistoryInfo?.matchedRecordCount || 0),
      coverageBand: String(candidateHistoryInfo?.coverageBand || "none"),
      confidenceBand: String(candidateHistoryInfo?.confidenceBand || "missing"),
      yourSupportDeltaPct: yourDeltaSupport,
      yourVotesDelta,
      notes: Array.isArray(candidateHistoryInfo?.notes) ? candidateHistoryInfo.notes.slice() : [],
    };
  }

  if (raw.persuasionPct != null && validation.universeOk){
    out.persuasionUniverse = Math.round(U * (clamp(raw.persuasionPct, 0, 100) / 100));
    if (need <= 0){
      out.persuasionUniverseCheck = "Persuasion requirement is 0 under expected assumptions.";
    } else if (out.persuasionUniverse >= need){
      out.persuasionUniverseCheck = "Required persuasion is within modeled movable universe.";
    } else {
      out.persuasionUniverseCheck = "Warning: required persuasion exceeds modeled movable universe.";
    }
  }

  return out;
}

function computeCandidateVotes(raw, turnoutVotes, candidates){
  const alloc = allocateUndecided(raw, candidates);
  return candidates.map((candidate) => {
    const supportPct = safeNum(candidate?.supportPct) ?? 0;
    const baseVotes = Math.round(turnoutVotes * (supportPct / 100));
    const addVotes = Math.round(turnoutVotes * ((raw.undecidedPct ?? 0) / 100) * ((alloc[candidate.id] ?? 0) / 100));
    return {
      id: candidate.id,
      name: candidate.name,
      votes: baseVotes + addVotes,
    };
  });
}

function allocateUndecided(raw, candidates){
  const alloc = {};
  const mode = raw.undecidedMode || "proportional";
  const yourId = raw.yourCandidateId || candidates[0]?.id;

  for (const c of candidates) alloc[c.id] = 0;

  if (mode === "user_defined"){
    for (const c of candidates){
      alloc[c.id] = clamp(safeNum(raw.userSplit?.[c.id]) ?? 0, 0, 100);
    }
    return alloc;
  }

  if (mode === "proportional"){
    const sum = candidates.reduce((a,c) => a + (c.supportPct ?? 0), 0) || 1;
    for (const c of candidates){
      alloc[c.id] = 100 * ((c.supportPct ?? 0) / sum);
    }
    return alloc;
  }

  const sorted = [...candidates].sort((a,b) => (b.supportPct ?? 0) - (a.supportPct ?? 0));
  const strongest = sorted[0]?.id;
  const you = yourId;

  const n = candidates.length;
  const base = 100 / n;

  for (const c of candidates) alloc[c.id] = base;

  if (mode === "against"){
    if (strongest && strongest !== you){
      alloc[strongest] += 15;
      alloc[you] -= 15;
    } else if (strongest === you && sorted[1]){
      alloc[sorted[1].id] += 15;
      alloc[you] -= 15;
    }
  }

  if (mode === "toward"){
    alloc[you] += 15;
    if (strongest && strongest !== you) alloc[strongest] -= 15;
    else if (sorted[1]) alloc[sorted[1].id] -= 15;
  }

  const minFloor = 0;
  for (const k of Object.keys(alloc)) alloc[k] = Math.max(minFloor, alloc[k]);

  const sum2 = Object.values(alloc).reduce((a,b) => a+b, 0) || 1;
  for (const k of Object.keys(alloc)) alloc[k] = 100 * (alloc[k] / sum2);

  return alloc;
}

function computeStressSummary(raw, turnout, expected, validation){
  const lines = [];
  if (!validation.universeOk || turnout.expectedPct == null) return lines;
  if (!validation.candidateTableOk) return lines;

  const U = raw.universeSize;
  const bw = raw.bandWidth ?? 0;

  if (bw > 0){
    const deltaVotes = Math.round(U * (bw / 100));
    lines.push(`If turnout shifts by ${bw.toFixed(1)}%, votes in play shift by ~${fmtInt(deltaVotes)}.`);
  }

  if (expected.persuasionNeed != null){
    const againstImpact = estimateAgainstImpact(raw, turnout, validation);
    if (againstImpact != null){
      const diff = againstImpact - expected.persuasionNeed;
      if (diff > 0){
        lines.push(`If undecideds break conservatively against you, persuasion requirement increases by ~${fmtInt(diff)} votes.`);
      } else {
        lines.push(`Undecided break stress test does not increase required persuasion under current assumptions.`);
      }
    }
  }

  const early = clamp(raw.earlyVoteExp ?? 0, 0, 100);
  if (early >= 50) lines.push(`If early vote share rises further, persuasion window compresses (front-load voter contact).`);
  else if (early >= 40) lines.push(`If early vote share increases, shift more persuasion earlier to avoid missing early voters.`);
  else lines.push(`If early vote share rises materially, expect earlier persuasion workload (monitor).`);

  const historyImpact = expected?.candidateHistoryImpact && typeof expected.candidateHistoryImpact === "object"
    ? expected.candidateHistoryImpact
    : null;
  if (historyImpact?.enabled){
    const delta = Number(historyImpact?.yourVotesDelta || 0);
    const confidenceBand = String(historyImpact?.confidenceBand || "missing");
    const coverageBand = String(historyImpact?.coverageBand || "none");
    if (delta !== 0){
      lines.push(`Candidate-history baseline shifts your projected votes by ${delta > 0 ? "+" : ""}${fmtInt(delta)} (${coverageBand} coverage, ${confidenceBand} confidence).`);
    } else {
      lines.push(`Candidate-history baseline loaded (${coverageBand} coverage, ${confidenceBand} confidence) with no net vote shift.`);
    }
  }

  return lines.slice(0, 5);
}

function estimateAgainstImpact(raw, turnout, validation){
  const scenario = { ...raw, undecidedMode: "against" };
  const t = turnout.expectedPct;
  if (t == null || !validation.universeOk) return null;

  const turnoutVotes = Math.round(raw.universeSize * (t / 100));
  const alloc = allocateUndecided(scenario, validation.candidates);

  const adjustedVotes = validation.candidates.map(c => {
    const baseVotes = Math.round(turnoutVotes * ((c.supportPct ?? 0) / 100));
    const addVotes = Math.round(turnoutVotes * ((raw.undecidedPct ?? 0) / 100) * (alloc[c.id] / 100));
    return { id: c.id, votes: baseVotes + addVotes };
  });

  const your = adjustedVotes.find(v => v.id === raw.yourCandidateId) || adjustedVotes[0];
  const sorted = [...adjustedVotes].sort((a,b) => b.votes - a.votes);
  const topCompetitor = sorted.find(v => v.id !== your.id) || sorted[0];
  if (!topCompetitor) return null;

  const winThreshold = topCompetitor.votes + 1;
  const need = winThreshold - (your?.votes ?? 0);
  return Math.max(0, need);
}

function computeGuardrails(raw, turnout, expected, validation){
  const gs = [];

  const base = [];
  base.push({ k: "Model type", v: "Forecast worksheet (aggregate, not CRM)" });
  base.push({ k: "Totals enforcement", v: "Ballot test + undecided must total 100%" });
  gs.push({ title: "Quick checks", lines: base });

  if (!validation.universeOk){
    gs.push({ title: "Universe", lines: [{ k: "Issue", v: "Universe missing or invalid" }, { k: "Fix", v: "Enter universe size (registration or expected voters)" }] });
  }

  if (!validation.turnoutOk){
    gs.push({ title: "Turnout", lines: [{ k: "Issue", v: "Turnout baseline incomplete" }, { k: "Fix", v: "Enter two comparable cycles plus an uncertainty band" }] });
  }

  if (!validation.candidateTableOk){
    gs.push({ title: "Ballot test", lines: [{ k: "Issue", v: "Numbers don’t total 100%" }, { k: "Fix", v: "Adjust candidate shares and undecided so they sum to 100%" }] });
  }

  if (raw.undecidedMode === "user_defined" && !validation.userSplitOk){
    gs.push({ title: "Undecided allocation", lines: [{ k: "Issue", v: "Allocation doesn’t total 100%" }, { k: "Fix", v: "Make allocations sum to 100% across candidates" }] });
  }

  if (expected.persuasionUniverse != null && expected.persuasionNeed != null && expected.persuasionNeed > expected.persuasionUniverse){
    gs.push({
      title: "Movable universe check",
      lines: [
        { k: "Issue", v: "Gap exceeds your modeled persuadable universe" },
        { k: "Fix", v: "Revisit assumptions (turnout, ballot test, contact math) or only expand persuadables if defensible" }
      ]
    });
  }

  const history = validation?.candidateHistory && typeof validation.candidateHistory === "object"
    ? validation.candidateHistory
    : null;
  if (history){
    const recordCount = Number(history.recordCount || 0);
    const confidenceBand = String(history.confidenceBand || "missing");
    const coverageBand = String(history.coverageBand || "none");
    if (recordCount <= 0){
      gs.push({
        title: "Candidate history baseline",
        lines: [
          { k: "Issue", v: "No candidate history records; confidence degrades for ballot baseline realism." },
          { k: "Fix", v: "Add prior candidate-cycle rows (office, year, election type, vote share, over/underperformance)." },
        ],
      });
    } else if (confidenceBand === "low"){
      gs.push({
        title: "Candidate history baseline",
        lines: [
          { k: "Issue", v: `Candidate history coverage is ${coverageBand}; baseline adjustment confidence is low.` },
          { k: "Fix", v: "Complete required fields on candidate history rows before trusting shifted baseline projections." },
        ],
      });
    }
  }

  return gs;
}
