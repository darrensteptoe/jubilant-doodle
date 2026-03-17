// @ts-check

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
  const rounded = Math.round(value);
  if (rounded > 0){
    return `+${rounded}`;
  }
  return `${rounded}`;
}

export function deriveShiftFromMargin(rawMargin){
  const marginNum = parseSignedNumber(rawMargin);
  if (!Number.isFinite(marginNum)){
    return "—";
  }
  if (marginNum >= 0){
    return "0";
  }
  return `${Math.ceil(Math.abs(marginNum))}`;
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
    if (Number.isFinite(p50Margin)){
      const penalty = p50Margin < 0 ? Math.ceil(Math.abs(p50Margin)) : 0;
      return `${Math.max(1, Math.ceil(gap / 2) + penalty)}`;
    }
    return `${Math.max(1, Math.ceil(gap / 2))}`;
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
  const rawStatus = String(status || "").trim().toUpperCase();
  const n = Number(score);
  if (!rawStatus && !Number.isFinite(n)){
    return "—";
  }
  if (!rawStatus){
    return `${n.toFixed(1)}/100`;
  }
  if (!Number.isFinite(n)){
    return rawStatus;
  }
  return `${rawStatus} (${n.toFixed(1)}/100)`;
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
