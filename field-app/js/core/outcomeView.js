// @ts-check
import {
  formatFixedNumber,
  formatPercentFromPct as formatPercentFromPctCanonical,
  formatPercentFromUnit,
  formatStatusWithScoreOutOfHundred,
  formatWholeNumberByMode,
  roundWholeNumberByMode,
} from "./utils.js";
import { rateOverrideToDecimal } from "./voteProduction.js";

export function parsePercentNumber(rawValue){
  const text = String(rawValue || "").trim();
  if (!text || text === "—"){
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function parseSignedNumber(rawValue){
  const text = String(rawValue || "").trim();
  if (!text || text === "—"){
    return NaN;
  }
  const cleaned = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function formatSignedWhole(value){
  if (!Number.isFinite(value)){
    return "—";
  }
  const rounded = roundWholeNumberByMode(value, { mode: "round", fallback: null });
  if (rounded == null) return "—";
  if (rounded > 0){
    return `+${rounded}`;
  }
  return `${rounded}`;
}

export function formatOutcomeBridgeWinProb(value){
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  return formatPercentFromUnit(n, 1, "");
}

export function formatOutcomeBridgePercent(value){
  const unit = rateOverrideToDecimal(value, null);
  if (unit == null) {
    return "";
  }
  return formatPercentFromUnit(unit, 1, "");
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatOutcomePercentFromPct(value, digits = 1, fallback = "—"){
  return formatPercentFromPctCanonical(value, digits, fallback);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function buildOutcomeTurnoutExpectedText(value){
  return formatOutcomePercentFromPct(value, 1, "—");
}

/**
 * @param {unknown} bestPct
 * @param {unknown} worstPct
 * @returns {string}
 */
export function buildOutcomeTurnoutBandText(bestPct, worstPct){
  const bestText = formatOutcomePercentFromPct(bestPct, 1, "");
  const worstText = formatOutcomePercentFromPct(worstPct, 1, "");
  if (!bestText || !worstText){
    return "—";
  }
  return `${bestText} / ${worstText}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function buildOutcomeSupportTotalText(value){
  return formatOutcomePercentFromPct(value, 1, "—");
}

/**
 * @param {{
 *   turnoutVotes?: unknown,
 *   winThreshold?: unknown,
 *   yourVotes?: unknown,
 *   persuasionNeed?: unknown,
 *   earlyVotes?: unknown,
 *   edVotes?: unknown,
 *   persuasionUniverse?: unknown,
 * } | null | undefined} expected
 * @param {{ formatInt?: ((value: number) => string) | null }=} options
 * @returns {{
 *   turnoutVotesText: string,
 *   winThresholdText: string,
 *   yourVotesText: string,
 *   persuasionNeedText: string,
 *   earlyVotesText: string,
 *   edVotesText: string,
 *   persuasionUniverseText: string,
 * }}
 */
export function buildOutcomeExpectedVoteTexts(expected, options = {}){
  const src = expected && typeof expected === "object" ? expected : {};
  const formatInt = typeof options?.formatInt === "function"
    ? options.formatInt
    : (value) => formatWholeNumberByMode(value, { mode: "round", fallback: "—" });
  const toWholeText = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)){
      return "—";
    }
    const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: null });
    return rounded == null ? "—" : String(formatInt(rounded));
  };
  return {
    turnoutVotesText: toWholeText(src?.turnoutVotes),
    winThresholdText: toWholeText(src?.winThreshold),
    yourVotesText: toWholeText(src?.yourVotes),
    persuasionNeedText: toWholeText(src?.persuasionNeed),
    earlyVotesText: toWholeText(src?.earlyVotes),
    edVotesText: toWholeText(src?.edVotes),
    persuasionUniverseText: toWholeText(src?.persuasionUniverse),
  };
}

export function formatOutcomeBridgeWhole(value){
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  const rounded = roundWholeNumberByMode(n, { mode: "round", fallback: 0 }) ?? 0;
  return String(Math.max(0, rounded));
}

export function formatOutcomeBridgeDecimal(value, digits = 3){
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  return formatFixedNumber(n, digits, "");
}

export function formatOutcomeBridgeMargin(value){
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  return formatSignedWhole(n);
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatOutcomeSensitivityImpact(value, digits = 2, fallback = "—"){
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return formatFixedNumber(n, places, fallback);
}

/**
 * @param {unknown} value
 * @param {number=} digits
 * @param {string=} fallback
 * @returns {string}
 */
export function formatOutcomeSvgCoord(value, digits = 2, fallback = "0.00"){
  const n = Number(value);
  if (!Number.isFinite(n)){
    return fallback;
  }
  const places = Math.max(0, Math.trunc(Number(digits) || 0));
  return formatFixedNumber(n, places, fallback);
}

/**
 * @param {unknown} winProb
 * @param {{ width?: unknown }=} options
 * @returns {{ width: number, winProb: number, x: number, xText: string }}
 */
export function buildOutcomeWinProbMarkerView(winProb, options = {}){
  const widthRaw = Number(options?.width);
  const width = (Number.isFinite(widthRaw) && widthRaw > 0) ? widthRaw : 300;
  const pRaw = Number(winProb);
  const p = Number.isFinite(pRaw) ? Math.min(1, Math.max(0, pRaw)) : 0;
  const x = width * p;
  return {
    width,
    winProb: p,
    x,
    xText: formatOutcomeSvgCoord(x, 2, "0.00"),
  };
}

/**
 * @param {{ counts?: unknown, min?: unknown, max?: unknown } | null | undefined} histogram
 * @param {{ width?: unknown, baseY?: unknown, topY?: unknown }=} options
 * @returns {{
 *   valid: boolean,
 *   width: number,
 *   baseY: number,
 *   topY: number,
 *   min: number | null,
 *   max: number | null,
 *   zeroX: number,
 *   zeroXText: string,
 *   shadeXText: string,
 *   shadeWidthText: string,
 *   shadeVisible: boolean,
 *   bars: Array<{ xText: string, yText: string, widthText: string, heightText: string }>,
 * }}
 */
export function buildOutcomeHistogramVisualView(histogram, options = {}){
  const widthRaw = Number(options?.width);
  const baseYRaw = Number(options?.baseY);
  const topYRaw = Number(options?.topY);
  const width = (Number.isFinite(widthRaw) && widthRaw > 0) ? widthRaw : 300;
  const baseY = Number.isFinite(baseYRaw) ? baseYRaw : 76;
  const topY = Number.isFinite(topYRaw) ? topYRaw : 12;
  const src = histogram && typeof histogram === "object" ? histogram : {};
  const counts = Array.isArray(src?.counts) ? src.counts : [];
  const min = Number(src?.min);
  const max = Number(src?.max);

  if (!counts.length || !Number.isFinite(min) || !Number.isFinite(max)){
    return {
      valid: false,
      width,
      baseY,
      topY,
      min: null,
      max: null,
      zeroX: width / 2,
      zeroXText: formatOutcomeSvgCoord(width / 2, 2, "150.00"),
      shadeXText: "0.00",
      shadeWidthText: "0.00",
      shadeVisible: false,
      bars: [],
    };
  }

  const H = Math.max(0, baseY - topY);
  const maxC = Math.max(1, ...counts.map((value) => Number(value) || 0));
  const n = counts.length;
  const bw = n > 0 ? (width / n) : width;
  const span = (max - min) || 1;
  const zeroX = ((0 - min) / span) * width;
  const zeroXClamped = Math.max(0, Math.min(width, zeroX));
  const shadeVisible = max > 0 && min < 0;
  const shadeX = shadeVisible ? zeroXClamped : 0;
  const shadeWidth = shadeVisible ? Math.max(0, width - zeroXClamped) : 0;
  const bars = counts.map((count, index) => {
    const c = Number(count) || 0;
    const bh = Math.max(0, (c / maxC) * H);
    const x = index * bw + 0.6;
    const y = baseY - bh;
    const rectWidth = Math.max(0.5, bw - 1.2);
    return {
      xText: formatOutcomeSvgCoord(x, 2, "0.00"),
      yText: formatOutcomeSvgCoord(y, 2, "0.00"),
      widthText: formatOutcomeSvgCoord(rectWidth, 2, "0.50"),
      heightText: formatOutcomeSvgCoord(bh, 2, "0.00"),
    };
  });

  return {
    valid: true,
    width,
    baseY,
    topY,
    min,
    max,
    zeroX,
    zeroXText: formatOutcomeSvgCoord(zeroX, 2, "0.00"),
    shadeXText: formatOutcomeSvgCoord(shadeX, 2, "0.00"),
    shadeWidthText: formatOutcomeSvgCoord(shadeWidth, 2, "0.00"),
    shadeVisible,
    bars,
  };
}

export function deriveShiftFromMargin(rawMargin){
  const marginNum = parseSignedNumber(rawMargin);
  if (!Number.isFinite(marginNum)){
    return "—";
  }
  if (marginNum >= 0){
    return "0";
  }
  const shift = roundWholeNumberByMode(Math.abs(marginNum), { mode: "ceil", fallback: 0 }) ?? 0;
  return `${shift}`;
}

export function buildMissRiskSummary({ outcomeP10, outcomeWinProb, outcomeRiskLabel }){
  const p10 = parseSignedNumber(outcomeP10);
  const winProb = parsePercentNumber(outcomeWinProb);
  const risk = String(outcomeRiskLabel || "").toLowerCase();

  if (risk.includes("high")){
    return "High miss risk";
  }
  if (risk.includes("moderate") || risk.includes("watch")){
    return "Moderate miss risk";
  }

  if (Number.isFinite(winProb)){
    if (winProb < 50){
      return "High miss risk";
    }
    if (winProb < 60){
      return "Moderate miss risk";
    }
  }

  if (Number.isFinite(p10)){
    return p10 < 0 ? "Moderate miss risk (downside path negative)" : "Low miss risk";
  }

  return "Risk pending";
}

export function buildOutcomeRiskLabel({ p10, p50, p90, winProb }){
  const p10Num = parseSignedNumber(p10);
  const p50Num = parseSignedNumber(p50);
  const p90Num = parseSignedNumber(p90);
  const winProbNum = parsePercentNumber(winProb);

  if (Number.isFinite(winProbNum) && winProbNum < 50){
    return "High risk";
  }
  if (Number.isFinite(p10Num) && Number.isFinite(p50Num) && p10Num < 0 && p50Num < 0){
    return "High risk";
  }
  if (Number.isFinite(p10Num) && p10Num < 0){
    return "Moderate risk";
  }
  if (Number.isFinite(p90Num) && p90Num <= 0){
    return "Watch";
  }
  return "Low risk";
}

export function buildOutcomeFragility(p10, p90){
  const low = parseSignedNumber(p10);
  const high = parseSignedNumber(p90);
  if (!Number.isFinite(low) || !Number.isFinite(high)){
    return "Pending";
  }
  const spread = Math.abs(high - low);
  if (spread >= 80){
    return "High";
  }
  if (spread >= 40){
    return "Moderate";
  }
  return "Low";
}

export function buildOutcomeCliff(p10, p50){
  const low = parseSignedNumber(p10);
  const mid = parseSignedNumber(p50);
  if (!Number.isFinite(low) || !Number.isFinite(mid)){
    return "Pending";
  }
  if (low < 0 && mid >= 0){
    return "Potential cliff under downside path";
  }
  if (mid < 0){
    return "Active cliff risk";
  }
  return "No immediate cliff signal";
}

function buildShiftToProbability(currentProb, targetProb, p50Margin){
  if (Number.isFinite(currentProb)){
    if (currentProb >= targetProb){
      return "0";
    }
    const gap = targetProb - currentProb;
    const baseShift = roundWholeNumberByMode(gap / 2, { mode: "ceil", fallback: 1 }) ?? 1;
    if (Number.isFinite(p50Margin)){
      const penalty = p50Margin < 0
        ? (roundWholeNumberByMode(Math.abs(p50Margin), { mode: "ceil", fallback: 0 }) ?? 0)
        : 0;
      return `${Math.max(1, baseShift + penalty)}`;
    }
    return `${Math.max(1, baseShift)}`;
  }
  return "—";
}

function buildShockGuidance(p10, p50, shockSize){
  if (!Number.isFinite(p10) && !Number.isFinite(p50)){
    return "—";
  }
  const base = Number.isFinite(p50) ? p50 : p10;
  const buffered = Number.isFinite(base) ? base - shockSize : NaN;
  if (!Number.isFinite(buffered)){
    return "—";
  }
  return buffered >= 0 ? "Contained" : "Vulnerable";
}

export function buildConfidenceStats(p10, p50, p90, winProbText){
  const p10Num = parseSignedNumber(p10);
  const p50Num = parseSignedNumber(p50);
  const p90Num = parseSignedNumber(p90);
  const winProbNum = parsePercentNumber(winProbText);

  const attemptsBand = Number.isFinite(p10Num) || Number.isFinite(p50Num) || Number.isFinite(p90Num)
    ? "Use sensitivity table for P10/P50/P90 attempt deltas."
    : "Run MC to estimate attempt bands.";
  const conversationBand = Number.isFinite(p10Num) || Number.isFinite(p50Num) || Number.isFinite(p90Num)
    ? "Conversation requirement follows attempt volatility."
    : "Run MC to estimate conversation bands.";
  const finishBand = Number.isFinite(p10Num)
    ? p10Num >= 0
      ? "Finish risk low at current pace."
      : "Finish risk elevated under downside path."
    : "Run MC to estimate finish-date spread.";

  const marginOfSafety = Number.isFinite(p10Num)
    ? `${formatSignedWhole(p10Num)} net votes`
    : "—";
  const downside = Number.isFinite(p10Num)
    ? p10Num < 0
      ? "Elevated downside risk"
      : "Contained downside risk"
    : "—";
  const es10 = Number.isFinite(p10Num)
    ? `${formatSignedWhole(p10Num)} (proxy from P10)`
    : "—";

  const shiftTo60 = buildShiftToProbability(winProbNum, 60, p50Num);
  const shiftTo70 = buildShiftToProbability(winProbNum, 70, p50Num);
  const shiftTo80 = buildShiftToProbability(winProbNum, 80, p50Num);

  const shock10 = buildShockGuidance(p10Num, p50Num, 10);
  const shock25 = buildShockGuidance(p10Num, p50Num, 25);
  const shock50 = buildShockGuidance(p10Num, p50Num, 50);

  return {
    attemptsBand,
    conversationBand,
    finishBand,
    marginOfSafety,
    downside,
    es10,
    shiftTo60,
    shiftTo70,
    shiftTo80,
    shock10,
    shock25,
    shock50,
  };
}

export function buildOutcomeMcStatus(winProb, p10, p90){
  const winProbNum = parsePercentNumber(winProb);
  const p10Num = parseSignedNumber(p10);
  const p90Num = parseSignedNumber(p90);

  const freshTag = Number.isFinite(winProbNum) ? "MC snapshot available" : "MC pending";
  const lastRun = Number.isFinite(winProbNum) ? "Recent run reflected in KPI strip" : "No run reflected yet";
  let staleTag = "Unknown";
  if (Number.isFinite(p10Num) && Number.isFinite(p90Num)){
    staleTag = Math.abs(p90Num - p10Num) > 0 ? "Current distribution loaded" : "Distribution appears flat";
  }
  return { freshTag, lastRun, staleTag };
}

function formatSurfaceLeverValue(spec, value){
  if (spec && typeof spec.fmt === "function"){
    try{
      return String(spec.fmt(value));
    } catch {
      // Fall back to numeric/text formatting.
    }
  }
  const n = Number(value);
  if (Number.isFinite(n)){
    if (Number.isInteger(n)){
      return formatWholeNumberByMode(n, { mode: "round", fallback: "—" });
    }
    return formatFixedNumber(n, 2, "—");
  }
  const text = String(value ?? "").trim();
  return text || "—";
}

/**
 * @param {{
 *   spec?: { fmt?: ((value: unknown) => string) } | null,
 *   result?: Record<string, any> | null,
 *   targetPercent?: number | null,
 * }} input
 * @returns {string}
 */
export function buildOutcomeSurfaceSummaryText({
  spec = null,
  result = null,
  targetPercent = null,
} = {}){
  const analysis = result?.analysis && typeof result.analysis === "object"
    ? result.analysis
    : null;
  const targetRaw = Number(targetPercent);
  const targetLabel = Number.isFinite(targetRaw)
    ? (roundWholeNumberByMode(targetRaw, { mode: "round", fallback: 70 }) ?? 70)
    : 70;
  const fmt = (value) => formatSurfaceLeverValue(spec, value);
  const parts = [];

  const safeZone = analysis?.safeZone || null;
  if (safeZone && safeZone.min != null && safeZone.max != null){
    parts.push(`Safe zone (≥ ${targetLabel}%): ${fmt(safeZone.min)} to ${fmt(safeZone.max)}`);
  } else {
    parts.push(`Safe zone (≥ ${targetLabel}%): none`);
  }

  const cliffs = Array.isArray(analysis?.cliffPoints) ? analysis.cliffPoints : [];
  if (cliffs.length){
    const xs = cliffs.slice(0, 3).map((row) => fmt(row?.at)).join(", ");
    parts.push(`Cliff edges: ${xs}${cliffs.length > 3 ? "…" : ""}`);
  } else {
    parts.push("Cliff edges: none");
  }

  const diminishingZones = Array.isArray(analysis?.diminishingZones) ? analysis.diminishingZones : [];
  if (diminishingZones.length){
    const first = diminishingZones[0] || {};
    parts.push(`Diminishing returns: ${fmt(first.min)} to ${fmt(first.max)}${diminishingZones.length > 1 ? "…" : ""}`);
  } else {
    parts.push("Diminishing returns: none");
  }

  const fragility = Array.isArray(analysis?.fragilityPoints) ? analysis.fragilityPoints : [];
  if (fragility.length){
    const xs = fragility.slice(0, 3).map((row) => fmt(row?.at)).join(", ");
    parts.push(`Fragility points: ${xs}${fragility.length > 3 ? "…" : ""}`);
  } else {
    parts.push("Fragility points: none");
  }

  return parts.join(" • ");
}

/**
 * @param {{
 *   mcResult?: Record<string, any>|null,
 *   formatSigned?: (value: number) => string,
 *   clampFn?: (value: number, min: number, max: number) => number,
 *   mcStaleness?: { isStale?: boolean, reasonText?: string } | null,
 * }} args
 * @returns {{
 *   tagLabel: string,
 *   tagKind: "ok"|"warn"|"bad"|null,
 *   winProbText: string,
 *   marginBandText: string,
 *   volatilityText: string,
 *   bannerText: string,
 *   bannerKind: "ok"|"warn"|"bad"|null,
 * }}
 */
export function buildOutcomeRiskFramingView(args = {}){
  const mcResult = (args?.mcResult && typeof args.mcResult === "object") ? args.mcResult : null;
  const formatSigned = (typeof args?.formatSigned === "function")
    ? args.formatSigned
    : (value) => formatSignedWhole(value);
  const clampFn = (typeof args?.clampFn === "function")
    ? args.clampFn
    : (value, min, max) => Math.min(max, Math.max(min, value));
  const mcStaleness = (args?.mcStaleness && typeof args.mcStaleness === "object") ? args.mcStaleness : null;

  if (!mcResult){
    return {
      tagLabel: "—",
      tagKind: null,
      winProbText: "—",
      marginBandText: "—",
      volatilityText: "—",
      bannerText: "Run Monte Carlo to populate risk framing.",
      bannerKind: "warn",
    };
  }

  const winProb = clampFn(Number(mcResult.winProb ?? 0), 0, 1);
  const ce = mcResult.confidenceEnvelope;
  const low = (ce?.percentiles?.p10 != null) ? Number(ce.percentiles.p10) : (mcResult.p5 != null ? Number(mcResult.p5) : null);
  const high = (ce?.percentiles?.p90 != null) ? Number(ce.percentiles.p90) : (mcResult.p95 != null ? Number(mcResult.p95) : null);
  const mid = (ce?.percentiles?.p50 != null) ? Number(ce.percentiles.p50) : (mcResult.median != null ? Number(mcResult.median) : null);

  const marginBandText = (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high))
    ? "—"
    : `${formatSigned(low)} to ${formatSigned(high)}${(mid == null || !Number.isFinite(mid)) ? "" : ` (p50: ${formatSigned(mid)})`}`;

  const spread = (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high)) ? null : Math.abs(high - low);
  let volatilityClass = "—";
  if (spread != null && Number.isFinite(spread)){
    if (spread <= 2) volatilityClass = "Low";
    else if (spread <= 5) volatilityClass = "Medium";
    else volatilityClass = "High";
  }
  const volatilityText = (spread == null || !Number.isFinite(spread))
    ? "—"
    : `${volatilityClass} (±${formatFixedNumber(spread / 2, 1, "0.0")} pts)`;

  const direction = (winProb >= 0.5) ? "win" : "loss";
  const volHigh = (volatilityClass === "High");
  /** @type {"ok"|"warn"|"bad"|null} */
  let tagKind = "bad";
  let tagLabel = "Volatile";
  if (!volHigh && winProb >= 0.75){
    tagLabel = "High confidence";
    tagKind = "ok";
  } else if (!volHigh && winProb >= 0.60){
    tagLabel = "Lean";
    tagKind = "warn";
  }

  const marginLine = (mid == null || !Number.isFinite(mid))
    ? ""
    : `Expected margin (p50): ${formatSigned(mid)}.`;

  let bannerText = "";
  /** @type {"ok"|"warn"|"bad"|null} */
  let bannerKind = tagKind;
  if (tagLabel === "High confidence"){
    bannerText = `Model indicates ${formatPercentFromUnit(winProb, 0)} chance to ${direction}. ${marginLine} Volatility: ${volatilityClass}.`;
  } else if (tagLabel === "Lean"){
    bannerText = `Leaning ${direction}: ${formatPercentFromUnit(winProb, 0)} model win chance. ${marginLine} Volatility: ${volatilityClass}.`;
  } else {
    bannerText = `Volatile outlook: ${formatPercentFromUnit(winProb, 0)} model win chance. Small changes in execution or assumptions can swing outcomes. ${marginLine} Volatility: ${volatilityClass}.`;
  }

  if (mcStaleness?.isStale){
    tagLabel = "Stale MC";
    tagKind = "warn";
    bannerKind = "warn";
    const reason = String(mcStaleness.reasonText || "").trim() || "assumptions changed";
    bannerText = `Monte Carlo is stale (${reason}). Re-run MC to refresh risk framing. ${marginLine} Volatility: ${volatilityClass}.`;
  }

  return {
    tagLabel,
    tagKind,
    winProbText: formatPercentFromUnit(winProb, 1),
    marginBandText,
    volatilityText,
    bannerText,
    bannerKind,
  };
}

export function deriveOutcomeForecastCardStatus(winProb, riskLabel){
  const win = parsePercentNumber(winProb);
  const risk = String(riskLabel || "").trim().toLowerCase();
  if (!Number.isFinite(win)){
    return "Awaiting run";
  }
  if (risk.includes("high") || win < 45){
    return "At risk";
  }
  if (risk.includes("moderate") || risk.includes("watch") || win < 60){
    return "Competitive";
  }
  return "Favored";
}

export function deriveOutcomeConfidenceCardStatus(fragility, cliff){
  const frag = String(fragility || "").trim().toLowerCase();
  const cliffText = String(cliff || "").trim().toLowerCase();
  if (!frag || frag === "pending"){
    return "Awaiting run";
  }
  if (frag === "high" || cliffText.includes("active cliff")){
    return "Fragile";
  }
  if (frag === "moderate" || cliffText.includes("potential cliff")){
    return "Watch";
  }
  return "Stable";
}

export function deriveOutcomeSensitivityCardStatus(sensitivityRows, surfaceStatus){
  const hasSensitivity = Array.isArray(sensitivityRows) && sensitivityRows.length > 0;
  const surface = String(surfaceStatus || "").trim();
  if (!hasSensitivity && (!surface || /run surface compute/i.test(surface))){
    return "Awaiting sims";
  }
  if (/safe zones|cliffs|diminishing returns/i.test(surface)){
    return "Surface ready";
  }
  if (hasSensitivity){
    return "Drivers ranked";
  }
  return "Awaiting sims";
}

export function deriveOutcomeInterpretationCardStatus(sensitivityRows, surfaceRows){
  const hasSensitivity = Array.isArray(sensitivityRows) && sensitivityRows.length > 0;
  const hasSurface = Array.isArray(surfaceRows) && surfaceRows.length > 0;
  if (hasSensitivity || hasSurface){
    return "Explainable";
  }
  return "Context";
}

export function deriveOutcomeRiskFlagsCardStatus(mcStatus, riskLabel, governance){
  const stale = String(mcStatus?.staleTag || "").trim().toLowerCase();
  const fresh = String(mcStatus?.freshTag || "").trim().toLowerCase();
  const risk = String(riskLabel || "").trim().toLowerCase();
  const realism = String(governance?.realismStatus || "").trim().toLowerCase();
  const dataQuality = String(governance?.dataQualityStatus || "").trim().toLowerCase();
  const execution = String(governance?.executionStatus || "").trim().toLowerCase();
  const confidence = String(governance?.confidenceBand || "").trim().toLowerCase();
  const learningSampleSize = Number(governance?.learningSampleSize);
  const learningThin = Number.isFinite(learningSampleSize) && learningSampleSize > 0 && learningSampleSize < 3;
  if (!fresh || fresh.includes("pending")){
    return "Awaiting run";
  }
  if (realism === "bad" || dataQuality === "bad" || execution === "bad" || confidence === "low"){
    return "Governance check";
  }
  if (execution === "warn"){
    return "Execution watch";
  }
  if (learningThin){
    return "Learning thin";
  }
  if (risk.includes("high")){
    return "High risk";
  }
  if (stale.includes("flat")){
    return "Check distribution";
  }
  if (risk.includes("moderate") || risk.includes("watch")){
    return "Watch";
  }
  return "Current";
}

export function deriveOutcomeSummaryCardStatus(riskLabel, winProb, fragility){
  const risk = String(riskLabel || "").trim();
  const win = parsePercentNumber(winProb);
  const frag = String(fragility || "").trim().toLowerCase();
  if (!Number.isFinite(win)){
    return "Awaiting run";
  }
  if (/high/i.test(risk) || frag === "high"){
    return "Fragile";
  }
  if (/moderate|watch/i.test(risk) || frag === "moderate"){
    return "Watch";
  }
  return "Stable";
}

export function deriveGapFromNote(noteText){
  const text = String(noteText || "").trim();
  if (!text){
    return "—";
  }
  const numeric = text.match(/[+-]?\d[\d,]*/);
  if (numeric && numeric[0]){
    return numeric[0];
  }
  return "See note";
}

export function formatOutcomeGovernanceSignal(status, score){
  return formatStatusWithScoreOutOfHundred(status, score, 1, "—");
}

export const OUTCOME_STATUS_AWAITING_RUN = "Awaiting run";

export function classifyOutcomeStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(favored|stable|surface ready|drivers ranked|current|explainable|model inputs)/.test(lower)){
    return "ok";
  }
  if (/(at risk|fragile|high risk|unavailable|failed|broken)/.test(lower)){
    return "bad";
  }
  if (/(awaiting|competitive|watch|check distribution|governance check|learning thin|context)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
