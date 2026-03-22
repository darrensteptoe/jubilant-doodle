// @ts-check
import { computeProjectedSlipDays } from "./executionPlanner.js";
import {
  coerceFiniteNumber,
  formatFixedNumber,
  formatPercentFromUnit,
  formatSignedPercentFromUnit,
  formatSignedPointsFromUnit,
  formatWholeNumberByMode,
  roundWholeNumberByMode,
} from "./utils.js";
import { deriveLegacyScenarioDivergence } from "./scenarioView.js";
import { classifyUnifiedStatusTone } from "./statusTone.js";

export const DECISION_STATUS_UNAVAILABLE = "Unavailable";
export const DECISION_STATUS_AWAITING_DECISION = "Awaiting decision";

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionSessionCardStatus(view){
  if (!view || !view.session){
    return "Awaiting session";
  }
  const scenarioLabel = String(view.session?.scenarioLabel || "").trim();
  if (scenarioLabel && scenarioLabel !== "—"){
    return "Session linked";
  }
  return "Session active";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionDetailCardStatus(view){
  if (!view || !view.session){
    return "Awaiting detail";
  }
  const budget = String(view.session?.constraints?.budget || "").trim();
  const volunteerHrs = String(view.session?.constraints?.volunteerHrs || "").trim();
  const nonNegotiables = String(view.session?.nonNegotiablesText || "").trim();
  if (budget || volunteerHrs || nonNegotiables){
    return "Constraints set";
  }
  return "Awaiting detail";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionOptionsCardStatus(view){
  if (!view || !view.session){
    return "Awaiting option";
  }
  const options = Array.isArray(view.options) ? view.options : [];
  if (!options.length){
    return "Awaiting option";
  }
  const scenarioLabel = String(view.activeOption?.scenarioLabel || "").trim();
  if (scenarioLabel && scenarioLabel !== "—"){
    return "Option linked";
  }
  return "Options ready";
}

/**
 * @param {Record<string, any> | null | undefined} drift
 * @param {Record<string, any> | null | undefined} risk
 * @param {Record<string, any> | null | undefined} bneck
 * @param {Record<string, any> | null | undefined} sens
 * @param {Record<string, any> | null | undefined} conf
 * @returns {string}
 */
export function deriveDecisionDiagnosticsCardStatus(drift, risk, bneck, sens, conf){
  const combined = [
    drift?.banner,
    risk?.banner,
    bneck?.warn,
    sens?.banner,
    conf?.banner
  ].join(" ").toLowerCase();
  if (combined.includes("unavailable")){
    return DECISION_STATUS_UNAVAILABLE;
  }
  if (combined.includes("run snapshot")){
    return "Run snapshot";
  }
  if (combined.includes("risk") || combined.includes("drift") || combined.includes("constraint")){
    return "Watch diagnostics";
  }
  if (combined.replace(/—/g, "").trim()){
    return "Diagnostics ready";
  }
  return "Awaiting diagnostics";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @returns {string}
 */
export function deriveDecisionActionCardStatus(view){
  if (!view || !view.session){
    return "Awaiting recommendation";
  }
  const recommended = String(view.summary?.recommendedOptionLabel || "").trim();
  const copyStatus = String(view.copyStatus || "").toLowerCase();
  if (copyStatus.includes("copied") || copyStatus.includes("download")){
    return "Export ready";
  }
  if (recommended && recommended !== "—"){
    return "Recommendation set";
  }
  return "Awaiting recommendation";
}

/**
 * @param {Record<string, any> | null | undefined} view
 * @param {Record<string, any> | null | undefined} conf
 * @param {Record<string, any> | null | undefined} risk
 * @param {Record<string, any> | null | undefined} bneck
 * @returns {string}
 */
export function deriveDecisionSummaryCardStatus(view, conf, risk, bneck){
  if (!view || !view.session){
    return "Awaiting session";
  }
  const confidence = String(conf?.tag || view.summary?.confidenceTag || "").trim();
  const riskTag = String(risk?.tag || view.summary?.riskTag || "").trim();
  const bottleneck = String(bneck?.tag || view.summary?.bottleneckTag || "").trim();
  if (confidence && confidence !== "—"){
    return confidence;
  }
  if (riskTag && riskTag !== "—"){
    return riskTag;
  }
  if (bottleneck && bottleneck !== "—"){
    return bottleneck;
  }
  return "Decision active";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyDecisionStatusTone(text){
  return classifyUnifiedStatusTone(text);
}

/**
 * @param {{
 *   execStatus?: string | null | undefined,
 *   riskBand?: string | null | undefined,
 *   tightLabel?: string | null | undefined,
 *   divergenceLabel?: string | null | undefined,
 *   slipDays?: number | null | undefined,
 * }} input
 * @returns {{
 *   score: number,
 *   rating: "Strong" | "Moderate" | "Low",
 *   tone: "ok" | "warn" | "bad",
 *   banner: string,
 *   driverLines: string[],
 * }}
 */
export function computeDecisionConfidenceComposite({
  execStatus = null,
  riskBand = null,
  tightLabel = null,
  divergenceLabel = null,
  slipDays = null,
} = {}){
  const scoreExec = (() => {
    if (execStatus === "green") return 25;
    if (execStatus === "yellow") return 15;
    if (execStatus === "red") return 5;
    return 10;
  })();
  const scoreRisk = (() => {
    if (riskBand === "high") return 25;
    if (riskBand === "lean") return 15;
    if (riskBand === "volatile") return 5;
    return 10;
  })();
  const scoreTight = (() => {
    if (tightLabel === "Clear") return 25;
    if (tightLabel === "Binding") return 15;
    if (tightLabel === "Severe") return 5;
    return 10;
  })();
  const scoreDivergence = (() => {
    if (divergenceLabel === "Low") return 25;
    if (divergenceLabel === "Moderate") return 15;
    if (divergenceLabel === "High") return 5;
    return 10;
  })();

  const score = scoreExec + scoreRisk + scoreTight + scoreDivergence;
  const rating = score >= 80 ? "Strong" : (score >= 50 ? "Moderate" : "Low");
  const tone = rating === "Strong" ? "ok" : (rating === "Moderate" ? "warn" : "bad");
  const driverLines = [];

  if (Number.isFinite(Number(slipDays)) && Number(slipDays) > 0){
    const slipDaysRounded = roundWholeNumberByMode(slipDays, { mode: "round", fallback: null });
    driverLines.push(`If pace holds, target slips by ~${formatWholeNumberByMode(slipDaysRounded, { mode: "round", fallback: "—" })} days.`);
  }

  if (execStatus === "red") driverLines.push("Execution pace is off required weekly pace.");
  else if (execStatus === "yellow") driverLines.push("Execution pace is drifting from required weekly pace.");

  if (riskBand === "volatile") driverLines.push("Monte Carlo outputs are volatile.");
  else if (riskBand === "lean") driverLines.push("Win probability is lean rather than secure.");

  if (tightLabel === "Severe") driverLines.push("Multiple constraints are binding simultaneously.");
  else if (tightLabel === "Binding") driverLines.push("At least one constraint is binding.");

  if (divergenceLabel === "High") driverLines.push("Active scenario diverges meaningfully from baseline.");
  else if (divergenceLabel === "Moderate") driverLines.push("Active scenario differs from baseline in several assumptions.");

  const banner = driverLines.length
    ? driverLines.slice(0, 3).join(" ")
    : "Confidence combines pace, risk, constraints, and scenario divergence.";

  return { score, rating, tone, banner, driverLines };
}

/**
 * @param {number | null | undefined} deltaPct
 * @returns {"green"|"yellow"|"red"|"unknown"}
 */
export function deriveDecisionExecutionPaceStatus(deltaPct){
  if (deltaPct == null || deltaPct === ""){
    return "unknown";
  }
  const pct = Number(deltaPct);
  if (!Number.isFinite(pct)){
    return "unknown";
  }
  const absPct = Math.abs(pct);
  if (absPct <= 0.05) return "green";
  if (absPct <= 0.15) return "yellow";
  return "red";
}

/**
 * @param {number | null | undefined} winProb
 * @param {number | null | undefined} volatilityWidth
 * @returns {"high"|"lean"|"volatile"|"unknown"}
 */
export function deriveDecisionRiskBand(winProb, volatilityWidth){
  if (winProb == null || winProb === ""){
    return "unknown";
  }
  const p = Number(winProb);
  if (!Number.isFinite(p)){
    return "unknown";
  }
  const width = Number(volatilityWidth);
  const hasWidth = Number.isFinite(width);
  if (p >= 0.70 && (!hasWidth || width <= 8)) return "high";
  if (p >= 0.55 && (!hasWidth || width <= 14)) return "lean";
  return "volatile";
}

/**
 * @param {Record<string, any> | null | undefined} bindingObj
 * @returns {{ cls: "ok"|"warn"|"bad"| "", label: "Clear"|"Binding"|"Severe"|"—" }}
 */
export function deriveDecisionConstraintTightness(bindingObj){
  if (!bindingObj || typeof bindingObj !== "object"){
    return { cls: "", label: "—" };
  }
  const active = [];
  if (bindingObj.budget) active.push("budget");
  if (bindingObj.capacity) active.push("capacity");
  if (Array.isArray(bindingObj.timeline) && bindingObj.timeline.length) active.push("timeline");
  if (!active.length) return { cls: "ok", label: "Clear" };
  if (active.length === 1) return { cls: "warn", label: "Binding" };
  return { cls: "bad", label: "Severe" };
}

export const DECISION_DIVERGENCE_KEY_ORDER = Object.freeze([
  "raceType", "mode", "electionDate", "weeksRemaining",
  "universeBasis", "universeSize", "goalSupportIds",
  "supportRatePct", "contactRatePct", "turnoutReliabilityPct",
  "orgCount", "orgHoursPerWeek", "volunteerMultBase"
]);

const toFiniteNumber = coerceFiniteNumber;

function valuesEqualLoose(a, b){
  return (a === b) || (String(a ?? "") === String(b ?? ""));
}

function formatWhole(value, formatInt){
  const n = toFiniteNumber(value);
  if (n == null) return "—";
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: null });
  if (rounded == null) return "—";
  if (typeof formatInt === "function"){
    return String(formatInt(rounded));
  }
  return formatWholeNumberByMode(rounded, { mode: "round", fallback: "—" });
}

function formatPctSigned01(value, digits = 1){
  return formatSignedPercentFromUnit(value, digits);
}

function formatPct01(value, digits = 1){
  return formatPercentFromUnit(value, digits);
}

function formatSignedWhole(value, formatInt){
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: null });
  if (rounded == null) return "—";
  const abs = Math.abs(rounded);
  const whole = (typeof formatInt === "function")
    ? String(formatInt(abs))
    : formatWholeNumberByMode(abs, { mode: "round", fallback: "—" });
  if (rounded > 0){
    return `+${whole}`;
  }
  if (rounded < 0){
    return `-${whole}`;
  }
  return "0";
}

/**
 * Canonical conversion-panel text projection for execution diagnostics.
 * Keeps workload number formatting out of render modules.
 * @param {Record<string, any> | null | undefined} conversionSnapshot
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {{
 *   conversationsNeededText: string,
 *   doorsNeededText: string,
 *   doorsPerShiftText: string,
 *   totalShiftsText: string,
 *   shiftsPerWeekText: string,
 *   volunteersNeededText: string,
 *   feasibility: { kind: "ok"|"warn"|"bad"|string, text: string, shown: boolean },
 * }}
 */
export function buildDecisionConversionPanelView(conversionSnapshot, options = {}){
  const src = conversionSnapshot && typeof conversionSnapshot === "object" ? conversionSnapshot : {};
  const formatInt = typeof options?.formatInt === "function" ? options.formatInt : null;
  const fmtCeil = (value) => {
    const n = toFiniteNumber(value);
    if (n == null) return "—";
    const rounded = roundWholeNumberByMode(n, { mode: "ceil", fallback: null });
    return rounded == null ? "—" : formatWhole(rounded, formatInt);
  };
  const fmtRound = (value) => {
    const n = toFiniteNumber(value);
    if (n == null) return "—";
    const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: null });
    return rounded == null ? "—" : formatWhole(rounded, formatInt);
  };
  const feasibility = src?.feasibility && typeof src.feasibility === "object" ? src.feasibility : {};
  return {
    conversationsNeededText: fmtCeil(src?.conversationsNeeded),
    doorsNeededText: fmtCeil(src?.doorsNeeded),
    doorsPerShiftText: fmtRound(src?.doorsPerShift),
    totalShiftsText: fmtCeil(src?.totalShifts),
    shiftsPerWeekText: fmtCeil(src?.shiftsPerWeek),
    volunteersNeededText: fmtCeil(src?.volunteersNeeded),
    feasibility: {
      kind: String(feasibility?.kind || ""),
      text: String(feasibility?.text || ""),
      shown: Boolean(feasibility?.shown),
    },
  };
}

/**
 * @param {{ executionSnapshot?: Record<string, any> | null, weeklyContext?: Record<string, any> | null, formatInt?: ((value: number) => string) | null, weeksRemaining?: number | null }} input
 * @returns {{
 *   tag: string,
 *   cls: "ok"|"warn"|"bad"| "",
 *   reqText: string,
 *   actualText: string,
 *   deltaText: string,
 *   banner: string,
 *   paceStatus: "green"|"yellow"|"red"|"unknown",
 *   paceLabel: string,
 *   deltaPct: number | null,
 *   req: number | null,
 *   actual: number | null,
 *   slipDays: number | null,
 *   hasLog: boolean,
 * }}
 */
export function buildDecisionDriftSnapshotView({
  executionSnapshot = null,
  weeklyContext = null,
  formatInt = null,
  weeksRemaining = null,
} = {}){
  const req = toFiniteNumber(executionSnapshot?.pace?.requiredAttemptsPerWeek)
    ?? toFiniteNumber(weeklyContext?.attemptsPerWeek);
  const hasLog = !!executionSnapshot?.log?.hasLog;
  const actual = hasLog ? toFiniteNumber(executionSnapshot?.log?.sumAttemptsWindow) : null;

  const ratio = toFiniteNumber(executionSnapshot?.pace?.ratio);
  let delta = null;
  if (ratio != null){
    delta = ratio - 1;
  } else if (req != null && req > 0 && actual != null){
    delta = (actual - req) / req;
  }

  const paceStatus = deriveDecisionExecutionPaceStatus(delta);
  const cls = paceStatus === "green" ? "ok"
    : paceStatus === "yellow" ? "warn"
    : paceStatus === "red" ? "bad"
    : "";
  const tag = paceStatus === "green" ? "Green"
    : paceStatus === "yellow" ? "Yellow"
    : paceStatus === "red" ? "Red"
    : "Not tracking";
  const paceLabel = paceStatus === "green" ? "On pace"
    : paceStatus === "yellow" ? "Drifting"
    : paceStatus === "red" ? "Off pace"
    : "—";
  const slipDaysRaw = toFiniteNumber(executionSnapshot?.pace?.projectedSlipDays);
  let slipDays = slipDaysRaw == null ? null : Math.max(0, roundWholeNumberByMode(slipDaysRaw, { mode: "round", fallback: 0 }));
  if (slipDays == null && delta != null && req != null && req > 0 && actual != null && actual > 0){
    const weeks = toFiniteNumber(weeksRemaining);
    if (weeks != null && weeks > 0){
      slipDays = computeProjectedSlipDays({
        attemptsNeeded: req * weeks,
        attemptsCompleted: 0,
        attemptsPerWeek: actual,
        weeksRemaining: weeks,
      });
    }
  }
  const banner = !hasLog
    ? "Add daily log entries in organizer.html to activate drift detection."
    : slipDays == null
      ? "At current pace, projected slip unavailable under current inputs."
      : slipDays === 0
        ? "At current pace, target completion stays on schedule."
        : `At current pace, target completion shifts by +${formatWhole(slipDays, formatInt)} days.`;

  return {
    tag,
    cls,
    reqText: formatWhole(req, formatInt),
    actualText: formatWhole(actual, formatInt),
    deltaText: formatPctSigned01(delta, 1),
    banner,
    paceStatus,
    paceLabel,
    deltaPct: delta,
    req,
    actual,
    slipDays,
    hasLog,
  };
}

/**
 * @param {{ mcResult?: Record<string, any> | null, clampFn?: ((value: number, min: number, max: number) => number) | null }} input
 * @returns {{
 *   tag: string,
 *   cls: "ok"|"warn"|"bad"| "",
 *   winProbText: string,
 *   marginBandText: string,
 *   volatilityText: string,
 *   banner: string,
 *   band: "high"|"lean"|"volatile"|"unknown",
 *   winProb: number | null,
 *   volatilityWidth: number | null,
 * }}
 */
export function buildDecisionRiskSnapshotView({
  mcResult = null,
  clampFn = null,
} = {}){
  if (!mcResult){
    return {
      tag: "—",
      cls: "",
      winProbText: "—",
      marginBandText: "—",
      volatilityText: "—",
      banner: "Run Monte Carlo to enable risk framing.",
      band: "unknown",
      winProb: null,
      volatilityWidth: null,
    };
  }

  const clamp = typeof clampFn === "function"
    ? clampFn
    : (value, min, max) => Math.min(max, Math.max(min, value));
  const winProbRaw = toFiniteNumber(mcResult.winProb);
  const winProb = winProbRaw == null ? null : clamp(winProbRaw, 0, 1);
  const percentiles = mcResult?.confidenceEnvelope?.percentiles || null;
  const low = toFiniteNumber(percentiles?.p10) ?? toFiniteNumber(percentiles?.p5);
  const high = toFiniteNumber(percentiles?.p90) ?? toFiniteNumber(percentiles?.p95);
  const volatilityWidth = (low != null && high != null) ? (high - low) : null;
  const band = deriveDecisionRiskBand(winProb, volatilityWidth);

  const tag = band === "high" ? "High confidence"
    : band === "lean" ? "Lean"
    : band === "volatile" ? "Volatile"
    : "—";
  const cls = band === "high" ? "ok"
    : band === "lean" ? "warn"
    : band === "volatile" ? "bad"
    : "";
  const banner = band === "high"
    ? "Model indicates a durable advantage under current assumptions."
    : band === "lean"
      ? "Outcome is favorable but still sensitive to execution drift."
      : band === "volatile"
        ? "Outcome is fragile; small assumption shifts can change the forecast."
        : "Risk framing unavailable.";
  const marginBandText = (low != null && high != null)
    ? `${formatFixedNumber(low, 1)} to ${formatFixedNumber(high, 1)}`
    : "—";

  return {
    tag,
    cls,
    winProbText: formatPct01(winProb, 1),
    marginBandText,
    volatilityText: volatilityWidth == null ? "—" : formatFixedNumber(volatilityWidth, 1),
    banner,
    band,
    winProb,
    volatilityWidth,
  };
}

/**
 * @param {{ bindingObj?: Record<string, any> | null, primaryBottleneck?: string | null, secondaryNotes?: string | null }} input
 * @returns {{
 *   tag: "Clear"|"Binding"|"Severe"|"—",
 *   cls: "ok"|"warn"|"bad"| "",
 *   primary: string,
 *   secondary: string,
 *   warn: string,
 *   rows: any[],
 *   tightness: { cls: "ok"|"warn"|"bad"| "", label: "Clear"|"Binding"|"Severe"|"—" },
 * }}
 */
export function buildDecisionBottleneckSnapshotView({
  bindingObj = null,
  primaryBottleneck = null,
  secondaryNotes = null,
} = {}){
  const obj = (bindingObj && typeof bindingObj === "object") ? bindingObj : {};
  const timeline = Array.isArray(obj.timeline) ? obj.timeline : [];
  const tightness = deriveDecisionConstraintTightness(obj);
  const tag = tightness.label;
  const cls = tightness.cls;
  const primary = String(primaryBottleneck || "").trim()
    || (timeline[0] ? `timeline: ${timeline[0]}` : "none/unknown");
  const secondary = String(secondaryNotes || "").trim()
    || (timeline[1] ? `timeline: ${timeline[1]}` : "—");
  const warn = tag === "Clear"
    ? "No active bottleneck constraints under current optimization settings."
    : tag === "Severe"
      ? "Multiple constraints are binding at current optimization settings."
      : "Constraint stack is binding at current optimization settings.";
  return {
    tag,
    cls,
    primary,
    secondary,
    warn,
    rows: [],
    tightness,
  };
}

/**
 * Canonical bottleneck-attribution row formatter for execution diagnostics tables.
 * @param {unknown[]} rows
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {Array<{ intervention: string, deltaText: string, notes: string }>}
 */
export function buildDecisionBottleneckImpactRowsView(rows = [], options = {}){
  const list = Array.isArray(rows) ? rows : [];
  const formatInt = typeof options?.formatInt === "function" ? options.formatInt : null;
  return list.map((row) => {
    const src = row && typeof row === "object" ? row : {};
    return {
      intervention: String(src?.intervention || src?.label || "").trim() || "—",
      deltaText: formatSignedWhole(src?.deltaObjectiveValue ?? src?.deltaMaxNetVotes, formatInt),
      notes: String(src?.notes || "").trim() || "—",
    };
  });
}

/**
 * @param {Record<string, any> | null | undefined} sensitivityCache
 * @returns {{
 *   tag: string,
 *   cls: string,
 *   banner: string,
 *   rows: Array<{ perturbation: string, dWin: string, dP50: string, notes: string }>,
 * }}
 */
export function buildDecisionSensitivitySnapshotView(sensitivityCache){
  const cache = (sensitivityCache && typeof sensitivityCache === "object") ? sensitivityCache : null;
  if (!cache || !Array.isArray(cache.rows) || !cache.rows.length){
    return {
      tag: "—",
      cls: "",
      banner: "No sensitivity rows. Run snapshot.",
      rows: [],
    };
  }
  return {
    tag: cache.tag || "Snapshot",
    cls: cache.cls || "",
    banner: cache.banner || "Sensitivity snapshot available.",
    rows: cache.rows.map((row) => ({
      perturbation: row?.label || "—",
      dWin: row?.dWin || "—",
      dP50: row?.dP50 || "—",
      notes: row?.note || "",
    })),
  };
}

/**
 * Canonical sensitivity-panel state projection (empty/stale/ready states).
 * Keeps status/banner gating logic out of render modules.
 * @param {{
 *   mcResult?: Record<string, any> | null,
 *   sensitivityCache?: Record<string, any> | null,
 *   mcStaleness?: { isStale?: boolean, reasonText?: string } | null,
 * }} input
 * @returns {{
 *   runDisabled: boolean,
 *   tag: string,
 *   cls: string,
 *   banner: string,
 *   rows: Array<{ label: string, dWin: string, dP50: string, note: string }>,
 * }}
 */
export function buildDecisionSensitivityPanelView({
  mcResult = null,
  sensitivityCache = null,
  mcStaleness = null,
} = {}){
  if (!mcResult){
    return {
      runDisabled: true,
      tag: "—",
      cls: "warn",
      banner: "Run Monte Carlo to enable the sensitivity snapshot.",
      rows: [],
    };
  }
  if (mcStaleness?.isStale){
    const reason = String(mcStaleness?.reasonText || "inputs changed").trim();
    return {
      runDisabled: true,
      tag: "—",
      cls: "warn",
      banner: `Monte Carlo is stale (${reason}). Re-run MC, then run snapshot.`,
      rows: [],
    };
  }

  const snapshot = buildDecisionSensitivitySnapshotView(sensitivityCache);
  if (!snapshot.rows.length){
    return {
      runDisabled: false,
      tag: "—",
      cls: "",
      banner: "Click \"Run snapshot\" to compute small perturbation deltas (read-only).",
      rows: [],
    };
  }

  return {
    runDisabled: false,
    tag: snapshot.tag || "Snapshot",
    cls: snapshot.cls || "",
    banner: snapshot.banner || "Sensitivity snapshot available.",
    rows: snapshot.rows.map((row) => ({
      label: String(row?.perturbation || "").trim() || "—",
      dWin: String(row?.dWin || "").trim() || "—",
      dP50: String(row?.dP50 || "").trim() || "—",
      note: String(row?.notes || "").trim(),
    })),
  };
}

/**
 * Canonical mini-surface sensitivity cache computation for execution diagnostics.
 * Keeps perturbation/delta math outside render modules.
 * @param {{
 *   state?: Record<string, any> | null,
 *   lastRenderCtx?: Record<string, any> | null,
 *   clampFn?: ((value: number, min: number, max: number) => number) | null,
 *   runMonteCarloSim?: ((input: Record<string, any>) => Record<string, any> | null | undefined) | null,
 *   runs?: number,
 *   resolveCanonicalDoorsPerHourFn?: ((state: Record<string, any>) => unknown) | null,
 *   resolveCanonicalCallsPerHourFn?: ((state: Record<string, any>) => unknown) | null,
 *   setCanonicalDoorsPerHourFn?: ((state: Record<string, any>, value: unknown, options?: Record<string, any>) => void) | null,
 *   setCanonicalCallsPerHourFn?: ((state: Record<string, any>, value: unknown, options?: Record<string, any>) => void) | null,
 * }} input
 * @returns {{
 *   ok: boolean,
 *   code: string,
 *   cache?: {
 *     baseHash: string,
 *     computedAt: number,
 *     rows: Array<{ label: string, dWin: string, dP50: string, note: string }>,
 *     banner: string,
 *     tag: string,
 *     cls: string,
 *   },
 * }}
 */
export function computeDecisionSensitivityMiniSurfaceCache({
  state = null,
  lastRenderCtx = null,
  clampFn = null,
  runMonteCarloSim = null,
  runs = 2000,
  resolveCanonicalDoorsPerHourFn = null,
  resolveCanonicalCallsPerHourFn = null,
  setCanonicalDoorsPerHourFn = null,
  setCanonicalCallsPerHourFn = null,
} = {}){
  if (!state || typeof state !== "object"){
    return { ok: false, code: "missing_state" };
  }
  const base = state.mcLast;
  if (!base){
    return { ok: false, code: "missing_base_mc" };
  }
  const ctx = lastRenderCtx && typeof lastRenderCtx === "object" ? lastRenderCtx : null;
  if (!ctx || !ctx.res){
    return { ok: false, code: "missing_render_context" };
  }
  if (typeof runMonteCarloSim !== "function"){
    return { ok: false, code: "missing_simulator" };
  }

  const clamp = typeof clampFn === "function"
    ? clampFn
    : (value, min, max) => Math.min(max, Math.max(min, value));
  const weeks = (ctx.weeks != null && Number.isFinite(Number(ctx.weeks)) && Number(ctx.weeks) >= 0)
    ? Number(ctx.weeks)
    : null;
  const needVotes = (ctx.needVotes != null && Number.isFinite(Number(ctx.needVotes)) && Number(ctx.needVotes) >= 0)
    ? Number(ctx.needVotes)
    : null;
  const seed = String(state.mcSeed || "");

  const baseP = clamp(Number(base.winProb ?? 0), 0, 1);
  const baseP50 = (base.confidenceEnvelope?.percentiles?.p50 != null)
    ? Number(base.confidenceEnvelope.percentiles.p50)
    : ((base.median != null) ? Number(base.median) : null);

  const formatWinDelta = (p) => {
    if (p == null || !Number.isFinite(Number(p))){
      return "—";
    }
    const d = (Number(p) - baseP) * 100;
    const sign = d > 0 ? "+" : "";
    return `${sign}${formatFixedNumber(d, 1)} pts`;
  };
  const formatMarginDelta = (m) => {
    if (m == null || !Number.isFinite(Number(m)) || baseP50 == null || !Number.isFinite(Number(baseP50))){
      return "—";
    }
    const d = Number(m) - Number(baseP50);
    const sign = d > 0 ? "+" : "";
    return `${sign}${formatFixedNumber(d, 1)}`;
  };

  const simWin = (sim) => (sim && sim.winProb != null)
    ? clamp(Number(sim.winProb), 0, 1)
    : null;
  const simP50 = (sim) => {
    if (!sim){
      return null;
    }
    const p50 = sim.confidenceEnvelope?.percentiles?.p50;
    if (p50 != null && Number.isFinite(Number(p50))){
      return Number(p50);
    }
    const median = sim.median;
    if (median != null && Number.isFinite(Number(median))){
      return Number(median);
    }
    return null;
  };

  const bump = (v, factor, lo, hi) => {
    const n = Number(v);
    if (!Number.isFinite(n)){
      return v;
    }
    const x = n * factor;
    const lower = (lo == null) ? x : Math.max(lo, x);
    return (hi == null) ? lower : Math.min(hi, lower);
  };

  const resolveDoorsPerHour = (snapshot) => {
    if (typeof resolveCanonicalDoorsPerHourFn === "function"){
      return resolveCanonicalDoorsPerHourFn(snapshot);
    }
    return snapshot?.doorsPerHour3 ?? snapshot?.doorsPerHour ?? null;
  };
  const resolveCallsPerHour = (snapshot) => {
    if (typeof resolveCanonicalCallsPerHourFn === "function"){
      return resolveCanonicalCallsPerHourFn(snapshot);
    }
    return snapshot?.callsPerHour3 ?? snapshot?.callsPerHour ?? null;
  };
  const setDoorsPerHour = (snapshot, value) => {
    if (typeof setCanonicalDoorsPerHourFn === "function"){
      setCanonicalDoorsPerHourFn(snapshot, value, { emptyValue: "" });
      return;
    }
    snapshot.doorsPerHour = value;
    snapshot.doorsPerHour3 = value;
  };
  const setCallsPerHour = (snapshot, value) => {
    if (typeof setCanonicalCallsPerHourFn === "function"){
      setCanonicalCallsPerHourFn(snapshot, value, { emptyValue: "" });
      return;
    }
    snapshot.callsPerHour = value;
    snapshot.callsPerHour3 = value;
  };

  const s1 = structuredClone(state);
  setDoorsPerHour(
    s1,
    bump(resolveDoorsPerHour(s1), 1.10, 0.01, null),
  );

  const s2 = structuredClone(state);
  setCallsPerHour(
    s2,
    bump(resolveCallsPerHour(s2), 1.10, 0.01, null),
  );

  const s3 = structuredClone(state);
  s3.volunteerMultBase = bump(s3.volunteerMultBase, 1.10, 0.01, 10);

  const s4 = structuredClone(state);
  if (s4.gotvMode === "advanced"){
    const v = Number(s4.gotvLiftMode);
    s4.gotvLiftMode = (Number.isFinite(v) ? v : 0) + 5;
  } else {
    const v = Number(s4.gotvLiftPP);
    s4.gotvLiftPP = (Number.isFinite(v) ? v : 0) + 5;
  }

  const jobs = [
    { label: "+10% doors", nextState: s1, note: "Doors/hr x 1.10" },
    { label: "+10% phones", nextState: s2, note: "Calls/hr x 1.10" },
    { label: "+10% volunteers", nextState: s3, note: "Volunteer multiplier x 1.10" },
    { label: "+5pp turnout lift", nextState: s4, note: "GOTV lift + 5pp" },
  ];

  const rows = [];
  for (const job of jobs){
    const sim = runMonteCarloSim({
      scenario: job.nextState,
      res: ctx.res,
      weeks,
      needVotes,
      runs,
      seed,
    });
    const p = simWin(sim);
    const m = simP50(sim);
    rows.push({
      label: job.label,
      dWin: formatWinDelta(p),
      dP50: formatMarginDelta(m),
      note: job.note,
    });
  }

  const best = rows.reduce((acc, row) => {
    const parsed = parseFloat(String(row?.dWin || "").replace(/[^0-9\-\.]+/g, ""));
    if (!Number.isFinite(parsed)){
      return acc;
    }
    const abs = Math.abs(parsed);
    if (!acc || abs > acc.abs){
      return { abs, row };
    }
    return acc;
  }, null);

  const banner = best
    ? `Biggest movement in win probability: ${best.row.label} (${best.row.dWin}).`
    : "Snapshot complete.";
  const cls = (best && Number(best.abs) >= 5) ? "warn" : "ok";

  return {
    ok: true,
    code: "ok",
    cache: {
      baseHash: String(state.mcLastHash || ""),
      computedAt: Date.now(),
      rows,
      banner,
      tag: "Mini surface",
      cls,
    },
  };
}

/**
 * @param {{
 *   baselineInputs?: Record<string, any> | null,
 *   activeInputs?: Record<string, any> | null,
 *   lowThreshold?: number,
 *   moderateThreshold?: number,
 *   keyOrder?: string[] | readonly string[] | null,
 * }} input
 * @returns {{ cls: "ok"|"warn"|"bad", label: "Low"|"Moderate"|"High", diffCount: number }}
 */
export function buildDecisionDivergenceView({
  baselineInputs = null,
  activeInputs = null,
  lowThreshold = 3,
  moderateThreshold = 8,
  keyOrder = null,
} = {}){
  const keys = Array.isArray(keyOrder) ? keyOrder : null;
  if (!keys || !keys.length){
    return deriveLegacyScenarioDivergence({
      baselineInputs,
      activeInputs,
      lowThreshold,
      moderateThreshold,
    });
  }
  const base = (baselineInputs && typeof baselineInputs === "object") ? baselineInputs : {};
  const active = (activeInputs && typeof activeInputs === "object") ? activeInputs : {};
  let diffCount = 0;
  for (const key of keys){
    if (!valuesEqualLoose(base?.[key], active?.[key])){
      diffCount += 1;
    }
  }
  const low = Number.isFinite(Number(lowThreshold)) ? Math.max(0, Number(lowThreshold)) : 3;
  const moderate = Number.isFinite(Number(moderateThreshold))
    ? Math.max(low, Number(moderateThreshold))
    : 8;
  if (diffCount <= low){
    return { cls: "ok", label: "Low", diffCount };
  }
  if (diffCount <= moderate){
    return { cls: "warn", label: "Moderate", diffCount };
  }
  return { cls: "bad", label: "High", diffCount };
}

/**
 * @param {{
 *   drift?: Record<string, any> | null,
 *   risk?: Record<string, any> | null,
 *   bottleneck?: Record<string, any> | null,
 *   divergence?: Record<string, any> | null,
 * }} input
 * @returns {{
 *   tag: "Strong"|"Moderate"|"Low",
 *   cls: "ok"|"warn"|"bad",
 *   exec: string,
 *   risk: string,
 *   tight: string,
 *   divergence: string,
 *   banner: string,
 *   score: number,
 *   tone: "ok"|"warn"|"bad",
 * }}
 */
export function buildDecisionConfidenceSnapshotView({
  drift = null,
  risk = null,
  bottleneck = null,
  divergence = null,
} = {}){
  const composite = computeDecisionConfidenceComposite({
    execStatus: drift?.paceStatus || "unknown",
    riskBand: risk?.band || "unknown",
    tightLabel: bottleneck?.tag || "—",
    divergenceLabel: divergence?.label || "—",
    slipDays: drift?.slipDays ?? null,
  });
  return {
    tag: composite.rating,
    cls: composite.tone,
    exec: drift?.paceLabel || "—",
    risk: risk?.tag || "—",
    tight: bottleneck?.tag || "—",
    divergence: divergence?.label || "—",
    banner: composite.banner,
    score: composite.score,
    tone: composite.tone,
  };
}

/**
 * @param {{
 *   executionSnapshot?: Record<string, any> | null,
 *   weeklyContext?: Record<string, any> | null,
 *   mcResult?: Record<string, any> | null,
 *   clampFn?: ((value: number, min: number, max: number) => number) | null,
 *   bindingObj?: Record<string, any> | null,
 *   primaryBottleneck?: string | null,
 *   secondaryNotes?: string | null,
 *   sensitivityCache?: Record<string, any> | null,
 *   baselineInputs?: Record<string, any> | null,
 *   activeInputs?: Record<string, any> | null,
 *   divergenceKeyOrder?: string[] | readonly string[] | null,
 *   formatInt?: ((value: number) => string) | null,
 *   weeksRemaining?: number | null,
 * }} input
 * @returns {{
 *   exec: ReturnType<typeof buildDecisionDriftSnapshotView>,
 *   risk: ReturnType<typeof buildDecisionRiskSnapshotView>,
 *   bottleneck: ReturnType<typeof buildDecisionBottleneckSnapshotView>,
 *   sensitivity: ReturnType<typeof buildDecisionSensitivitySnapshotView>,
 *   confidence: ReturnType<typeof buildDecisionConfidenceSnapshotView>,
 * }}
 */
export function buildDecisionDiagnosticsSnapshotView({
  executionSnapshot = null,
  weeklyContext = null,
  mcResult = null,
  clampFn = null,
  bindingObj = null,
  primaryBottleneck = null,
  secondaryNotes = null,
  sensitivityCache = null,
  baselineInputs = null,
  activeInputs = null,
  divergenceKeyOrder = DECISION_DIVERGENCE_KEY_ORDER,
  formatInt = null,
  weeksRemaining = null,
} = {}){
  const exec = buildDecisionDriftSnapshotView({
    executionSnapshot,
    weeklyContext,
    formatInt,
    weeksRemaining,
  });
  const risk = buildDecisionRiskSnapshotView({
    mcResult,
    clampFn,
  });
  const bottleneck = buildDecisionBottleneckSnapshotView({
    bindingObj,
    primaryBottleneck,
    secondaryNotes,
  });
  const sensitivity = buildDecisionSensitivitySnapshotView(sensitivityCache);
  const divergence = buildDecisionDivergenceView({
    baselineInputs,
    activeInputs,
    keyOrder: divergenceKeyOrder,
  });
  const confidence = buildDecisionConfidenceSnapshotView({
    drift: exec,
    risk,
    bottleneck,
    divergence,
  });
  return { exec, risk, bottleneck, sensitivity, confidence };
}

function formatDecisionIntelValue(value, kind, formatInt){
  if (value == null){
    return "—";
  }
  if (typeof value === "string" && String(value).trim() === ""){
    return "—";
  }
  const n = toFiniteNumber(value);
  if (n == null){
    return "—";
  }
  const normalizedKind = String(kind || "").trim().toLowerCase();
  if (normalizedKind === "probability" || normalizedKind === "prob"){
    return formatSignedPointsFromUnit(n, 2);
  }
  const sign = n > 0 ? "+" : "";
  if (normalizedKind === "cost"){
    const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 });
    const text = (typeof formatInt === "function")
      ? String(formatInt(rounded))
      : formatWholeNumberByMode(rounded, { mode: "round", fallback: "—" });
    return `${sign}$${text}`;
  }
  if (normalizedKind === "volunteers" || normalizedKind === "volunteer" || normalizedKind === "vol"){
    return `${sign}${formatFixedNumber(n, 2)}`;
  }
  return `${sign}${n}`;
}

/**
 * Canonical decision-intelligence ranking-row projection.
 * Keeps score formatting out of render modules.
 * @param {unknown[]} rows
 * @param {{
 *   kind?: "volunteers" | "cost" | "probability" | "vol" | "prob" | string,
 *   formatInt?: ((value: number) => string) | null,
 * }=} options
 * @returns {Array<{ lever: string, valueText: string }>}
 */
export function buildDecisionIntelligenceRankingRowsView(rows = [], options = {}){
  const list = Array.isArray(rows) ? rows : [];
  const kind = String(options?.kind || "").trim().toLowerCase();
  const formatInt = typeof options?.formatInt === "function" ? options.formatInt : null;
  return list.map((row) => {
    const src = row && typeof row === "object" ? row : {};
    return {
      lever: String(src?.lever || "").trim() || "—",
      valueText: formatDecisionIntelValue(src?.value, kind, formatInt),
    };
  });
}

/**
 * Canonical decision-intelligence panel projection.
 * Keeps fallback and list projection logic out of render modules.
 * @param {unknown} rawDecisionIntel
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {{
 *   warning: string,
 *   primary: string,
 *   secondary: string,
 *   notBinding: string,
 *   recommendations: {
 *     volunteers: string,
 *     cost: string,
 *     probability: string,
 *   },
 *   rankings: {
 *     volunteers: Array<{ lever: string, valueText: string }>,
 *     cost: Array<{ lever: string, valueText: string }>,
 *     probability: Array<{ lever: string, valueText: string }>,
 *   },
 * }}
 */
export function buildDecisionIntelligencePanelView(rawDecisionIntel, options = {}){
  const di = rawDecisionIntel && typeof rawDecisionIntel === "object" ? rawDecisionIntel : {};
  const formatInt = typeof options?.formatInt === "function" ? options.formatInt : null;
  const notBindingList = Array.isArray(di?.bottlenecks?.notBinding)
    ? di.bottlenecks.notBinding.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  return {
    warning: String(di?.warning || "").trim(),
    primary: String(di?.bottlenecks?.primary || "").trim() || "—",
    secondary: String(di?.bottlenecks?.secondary || "").trim() || "—",
    notBinding: notBindingList.length ? notBindingList.join(", ") : "—",
    recommendations: {
      volunteers: String(di?.recs?.volunteers || "").trim() || "—",
      cost: String(di?.recs?.cost || "").trim() || "—",
      probability: String(di?.recs?.probability || "").trim() || "—",
    },
    rankings: {
      volunteers: buildDecisionIntelligenceRankingRowsView(di?.rankings?.volunteers, { kind: "volunteers", formatInt }),
      cost: buildDecisionIntelligenceRankingRowsView(di?.rankings?.cost, { kind: "cost", formatInt }),
      probability: buildDecisionIntelligenceRankingRowsView(di?.rankings?.probability, { kind: "probability", formatInt }),
    },
  };
}

function formatWarRoomIso(value){
  if (!value){
    return "—";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())){
    return "—";
  }
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function toFiniteOrNull(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Canonical review-baseline projection for War Room change tracking.
 * Keeps baseline-shape and value extraction out of bridge/render layers.
 * @param {{
 *   diagnostics?: Record<string, any> | null,
 *   voterSignals?: Record<string, any> | null,
 *   recommendedOptionId?: string | null,
 *   scenarioId?: string | null,
 *   reviewedAt?: string | number | Date | null,
 * }} input
 */
export function buildWarRoomReviewBaselineView({
  diagnostics = null,
  voterSignals = null,
  recommendedOptionId = null,
  scenarioId = null,
  reviewedAt = null,
} = {}){
  const d = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  const risk = d?.risk && typeof d.risk === "object" ? d.risk : {};
  const bottleneck = d?.bottleneck && typeof d.bottleneck === "object" ? d.bottleneck : {};
  const confidence = d?.confidence && typeof d.confidence === "object" ? d.confidence : {};
  const exec = d?.exec && typeof d.exec === "object" ? d.exec : {};
  const voter = voterSignals && typeof voterSignals === "object" ? voterSignals : {};
  const age = voter?.ageSegmentation && typeof voter.ageSegmentation === "object" ? voter.ageSegmentation : {};

  const reviewed = reviewedAt ? new Date(reviewedAt) : new Date();
  const reviewedIso = Number.isNaN(reviewed.getTime()) ? new Date().toISOString() : reviewed.toISOString();

  return {
    reviewedAt: reviewedIso,
    scenarioId: String(scenarioId || "").trim() || "",
    recommendedOptionId: String(recommendedOptionId || "").trim() || "",
    riskBand: String(risk?.band || "unknown").trim().toLowerCase() || "unknown",
    riskTag: String(risk?.tag || "").trim() || "—",
    bottleneckTag: String(bottleneck?.tag || "").trim() || "—",
    confidenceTag: String(confidence?.tag || "").trim() || "—",
    confidenceScore: toFiniteOrNull(confidence?.score),
    winProb: toFiniteOrNull(risk?.winProb),
    volatilityWidth: toFiniteOrNull(risk?.volatilityWidth),
    paceStatus: String(exec?.paceStatus || "unknown").trim().toLowerCase() || "unknown",
    slipDays: toFiniteOrNull(exec?.slipDays),
    ageSource: String(age?.source || "unknown").trim().toLowerCase() || "unknown",
    ageCoverageRate: toFiniteOrNull(age?.knownAgeCoverageRate),
    ageOpportunityBucket: String(age?.opportunityBucketLabel || "unknown").trim().toLowerCase() || "unknown",
    ageTurnoutRiskBucket: String(age?.turnoutRiskBucketLabel || "unknown").trim().toLowerCase() || "unknown",
    ageOpportunityScore: toFiniteOrNull(age?.opportunityScore),
    ageTurnoutRiskScore: toFiniteOrNull(age?.turnoutRiskScore),
  };
}

/**
 * Canonical War Room change classifier.
 * Classifies deltas as noise / weak signal / strong signal / actionable shift.
 * @param {{
 *   previousBaseline?: Record<string, any> | null,
 *   currentBaseline?: Record<string, any> | null,
 * }} input
 */
export function buildWarRoomChangeClassificationView({
  previousBaseline = null,
  currentBaseline = null,
} = {}){
  const prev = previousBaseline && typeof previousBaseline === "object" ? previousBaseline : null;
  const cur = currentBaseline && typeof currentBaseline === "object" ? currentBaseline : null;

  if (!cur){
    return {
      classification: "noise",
      significance: "low",
      actionability: "watch",
      score: 0,
      changedSinceReview: false,
      summary: "War Room baseline unavailable.",
      topDrivers: Object.freeze(["Capture a review baseline to enable signal classification."]),
      deltas: {
        winProbPts: null,
        winProbText: "—",
        confidenceDelta: null,
        confidenceDeltaText: "—",
        volatilityDelta: null,
        volatilityDeltaText: "—",
        ageOpportunityDelta: null,
        ageOpportunityDeltaText: "—",
        ageTurnoutRiskDelta: null,
        ageTurnoutRiskDeltaText: "—",
        riskBandChanged: false,
        bottleneckChanged: false,
        paceChanged: false,
        recommendationChanged: false,
        ageOpportunityChanged: false,
        ageTurnoutRiskChanged: false,
      },
    };
  }

  if (!prev){
    return {
      classification: "weak signal",
      significance: "medium",
      actionability: "capture-baseline",
      score: 2,
      changedSinceReview: false,
      summary: "No prior review baseline. Capture this state as the first comparison point.",
      topDrivers: Object.freeze([
        "Initial War Room review has no prior checkpoint.",
        "Capture baseline now, then classify future movement as signal or noise.",
      ]),
      deltas: {
        winProbPts: null,
        winProbText: "—",
        confidenceDelta: null,
        confidenceDeltaText: "—",
        volatilityDelta: null,
        volatilityDeltaText: "—",
        ageOpportunityDelta: null,
        ageOpportunityDeltaText: "—",
        ageTurnoutRiskDelta: null,
        ageTurnoutRiskDeltaText: "—",
        riskBandChanged: false,
        bottleneckChanged: false,
        paceChanged: false,
        recommendationChanged: false,
        ageOpportunityChanged: false,
        ageTurnoutRiskChanged: false,
      },
    };
  }

  const winProbPts = (
    cur.winProb == null || prev.winProb == null
      ? null
      : ((Number(cur.winProb) - Number(prev.winProb)) * 100)
  );
  const confidenceDelta = (
    cur.confidenceScore == null || prev.confidenceScore == null
      ? null
      : (Number(cur.confidenceScore) - Number(prev.confidenceScore))
  );
  const volatilityDelta = (
    cur.volatilityWidth == null || prev.volatilityWidth == null
      ? null
      : (Number(cur.volatilityWidth) - Number(prev.volatilityWidth))
  );
  const ageOpportunityDelta = (
    cur.ageOpportunityScore == null || prev.ageOpportunityScore == null
      ? null
      : (Number(cur.ageOpportunityScore) - Number(prev.ageOpportunityScore))
  );
  const ageTurnoutRiskDelta = (
    cur.ageTurnoutRiskScore == null || prev.ageTurnoutRiskScore == null
      ? null
      : (Number(cur.ageTurnoutRiskScore) - Number(prev.ageTurnoutRiskScore))
  );

  const riskBandChanged = String(cur.riskBand || "") !== String(prev.riskBand || "");
  const bottleneckChanged = String(cur.bottleneckTag || "") !== String(prev.bottleneckTag || "");
  const paceChanged = String(cur.paceStatus || "") !== String(prev.paceStatus || "");
  const recommendationChanged = String(cur.recommendedOptionId || "") !== String(prev.recommendedOptionId || "");
  const ageOpportunityChanged = String(cur.ageOpportunityBucket || "") !== String(prev.ageOpportunityBucket || "");
  const ageTurnoutRiskChanged = String(cur.ageTurnoutRiskBucket || "") !== String(prev.ageTurnoutRiskBucket || "");

  const absWinProbPts = winProbPts == null ? 0 : Math.abs(winProbPts);
  const absConfidenceDelta = confidenceDelta == null ? 0 : Math.abs(confidenceDelta);
  const absVolatilityDelta = volatilityDelta == null ? 0 : Math.abs(volatilityDelta);
  const absAgeOpportunityDelta = ageOpportunityDelta == null ? 0 : Math.abs(ageOpportunityDelta);
  const absAgeTurnoutRiskDelta = ageTurnoutRiskDelta == null ? 0 : Math.abs(ageTurnoutRiskDelta);

  let score = 0;
  if (absWinProbPts >= 4) score += 3;
  else if (absWinProbPts >= 2) score += 2;
  else if (absWinProbPts >= 1) score += 1;

  if (absConfidenceDelta >= 20) score += 3;
  else if (absConfidenceDelta >= 10) score += 2;
  else if (absConfidenceDelta >= 5) score += 1;

  if (absVolatilityDelta >= 6) score += 2;
  else if (absVolatilityDelta >= 3) score += 1;
  if (absAgeOpportunityDelta >= 0.10) score += 2;
  else if (absAgeOpportunityDelta >= 0.05) score += 1;
  if (absAgeTurnoutRiskDelta >= 0.10) score += 2;
  else if (absAgeTurnoutRiskDelta >= 0.05) score += 1;

  if (riskBandChanged) score += 2;
  if (bottleneckChanged) score += 2;
  if (paceChanged) score += 1;
  if (recommendationChanged) score += 1;
  if (ageOpportunityChanged) score += 1;
  if (ageTurnoutRiskChanged) score += 1;

  const topDrivers = [];
  if (absWinProbPts >= 1){
    const signed = formatSignedPointsFromUnit((winProbPts || 0) / 100, 1);
    topDrivers.push(`Win probability moved ${signed} since last review.`);
  }
  if (riskBandChanged){
    topDrivers.push(`Risk band changed: ${prev.riskBand || "unknown"} -> ${cur.riskBand || "unknown"}.`);
  }
  if (bottleneckChanged){
    topDrivers.push(`Primary constraint posture shifted: ${prev.bottleneckTag || "—"} -> ${cur.bottleneckTag || "—"}.`);
  }
  if (paceChanged){
    topDrivers.push(`Execution pace class changed: ${prev.paceStatus || "unknown"} -> ${cur.paceStatus || "unknown"}.`);
  }
  if (absConfidenceDelta >= 5){
    const sign = confidenceDelta > 0 ? "+" : "";
    topDrivers.push(`Confidence score moved ${sign}${formatFixedNumber(confidenceDelta, 1)} points.`);
  }
  if (ageTurnoutRiskChanged){
    topDrivers.push(`Age turnout-risk cohort changed: ${prev.ageTurnoutRiskBucket || "unknown"} -> ${cur.ageTurnoutRiskBucket || "unknown"}.`);
  }
  if (ageOpportunityChanged){
    topDrivers.push(`Age opportunity cohort changed: ${prev.ageOpportunityBucket || "unknown"} -> ${cur.ageOpportunityBucket || "unknown"}.`);
  }
  if (absAgeTurnoutRiskDelta >= 0.05){
    topDrivers.push(`Age turnout-risk score moved ${formatSignedPointsFromUnit(ageTurnoutRiskDelta || 0, 1)}.`);
  }
  if (absAgeOpportunityDelta >= 0.05){
    topDrivers.push(`Age opportunity score moved ${formatSignedPointsFromUnit(ageOpportunityDelta || 0, 1)}.`);
  }
  if (recommendationChanged){
    topDrivers.push("Recommended option changed since last review.");
  }
  if (!topDrivers.length){
    topDrivers.push("No material driver movement since last review.");
  }

  let classification = "noise";
  let significance = "low";
  let actionability = "watch";
  if (score <= 1){
    classification = "noise";
    significance = "low";
    actionability = "watch";
  } else if (score <= 3){
    classification = "weak signal";
    significance = "medium";
    actionability = "watch";
  } else if (score <= 6){
    classification = "strong signal";
    significance = "high";
    actionability = "decide";
  } else {
    classification = "actionable shift";
    significance = "critical";
    actionability = "act-now";
  }

  const changedSinceReview = score > 0;
  const summary = changedSinceReview
    ? `Classified as ${classification}; significance ${significance}.`
    : "No material change since last review (noise).";

  const winProbText = winProbPts == null
    ? "—"
    : `${winProbPts > 0 ? "+" : ""}${formatFixedNumber(winProbPts, 1)} pts`;
  const confidenceDeltaText = confidenceDelta == null
    ? "—"
    : `${confidenceDelta > 0 ? "+" : ""}${formatFixedNumber(confidenceDelta, 1)}`;
  const volatilityDeltaText = volatilityDelta == null
    ? "—"
    : `${volatilityDelta > 0 ? "+" : ""}${formatFixedNumber(volatilityDelta, 1)} pts`;
  const ageOpportunityDeltaText = ageOpportunityDelta == null
    ? "—"
    : formatSignedPointsFromUnit(ageOpportunityDelta, 1);
  const ageTurnoutRiskDeltaText = ageTurnoutRiskDelta == null
    ? "—"
    : formatSignedPointsFromUnit(ageTurnoutRiskDelta, 1);

  return {
    classification,
    significance,
    actionability,
    score,
    changedSinceReview,
    summary,
    topDrivers: Object.freeze(topDrivers.slice(0, 6)),
    deltas: {
      winProbPts,
      winProbText,
      confidenceDelta,
      confidenceDeltaText,
      volatilityDelta,
      volatilityDeltaText,
      ageOpportunityDelta,
      ageOpportunityDeltaText,
      ageTurnoutRiskDelta,
      ageTurnoutRiskDeltaText,
      riskBandChanged,
      bottleneckChanged,
      paceChanged,
      recommendationChanged,
      ageOpportunityChanged,
      ageTurnoutRiskChanged,
    },
  };
}

/**
 * Canonical War Room decision-log row projection for render/export surfaces.
 * @param {unknown[]} rows
 */
export function buildWarRoomDecisionLogRowsView(rows = []){
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    const src = row && typeof row === "object" ? row : {};
    return {
      id: String(src?.id || "").trim(),
      recordedAt: String(src?.recordedAt || "").trim(),
      recordedAtText: formatWarRoomIso(src?.recordedAt),
      classification: String(src?.classification || "").trim() || "—",
      significance: String(src?.significance || "").trim() || "—",
      actionability: String(src?.actionability || "").trim() || "—",
      owner: String(src?.owner || "").trim() || "—",
      followUpDate: String(src?.followUpDate || "").trim() || "—",
      summary: String(src?.summary || "").trim() || "—",
      status: String(src?.status || "").trim() || "open",
      topDrivers: Array.isArray(src?.topDrivers)
        ? src.topDrivers.map((value) => String(value || "").trim()).filter(Boolean)
        : [],
    };
  });
}
