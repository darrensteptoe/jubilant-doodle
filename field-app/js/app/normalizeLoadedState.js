// @ts-check
import { normalizeIntelState } from "../core/intelState.js";
import {
  normalizeCensusState,
  normalizeRaceFootprint,
  normalizeAssumptionProvenance,
  normalizeFootprintCapacity,
} from "../core/censusModule.js";
import { syncFeatureFlagsFromState } from "./featureFlags.js";
import { ensureBudgetShape } from "./state.js";

/**
 * @typedef {Record<string, any>} AnyState
 * @typedef {{
 *   makeDefaultState: () => AnyState,
 *   safeNum: (v: any) => number | null,
 *   clamp: (v: number, lo: number, hi: number) => number,
 *   canonicalDoorsPerHourFromSnap: (state: AnyState) => number | null,
 *   setCanonicalDoorsPerHour: (state: AnyState, value: number | null) => void,
 *   deriveAssumptionsProfileFromState: (state: AnyState) => string,
 * }} NormalizeLoadedStateDeps
 */

/**
 * @param {AnyState} s
 * @param {NormalizeLoadedStateDeps} deps
 * @returns {AnyState}
 */
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
  out.intelState = normalizeIntelState(src.intelState);
  out.census = normalizeCensusState(src.census, { resetRuntime: true });
  out.raceFootprint = normalizeRaceFootprint(src.raceFootprint);
  out.assumptionsProvenance = normalizeAssumptionProvenance(src.assumptionsProvenance);
  out.footprintCapacity = normalizeFootprintCapacity(src.footprintCapacity);
  out.ui = { ...base.ui, ...(src.ui || {}) };

  ensureBudgetShape(out);

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

  syncFeatureFlagsFromState(out, { preferFeatures: !!(src.features && typeof src.features === "object" && !Array.isArray(src.features)) });
  out.ui.assumptionsProfile = deriveAssumptionsProfileFromState(out);
  out.ui.themeMode = "system";
  out.ui.dark = false;
  return out;
}
