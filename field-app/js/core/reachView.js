// @ts-check
import { computeFinishDateFromDailyPace, computeGoalPaceRequirements } from "./executionPlanner.js";
import {
  computeRollingExecutionRates,
  summarizeExecutionDailyLog,
} from "./executionSnapshot.js";
import { computeBlendedAttemptsPerHourFromState } from "./throughput.js";
import { NULL_BASE_RATE_DEFAULTS, resolveStateBaseRates } from "./baseRates.js";
import {
  clampFiniteNumber,
  coerceFiniteNumber,
  formatFixedNumber,
  formatPercentFromUnit,
  roundWholeNumberByMode,
} from "./utils.js";

export const REACH_STATUS_AWAITING_INPUTS = "Awaiting inputs";
export const REACH_STATUS_UNAVAILABLE = "Unavailable";
export const REACH_REALITY_NOTE_FALLBACK =
  "Reality check uses your daily log to estimate actual rates/capacity over the last 7 entries.";

/**
 * @param {unknown} value
 * @returns {number | null}
 */
const toFiniteNumber = coerceFiniteNumber;

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const clampNumber = clampFiniteNumber;

/**
 * @param {unknown} raw
 * @returns {string}
 */
function defaultFormatDate(raw){
  try{
    const dt = (raw instanceof Date) ? raw : new Date(raw);
    if (!Number.isFinite(dt.getTime())) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return "—";
  }
}

/**
 * @param {number | null | undefined} value
 * @param {{ ceil?: boolean, floor?: boolean }=} options
 * @returns {string}
 */
function defaultFormatInt(value, options = {}){
  return formatReachInt(value, options);
}

/**
 * Canonical integer formatter for reach panels.
 * Applies optional ceil/floor rounding semantics and shared fallback behavior.
 *
 * @param {unknown} value
 * @param {{ ceil?: boolean, floor?: boolean, formatInt?: ((value: number) => string) | null, fallback?: string }=} options
 * @returns {string}
 */
export function formatReachInt(value, options = {}){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return String(options?.fallback || "—");
  }
  const mode = options?.ceil ? "ceil" : (options?.floor ? "floor" : "round");
  const rounded = roundWholeNumberByMode(n, { mode, fallback: null });
  if (rounded == null){
    return String(options?.fallback || "—");
  }
  if (typeof options?.formatInt === "function"){
    return String(options.formatInt(rounded));
  }
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Canonical reach integer formatter factory.
 * Useful when render modules need a stable formatter callback.
 *
 * @param {((value: number) => string) | null | undefined} formatInt
 * @returns {(value: unknown, options?: { ceil?: boolean, floor?: boolean, fallback?: string }) => string}
 */
export function buildReachIntFormatter(formatInt){
  const custom = (typeof formatInt === "function") ? formatInt : null;
  return (value, options = {}) => formatReachInt(value, { ...options, formatInt: custom });
}

/**
 * @param {(value: number|null|undefined, options?: { ceil?: boolean, floor?: boolean }) => string | null | undefined} formatInt
 * @returns {(value: number|null|undefined, options?: { ceil?: boolean, floor?: boolean }) => string}
 */
function resolveFormatInt(formatInt){
  return (value, options = {}) => {
    if (typeof formatInt === "function"){
      try{
        const out = formatInt(value, options);
        if (out != null && String(out).trim()){
          return String(out);
        }
      } catch {
        // Fall through to canonical fallback.
      }
    }
    return defaultFormatInt(value, options);
  };
}

/**
 * @param {(raw: unknown) => string | null | undefined} formatDate
 * @returns {(raw: unknown) => string}
 */
function resolveFormatDate(formatDate){
  return (raw) => {
    if (typeof formatDate === "function"){
      try{
        const out = formatDate(raw);
        if (out != null && String(out).trim()){
          return String(out);
        }
      } catch {
        // Fall through to canonical fallback.
      }
    }
    return defaultFormatDate(raw);
  };
}

/**
 * @param {unknown} logSummary
 * @returns {{
 *   hasLog: boolean,
 *   entries: number,
 *   days: number|null,
 *   sumConvos: number|null,
 *   sumAttempts: number|null,
 *   lastDate: unknown,
 * }}
 */
function normalizeLogSummary(logSummary){
  const log = (logSummary && typeof logSummary === "object") ? /** @type {Record<string, any>} */ (logSummary) : {};
  const entries = toFiniteNumber(log.entries ?? log.n) ?? 0;
  const daysRaw = toFiniteNumber(log.days);
  const days = (daysRaw != null && daysRaw > 0) ? daysRaw : null;
  const sumConvos = toFiniteNumber(log.sumConvosWindow ?? log.sumConvos);
  const sumAttempts = toFiniteNumber(log.sumAttemptsWindow ?? log.sumAttempts);
  const hasLogFlag = !!log.hasLog;
  const hasAny = hasLogFlag || entries > 0 || (sumAttempts != null && sumAttempts > 0) || (sumConvos != null && sumConvos > 0);
  return {
    hasLog: hasAny && entries > 0,
    entries: Math.max(0, roundWholeNumberByMode(entries, { mode: "round", fallback: 0 }) || 0),
    days,
    sumConvos,
    sumAttempts,
    lastDate: log.lastDate ?? null,
  };
}

/**
 * @param {number | null} required
 * @param {number | null} actual
 * @returns {{ kind: "ok"|"warn"|"bad"|null, label: string, gap: number|null }}
 */
function computePaceKind(required, actual){
  if (required == null || !Number.isFinite(required) || required <= 0){
    return { kind: null, label: "—", gap: null };
  }
  if (actual == null || !Number.isFinite(actual)){
    return { kind: null, label: "—", gap: null };
  }
  const gap = actual - required;
  if (actual >= required){
    return { kind: "ok", label: "On pace", gap };
  }
  if (actual >= required * 0.9){
    return { kind: "warn", label: "Within 10%", gap };
  }
  return { kind: "bad", label: "Behind", gap };
}

/**
 * @param {"ok"|"warn"|"bad"|null|undefined} a
 * @param {"ok"|"warn"|"bad"|null|undefined} b
 * @returns {"ok"|"warn"|"bad"|null|undefined}
 */
function resolveWorstPaceKind(a, b){
  const rank = { ok: 3, warn: 2, bad: 1, null: 0, undefined: 0 };
  return rank[a] <= rank[b] ? a : b;
}

/**
 * @param {number|null|undefined} total
 * @param {number|null|undefined} pacePerDay
 * @param {Date} now
 * @param {(raw: unknown) => string} formatDate
 * @returns {{ text: string }}
 */
function buildFinishProjection(total, pacePerDay, now, formatDate){
  if (total == null || !Number.isFinite(total) || total <= 0){
    return { text: "No target" };
  }
  if (pacePerDay == null || !Number.isFinite(pacePerDay) || pacePerDay <= 0){
    return { text: "No measurable pace" };
  }
  const dt = computeFinishDateFromDailyPace({
    totalAttempts: total,
    attemptsPerDay: pacePerDay,
    nowDate: now,
  });
  if (!dt) return { text: "No measurable pace" };
  return { text: formatDate(dt) || "At current pace" };
}

/**
 * @param {Record<string, any> | null | undefined} ctx
 * @param {{
 *   formatInt?: (value: number|null|undefined, options?: { ceil?: boolean, floor?: boolean }) => string | null | undefined
 * }=} options
 * @returns {{
 *   constraint: string,
 *   constraintNote: string,
 *   gapText: string,
 *   wkBanner: { show: boolean, kind: "ok"|"warn"|"bad", text: string }
 * }}
 */
export function buildReachWeeklyConstraintView(ctx, options = {}){
  const source = (ctx && typeof ctx === "object") ? ctx : {};
  const formatInt = resolveFormatInt(options?.formatInt);
  const goal = toFiniteNumber(source.goal) ?? 0;
  const weeks = toFiniteNumber(source.weeks);
  const sr = toFiniteNumber(source.sr);
  const cr = toFiniteNumber(source.cr);
  const capTotal = toFiniteNumber(source.capTotal);
  const gap = toFiniteNumber(source.gap);

  const gapText = (gap == null) ? "—" : (gap <= 0 ? "0" : formatInt(gap, { ceil: true }));

  let constraint = "—";
  let constraintNote = "—";
  let wkBannerText = "";
  /** @type {"ok"|"warn"|"bad"} */
  let wkBannerKind = "warn";
  let wkBannerShow = false;

  if (goal <= 0){
    constraint = "None";
    constraintNote = "Goal is 0 under current inputs.";
  } else if (weeks == null || weeks <= 0){
    constraint = "Timeline";
    constraintNote = "Set election date or weeks remaining.";
    wkBannerText = "This week plan needs weeks remaining. Set an election date or enter weeks remaining to compute per-week targets.";
    wkBannerShow = true;
  } else if (sr == null || sr <= 0 || cr == null || cr <= 0){
    constraint = "Rates";
    constraintNote = "Enter support rate + contact rate.";
    wkBannerText = "This week plan needs Support rate and Contact rate (Phase 2).";
    wkBannerShow = true;
  } else if (capTotal == null){
    constraint = "Capacity";
    constraintNote = "Enter organizers/hours + speeds (Phase 3).";
    wkBannerText = "Capacity/week is missing. Fill Phase 3 execution inputs (organizers, hours/week, doors/hr, calls/hr, channel split).";
    wkBannerShow = true;
  } else if (gap != null && gap <= 0){
    constraint = "Feasible";
    constraintNote = "Capacity covers required attempts/week.";
    wkBannerText = "Feasible: capacity covers the per-week requirement under current rates.";
    wkBannerKind = "ok";
    wkBannerShow = true;
  } else if (gap != null){
    const gapCeil = roundWholeNumberByMode(gap, { mode: "ceil", fallback: 0 }) || 0;
    constraint = "Capacity";
    constraintNote = `Short by ~${formatInt(gapCeil)} attempts/week.`;
    wkBannerText = `Gap: you are short by ~${formatInt(gapCeil)} attempts per week. Options: increase organizers/hours, improve speeds, shift channel mix, or raise rates.`;
    wkBannerKind = (gapCeil <= 500) ? "warn" : "bad";
    wkBannerShow = true;
  }

  return {
    constraint,
    constraintNote,
    gapText,
    wkBanner: {
      show: wkBannerShow,
      kind: wkBannerKind,
      text: wkBannerText,
    },
  };
}

/**
 * @param {{
 *   ctx?: Record<string, any> | null,
 *   logSummary?: unknown,
 *   rollingCR?: number | null,
 *   formatInt?: (value: number|null|undefined, options?: { ceil?: boolean, floor?: boolean }) => string | null | undefined,
 *   formatDate?: (raw: unknown) => string | null | undefined,
 *   clampFn?: (value: number, min: number, max: number) => number,
 *   now?: Date,
 *   hideChannelBreakdownWithoutLog?: boolean,
 * }} args
 * @returns {{
 *   hasLog: boolean,
 *   requiredConvosText: string,
 *   requiredAttemptsText: string,
 *   requiredDoorAttemptsText: string,
 *   requiredCallAttemptsText: string,
 *   actualConvosText: string,
 *   actualAttemptsText: string,
 *   actualConvosNote: string,
 *   actualAttemptsNote: string,
 *   gapConvosText: string,
 *   gapAttemptsText: string,
 *   convosPace: { kind: "ok"|"warn"|"bad"|null, label: string },
 *   attemptsPace: { kind: "ok"|"warn"|"bad"|null, label: string },
 *   impliedConvosText: string,
 *   impliedConvosNote: string,
 *   finishConvosText: string,
 *   finishAttemptsText: string,
 *   paceStatus: string,
 *   paceNote: string,
 *   wkExecBanner: { show: boolean, kind: "ok"|"warn"|"bad", text: string },
 * }}
 */
export function buildReachWeeklyExecutionView(args = {}){
  const ctx = (args?.ctx && typeof args.ctx === "object") ? args.ctx : {};
  const clampFn = (typeof args?.clampFn === "function") ? args.clampFn : clampNumber;
  const formatInt = resolveFormatInt(args?.formatInt);
  const formatDate = resolveFormatDate(args?.formatDate);
  const now = (args?.now instanceof Date && Number.isFinite(args.now.getTime())) ? args.now : new Date();
  const hideChannelBreakdownWithoutLog = !!args?.hideChannelBreakdownWithoutLog;

  const reqConvos = toFiniteNumber(ctx.convosPerWeek);
  const reqAttempts = toFiniteNumber(ctx.attemptsPerWeek);
  const reqConvosText = formatInt(reqConvos, { ceil: true });
  const reqAttemptsText = formatInt(reqAttempts, { ceil: true });

  const doorShareRaw = toFiniteNumber(ctx.doorShare);
  const doorShare = (doorShareRaw == null) ? null : clampFn(doorShareRaw, 0, 1);
  const reqDoorAttempts = (
    reqAttempts != null &&
    Number.isFinite(reqAttempts) &&
    doorShare != null &&
    Number.isFinite(doorShare)
  )
    ? (reqAttempts * doorShare)
    : null;
  const reqCallAttempts = (
    reqAttempts != null &&
    Number.isFinite(reqAttempts) &&
    doorShare != null &&
    Number.isFinite(doorShare)
  )
    ? (reqAttempts * (1 - doorShare))
    : null;

  const normalizedLog = normalizeLogSummary(args?.logSummary);
  const hasLog = normalizedLog.hasLog;
  const actualConvos = hasLog ? normalizedLog.sumConvos : null;
  const actualAttempts = hasLog ? normalizedLog.sumAttempts : null;
  const rollingCRRaw = toFiniteNumber(args?.rollingCR);
  const rollingCR = (rollingCRRaw != null && Number.isFinite(rollingCRRaw))
    ? rollingCRRaw
    : (
      actualAttempts != null &&
      Number.isFinite(actualAttempts) &&
      actualAttempts > 0 &&
      actualConvos != null &&
      Number.isFinite(actualConvos)
    )
      ? (actualConvos / actualAttempts)
      : null;

  let actualConvosText = "—";
  let actualAttemptsText = "—";
  let gapConvosText = "—";
  let gapAttemptsText = "—";
  let impliedConvosText = "—";
  let impliedConvosNote = "Insufficient field data.";
  let finishConvosText = "—";
  let finishAttemptsText = "—";
  let paceStatus = "—";
  let paceNote = "Insufficient field data.";
  /** @type {"ok"|"warn"|"bad"} */
  let wkExecBannerKind = "warn";
  let wkExecBannerShow = false;
  let wkExecBannerText = "";
  /** @type {{ kind: "ok"|"warn"|"bad"|null, label: string }} */
  let convosPaceTag = { kind: null, label: "—" };
  /** @type {{ kind: "ok"|"warn"|"bad"|null, label: string }} */
  let attemptsPaceTag = { kind: null, label: "—" };
  const lastTextRaw = formatDate(normalizedLog.lastDate);
  const lastText = (lastTextRaw && lastTextRaw !== "—") ? lastTextRaw : "—";
  const entriesText = formatInt(normalizedLog.entries);
  const daysText = formatInt(normalizedLog.days);
  const actualNote = hasLog
    ? `${entriesText} entries over ~${daysText} day(s) · last: ${lastText}`
    : "Insufficient field data.";

  if (hasLog){
    actualConvosText = formatInt(actualConvos);
    actualAttemptsText = formatInt(actualAttempts);

    const convosPace = computePaceKind(reqConvos, actualConvos);
    const attemptsPace = computePaceKind(reqAttempts, actualAttempts);
    convosPaceTag = { kind: convosPace.kind, label: convosPace.label };
    attemptsPaceTag = { kind: attemptsPace.kind, label: attemptsPace.label };

    if (convosPace.gap != null && Number.isFinite(convosPace.gap)){
      const rounded = roundWholeNumberByMode(convosPace.gap, { mode: "round", fallback: 0 }) || 0;
      const magnitude = formatInt(Math.abs(rounded));
      gapConvosText = rounded >= 0 ? `+${magnitude}` : `-${magnitude}`;
    }
    if (attemptsPace.gap != null && Number.isFinite(attemptsPace.gap)){
      const rounded = roundWholeNumberByMode(attemptsPace.gap, { mode: "round", fallback: 0 }) || 0;
      const magnitude = formatInt(Math.abs(rounded));
      gapAttemptsText = rounded >= 0 ? `+${magnitude}` : `-${magnitude}`;
    }

    if (rollingCR != null && Number.isFinite(rollingCR) && reqAttempts != null && Number.isFinite(reqAttempts)){
      impliedConvosText = formatInt(reqAttempts * rollingCR);
      impliedConvosNote = `Uses rolling 7-entry contact rate (${formatPercentFromUnit(rollingCR, 1)})`;
    }

    const paceAttemptsPerDay = (normalizedLog.days != null && normalizedLog.days > 0 && actualAttempts != null && Number.isFinite(actualAttempts))
      ? (actualAttempts / normalizedLog.days)
      : null;
    const paceConvosPerDay = (normalizedLog.days != null && normalizedLog.days > 0 && actualConvos != null && Number.isFinite(actualConvos))
      ? (actualConvos / normalizedLog.days)
      : null;

    const totalConvos = (toFiniteNumber(ctx.convosNeeded) != null)
      ? toFiniteNumber(ctx.convosNeeded)
      : (
        reqConvos != null &&
        Number.isFinite(reqConvos) &&
        toFiniteNumber(ctx.weeks) != null
      )
        ? reqConvos * (toFiniteNumber(ctx.weeks) || 0)
        : null;
    const totalAttempts = (toFiniteNumber(ctx.attemptsNeeded) != null)
      ? toFiniteNumber(ctx.attemptsNeeded)
      : (
        reqAttempts != null &&
        Number.isFinite(reqAttempts) &&
        toFiniteNumber(ctx.weeks) != null
      )
        ? reqAttempts * (toFiniteNumber(ctx.weeks) || 0)
        : null;

    finishConvosText = buildFinishProjection(totalConvos, paceConvosPerDay, now, formatDate).text;
    finishAttemptsText = buildFinishProjection(totalAttempts, paceAttemptsPerDay, now, formatDate).text;

    const bannerKind = resolveWorstPaceKind(convosPace.kind, attemptsPace.kind);
    if (bannerKind === "ok"){
      paceStatus = "On pace";
      paceNote = "Last 7-entry pace meets or exceeds weekly requirement.";
    } else if (bannerKind === "warn"){
      paceStatus = "Tight";
      paceNote = "Within 10% of weekly requirement. Any slip risks missing timeline.";
    } else if (bannerKind === "bad"){
      paceStatus = "Behind";
      paceNote = "Behind weekly requirement by more than 10%.";
    } else {
      paceStatus = "—";
      paceNote = "Set goal + weeks remaining to compute requirement.";
    }

    wkExecBannerShow = (bannerKind === "ok" || bannerKind === "warn" || bannerKind === "bad");
    wkExecBannerKind = /** @type {"ok"|"warn"|"bad"} */ (bannerKind || "warn");
    wkExecBannerText = wkExecBannerShow
      ? `Last 7: ${actualConvosText} convos / ${actualAttemptsText} attempts vs required ${reqConvosText} convos / ${reqAttemptsText} attempts per week.`
      : "";
  }

  const requiredDoorAttemptsText = (
    hideChannelBreakdownWithoutLog && !hasLog
  )
    ? "—"
    : formatInt(reqDoorAttempts, { ceil: true });
  const requiredCallAttemptsText = (
    hideChannelBreakdownWithoutLog && !hasLog
  )
    ? "—"
    : formatInt(reqCallAttempts, { ceil: true });

  return {
    hasLog,
    requiredConvosText: reqConvosText,
    requiredAttemptsText: reqAttemptsText,
    requiredDoorAttemptsText,
    requiredCallAttemptsText,
    actualConvosText,
    actualAttemptsText,
    actualConvosNote: actualNote,
    actualAttemptsNote: actualNote,
    gapConvosText,
    gapAttemptsText,
    convosPace: convosPaceTag,
    attemptsPace: attemptsPaceTag,
    impliedConvosText,
    impliedConvosNote,
    finishConvosText,
    finishAttemptsText,
    paceStatus,
    paceNote,
    wkExecBanner: {
      show: wkExecBannerShow,
      kind: wkExecBannerKind,
      text: wkExecBannerText,
    },
  };
}

/**
 * @param {{
 *   state?: Record<string, any> | null,
 *   weeklyContext?: Record<string, any> | null,
 *   executionSnapshot?: Record<string, any> | null,
 *   safeNumFn?: (value: unknown) => number | null | undefined,
 *   formatInt?: (value: number|null|undefined, options?: { ceil?: boolean, floor?: boolean }) => string | null | undefined,
 *   formatPct?: (value: number|null|undefined) => string | null | undefined,
 *   formatNum1?: (value: number|null|undefined) => string | null | undefined,
 * }} args
 * @returns {{
 *   lastUpdate: string,
 *   freshNote: string,
 *   rollingAttempts: string,
 *   rollingNote: string,
 *   rollingCR: string,
 *   rollingCRNote: string,
 *   rollingSR: string,
 *   rollingSRNote: string,
 *   rollingAPH: string,
 *   rollingAPHNote: string,
 *   status: string,
 * }}
 */
export function buildReachFreshnessView(args = {}){
  const state = (args?.state && typeof args.state === "object") ? args.state : {};
  const weeklyContext = (args?.weeklyContext && typeof args.weeklyContext === "object") ? args.weeklyContext : {};
  const snap = (args?.executionSnapshot && typeof args.executionSnapshot === "object") ? args.executionSnapshot : null;
  const safeNumFn = (typeof args?.safeNumFn === "function")
    ? args.safeNumFn
    : (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
  const formatInt = resolveFormatInt(args?.formatInt);
  const formatPct = (typeof args?.formatPct === "function")
    ? (value) => {
      try{
        const out = args.formatPct(value);
        if (out != null && String(out).trim()) return String(out);
      } catch {
        // Fall through to canonical fallback.
      }
      return formatPercentFromUnit(value, 1);
    }
    : (value) => formatPercentFromUnit(value, 1);
  const formatNum1 = (typeof args?.formatNum1 === "function")
    ? (value) => {
      try{
        const out = args.formatNum1(value);
        if (out != null && String(out).trim()) return String(out);
      } catch {
        // Fall through to canonical fallback.
      }
      return formatFixedNumber(value, 1);
    }
    : (value) => formatFixedNumber(value, 1);

  const logList = Array.isArray(state?.ui?.dailyLog) ? state.ui.dailyLog : [];
  const logSummary = (snap?.log && snap.log.hasLog)
    ? snap.log
    : summarizeExecutionDailyLog({ dailyLog: logList, windowN: 7, safeNumFn });
  const hasLog = !!logSummary?.hasLog;
  if (!hasLog){
    return {
      lastUpdate: "—",
      freshNote: "No daily log configured yet",
      rollingAttempts: "—",
      rollingNote: "Add entries in organizer.html to activate reality checks",
      rollingCR: "—",
      rollingCRNote: "—",
      rollingSR: "—",
      rollingSRNote: "—",
      rollingAPH: "—",
      rollingAPHNote: "—",
      status: "Not tracking",
    };
  }

  const sorted = Array.isArray(logSummary?.sorted) ? logSummary.sorted : [];
  const last = sorted[sorted.length - 1];

  const sumAttempts = Number(logSummary?.sumAttemptsWindow ?? 0);
  const rolling = computeRollingExecutionRates({
    sumAttempts: logSummary?.sumAttemptsWindow,
    sumConvos: logSummary?.sumConvosWindow,
    sumSupportIds: logSummary?.sumSupportIdsWindow,
    sumOrgHours: logSummary?.sumOrgHoursWindow,
    safeNumFn,
  });
  const actualCR = snap?.rolling?.cr ?? rolling.cr;
  const actualSR = snap?.rolling?.sr ?? rolling.sr;
  const actualAPH = snap?.rolling?.aph ?? rolling.aph;

  const baseRates = resolveStateBaseRates(state, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  const assumedCR = snap?.assumptions?.cr ?? baseRates.cr;
  const assumedSR = snap?.assumptions?.sr ?? baseRates.sr;
  const expectedAPH = snap?.assumptions?.aph ?? computeBlendedAttemptsPerHourFromState(state, { toNumber: safeNumFn });

  const req = snap?.pace?.requiredAttemptsPerWeek ?? weeklyContext?.attemptsPerWeek ?? null;
  let ratio = snap?.pace?.ratio ?? null;
  if ((ratio == null || !Number.isFinite(ratio)) && req != null && Number.isFinite(req) && req > 0){
    ratio = sumAttempts / req;
  }

  const flags = [];
  const tol = 0.90;
  if (assumedCR != null && Number.isFinite(actualCR) && actualCR < assumedCR * tol) flags.push("contact rate below assumed");
  if (assumedSR != null && Number.isFinite(actualSR) && actualSR < assumedSR * tol) flags.push("support rate below assumed");
  if (expectedAPH != null && Number.isFinite(actualAPH) && actualAPH < expectedAPH * tol) flags.push("productivity below assumed");

  let status = "Needs inputs";
  if (ratio == null || !Number.isFinite(ratio)){
    status = flags.length ? "Assumptions drifting" : "Needs inputs";
  } else if (ratio >= 1.0 && flags.length === 0){
    status = "On pace";
  } else if (ratio >= 1.0 && flags.length){
    status = "On pace (assumptions off)";
  } else if (ratio >= 0.85 && flags.length === 0){
    status = "Slightly behind";
  } else if (ratio >= 0.85 && flags.length){
    status = "Behind (rates/capacity off)";
  } else {
    status = "Behind";
  }

  return {
    lastUpdate: String(last?.date || "—"),
    freshNote: flags.length ? `Reality check: ${flags.join(", ")}` : "Using state.ui.dailyLog",
    rollingAttempts: formatInt(sumAttempts),
    rollingNote: (req == null || !Number.isFinite(req))
      ? "Required attempts/week unavailable under current inputs"
      : `Required ≈ ${formatInt(req, { ceil: true })} attempts/week`,
    rollingCR: formatPct(actualCR),
    rollingCRNote: (assumedCR == null) ? "Assumed: —" : `Assumed: ${formatPct(assumedCR)}`,
    rollingSR: formatPct(actualSR),
    rollingSRNote: (assumedSR == null) ? "Assumed: —" : `Assumed: ${formatPct(assumedSR)}`,
    rollingAPH: formatNum1(actualAPH),
    rollingAPHNote: (expectedAPH == null) ? "Expected: —" : `Expected: ${formatNum1(expectedAPH)} / hr`,
    status,
  };
}

/**
 * @param {{
 *   weeklyContext?: Record<string, any> | null,
 *   executionSnapshot?: Record<string, any> | null,
 *   computeCapacityBreakdownFn?: (args: Record<string, any>) => { total?: number | null } | null | undefined,
 *   clampFn?: (value: number, min: number, max: number) => number,
 *   computeRealityDriftFn?: () => { hasLog?: boolean, flags?: unknown[], primary?: string | null } | null | undefined,
 *   formatInt?: (value: number|null|undefined, options?: { ceil?: boolean, floor?: boolean }) => string | null | undefined,
 *   formatNum1?: (value: number|null|undefined) => string | null | undefined,
 * }} args
 * @returns {{
 *   intro: string,
 *   foot: string,
 *   bestMovesIntro: string,
 *   showBestMoves: boolean,
 *   bestMoves: Array<{ id: string, text: string, lever: Record<string, any> }>,
 *   rows: Array<{ id: string, label: string, impact: string, costUnit: string, efficiency: string, lever: Record<string, any> }>,
 *   actions: string[],
 *   actionsNote: string,
 * }}
 */
export function buildReachLeversAndActionsView(args = {}){
  const opsCtx = (args?.weeklyContext && typeof args.weeklyContext === "object") ? args.weeklyContext : {};
  const executionSnapshot = (args?.executionSnapshot && typeof args.executionSnapshot === "object") ? args.executionSnapshot : null;
  const computeCapacityBreakdownFn = (typeof args?.computeCapacityBreakdownFn === "function")
    ? args.computeCapacityBreakdownFn
    : () => null;
  const clampFn = (typeof args?.clampFn === "function") ? args.clampFn : clampNumber;
  const computeRealityDriftFn = (typeof args?.computeRealityDriftFn === "function") ? args.computeRealityDriftFn : () => null;
  const formatInt = resolveFormatInt(args?.formatInt);
  const formatNum1 = (typeof args?.formatNum1 === "function")
    ? (value) => {
      try{
        const out = args.formatNum1(value);
        if (out != null && String(out).trim()) return String(out);
      } catch {
        // Fall through to fallback.
      }
      return formatFixedNumber(value, 1);
    }
    : (value) => formatFixedNumber(value, 1);
  const fmtCeil = (value) => formatInt(value, { ceil: true });

  const base = {
    intro: "",
    foot: "",
    bestMovesIntro: "Best 3 moves — impact per unit:",
    showBestMoves: true,
    bestMoves: [],
    rows: [],
    actions: [],
    actionsNote: "Recommendations are based on current model inputs.",
  };

  if ((opsCtx.goal ?? 0) <= 0){
    return {
      ...base,
      intro: "No operational gap to analyze (goal is 0 under current inputs).",
      showBestMoves: false,
      actions: ["Set a goal (Support IDs needed) or adjust win path assumptions to generate a real plan."],
      foot: "",
    };
  }
  if (opsCtx.weeks == null || opsCtx.weeks <= 0){
    return {
      ...base,
      intro: "Timeline is missing. Set election date or weeks remaining to compute weekly pressure.",
      showBestMoves: false,
      actions: ["Enter an election date (or weeks remaining) so the plan can compute per-week targets."],
      foot: "",
    };
  }
  if (opsCtx.sr == null || opsCtx.sr <= 0 || opsCtx.cr == null || opsCtx.cr <= 0){
    return {
      ...base,
      intro: "Rates are missing. Enter Support rate and Contact rate to estimate workload.",
      showBestMoves: false,
      actions: ["Fill Support rate (%) and Contact rate (%) to compute realistic workload."],
      foot: "",
    };
  }
  if (opsCtx.capTotal == null || !Number.isFinite(opsCtx.capTotal)){
    return {
      ...base,
      intro: "Capacity inputs are incomplete. Fill execution inputs to compute what is executable.",
      showBestMoves: false,
      actions: ["Enter organizers, hours/week, doors/hr, calls/hr, and channel split."],
      foot: "",
    };
  }

  const baseReq = toFiniteNumber(opsCtx.attemptsPerWeek);
  const baseCap = toFiniteNumber(opsCtx.capTotal);
  const gap = (baseReq != null && baseCap != null) ? Math.max(0, baseReq - baseCap) : null;
  const isGap = !!(gap != null && gap > 0);
  const intro = isGap
    ? `You are short by ~${fmtCeil(gap)} attempts/week. These levers estimate attempts/week relief in consistent units.`
    : "You are currently feasible (capacity covers attempts/week). These levers estimate buffer gained per unit.";

  const capTotal = (payload) => {
    const out = computeCapacityBreakdownFn(payload);
    const total = toFiniteNumber(out?.total);
    return total;
  };

  const levers = [];
  const pushLever = (lever) => {
    if (!lever) return;
    if (lever.impact == null || !Number.isFinite(lever.impact) || lever.impact <= 0) return;
    const impactUse = isGap ? Math.min(lever.impact, gap) : lever.impact;
    const eff = (lever.costScalar != null && Number.isFinite(lever.costScalar) && lever.costScalar > 0) ? (impactUse / lever.costScalar) : null;
    levers.push({ ...lever, impactUse, eff });
  };

  const baseCapParams = {
    weeks: 1,
    orgCount: opsCtx.orgCount,
    orgHoursPerWeek: opsCtx.orgHoursPerWeek,
    volunteerMult: opsCtx.volunteerMult,
    doorShare: opsCtx.doorShare,
    doorsPerHour: opsCtx.doorsPerHour,
    callsPerHour: opsCtx.callsPerHour,
    capacityDecay: opsCtx.capacityDecay,
  };

  if (opsCtx.orgCount != null && opsCtx.orgHoursPerWeek != null && opsCtx.volunteerMult != null){
    const plusOrg = capTotal({ ...baseCapParams, orgCount: opsCtx.orgCount + 1 });
    if (plusOrg != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "org",
        label: "+1 organizer",
        impact: plusOrg - baseCap,
        costLabel: "1 organizer",
        costScalar: 1,
        effUnit: "per organizer",
      });
    }

    const plusHr = capTotal({ ...baseCapParams, orgHoursPerWeek: opsCtx.orgHoursPerWeek + 1 });
    if (plusHr != null && baseCap != null){
      const addedHours = Math.max(1, opsCtx.orgCount || 1);
      pushLever({
        kind: "capacity",
        key: "orgHr",
        label: "+1 hour/week per organizer",
        impact: plusHr - baseCap,
        costLabel: `+1 hr/org (= ${fmtCeil(addedHours)} org-hrs/wk)`,
        costScalar: addedHours,
        effUnit: "per org-hour",
      });
    }

    const plusVol = capTotal({ ...baseCapParams, volunteerMult: opsCtx.volunteerMult + 0.10 });
    if (plusVol != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "volMult",
        label: "+10% volunteer multiplier",
        impact: plusVol - baseCap,
        costLabel: "+10% volunteer mult",
        costScalar: 0.10,
        effUnit: "per +10% mult",
      });
    }
  }

  if (opsCtx.doorsPerHour != null){
    const plusDoorHr = capTotal({ ...baseCapParams, doorsPerHour: opsCtx.doorsPerHour + 1 });
    if (plusDoorHr != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "dph",
        label: "+1 door/hr",
        impact: plusDoorHr - baseCap,
        costLabel: "+1 door/hr",
        costScalar: 1,
        effUnit: "per +1 door/hr",
      });
    }
  }

  if (opsCtx.callsPerHour != null){
    const plusCallHr = capTotal({ ...baseCapParams, callsPerHour: opsCtx.callsPerHour + 1 });
    if (plusCallHr != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "cph",
        label: "+1 call/hr",
        impact: plusCallHr - baseCap,
        costLabel: "+1 call/hr",
        costScalar: 1,
        effUnit: "per +1 call/hr",
      });
    }
  }

  if (opsCtx.doorShare != null && opsCtx.doorsPerHour != null && opsCtx.callsPerHour != null){
    const doorIsFaster = opsCtx.doorsPerHour >= opsCtx.callsPerHour;
    const shift = 0.10;
    const nextShare = clampFn(opsCtx.doorShare + (doorIsFaster ? shift : -shift), 0, 1);
    const capShift = capTotal({ ...baseCapParams, doorShare: nextShare });
    if (capShift != null && baseCap != null){
      pushLever({
        kind: "capacity",
        key: "mix",
        label: `Shift mix +10 pts toward ${doorIsFaster ? "doors" : "calls"}`,
        impact: capShift - baseCap,
        costLabel: "10 pts mix shift",
        costScalar: 10,
        effUnit: "per 1 pt",
      });
    }
  }

  const pp = 0.01;
  if (baseReq != null && Number.isFinite(baseReq)){
    const srPlus = Math.min(0.99, opsCtx.sr + pp);
    const crPlus = Math.min(0.99, opsCtx.cr + pp);

    const reqSrPlus = computeGoalPaceRequirements({
      goalVotes: opsCtx.goal,
      supportRate: srPlus,
      contactRate: opsCtx.cr,
      weeks: opsCtx.weeks,
    }).attemptsPerWeek;
    if (reqSrPlus != null){
      pushLever({
        kind: "rates",
        key: "sr",
        label: "+1 pp support rate",
        impact: baseReq - reqSrPlus,
        costLabel: "+1 pp SR",
        costScalar: 1,
        effUnit: "per +1pp",
      });
    }

    const reqCrPlus = computeGoalPaceRequirements({
      goalVotes: opsCtx.goal,
      supportRate: opsCtx.sr,
      contactRate: crPlus,
      weeks: opsCtx.weeks,
    }).attemptsPerWeek;
    if (reqCrPlus != null){
      pushLever({
        kind: "rates",
        key: "cr",
        label: "+1 pp contact rate",
        impact: baseReq - reqCrPlus,
        costLabel: "+1 pp CR",
        costScalar: 1,
        effUnit: "per +1pp",
      });
    }

    const wPlus = opsCtx.weeks + 1;
    const reqWPlus = computeGoalPaceRequirements({
      goalVotes: opsCtx.goal,
      supportRate: opsCtx.sr,
      contactRate: opsCtx.cr,
      weeks: wPlus,
    }).attemptsPerWeek;
    if (reqWPlus != null){
      pushLever({
        kind: "timeline",
        key: "weeks",
        label: "+1 week timeline",
        impact: baseReq - reqWPlus,
        costLabel: "+1 week",
        costScalar: 1,
        effUnit: "per week",
      });
    }
  }

  const usable = levers
    .filter((lever) => lever.impactUse != null && Number.isFinite(lever.impactUse) && lever.impactUse > 0)
    .sort((a, b) => (b.impactUse - a.impactUse));

  if (!usable.length){
    return {
      ...base,
      intro,
      showBestMoves: false,
      actions: ["No lever estimates available under current inputs."],
      foot: "",
    };
  }

  const bestByEff = [...usable]
    .filter((lever) => lever.eff != null && Number.isFinite(lever.eff))
    .sort((a, b) => (b.eff - a.eff) || (b.impactUse - a.impactUse))
    .slice(0, 3);

  const rows = usable.slice(0, 10);
  const bestCap = usable.filter((lever) => lever.kind === "capacity").sort((a, b) => (b.impactUse - a.impactUse))[0] || null;
  const bestRate = usable.filter((lever) => lever.kind === "rates").sort((a, b) => (b.impactUse - a.impactUse))[0] || null;
  const bestCr = usable.find((lever) => lever.kind === "rates" && lever.key === "cr") || null;
  const bestSr = usable.find((lever) => lever.kind === "rates" && lever.key === "sr") || null;

  const drift = executionSnapshot
    ? {
      hasLog: !!executionSnapshot?.log?.hasLog,
      flags: Array.isArray(executionSnapshot?.drift?.flags) ? executionSnapshot.drift.flags : [],
      primary: executionSnapshot?.drift?.primary || null,
    }
    : computeRealityDriftFn();
  const hasDrift = !!(drift?.hasLog && drift?.flags?.length);
  const primary = drift?.primary || null;

  const actions = [];
  if (isGap){
    if (hasDrift){
      if (primary === "productivity"){
        if (bestCap) actions.push(`Reality check shows productivity below assumed. Close the gap by raising execution capacity first: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
        if (bestCr) actions.push(`Then reduce workload by improving contact rate: ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week relief).`);
        else if (bestRate) actions.push(`Then reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      } else if (primary === "contact"){
        if (bestCr) actions.push(`Reality check shows contact rate below assumed. Prioritize: ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week relief).`);
        if (bestCap) actions.push(`If rate lift is slow, backstop with more capacity: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      } else if (primary === "support"){
        if (bestSr) actions.push(`Reality check shows support rate below assumed. Prioritize: ${bestSr.label} (≈ ${fmtCeil(bestSr.impactUse)} attempts/week relief).`);
        if (bestCap) actions.push(`If persuasion lift is slow, backstop with more capacity: ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      } else {
        if (bestCap) actions.push(`Close the gap by increasing execution capacity: start with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
        if (bestRate) actions.push(`Reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      }
      actions.push("If actual performance stays below assumptions, either align assumptions to reality (and re-plan) or change inputs to close the gap (capacity, speeds, mix, training).");
    } else {
      if (bestCap) actions.push(`Close the gap by increasing execution capacity: start with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week relief).`);
      if (bestRate) actions.push(`Reduce workload by improving rates: ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week relief).`);
      actions.push("If neither is realistic, reduce weekly pressure by extending timeline assumptions (more weeks) or revising the goal (Support IDs needed).");
    }
  } else {
    if (hasDrift){
      if (primary === "productivity" && bestCap) actions.push(`You are feasible, but productivity is below assumed. Add buffer with ${bestCap.label} (≈ ${fmtCeil(bestCap.impactUse)} attempts/week).`);
      if (primary === "contact" && bestCr) actions.push(`You are feasible, but contact rate is below assumed. Improve efficiency with ${bestCr.label} (≈ ${fmtCeil(bestCr.impactUse)} attempts/week).`);
      if (primary === "support" && bestSr) actions.push(`You are feasible, but support rate is below assumed. Improve efficiency with ${bestSr.label} (≈ ${fmtCeil(bestSr.impactUse)} attempts/week).`);
      if (!actions.length && bestRate) actions.push(`You are feasible, but assumptions are drifting. Consider ${bestRate.label} (≈ ${fmtCeil(bestRate.impactUse)} attempts/week).`);
      actions.push("Use buffer to absorb volatility, and align assumptions to observed daily log so planning stays honest.");
    } else {
      if (bestCap) actions.push(`Build buffer: ${bestCap.label} adds ≈ ${fmtCeil(bestCap.impactUse)} attempts/week of slack.`);
      if (bestRate) actions.push(`Improve efficiency: ${bestRate.label} reduces required attempts by ≈ ${fmtCeil(bestRate.impactUse)} attempts/week.`);
      actions.push("Use the buffer to absorb volatility (bad weeks, weather, volunteer drop-off) or to front-load early vote chasing.");
    }
  }

  return {
    ...base,
    intro,
    foot: isGap
      ? "Impact estimates are local and directional; apply changes one at a time and verify updated weekly gap."
      : "Use this as a buffer-building guide; apply changes one at a time and keep assumptions auditable.",
    bestMoves: bestByEff.map((lever) => ({
      id: `${lever.kind}:${lever.key}`,
      text: `${lever.label}: ~${fmtCeil(lever.impactUse)} attempts/week (${formatNum1(lever.eff)} ${lever.effUnit})`,
      lever,
    })),
    rows: rows.map((lever) => ({
      id: `${lever.kind}:${lever.key}`,
      label: lever.label,
      impact: `~${fmtCeil(lever.impactUse)}`,
      costUnit: lever.costLabel || "—",
      efficiency: (lever.eff == null || !Number.isFinite(lever.eff)) ? "—" : formatNum1(lever.eff),
      lever,
    })),
    actions: actions.slice(0, 4),
    actionsNote: hasDrift
      ? "Recommendations include reality-drift signals from recent organizer logs."
      : "Recommendations are model-based. Add organizer logs to activate drift-aware recommendations.",
  };
}

/**
 * @param {Record<string, any> | null | undefined} weekly
 * @returns {string}
 */
export function deriveReachWeeklyCardStatus(weekly){
  const pace = String(weekly?.paceStatus || "").trim();
  if (!pace || pace === "—" || /needs inputs/i.test(pace)){
    return REACH_STATUS_AWAITING_INPUTS;
  }
  if (/behind/i.test(pace)){
    return "Gap open";
  }
  if (/pace|feasible/i.test(pace)){
    return "Feasible";
  }
  return pace;
}

/**
 * @param {Record<string, any> | null | undefined} levers
 * @param {Record<string, any> | null | undefined} weekly
 * @returns {string}
 */
export function deriveReachLeversCardStatus(levers, weekly){
  const hasLevers = Array.isArray(levers?.rows) && levers.rows.length > 0;
  if (!hasLevers){
    return REACH_STATUS_AWAITING_INPUTS;
  }
  const pace = String(weekly?.paceStatus || "").trim();
  if (/behind/i.test(pace)){
    return "Gap focus";
  }
  if (/pace|feasible/i.test(pace)){
    return "Buffer mode";
  }
  return "Active";
}

/**
 * @param {Record<string, any> | null | undefined} actions
 * @returns {string}
 */
export function deriveReachActionsCardStatus(actions){
  const note = String(actions?.note || "").trim();
  const list = Array.isArray(actions?.list) ? actions.list : [];
  if (!list.length){
    return REACH_STATUS_AWAITING_INPUTS;
  }
  if (/drift-aware/i.test(note)){
    return "Drift-aware";
  }
  if (/model-based/i.test(note)){
    return "Model-based";
  }
  return "Active";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyReachStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (
    /(on pace|feasible|buffer mode|ready|healthy|stable|complete|active|model-based)/.test(lower)
  ){
    return "ok";
  }
  if (/(behind|gap open|unavailable|missing|incomplete|failed|broken)/.test(lower)){
    return "bad";
  }
  if (/(awaiting|drift|needs|warning|risk|pending|override|gap focus)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
