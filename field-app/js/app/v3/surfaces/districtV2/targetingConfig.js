import {
  listTargetGeoLevels,
  listTargetModelOptions,
} from "../../../targetingRuntime.js";
import {
  getMetricIdsForSet,
} from "../../../../core/censusModule.js";

export const TARGETING_DENSITY_OPTIONS = Object.freeze([
  { value: "none", label: "None" },
  { value: "medium", label: "Medium+" },
  { value: "high", label: "High" },
]);

const TARGETING_SOURCE_TOKENS = new Set([
  "applyTargetingPreset",
  "resetTargetingWeights",
  "runTargeting",
  "exportTargetingCsv",
  "exportTargetingJson",
]);

const TARGETING_FLAG_SIGNAL_REQUIREMENTS = Object.freeze([
  { id: "multi_unit_share", label: "multi-unit share" },
  { id: "limited_english_share", label: "limited-English share" },
  { id: "no_vehicle_share", label: "no-vehicle share" },
  { id: "citizen_share", label: "citizen share" },
  { id: "long_commute_share", label: "long-commute share" },
  { id: "no_internet_share", label: "no-internet share" },
]);

function normalizeTargetingOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      const value = String(row?.id ?? row?.value ?? "").trim();
      const label = String(row?.label ?? row?.id ?? row?.value ?? "").trim() || value;
      if (!value) {
        return null;
      }
      return { value, label };
    })
    .filter(Boolean);
}

function parseLoadedRowsCount(geoStatsText) {
  const text = String(geoStatsText || "").trim();
  const match = text.match(/(\d+)\s+rows?\s+loaded/i);
  if (!match) {
    return 0;
  }
  const count = Number.parseInt(match[1], 10);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function hasSelectedGeo(censusConfig) {
  const rows = Array.isArray(censusConfig?.geoSelectOptions) ? censusConfig.geoSelectOptions : [];
  return rows.some((row) => !!row?.selected);
}

function deriveReadiness(config, censusConfig, censusResults) {
  const locked = !!config?.controlsLocked;
  const canRunByCanonical = config?.canRun == null ? true : !!config.canRun;
  const loadedRows = parseLoadedRowsCount(censusResults?.geoStatsText);
  const selectedGeo = hasSelectedGeo(censusConfig);
  const issues = [];

  if (locked) {
    issues.push("Scenario is locked.");
  }
  if (!canRunByCanonical) {
    issues.push("Load ACS rows before running targeting.");
  }
  if (loadedRows <= 0) {
    issues.push("No ACS rows loaded.");
  }
  if (!selectedGeo) {
    issues.push("Select at least one GEO.");
  }

  const geoLevel = String(config?.geoLevel || "").trim();
  const modelId = String(config?.modelId || config?.presetId || "").trim();
  const topN = Number(config?.topN);

  if (!geoLevel) {
    issues.push("Set geography level.");
  }
  if (!modelId) {
    issues.push("Set target model.");
  }
  if (!Number.isFinite(topN) || topN <= 0) {
    issues.push("Set Top N > 0.");
  }

  const ready = !issues.length;
  return {
    ready,
    locked,
    loadedRows,
    selectedGeo,
    canRunByCanonical,
    reason: ready ? "Ready to run targeting." : issues[0],
    issues,
  };
}

function resolveRunFailureMessage(result) {
  const detail = String(
    result?.message
    || result?.view?.census?.statusText
    || result?.view?.derived?.census?.statusText
    || "",
  ).trim();
  return detail ? `Targeting run failed: ${detail}` : "Targeting action rejected (run_failed).";
}

function isTargetingSource(sourceToken) {
  const token = String(sourceToken || "").trim();
  if (!token) return false;
  if (token.startsWith("setTargetingField:")) return true;
  return TARGETING_SOURCE_TOKENS.has(token);
}

function evaluateTargetingSignalCoverage(metricSetId) {
  const metricSet = String(metricSetId || "core").trim() || "core";
  const metricIds = new Set(getMetricIdsForSet(metricSet));
  const missingSignals = TARGETING_FLAG_SIGNAL_REQUIREMENTS
    .filter((signal) => !metricIds.has(signal.id));
  const missingLabels = missingSignals.map((signal) => signal.label);
  const preview = missingLabels.slice(0, 3);
  const overflow = missingLabels.length > preview.length
    ? ` +${missingLabels.length - preview.length} more`
    : "";
  return {
    metricSet,
    missingLabels,
    hasMissingFlagSignals: missingLabels.length > 0,
    shortNote: missingLabels.length
      ? `Signal coverage limited (${metricSet}; missing ${preview.join(", ")}${overflow}).`
      : "",
  };
}

function normalizeGeographyToken(value) {
  return String(value == null ? "" : value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseNumberFromText(textValue) {
  const cleaned = String(textValue == null ? "" : textValue).replace(/[^0-9.+-]/g, "");
  return toFiniteNumber(cleaned);
}

function parseRowScore(row) {
  return toFiniteNumber(row?.scoreValue) ?? parseNumberFromText(row?.score);
}

function parseRowVotesPerHour(row) {
  return toFiniteNumber(row?.votesPerHourValue) ?? parseNumberFromText(row?.votesPerHour);
}

function quantile(values, q) {
  const list = Array.isArray(values) ? values.slice().sort((a, b) => a - b) : [];
  if (!list.length) return null;
  const idx = Math.max(0, Math.min(list.length - 1, Math.floor((list.length - 1) * q)));
  return toFiniteNumber(list[idx]);
}

function confidencePenalty(confidenceBand) {
  const token = String(confidenceBand || "").trim().toLowerCase();
  if (token === "high") return 1;
  if (token === "medium") return 0;
  if (token === "low") return -1;
  if (token === "critical") return -2;
  return 0;
}

function dedupeLines(lines) {
  const seen = new Set();
  const out = [];
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const text = String(line || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
}

function normalizeTargetRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    rank: toFiniteNumber(row?.rank),
    geoidToken: normalizeGeographyToken(row?.geoid || row?.geography || ""),
    score: parseRowScore(row),
    votesPerHour: parseRowVotesPerHour(row),
    topTarget: !!row?.topTarget,
    turnoutPriority: !!row?.turnoutPriority,
    persuasionPriority: !!row?.persuasionPriority,
    efficiencyPriority: !!row?.efficiencyPriority,
    flags: String(row?.flags || "").trim(),
  }));
}

function buildRoleLabel(row, { lowEfficiencyCutoff }) {
  const hasSignal = row.turnoutPriority
    || row.persuasionPriority
    || row.efficiencyPriority
    || row.score != null
    || row.votesPerHour != null;
  if (!hasSignal) return "";
  if (row.votesPerHour != null && lowEfficiencyCutoff != null && row.votesPerHour < (lowEfficiencyCutoff * 0.92)) {
    return "Low Efficiency";
  }
  if (row.turnoutPriority) return "Turnout Lift";
  if (row.persuasionPriority) return "Persuasion Opportunity";
  if (row.topTarget && row.efficiencyPriority) return "Base Protection";
  return "Monitor";
}

function buildWhyText(row, { roleLabel, hasPriorityOverlap, hasTurnoutOverlap, confidenceBand }) {
  const roleLead = roleLabel === "Turnout Lift"
    ? "High turnout opportunity"
    : roleLabel === "Persuasion Opportunity"
      ? "Persuasion-leaning target"
      : roleLabel === "Base Protection"
        ? "Efficient base-defense target"
        : roleLabel === "Low Efficiency"
          ? "Useful coverage target, but lower expected payoff"
          : "Coverage target with mixed upside";

  let overlapLead = "with limited benchmark alignment.";
  if (hasPriorityOverlap && hasTurnoutOverlap) {
    overlapLead = "with benchmark priority and turnout overlap.";
  } else if (hasPriorityOverlap) {
    overlapLead = "with benchmark priority overlap.";
  } else if (hasTurnoutOverlap) {
    overlapLead = "with turnout-opportunity overlap.";
  } else if (confidenceBand === "low" || confidenceBand === "critical") {
    overlapLead = "with weaker benchmark support.";
  }
  return `${roleLead} ${overlapLead}`;
}

function buildFragilityTag(row, context) {
  const {
    minScore,
    scoreSpread,
    hasPriorityOverlap,
    hasTurnoutOverlap,
    confidenceBand,
    roleLabel,
    volatilityFocus,
  } = context;
  let score = 0;
  score += hasPriorityOverlap || hasTurnoutOverlap ? 1 : -1;
  score += confidencePenalty(confidenceBand);
  if (row.score != null && minScore != null && scoreSpread != null) {
    const normalized = scoreSpread > 0 ? (row.score - minScore) / scoreSpread : 1;
    if (normalized >= 0.65) score += 1;
    if (normalized < 0.35) score -= 1;
  }
  if (roleLabel === "Low Efficiency") score -= 1;
  if (volatilityFocus && !hasPriorityOverlap && !hasTurnoutOverlap) score -= 1;
  if (score >= 2) return "Stable";
  if (score >= 0) return "Moderate";
  return "Fragile";
}

export function deriveTargetingIntelligenceView(rows, benchmarkAdvisory = null) {
  const normalizedRows = normalizeTargetRows(rows);
  const scoreValues = normalizedRows.map((row) => row.score).filter((value) => value != null);
  const votesPerHourValues = normalizedRows.map((row) => row.votesPerHour).filter((value) => value != null);
  const maxScore = scoreValues.length ? Math.max(...scoreValues) : null;
  const minScore = scoreValues.length ? Math.min(...scoreValues) : null;
  const scoreSpread = maxScore != null && minScore != null ? (maxScore - minScore) : null;
  const lowEfficiencyCutoff = quantile(votesPerHourValues, 0.5);
  const confidenceBand = String(benchmarkAdvisory?.confidenceBand || "").trim().toLowerCase();
  const prioritySet = new Set(
    (Array.isArray(benchmarkAdvisory?.priorityGeographyIds) ? benchmarkAdvisory.priorityGeographyIds : [])
      .map((token) => normalizeGeographyToken(token))
      .filter(Boolean),
  );
  const turnoutSet = new Set(
    (Array.isArray(benchmarkAdvisory?.turnoutBoostGeoids) ? benchmarkAdvisory.turnoutBoostGeoids : [])
      .map((token) => normalizeGeographyToken(token))
      .filter(Boolean),
  );
  const volatilityFocus = String(benchmarkAdvisory?.volatilityFocus || "").trim();
  const rowIntelligence = normalizedRows.map((row) => {
    const hasPriorityOverlap = !!(row.geoidToken && prioritySet.has(row.geoidToken));
    const hasTurnoutOverlap = !!(row.geoidToken && turnoutSet.has(row.geoidToken));
    const roleLabel = buildRoleLabel(row, { lowEfficiencyCutoff });
    const whyText = roleLabel
      ? buildWhyText(row, { roleLabel, hasPriorityOverlap, hasTurnoutOverlap, confidenceBand })
      : "";
    const fragilityTag = roleLabel
      ? buildFragilityTag(row, {
        minScore,
        scoreSpread,
        hasPriorityOverlap,
        hasTurnoutOverlap,
        confidenceBand,
        roleLabel,
        volatilityFocus,
      })
      : "";
    return {
      roleLabel,
      whyText,
      fragilityTag,
      hasPriorityOverlap,
      hasTurnoutOverlap,
    };
  });

  const insightLines = [];
  (Array.isArray(benchmarkAdvisory?.insightLines) ? benchmarkAdvisory.insightLines : []).forEach((line) => {
    insightLines.push(line);
  });
  if (scoreValues.length >= 4) {
    const sorted = scoreValues.slice().sort((a, b) => b - a);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    if (total > 0) {
      const top3Share = sorted.slice(0, 3).reduce((sum, value) => sum + value, 0) / total;
      if (top3Share >= 0.62) {
        insightLines.push("Current target slate is concentrated in a small set of geographies.");
      } else if (sorted.length >= 8 && top3Share <= 0.35) {
        insightLines.push("Current target slate is broad but shallow across many geographies.");
      }
    }
  }
  const fragilityCount = rowIntelligence.filter((row) => row.fragilityTag === "Fragile").length;
  if (rowIntelligence.length >= 5 && fragilityCount / rowIntelligence.length >= 0.4) {
    insightLines.push("Current slate leans on more fragile priorities.");
  }

  return {
    rows: rowIntelligence,
    insightLines: dedupeLines(insightLines).slice(0, 3),
  };
}

function renderTargetingRows(
  rows,
  {
    setInnerHtmlWithTrace,
    escapeHtml,
    flagFallbackText = "No risk flags triggered.",
    intelligenceRows = [],
  },
) {
  const tbody = document.getElementById("v3DistrictV2TargetingResultsTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    setInnerHtmlWithTrace(
      tbody,
      `<tr><td class="muted" colspan="6">Run targeting to generate ranked GEOs.</td></tr>`,
      "targetingConfig.renderRows:empty",
    );
    return;
  }
  setInnerHtmlWithTrace(
    tbody,
    list.map((row, index) => {
      const reasonValue = String(row?.reason || "").trim() || "—";
      const flagsValue = String(row?.flags || "").trim();
      const flagsCellText = flagsValue || String(flagFallbackText || "No risk flags triggered.");
      const intelligence = intelligenceRows[index] && typeof intelligenceRows[index] === "object"
        ? intelligenceRows[index]
        : {};
      const roleLine = String(intelligence.roleLabel || "").trim();
      const fragilityLine = String(intelligence.fragilityTag || "").trim();
      const whyLine = String(intelligence.whyText || "").trim();
      const reasonDetails = [];
      if (roleLine || fragilityLine) {
        reasonDetails.push(`<div class="fpe-help fpe-help--flush">Role: ${escapeHtml(roleLine || "—")} · ${escapeHtml(fragilityLine || "—")}</div>`);
      }
      if (whyLine) {
        reasonDetails.push(`<div class="fpe-help fpe-help--flush">${escapeHtml(whyLine)}</div>`);
      }
      return `
        <tr>
          <td>${escapeHtml(String(row?.rank || ""))}</td>
          <td>${escapeHtml(String(row?.geography || ""))}</td>
          <td class="num">${escapeHtml(String(row?.score || ""))}</td>
          <td class="num">${escapeHtml(String(row?.votesPerHour || ""))}</td>
          <td>${escapeHtml(reasonValue)}${reasonDetails.join("")}</td>
          <td>${escapeHtml(flagsCellText)}</td>
        </tr>
      `;
    }).join(""),
    "targetingConfig.renderRows:rows",
  );
}

export function renderDistrictV2TargetingCard({ targetingCard, getCardBody }) {
  const body = getCardBody(targetingCard);
  body.innerHTML = `
    <div class="fpe-targeting-lab">
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingGeoLevel">Geography level</label>
          <select class="fpe-input" id="v3DistrictV2TargetingGeoLevel"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingModelId">Target model</label>
          <select class="fpe-input" id="v3DistrictV2TargetingModelId"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingTopN">Top N</label>
          <input class="fpe-input" id="v3DistrictV2TargetingTopN" min="1" step="1" type="number"/>
          <div class="fpe-help fpe-help--flush">Top N is the number of highest-ranked geographies returned by the model. More is broader; less is tighter. Increase it when the campaign needs volume. Decrease it when focus matters more than breadth.</div>
        </div>
      </div>

      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingMinHousingUnits">Minimum housing units</label>
          <input class="fpe-input" id="v3DistrictV2TargetingMinHousingUnits" min="0" step="1" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingMinPopulation">Minimum population</label>
          <input class="fpe-input" id="v3DistrictV2TargetingMinPopulation" min="0" step="1" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingMinScore">Minimum score</label>
          <input class="fpe-input" id="v3DistrictV2TargetingMinScore" min="0" step="0.1" type="number"/>
          <div class="fpe-help fpe-help--flush">Minimum score is the floor a geography must clear to be included. Raise it for a cleaner, higher-confidence turf cut. Lower it when the campaign needs more volume or backup turf.</div>
        </div>
      </div>

      <div class="fpe-field-grid fpe-field-grid--1">
        <div class="field fpe-targeting-density-field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingDensityFloor">Density floor</label>
          <select class="fpe-input" id="v3DistrictV2TargetingDensityFloor"></select>
          <div class="fpe-help fpe-help--flush">Density floor sets the minimum density required for a geography to be included. Raise it when walk efficiency matters. Lower it when lower-density areas are still strategically important.</div>
        </div>
      </div>

      <div class="fpe-action-row">
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingOnlyRaceFootprint" type="checkbox"/>
          <span>Only race footprint</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingPrioritizeYoung" type="checkbox"/>
          <span>Prioritize young profile</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingPrioritizeRenters" type="checkbox"/>
          <span>Prioritize renters</span>
        </label>
        <label class="fpe-switch">
          <input id="v3DistrictV2TargetingAvoidHighMultiUnit" type="checkbox"/>
          <span>Avoid high multi-unit</span>
        </label>
      </div>

      <div class="fpe-help fpe-help--flush">House model weights (used when Target model = House Model v1).</div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightVotePotential">Vote potential weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightVotePotential" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightTurnoutOpportunity">Turnout opportunity weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightTurnoutOpportunity" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightPersuasionIndex">Persuasion index weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightPersuasionIndex" min="0" step="0.01" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingWeightFieldEfficiency">Field efficiency weight</label>
          <input class="fpe-input" id="v3DistrictV2TargetingWeightFieldEfficiency" min="0" step="0.01" type="number"/>
        </div>
      </div>

      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2TargetingResetWeights" type="button">Reset house weights</button>
      </div>

      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingReadiness">Readiness: evaluating targeting prerequisites.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingStatus">-</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingMeta">-</div>

      <div class="fpe-contained-block" id="v3DistrictV2TargetingBenchmarkCard" hidden>
        <div class="fpe-control-label">Election Data benchmark</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkStatus">No benchmark recommendations available.</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkQuality">Benchmark confidence: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkPriority">Priority geography IDs: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkPriorityOverlap">Priority overlap: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkTurnout">Turnout-opportunity GEOIDs: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkTurnoutOverlap">Turnout overlap: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkInterpretation">Overlap interpretation: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkInsights">No benchmark saturation warnings.</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkComparable">Comparable pool: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkVolatility">Volatility focus: —</div>
        <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingBenchmarkProvenance">Source: imported/computed election benchmark history.</div>
      </div>

      <div class="fpe-action-row fpe-targeting-results-actions">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2RunTargeting" type="button">Run targeting</button>
        <div class="fpe-targeting-results-actions__right">
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ExportTargetingCsv" type="button">Export targets CSV</button>
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ExportTargetingJson" type="button">Export targets JSON</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" aria-label="District V2 targeting rankings">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Geography</th>
              <th class="num">Score</th>
              <th class="num">Votes/hr</th>
              <th>Reason</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody id="v3DistrictV2TargetingResultsTbody">
            <tr><td class="muted" colspan="6">Run targeting to generate ranked GEOs.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function createDistrictV2TargetingModule(deps = {}) {
  const {
    syncSelectOptions,
    syncInputValueFromRaw,
    syncCheckboxCheckedFromRaw,
    setText,
    applyDisabled,
    setInnerHtmlWithTrace,
    escapeHtml,
    setDistrictTargetingField,
    applyDistrictTargetingPreset,
    resetDistrictTargetingWeights,
    runDistrictTargeting,
    exportDistrictTargetingCsv,
    exportDistrictTargetingJson,
  } = deps;

  let targetingActionStatusOverride = "";
  let latestReadiness = {
    ready: false,
    reason: "Readiness unavailable.",
  };

  function sync(configSnapshot, resultsSnapshot, context = {}) {
    const config = configSnapshot && typeof configSnapshot === "object" ? configSnapshot : {};
    const results = resultsSnapshot && typeof resultsSnapshot === "object" ? resultsSnapshot : {};
    const censusConfig = context?.censusConfig && typeof context.censusConfig === "object" ? context.censusConfig : {};
    const censusResults = context?.censusResults && typeof context.censusResults === "object" ? context.censusResults : {};
    const benchmarkAdvisory = context?.electionBenchmarkAdvisory && typeof context.electionBenchmarkAdvisory === "object"
      ? context.electionBenchmarkAdvisory
      : null;
    const signalCoverage = evaluateTargetingSignalCoverage(censusConfig?.metricSet);
    const signalCoverageNote = String(signalCoverage.shortNote || "").trim();

    syncSelectOptions("v3DistrictV2TargetingGeoLevel", normalizeTargetingOptions(listTargetGeoLevels()), config.geoLevel);
    syncSelectOptions("v3DistrictV2TargetingModelId", normalizeTargetingOptions(listTargetModelOptions()), config.modelId || config.presetId);
    syncInputValueFromRaw("v3DistrictV2TargetingTopN", config.topN);
    syncInputValueFromRaw("v3DistrictV2TargetingMinHousingUnits", config.minHousingUnits);
    syncInputValueFromRaw("v3DistrictV2TargetingMinPopulation", config.minPopulation);
    syncInputValueFromRaw("v3DistrictV2TargetingMinScore", config.minScore);
    syncCheckboxCheckedFromRaw("v3DistrictV2TargetingOnlyRaceFootprint", config.onlyRaceFootprint);
    syncCheckboxCheckedFromRaw("v3DistrictV2TargetingPrioritizeYoung", config.prioritizeYoung);
    syncCheckboxCheckedFromRaw("v3DistrictV2TargetingPrioritizeRenters", config.prioritizeRenters);
    syncCheckboxCheckedFromRaw("v3DistrictV2TargetingAvoidHighMultiUnit", config.avoidHighMultiUnit);
    syncSelectOptions("v3DistrictV2TargetingDensityFloor", TARGETING_DENSITY_OPTIONS, config.densityFloor, { placeholder: "none" });
    syncInputValueFromRaw("v3DistrictV2TargetingWeightVotePotential", config.weightVotePotential);
    syncInputValueFromRaw("v3DistrictV2TargetingWeightTurnoutOpportunity", config.weightTurnoutOpportunity);
    syncInputValueFromRaw("v3DistrictV2TargetingWeightPersuasionIndex", config.weightPersuasionIndex);
    syncInputValueFromRaw("v3DistrictV2TargetingWeightFieldEfficiency", config.weightFieldEfficiency);

    const readiness = deriveReadiness(config, censusConfig, censusResults);
    latestReadiness = readiness;
    if (targetingActionStatusOverride === "Load ACS rows before running targeting." && readiness.ready) {
      targetingActionStatusOverride = "";
    }

    const derivedStatusText = String(results.statusText || "Run targeting.") || "Run targeting.";
    const statusText = targetingActionStatusOverride || (readiness.ready ? derivedStatusText : readiness.reason);
    const derivedMetaText = String(results.metaText || "").trim();
    const metaText = signalCoverageNote
      ? (derivedMetaText ? `${derivedMetaText} · ${signalCoverageNote}` : signalCoverageNote)
      : (derivedMetaText || "-");
    const flagFallbackText = signalCoverage.hasMissingFlagSignals
      ? `Flag signals limited by Census bundle (${signalCoverage.metricSet}).`
      : "No risk flags triggered.";
    const intelligence = deriveTargetingIntelligenceView(results.rows, benchmarkAdvisory);
    setText("v3DistrictV2TargetingReadiness", `Readiness: ${readiness.reason}`);
    setText("v3DistrictV2TargetingStatus", statusText);
    setText("v3DistrictV2TargetingMeta", metaText);
    const benchmarkCard = document.getElementById("v3DistrictV2TargetingBenchmarkCard");
    if (benchmarkCard instanceof HTMLElement) {
      benchmarkCard.hidden = !benchmarkAdvisory;
    }
    if (benchmarkAdvisory) {
      setText("v3DistrictV2TargetingBenchmarkStatus", benchmarkAdvisory.advisoryText || "Advisory context.");
      setText("v3DistrictV2TargetingBenchmarkQuality", benchmarkAdvisory.qualityText || "Benchmark confidence unavailable.");
      setText("v3DistrictV2TargetingBenchmarkPriority", `Priority geography IDs: ${benchmarkAdvisory.priorityText || "—"}`);
      setText("v3DistrictV2TargetingBenchmarkPriorityOverlap", `Priority overlap: ${benchmarkAdvisory.priorityOverlapText || "—"}`);
      setText("v3DistrictV2TargetingBenchmarkTurnout", `Turnout-opportunity GEOIDs: ${benchmarkAdvisory.turnoutText || "—"}`);
      setText("v3DistrictV2TargetingBenchmarkTurnoutOverlap", `Turnout overlap: ${benchmarkAdvisory.turnoutOverlapText || "—"}`);
      setText("v3DistrictV2TargetingBenchmarkInterpretation", benchmarkAdvisory.overlapInterpretationText || "Overlap interpretation unavailable.");
      setText(
        "v3DistrictV2TargetingBenchmarkInsights",
        intelligence.insightLines.length
          ? intelligence.insightLines.join(" ")
          : "No benchmark saturation warnings.",
      );
      setText("v3DistrictV2TargetingBenchmarkComparable", benchmarkAdvisory.comparableText || "Comparable pool unavailable.");
      setText("v3DistrictV2TargetingBenchmarkVolatility", benchmarkAdvisory.volatilityText || "Volatility focus unavailable.");
      setText(
        "v3DistrictV2TargetingBenchmarkProvenance",
        benchmarkAdvisory.provenanceText || "Source: imported/computed election benchmark history.",
      );
    }
    renderTargetingRows(results.rows, {
      setInnerHtmlWithTrace,
      escapeHtml,
      flagFallbackText,
      intelligenceRows: intelligence.rows,
    });

    const locked = !!config.controlsLocked;
    const readyForRun = readiness.ready;
    applyDisabled("v3DistrictV2TargetingGeoLevel", locked);
    applyDisabled("v3DistrictV2TargetingModelId", locked);
    applyDisabled("v3DistrictV2TargetingTopN", locked);
    applyDisabled("v3DistrictV2TargetingMinHousingUnits", locked);
    applyDisabled("v3DistrictV2TargetingMinPopulation", locked);
    applyDisabled("v3DistrictV2TargetingMinScore", locked);
    applyDisabled("v3DistrictV2TargetingOnlyRaceFootprint", locked);
    applyDisabled("v3DistrictV2TargetingPrioritizeYoung", locked);
    applyDisabled("v3DistrictV2TargetingPrioritizeRenters", locked);
    applyDisabled("v3DistrictV2TargetingAvoidHighMultiUnit", locked);
    applyDisabled("v3DistrictV2TargetingDensityFloor", locked);
    applyDisabled("v3DistrictV2TargetingWeightVotePotential", locked);
    applyDisabled("v3DistrictV2TargetingWeightTurnoutOpportunity", locked);
    applyDisabled("v3DistrictV2TargetingWeightPersuasionIndex", locked);
    applyDisabled("v3DistrictV2TargetingWeightFieldEfficiency", locked);
    applyDisabled("v3BtnDistrictV2TargetingResetWeights", locked || !config.canResetWeights);
    applyDisabled("v3BtnDistrictV2RunTargeting", locked || !readyForRun);
    applyDisabled("v3BtnDistrictV2ExportTargetingCsv", locked || !config.canExport);
    applyDisabled("v3BtnDistrictV2ExportTargetingJson", locked || !config.canExport);
  }

  function handleMutationResult(result, sourceToken) {
    if (!isTargetingSource(sourceToken)) {
      return false;
    }
    if (result == null) {
      targetingActionStatusOverride = "Targeting action failed to reach the runtime bridge. Reload the page and try again.";
      console.warn(`[district_v2_targeting] null bridge result (${sourceToken})`);
      return true;
    }
    if (result && typeof result === "object" && result.ok === false) {
      const code = String(result.code || "unknown").trim();
      if (code === "no_rows") {
        targetingActionStatusOverride = "Load ACS rows before running targeting.";
      } else if (code === "locked") {
        targetingActionStatusOverride = "Scenario is locked. Unlock edits before running targeting.";
      } else if (code === "run_failed") {
        targetingActionStatusOverride = resolveRunFailureMessage(result);
      } else if (code === "not_ready") {
        const detail = String(result?.message || latestReadiness.reason || "Targeting prerequisites are not met.").trim();
        targetingActionStatusOverride = `Run blocked: ${detail}`;
      } else {
        targetingActionStatusOverride = `Targeting action rejected (${code || "unknown"}).`;
      }
      return true;
    }
    if (result && typeof result === "object" && result.ok === true) {
      targetingActionStatusOverride = "";
      return true;
    }
    targetingActionStatusOverride = "Targeting action returned an unexpected response.";
    return true;
  }

  function bind(onMutation) {
    const emitMutation = typeof onMutation === "function" ? onMutation : () => {};

    const bindTargetingSelect = (id, field) => {
      const control = document.getElementById(id);
      if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
        return;
      }
      control.dataset.v3DistrictV2Bound = "1";
      control.addEventListener("change", () => {
        const result = setDistrictTargetingField(field, control.value);
        emitMutation(result, `setTargetingField:${field}`);
      });
    };

    const bindTargetingField = (id, field) => {
      const control = document.getElementById(id);
      if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
        return;
      }
      control.dataset.v3DistrictV2Bound = "1";
      const onCommit = () => {
        const result = setDistrictTargetingField(field, control.value);
        emitMutation(result, `setTargetingField:${field}`);
      };
      control.addEventListener("input", onCommit);
      control.addEventListener("change", onCommit);
    };

    const bindTargetingCheckbox = (id, field) => {
      const control = document.getElementById(id);
      if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
        return;
      }
      control.dataset.v3DistrictV2Bound = "1";
      control.addEventListener("change", () => {
        const result = setDistrictTargetingField(field, control.checked);
        emitMutation(result, `setTargetingField:${field}`);
      });
    };

    const bindTargetingAction = (id, action, source) => {
      const button = document.getElementById(id);
      if (!(button instanceof HTMLButtonElement) || button.dataset.v3DistrictV2Bound === "1") {
        return;
      }
      button.dataset.v3DistrictV2Bound = "1";
      button.addEventListener("click", () => {
        if (source === "runTargeting" && !latestReadiness.ready) {
          const blockedResult = {
            ok: false,
            code: "not_ready",
            message: latestReadiness.reason || "Targeting prerequisites are not met.",
          };
          emitMutation(blockedResult, source);
          return;
        }
        const result = action();
        emitMutation(result, source);
      });
    };

    bindTargetingSelect("v3DistrictV2TargetingGeoLevel", "geoLevel");

    const modelSelect = document.getElementById("v3DistrictV2TargetingModelId");
    if (modelSelect instanceof HTMLSelectElement && modelSelect.dataset.v3DistrictV2Bound !== "1") {
      modelSelect.dataset.v3DistrictV2Bound = "1";
      modelSelect.addEventListener("change", () => {
        const result = applyDistrictTargetingPreset(modelSelect.value);
        emitMutation(result, "applyTargetingPreset");
      });
    }

    bindTargetingField("v3DistrictV2TargetingTopN", "topN");
    bindTargetingField("v3DistrictV2TargetingMinHousingUnits", "minHousingUnits");
    bindTargetingField("v3DistrictV2TargetingMinPopulation", "minPopulation");
    bindTargetingField("v3DistrictV2TargetingMinScore", "minScore");
    bindTargetingCheckbox("v3DistrictV2TargetingOnlyRaceFootprint", "onlyRaceFootprint");
    bindTargetingCheckbox("v3DistrictV2TargetingPrioritizeYoung", "prioritizeYoung");
    bindTargetingCheckbox("v3DistrictV2TargetingPrioritizeRenters", "prioritizeRenters");
    bindTargetingCheckbox("v3DistrictV2TargetingAvoidHighMultiUnit", "avoidHighMultiUnit");
    bindTargetingSelect("v3DistrictV2TargetingDensityFloor", "densityFloor");
    bindTargetingField("v3DistrictV2TargetingWeightVotePotential", "weightVotePotential");
    bindTargetingField("v3DistrictV2TargetingWeightTurnoutOpportunity", "weightTurnoutOpportunity");
    bindTargetingField("v3DistrictV2TargetingWeightPersuasionIndex", "weightPersuasionIndex");
    bindTargetingField("v3DistrictV2TargetingWeightFieldEfficiency", "weightFieldEfficiency");

    bindTargetingAction("v3BtnDistrictV2TargetingResetWeights", () => resetDistrictTargetingWeights(), "resetTargetingWeights");
    bindTargetingAction("v3BtnDistrictV2RunTargeting", () => runDistrictTargeting(), "runTargeting");
    bindTargetingAction("v3BtnDistrictV2ExportTargetingCsv", () => exportDistrictTargetingCsv(), "exportTargetingCsv");
    bindTargetingAction("v3BtnDistrictV2ExportTargetingJson", () => exportDistrictTargetingJson(), "exportTargetingJson");
  }

  return {
    bind,
    sync,
    handleMutationResult,
  };
}
