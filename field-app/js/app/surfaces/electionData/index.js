import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody,
} from "../../componentFactory.js";
import { setText } from "../../surfaceUtils.js";
import { formatFixedNumber } from "../../../../core/utils.js";
import {
  applyElectionDataBenchmarksBridge,
  importElectionDataFileBridge,
  mapElectionDataColumnsBridge,
  readElectionDataCanonicalSnapshot,
  readElectionDataDerivedSnapshot,
  reconcileElectionDataCandidatesBridge,
  reconcileElectionDataGeographiesBridge,
} from "../../stateBridge.js";
import { renderElectionDataBenchmarksCard, syncElectionDataBenchmarks } from "./benchmarks.js";
import {
  renderElectionDataCandidateReconciliationCard,
  syncElectionDataCandidateReconciliation,
} from "./candidateReconciliation.js";
import { renderElectionDataColumnMappingCard, syncElectionDataColumnMapping } from "./columnMapping.js";
import {
  renderElectionDataGeographyReconciliationCard,
  syncElectionDataGeographyReconciliation,
} from "./geographyReconciliation.js";
import { renderElectionDataImportPanel, syncElectionDataImportPanel } from "./importPanel.js";
import { renderElectionDataNormalizedPreviewCard, syncElectionDataNormalizedPreview } from "./normalizedPreview.js";
import { renderElectionDataQualityPanelCard, syncElectionDataQualityPanel } from "./qualityPanel.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function parseJsonMap(input, { statusId = "" } = {}) {
  const text = cleanText(input);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Mapping JSON must be an object.");
    }
    return parsed;
  } catch (error) {
    if (statusId) {
      setText(statusId, cleanText(error?.message) || "Invalid JSON mapping.");
    }
    return null;
  }
}

function assignCardStatusId(card, id) {
  if (!(card instanceof HTMLElement)) return;
  const status = card.querySelector(".fpe-card__status");
  if (status instanceof HTMLElement) {
    status.id = id;
  }
}

function syncCardStatus(id, text) {
  setText(id, cleanText(text) || "Ready");
}

function syncElectionDataSummaryCard(canonical, derived) {
  const importStatus = cleanText(canonical?.import?.status) || "awaiting import";
  const rowCount = Array.isArray(canonical?.normalizedRows) ? canonical.normalizedRows.length : 0;
  const confidenceBand = cleanText(canonical?.quality?.confidenceBand) || "unknown";
  const qualityScore = Number.isFinite(Number(canonical?.quality?.score))
    ? Number(canonical.quality.score)
    : null;
  const benchmarkSuggestions = Array.isArray(canonical?.benchmarks?.benchmarkSuggestions)
    ? canonical.benchmarks.benchmarkSuggestions.length
    : 0;
  const downstreamReady = !!canonical?.benchmarks?.downstreamRecommendations;
  const summaryStatus = cleanText(derived?.statusText)
    || (rowCount > 0 ? "Election data loaded and ready for downstream use." : "Awaiting normalized election rows.");

  setText("v3ElectionDataSummaryRows", rowCount > 0 ? rowCount.toLocaleString("en-US") : "0");
  setText("v3ElectionDataSummaryImportStatus", importStatus);
  setText("v3ElectionDataSummaryConfidence", confidenceBand);
  setText("v3ElectionDataSummaryQuality", qualityScore == null ? "—" : formatFixedNumber(qualityScore, 2));
  setText("v3ElectionDataSummaryBenchmarks", benchmarkSuggestions > 0 ? String(benchmarkSuggestions) : "0");
  setText("v3ElectionDataSummaryDownstream", downstreamReady ? "Ready" : "Not ready");
  setText("v3ElectionDataSummaryStatus", summaryStatus);
}

function bindTextAreaTouch(id) {
  const textarea = document.getElementById(id);
  if (!(textarea instanceof HTMLTextAreaElement) || textarea.dataset.v3BoundTouch === "1") return;
  textarea.dataset.v3BoundTouch = "1";
  textarea.addEventListener("input", () => {
    textarea.dataset.userTouched = "1";
  });
}

export function renderElectionDataSurface(mount) {
  const frame = createCenterStackFrame();
  const center = createCenterStackColumn();

  const summaryCard = createCenterModuleCard({
    title: "Election Data summary",
    description: "Current import status, quality posture, and downstream readiness.",
    status: "Awaiting import",
  });
  assignCardStatusId(summaryCard, "v3ElectionDataSummaryCardStatus");

  const importCard = createCenterModuleCard({
    title: "Import panel",
    description: "Import Election CSV into canonical electionData state.",
    status: "Awaiting import",
  });
  assignCardStatusId(importCard, "v3ElectionDataImportCardStatus");

  const mappingCard = createCenterModuleCard({
    title: "Column mapping",
    description: "Map source columns to canonical electionData fields.",
    status: "Awaiting mapping",
  });
  assignCardStatusId(mappingCard, "v3ElectionDataMappingCardStatus");

  const previewCard = createCenterModuleCard({
    title: "Normalized preview",
    description: "Preview canonical normalized election rows.",
    status: "No rows",
  });
  assignCardStatusId(previewCard, "v3ElectionDataPreviewCardStatus");

  const candidateCard = createCenterModuleCard({
    title: "Candidate reconciliation",
    description: "Map candidate names and IDs to canonical references.",
    status: "Ready",
  });
  assignCardStatusId(candidateCard, "v3ElectionDataCandidateCardStatus");

  const geographyCard = createCenterModuleCard({
    title: "Geography reconciliation",
    description: "Map precinct and ward identifiers to canonical geography references.",
    status: "Ready",
  });
  assignCardStatusId(geographyCard, "v3ElectionDataGeographyCardStatus");

  const benchmarksCard = createCenterModuleCard({
    title: "Benchmarks",
    description: "Compute historical benchmarks and downstream recommendations.",
    status: "Awaiting benchmarks",
  });
  assignCardStatusId(benchmarksCard, "v3ElectionDataBenchmarksCardStatus");

  const qualityCard = createCenterModuleCard({
    title: "Quality panel",
    description: "Source QA, confidence, and normalization quality posture.",
    status: "Awaiting quality",
  });
  assignCardStatusId(qualityCard, "v3ElectionDataQualityCardStatus");

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Normalized rows</span><strong id="v3ElectionDataSummaryRows">0</strong></div>
      <div class="fpe-summary-row"><span>Import status</span><strong id="v3ElectionDataSummaryImportStatus">awaiting import</strong></div>
      <div class="fpe-summary-row"><span>Confidence band</span><strong id="v3ElectionDataSummaryConfidence">unknown</strong></div>
      <div class="fpe-summary-row"><span>Quality score</span><strong id="v3ElectionDataSummaryQuality">—</strong></div>
      <div class="fpe-summary-row"><span>Benchmark suggestions</span><strong id="v3ElectionDataSummaryBenchmarks">0</strong></div>
      <div class="fpe-summary-row"><span>Downstream readiness</span><strong id="v3ElectionDataSummaryDownstream">Not ready</strong></div>
    </div>
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataSummaryStatus">Awaiting normalized election rows.</div>
  `;

  renderElectionDataImportPanel({ importCard, getCardBody });
  renderElectionDataColumnMappingCard({ columnMappingCard: mappingCard, getCardBody });
  renderElectionDataNormalizedPreviewCard({ previewCard, getCardBody });
  renderElectionDataCandidateReconciliationCard({ candidateReconciliationCard: candidateCard, getCardBody });
  renderElectionDataGeographyReconciliationCard({ geographyReconciliationCard: geographyCard, getCardBody });
  renderElectionDataBenchmarksCard({ benchmarksCard, getCardBody });
  renderElectionDataQualityPanelCard({ qualityPanelCard: qualityCard, getCardBody });

  const bridgeStatus = document.createElement("div");
  bridgeStatus.id = "v3ElectionDataBridgeStatus";
  bridgeStatus.className = "fpe-alert fpe-alert--warn";
  bridgeStatus.hidden = true;

  const whyPanel = createWhyPanel([
    "Election Data is first-class canonical state, not a Census sidecar.",
    "District, Targeting, and Outcome consume benchmark outputs from this module.",
    "Reconciliation and quality checks should be complete before downstream apply.",
  ]);

  center.append(
    bridgeStatus,
    whyPanel,
    summaryCard,
    importCard,
    mappingCard,
    previewCard,
    candidateCard,
    geographyCard,
    benchmarksCard,
    qualityCard,
  );
  frame.append(center);
  mount.append(frame);

  bindTextAreaTouch("v3ElectionDataColumnMapJson");
  bindTextAreaTouch("v3ElectionDataCandidateMapJson");
  bindTextAreaTouch("v3ElectionDataGeographyMapJson");
  bindTextAreaTouch("v3ElectionDataImportText");

  bindElectionDataInteractions();
  return refreshElectionDataSurface;
}

function bindElectionDataInteractions() {
  const clearTextBtn = document.getElementById("v3BtnElectionDataClearImportText");
  if (clearTextBtn instanceof HTMLButtonElement && clearTextBtn.dataset.v3Bound !== "1") {
    clearTextBtn.dataset.v3Bound = "1";
    clearTextBtn.addEventListener("click", () => {
      const textArea = document.getElementById("v3ElectionDataImportText");
      if (textArea instanceof HTMLTextAreaElement) {
        textArea.value = "";
        textArea.dataset.userTouched = "1";
      }
    });
  }

  const importBtn = document.getElementById("v3BtnElectionDataImport");
  if (importBtn instanceof HTMLButtonElement && importBtn.dataset.v3Bound !== "1") {
    importBtn.dataset.v3Bound = "1";
    importBtn.addEventListener("click", async () => {
      const textArea = document.getElementById("v3ElectionDataImportText");
      const fileInput = document.getElementById("v3ElectionDataImportFile");
      const formatSelect = document.getElementById("v3ElectionDataImportFormat");

      let csvText = textArea instanceof HTMLTextAreaElement ? String(textArea.value || "") : "";
      let fileName = "";
      let fileSize = 0;

      const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : null;
      if (file) {
        fileName = cleanText(file.name);
        fileSize = Number.isFinite(Number(file.size)) ? Number(file.size) : 0;
        try {
          csvText = await file.text();
        } catch {
          setText("v3ElectionDataImportStatus", "Could not read selected file.");
          return;
        }
      }

      if (!cleanText(csvText)) {
        setText("v3ElectionDataImportStatus", "Provide CSV text or select a CSV file.");
        return;
      }

      const format = formatSelect instanceof HTMLSelectElement ? cleanText(formatSelect.value).toLowerCase() : "";
      importElectionDataFileBridge({
        csvText,
        fileName,
        fileSize,
        format,
      });
      refreshElectionDataSurface();
    });
  }

  const mapBtn = document.getElementById("v3BtnElectionDataApplyColumnMap");
  if (mapBtn instanceof HTMLButtonElement && mapBtn.dataset.v3Bound !== "1") {
    mapBtn.dataset.v3Bound = "1";
    mapBtn.addEventListener("click", () => {
      const editor = document.getElementById("v3ElectionDataColumnMapJson");
      const mapping = parseJsonMap(editor instanceof HTMLTextAreaElement ? editor.value : "", {
        statusId: "v3ElectionDataColumnMapStatus",
      });
      if (!mapping) return;
      mapElectionDataColumnsBridge({ columnMap: mapping });
      refreshElectionDataSurface();
    });
  }

  const candidateBtn = document.getElementById("v3BtnElectionDataApplyCandidateMap");
  if (candidateBtn instanceof HTMLButtonElement && candidateBtn.dataset.v3Bound !== "1") {
    candidateBtn.dataset.v3Bound = "1";
    candidateBtn.addEventListener("click", () => {
      const editor = document.getElementById("v3ElectionDataCandidateMapJson");
      const mapping = parseJsonMap(editor instanceof HTMLTextAreaElement ? editor.value : "", {
        statusId: "v3ElectionDataCandidateMapStatus",
      });
      if (!mapping) return;
      reconcileElectionDataCandidatesBridge({ mapping });
      refreshElectionDataSurface();
    });
  }

  const geographyBtn = document.getElementById("v3BtnElectionDataApplyGeographyMap");
  if (geographyBtn instanceof HTMLButtonElement && geographyBtn.dataset.v3Bound !== "1") {
    geographyBtn.dataset.v3Bound = "1";
    geographyBtn.addEventListener("click", () => {
      const editor = document.getElementById("v3ElectionDataGeographyMapJson");
      const mapping = parseJsonMap(editor instanceof HTMLTextAreaElement ? editor.value : "", {
        statusId: "v3ElectionDataGeographyMapStatus",
      });
      if (!mapping) return;
      reconcileElectionDataGeographiesBridge({ mapping });
      refreshElectionDataSurface();
    });
  }

  const benchmarksBtn = document.getElementById("v3BtnElectionDataApplyBenchmarks");
  if (benchmarksBtn instanceof HTMLButtonElement && benchmarksBtn.dataset.v3Bound !== "1") {
    benchmarksBtn.dataset.v3Bound = "1";
    benchmarksBtn.addEventListener("click", () => {
      const canonical = readElectionDataCanonicalSnapshot();
      applyElectionDataBenchmarksBridge({
        benchmarks: {
          benchmarkSuggestions: canonical?.benchmarks?.benchmarkSuggestions || [],
        },
        downstreamRecommendations: canonical?.benchmarks?.downstreamRecommendations || {},
      });
      refreshElectionDataSurface();
    });
  }
}

export function refreshElectionDataSurface() {
  const canonical = readElectionDataCanonicalSnapshot();
  const derived = readElectionDataDerivedSnapshot();
  const hasView = !!canonical || !!derived;

  const bridgeStatus = document.getElementById("v3ElectionDataBridgeStatus");
  if (bridgeStatus instanceof HTMLElement) {
    bridgeStatus.hidden = hasView;
    bridgeStatus.textContent = hasView
      ? ""
      : "Election Data bridge unavailable. Controls are disabled until runtime bridge is ready.";
  }

  if (!hasView) {
    return;
  }

  syncElectionDataImportPanel(canonical, derived);
  syncElectionDataColumnMapping(canonical, derived);
  syncElectionDataNormalizedPreview(canonical, derived);
  syncElectionDataCandidateReconciliation(canonical, derived);
  syncElectionDataGeographyReconciliation(canonical, derived);
  syncElectionDataBenchmarks(canonical, derived);
  syncElectionDataQualityPanel(canonical, derived);
  syncElectionDataSummaryCard(canonical, derived);

  const importStatus = cleanText(canonical?.import?.status);
  const rowCount = Array.isArray(canonical?.normalizedRows) ? canonical.normalizedRows.length : 0;
  const candidateNeedsReview = Array.isArray(canonical?.qa?.candidateWarnings) && canonical.qa.candidateWarnings.length > 0;
  const geographyNeedsReview = Array.isArray(canonical?.qa?.geographyWarnings) && canonical.qa.geographyWarnings.length > 0;
  syncCardStatus("v3ElectionDataImportCardStatus", importStatus === "imported" ? "Imported" : "Awaiting import");
  syncCardStatus("v3ElectionDataMappingCardStatus", cleanText(canonical?.schemaMapping?.status) === "mapped" ? "Mapped" : "Awaiting mapping");
  syncCardStatus("v3ElectionDataPreviewCardStatus", rowCount > 0 ? `${rowCount.toLocaleString("en-US")} rows` : "No rows");
  syncCardStatus("v3ElectionDataCandidateCardStatus", candidateNeedsReview ? "Needs review" : "Ready");
  syncCardStatus("v3ElectionDataGeographyCardStatus", geographyNeedsReview ? "Needs review" : "Ready");
  syncCardStatus("v3ElectionDataBenchmarksCardStatus", rowCount > 0 ? "Computed" : "Awaiting benchmarks");
  syncCardStatus("v3ElectionDataQualityCardStatus", cleanText(canonical?.quality?.confidenceBand) || "Awaiting quality");
  syncCardStatus("v3ElectionDataSummaryCardStatus", rowCount > 0 ? "Loaded" : "Awaiting import");
}
