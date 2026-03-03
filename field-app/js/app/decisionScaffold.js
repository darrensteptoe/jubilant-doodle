export const OBJECTIVE_TEMPLATES = [
  { key: "win_prob", label: "Maximize win probability" },
  { key: "finish_date", label: "Finish earlier" },
  { key: "exec_feasible", label: "Maximize feasibility" },
  { key: "budget_eff", label: "Improve budget efficiency" },
  { key: "balanced", label: "Balanced (risk-aware)" },
];

export const RISK_POSTURES = [
  { key: "cautious", label: "Cautious" },
  { key: "balanced", label: "Balanced" },
  { key: "aggressive", label: "Aggressive" },
];

export function makeDecisionSessionIdCore(uid){
  return "ds_" + uid() + Date.now().toString(16);
}

export function makeDecisionOptionIdCore(uid){
  return "do_" + uid() + Date.now().toString(16);
}

export function ensureDecisionOptionShapeCore(o){
  if (!o || typeof o !== "object") return;
  if (!o.tactics || typeof o.tactics !== "object") o.tactics = {};
  const t = o.tactics;
  if (t.doors === undefined) t.doors = false;
  if (t.phones === undefined) t.phones = false;
  if (t.digital === undefined) t.digital = false;
}

export function ensureDecisionSessionShapeCore(s){
  if (!s || typeof s !== "object") return;

  if (!s.constraints || typeof s.constraints !== "object") s.constraints = {};
  const c = s.constraints;
  if (c.budget === undefined) c.budget = null;
  if (c.volunteerHrs === undefined) c.volunteerHrs = null;
  if (c.turfAccess === undefined) c.turfAccess = "";
  if (c.blackoutDates === undefined) c.blackoutDates = "";

  if (s.riskPosture === undefined) s.riskPosture = "balanced";
  if (!Array.isArray(s.nonNegotiables)) s.nonNegotiables = [];
  if (!Array.isArray(s.whatNeedsTrue)) s.whatNeedsTrue = [];
  if (s.recommendedOptionId === undefined) s.recommendedOptionId = null;

  if (!s.options || typeof s.options !== "object") s.options = {};
  for (const k of Object.keys(s.options)){
    ensureDecisionOptionShapeCore(s.options[k]);
  }
  if (s.activeOptionId && !s.options[s.activeOptionId]) s.activeOptionId = null;
}
