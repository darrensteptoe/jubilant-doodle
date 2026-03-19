// @ts-check
import { pickTacticValuePerAttempt, normalizeOptimizationObjective } from "./turnout.js";
import { coerceFiniteNumber, formatFixedNumber, formatPercentFromUnit, roundWholeNumberByMode } from "./utils.js";
import { formatUpliftSourceLabel, normalizeUpliftSource, UPLIFT_SOURCE_UNKNOWN } from "./upliftSource.js";
import { getTimelineObjectiveMeta } from "./timelineOptimizer.js";
import {
  buildTimelineCapsInputFromState,
  buildTimelineTacticKindsMapFromState,
  computeTimelineCapsSummary,
} from "./timelineCapsInput.js";
import { pctOverrideToDecimal } from "./voteProduction.js";
/* js/optimize.js
   Phase 5 — Tactic Mix Optimization (top-layer only)

   ✅ Does NOT modify persuasion math
   ✅ Does NOT touch Monte Carlo engine
   ✅ Deterministic only (no cost randomness)
   ✅ No circular budget/capacity logic
   ✅ Greedy allocator (defensible) with optional diminishing returns (OFF by default)

   Tactic shape:
   {
     id: "doors" | "phones" | "texts" | ...,
     label: "Doors",
     costPerAttempt: number,
     netVotesPerAttempt: number,
     maxAttempts: number | null,        // optional cap
     decayTiers?: [{ upto:number, mult:number }, ...] // optional (only used when useDecay=true)
   }
*/

/**
 * @param {unknown} x
 * @param {number} [fallback]
 * @returns {number}
 */
function clampNumber(x, fallback = 0) {
  const n = coerceFiniteNumber(x);
  return n == null ? fallback : n;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteOrNull(value){
  return coerceFiniteNumber(value);
}

/**
 * Null-safe numeric coercion for UI/runtime inputs where `null` must stay unknown.
 * (coerceFiniteNumber follows Number() semantics and maps null -> 0.)
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteInputOrNull(value){
  if (value == null || value === ""){
    return null;
  }
  return finiteOrNull(value);
}

/**
 * Canonical uplift-summary normalization for UI/reporting layers.
 * Keeps interpretation math out of render modules.
 * @param {unknown} rawSummary
 */
export function deriveOptimizationUpliftSignals(rawSummary){
  const summary = rawSummary && typeof rawSummary === "object"
    ? /** @type {Record<string, any>} */ (rawSummary)
    : {};
  const expectedMarginalGain = finiteOrNull(summary?.weightedExpectedMarginalGain);
  const lowMarginalGain = finiteOrNull(summary?.weightedLowMarginalGain);
  const bestChannel = String(summary?.bestChannel || "").trim();
  const source = normalizeUpliftSource(summary?.source);
  const uncertaintyBand = String(summary?.uncertaintyBand || "").trim().toLowerCase();
  const saturationPressure = String(summary?.saturationPressure || "").trim().toLowerCase();
  const hasExpected = expectedMarginalGain != null;
  const hasLow = lowMarginalGain != null;
  const hasRange = hasExpected && hasLow;
  const hasSource = source !== UPLIFT_SOURCE_UNKNOWN;
  const hasUncertainty = !!uncertaintyBand;
  const hasSaturation = !!saturationPressure && saturationPressure !== "unknown";
  return {
    expectedMarginalGain,
    lowMarginalGain,
    bestChannel,
    source,
    uncertaintyBand,
    saturationPressure,
    hasExpected,
    hasLow,
    hasRange,
    hasSource,
    hasUncertainty,
    hasSaturation,
  };
}

/**
 * Canonical uplift summary text builder for reporting surfaces.
 * @param {unknown} rawSummary
 * @param {{
 *   formatPercent?: (value: number) => string,
 *   rangeJoiner?: string,
 *   saturationPrefix?: string,
 * }=} options
 * @returns {string}
 */
export function buildOptimizationUpliftSummaryText(rawSummary, options = {}){
  const uplift = deriveOptimizationUpliftSignals(rawSummary);
  const formatPercent = typeof options?.formatPercent === "function"
    ? options.formatPercent
    : (value) => formatPercentFromUnit(value, 0);
  const rangeJoiner = String(options?.rangeJoiner || "-");
  const saturationPrefix = String(options?.saturationPrefix || "saturation");

  const parts = [];
  if (uplift.hasExpected){
    if (uplift.hasLow){
      parts.push(`Uplift range ${formatPercent(Number(uplift.lowMarginalGain))}${rangeJoiner}${formatPercent(Number(uplift.expectedMarginalGain))}`);
    } else {
      parts.push(`Uplift ${formatPercent(Number(uplift.expectedMarginalGain))}`);
    }
  }
  if (uplift.bestChannel){
    parts.push(`best channel ${uplift.bestChannel}`);
  }
  if (uplift.hasSource){
    parts.push(`source ${formatUpliftSourceLabel(uplift.source).toLowerCase()}`);
  }
  if (uplift.hasUncertainty){
    parts.push(`uncertainty ${uplift.uncertaintyBand}`);
  }
  if (uplift.hasSaturation){
    parts.push(`${saturationPrefix} ${uplift.saturationPressure}`);
  }
  return parts.join("; ");
}

function formatOptimizationInt(value, formatInt){
  const n = finiteOrNull(value);
  if (n == null){
    return "0";
  }
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0;
  if (typeof formatInt === "function"){
    return String(formatInt(rounded));
  }
  return rounded.toLocaleString("en-US");
}

/**
 * Canonical optimization gap-context builder for reporting surfaces.
 * @param {unknown} gapObjectiveValue
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {string}
 */
export function buildOptimizationGapContext(gapObjectiveValue, options = {}){
  if (gapObjectiveValue == null || String(gapObjectiveValue).trim() === ""){
    return "Gap context unavailable.";
  }
  const gap = finiteOrNull(gapObjectiveValue);
  if (gap == null){
    return "Gap context unavailable.";
  }
  if (gap <= 0){
    return "Modeled allocation closes current gap.";
  }
  return `${formatOptimizationInt(gap, options?.formatInt || null)} gap remains under current allocation.`;
}

/**
 * Canonical top-allocation label builder for reporting surfaces.
 * @param {unknown[]} topAllocations
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {string[]}
 */
export function buildOptimizationTopAllocationLabels(topAllocations, options = {}){
  const list = Array.isArray(topAllocations) ? topAllocations : [];
  return list.map((row) => {
    const label = String(row?.tactic || row?.id || "").trim();
    if (!label){
      return "";
    }
    const attemptsText = formatOptimizationInt(row?.attempts, options?.formatInt || null);
    return `${label}: ${attemptsText} attempts`;
  }).filter(Boolean);
}

/**
 * Canonical optimization execution summary view for runtime/reporting surfaces.
 * Keeps banner/gap/top-allocation composition out of render modules.
 * @param {{
 *   executionSummary?: Record<string, any> | null,
 *   mode?: "budget" | "capacity" | string,
 *   objectiveLabel?: string,
 *   formatInt?: ((value: number) => string) | null,
 *   formatPercent?: ((value: number) => string) | null,
 * }} input
 * @returns {{
 *   modeLabel: string,
 *   upliftSummaryText: string,
 *   banner: string,
 *   gapContext: string,
 *   topAllocations: string[],
 * }}
 */
export function buildOptimizationExecutionView({
  executionSummary = null,
  mode = "budget",
  objectiveLabel = "Net votes",
  formatInt = null,
  formatPercent = null,
} = {}){
  const summary = executionSummary && typeof executionSummary === "object" ? executionSummary : {};
  const normalizedMode = String(mode || "budget").trim().toLowerCase();
  const modeLabel = normalizedMode === "capacity" ? "Capacity-constrained" : "Budget-constrained";
  const upliftSummaryText = buildOptimizationUpliftSummaryText(summary?.uplift, {
    formatPercent: typeof formatPercent === "function"
      ? formatPercent
      : (value) => formatPercentFromUnit(value, 0),
    rangeJoiner: "-",
    saturationPrefix: "saturation",
  });
  const objectiveText = String(objectiveLabel || "Net votes").trim() || "Net votes";
  const banner = upliftSummaryText
    ? `${modeLabel} allocation using ${objectiveText}. ${upliftSummaryText}`
    : `${modeLabel} allocation using ${objectiveText}.`;
  return {
    modeLabel,
    upliftSummaryText,
    banner,
    gapContext: buildOptimizationGapContext(summary?.totals?.gapObjectiveValue, { formatInt }),
    topAllocations: buildOptimizationTopAllocationLabels(summary?.topAllocations, { formatInt }),
  };
}

/**
 * Canonical optimization last-summary snapshot for state/runtime consumers.
 * Keeps summary snapshot composition out of render modules.
 * @param {{
 *   objective?: string,
 *   executionSummary?: Record<string, any> | null,
 *   executionView?: Record<string, any> | null,
 *   binding?: string | null,
 *   feasible?: boolean | null,
 *   primaryBottleneck?: string | null,
 *   officePaths?: Record<string, any> | null,
 *   roundWhole?: ((value: number) => number) | null,
 * }} input
 * @returns {{
 *   objective: string,
 *   objectiveValue: number,
 *   netVotes: number,
 *   cost: number,
 *   binding: string | null,
 *   gapContext: string,
 *   banner: string,
 *   feasible: boolean | null,
 *   primaryBottleneck: string | null,
 *   topAllocations: string[],
 *   upliftSummary: Record<string, any> | null,
 *   officePaths: Record<string, any> | null,
 * }}
 */
export function buildOptimizationLastSummarySnapshot({
  objective = "net",
  executionSummary = null,
  executionView = null,
  binding = null,
  feasible = null,
  primaryBottleneck = null,
  officePaths = null,
  roundWhole = null,
} = {}){
  const summary = executionSummary && typeof executionSummary === "object" ? executionSummary : {};
  const view = executionView && typeof executionView === "object" ? executionView : {};
  const round = typeof roundWhole === "function"
    ? roundWhole
    : (value) => roundWholeNumberByMode(value, { mode: "round", fallback: 0 }) ?? 0;

  const objectiveValueRaw = finiteOrNull(summary?.totals?.objectiveValue) ?? 0;
  const costRaw = finiteOrNull(summary?.totals?.cost) ?? 0;
  const objectiveValue = round(Number(objectiveValueRaw) || 0);
  const cost = round(Number(costRaw) || 0);

  return {
    objective: String(objective || "net").trim() || "net",
    objectiveValue,
    netVotes: objectiveValue,
    cost,
    binding: cleanOptimizationText(binding) || null,
    gapContext: cleanOptimizationText(view?.gapContext) || "Gap context unavailable.",
    banner: cleanOptimizationText(view?.banner) || "Optimization summary unavailable.",
    feasible: (typeof feasible === "boolean") ? feasible : null,
    primaryBottleneck: cleanOptimizationText(primaryBottleneck) || null,
    topAllocations: Array.isArray(view?.topAllocations)
      ? view.topAllocations.map((row) => cleanOptimizationText(row)).filter(Boolean)
      : [],
    upliftSummary: summary?.uplift && typeof summary.uplift === "object" ? summary.uplift : null,
    officePaths: officePaths && typeof officePaths === "object" ? officePaths : null,
  };
}

/**
 * @param {unknown} mode
 * @returns {"budget" | "capacity"}
 */
function normalizeOptimizationMode(mode){
  return String(mode || "budget").trim().toLowerCase() === "capacity"
    ? "capacity"
    : "budget";
}

/**
 * Canonical optimization budget resolver.
 * Applies fixed overhead once and clamps the available budget to non-negative values.
 *
 * @param {{
 *   budgetAmount?: unknown,
 *   includeOverhead?: boolean,
 *   overheadAmount?: unknown,
 * }} input
 * @returns {number}
 */
export function resolveOptimizationBudgetAvailable({
  budgetAmount = 0,
  includeOverhead = false,
  overheadAmount = 0,
} = {}){
  const budget = Math.max(0, finiteOrNull(budgetAmount) ?? 0);
  if (!includeOverhead){
    return budget;
  }
  const overhead = Math.max(0, finiteOrNull(overheadAmount) ?? 0);
  return Math.max(0, budget - overhead);
}

/**
 * Canonical optimization capacity resolver.
 * Uses explicit capacity when present; otherwise falls back to provided capacity.
 *
 * @param {{
 *   capacityAttempts?: unknown,
 *   fallbackCapacity?: unknown,
 * }} input
 * @returns {number | null}
 */
export function resolveOptimizationCapacityLimit({
  capacityAttempts = null,
  fallbackCapacity = null,
} = {}){
  const explicit = finiteInputOrNull(capacityAttempts);
  if (explicit != null && explicit >= 0){
    return explicit;
  }
  const fallback = finiteInputOrNull(fallbackCapacity);
  if (fallback != null && fallback >= 0){
    return fallback;
  }
  return null;
}

/**
 * Canonical timeline-constrained optimizer input builder.
 * Keeps budget/capacity/objective wiring out of render/runtime modules.
 *
 * @param {{
 *   mode?: "budget" | "capacity" | string,
 *   budgetAmount?: unknown,
 *   includeOverhead?: boolean,
 *   overheadAmount?: unknown,
 *   capacityAttempts?: unknown,
 *   capacityCeiling?: unknown,
 *   tactics?: unknown[],
 *   step?: unknown,
 *   useDecay?: boolean,
 *   objective?: string,
 *   maxAttemptsByTactic?: Record<string, number> | null,
 *   tlObjectiveMode?: string,
 *   goalObjectiveValue?: unknown,
 *   goalNetVotes?: unknown,
 * }} input
 * @returns {{
 *   mode: "budget" | "capacity",
 *   budgetLimit: number | null,
 *   capacityLimit: number | null,
 *   capacityCeiling: number | null,
 *   tactics: unknown[],
 *   step: number,
 *   useDecay: boolean,
 *   objective: string,
 *   maxAttemptsByTactic: Record<string, number> | null,
 *   tlObjectiveMode: string,
 *   goalObjectiveValue: number | null,
 *   goalNetVotes: number | null,
 * }}
 */
export function buildTimelineConstrainedOptimizationInput({
  mode = "budget",
  budgetAmount = 0,
  includeOverhead = false,
  overheadAmount = 0,
  capacityAttempts = null,
  capacityCeiling = null,
  tactics = [],
  step = 25,
  useDecay = false,
  objective = "net",
  maxAttemptsByTactic = null,
  tlObjectiveMode = "max_net",
  goalObjectiveValue = null,
  goalNetVotes = null,
} = {}){
  const normalizedMode = normalizeOptimizationMode(mode);
  const budgetLimit = normalizedMode === "capacity"
    ? null
    : resolveOptimizationBudgetAvailable({
      budgetAmount,
      includeOverhead,
      overheadAmount,
    });
  const capacityLimit = normalizedMode === "capacity"
    ? (resolveOptimizationCapacityLimit({ capacityAttempts, fallbackCapacity: 0 }) ?? 0)
    : null;
  const normalizedCapacityCeiling = finiteInputOrNull(capacityCeiling);
  const capacityCeilingForMode = normalizedMode === "capacity"
    ? null
    : (
      normalizedCapacityCeiling != null && normalizedCapacityCeiling >= 0
        ? normalizedCapacityCeiling
        : null
    );
  const normalizedStep = Math.max(
    1,
    roundWholeNumberByMode(finiteInputOrNull(step) ?? 25, { mode: "floor", fallback: 25 }) ?? 25
  );
  const normalizedObjective = cleanOptimizationText(objective) || "net";
  const normalizedTlObjectiveMode = cleanOptimizationText(tlObjectiveMode) || "max_net";
  const normalizedMaxAttemptsByTactic = maxAttemptsByTactic && typeof maxAttemptsByTactic === "object"
    ? maxAttemptsByTactic
    : null;

  return {
    mode: normalizedMode,
    budgetLimit,
    capacityLimit,
    capacityCeiling: capacityCeilingForMode,
    tactics: Array.isArray(tactics) ? tactics : [],
    step: normalizedStep,
    useDecay: !!useDecay,
    objective: normalizedObjective,
    maxAttemptsByTactic: normalizedMaxAttemptsByTactic,
    tlObjectiveMode: normalizedTlObjectiveMode,
    goalObjectiveValue: finiteInputOrNull(goalObjectiveValue),
    goalNetVotes: finiteInputOrNull(goalNetVotes),
  };
}

/**
 * Canonical optimization feasibility resolver.
 * Timeline-constrained mode can produce true/false/unknown based on objective and executable share.
 *
 * @param {{
 *   timelineConstrainedEnabled?: boolean,
 *   timelineEnabled?: boolean,
 *   timelineGoalFeasible?: unknown,
 *   timelineExecutablePct?: unknown,
 *   executableThreshold?: number,
 * }} input
 * @returns {boolean | null}
 */
export function resolveOptimizationFeasible({
  timelineConstrainedEnabled = false,
  timelineEnabled = false,
  timelineGoalFeasible = null,
  timelineExecutablePct = null,
  executableThreshold = 0.999,
} = {}){
  if (!(timelineConstrainedEnabled && timelineEnabled)){
    return true;
  }
  if (timelineGoalFeasible === true){
    return true;
  }
  if (timelineGoalFeasible === false){
    return false;
  }
  const executable = finiteInputOrNull(timelineExecutablePct);
  if (executable == null){
    return null;
  }
  const thresholdRaw = finiteInputOrNull(executableThreshold);
  const threshold = thresholdRaw == null ? 0.999 : Math.max(0, Math.min(1, thresholdRaw));
  return executable >= threshold;
}

/**
 * Canonical timeline-constraint intervention delta builder.
 * Computes "what-if" deltas for common bottleneck levers so render modules do not run optimizer math.
 *
 * @param {{
 *   state?: Record<string, any> | null,
 *   weeksRemaining?: unknown,
 *   needObjectiveValue?: unknown,
 *   budgetAmount?: unknown,
 *   includeOverhead?: boolean,
 *   overheadAmount?: unknown,
 *   optimizeConfig?: Record<string, any> | null,
 *   baseRates?: { cr?: unknown, sr?: unknown, tr?: unknown } | null,
 *   tacticsRaw?: Record<string, any> | null,
 *   buildOptimizationTactics?: ((input: Record<string, any>) => unknown[]) | null,
 *   computeMaxAttemptsByTactic?: ((input: Record<string, any>) => Record<string, any> | null | undefined) | null,
 *   optimizeTimelineConstrained?: ((input: Record<string, any>) => Record<string, any> | null | undefined) | null,
 *   clampFn?: ((value: number, min: number, max: number) => number) | null,
 * }} input
 * @returns {{
 *   base: {
 *     maxObjectiveValue: number | null,
 *     maxAttemptsByTactic: Record<string, any> | null,
 *     bindingObj: Record<string, any> | null,
 *   },
 *   rows: Array<{
 *     intervention: string,
 *     deltaObjectiveValue: number | null,
 *     notes: string,
 *   }>,
 * }}
 */
export function computeTimelineConstraintInterventionDeltas({
  state = null,
  weeksRemaining = null,
  needObjectiveValue = null,
  budgetAmount = 0,
  includeOverhead = false,
  overheadAmount = 0,
  optimizeConfig = null,
  baseRates = null,
  tacticsRaw = null,
  buildOptimizationTactics = null,
  computeMaxAttemptsByTactic = null,
  optimizeTimelineConstrained = null,
  clampFn = null,
} = {}){
  const empty = {
    base: {
      maxObjectiveValue: null,
      maxAttemptsByTactic: null,
      bindingObj: null,
    },
    rows: [
      { intervention: "Timeline capacity", deltaObjectiveValue: null, notes: "timeline capacity (staff hours/week)" },
      { intervention: "Budget ceiling", deltaObjectiveValue: null, notes: "budget ceiling" },
      { intervention: "Contact rate", deltaObjectiveValue: null, notes: "contact rate missing" },
      { intervention: "Volunteer hours", deltaObjectiveValue: null, notes: "volunteer hours/week" },
    ],
  };
  if (!state || typeof state !== "object"){
    return empty;
  }
  if (typeof buildOptimizationTactics !== "function" || typeof computeMaxAttemptsByTactic !== "function" || typeof optimizeTimelineConstrained !== "function"){
    return empty;
  }

  const opt = optimizeConfig && typeof optimizeConfig === "object" ? optimizeConfig : {};
  const objective = normalizeOptimizationObjective(opt?.objective, "net");
  const tlObjectiveMode = cleanOptimizationText(opt?.tlConstrainedObjective) || "max_net";
  const step = Math.max(
    1,
    roundWholeNumberByMode(finiteInputOrNull(opt?.step) ?? 100, { mode: "floor", fallback: 100 }) ?? 100
  );
  const mode = normalizeOptimizationMode(opt?.mode || "budget");
  const capacityAttempts = finiteInputOrNull(opt?.capacityAttempts);
  const budget = Math.max(0, finiteInputOrNull(budgetAmount) ?? 0);
  const weeks = Math.max(0, finiteInputOrNull(weeksRemaining) ?? 0);
  const goalObjectiveValue = finiteInputOrNull(needObjectiveValue);
  const rates = {
    cr: finiteInputOrNull(baseRates?.cr) ?? 0,
    sr: finiteInputOrNull(baseRates?.sr) ?? 0,
    tr: finiteInputOrNull(baseRates?.tr) ?? 0,
  };
  const clamp = typeof clampFn === "function"
    ? clampFn
    : (value, min, max) => Math.min(max, Math.max(min, value));
  const tacticKinds = buildTimelineTacticKindsMapFromState(state);
  const capsInputBase = buildTimelineCapsInputFromState({
    state,
    weeksRemaining: weeks,
    enabled: true,
    tacticKinds,
  });
  const tacticsBase = buildOptimizationTactics({
    baseRates: rates,
    tactics: tacticsRaw && typeof tacticsRaw === "object" ? tacticsRaw : {},
    state,
  });

  const runScenario = ({ tactics, capsInput, scenarioBudget }) => {
    const capsSummary = computeTimelineCapsSummary({
      capsInput,
      computeMaxAttemptsByTactic,
    });
    const maxAttemptsByTactic = capsSummary.maxAttemptsByTactic && typeof capsSummary.maxAttemptsByTactic === "object"
      ? capsSummary.maxAttemptsByTactic
      : null;
    const tlInput = buildTimelineConstrainedOptimizationInput({
      mode,
      budgetAmount: scenarioBudget,
      includeOverhead,
      overheadAmount,
      capacityAttempts,
      capacityCeiling: null,
      tactics: Array.isArray(tactics) ? tactics : [],
      step,
      useDecay: !!opt?.useDecay,
      objective,
      maxAttemptsByTactic,
      tlObjectiveMode,
      goalObjectiveValue,
    });
    const out = optimizeTimelineConstrained(tlInput);
    const meta = out?.meta && typeof out.meta === "object" ? out.meta : {};
    const objectiveMeta = getTimelineObjectiveMeta(meta);
    return {
      maxObjectiveValue: finiteInputOrNull(objectiveMeta?.maxAchievableObjectiveValue),
      maxAttemptsByTactic,
      bindingObj: meta?.bindingObj && typeof meta.bindingObj === "object" ? meta.bindingObj : null,
    };
  };

  const base = runScenario({
    tactics: tacticsBase,
    capsInput: capsInputBase,
    scenarioBudget: budget,
  });
  const baseMax = finiteInputOrNull(base.maxObjectiveValue);

  const computeDelta = (nextMax) => (
    (nextMax != null && baseMax != null)
      ? (nextMax - baseMax)
      : null
  );

  const staffCapsInput = structuredClone(capsInputBase);
  if (!staffCapsInput.staffing || typeof staffCapsInput.staffing !== "object"){
    staffCapsInput.staffing = {};
  }
  staffCapsInput.staffing.staffHours = (finiteInputOrNull(staffCapsInput.staffing.staffHours) ?? 0) * 1.10;
  const staffRun = runScenario({
    tactics: tacticsBase,
    capsInput: staffCapsInput,
    scenarioBudget: budget,
  });

  const volunteerCapsInput = structuredClone(capsInputBase);
  if (!volunteerCapsInput.staffing || typeof volunteerCapsInput.staffing !== "object"){
    volunteerCapsInput.staffing = {};
  }
  volunteerCapsInput.staffing.volunteerHours = (finiteInputOrNull(volunteerCapsInput.staffing.volunteerHours) ?? 0) * 1.10;
  const volunteerRun = runScenario({
    tactics: tacticsBase,
    capsInput: volunteerCapsInput,
    scenarioBudget: budget,
  });

  const budgetRun = (mode === "capacity")
    ? { maxObjectiveValue: null }
    : runScenario({
      tactics: tacticsBase,
      capsInput: capsInputBase,
      scenarioBudget: budget * 1.10,
    });

  const currentContactPct = finiteInputOrNull(state?.contactRatePct);
  const contactRun = (() => {
    if (currentContactPct == null){
      return { maxObjectiveValue: null, nextContactPct: null };
    }
    const nextContactPct = clamp(currentContactPct * 1.10, 0, 100);
    const nextCr = pctOverrideToDecimal(nextContactPct, 0);
    const contactTactics = buildOptimizationTactics({
      baseRates: {
        cr: nextCr,
        sr: rates.sr,
        tr: rates.tr,
      },
      tactics: tacticsRaw && typeof tacticsRaw === "object" ? tacticsRaw : {},
      state,
    });
    const run = runScenario({
      tactics: contactTactics,
      capsInput: capsInputBase,
      scenarioBudget: budget,
    });
    return { ...run, nextContactPct };
  })();

  return {
    base,
    rows: [
      {
        intervention: "Timeline capacity",
        deltaObjectiveValue: computeDelta(staffRun.maxObjectiveValue),
        notes: "timeline capacity (staff hours/week)",
      },
      {
        intervention: "Budget ceiling",
        deltaObjectiveValue: computeDelta(budgetRun.maxObjectiveValue),
        notes: mode === "capacity" ? "budget not active (capacity mode)" : "budget ceiling",
      },
      {
        intervention: "Contact rate",
        deltaObjectiveValue: computeDelta(contactRun.maxObjectiveValue),
        notes: (currentContactPct == null || contactRun.nextContactPct == null)
          ? "contact rate missing"
          : `contact rate ${formatFixedNumber(currentContactPct, 1, "—")}% -> ${formatFixedNumber(contactRun.nextContactPct, 1, "—")}%`,
      },
      {
        intervention: "Volunteer hours",
        deltaObjectiveValue: computeDelta(volunteerRun.maxObjectiveValue),
        notes: "volunteer hours/week",
      },
    ],
  };
}

/**
 * Canonical optimization binding/bottleneck summary.
 * Computes primary + secondary binding constraints with deterministic timeline saturation ranking.
 *
 * @param {{
 *   bindingObj?: Record<string, any> | null,
 *   allocation?: Record<string, any> | null,
 *   maxAttemptsByTactic?: Record<string, any> | null,
 * }} input
 * @returns {{
 *   primary: string,
 *   secondary: string,
 *   notBinding: string[],
 * }}
 */
export function deriveOptimizationBindingSummary({
  bindingObj = null,
  allocation = null,
  maxAttemptsByTactic = null,
} = {}){
  const binding = bindingObj && typeof bindingObj === "object" ? bindingObj : {};
  const alloc = allocation && typeof allocation === "object" ? allocation : {};
  const caps = maxAttemptsByTactic && typeof maxAttemptsByTactic === "object" ? maxAttemptsByTactic : {};

  const bindingTimeline = Array.isArray(binding?.timeline)
    ? binding.timeline.map((row) => cleanOptimizationText(row)).filter(Boolean)
    : [];
  const bindingBudget = !!binding?.budget;
  const bindingCapacity = !!binding?.capacity;

  const sat = [];
  for (const tacticId of bindingTimeline){
    const cap = finiteInputOrNull(caps[tacticId]);
    const attempts = finiteInputOrNull(alloc[tacticId]);
    const utilization = (cap != null && cap > 0 && attempts != null)
      ? (attempts / cap)
      : null;
    if (utilization != null){
      sat.push({ tacticId, utilization });
    }
  }
  sat.sort((a, b) => Number(b.utilization) - Number(a.utilization) || String(a.tacticId).localeCompare(String(b.tacticId)));

  let primary = "";
  let secondary = "";

  if (sat.length){
    primary = `timeline: ${sat[0].tacticId}`;
    if (sat.length > 1){
      secondary = `timeline: ${sat[1].tacticId}`;
    }
  } else if (bindingTimeline.length){
    primary = `timeline: ${bindingTimeline[0]}`;
    if (bindingTimeline.length > 1){
      secondary = `timeline: ${bindingTimeline[1]}`;
    }
  }

  const others = [];
  if (bindingBudget) others.push("budget");
  if (bindingCapacity) others.push("capacity");

  if (!primary && others.length){
    primary = others[0];
    secondary = others[1] || "";
  } else if (primary && !secondary && others.length){
    secondary = others[0];
  }

  const notBinding = [];
  if (!bindingTimeline.length) notBinding.push("timeline");
  if (!bindingBudget) notBinding.push("budget");
  if (!bindingCapacity) notBinding.push("capacity");

  return {
    primary: primary || "none/unknown",
    secondary: secondary || "—",
    notBinding,
  };
}

/**
 * @param {Record<string, any>} tactic
 * @param {number} currentAttempts
 * @returns {number}
 */
function getTierMultiplier(tactic, currentAttempts) {
  const tiers = Array.isArray(tactic.decayTiers) ? tactic.decayTiers : null;
  if (!tiers || tiers.length === 0) return 1;

  for (const t of tiers) {
    const upto = clampNumber(t.upto, Infinity);
    if (currentAttempts < upto) return clampNumber(t.mult, 1);
  }
  return clampNumber(tiers[tiers.length - 1]?.mult, 1);
}

/**
 * @param {Array<Record<string, any>> | null | undefined} tactics
 * @returns {Array<Record<string, any>>}
 */
function validateTactics(tactics) {
  if (!Array.isArray(tactics) || tactics.length === 0) return [];

  return tactics.map((t) => {
    const id = String(t.id ?? "").trim();
    const label = String(t.label ?? id);

    const costPerAttempt = clampNumber(t.costPerAttempt, NaN);
    const netVotesPerAttempt = clampNumber(t.netVotesPerAttempt, NaN);
    const turnoutAdjustedNetVotesPerAttempt = clampNumber(t.turnoutAdjustedNetVotesPerAttempt, NaN);

    if (!id) throw new Error("optimizeMix: tactic missing id.");
    if (!Number.isFinite(costPerAttempt) || costPerAttempt < 0) throw new Error(`optimizeMix: invalid costPerAttempt for ${id}.`);
    if (!Number.isFinite(netVotesPerAttempt)) throw new Error(`optimizeMix: invalid netVotesPerAttempt for ${id}.`);

    let maxAttempts = t.maxAttempts;
    maxAttempts = (maxAttempts === null || maxAttempts === undefined) ? null : clampNumber(maxAttempts, null);
    if (maxAttempts !== null && (!Number.isFinite(maxAttempts) || maxAttempts < 0)) {
      throw new Error(`optimizeMix: invalid maxAttempts for ${id}.`);
    }

    return { ...t, id, label, costPerAttempt, netVotesPerAttempt, turnoutAdjustedNetVotesPerAttempt, maxAttempts };
  });
}

/**
 * @param {Array<Record<string, any>>} tactics
 * @returns {Record<string, number>}
 */
function initAllocation(tactics) {
  const allocation = {};
  for (const t of tactics) allocation[t.id] = 0;
  return allocation;
}

/**
 * @param {Array<Record<string, any>>} tactics
 * @param {Record<string, number>} allocation
 * @param {(tactic: Record<string, any>) => number} valuePerAttempt
 * @returns {{attempts:number,cost:number,netVotes:number}}
 */
function computeTotals(tactics, allocation, valuePerAttempt) {
  let attempts = 0;
  let cost = 0;
  let netVotes = 0;
  for (const t of tactics) {
    const a = clampNumber(allocation[t.id], 0);
    attempts += a;
    cost += a * t.costPerAttempt;
    netVotes += a * valuePerAttempt(t);
  }
  return { attempts, cost, netVotes };
}

/**
 * @param {{
 *   tactics: Array<Record<string, any>>,
 *   step: number,
 *   budgetLimit: number | null,
 *   capacityLimit: number | null,
 *   useDecay: boolean,
 *   scoringFn: (input: { tactic: Record<string, any>, currentAllocatedAttempts: number, step: number, marginalNetVotes: number, marginalCost: number }) => number,
 *   valuePerAttempt: (tactic: Record<string, any>) => number
 * }} input
 */
function greedyAllocate({ tactics, step, budgetLimit, capacityLimit, useDecay, scoringFn, valuePerAttempt }) {
  const allocation = initAllocation(tactics);
  const trace = [];

  let usedBudget = 0;
  let usedCapacity = 0;
  let accumulatedNetVotes = 0;

  const canAddStep = (t) => {
    const cur = allocation[t.id];
    if (t.maxAttempts !== null && cur + step > t.maxAttempts) return false;
    if (capacityLimit !== null && usedCapacity + step > capacityLimit) return false;
    const stepCost = step * t.costPerAttempt;
    if (budgetLimit !== null && usedBudget + stepCost > budgetLimit) return false;
    return true;
  };

  while (true) {
    let best = null;
    let bestScore = -Infinity;

    for (const t of tactics) {
      if (!canAddStep(t)) continue;

      const cur = allocation[t.id];
      const mult = useDecay ? getTierMultiplier(t, cur) : 1;

      const mNetVotes = step * valuePerAttempt(t) * mult;
      const mCost = step * t.costPerAttempt;

      const score = scoringFn({ tactic: t, currentAllocatedAttempts: cur, step, marginalNetVotes: mNetVotes, marginalCost: mCost });
      if (score > bestScore) {
        bestScore = score;
        best = { t, mNetVotes, mCost, score };
      }
    }

    if (!best) break;

    allocation[best.t.id] += step;
    usedCapacity += step;
    usedBudget += best.mCost;
    if (useDecay) accumulatedNetVotes += best.mNetVotes;

    trace.push({ pick: best.t.id, add: step, mNetVotes: best.mNetVotes, mCost: best.mCost, score: best.score });
  }

  const totals = computeTotals(tactics, allocation, valuePerAttempt);
  if (useDecay) totals.netVotes = accumulatedNetVotes;

  let binding = "caps";
  if (budgetLimit !== null && (budgetLimit - usedBudget) < 1e-9) binding = "budget";
  if (capacityLimit !== null && (capacityLimit - usedCapacity) < 1e-9) binding = "capacity";

  return { allocation, totals, trace, binding };
}

/**
 * @param {{
 *   budget: number,
 *   tactics: Array<Record<string, any>>,
 *   step?: number,
 *   capacityCeiling?: number | null,
 *   useDecay?: boolean,
 *   objective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string
 * }} input
 */
export function optimizeMixBudget({ budget, tactics, step = 25, capacityCeiling = null, useDecay = false, objective = "net" }) {
  const B = Math.max(0, clampNumber(budget, 0));
  const S = Math.max(1, roundWholeNumberByMode(clampNumber(step, 25), { mode: "floor", fallback: 25 }) ?? 25);

  const clean = validateTactics(tactics);

  const valuePerAttempt = (t) => Math.max(0, clampNumber(pickTacticValuePerAttempt(t, objective), 0));


  const scoringFn = ({ marginalNetVotes, marginalCost }) => {
    if (marginalCost <= 0) return marginalNetVotes > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return marginalNetVotes / marginalCost;
  };

  const { allocation, totals, trace, binding } = greedyAllocate({
    tactics: clean,
    step: S,
    budgetLimit: B,
    capacityLimit: (capacityCeiling === null ? null : Math.max(0, clampNumber(capacityCeiling, 0))),
    useDecay,
    scoringFn,
    valuePerAttempt
  });

  return { mode: "budget", step: S, constraint: B, binding, allocation, totals, trace };
}

/**
 * @param {{
 *   capacity: number,
 *   tactics: Array<Record<string, any>>,
 *   step?: number,
 *   useDecay?: boolean,
 *   objective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string
 * }} input
 */
export function optimizeMixCapacity({ capacity, tactics, step = 25, useDecay = false, objective = "net" }) {
  const A = Math.max(0, clampNumber(capacity, 0));
  const S = Math.max(1, roundWholeNumberByMode(clampNumber(step, 25), { mode: "floor", fallback: 25 }) ?? 25);

  const clean = validateTactics(tactics);

  const valuePerAttempt = (t) => Math.max(0, clampNumber(pickTacticValuePerAttempt(t, objective), 0));

  const scoringFn = ({ marginalNetVotes }) => marginalNetVotes;

  const { allocation, totals, trace, binding } = greedyAllocate({
    tactics: clean,
    step: S,
    budgetLimit: null,
    capacityLimit: A,
    useDecay,
    scoringFn,
    valuePerAttempt
  });

  return { mode: "capacity", step: S, constraint: A, binding, allocation, totals, trace };
}

/**
 * @param {Record<string, any>} office
 * @returns {number|null}
 */
function resolveOfficeOrganizerHours(office){
  const explicit = finiteOrNull(office?.organizerHours);
  if (explicit != null && explicit > 0) return explicit;
  const workforce = office?.workforce && typeof office.workforce === "object" ? office.workforce : {};
  const organizers = finiteOrNull(workforce?.organizerCount ?? office?.organizerCount);
  const hoursPerWeek = finiteOrNull(workforce?.organizerHoursPerWeek ?? office?.organizerHoursPerWeek);
  const weeks = finiteOrNull(office?.weeksRemaining ?? office?.weeks);
  if (organizers == null || organizers <= 0) return null;
  if (hoursPerWeek == null || hoursPerWeek <= 0) return null;
  if (weeks == null || weeks <= 0) return null;
  return organizers * hoursPerWeek * weeks;
}

/**
 * Canonical office-level optimizer helper.
 * Produces deterministic office path rankings from one shared optimization + execution summary surface.
 *
 * @param {{
 *   offices?: Array<Record<string, any>> | null,
 *   defaultObjective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string,
 *   defaultStep?: number,
 *   defaultUseDecay?: boolean,
 * }} input
 */
export function optimizeMixByOffice({
  offices = [],
  defaultObjective = "net",
  defaultStep = 25,
  defaultUseDecay = false,
} = {}){
  const list = Array.isArray(offices) ? offices : [];
  const rows = [];

  for (const office of list){
    const officeId = String(office?.officeId || office?.id || "").trim();
    const officeName = String(office?.officeName || office?.name || officeId || "office").trim();
    const tactics = Array.isArray(office?.tactics) ? office.tactics : [];
    if (!tactics.length) continue;

    const objective = String(office?.objective || defaultObjective || "net").trim() || "net";
    const step = Math.max(
      1,
      roundWholeNumberByMode(clampNumber(office?.step, defaultStep), { mode: "floor", fallback: defaultStep }) ?? defaultStep
    );
    const useDecay = (office?.useDecay == null) ? !!defaultUseDecay : !!office.useDecay;
    const budget = finiteOrNull(office?.budget);
    const capacity = finiteOrNull(office?.capacity);
    const mode = (office?.mode === "capacity" || (budget == null && capacity != null))
      ? "capacity"
      : "budget";

    const run = (mode === "capacity")
      ? optimizeMixCapacity({
        capacity: Math.max(0, clampNumber(capacity, 0)),
        tactics,
        step,
        useDecay,
        objective,
      })
      : optimizeMixBudget({
        budget: Math.max(0, clampNumber(budget, 0)),
        tactics,
        step,
        capacityCeiling: finiteOrNull(office?.capacityCeiling),
        useDecay,
        objective,
      });

    const summary = buildOptimizationExecutionSummary({
      tactics,
      allocation: run?.allocation,
      totals: run?.totals,
      objective,
      needObjectiveValue: finiteOrNull(office?.needObjectiveValue),
      includeOverhead: !!office?.includeOverhead,
      overheadAmount: clampNumber(office?.overheadAmount, 0),
    });

    const attempts = finiteOrNull(summary?.totals?.attempts) ?? 0;
    const cost = finiteOrNull(summary?.totals?.cost) ?? 0;
    const objectiveValue = finiteOrNull(summary?.totals?.objectiveValue) ?? 0;
    const objectivePerDollar = cost > 0 ? (objectiveValue / cost) : null;
    const objectivePerAttempt = attempts > 0 ? (objectiveValue / attempts) : null;
    const organizerHours = resolveOfficeOrganizerHours(office);
    const objectivePerOrganizerHour = (organizerHours != null && organizerHours > 0)
      ? (objectiveValue / organizerHours)
      : null;

    rows.push({
      officeId,
      officeName,
      mode: run?.mode || mode,
      objective,
      binding: String(run?.binding || ""),
      constraint: finiteOrNull(run?.constraint),
      attempts,
      cost,
      objectiveValue,
      objectivePerDollar,
      objectivePerAttempt,
      organizerHours,
      objectivePerOrganizerHour,
      topChannels: Array.isArray(summary?.topAllocations) ? summary.topAllocations : [],
      summary,
      run,
    });
  }

  const byDollar = [...rows].sort((a, b) => {
    const da = finiteOrNull(a?.objectivePerDollar);
    const db = finiteOrNull(b?.objectivePerDollar);
    if (da == null && db == null) return String(a?.officeId || "").localeCompare(String(b?.officeId || ""));
    if (da == null) return 1;
    if (db == null) return -1;
    if (Math.abs(db - da) > 1e-12) return db - da;
    return String(a?.officeId || "").localeCompare(String(b?.officeId || ""));
  });

  const byOrganizerHour = [...rows].sort((a, b) => {
    const ha = finiteOrNull(a?.objectivePerOrganizerHour);
    const hb = finiteOrNull(b?.objectivePerOrganizerHour);
    if (ha == null && hb == null) return String(a?.officeId || "").localeCompare(String(b?.officeId || ""));
    if (ha == null) return 1;
    if (hb == null) return -1;
    if (Math.abs(hb - ha) > 1e-12) return hb - ha;
    return String(a?.officeId || "").localeCompare(String(b?.officeId || ""));
  });

  return {
    rows,
    byDollar,
    byOrganizerHour,
    bestByDollar: byDollar[0] || null,
    bestByOrganizerHour: byOrganizerHour[0] || null,
  };
}

function cleanOptimizationText(value){
  return String(value == null ? "" : value).trim();
}

/**
 * Canonical office-path row projection for optimization summaries.
 * @param {unknown} row
 * @returns {{
 *   officeId: string,
 *   officeName: string,
 *   mode: string,
 *   binding: string,
 *   objectiveValue: number | null,
 *   objectivePerDollar: number | null,
 *   objectivePerOrganizerHour: number | null,
 *   upliftExpectedMarginalGain: number | null,
 *   upliftLowMarginalGain: number | null,
 *   upliftUncertaintyBand: string,
 *   upliftSaturationPressure: string,
 *   upliftSource: string,
  *   topChannel: string,
 * } | null}
 */
export function normalizeOptimizationOfficePathRow(row){
  const src = row && typeof row === "object" ? row : null;
  if (!src){
    return null;
  }
  return {
    officeId: cleanOptimizationText(src.officeId),
    officeName: cleanOptimizationText(src.officeName || src.officeId),
    mode: cleanOptimizationText(src.mode),
    binding: cleanOptimizationText(src.binding),
    objectiveValue: finiteOrNull(src.objectiveValue),
    objectivePerDollar: finiteOrNull(src.objectivePerDollar),
    objectivePerOrganizerHour: finiteOrNull(src.objectivePerOrganizerHour),
    upliftExpectedMarginalGain: finiteOrNull(src?.summary?.uplift?.weightedExpectedMarginalGain),
    upliftLowMarginalGain: finiteOrNull(src?.summary?.uplift?.weightedLowMarginalGain),
    upliftUncertaintyBand: cleanOptimizationText(src?.summary?.uplift?.uncertaintyBand || "unknown") || "unknown",
    upliftSaturationPressure: cleanOptimizationText(src?.summary?.uplift?.saturationPressure || "unknown") || "unknown",
    upliftSource: normalizeUpliftSource(src?.summary?.uplift?.source),
    topChannel: cleanOptimizationText(src?.topChannels?.[0]?.id || src?.topChannel),
  };
}

/**
 * Canonical office-path summary projection from office optimizer output.
 * @param {unknown} officeOptimizerOutput
 * @returns {{
 *   bestByDollar: ReturnType<typeof normalizeOptimizationOfficePathRow>,
 *   bestByOrganizerHour: ReturnType<typeof normalizeOptimizationOfficePathRow>,
 *   rows: Array<NonNullable<ReturnType<typeof normalizeOptimizationOfficePathRow>>>,
 * }}
 */
export function buildOptimizationOfficePathSummary(officeOptimizerOutput){
  const out = officeOptimizerOutput && typeof officeOptimizerOutput === "object"
    ? /** @type {Record<string, any>} */ (officeOptimizerOutput)
    : {};
  const rows = (Array.isArray(out?.rows) ? out.rows : [])
    .map((row) => normalizeOptimizationOfficePathRow(row))
    .filter(Boolean);
  return {
    bestByDollar: normalizeOptimizationOfficePathRow(out?.bestByDollar),
    bestByOrganizerHour: normalizeOptimizationOfficePathRow(out?.bestByOrganizerHour),
    rows,
  };
}

/**
 * Canonical office-path optimization summary builder.
 * Keeps office-path planning math out of render modules.
 *
 * @param {{
 *   officeMixRows?: unknown[],
 *   mode?: "budget" | "capacity" | string,
 *   objective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string,
 *   step?: number,
 *   useDecay?: boolean,
 *   budgetAmount?: number,
 *   includeOverhead?: boolean,
 *   overheadAmount?: number,
 *   capacityLimit?: number,
 *   baseRates?: Record<string, any>,
 *   tacticsRaw?: Record<string, any>,
 *   state?: Record<string, any>,
 *   workforce?: Record<string, any>,
 *   organizerHoursPerWeek?: number | null,
 *   weeksRemaining?: number | null,
 *   buildOptimizationTactics?: ((input: Record<string, any>) => unknown[]),
 *   runOfficeOptimizer?: ((input: Record<string, any>) => Record<string, any> | null),
 * }} input
 * @returns {{
 *   bestByDollar: ReturnType<typeof normalizeOptimizationOfficePathRow>,
 *   bestByOrganizerHour: ReturnType<typeof normalizeOptimizationOfficePathRow>,
 *   rows: Array<NonNullable<ReturnType<typeof normalizeOptimizationOfficePathRow>>>,
 * } | null}
 */
export function buildOfficeOptimizationSummary({
  officeMixRows = [],
  mode = "budget",
  objective = "net",
  step = 25,
  useDecay = false,
  budgetAmount = 0,
  includeOverhead = false,
  overheadAmount = 0,
  capacityLimit = 0,
  baseRates = {},
  tacticsRaw = {},
  state = {},
  workforce = {},
  organizerHoursPerWeek = null,
  weeksRemaining = null,
  buildOptimizationTactics = null,
  runOfficeOptimizer = null,
} = {}){
  if (typeof buildOptimizationTactics !== "function"){
    return null;
  }
  const runOffice = typeof runOfficeOptimizer === "function"
    ? runOfficeOptimizer
    : optimizeMixByOffice;
  const officeMix = Array.isArray(officeMixRows) ? officeMixRows : [];
  if (!officeMix.length){
    return null;
  }

  const sharedWorkforce = workforce && typeof workforce === "object" ? workforce : {};
  const resolvedStep = Number.isFinite(Number(step))
    ? Math.max(1, roundWholeNumberByMode(step, { mode: "floor", fallback: 25 }) ?? 25)
    : 25;
  const resolvedBudget = resolveOptimizationBudgetAvailable({
    budgetAmount,
    includeOverhead: !!includeOverhead,
    overheadAmount,
  });
  const resolvedCapacity = resolveOptimizationCapacityLimit({
    capacityAttempts: capacityLimit,
    fallbackCapacity: 0,
  }) ?? 0;
  const resolvedHoursPerWeek = finiteInputOrNull(organizerHoursPerWeek);
  const resolvedWeeksRaw = finiteInputOrNull(weeksRemaining);
  const resolvedWeeks = resolvedWeeksRaw == null ? null : Math.max(0, resolvedWeeksRaw);

  const plans = [];
  for (const row of officeMix){
    const officeId = cleanOptimizationText(row?.officeId) || "unassigned";
    const officeWorkforce = {
      ...sharedWorkforce,
      organizerCount: Number.isFinite(Number(row?.organizerCount)) ? Number(row.organizerCount) : 0,
      paidCanvasserCount: Number.isFinite(Number(row?.paidCanvasserCount)) ? Number(row.paidCanvasserCount) : 0,
      activeVolunteerCount: Number.isFinite(Number(row?.activeVolunteerCount)) ? Number(row.activeVolunteerCount) : 0,
    };
    const officeTactics = buildOptimizationTactics({
      baseRates: baseRates && typeof baseRates === "object" ? baseRates : {},
      tactics: tacticsRaw && typeof tacticsRaw === "object" ? tacticsRaw : {},
      workforce: officeWorkforce,
      state: state && typeof state === "object" ? state : {},
    });
    if (!Array.isArray(officeTactics) || !officeTactics.length){
      continue;
    }
    plans.push({
      officeId,
      officeName: officeId,
      mode: String(mode || "budget") === "capacity" ? "capacity" : "budget",
      objective,
      step: resolvedStep,
      useDecay: !!useDecay,
      budget: resolvedBudget,
      capacity: resolvedCapacity,
      organizerCount: officeWorkforce.organizerCount,
      organizerHoursPerWeek: resolvedHoursPerWeek,
      weeksRemaining: resolvedWeeks,
      tactics: officeTactics,
    });
  }
  if (!plans.length){
    return null;
  }

  const out = runOffice({
    defaultObjective: objective,
    defaultStep: resolvedStep,
    defaultUseDecay: !!useDecay,
    offices: plans,
  });
  if (!out || typeof out !== "object"){
    return null;
  }

  return buildOptimizationOfficePathSummary(out);
}

/**
 * Canonical allocation summary builder for Plan/reporting surfaces.
 * Keeps objective math and uplift aggregation out of UI render modules.
 * @param {{
 *   tactics?: Array<Record<string, any>> | null,
 *   allocation?: Record<string, number> | null,
 *   totals?: { attempts?: number, cost?: number, netVotes?: number } | null,
 *   objective?: "net" | "turnout" | "uplift" | "uplift_turnout" | "uplift_robust" | string,
 *   needObjectiveValue?: number | null,
 *   includeOverhead?: boolean,
 *   overheadAmount?: number | null,
 * }} input
 */
export function buildOptimizationExecutionSummary({
  tactics = [],
  allocation = null,
  totals = null,
  objective = "net",
  needObjectiveValue = null,
  includeOverhead = false,
  overheadAmount = 0,
} = {}){
  const clean = validateTactics(tactics);
  const alloc = allocation && typeof allocation === "object" ? allocation : {};
  const rows = [];

  let attemptsTotal = 0;
  let costTotal = 0;
  let objectiveTotal = 0;

  let upliftExpectedWeighted = 0;
  let upliftExpectedWeight = 0;
  let upliftLowWeighted = 0;
  let upliftLowWeight = 0;
  let saturationWeighted = 0;
  let saturationWeight = 0;
  let bestChannelByGainPerDollar = null;
  let bestGainPerDollar = Number.NEGATIVE_INFINITY;
  const upliftSourceWeight = new Map();

  for (const tactic of clean){
    const attempts = Math.max(0, clampNumber(alloc[tactic.id], 0));
    if (!(attempts > 0)) continue;

    const usedCr = Math.max(0, clampNumber(tactic?.used?.cr, 0));
    const objectiveValuePerAttempt = Math.max(0, clampNumber(pickTacticValuePerAttempt(tactic, objective), 0));
    const expectedContacts = attempts * usedCr;
    const expectedObjectiveValue = attempts * objectiveValuePerAttempt;
    const cost = attempts * Math.max(0, clampNumber(tactic.costPerAttempt, 0));
    const costPerObjectiveValue = expectedObjectiveValue > 0 ? (cost / expectedObjectiveValue) : null;

    const upliftExpectedMarginalGain = finiteOrNull(tactic?.production?.effects?.uplift?.expectedMarginalGain);
    const upliftLowMarginalGain = finiteOrNull(tactic?.production?.effects?.uplift?.lowMarginalGain);
    const upliftGainPerDollar = finiteOrNull(tactic?.production?.effects?.uplift?.gainPerDollar);
    const upliftUncertaintyBand = cleanOptimizationText(tactic?.production?.effects?.uplift?.uncertaintyBand);
    const upliftSaturationPressure = cleanOptimizationText(tactic?.production?.effects?.uplift?.saturationPressure);
    const upliftBestChannel = !!tactic?.production?.effects?.uplift?.bestChannel;
    const upliftSource = normalizeUpliftSource(tactic?.production?.effects?.uplift?.source);
    if (upliftSource !== UPLIFT_SOURCE_UNKNOWN){
      upliftSourceWeight.set(
        upliftSource,
        Number(upliftSourceWeight.get(upliftSource) || 0) + attempts,
      );
    }

    if (upliftBestChannel){
      bestChannelByGainPerDollar = String(tactic.id);
    } else if (upliftGainPerDollar != null && upliftGainPerDollar > bestGainPerDollar){
      bestGainPerDollar = upliftGainPerDollar;
      if (!bestChannelByGainPerDollar){
        bestChannelByGainPerDollar = String(tactic.id);
      }
    }

    if (upliftExpectedMarginalGain != null){
      upliftExpectedWeighted += attempts * upliftExpectedMarginalGain;
      upliftExpectedWeight += attempts;
    }
    if (upliftLowMarginalGain != null){
      upliftLowWeighted += attempts * upliftLowMarginalGain;
      upliftLowWeight += attempts;
    }

    const saturationCapAttemptsRaw = finiteOrNull(tactic?.production?.effects?.turnout?.saturationCapAttempts);
    const saturationCapAttempts = (saturationCapAttemptsRaw != null && saturationCapAttemptsRaw > 0)
      ? saturationCapAttemptsRaw
      : (tactic.maxAttempts != null ? Math.max(0, clampNumber(tactic.maxAttempts, 0)) : null);
    const saturationUtilization = (saturationCapAttempts != null && saturationCapAttempts > 0)
      ? Math.max(0, attempts / saturationCapAttempts)
      : null;
    if (saturationUtilization != null){
      saturationWeighted += attempts * saturationUtilization;
      saturationWeight += attempts;
    }

    rows.push({
      id: String(tactic.id),
      tactic: String(tactic.label || tactic.id),
      attempts,
      expectedContacts,
      objectiveValuePerAttempt,
      expectedObjectiveValue,
      expectedNetVotes: expectedObjectiveValue,
      cost,
      costPerObjectiveValue,
      costPerNetVote: costPerObjectiveValue,
      upliftExpectedMarginalGain,
      upliftLowMarginalGain,
      upliftGainPerDollar,
      upliftSource: upliftSource === UPLIFT_SOURCE_UNKNOWN ? "" : upliftSource,
      upliftUncertaintyBand,
      upliftSaturationPressure,
      upliftBestChannel,
      saturationCapAttempts,
      saturationUtilization,
    });

    attemptsTotal += attempts;
    costTotal += cost;
    objectiveTotal += expectedObjectiveValue;
  }

  rows.sort((a, b) => Number(b.attempts) - Number(a.attempts));

  const totalsAttempts = finiteOrNull(totals?.attempts);
  const totalsCost = finiteOrNull(totals?.cost);
  const totalsObjective = finiteOrNull(totals?.netVotes);
  const overhead = Math.max(0, clampNumber(overheadAmount, 0));

  const finalAttempts = totalsAttempts != null ? totalsAttempts : attemptsTotal;
  const finalCost = (totalsCost != null ? totalsCost : costTotal) + ((includeOverhead && overhead > 0) ? overhead : 0);
  const finalObjectiveValue = totalsObjective != null ? totalsObjective : objectiveTotal;

  const need = finiteOrNull(needObjectiveValue);
  const gapObjectiveValue = (need != null) ? Math.max(0, need - finalObjectiveValue) : null;

  const weightedExpectedMarginalGain = upliftExpectedWeight > 0
    ? (upliftExpectedWeighted / upliftExpectedWeight)
    : null;
  const weightedLowMarginalGain = upliftLowWeight > 0
    ? (upliftLowWeighted / upliftLowWeight)
    : weightedExpectedMarginalGain;
  const uncertaintySpread = (weightedExpectedMarginalGain != null && weightedLowMarginalGain != null)
    ? Math.max(0, weightedExpectedMarginalGain - weightedLowMarginalGain)
    : null;
  const relativeUncertainty = (
    weightedExpectedMarginalGain != null &&
    weightedExpectedMarginalGain > 0 &&
    uncertaintySpread != null
  )
    ? (uncertaintySpread / weightedExpectedMarginalGain)
    : null;
  const weightedSaturationUtilization = saturationWeight > 0
    ? (saturationWeighted / saturationWeight)
    : null;

  let uncertaintyBand = "unknown";
  if (relativeUncertainty != null){
    if (relativeUncertainty <= 0.15) uncertaintyBand = "low";
    else if (relativeUncertainty <= 0.32) uncertaintyBand = "medium";
    else uncertaintyBand = "high";
  }

  let saturationPressure = "unknown";
  if (weightedSaturationUtilization != null){
    if (weightedSaturationUtilization >= 0.9) saturationPressure = "high";
    else if (weightedSaturationUtilization >= 0.7) saturationPressure = "medium";
    else saturationPressure = "low";
  }

  let upliftSource = UPLIFT_SOURCE_UNKNOWN;
  let upliftSourceBestWeight = Number.NEGATIVE_INFINITY;
  for (const [source, weight] of upliftSourceWeight.entries()){
    if (weight > upliftSourceBestWeight){
      upliftSourceBestWeight = weight;
      upliftSource = source;
    }
  }

  return {
    rows,
    totals: {
      attempts: finalAttempts,
      cost: finalCost,
      objectiveValue: finalObjectiveValue,
      gapObjectiveValue,
    },
    topAllocations: rows.slice(0, 3).map((row) => ({
      id: row.id,
      tactic: row.tactic,
      attempts: row.attempts,
    })),
    uplift: {
      source: upliftSource,
      bestChannel: bestChannelByGainPerDollar,
      weightedExpectedMarginalGain,
      weightedLowMarginalGain,
      uncertaintySpread,
      uncertaintyBand,
      weightedSaturationUtilization,
      saturationPressure,
    },
  };
}

/**
 * @param {{ first: number, second: number, third: number, mults?: number[] }} input
 * @returns {Array<{ upto: number, mult: number }>}
 */
export function makeDecayTiers({ first, second, third, mults }) {
  const m = Array.isArray(mults) ? mults : [1, 0.85, 0.7, 0.55];
  return [
    { upto: clampNumber(first, 0), mult: clampNumber(m[0], 1) },
    { upto: clampNumber(second, Infinity), mult: clampNumber(m[1], 1) },
    { upto: clampNumber(third, Infinity), mult: clampNumber(m[2], 1) },
    { upto: Infinity, mult: clampNumber(m[3], 1) },
  ].filter(t => Number.isFinite(t.upto) && t.upto > 0);
}
