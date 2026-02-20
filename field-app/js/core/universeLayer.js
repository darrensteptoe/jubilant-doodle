// Universe layer defaults + normalization

export const UNIVERSE_DEFAULTS = Object.freeze({
  // Percent defaults are intentionally conservative; app may override via UI.
  persuasionPct: 12,
  earlyVoteExp: 35,
});

// Normalizes a set of percents that should sum to 100.
// Returns an object with normalized values (or null if input invalid).
export function normalizeUniversePercents(obj){
  if (!obj || typeof obj !== "object") return null;
  const out = {};
  let sum = 0;
  for (const [k, v] of Object.entries(obj)){
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    out[k] = n;
    sum += n;
  }
  if (sum <= 0) return null;
  for (const k of Object.keys(out)) out[k] = (out[k] / sum) * 100;
  return out;
}
