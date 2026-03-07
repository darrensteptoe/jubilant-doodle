// @ts-check

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function defaultToNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Record<string, any>} snapshot
 * @param {(v: unknown) => number|null=} toNumFn
 * @returns {import("./types").ModelInput}
 */
export function buildModelInputFromSnapshot(snapshot, toNumFn){
  const s = snapshot || {};
  const toNum = (typeof toNumFn === "function") ? toNumFn : defaultToNum;
  const candidates = Array.isArray(s.candidates) ? s.candidates : [];

  return {
    universeSize: toNum(s.universeSize),
    turnoutA: toNum(s.turnoutA),
    turnoutB: toNum(s.turnoutB),
    bandWidth: toNum(s.bandWidth),
    candidates: candidates.map((c) => ({
      id: c?.id,
      name: c?.name,
      supportPct: toNum(c?.supportPct),
    })),
    undecidedPct: toNum(s.undecidedPct),
    yourCandidateId: s.yourCandidateId,
    undecidedMode: s.undecidedMode,
    userSplit: s.userSplit,
    persuasionPct: toNum(s.persuasionPct),
    earlyVoteExp: toNum(s.earlyVoteExp),
  };
}
