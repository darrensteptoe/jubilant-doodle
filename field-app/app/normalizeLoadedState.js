export function normalizeLoadedStateModule(s, deps){
  const {
    makeDefaultState,
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap,
    setCanonicalDoorsPerHour,
    deriveAssumptionsProfileFromState,
  } = deps || {};

  const base = makeDefaultState();
  const src = s && typeof s === "object" ? s : {};
  const out = { ...base, ...src };
  out.candidates = Array.isArray(src.candidates) ? src.candidates : base.candidates;
  out.userSplit = (src.userSplit && typeof src.userSplit === "object") ? src.userSplit : {};
  out.ui = { ...base.ui, ...(src.ui || {}) };

  out.budget = (src.budget && typeof src.budget === "object")
    ? {
        ...base.budget,
        ...src.budget,
        tactics: { ...base.budget.tactics, ...(src.budget.tactics || {}) },
        optimize: { ...base.budget.optimize, ...(src.budget.optimize || {}) }
      }
    : structuredClone(base.budget);

  if (!out.yourCandidateId && out.candidates[0]) out.yourCandidateId = out.candidates[0].id;
  out.crmEnabled = !!out.crmEnabled;
  out.scheduleEnabled = !!out.scheduleEnabled;
  out.twCapOverrideEnabled = !!out.twCapOverrideEnabled;
  out.twCapOverrideMode = ["baseline", "ramp", "scheduled", "max"].includes(String(out.twCapOverrideMode || ""))
    ? String(out.twCapOverrideMode)
    : "baseline";

  const horizon = safeNum(out.twCapOverrideHorizonWeeks);
  out.twCapOverrideHorizonWeeks = (horizon != null && isFinite(horizon)) ? clamp(horizon, 4, 52) : 12;

  const canonDph = canonicalDoorsPerHourFromSnap(out);
  setCanonicalDoorsPerHour(out, (canonDph != null && isFinite(canonDph)) ? canonDph : safeNum(base.doorsPerHour3));

  out.ui.assumptionsProfile = deriveAssumptionsProfileFromState(out);
  out.ui.themeMode = "system";
  out.ui.dark = false;
  return out;
}
