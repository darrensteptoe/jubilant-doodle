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

function renderTargetingRows(rows, { setInnerHtmlWithTrace, escapeHtml, flagFallbackText = "No risk flags triggered." }) {
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
    list.map((row) => {
      const reasonValue = String(row?.reason || "").trim() || "—";
      const flagsValue = String(row?.flags || "").trim();
      const flagsCellText = flagsValue || String(flagFallbackText || "No risk flags triggered.");
      return `
        <tr>
          <td>${escapeHtml(String(row?.rank || ""))}</td>
          <td>${escapeHtml(String(row?.geography || ""))}</td>
          <td class="num">${escapeHtml(String(row?.score || ""))}</td>
          <td class="num">${escapeHtml(String(row?.votesPerHour || ""))}</td>
          <td>${escapeHtml(reasonValue)}</td>
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
        <div class="field">
          <label class="fpe-control-label" for="v3DistrictV2TargetingDensityFloor">Density floor</label>
          <select class="fpe-input" id="v3DistrictV2TargetingDensityFloor"></select>
        </div>
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
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2RunTargeting" type="button">Run targeting</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ExportTargetingCsv" type="button">Export targets CSV</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnDistrictV2ExportTargetingJson" type="button">Export targets JSON</button>
      </div>

      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingReadiness">Readiness: evaluating targeting prerequisites.</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingStatus">-</div>
      <div class="fpe-help fpe-help--flush" id="v3DistrictV2TargetingMeta">-</div>

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
    setText("v3DistrictV2TargetingReadiness", `Readiness: ${readiness.reason}`);
    setText("v3DistrictV2TargetingStatus", statusText);
    setText("v3DistrictV2TargetingMeta", metaText);
    renderTargetingRows(results.rows, { setInnerHtmlWithTrace, escapeHtml, flagFallbackText });

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
