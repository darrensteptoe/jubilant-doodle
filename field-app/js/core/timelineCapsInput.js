// @ts-check

import { coerceFiniteNumber } from "./utils.js";

const safeNum = coerceFiniteNumber;

export const TIMELINE_THROUGHPUT_CHANNELS = Object.freeze([
  "doors",
  "phones",
  "texts",
]);

export function buildTimelineTacticKindsMapFromState(state, {
  channels = TIMELINE_THROUGHPUT_CHANNELS,
  defaultKind = "persuasion",
} = {}){
  const src = state && typeof state === "object" ? state : {};
  const tactics = src?.budget?.tactics && typeof src.budget.tactics === "object"
    ? src.budget.tactics
    : {};
  const out = {};
  for (const channelId of channels){
    out[channelId] = String(tactics?.[channelId]?.kind || defaultKind);
  }
  return out;
}

export function buildTimelineCapsInputFromState({
  state = {},
  weeksRemaining = 0,
  enabled = true,
  tacticKinds = null,
} = {}){
  const src = state && typeof state === "object" ? state : {};
  return {
    enabled: !!enabled,
    weeksRemaining: safeNum(weeksRemaining) ?? 0,
    activeWeeksOverride: safeNum(src.timelineActiveWeeks),
    gotvWindowWeeks: safeNum(src.timelineGotvWeeks),
    staffing: {
      staff: safeNum(src.timelineStaffCount) ?? 0,
      volunteers: safeNum(src.timelineVolCount) ?? 0,
      staffHours: safeNum(src.timelineStaffHours) ?? 0,
      volunteerHours: safeNum(src.timelineVolHours) ?? 0,
    },
    throughput: {
      doors: safeNum(src.timelineDoorsPerHour) ?? 0,
      phones: safeNum(src.timelineCallsPerHour) ?? 0,
      texts: safeNum(src.timelineTextsPerHour) ?? 0,
    },
    tacticKinds: tacticKinds && typeof tacticKinds === "object"
      ? tacticKinds
      : buildTimelineTacticKindsMapFromState(src),
  };
}

export function normalizeTimelineCapsByTactic(maxAttemptsByTactic){
  const src = maxAttemptsByTactic && typeof maxAttemptsByTactic === "object"
    ? maxAttemptsByTactic
    : {};
  const out = {};
  for (const [key, value] of Object.entries(src)){
    const n = Number(value);
    out[key] = (Number.isFinite(n) && n >= 0) ? n : null;
  }
  return out;
}

export function sumTimelineCapsAttempts(maxAttemptsByTactic){
  const normalized = normalizeTimelineCapsByTactic(maxAttemptsByTactic);
  return Object.values(normalized).reduce((sum, value) => sum + (value == null ? 0 : value), 0);
}

function resolveTimelineCapsEnabled(capsWrap){
  const src = capsWrap && typeof capsWrap === "object" ? capsWrap : {};
  if (typeof src.enabled === "boolean") return src.enabled;
  if (typeof src?.meta?.enabled === "boolean") return src.meta.enabled;
  return true;
}

export function extractTimelineMaxAttemptsByTactic(capsWrap, { requireEnabled = true } = {}){
  const src = capsWrap && typeof capsWrap === "object" ? capsWrap : {};
  const maxAttemptsByTactic = src?.maxAttemptsByTactic;
  if (!maxAttemptsByTactic || typeof maxAttemptsByTactic !== "object"){
    return null;
  }
  if (requireEnabled && !resolveTimelineCapsEnabled(src)){
    return null;
  }
  return maxAttemptsByTactic;
}

export function extractTimelineActiveWeeks(capsWrap, fallback = null){
  const src = capsWrap && typeof capsWrap === "object" ? capsWrap : {};
  const metaWeeks = safeNum(src?.meta?.activeWeeks);
  if (metaWeeks != null) return metaWeeks;
  const directWeeks = safeNum(src?.activeWeeks);
  if (directWeeks != null) return directWeeks;
  const fb = safeNum(fallback);
  return fb != null ? fb : null;
}

/**
 * Compute + extract + normalize timeline caps from an explicit caps input object.
 * Keeps cap-wrap plumbing out of render/runtime modules.
 *
 * @param {{
 *   capsInput?: Record<string, any> | null,
 *   computeMaxAttemptsByTactic?: ((capsInput: Record<string, any>) => Record<string, any> | null) | null,
 *   requireEnabled?: boolean,
 * }} input
 * @returns {{
 *   capsInput: Record<string, any>,
 *   capsWrap: Record<string, any> | null,
 *   maxAttemptsByTactic: Record<string, any> | null,
 *   capsByTactic: Record<string, number | null> | null,
 *   totalAttempts: number | null,
 * }}
 */
export function computeTimelineCapsSummary({
  capsInput = null,
  computeMaxAttemptsByTactic = null,
  requireEnabled = true,
} = {}){
  const input = capsInput && typeof capsInput === "object" ? capsInput : {};
  if (typeof computeMaxAttemptsByTactic !== "function"){
    return {
      capsInput: input,
      capsWrap: null,
      maxAttemptsByTactic: null,
      capsByTactic: null,
      totalAttempts: null,
    };
  }
  const capsWrap = computeMaxAttemptsByTactic(input) || null;
  const maxAttemptsByTactic = extractTimelineMaxAttemptsByTactic(capsWrap, { requireEnabled });
  if (!maxAttemptsByTactic){
    return {
      capsInput: input,
      capsWrap,
      maxAttemptsByTactic: null,
      capsByTactic: null,
      totalAttempts: null,
    };
  }
  const capsByTactic = normalizeTimelineCapsByTactic(maxAttemptsByTactic);
  const total = sumTimelineCapsAttempts(capsByTactic);
  return {
    capsInput: input,
    capsWrap,
    maxAttemptsByTactic,
    capsByTactic,
    totalAttempts: (Number.isFinite(total) && total >= 0) ? total : null,
  };
}

/**
 * Compute + extract + normalize timeline caps directly from state.
 *
 * @param {{
 *   state?: Record<string, any> | null,
 *   weeksRemaining?: unknown,
 *   enabled?: boolean,
 *   tacticKinds?: Record<string, any> | null,
 *   computeMaxAttemptsByTactic?: ((capsInput: Record<string, any>) => Record<string, any> | null) | null,
 *   requireEnabled?: boolean,
 * }} input
 * @returns {ReturnType<typeof computeTimelineCapsSummary>}
 */
export function computeTimelineCapsSummaryFromState({
  state = null,
  weeksRemaining = 0,
  enabled = true,
  tacticKinds = null,
  computeMaxAttemptsByTactic = null,
  requireEnabled = true,
} = {}){
  const capsInput = buildTimelineCapsInputFromState({
    state: state && typeof state === "object" ? state : {},
    weeksRemaining,
    enabled: !!enabled,
    tacticKinds: tacticKinds && typeof tacticKinds === "object" ? tacticKinds : null,
  });
  return computeTimelineCapsSummary({
    capsInput,
    computeMaxAttemptsByTactic,
    requireEnabled,
  });
}
