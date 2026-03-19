// @ts-check
import { buildOptimizationUpliftSummaryText, deriveOptimizationUpliftSignals } from "./optimize.js";
import {
  coerceFiniteNumber,
  formatFixedNumber,
  formatPercentFromUnit,
  formatWholeNumberByMode,
  roundWholeNumberByMode,
} from "./utils.js";
import { formatUpliftSourceLabel } from "./upliftSource.js";

export const PLAN_WORKLOAD_STATUS_FALLBACK = "Set support goal and pacing assumptions to generate workload requirements.";
export const PLAN_OPTIMIZER_STATUS_FALLBACK = "Run optimization to generate allocation and binding-constraint posture.";
export const PLAN_TIMELINE_STATUS_FALLBACK = "Timeline diagnostics update as staffing and pace assumptions change.";
export const PLAN_WEEK_PREVIEW_FALLBACK = "Timeline preview available after optimization run.";
export const PLAN_OFFICE_PATH_STATUS_FALLBACK = "Office path ranking updates after optimization run.";
export const PLAN_OFFICE_PATH_TABLE_EMPTY = "Run optimization to generate office path rankings.";

const toFiniteNumber = coerceFiniteNumber;

function formatWithInt(value, formatInt){
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0;
  if (typeof formatInt === "function"){
    return String(formatInt(rounded));
  }
  return formatWholeNumberByMode(rounded, { mode: "round", fallback: "0" });
}

function formatWithCurrency(value, formatCurrency, formatInt){
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  if (typeof formatCurrency === "function"){
    return String(formatCurrency(n));
  }
  return `$${formatWithInt(n, formatInt)}`;
}

function formatUnitPercent(value, formatPercentUnit, max = 1){
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  if (typeof formatPercentUnit === "function"){
    return String(formatPercentUnit(n));
  }
  const clamped = Math.min(max, Math.max(0, n));
  return formatPercentFromUnit(clamped, 0);
}

function formatRate(value, digits = 3){
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  const places = Math.max(0, roundWholeNumberByMode(digits, { mode: "floor", fallback: 0 }) ?? 0);
  return formatFixedNumber(n, places, "—");
}

function cleanPlanText(value){
  return String(value == null ? "" : value).trim();
}

function normalizeOfficePathRow(row, { formatWhole } = {}){
  const src = row && typeof row === "object" ? row : {};
  return {
    officeId: String(src?.officeId || "").trim(),
    officeName: String(src?.officeName || src?.officeId || "").trim(),
    mode: String(src?.mode || "").trim() || "—",
    binding: String(src?.binding || "").trim() || "—",
    objectiveValue: typeof formatWhole === "function" ? formatWhole(src?.objectiveValue) : formatWithInt(src?.objectiveValue, null),
    objectivePerDollar: formatRate(src?.objectivePerDollar, 4),
    objectivePerOrganizerHour: formatRate(src?.objectivePerOrganizerHour, 3),
    upliftExpectedMarginalGain: buildPlanRatePercentText(src?.upliftExpectedMarginalGain),
    upliftLowMarginalGain: buildPlanRatePercentText(src?.upliftLowMarginalGain),
    upliftUncertaintyBand: String(src?.upliftUncertaintyBand || "").trim() || "unknown",
    upliftSaturationPressure: String(src?.upliftSaturationPressure || "").trim() || "unknown",
    upliftSource: formatUpliftSourceLabel(src?.upliftSource, { unknownLabel: "—" }),
    topChannel: String(src?.topChannel || "").trim() || "—",
  };
}

/**
 * Canonical summary text for "best office" status chips.
 * @param {unknown} row
 * @param {{ fallback?: string }=} options
 * @returns {string}
 */
export function buildPlanOfficeBestText(row, options = {}){
  const fallback = String(options?.fallback || "—");
  const src = row && typeof row === "object" ? row : {};
  const office = cleanPlanText(src?.officeName || src?.officeId);
  if (!office){
    return fallback;
  }
  const valuePerDollar = cleanPlanText(src?.objectivePerDollar) || "—";
  const upliftExpected = cleanPlanText(src?.upliftExpectedMarginalGain) || "—";
  const topChannel = cleanPlanText(src?.topChannel) || "—";
  return `${office} · ${valuePerDollar} / $ · uplift ${upliftExpected} · top ${topChannel}`;
}

/**
 * Canonical office-path table row projection for Plan surface rendering.
 * Keeps row-level field fallback decisions out of UI modules.
 * @param {unknown[]} rows
 * @returns {Array<{
 *   officeName: string,
 *   objectiveValue: string,
 *   objectivePerDollar: string,
 *   objectivePerOrganizerHour: string,
 *   upliftExpectedMarginalGain: string,
 *   upliftSource: string,
 *   topChannel: string,
 * }>}
 */
export function buildPlanOfficePathTableRowsView(rows = []){
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    const src = row && typeof row === "object" ? row : {};
    return {
      officeName: cleanPlanText(src?.officeName || src?.officeId) || "—",
      objectiveValue: cleanPlanText(src?.objectiveValue) || "—",
      objectivePerDollar: cleanPlanText(src?.objectivePerDollar) || "—",
      objectivePerOrganizerHour: cleanPlanText(src?.objectivePerOrganizerHour) || "—",
      upliftExpectedMarginalGain: cleanPlanText(src?.upliftExpectedMarginalGain) || "—",
      upliftSource: formatUpliftSourceLabel(src?.upliftSource, { unknownLabel: "—" }),
      topChannel: cleanPlanText(src?.topChannel) || "—",
    };
  });
}

/**
 * Canonical optimizer-row projection for plan state/view surfaces.
 * Keeps row-shaping math out of runtime glue/render modules.
 *
 * @param {unknown[]} rows
 * @returns {Array<{
 *   id: string,
 *   tactic: string,
 *   attempts: number,
 *   expectedContacts: number,
 *   expectedNetVotes: number,
 *   expectedObjectiveValue: number,
 *   cost: number,
 *   costPerNetVote: number | null,
 *   upliftExpectedMarginalGain: number | null,
 *   upliftLowMarginalGain: number | null,
 *   upliftGainPerDollar: number | null,
 *   upliftSource: string,
 *   upliftUncertaintyBand: string,
 *   upliftSaturationPressure: string,
 *   saturationUtilization: number | null,
 * }>}
 */
export function normalizePlanOptimizerRows(rows = []){
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    const src = row && typeof row === "object" ? row : {};
    const attempts = toFiniteNumber(src?.attempts);
    const expectedContacts = toFiniteNumber(src?.expectedContacts);
    const expectedNetVotes = toFiniteNumber(src?.expectedNetVotes);
    const expectedObjectiveValue = toFiniteNumber(src?.expectedObjectiveValue ?? src?.expectedNetVotes);
    const cost = toFiniteNumber(src?.cost);
    return {
      id: String(src?.id || "").trim(),
      tactic: String(src?.tactic || src?.label || src?.id || "").trim(),
      attempts: Math.max(0, roundWholeNumberByMode(attempts ?? 0, { mode: "round", fallback: 0 }) ?? 0),
      expectedContacts: Math.max(0, expectedContacts ?? 0),
      expectedNetVotes: expectedNetVotes ?? 0,
      expectedObjectiveValue: expectedObjectiveValue ?? 0,
      cost: Math.max(0, cost ?? 0),
      costPerNetVote: toFiniteNumber(src?.costPerNetVote),
      upliftExpectedMarginalGain: toFiniteNumber(src?.upliftExpectedMarginalGain),
      upliftLowMarginalGain: toFiniteNumber(src?.upliftLowMarginalGain),
      upliftGainPerDollar: toFiniteNumber(src?.upliftGainPerDollar),
      upliftSource: String(src?.upliftSource || "").trim(),
      upliftUncertaintyBand: String(src?.upliftUncertaintyBand || "").trim(),
      upliftSaturationPressure: String(src?.upliftSaturationPressure || "").trim(),
      saturationUtilization: toFiniteNumber(src?.saturationUtilization),
    };
  });
}

/**
 * Canonical optimizer-allocation table row projection.
 * Keeps row-level formatting and fallback choices out of render modules.
 *
 * @param {unknown[]} rows
 * @param {{
 *   includeZeroAttempts?: boolean,
 *   formatWhole?: ((value: number) => string) | null,
 *   formatCurrency?: ((value: number) => string) | null,
 * }=} options
 * @returns {Array<{
 *   tactic: string,
 *   attempts: string,
 *   cost: string,
 *   expectedObjectiveValue: string,
 * }>}
 */
export function buildPlanOptimizerAllocationRowsView(rows = [], options = {}){
  const includeZeroAttempts = !!options?.includeZeroAttempts;
  const formatWhole = typeof options?.formatWhole === "function"
    ? options.formatWhole
    : (value) => formatWithInt(value, null);
  const formatCurrency = typeof options?.formatCurrency === "function"
    ? options.formatCurrency
    : (value) => formatWithCurrency(value, null, null);
  const normalized = normalizePlanOptimizerRows(rows);
  return normalized
    .filter((row) => includeZeroAttempts || Number(row?.attempts) > 0)
    .map((row) => ({
      tactic: cleanPlanText(row?.tactic || row?.id) || "—",
      attempts: cleanPlanText(formatWhole(Number(row?.attempts) || 0)) || "—",
      cost: cleanPlanText(formatCurrency(Number(row?.cost) || 0)) || "—",
      expectedObjectiveValue: cleanPlanText(formatWhole(
        Number.isFinite(Number(row?.expectedObjectiveValue))
          ? Number(row.expectedObjectiveValue)
          : Number(row?.expectedNetVotes) || 0
      )) || "—",
    }));
}

/**
 * Canonical optimizer totals projection.
 * Keeps totals fallback/formatting logic out of render modules.
 *
 * @param {{
 *   attempts?: unknown,
 *   cost?: unknown,
 *   objectiveValue?: unknown,
 *   votes?: unknown,
 *   netVotes?: unknown,
 *   binding?: unknown,
 * } | null | undefined} totals
 * @param {{
 *   formatWhole?: ((value: number) => string) | null,
 *   formatCurrency?: ((value: number) => string) | null,
 * }=} options
 * @returns {{
 *   attempts: string,
 *   cost: string,
 *   objectiveValue: string,
 *   binding: string,
 * }}
 */
export function buildPlanOptimizerTotalsView(totals, options = {}){
  const src = totals && typeof totals === "object" ? totals : {};
  const formatWhole = typeof options?.formatWhole === "function"
    ? options.formatWhole
    : (value) => formatWithInt(value, null);
  const formatCurrency = typeof options?.formatCurrency === "function"
    ? options.formatCurrency
    : (value) => formatWithCurrency(value, null, null);
  const objectiveValueNum = toFiniteNumber(src?.objectiveValue ?? src?.votes ?? src?.netVotes);
  return {
    attempts: (toFiniteNumber(src?.attempts) == null) ? "—" : cleanPlanText(formatWhole(Number(src.attempts))) || "—",
    cost: (toFiniteNumber(src?.cost) == null) ? "—" : cleanPlanText(formatCurrency(Number(src.cost))) || "—",
    objectiveValue: (objectiveValueNum == null) ? "—" : cleanPlanText(formatWhole(objectiveValueNum)) || "—",
    binding: cleanPlanText(src?.binding) || "—",
  };
}

/**
 * Canonical marginal-value diagnostics table row projection.
 * Keeps objective delta aliases and fallback formatting out of render modules.
 *
 * @param {unknown[]} rows
 * @param {{
 *   formatWhole?: ((value: number) => string) | null,
 *   formatCurrency?: ((value: number) => string) | null,
 * }=} options
 * @returns {Array<{
 *   intervention: string,
 *   deltaObjectiveValue: string,
 *   deltaCost: string,
 *   notes: string,
 * }>}
 */
export function buildPlanMarginalDiagnosticsRowsView(rows = [], options = {}){
  const list = Array.isArray(rows) ? rows : [];
  const formatWhole = typeof options?.formatWhole === "function"
    ? options.formatWhole
    : (value) => formatWithInt(value, null);
  const formatCurrency = typeof options?.formatCurrency === "function"
    ? options.formatCurrency
    : (value) => formatWithCurrency(value, null, null);
  return list.map((row) => {
    const src = row && typeof row === "object" ? row : {};
    const deltaObjectiveValue = toFiniteNumber(src?.deltaObjectiveValue ?? src?.deltaMaxNetVotes);
    const deltaCost = toFiniteNumber(src?.deltaCost);
    return {
      intervention: cleanPlanText(src?.intervention) || "—",
      deltaObjectiveValue: (deltaObjectiveValue == null)
        ? "—"
        : (cleanPlanText(formatWhole(deltaObjectiveValue)) || "—"),
      deltaCost: (deltaCost == null)
        ? "—"
        : (cleanPlanText(formatCurrency(deltaCost)) || "—"),
      notes: cleanPlanText(src?.notes) || "—",
    };
  });
}

/**
 * @param {unknown} value
 * @param {{ max?: number, formatRatePercent?: ((value: number, max?: number) => string) | null }=} options
 * @returns {string}
 */
export function buildPlanRatePercentText(value, options = {}){
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  const max = Number.isFinite(Number(options?.max)) ? Number(options.max) : 1.25;
  if (typeof options?.formatRatePercent === "function"){
    return String(options.formatRatePercent(n, max));
  }
  const clamped = Math.min(max, Math.max(0, n));
  return formatPercentFromUnit(clamped, 0);
}

/**
 * @param {unknown} weeklyPlan
 * @param {{ formatInt?: ((value: number) => string) | null, fallbackText?: string }=} options
 * @returns {string}
 */
export function buildPlanWeekPreviewText(weeklyPlan, options = {}){
  const rows = Array.isArray(weeklyPlan) ? weeklyPlan : [];
  const cleaned = rows
    .map((row) => ({
      week: toFiniteNumber(row?.week),
      attempts: toFiniteNumber(row?.attempts),
    }))
    .filter((row) => row.week != null && row.attempts != null);
  if (!cleaned.length){
    return String(options?.fallbackText || PLAN_WEEK_PREVIEW_FALLBACK);
  }
  return cleaned
    .map((row) => {
      const weekRounded = roundWholeNumberByMode(row.week, { mode: "round", fallback: 0 }) ?? 0;
      return `Week ${weekRounded}: ${formatWithInt(row.attempts, options?.formatInt || null)} attempts`;
    })
    .join("\n");
}

/**
 * @param {{
 *   objectiveCopy?: Record<string, any> | null,
 *   upliftSummary?: Record<string, any> | null,
 *   buildUpliftSummaryText?: ((rawSummary: unknown, options?: Record<string, any>) => string) | null,
 *   formatRatePercent?: ((value: number, max?: number) => string) | null,
 * }} input
 * @returns {string}
 */
export function buildPlanOptimizerInterpretationText({
  objectiveCopy = null,
  upliftSummary = null,
  buildUpliftSummaryText = null,
  formatRatePercent = null,
} = {}){
  const objective = objectiveCopy && typeof objectiveCopy === "object"
    ? objectiveCopy
    : { metricLabel: "net votes" };
  const toSummary = typeof buildUpliftSummaryText === "function"
    ? buildUpliftSummaryText
    : buildOptimizationUpliftSummaryText;
  const summaryText = toSummary(upliftSummary, {
    formatPercent: (value) => buildPlanRatePercentText(value, { max: 1.25, formatRatePercent }),
    rangeJoiner: " to ",
    saturationPrefix: "saturation pressure",
  });
  if (!summaryText){
    return `Interpretation: If diminishing returns is OFF and there are no caps, allocation can concentrate in the strongest marginal ${String(objective?.metricLabel || "net votes").toLowerCase()}.`;
  }
  return `Interpretation: ${summaryText}.`;
}

/**
 * @param {Record<string, any> | null | undefined} bindingObj
 * @returns {string}
 */
export function derivePlanBindingText(bindingObj){
  const obj = bindingObj && typeof bindingObj === "object" ? bindingObj : {};
  const timelineBinding = Array.isArray(obj.timeline) && obj.timeline.length
    ? obj.timeline.join(" / ")
    : "";
  return timelineBinding || (obj.budget ? "budget" : "") || (obj.capacity ? "capacity" : "") || "—";
}

/**
 * Canonical goal-feasibility label formatter.
 * @param {unknown} goalFeasible
 * @param {{
 *   trueLabel?: string,
 *   falseLabel?: string,
 *   unknownLabel?: string,
 * }=} options
 * @returns {string}
 */
export function formatPlanGoalFeasible(goalFeasible, options = {}){
  const trueLabel = String(options?.trueLabel || "Yes");
  const falseLabel = String(options?.falseLabel || "No");
  const unknownLabel = String(options?.unknownLabel || "—");
  if (goalFeasible === true) return trueLabel;
  if (goalFeasible === false) return falseLabel;
  return unknownLabel;
}

/**
 * @param {{
 *   objectiveCopy?: Record<string, any> | null,
 *   conversion?: Record<string, any> | null,
 *   timeline?: Record<string, any> | null,
 *   timelineObjectiveMeta?: Record<string, any> | null,
 *   tlMeta?: Record<string, any> | null,
 *   tlObjectiveMeta?: Record<string, any> | null,
 *   lastSummary?: Record<string, any> | null,
 *   lastOptTotals?: Record<string, any> | null,
 *   lastOpt?: Record<string, any> | null,
 *   diagnostics?: Record<string, any> | null,
 *   upliftSummary?: Record<string, any> | null,
 *   upliftSignals?: Record<string, any> | null,
 *   formatInt?: ((value: number) => string) | null,
 *   formatWhole?: ((value: number) => string) | null,
 *   formatCurrency?: ((value: number) => string) | null,
 *   formatPercentUnit?: ((value: number) => string) | null,
 *   formatRatePercent?: ((value: number, max?: number) => string) | null,
 * }} input
 * @returns {{
 *   objective: Record<string, any>,
 *   workload: Record<string, string>,
 *   optimizer: Record<string, string>,
 *   timeline: Record<string, string>,
 *   actions: { primary: string, secondary: string },
 * }}
 */
export function buildPlanSummaryView({
  objectiveCopy = null,
  conversion = null,
  timeline = null,
  timelineObjectiveMeta = null,
  tlMeta = null,
  tlObjectiveMeta = null,
  lastSummary = null,
  lastOptTotals = null,
  lastOpt = null,
  diagnostics = null,
  upliftSummary = null,
  upliftSignals = null,
  formatInt = null,
  formatWhole = null,
  formatCurrency = null,
  formatPercentUnit = null,
  formatRatePercent = null,
} = {}){
  const objective = objectiveCopy && typeof objectiveCopy === "object"
    ? objectiveCopy
    : { value: "net", metricLabel: "net votes" };
  const conversionSafe = conversion && typeof conversion === "object" ? conversion : {};
  const timelineSafe = timeline && typeof timeline === "object" ? timeline : {};
  const timelineMetaSafe = timelineObjectiveMeta && typeof timelineObjectiveMeta === "object" ? timelineObjectiveMeta : {};
  const tlMetaSafe = tlMeta && typeof tlMeta === "object" ? tlMeta : {};
  const tlObjectiveMetaSafe = tlObjectiveMeta && typeof tlObjectiveMeta === "object" ? tlObjectiveMeta : {};
  const lastSummarySafe = lastSummary && typeof lastSummary === "object" ? lastSummary : {};
  const lastOptTotalsSafe = lastOptTotals && typeof lastOptTotals === "object" ? lastOptTotals : {};
  const lastOptSafe = lastOpt && typeof lastOpt === "object" ? lastOpt : {};
  const diagnosticsSafe = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  const upliftSummarySafe = upliftSummary && typeof upliftSummary === "object"
    ? upliftSummary
    : (lastSummarySafe?.upliftSummary && typeof lastSummarySafe.upliftSummary === "object" ? lastSummarySafe.upliftSummary : {});
  const upliftSignalsSafe = upliftSignals && typeof upliftSignals === "object"
    ? upliftSignals
    : deriveOptimizationUpliftSignals(upliftSummarySafe);
  const valueNum = toFiniteNumber(lastSummarySafe?.objectiveValue)
    ?? toFiniteNumber(lastSummarySafe?.netVotes)
    ?? toFiniteNumber(lastOptTotalsSafe?.netVotes);
  const costNum = toFiniteNumber(lastSummarySafe?.cost) ?? toFiniteNumber(lastOptTotalsSafe?.cost);
  const formatWholeValue = typeof formatWhole === "function"
    ? (value) => String(formatWhole(value))
    : (value) => formatWithInt(value, formatInt);
  const officePathsSafe = lastSummarySafe?.officePaths && typeof lastSummarySafe.officePaths === "object"
    ? lastSummarySafe.officePaths
    : {};
  const officePathRowsRaw = Array.isArray(officePathsSafe?.rows) ? officePathsSafe.rows : [];
  const officePathRows = officePathRowsRaw
    .map((row) => normalizeOfficePathRow(row, { formatWhole: formatWholeValue }))
    .filter((row) => row.officeId || row.officeName);
  const officePathBestByDollar = normalizeOfficePathRow(officePathsSafe?.bestByDollar, { formatWhole: formatWholeValue });
  const officePathBestByOrganizerHour = normalizeOfficePathRow(officePathsSafe?.bestByOrganizerHour, { formatWhole: formatWholeValue });
  const binding = String(lastOptSafe?.binding || "").trim()
    || String(lastSummarySafe?.binding || "").trim()
    || derivePlanBindingText(tlMetaSafe?.bindingObj)
    || "—";
  const projectedCompletionWeekNum = toFiniteNumber(timelineSafe?.projectedCompletionWeek);

  return {
    objective,
    workload: {
      conversationsNeeded: formatWholeValue(conversionSafe?.conversationsNeeded),
      doorsNeeded: formatWholeValue(conversionSafe?.doorsNeeded),
      doorsPerShift: formatWholeValue(conversionSafe?.doorsPerShift),
      totalShifts: formatWholeValue(conversionSafe?.totalShifts),
      shiftsPerWeek: formatWholeValue(conversionSafe?.shiftsPerWeek),
      volunteersNeeded: formatWholeValue(conversionSafe?.volunteersNeeded),
      statusText: String(conversionSafe?.feasibility?.text || "").trim() || PLAN_WORKLOAD_STATUS_FALLBACK,
    },
    optimizer: {
      totalAttempts: formatWholeValue(lastOptTotalsSafe?.attempts),
      totalCost: formatWithCurrency(costNum, formatCurrency, formatInt),
      totalValue: formatWholeValue(valueNum),
      binding: binding || "—",
      gapContext: String(lastSummarySafe?.gapContext || "").trim() || PLAN_OPTIMIZER_STATUS_FALLBACK,
      statusText: String(lastSummarySafe?.banner || "").trim() || PLAN_OPTIMIZER_STATUS_FALLBACK,
      interpretationText: buildPlanOptimizerInterpretationText({
        objectiveCopy: objective,
        upliftSummary: upliftSummarySafe,
        formatRatePercent,
      }),
      upliftExpectedMarginalGain: buildPlanRatePercentText(upliftSignalsSafe?.expectedMarginalGain, { max: 1.25, formatRatePercent }),
      upliftLowMarginalGain: buildPlanRatePercentText(upliftSignalsSafe?.lowMarginalGain, { max: 1.25, formatRatePercent }),
      upliftSource: formatUpliftSourceLabel(upliftSignalsSafe?.source, { unknownLabel: "—" }),
      upliftUncertaintyBand: String(upliftSignalsSafe?.uncertaintyBand || "").trim() || "unknown",
      upliftSaturationPressure: String(upliftSignalsSafe?.saturationPressure || "").trim() || "unknown",
      upliftBestChannel: String(upliftSignalsSafe?.bestChannel || "").trim() || "—",
      officePaths: {
        statusText: officePathRows.length ? "Office path ranking ready." : PLAN_OFFICE_PATH_STATUS_FALLBACK,
        bestByDollar: officePathBestByDollar,
        bestByOrganizerHour: officePathBestByOrganizerHour,
        rows: officePathRows,
      },
    },
    timeline: {
      executablePct: formatUnitPercent(timelineSafe?.percentPlanExecutable, formatPercentUnit, 1),
      projectedCompletionWeek: projectedCompletionWeekNum == null
        ? "—"
        : String(roundWholeNumberByMode(projectedCompletionWeekNum, { mode: "round", fallback: 0 }) ?? 0),
      shortfallAttempts: formatWholeValue(timelineSafe?.shortfallAttempts),
      shortfallValue: formatWholeValue(timelineMetaSafe?.shortfallObjectiveValue),
      constraintType: String(timelineSafe?.constraintType || "").trim() || "—",
      statusText: PLAN_TIMELINE_STATUS_FALLBACK,
      goalFeasible: formatPlanGoalFeasible(tlMetaSafe?.goalFeasible, {
        trueLabel: "Yes",
        falseLabel: "No",
        unknownLabel: "—",
      }),
      maxAchievableValue: formatWholeValue(tlObjectiveMetaSafe?.maxAchievableObjectiveValue),
      remainingGapValue: formatWholeValue(tlObjectiveMetaSafe?.remainingGapObjectiveValue),
      binding: binding || "—",
      weekPreviewText: buildPlanWeekPreviewText(timelineSafe?.weeklyPlan, {
        formatInt: formatInt,
      }),
    },
    actions: {
      primary: String(diagnosticsSafe?.primaryBottleneck || "").trim() || "No active bottleneck",
      secondary: String(diagnosticsSafe?.secondaryNotes || "").trim() || "No secondary bottleneck signaled",
    },
  };
}

/**
 * @param {unknown} rawValue
 * @returns {number}
 */
function parsePlanNumber(rawValue){
  const text = String(rawValue || "").trim();
  if (!text || text === "-" || text === "—"){
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * @param {unknown} rawValue
 * @returns {number}
 */
function parsePlanPercent(rawValue){
  return parsePlanNumber(rawValue);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatPlanWhole(value){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return "—";
  }
  return formatWholeNumberByMode(n, { mode: "round", fallback: "—" });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatPlanCurrency(value){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return "—";
  }
  return `$${formatWholeNumberByMode(n, { mode: "round", fallback: "0" })}`;
}

/**
 * Canonical numeric formatter bundle for plan/timeline/optimization renderers.
 * Keeps whole/currency/rounded-int behavior in one source of truth.
 *
 * @param {((value: number) => string) | null | undefined} formatInt
 * @returns {{
 *   formatWhole: (value: unknown) => string,
 *   formatCurrency: (value: unknown) => string,
 *   roundWhole: (value: unknown) => number,
 *   formatIntRound: (value: unknown) => string,
 * }}
 */
export function buildPlanNumberFormatters(formatInt){
  const customFormatInt = (typeof formatInt === "function") ? formatInt : null;
  const fallbackFormatInt = (value) => formatWholeNumberByMode(value, { mode: "round", fallback: "0" });
  const pickIntFormatter = customFormatInt || fallbackFormatInt;
  const roundWhole = (value) => {
    const n = toFiniteNumber(value);
    if (n == null){
      return 0;
    }
    return roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0;
  };
  return {
    formatWhole: (value) => formatWithInt(value, customFormatInt),
    formatCurrency: (value) => formatWithCurrency(value, null, customFormatInt),
    roundWhole,
    formatIntRound: (value) => String(pickIntFormatter(roundWhole(value))),
  };
}

/**
 * @param {unknown} value
 * @param {{ min?: number, max?: number }=} options
 * @returns {string}
 */
export function formatPlanPercentUnit(value, options = {}){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return "—";
  }
  const min = Number.isFinite(Number(options?.min)) ? Number(options.min) : 0;
  const max = Number.isFinite(Number(options?.max)) ? Number(options.max) : 1;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const clamped = Math.min(hi, Math.max(lo, n));
  return formatPercentFromUnit(clamped, 0);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatPlanAutoWeeksInputValue(value){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return "";
  }
  return String(Math.max(0, roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0));
}

/**
 * @param {unknown} shiftsPerWeek
 * @param {unknown} volunteersNeeded
 * @returns {string}
 */
export function buildPlanWorkloadBanner(shiftsPerWeek, volunteersNeeded){
  if (!shiftsPerWeek && !volunteersNeeded){
    return PLAN_WORKLOAD_STATUS_FALLBACK;
  }
  return `Workload target: ${shiftsPerWeek || "—"} shifts/week and ${volunteersNeeded || "—"} volunteers needed.`;
}

/**
 * @param {unknown} optBinding
 * @param {unknown} optGapContext
 * @returns {string}
 */
export function buildPlanOptimizerBanner(optBinding, optGapContext){
  const binding = String(optBinding || "").trim();
  const gap = String(optGapContext || "").trim();
  if (!binding && !gap){
    return PLAN_OPTIMIZER_STATUS_FALLBACK;
  }
  if (binding && gap){
    return `${binding} is currently binding. ${gap}`;
  }
  return binding || gap;
}

/**
 * @param {unknown} executablePct
 * @param {unknown} constraint
 * @param {unknown} shortfallAttempts
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function buildPlanTimelineBanner(executablePct, constraint, shortfallAttempts, shortfallVotes){
  const pct = String(executablePct || "").trim();
  const binding = String(constraint || "").trim();
  const attempts = String(shortfallAttempts || "").trim();
  const votes = String(shortfallVotes || "").trim();

  if (!pct && !binding && !attempts && !votes){
    return PLAN_TIMELINE_STATUS_FALLBACK;
  }
  return `Executable: ${pct || "—"}; Constraint: ${binding || "—"}; Shortfall attempts: ${attempts || "—"}; Shortfall votes: ${votes || "—"}.`;
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @param {string} [objectiveLabel]
 * @returns {string}
 */
export function buildPlanDecisionWarning(constraint, shortfallVotes, objectiveLabel = "net votes"){
  const c = String(constraint || "").toLowerCase();
  const votesText = String(shortfallVotes || "").trim();
  const votesNum = Number(votesText.replace(/[^\d.-]/g, ""));
  const objectiveText = String(objectiveLabel || "net votes").toLowerCase();
  if (c && (c.includes("timeline") || c.includes("capacity") || c.includes("staff"))){
    return "Execution risk is elevated under current timeline/staffing assumptions.";
  }
  if (Number.isFinite(votesNum) && votesNum > 0){
    return `Remaining timeline shortfall detected: ${votesText} ${objectiveText}.`;
  }
  return "";
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallAttempts
 * @returns {string}
 */
export function buildPlanRecommendationVolunteers(constraint, shortfallAttempts){
  const c = String(constraint || "").toLowerCase();
  if (c.includes("staff") || c.includes("capacity")){
    return "Increase organizer or volunteer weekly hours to close the capacity bottleneck.";
  }
  if (String(shortfallAttempts || "").trim()){
    return "Reduce attempts shortfall by increasing weekly shift coverage or narrowing target scope.";
  }
  return "Volunteer load is currently within modeled bounds.";
}

/**
 * @param {unknown} optBinding
 * @param {string} [objectiveLabel]
 * @returns {string}
 */
export function buildPlanRecommendationCost(optBinding, objectiveLabel = "net votes"){
  const binding = String(optBinding || "").toLowerCase();
  const objectiveText = String(objectiveLabel || "net votes").toLowerCase();
  if (binding.includes("budget") || binding.includes("cost")){
    return "Reallocate toward lower-cost channels before adding new spend.";
  }
  return `Keep budget allocation aligned to channels with highest marginal ${objectiveText}.`;
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function buildPlanRecommendationProbability(constraint, shortfallVotes){
  const c = String(constraint || "").toLowerCase();
  const votesNum = Number(String(shortfallVotes || "").replace(/[^\d.-]/g, ""));
  if (c.includes("timeline") || c.includes("week")){
    return "Improve probability posture by de-risking timeline: pull effort earlier in the schedule.";
  }
  if (Number.isFinite(votesNum) && votesNum > 0){
    return "Close remaining vote shortfall to improve modeled win confidence.";
  }
  return "Probability posture is stable under current assumptions.";
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallAttempts
 * @returns {string[][]}
 */
export function buildPlanVolunteerLevers(constraint, shortfallAttempts){
  const c = String(constraint || "").toLowerCase();
  const attempts = parsePlanNumber(shortfallAttempts);
  if (Number.isFinite(attempts) && attempts > 0){
    const organizerShiftCoverage = roundWholeNumberByMode(attempts / 250, { mode: "ceil", fallback: 0 }) ?? 0;
    const volunteerHoursPerWeek = roundWholeNumberByMode(attempts / 400, { mode: "ceil", fallback: 0 }) ?? 0;
    return [
      ["Add organizer shift coverage", `+${formatPlanWhole(organizerShiftCoverage)}`],
      ["Increase volunteer hours / week", `+${formatPlanWhole(volunteerHoursPerWeek)}`]
    ];
  }
  if (c.includes("staff") || c.includes("capacity")){
    return [["Increase active volunteer pool", "Priority"]];
  }
  return [["Volunteer load within range", "—"]];
}

/**
 * @param {unknown} optBinding
 * @param {unknown} shortfallAttempts
 * @returns {string[][]}
 */
export function buildPlanCostLevers(optBinding, shortfallAttempts){
  const binding = String(optBinding || "").toLowerCase();
  const attempts = parsePlanNumber(shortfallAttempts);
  if (binding.includes("budget") || binding.includes("cost")){
    return [
      ["Shift effort to lower-cost channels", "High"],
      ["Reduce low-yield tactic share", "Medium"]
    ];
  }
  if (Number.isFinite(attempts) && attempts > 0){
    return [["Phase spend earlier in cycle", "Medium"]];
  }
  return [["Cost posture stable", "—"]];
}

/**
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @returns {string[][]}
 */
export function buildPlanProbabilityLevers(constraint, shortfallVotes){
  const c = String(constraint || "").toLowerCase();
  const votes = parsePlanNumber(shortfallVotes);
  if (Number.isFinite(votes) && votes > 0){
    return [
      ["Close remaining net-vote gap", `${formatPlanWhole(votes)}`],
      ["Advance execution to earlier weeks", "Medium"]
    ];
  }
  if (c.includes("timeline") || c.includes("week")){
    return [["De-risk timeline concentration", "High"]];
  }
  return [["Probability posture stable", "—"]];
}

/**
 * @param {unknown} workloadBanner
 * @returns {string}
 */
export function derivePlanWorkloadCardStatus(workloadBanner){
  const text = String(workloadBanner || "").trim().toLowerCase();
  if (!text || text.includes("set support goal")){
    return "Awaiting setup";
  }
  return "Current";
}

/**
 * @param {{ attempts?: unknown } | null | undefined} optTotals
 * @param {unknown} optimizerBanner
 * @param {unknown} optBinding
 * @returns {string}
 */
export function derivePlanOptimizerCardStatus(optTotals, optimizerBanner, optBinding){
  const attempts = parsePlanNumber(optTotals?.attempts);
  const banner = String(optimizerBanner || "").trim().toLowerCase();
  const binding = String(optBinding || "").trim().toLowerCase();
  if (!Number.isFinite(attempts) || attempts <= 0){
    return "Awaiting run";
  }
  if (binding.includes("budget") || binding.includes("capacity") || banner.includes("binding")){
    return "Binding";
  }
  return "Allocated";
}

/**
 * @param {Record<string, any> | null | undefined} planView
 * @param {unknown} executablePct
 * @param {unknown} constraint
 * @returns {string}
 */
export function derivePlanTimelineCardStatus(planView, executablePct, constraint){
  const enabled = !!planView?.inputs?.timelineEnabled;
  const pct = parsePlanPercent(executablePct);
  const binding = String(constraint || "").trim().toLowerCase();
  if (!enabled){
    return "Module off";
  }
  if (!Number.isFinite(pct)){
    return "Awaiting setup";
  }
  if (pct >= 100 && (binding.includes("no timeline constraint") || binding.includes("no constraint"))){
    return "Feasible";
  }
  if (pct >= 100){
    return "Tight";
  }
  return "Constrained";
}

/**
 * @param {unknown} executablePct
 * @param {unknown} constraint
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function derivePlanRiskCardStatus(executablePct, constraint, shortfallVotes){
  const pct = parsePlanPercent(executablePct);
  const binding = String(constraint || "").trim().toLowerCase();
  const gap = parsePlanNumber(shortfallVotes);
  if (!Number.isFinite(pct) && !binding){
    return "Awaiting setup";
  }
  if ((Number.isFinite(pct) && pct < 100) || (Number.isFinite(gap) && gap > 0)){
    return "Elevated";
  }
  if (binding.includes("staff") || binding.includes("capacity") || binding.includes("timeline")){
    return "Watch";
  }
  return "Contained";
}

/**
 * @param {unknown} tlConstraint
 * @param {unknown} optBinding
 * @param {unknown} shortfallVotes
 * @returns {string}
 */
export function derivePlanActionsCardStatus(tlConstraint, optBinding, shortfallVotes){
  const constraint = String(tlConstraint || "").trim().toLowerCase();
  const binding = String(optBinding || "").trim().toLowerCase();
  const gap = parsePlanNumber(shortfallVotes);
  if (!constraint && !binding && !Number.isFinite(gap)){
    return "Guidance pending";
  }
  if (Number.isFinite(gap) && gap > 0){
    return "Recovery plan";
  }
  if (constraint || binding){
    return "Guidance ready";
  }
  return "Current";
}

/**
 * @param {unknown} executablePct
 * @param {unknown} tlConstraint
 * @param {unknown} optBinding
 * @returns {string}
 */
export function derivePlanSummaryCardStatus(executablePct, tlConstraint, optBinding){
  const pct = parsePlanPercent(executablePct);
  const constraint = String(tlConstraint || "").trim().toLowerCase();
  const binding = String(optBinding || "").trim().toLowerCase();
  if (!Number.isFinite(pct)){
    return "Awaiting setup";
  }
  if (pct >= 100 && (constraint.includes("no timeline constraint") || binding.includes("no binding"))){
    return "Feasible";
  }
  if (pct >= 100){
    return "Tight";
  }
  return "Constrained";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyPlanStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(current|allocated|feasible|contained|guidance ready)/.test(lower)){
    return "ok";
  }
  if (/(elevated|constrained|binding|recovery plan|unavailable|failed|broken)/.test(lower)){
    return "bad";
  }
  if (/(awaiting|module off|tight|watch|pending)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
