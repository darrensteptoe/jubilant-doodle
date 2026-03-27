import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePercentText(value) {
  const text = cleanText(value);
  if (!text || text === "-" || text === "—") return null;
  const parsed = Number(text.replace(/,/g, "").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBand(value, fallback = "unknown") {
  const token = cleanText(value).toLowerCase();
  return token || fallback;
}

function parseCountFromHistorySummary(text, label) {
  const source = cleanText(text);
  if (!source) return null;
  const pattern = new RegExp(`${label}\\s*:\\s*([0-9,]+)`, "i");
  const match = source.match(pattern);
  if (!match) return null;
  const parsed = Number(String(match[1] || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUnmatchedFromHistorySummary(text) {
  const source = cleanText(text);
  if (!source) return null;
  const match = source.match(/unmatched candidate rows:\s*([0-9,]+)/i);
  if (!match) return null;
  const parsed = Number(String(match[1] || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNameKey(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deriveYourCandidateHistoryAverageVoteShare(ballot = {}) {
  const candidates = Array.isArray(ballot?.candidates) ? ballot.candidates : [];
  const records = Array.isArray(ballot?.candidateHistoryRecords) ? ballot.candidateHistoryRecords : [];
  const yourId = cleanText(ballot?.yourCandidateId);
  if (!yourId || !records.length) return null;
  const yourCandidate = candidates.find((row) => cleanText(row?.id) === yourId);
  const yourNameKey = normalizeNameKey(yourCandidate?.name || "");
  if (!yourNameKey) return null;
  const voteShares = records
    .filter((row) => normalizeNameKey(row?.candidateName) === yourNameKey)
    .map((row) => toFinite(row?.voteShare, null))
    .filter((value) => value != null);
  if (!voteShares.length) return null;
  const mean = voteShares.reduce((sum, value) => sum + value, 0) / voteShares.length;
  return Number.isFinite(mean) ? Number(mean.toFixed(3)) : null;
}

function formatPctPoints(value, digits = 1) {
  const n = toFinite(value, null);
  if (n == null) return "—";
  return `${n.toFixed(digits)}%`;
}

function buildRangePostureText({
  evidenceStrong,
  moderateStretch,
  severeStretch,
  thinEvidence,
}) {
  if (evidenceStrong && !moderateStretch && !severeStretch && !thinEvidence) {
    return "Historically aligned.";
  }
  if (severeStretch || (thinEvidence && moderateStretch)) {
    return "Highly assumption-dependent.";
  }
  return "Somewhat stretched.";
}

export function deriveDistrictEvidenceExplanation(input = {}) {
  const snapshot = input?.snapshot && typeof input.snapshot === "object" ? input.snapshot : {};
  const electionDataSummary = input?.electionDataSummary && typeof input.electionDataSummary === "object"
    ? input.electionDataSummary
    : {};
  const formSnapshot = input?.formSnapshot && typeof input.formSnapshot === "object" ? input.formSnapshot : {};
  const templateSnapshot = input?.templateSnapshot && typeof input.templateSnapshot === "object" ? input.templateSnapshot : {};
  const ballotSnapshot = input?.ballotSnapshot && typeof input.ballotSnapshot === "object" ? input.ballotSnapshot : {};
  const advisory = input?.turnoutBenchmarkAdvisory && typeof input.turnoutBenchmarkAdvisory === "object"
    ? input.turnoutBenchmarkAdvisory
    : null;
  const electionDataCanonicalSnapshot = input?.electionDataCanonicalSnapshot && typeof input.electionDataCanonicalSnapshot === "object"
    ? input.electionDataCanonicalSnapshot
    : {};

  const historySummaryText = cleanText(ballotSnapshot?.candidateHistorySummaryText);
  const historyRecordCount = Number.isFinite(Number(templateSnapshot?.candidateHistoryRecordCount))
    ? Math.max(0, Number(templateSnapshot.candidateHistoryRecordCount))
    : (Array.isArray(ballotSnapshot?.candidateHistoryRecords) ? ballotSnapshot.candidateHistoryRecords.length : 0);
  const historyCoverageBand = normalizeBand(templateSnapshot?.candidateHistoryCoverageBand, "none");
  const historyConfidenceBand = normalizeBand(templateSnapshot?.candidateHistoryConfidenceBand, "missing");
  const historyMatched = parseCountFromHistorySummary(historySummaryText, "matched");
  const historyUnmatched = parseUnmatchedFromHistorySummary(historySummaryText);

  const benchmarkRows = Number.isFinite(Number(electionDataSummary?.normalizedRowCount))
    ? Math.max(0, Number(electionDataSummary.normalizedRowCount))
    : 0;
  const benchmarkQuality = toFinite(electionDataSummary?.qualityScore, null);
  const benchmarkConfidenceBand = normalizeBand(electionDataSummary?.confidenceBand, "unknown");
  const comparablePoolCount = Array.isArray(electionDataCanonicalSnapshot?.benchmarks?.comparableRacePools)
    ? electionDataCanonicalSnapshot.benchmarks.comparableRacePools.length
    : 0;

  const turnoutA = toFinite(formSnapshot?.turnoutA, null);
  const turnoutB = toFinite(formSnapshot?.turnoutB, null);
  const bandWidth = toFinite(formSnapshot?.bandWidth, null);
  const baselineSupport = parsePercentText(snapshot?.baselineSupport);
  const historyVoteShareAvg = deriveYourCandidateHistoryAverageVoteShare(ballotSnapshot);

  const turnoutDeltaA = advisory && advisory.hasTurnoutAnchors && turnoutA != null && toFinite(advisory?.turnoutAnchorA, null) != null
    ? Math.abs(turnoutA - Number(advisory.turnoutAnchorA))
    : null;
  const turnoutDeltaB = advisory && advisory.hasTurnoutAnchors && turnoutB != null && toFinite(advisory?.turnoutAnchorB, null) != null
    ? Math.abs(turnoutB - Number(advisory.turnoutAnchorB))
    : null;
  const bandDelta = advisory && advisory.hasBandSuggestion && bandWidth != null && toFinite(advisory?.bandSuggestion, null) != null
    ? Math.abs(bandWidth - Number(advisory.bandSuggestion))
    : null;
  const supportDelta = baselineSupport != null && historyVoteShareAvg != null
    ? Math.abs(baselineSupport - historyVoteShareAvg)
    : null;

  const maxTurnoutDelta = Math.max(turnoutDeltaA ?? 0, turnoutDeltaB ?? 0);
  const moderateTurnoutStretch = (turnoutDeltaA != null && turnoutDeltaA >= 1)
    || (turnoutDeltaB != null && turnoutDeltaB >= 1)
    || (bandDelta != null && bandDelta >= 0.8)
    || (supportDelta != null && supportDelta >= 2.5);
  const severeTurnoutStretch = (turnoutDeltaA != null && turnoutDeltaA >= 2)
    || (turnoutDeltaB != null && turnoutDeltaB >= 2)
    || (bandDelta != null && bandDelta >= 1.5)
    || (supportDelta != null && supportDelta >= 4.5);

  const groundedBits = [];
  if (advisory && advisory.hasTurnoutAnchors) {
    groundedBits.push(`Turnout anchors are benchmark-backed (${advisory.turnoutAnchorText}).`);
  }
  if (historyRecordCount > 0 && (historyConfidenceBand === "high" || historyConfidenceBand === "medium")) {
    const matchedBit = historyMatched != null ? `, ${historyMatched} matched` : "";
    groundedBits.push(`Candidate history coverage is ${historyCoverageBand} confidence (${historyRecordCount} row(s)${matchedBit}).`);
  } else if (historyRecordCount > 0 && historyMatched != null && historyMatched > 0) {
    groundedBits.push(`Candidate history has partial grounding (${historyMatched} matched of ${historyRecordCount} row(s)).`);
  }
  if (comparablePoolCount > 0) {
    groundedBits.push(`Comparable benchmark pools are available (${comparablePoolCount}).`);
  }

  const assumptionBits = [];
  if (!advisory || !advisory.hasTurnoutAnchors) {
    assumptionBits.push("Turnout setup is primarily user-set because benchmark anchors are missing.");
  }
  if (historyRecordCount <= 0 || historyConfidenceBand === "low" || historyConfidenceBand === "missing") {
    assumptionBits.push("Baseline support posture is assumption-driven due to limited candidate-history confidence.");
  }
  if (benchmarkRows <= 0 || benchmarkConfidenceBand === "unknown") {
    assumptionBits.push("Imported benchmark context is thin, so confidence leans on current assumptions.");
  }

  const divergenceBits = [];
  if (maxTurnoutDelta >= 1 && (turnoutDeltaA != null || turnoutDeltaB != null)) {
    const deltas = [];
    if (turnoutDeltaA != null) deltas.push(`A ${formatPctPoints(turnoutDeltaA)}`);
    if (turnoutDeltaB != null) deltas.push(`B ${formatPctPoints(turnoutDeltaB)}`);
    divergenceBits.push(`Turnout anchors are ${deltas.join(" / ")} from benchmark.`);
  }
  if (bandDelta != null && bandDelta >= 0.8) {
    divergenceBits.push(`Turnout band width differs by ${formatPctPoints(bandDelta)} from benchmark suggestion.`);
  }
  if (supportDelta != null && supportDelta >= 2.5) {
    divergenceBits.push(`Current baseline support differs by ${formatPctPoints(supportDelta)} from matched history average.`);
  }

  const thinEvidenceReasons = [];
  if (historyRecordCount <= 0 || historyConfidenceBand === "missing") {
    thinEvidenceReasons.push("candidate-history coverage is missing");
  } else if (historyConfidenceBand === "low") {
    thinEvidenceReasons.push("candidate-history confidence is low");
  }
  if (historyMatched === 0 && historyRecordCount > 0) {
    thinEvidenceReasons.push("no history rows are currently matching");
  }
  if ((historyUnmatched != null && historyUnmatched > 0)) {
    thinEvidenceReasons.push("some candidate-history rows are unmatched");
  }
  if (benchmarkRows <= 0) {
    thinEvidenceReasons.push("benchmark import rows are missing");
  } else if (benchmarkQuality != null && benchmarkQuality < 0.55) {
    thinEvidenceReasons.push("benchmark quality score is weak");
  }
  if (benchmarkConfidenceBand === "low" || benchmarkConfidenceBand === "critical" || benchmarkConfidenceBand === "unknown") {
    thinEvidenceReasons.push(`benchmark confidence is ${benchmarkConfidenceBand.toUpperCase()}`);
  }
  if (comparablePoolCount <= 0) {
    thinEvidenceReasons.push("comparable benchmark coverage is thin");
  }

  const ambitiousReasons = [];
  if (severeTurnoutStretch) {
    ambitiousReasons.push("current turnout/band assumptions are materially outside benchmark posture");
  } else if (moderateTurnoutStretch) {
    ambitiousReasons.push("current turnout/band assumptions are somewhat stretched");
  }
  if (supportDelta != null && supportDelta >= 4.5) {
    ambitiousReasons.push("baseline support is stretched relative to matched history");
  }

  const thinEvidence = thinEvidenceReasons.length > 0;
  const ambitious = ambitiousReasons.length > 0;
  let confidenceLimitedText = "";
  if (thinEvidence && ambitious) {
    confidenceLimitedText = `Confidence is limited by thin evidence (${thinEvidenceReasons[0]}) and ambitious assumptions (${ambitiousReasons[0]}).`;
  } else if (thinEvidence) {
    confidenceLimitedText = `Confidence is limited primarily by evidence depth (${thinEvidenceReasons[0]}).`;
  } else if (ambitious) {
    confidenceLimitedText = `Confidence is limited primarily by assumption stretch (${ambitiousReasons[0]}).`;
  }

  const evidenceStrong = !!(
    advisory?.hasTurnoutAnchors
    && (historyConfidenceBand === "high" || historyConfidenceBand === "medium")
    && (benchmarkConfidenceBand === "high" || benchmarkConfidenceBand === "medium")
    && benchmarkRows > 0
    && comparablePoolCount > 0
  );
  const rangePostureText = buildRangePostureText({
    evidenceStrong,
    moderateStretch: moderateTurnoutStretch,
    severeStretch: severeTurnoutStretch,
    thinEvidence,
  });

  const groundedText = groundedBits.slice(0, 3).join(" ");
  const assumptionText = assumptionBits.slice(0, 2).join(" ");
  const divergenceText = divergenceBits.length
    ? `${divergenceBits.slice(0, 2).join(" ")} Historical benchmark is calibration context, not current-voter truth.`
    : "";

  const hasAnyEvidence = historyRecordCount > 0 || benchmarkRows > 0 || !!advisory;
  if (!hasAnyEvidence) {
    return {
      ready: false,
      statusText: "Limited evidence context. Import benchmark history or add candidate-history rows for explanation.",
      groundedText: "",
      assumptionText: "",
      divergenceText: "",
      confidenceLimitedText: "",
      rangePostureText: "",
    };
  }

  return {
    ready: true,
    statusText: "Deterministic explanation from district history, turnout anchors, and benchmark context.",
    groundedText,
    assumptionText,
    divergenceText,
    confidenceLimitedText,
    rangePostureText,
  };
}

export function renderDistrictV2SummaryCard({ summaryCard, getCardBody }) {
  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Universe</span><strong id="v3DistrictV2Universe">-</strong></div>
      <div class="fpe-summary-row"><span>Baseline support total</span><strong id="v3DistrictV2Support">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout</span><strong id="v3DistrictV2Turnout">-</strong></div>
      <div class="fpe-summary-row"><span>Turnout band</span><strong id="v3DistrictV2TurnoutBand">-</strong></div>
      <div class="fpe-summary-row"><span>Projected votes</span><strong id="v3DistrictV2Projected">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3DistrictV2Need">-</strong></div>
      <div class="fpe-summary-row"><span>Election data context</span><strong id="v3DistrictV2ElectionDataRef">No normalized election rows.</strong></div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Evidence & benchmark explanation</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2EvidenceStatus">Evidence interpretation pending.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2EvidenceGrounded" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2EvidenceAssumptionDriven" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2EvidenceDivergence" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2EvidenceConfidenceLimited" hidden></div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2EvidenceRangePosture" hidden></div>
    </div>
  `;
}

function syncExplanationLine(id, label, text) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const content = cleanText(text);
  el.hidden = !content;
  el.textContent = content ? `${label}: ${content}` : "";
}

export function syncDistrictV2Summary(snapshot, electionDataSummary, context = {}) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : null;
  const electionData = electionDataSummary && typeof electionDataSummary === "object" ? electionDataSummary : null;
  const electionRows = Number.isFinite(Number(electionData?.normalizedRowCount))
    ? Math.max(0, Number(electionData.normalizedRowCount))
    : 0;
  const confidenceBand = String(electionData?.confidenceBand || "").trim();
  const contextText = electionRows > 0
    ? `${electionRows.toLocaleString("en-US")} normalized rows${confidenceBand ? ` · ${confidenceBand}` : ""}`
    : "No normalized election rows.";
  setText("v3DistrictV2Universe", String(data?.universe || "-") || "-");
  setText("v3DistrictV2Support", String(data?.baselineSupport || "-") || "-");
  setText("v3DistrictV2Turnout", String(data?.turnoutExpected || "-") || "-");
  setText("v3DistrictV2TurnoutBand", String(data?.turnoutBand || "-") || "-");
  setText("v3DistrictV2Projected", String(data?.projectedVotes || "-") || "-");
  setText("v3DistrictV2Need", String(data?.persuasionNeed || "-") || "-");
  setText("v3DistrictV2ElectionDataRef", contextText);

  const explanation = deriveDistrictEvidenceExplanation({
    snapshot: data,
    electionDataSummary: electionData,
    formSnapshot: context?.formSnapshot,
    templateSnapshot: context?.templateSnapshot,
    ballotSnapshot: context?.ballotSnapshot,
    turnoutBenchmarkAdvisory: context?.turnoutBenchmarkAdvisory,
    electionDataCanonicalSnapshot: context?.electionDataCanonicalSnapshot,
  });

  setText(
    "v3DistrictV2EvidenceStatus",
    cleanText(explanation?.statusText)
      || "Evidence interpretation unavailable.",
  );
  syncExplanationLine("v3DistrictV2EvidenceGrounded", "What is grounded in evidence", explanation?.groundedText);
  syncExplanationLine("v3DistrictV2EvidenceAssumptionDriven", "What is primarily assumption-driven", explanation?.assumptionText);
  syncExplanationLine("v3DistrictV2EvidenceDivergence", "Where assumptions diverge from benchmark history", explanation?.divergenceText);
  syncExplanationLine("v3DistrictV2EvidenceConfidenceLimited", "Why confidence is limited", explanation?.confidenceLimitedText);
  syncExplanationLine("v3DistrictV2EvidenceRangePosture", "Range posture", explanation?.rangePostureText);
}
