// @ts-check
import { formatFixedNumber, formatWholeNumber, roundWholeNumberByMode } from "./utils.js";
import { classifyUnifiedStatusTone } from "./statusTone.js";
import { formatOfficeContextLabel } from "./officeContextLabels.js";

export const SCENARIO_STATUS_UNAVAILABLE = "Unavailable";
export const SCENARIO_STATUS_AWAITING_SCENARIO = "Awaiting scenario";
export const SCENARIO_COMPARE_MODE_DISABLED_TEXT = "Select a non-baseline active scenario to view differences.";
export const SCENARIO_ACTIVE_LABEL_FALLBACK = "Active Scenario: —";
export const SCENARIO_STORAGE_STATUS_SESSION_ONLY =
  "Scenario records are session-only (in-memory) and capped to keep comparisons fast and deterministic.";

const DEFAULT_OUTPUT_DIFF_LIMIT = 24;
const DEFAULT_INPUT_DIFF_LIMIT = 12;
const DEFAULT_FLATTEN_LIMIT = 1200;
const LEGACY_INPUT_DIFF_MAX_SHOW = 12;
const LEGACY_INPUT_KEY_ORDER = Object.freeze([
  "raceType","mode","electionDate","weeksRemaining",
  "universeBasis","universeSize",
  "goalSupportIds","supportRatePct","contactRatePct","turnoutReliabilityPct",
  "universeLayerEnabled","universeDemPct","universeRepPct","universeNpaPct","universeOtherPct","retentionFactor",
  "orgCount","orgHoursPerWeek","volunteerMultBase","channelDoorPct","doorsPerHour3","callsPerHour3",
  "timelineEnabled","timelineStaffCount","timelineVolCount","timelineStaffHours","timelineVolHours","timelineDoorsPerHour","timelineCallsPerHour","timelineTextsPerHour","timelineDoorSharePct","timelineActiveWeeks","timelineGotvWeeks",
]);
const LEGACY_INPUT_LABELS = Object.freeze({
  raceType: "Race type",
  mode: "Mode",
  electionDate: "Election date",
  weeksRemaining: "Weeks remaining override",
  universeBasis: "Universe basis",
  universeSize: "Universe size",
  goalSupportIds: "Goal support IDs",
  supportRatePct: "Support rate (%)",
  contactRatePct: "Contact rate (%)",
  turnoutReliabilityPct: "Turnout reliability (%)",
  universeLayerEnabled: "Universe layer enabled",
  universeDemPct: "Universe Dem (%)",
  universeRepPct: "Universe Rep (%)",
  universeNpaPct: "Universe NPA (%)",
  universeOtherPct: "Universe Other (%)",
  retentionFactor: "Retention factor",
  orgCount: "Organizers",
  orgHoursPerWeek: "Org hours/week",
  volunteerMultBase: "Volunteer multiplier",
  channelDoorPct: "Door share (%)",
  doorsPerHour3: "Doors/hour",
  callsPerHour3: "Calls/hour",
  timelineEnabled: "Timeline enabled",
  timelineStaffCount: "Timeline staff",
  timelineVolCount: "Timeline volunteers",
  timelineStaffHours: "Staff hours/week",
  timelineVolHours: "Volunteer hours/week",
  timelineDoorsPerHour: "Timeline doors/hour",
  timelineCallsPerHour: "Timeline calls/hour",
  timelineTextsPerHour: "Timeline texts/hour",
  timelineDoorSharePct: "Timeline door share (%)",
  timelineActiveWeeks: "Timeline active weeks",
  timelineGotvWeeks: "GOTV window (weeks)",
});

/**
 * @param {{
 *   activeScenario?: { id?: string, name?: string } | null,
 *   activeScenarioId?: string | null,
 *   count?: number | null,
 *   max?: number | null,
 * }} input
 * @returns {{ activeLabel: string, warning: string, storageStatus: string }}
 */
export function buildScenarioWorkspaceSummaryView({
  activeScenario = null,
  activeScenarioId = "",
  count = 0,
  max = 0,
} = {}){
  const activeName = String(activeScenario?.name || activeScenario?.id || activeScenarioId || "").trim();
  const scenarioCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  const maxScenarios = Number.isFinite(Number(max)) ? Math.max(0, Number(max)) : 0;
  return {
    activeLabel: activeName ? `Active Scenario: ${activeName}` : SCENARIO_ACTIVE_LABEL_FALLBACK,
    warning:
      maxScenarios > 0 && scenarioCount > maxScenarios
        ? `Scenario limit exceeded (${scenarioCount}/${maxScenarios}). Delete scenarios to stay under the cap.`
        : "",
    storageStatus: SCENARIO_STORAGE_STATUS_SESSION_ONLY,
  };
}

/**
 * @param {{
 *   baselineInputs: Record<string, any> | null | undefined,
 *   activeInputs: Record<string, any> | null | undefined,
 *   maxShow?: number,
 * }} input
 * @returns {{
 *   items: Array<{ key: string, label: string, beforeText: string, afterText: string, text: string }>,
 *   diffKeyCount: number,
 *   otherChangedCount: number,
 *   remainingCount: number,
 *   totalChanged: number,
 * }}
 */
export function buildLegacyScenarioInputDiffSummary({
  baselineInputs,
  activeInputs,
  maxShow = LEGACY_INPUT_DIFF_MAX_SHOW,
} = {}){
  const base = baselineInputs && typeof baselineInputs === "object" ? baselineInputs : {};
  const active = activeInputs && typeof activeInputs === "object" ? activeInputs : {};
  const visible = Number.isFinite(Number(maxShow)) ? Math.max(1, Number(maxShow)) : LEGACY_INPUT_DIFF_MAX_SHOW;
  const seen = new Set();
  const diffKeys = [];

  for (const key of LEGACY_INPUT_KEY_ORDER){
    seen.add(key);
    if (!legacyValuesEqual(base[key], active[key])){
      diffKeys.push(key);
    }
  }

  const otherKeys = Array.from(new Set([...Object.keys(base), ...Object.keys(active)]))
    .filter((key) => !seen.has(key) && key !== "ui" && key !== "mcLast" && key !== "mcLastHash");
  const otherChangedKeys = otherKeys.filter((key) => !legacyValuesEqual(base[key], active[key]));

  const shownKeys = diffKeys.slice(0, visible);
  const items = shownKeys.map((key) => {
    const label = LEGACY_INPUT_LABELS[key] || key;
    const beforeText = formatLegacyScenarioInputValue(key, base[key]);
    const afterText = formatLegacyScenarioInputValue(key, active[key]);
    return {
      key,
      label,
      beforeText,
      afterText,
      text: `${beforeText} → ${afterText}`,
    };
  });

  const remainingCount = Math.max(0, (diffKeys.length - shownKeys.length) + otherChangedKeys.length);
  return {
    items,
    diffKeyCount: diffKeys.length,
    otherChangedCount: otherChangedKeys.length,
    remainingCount,
    totalChanged: diffKeys.length + otherChangedKeys.length,
  };
}

/**
 * @param {{
 *   baseline: { attemptsPerWeek?: number|null, convosPerWeek?: number|null, finishDate?: Date|null, paceFinishDate?: Date|null } | null | undefined,
 *   active: { attemptsPerWeek?: number|null, convosPerWeek?: number|null, finishDate?: Date|null, paceFinishDate?: Date|null } | null | undefined,
 *   formatInt?: ((value: number) => string) | null,
 *   formatDate?: ((date: Date) => string) | null,
 * }} input
 * @returns {{
 *   rows: Array<{ label: string, baselineText: string, activeText: string, deltaText: string, kind: "ok"|"bad"|null }>,
 *   attemptsDelta: number | null,
 * }}
 */
export function buildLegacyScenarioOutputDiffRows({
  baseline,
  active,
  formatInt = null,
  formatDate = null,
} = {}){
  const base = baseline && typeof baseline === "object" ? baseline : {};
  const act = active && typeof active === "object" ? active : {};
  const fmtInt = typeof formatInt === "function"
    ? formatInt
    : (value) => {
      const rounded = roundWholeNumberByMode(value, { mode: "round", fallback: 0 });
      return Number(rounded).toLocaleString();
    };
  const fmtDate = typeof formatDate === "function"
    ? formatDate
    : (date) => date.toISOString().slice(0, 10);

  const formatWhole = (value) => {
    const rounded = roundWholeNumberByMode(value, { mode: "ceil", fallback: null });
    return rounded == null ? "—" : fmtInt(rounded);
  };
  const formatDateText = (date) => (date instanceof Date) ? fmtDate(date) : "—";
  const formatDeltaNumber = (delta) => {
    if (delta == null || !Number.isFinite(delta) || delta === 0){
      return "—";
    }
    const rounded = roundWholeNumberByMode(delta, { mode: "round", fallback: null });
    if (rounded == null) return "—";
    return delta > 0 ? `+${fmtInt(rounded)}` : `${fmtInt(rounded)}`;
  };
  const formatDeltaDays = (baseDate, activeDate) => {
    if (!(baseDate instanceof Date) || !(activeDate instanceof Date)){
      return "—";
    }
    const baseTime = baseDate.getTime();
    const activeTime = activeDate.getTime();
    if (!Number.isFinite(baseTime) || !Number.isFinite(activeTime)){
      return "—";
    }
    const days = roundWholeNumberByMode((activeTime - baseTime) / (24 * 3600 * 1000), { mode: "round", fallback: null });
    if (!Number.isFinite(days) || days === 0){
      return "—";
    }
    return days > 0 ? `+${fmtInt(days)}d` : `${fmtInt(days)}d`;
  };
  const numberKindLowerIsBetter = (delta) => {
    if (delta == null || !Number.isFinite(delta) || delta === 0){
      return null;
    }
    return delta < 0 ? "ok" : "bad";
  };
  const dateKindEarlierIsBetter = (baseDate, activeDate) => {
    if (!(baseDate instanceof Date) || !(activeDate instanceof Date)){
      return null;
    }
    const baseTime = baseDate.getTime();
    const activeTime = activeDate.getTime();
    if (!Number.isFinite(baseTime) || !Number.isFinite(activeTime) || baseTime === activeTime){
      return null;
    }
    return activeTime < baseTime ? "ok" : "bad";
  };

  const attemptsDelta = (base.attemptsPerWeek != null && act.attemptsPerWeek != null)
    ? (Number(act.attemptsPerWeek) - Number(base.attemptsPerWeek))
    : null;
  const convosDelta = (base.convosPerWeek != null && act.convosPerWeek != null)
    ? (Number(act.convosPerWeek) - Number(base.convosPerWeek))
    : null;
  const finishBase = base.finishDate instanceof Date ? base.finishDate : null;
  const finishAct = act.finishDate instanceof Date ? act.finishDate : null;
  const paceBase = base.paceFinishDate instanceof Date ? base.paceFinishDate : null;
  const paceAct = act.paceFinishDate instanceof Date ? act.paceFinishDate : null;

  return {
    rows: [
      {
        label: "Attempts/week",
        baselineText: formatWhole(base.attemptsPerWeek),
        activeText: formatWhole(act.attemptsPerWeek),
        deltaText: formatDeltaNumber(attemptsDelta),
        kind: numberKindLowerIsBetter(attemptsDelta),
      },
      {
        label: "Convos/week",
        baselineText: formatWhole(base.convosPerWeek),
        activeText: formatWhole(act.convosPerWeek),
        deltaText: formatDeltaNumber(convosDelta),
        kind: numberKindLowerIsBetter(convosDelta),
      },
      {
        label: "Finish date",
        baselineText: formatDateText(finishBase),
        activeText: formatDateText(finishAct),
        deltaText: formatDeltaDays(finishBase, finishAct),
        kind: dateKindEarlierIsBetter(finishBase, finishAct),
      },
      {
        label: "Pace finish (attempts)",
        baselineText: formatDateText(paceBase),
        activeText: formatDateText(paceAct),
        deltaText: formatDeltaDays(paceBase, paceAct),
        kind: dateKindEarlierIsBetter(paceBase, paceAct),
      },
    ],
    attemptsDelta: (attemptsDelta != null && Number.isFinite(attemptsDelta)) ? attemptsDelta : null,
  };
}

/**
 * @param {unknown} lastLogSummary
 * @returns {number | null}
 */
export function computeLegacyScenarioPaceAttemptsPerDay(lastLogSummary){
  const summary = lastLogSummary && typeof lastLogSummary === "object" ? lastLogSummary : {};
  const hasLog = !!summary?.hasLog;
  const days = Number(summary?.days);
  const sumAttempts = Number(summary?.sumAttempts);
  if (!hasLog || !Number.isFinite(days) || days <= 0 || !Number.isFinite(sumAttempts)){
    return null;
  }
  return sumAttempts / days;
}

/**
 * Canonical key-output projection for legacy scenario comparison surfaces.
 * Keeps pace/day and pace-finish derivation out of render modules.
 *
 * @param {{
 *   coreOutput?: Record<string, any> | null | undefined,
 *   lastLogSummary?: Record<string, any> | null | undefined,
 *   paceFinishDateFn?: ((attemptsNeeded: unknown, attemptsPerDay: number | null) => Date | null | undefined) | null,
 * }} input
 * @returns {{
 *   attemptsPerWeek: number | null,
 *   convosPerWeek: number | null,
 *   finishDate: Date | null,
 *   paceFinishDate: Date | null,
 *   paceAttemptsPerDay: number | null,
 * }}
 */
export function buildLegacyScenarioComparisonKeyOutput({
  coreOutput = null,
  lastLogSummary = null,
  paceFinishDateFn = null,
} = {}){
  const core = coreOutput && typeof coreOutput === "object" ? coreOutput : {};
  const ctx = core?.ctx && typeof core.ctx === "object" ? core.ctx : {};
  const paceAttemptsPerDay = computeLegacyScenarioPaceAttemptsPerDay(lastLogSummary);
  const paceFinishDateRaw = (typeof paceFinishDateFn === "function")
    ? paceFinishDateFn(ctx?.attemptsNeeded ?? null, paceAttemptsPerDay)
    : null;
  const finishDate = core?.finish instanceof Date ? core.finish : null;
  const paceFinishDate = paceFinishDateRaw instanceof Date ? paceFinishDateRaw : null;
  const attemptsPerWeek = Number(ctx?.attemptsPerWeek);
  const convosPerWeek = Number(ctx?.convosPerWeek);
  return {
    attemptsPerWeek: Number.isFinite(attemptsPerWeek) ? attemptsPerWeek : null,
    convosPerWeek: Number.isFinite(convosPerWeek) ? convosPerWeek : null,
    finishDate,
    paceFinishDate,
    paceAttemptsPerDay,
  };
}

/**
 * @param {{
 *   baselineInputs: Record<string, any> | null | undefined,
 *   activeInputs: Record<string, any> | null | undefined,
 *   labels?: Record<string, string> | null | undefined,
 *   ignoreKeys?: string[] | null | undefined,
 * }} input
 * @returns {Array<{ key: string, label: string, base: unknown, active: unknown }>}
 */
export function buildScenarioInputChangeRows({
  baselineInputs,
  activeInputs,
  labels = null,
  ignoreKeys = null,
} = {}){
  const base = baselineInputs && typeof baselineInputs === "object" ? baselineInputs : {};
  const active = activeInputs && typeof activeInputs === "object" ? activeInputs : {};
  const labelMap = labels && typeof labels === "object" ? labels : {};
  const ignore = new Set(
    Array.isArray(ignoreKeys) && ignoreKeys.length
      ? ignoreKeys.map((key) => String(key || ""))
      : ["ui", "mcLast", "mcLastHash"],
  );
  const keys = new Set([...Object.keys(base), ...Object.keys(active)]);
  const changed = [];
  for (const key of keys){
    if (ignore.has(key)) continue;
    const before = base[key];
    const after = active[key];
    if (legacyValuesEqual(before, after)) continue;
    changed.push({
      key,
      label: String(labelMap[key] || key),
      base: before,
      active: after,
    });
  }
  changed.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return changed;
}

/**
 * @param {{ totalChanged: number, attemptsDelta: number | null | undefined }} input
 * @returns {{ kind: "ok"|"bad"|null, text: string }}
 */
export function deriveLegacyScenarioCompareTag({ totalChanged, attemptsDelta } = {}){
  const changed = Number.isFinite(Number(totalChanged)) ? Math.max(0, Number(totalChanged)) : 0;
  const delta = Number(attemptsDelta);
  const kind = (!Number.isFinite(delta) || delta === 0) ? null : (delta < 0 ? "ok" : "bad");
  return {
    kind,
    text: `${changed} input change(s)`,
  };
}

/**
 * @param {{
 *   baselineInputs: Record<string, any> | null | undefined,
 *   activeInputs: Record<string, any> | null | undefined,
 *   lowThreshold?: number,
 *   moderateThreshold?: number,
 * }} input
 * @returns {{ cls: "ok"|"warn"|"bad", label: "Low"|"Moderate"|"High", diffCount: number }}
 */
export function deriveLegacyScenarioDivergence({
  baselineInputs,
  activeInputs,
  lowThreshold = 3,
  moderateThreshold = 8,
} = {}){
  const summary = buildLegacyScenarioInputDiffSummary({
    baselineInputs,
    activeInputs,
  });
  const low = Number.isFinite(Number(lowThreshold)) ? Math.max(0, Number(lowThreshold)) : 3;
  const moderate = Number.isFinite(Number(moderateThreshold))
    ? Math.max(low, Number(moderateThreshold))
    : 8;
  const diff = Number(summary?.diffKeyCount || 0);
  if (diff <= low){
    return { cls: "ok", label: "Low", diffCount: diff };
  }
  if (diff <= moderate){
    return { cls: "warn", label: "Moderate", diffCount: diff };
  }
  return { cls: "bad", label: "High", diffCount: diff };
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @param {{ outputDiffLimit?: number, inputDiffLimit?: number, flattenLimit?: number }=} options
 * @returns {{
 *   modeText: string,
 *   tag: string,
 *   inputDiffCount: number,
 *   outputDiffCount: number,
 *   inputDiffs: string[],
 *   outputDiffs: Array<{ metric: string, baseline: string, scenario: string, delta: string }>,
 *   inputDiffFoot: string,
 * }}
 */
export function buildScenarioComparisonView(view, options = {}){
  const baseline = view?.baseline || null;
  const active = view?.active || null;
  const baselineId = String(view?.baselineId || "baseline");
  const compareEnabled = !!baseline && !!active && String(active.id || "") !== baselineId;
  const outputDiffLimit = Number.isFinite(Number(options.outputDiffLimit))
    ? Math.max(1, Number(options.outputDiffLimit))
    : DEFAULT_OUTPUT_DIFF_LIMIT;
  const inputDiffLimit = Number.isFinite(Number(options.inputDiffLimit))
    ? Math.max(1, Number(options.inputDiffLimit))
    : DEFAULT_INPUT_DIFF_LIMIT;
  const flattenLimit = Number.isFinite(Number(options.flattenLimit))
    ? Math.max(10, Number(options.flattenLimit))
    : DEFAULT_FLATTEN_LIMIT;

  if (!compareEnabled){
    return {
      modeText: SCENARIO_COMPARE_MODE_DISABLED_TEXT,
      tag: "—",
      inputDiffCount: 0,
      outputDiffCount: 0,
      inputDiffs: [],
      outputDiffs: [],
      inputDiffFoot: "",
    };
  }

  const inputDiffs = computeFlatDiffRows(baseline.inputs, active.inputs, flattenLimit);
  const outputDiffs = computeFlatDiffRows(baseline.outputs, active.outputs, flattenLimit);
  const outputRows = outputDiffs
    .sort((a, b) => b.sortScore - a.sortScore)
    .slice(0, outputDiffLimit)
    .map((row) => ({
      metric: row.metric,
      baseline: row.beforeText,
      scenario: row.afterText,
      delta: row.deltaText,
    }));

  return {
    modeText: "Comparing active scenario",
    tag: `${baseline.name || baseline.id} vs ${active.name || active.id}`,
    inputDiffCount: inputDiffs.length,
    outputDiffCount: outputRows.length,
    inputDiffs: inputDiffs.slice(0, inputDiffLimit).map((row) => row.text),
    outputDiffs: outputRows,
    inputDiffFoot:
      inputDiffs.length > inputDiffLimit
        ? `${inputDiffs.length} fields differ (${inputDiffLimit} shown).`
        : `${inputDiffs.length} fields differ.`,
  };
}

/**
 * @param {Record<string, any> | null | undefined} beforeObj
 * @param {Record<string, any> | null | undefined} afterObj
 * @param {number} flattenLimit
 * @returns {Array<{ metric: string, text: string, beforeText: string, afterText: string, deltaText: string, sortScore: number }>}
 */
function computeFlatDiffRows(beforeObj, afterObj, flattenLimit){
  const before = flattenObject(beforeObj, { flattenLimit });
  const after = flattenObject(afterObj, { flattenLimit });
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const rows = [];

  keys.forEach((key) => {
    const a = before[key];
    const b = after[key];
    if (areValuesEqual(a, b)){
      return;
    }

    const beforeText = formatValue(a);
    const afterText = formatValue(b);
    const delta = typeof a === "number" && typeof b === "number" ? b - a : Number.NaN;
    const deltaText = Number.isFinite(delta) ? formatDelta(delta) : "—";

    rows.push({
      metric: formatMetricKey(key),
      text: `${formatMetricKey(key)}: ${beforeText} -> ${afterText}`,
      beforeText,
      afterText,
      deltaText,
      sortScore: Number.isFinite(delta) ? Math.abs(delta) : 0,
    });
  });

  return rows;
}

/**
 * @param {unknown} value
 * @param {{ flattenLimit: number }} options
 * @param {string=} prefix
 * @param {Record<string, any>=} out
 * @param {{ n: number }=} count
 * @returns {Record<string, any>}
 */
function flattenObject(value, options, prefix = "", out = {}, count = { n: 0 }){
  if (count.n > options.flattenLimit){
    return out;
  }

  const pushLeaf = (leaf) => {
    out[prefix || "(root)"] = leaf;
    count.n += 1;
  };

  if (value === null || value === undefined){
    pushLeaf(value);
    return out;
  }

  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean"){
    pushLeaf(value);
    return out;
  }

  if (Array.isArray(value)){
    pushLeaf(`[${value.length} items]`);
    return out;
  }

  if (typeof value === "object"){
    const keys = Object.keys(value).sort();
    if (!keys.length){
      pushLeaf("{}");
      return out;
    }

    keys.forEach((key) => {
      if (count.n > options.flattenLimit){
        return;
      }
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObject(value[key], options, nextPrefix, out, count);
    });
    return out;
  }

  pushLeaf(String(value));
  return out;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function areValuesEqual(a, b){
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function legacyValuesEqual(a, b){
  return (a === b) || (String(a ?? "") === String(b ?? ""));
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {string}
 */
function formatLegacyScenarioInputValue(key, value){
  if (value == null){
    return "—";
  }
  if (typeof value === "boolean"){
    return value ? "On" : "Off";
  }
  if (typeof value === "number" && Number.isFinite(value)){
    if (key === "retentionFactor"){
      return formatFixedNumber(value, 2);
    }
    if (key.endsWith("Pct")){
      return String(value);
    }
    if (Math.abs(value) >= 1000){
      return formatWholeNumber(value);
    }
    return String(value);
  }
  if (typeof value === "string"){
    if (key === "raceType"){
      const label = formatOfficeContextLabel(value);
      return label || "—";
    }
    return value === "" ? "—" : value;
  }
  return String(value);
}

/**
 * @param {unknown} key
 * @returns {string}
 */
function formatMetricKey(key){
  return String(key || "metric")
    .replaceAll(".", " / ")
    .replaceAll("_", " ");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value){
  if (value === null || value === undefined || value === ""){
    return "—";
  }
  if (typeof value === "number"){
    if (!Number.isFinite(value)){
      return "—";
    }
    if (Math.abs(value) >= 1000){
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
}

/**
 * @param {number} delta
 * @returns {string}
 */
function formatDelta(delta){
  if (!Number.isFinite(delta)){
    return "—";
  }
  const sign = delta > 0 ? "+" : "";
  if (Math.abs(delta) >= 1000){
    return `${sign}${delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${sign}${delta.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveScenarioWorkspaceCardStatus(view){
  const scenarios = Array.isArray(view?.scenarios) ? view.scenarios : [];
  const activeId = String(view?.activeScenarioId || view?.baselineId || "");
  const baselineId = String(view?.baselineId || "baseline");
  if (!scenarios.length){
    return SCENARIO_STATUS_UNAVAILABLE;
  }
  if (activeId && activeId !== baselineId){
    return "Scenario active";
  }
  return "Baseline ready";
}

/**
 * @param {Record<string, any> | null | undefined} comparison
 * @returns {string}
 */
export function deriveScenarioCompareCardStatus(comparison){
  const count = Number(comparison?.outputDiffCount || 0);
  if (!comparison || comparison.modeText === SCENARIO_COMPARE_MODE_DISABLED_TEXT){
    return "No compare";
  }
  if (count > 0){
    return "Diffs ready";
  }
  return "Compared";
}

/**
 * @param {string} warning
 * @param {string} storage
 * @returns {string}
 */
export function deriveScenarioNotesCardStatus(warning, storage){
  const warningText = String(warning || "").toLowerCase();
  const storageText = String(storage || "").toLowerCase();
  if (warningText.includes("unavailable") || storageText.includes("unavailable")){
    return SCENARIO_STATUS_UNAVAILABLE;
  }
  if (!warningText || warningText === "no warnings."){
    return "Storage ready";
  }
  if (warningText.includes("warning") || warningText.includes("diff") || warningText.includes("delete")){
    return "Watchlist";
  }
  return "Storage ready";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @param {Record<string, any> | null | undefined} comparison
 * @returns {string}
 */
export function deriveScenarioSummaryCardStatus(view, comparison){
  const activeId = String(view?.activeScenarioId || view?.baselineId || "");
  const baselineId = String(view?.baselineId || "baseline");
  if (!view){
    return SCENARIO_STATUS_UNAVAILABLE;
  }
  if (activeId && activeId !== baselineId){
    return Number(comparison?.inputDiffCount || 0) > 0 ? "Delta tracked" : "Scenario active";
  }
  return "Baseline";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyScenarioStatusTone(text){
  return classifyUnifiedStatusTone(text);
}
