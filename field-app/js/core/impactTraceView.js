// @ts-check
import { NULL_BASE_RATE_DEFAULTS, resolveStateBaseRates } from "./baseRates.js";
import { computeGoalPaceRequirements } from "./executionPlanner.js";
import { computeCapacityContacts } from "./model.js";
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorShareUnit,
  resolveCanonicalDoorsPerHour,
} from "./throughput.js";
import {
  clampFiniteNumber,
  coerceFiniteNumber,
  formatPercentFromUnit,
  formatWholeNumberByMode,
  roundWholeNumberByMode,
} from "./utils.js";

/**
 * @param {unknown} value
 * @returns {number | null}
 */
const toNumber = coerceFiniteNumber;

/**
 * @param {number | null | undefined} value
 * @param {(value: number) => string} formatInt
 * @returns {string}
 */
function formatMaybeInt(value, formatInt){
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = roundWholeNumberByMode(value, { mode: "round", fallback: 0 }) ?? 0;
  return formatInt(rounded);
}

/**
 * @param {number | null | undefined} value
 * @param {(value: number) => string} formatInt
 * @returns {string}
 */
function formatSignedInt(value, formatInt){
  if (value == null || !Number.isFinite(value)) return "—";
  const n = roundWholeNumberByMode(value, { mode: "round", fallback: 0 }) ?? 0;
  if (n > 0) return `+${formatInt(n)}`;
  if (n < 0) return `-${formatInt(Math.abs(n))}`;
  return "0";
}

/**
 * @param {number | null | undefined} value
 * @returns {string}
 */
function formatPct01(value){
  return formatPercentFromUnit(value, 1);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeListText(value){
  return Array.isArray(value) && value.length ? value.join(", ") : "—";
}

/**
 * @param {Record<string, any> | null | undefined} node
 * @returns {{ formula: string, upstream: string, dependsOn: string, note: string } | null}
 */
function buildExplainLines(node){
  if (!node || typeof node !== "object") return null;
  return {
    formula: String(node.module || "—"),
    upstream: normalizeListText(node.inputs),
    dependsOn: normalizeListText(node.dependsOn),
    note: String(node.note || "").trim() || "—",
  };
}

/**
 * @param {{
 *   state?: Record<string, any> | null,
 *   res?: Record<string, any> | null,
 *   weeks?: number | null,
 *   formatInt?: (value: number) => string,
 *   weeklyContext?: Record<string, any> | null,
 *   executionSnapshot?: Record<string, any> | null,
 * }} args
 * @returns {Array<{
 *   title: string,
 *   value: string,
 *   outputs: string,
 *   formula: string,
 *   upstream: string,
 *   downstream: string,
 *   explain?: { formula: string, upstream: string, dependsOn: string, note: string } | null,
 * }>}
 */
export function buildImpactTraceItemsView(args = {}){
  const state = (args?.state && typeof args.state === "object") ? args.state : {};
  const res = (args?.res && typeof args.res === "object") ? args.res : {};
  const weeks = Number.isFinite(Number(args?.weeks)) ? Number(args.weeks) : 0;
  const formatInt = (typeof args?.formatInt === "function")
    ? args.formatInt
    : (value) => formatWholeNumberByMode(value, { mode: "round", fallback: "0" });
  const weeklyContext = (args?.weeklyContext && typeof args.weeklyContext === "object") ? args.weeklyContext : null;
  const executionSnapshot = (args?.executionSnapshot && typeof args.executionSnapshot === "object") ? args.executionSnapshot : null;
  const explain = (res?.explain && typeof res.explain === "object") ? res.explain : null;
  const toOptionalNumber = (value) => {
    if (value == null) return null;
    if (typeof value === "string" && String(value).trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const persuasionNeed = toNumber(res?.expected?.persuasionNeed);
  const manualGoal = toNumber(state?.goalSupportIds);
  const goalSource = (manualGoal != null && manualGoal >= 0) ? "goalSupportIds (manual)" : "persuasionNeed (auto)";
  const goal = (manualGoal != null && manualGoal >= 0)
    ? manualGoal
    : ((persuasionNeed != null && persuasionNeed > 0) ? persuasionNeed : 0);

  const baseRates = resolveStateBaseRates(state, {
    defaults: NULL_BASE_RATE_DEFAULTS,
    clampMin: 0,
    clampMax: 1,
  });
  const supportRate = (baseRates.sr != null && baseRates.sr > 0) ? baseRates.sr : null;
  const contactRate = (baseRates.cr != null && baseRates.cr > 0) ? baseRates.cr : null;
  const reqDerived = computeGoalPaceRequirements({
    goalVotes: goal,
    supportRate,
    contactRate,
    weeks,
  });
  const reqConvosWeekDerived = reqDerived.convosPerWeek;
  const reqAttemptsWeekDerived = reqDerived.attemptsPerWeek;

  const orgCount = toNumber(state?.orgCount);
  const orgHoursPerWeek = toNumber(state?.orgHoursPerWeek);
  const volunteerMult = toNumber(state?.volunteerMultBase);
  const doorsPerHour = resolveCanonicalDoorsPerHour(state, { toNumber });
  const callsPerHour = resolveCanonicalCallsPerHour(state, { toNumber });
  const doorShare = resolveCanonicalDoorShareUnit(state);
  const capacityPerWeekDerived = computeCapacityContacts({
    weeks: 1,
    orgCount,
    orgHoursPerWeek,
    volunteerMult,
    doorShare,
    doorsPerHour,
    callsPerHour,
  });

  const reqAttemptsWeekFromCtx = toOptionalNumber(executionSnapshot?.pace?.requiredAttemptsPerWeek) ?? toOptionalNumber(weeklyContext?.attemptsPerWeek);
  const capacityPerWeekFromCtx = toOptionalNumber(executionSnapshot?.pace?.capacityAttemptsPerWeek) ?? toOptionalNumber(weeklyContext?.capTotal);
  const gapPerWeekFromCtx = toOptionalNumber(executionSnapshot?.pace?.gapAttemptsPerWeek) ?? toOptionalNumber(weeklyContext?.gap);

  const reqAttemptsWeek = (reqAttemptsWeekFromCtx != null) ? reqAttemptsWeekFromCtx : reqAttemptsWeekDerived;
  const capacityPerWeek = (capacityPerWeekFromCtx != null) ? capacityPerWeekFromCtx : capacityPerWeekDerived;
  const gapPerWeek = (gapPerWeekFromCtx != null)
    ? gapPerWeekFromCtx
    : ((reqAttemptsWeek != null && capacityPerWeek != null) ? (reqAttemptsWeek - capacityPerWeek) : null);

  const reqAttemptsSource = (reqAttemptsWeekFromCtx != null) ? "executionSnapshot/weeklyContext" : "state-derived fallback";
  const capacitySource = (capacityPerWeekFromCtx != null) ? "executionSnapshot/weeklyContext" : "state-derived fallback";
  const gapSource = (gapPerWeekFromCtx != null) ? "executionSnapshot/weeklyContext" : "derived from required-capacity";

  const mcWinProb = toNumber(state?.mcLast?.winProb);
  const mcRuns = toNumber(state?.mcLast?.runs);

  const overrideEnabled = !!state?.twCapOverrideEnabled;
  const overrideModeRaw = String(state?.twCapOverrideMode || "baseline");
  const overrideMode = ["baseline", "ramp", "scheduled", "max"].includes(overrideModeRaw) ? overrideModeRaw : "baseline";
  const overrideText = overrideEnabled ? `ON (${overrideMode})` : "OFF (baseline)";

  return [
    {
      title: "Win threshold",
      value: formatMaybeInt(toNumber(res?.expected?.winThreshold), formatInt),
      outputs: "kpiWinThreshold-sidebar",
      formula: "max(projected opponent votes after undecided allocation) + 1",
      upstream: "turnoutA/turnoutB/bandWidth, candidates[].supportPct, undecidedMode/userSplit",
      downstream: "kpiPersuasionNeed-sidebar",
      explain: buildExplainLines(explain?.["expected.winThreshold"]),
    },
    {
      title: "Persuasion votes needed",
      value: formatMaybeInt(persuasionNeed, formatInt),
      outputs: "kpiPersuasionNeed-sidebar, wkGoal",
      formula: "max(0, winThreshold - yourProjectedVotes)",
      upstream: "win threshold inputs + yourCandidateId + candidate support distribution",
      downstream: "wkConvosPerWeek, wkAttemptsPerWeek, p3GapContacts, wkGapPerWeek",
      explain: buildExplainLines(explain?.["expected.persuasionNeed"]),
    },
    {
      title: "Required attempts per week",
      value: formatMaybeInt(reqAttemptsWeek, formatInt),
      outputs: "wkAttemptsPerWeek",
      formula: "goal / supportRate / contactRate / weeksRemaining",
      upstream: `${goalSource}, supportRatePct, contactRatePct, weeksRemaining/electionDate (${reqAttemptsSource})`,
      downstream: "p3GapContacts, wkGapPerWeek, weekly action recommendations",
    },
    {
      title: "Capacity contacts possible per week",
      value: formatMaybeInt(capacityPerWeek, formatInt),
      outputs: "p3CapContacts, wkCapacityPerWeek",
      formula: "orgCount * orgHoursPerWeek * blendedProductivity * volunteerMultiplier",
      upstream: `orgCount, orgHoursPerWeek, channelDoorPct, doorsPerHour3, callsPerHour3, volunteerMultBase (${capacitySource})`,
      downstream: "p3GapContacts, wkGapPerWeek, bottleneck attribution",
    },
    {
      title: "Gap vs required contacts (per week)",
      value: formatSignedInt(gapPerWeek, formatInt),
      outputs: "p3GapContacts, wkGapPerWeek",
      formula: "requiredAttemptsPerWeek - capacityContactsPerWeek",
      upstream: `required attempts trace + capacity trace (${gapSource})`,
      downstream: "pace status, actions list, bottleneck/constraints messaging",
    },
    {
      title: "Monte Carlo win probability",
      value: `${formatPct01(mcWinProb)}${mcRuns != null ? ` (${formatMaybeInt(mcRuns, formatInt)} runs)` : ""}`,
      outputs: "mcWinProb-sidebar, riskBandTag-sidebar",
      formula: "count(simulatedMargins >= 0) / runs",
      upstream: "all deterministic inputs + mcMode + mcVolatility + mcSeed + runs",
      downstream: "risk framing, decision confidence, scenario comparison context",
      explain: buildExplainLines(explain?.stressSummary),
    },
    {
      title: "Operations capacity override source",
      value: overrideText,
      outputs: "twCapOutlookActiveSource",
      formula: "if overrideEnabled then selected operations source else baseline capacity",
      upstream: "twCapOverrideEnabled, twCapOverrideMode, twCapOverrideHorizonWeeks, Operations records",
      downstream: "effective capacity -> wkCapacityPerWeek/p3CapContacts -> gap and MC staleness",
    },
  ];
}
