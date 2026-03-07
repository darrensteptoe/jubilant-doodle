// @ts-check
/**
 * @param {number} a
 * @param {number} b
 * @param {number=} eps
 */
export function approxEqModule(a, b, eps = 1e-6){
  return Math.abs(a - b) <= eps;
}

/**
 * @param {Record<string, any>} targetState
 * @param {string} raceType
 * @param {{ force?: boolean }=} options
 * @param {Record<string, any>=} defaultsByTemplate
 */
export function applyTemplateDefaultsForRaceModule(
  targetState,
  raceType,
  { force = false } = {},
  defaultsByTemplate = {}
){
  if (!targetState || typeof targetState !== "object") return;
  const key = String(raceType || targetState.raceType || "state_leg");
  const defs = defaultsByTemplate[key] || defaultsByTemplate.state_leg || {};

  if (force || (targetState.bandWidth == null || targetState.bandWidth === "")){
    targetState.bandWidth = defs.bandWidth;
  }
  if (force || (targetState.persuasionPct == null || targetState.persuasionPct === "")){
    targetState.persuasionPct = defs.persuasionPct;
  }
  if (force || (targetState.earlyVoteExp == null || targetState.earlyVoteExp === "")){
    targetState.earlyVoteExp = defs.earlyVoteExp;
  }
}

/**
 * @param {Record<string, any>} snap
 * @param {Record<string, any>=} defaultsByTemplate
 * @param {(v: any) => number | null} safeNum
 * @param {(a: number, b: number, eps?: number) => boolean=} approxEq
 */
export function deriveAssumptionsProfileFromStateModule(
  snap,
  defaultsByTemplate = {},
  safeNum,
  approxEq = approxEqModule
){
  const s = snap || {};
  const raceKey = String(s.raceType || "state_leg");
  const defs = defaultsByTemplate[raceKey] || defaultsByTemplate.state_leg || {};
  const bw = safeNum(s.bandWidth);
  const pp = safeNum(s.persuasionPct);
  const ev = safeNum(s.earlyVoteExp);

  const isTemplateLike =
    bw != null && pp != null && ev != null &&
    approxEq(bw, defs.bandWidth) &&
    approxEq(pp, defs.persuasionPct) &&
    approxEq(ev, defs.earlyVoteExp);

  const explicit = s?.ui?.assumptionsProfile;
  if (explicit === "template" || explicit === "custom"){
    if (explicit === "template" && !isTemplateLike) return "custom";
    return explicit;
  }
  return isTemplateLike ? "template" : "custom";
}

/**
 * @param {Record<string, any>} state
 * @param {(state: Record<string, any>) => string} deriveAssumptionsProfileFromState
 */
export function refreshAssumptionsProfileModule(state, deriveAssumptionsProfileFromState){
  if (!state.ui) state.ui = {};
  state.ui.assumptionsProfile = deriveAssumptionsProfileFromState(state);
}

/**
 * @param {Record<string, any>} src
 * @param {(raceType: string) => string} labelTemplate
 */
export function assumptionsProfileLabelModule(src, labelTemplate){
  const s = src || {};
  const profile = (s?.ui?.assumptionsProfile === "template") ? "template" : "custom";
  if (profile === "template"){
    return `Template (${labelTemplate(s.raceType)})`;
  }
  return "Custom overrides";
}
