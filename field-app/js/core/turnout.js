// Turnout / persuasion helpers

// Average lift per percentage point (PP) between two turnout cycles.
// A and B are turnout percents (0-100). Returns absolute delta in PP.
export function computeAvgLiftPP(turnoutA, turnoutB){
  const a = Number(turnoutA);
  const b = Number(turnoutB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(b - a);
}
