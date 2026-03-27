// @ts-check
import { normalizeIntelState } from "../core/intelState.js";
import {
  normalizeCensusState,
  normalizeRaceFootprint,
  normalizeAssumptionProvenance,
  normalizeFootprintCapacity,
} from "../core/censusModule.js";
import { normalizeVoterDataState } from "../core/voterDataLayer.js";
import { normalizeCandidateHistoryRecords } from "../core/candidateHistoryBaseline.js";
import { syncFeatureFlagsFromState } from "./featureFlags.js";
import { ensureBudgetShape } from "./state.js";
import { normalizeTargetingState } from "./targetingRuntime.js";
import { ensureWarRoomStateShape } from "./warRoomWeather.js";
import { ensureEventCalendarStateShape } from "./eventCalendarState.js";
import { applyContextToState, resolveActiveContext } from "./activeContext.js";
import { syncTemplateMetaFromState } from "./templateResolver.js";
import { resolveCanonicalCallsPerHour, setCanonicalCallsPerHour } from "../core/throughput.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function sanitizeDefaultResolvedContext(activeContext){
  const src = activeContext && typeof activeContext === "object" ? { ...activeContext } : {};
  const campaignSource = clean(src.campaignSource);
  const officeSource = clean(src.officeSource);
  const scenarioSource = clean(src.scenarioSource);

  // Guard against resolved default context values ("default", "", "") overriding
  // imported campaign/office/scenario identifiers during import hydration.
  if (campaignSource === "default"){
    delete src.campaignId;
    delete src.campaignName;
  }
  if (officeSource === "default"){
    delete src.officeId;
  }
  if (scenarioSource === "default"){
    delete src.scenarioId;
  }
  return src;
}

/**
 * @typedef {Record<string, any>} AnyState
 * @typedef {{
 *   makeDefaultState: () => AnyState,
 *   safeNum: (v: any) => number | null,
 *   clamp: (v: number, lo: number, hi: number) => number,
 *   canonicalDoorsPerHourFromSnap: (state: AnyState) => number | null,
 *   setCanonicalDoorsPerHour: (state: AnyState, value: number | null) => void,
 *   deriveAssumptionsProfileFromState: (state: AnyState) => string,
 *   activeContext?: {
 *     campaignId?: string,
 *     campaignName?: string,
 *     officeId?: string,
 *     scenarioId?: string,
 *     search?: string,
 *   },
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
  out.candidateHistory = normalizeCandidateHistoryRecords(src.candidateHistory);
  out.intelState = normalizeIntelState(src.intelState);
  out.census = normalizeCensusState(src.census, { resetRuntime: true });
  out.voterData = normalizeVoterDataState(src.voterData);
  out.targeting = normalizeTargetingState(src.targeting);
  out.raceFootprint = normalizeRaceFootprint(src.raceFootprint);
  out.assumptionsProvenance = normalizeAssumptionProvenance(src.assumptionsProvenance);
  out.footprintCapacity = normalizeFootprintCapacity(src.footprintCapacity);
  out.templateMeta = src.templateMeta;
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
  const canonCph = resolveCanonicalCallsPerHour(out, { toNumber: safeNum });
  setCanonicalCallsPerHour(out, (canonCph != null && isFinite(canonCph)) ? canonCph : safeNum(base.callsPerHour3), {
    toNumber: safeNum,
    emptyValue: "",
  });

  syncFeatureFlagsFromState(out, { preferFeatures: !!(src.features && typeof src.features === "object" && !Array.isArray(src.features)) });
  syncTemplateMetaFromState(out);
  const context = resolveActiveContext({ ...sanitizeDefaultResolvedContext(deps?.activeContext), fallback: out });
  applyContextToState(out, context);
  ensureWarRoomStateShape(out);
  ensureEventCalendarStateShape(out);
  out.ui.assumptionsProfile = deriveAssumptionsProfileFromState(out);
  out.ui.themeMode = "system";
  out.ui.dark = false;
  return out;
}
