import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  bindFieldProxy,
  bindSelectProxy,
  createFieldGrid,
  readText,
  setText,
  syncCheckboxValue,
  syncButtonDisabled,
  syncFieldValue,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderControlsSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const statusCard = createCard({
    title: "Status stack location",
    description: "Canonical dynamic status remains in the right rail; this page is governance workflow."
  });

  const workflowCard = createCard({
    title: "Scenario governance",
    description: "Scenario lock and critical-change documentation requirements."
  });

  const evidenceCard = createCard({
    title: "Evidence workflow",
    description: "Attach references to missing audit items and close governance gaps before decisions."
  });

  const benchmarkCard = createCard({
    title: "Benchmark catalog",
    description: "Empirical ranges for critical assumptions, used for warnings only."
  });

  const calibrationCard = createCard({
    title: "Calibration brief",
    description: "Client-facing calibration narrative, expert toggles, and stochastic model controls."
  });

  const feedbackCard = createCard({
    title: "Feedback loop",
    description: "Capture observed metrics and generate metadata-only drift recommendations."
  });

  const summaryCard = createCard({
    title: "Governance summary",
    description: "Current controls posture, evidence status, and calibration readiness."
  });

  getCardBody(statusCard).innerHTML = `
    <div class="fpe-help">Canonical dynamic status remains in the right rail to prevent drift and duplicate headlines.</div>
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Outcome stack</span><strong>Win path and expected state</strong></div>
      <div class="fpe-summary-row"><span>Fragility stack</span><strong>Stress + Monte Carlo behavior</strong></div>
      <div class="fpe-summary-row"><span>Integrity stack</span><strong>Validation and guardrail checks</strong></div>
    </div>
  `;

  getCardBody(workflowCard).innerHTML = `
    <div id="v3ControlsWorkflowBridgeRoot">
      <div class="fpe-help">Lock scenario edits for client-safe reviews and require note/evidence on critical assumption changes.</div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelScenarioLocked">Scenario lock</label>
          <label class="fpe-switch">
            <input id="v3IntelScenarioLocked" type="checkbox"/>
            <span>Lock scenario edits</span>
          </label>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelRequireCriticalNote">Critical note required</label>
          <label class="fpe-switch">
            <input id="v3IntelRequireCriticalNote" type="checkbox"/>
            <span>Require rationale note</span>
          </label>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelRequireCriticalEvidence">Critical evidence required</label>
          <label class="fpe-switch">
            <input id="v3IntelRequireCriticalEvidence" type="checkbox"/>
            <span>Require evidence attachment</span>
          </label>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelScenarioLockReason">Lock reason</label>
          <input class="fpe-input" id="v3IntelScenarioLockReason" placeholder="e.g., Client review freeze until Friday" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelCriticalChangeNote">Critical change note</label>
          <textarea class="fpe-input" id="v3IntelCriticalChangeNote" rows="2"></textarea>
        </div>
      </div>
      <div class="fpe-help" id="v3IntelScenarioLockStatus">Scenario lock OFF.</div>
      <div class="fpe-help" id="v3IntelWorkflowStatus">Governance controls healthy.</div>
    </div>
  `;

  getCardBody(benchmarkCard).innerHTML = `
    <div id="v3ControlsBenchmarkBridgeRoot">
      <div class="fpe-help">Define empirical ranges by race type. These warnings never alter deterministic or Monte Carlo outputs.</div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkRef">Reference</label>
          <select class="fpe-input" id="v3IntelBenchmarkRef"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkRaceType">Race type scope</label>
          <select class="fpe-input" id="v3IntelBenchmarkRaceType"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkDefault">Default value</label>
          <input class="fpe-input" id="v3IntelBenchmarkDefault" type="number" step="0.01"/>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkMin">Range min</label>
          <input class="fpe-input" id="v3IntelBenchmarkMin" type="number" step="0.01"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkMax">Range max</label>
          <input class="fpe-input" id="v3IntelBenchmarkMax" type="number" step="0.01"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkWarnAbove">Warn above</label>
          <input class="fpe-input" id="v3IntelBenchmarkWarnAbove" type="number" step="0.01"/>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkHardAbove">Hard above</label>
          <input class="fpe-input" id="v3IntelBenchmarkHardAbove" type="number" step="0.01"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkSourceTitle">Source title</label>
          <input class="fpe-input" id="v3IntelBenchmarkSourceTitle" type="text"/>
        </div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelBenchmarkSourceNotes">Source notes</label>
        <textarea class="fpe-input" id="v3IntelBenchmarkSourceNotes" rows="2"></textarea>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnIntelBenchmarkLoadDefaults" type="button">Load defaults</button>
        <button class="fpe-btn" id="v3BtnIntelBenchmarkSave" type="button">Save benchmark</button>
      </div>
      <div class="fpe-help" id="v3IntelBenchmarkCount">0 benchmark entries configured.</div>
      <div class="fpe-help" id="v3IntelBenchmarkStatus">Ready.</div>
      <div id="v3ControlsBenchmarkTableHost"></div>
    </div>
  `;

  getCardBody(evidenceCard).innerHTML = `
    <div id="v3ControlsEvidenceBridgeRoot">
      <div class="fpe-help">Resolve missing audit items by attaching evidence and rationale.</div>
      <div class="fpe-help">Workflow: 1) Select critical edit 2) Add title/source/date (+ note when required) 3) Attach evidence.</div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelAuditSelect">Critical assumption edit to resolve</label>
          <select class="fpe-input" id="v3IntelAuditSelect"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelEvidenceTitle">Evidence title</label>
          <input class="fpe-input" id="v3IntelEvidenceTitle" type="text"/>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelEvidenceSource">Evidence source</label>
          <input class="fpe-input" id="v3IntelEvidenceSource" type="text"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelEvidenceCapturedAt">Captured date</label>
          <input class="fpe-input" id="v3IntelEvidenceCapturedAt" type="date"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelEvidenceUrl">URL or file hint</label>
          <input class="fpe-input" id="v3IntelEvidenceUrl" type="text"/>
        </div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelEvidenceNotes">Evidence notes</label>
        <textarea class="fpe-input" id="v3IntelEvidenceNotes" rows="2"></textarea>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnIntelEvidenceAttach" type="button">Attach evidence</button>
      </div>
      <div class="fpe-help" id="v3IntelMissingEvidenceCount">0 critical assumption edit(s) missing evidence.</div>
      <div class="fpe-help" id="v3IntelMissingNoteCount">0 critical assumption edit(s) missing note.</div>
      <div class="fpe-help" id="v3IntelEvidenceStatus">Select an audit item, then attach evidence.</div>
      <div id="v3ControlsEvidenceTableHost"></div>
    </div>
  `;

  getCardBody(calibrationCard).innerHTML = `
    <div id="v3ControlsCalibrationBridgeRoot">
      <div class="fpe-help">Generate a client-ready calibration note from benchmark catalog, evidence coverage, and expert toggles.</div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBriefKind">Brief type</label>
          <select class="fpe-input" id="v3IntelBriefKind"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label">Brief actions</label>
          <div class="fpe-action-row">
            <button class="fpe-btn" id="v3BtnIntelCalibrationGenerate" type="button">Generate brief</button>
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelCalibrationCopy" type="button">Copy brief</button>
          </div>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelMcDistribution">Monte Carlo distribution</label>
          <select class="fpe-input" id="v3IntelMcDistribution"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelCorrelatedShocks">Correlated shocks</label>
          <label class="fpe-switch">
            <input id="v3IntelCorrelatedShocks" type="checkbox"/>
            <span>Enable correlation model in MC</span>
          </label>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelCorrelationMatrixId">Correlation model</label>
          <select class="fpe-input" id="v3IntelCorrelationMatrixId"></select>
        </div>
      </div>
      <div class="fpe-help" id="v3IntelCorrelationDisabledHint">No models yet.</div>
      <div class="fpe-field-grid fpe-field-grid--4">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelCapacityDecayEnabled">Capacity decay</label>
          <label class="fpe-switch">
            <input id="v3IntelCapacityDecayEnabled" type="checkbox"/>
            <span>Enable weekly capacity decay</span>
          </label>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelDecayModelType">Decay model</label>
          <select class="fpe-input" id="v3IntelDecayModelType"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelDecayWeeklyPct">Weekly decay %</label>
          <input class="fpe-input" id="v3IntelDecayWeeklyPct" type="number"/>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelDecayFloorPct">Floor % of baseline</label>
          <input class="fpe-input" id="v3IntelDecayFloorPct" type="number"/>
        </div>
      </div>
      <div class="fpe-help" id="v3IntelDecayStatus">Capacity decay OFF.</div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnIntelAddDefaultCorrelation" type="button">Add default model</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelImportCorrelationJson" type="button">Import model JSON</button>
      </div>
      <div class="fpe-help" id="v3IntelCorrelationStatus">No correlation models configured.</div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelCorrelationJson">Correlation model JSON</label>
        <textarea class="fpe-input" id="v3IntelCorrelationJson" rows="5"></textarea>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelShockScenariosEnabled">Shock scenarios</label>
          <label class="fpe-switch">
            <input id="v3IntelShockScenariosEnabled" type="checkbox"/>
            <span>Enable stochastic shock sampling in MC</span>
          </label>
        </div>
        <div class="field">
          <label class="fpe-control-label">Configured shocks</label>
          <div class="fpe-help" id="v3IntelShockScenarioCount">0 scenarios configured.</div>
        </div>
        <div class="field">
          <label class="fpe-control-label">Shock actions</label>
          <div class="fpe-action-row">
            <button class="fpe-btn" id="v3BtnIntelAddDefaultShock" type="button">Add default shock</button>
            <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelImportShockJson" type="button">Import shock JSON</button>
          </div>
        </div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelShockJson">Shock scenario JSON</label>
        <textarea class="fpe-input" id="v3IntelShockJson" rows="5"></textarea>
      </div>
      <div class="fpe-help" id="v3IntelShockStatus">No shock scenarios configured.</div>
      <div class="fpe-help" id="v3IntelCalibrationStatus">No calibration brief generated yet.</div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelCalibrationBriefContent">Brief content</label>
        <textarea class="fpe-input" id="v3IntelCalibrationBriefContent" rows="14" readonly></textarea>
      </div>
    </div>
  `;

  getCardBody(feedbackCard).innerHTML = `
    <div id="v3ControlsFeedbackBridgeRoot">
      <div class="fpe-help">Capture rolling observed metrics and generate metadata-only drift recommendations.</div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnIntelCaptureObserved" type="button">Capture observed metrics</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelGenerateRecommendations" type="button">Generate drift recommendations</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelApplyTopRecommendation" type="button">Apply top recommendation</button>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="fpe-help" id="v3IntelObservedCount">0 observed metric entries captured.</div>
        <div class="fpe-help" id="v3IntelRecommendationCount">0 active drift recommendations.</div>
      </div>
      <div class="fpe-help" id="v3IntelObservedStatus">No observed metrics captured yet.</div>
      <div class="fpe-help" id="v3IntelRecommendationStatus">No drift recommendations generated yet.</div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelWhatIfInput">What-if request parser</label>
        <div class="fpe-action-row">
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelParseWhatIf" type="button">Parse what-if request</button>
        </div>
        <textarea class="fpe-input" id="v3IntelWhatIfInput" rows="3"></textarea>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="fpe-help" id="v3IntelWhatIfCount">0 what-if requests parsed.</div>
        <div class="fpe-help" id="v3IntelWhatIfStatus">No what-if requests parsed yet.</div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelWhatIfPreview">Latest parsed request</label>
        <textarea class="fpe-input" id="v3IntelWhatIfPreview" rows="5" readonly></textarea>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelRecommendationPreview">Recommendation preview</label>
        <textarea class="fpe-input" id="v3IntelRecommendationPreview" rows="6" readonly></textarea>
      </div>
    </div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Governance status</span><strong id="v3ControlsWorkflowStatus">-</strong></div>
      <div class="fpe-summary-row"><span>Benchmark entries</span><strong id="v3ControlsBenchmarkCount">-</strong></div>
      <div class="fpe-summary-row"><span>Missing evidence</span><strong id="v3ControlsMissingEvidence">-</strong></div>
      <div class="fpe-summary-row"><span>Calibration status</span><strong id="v3ControlsCalibrationStatus">-</strong></div>
      <div class="fpe-summary-row"><span>Drift recommendation count</span><strong id="v3ControlsRecommendationCount">-</strong></div>
      <div class="fpe-summary-row"><span>Census fetch status</span><strong id="v3ControlsCensusStatus">-</strong></div>
      <div class="fpe-summary-row"><span>Census selection</span><strong id="v3ControlsCensusSelection">-</strong></div>
    </div>
    <div class="note">Recommended sequence before decisions or exports: validate right-rail checks, confirm assumption intent, review guardrails, then run self-test.</div>
    <div class="note">Dynamic output duplication is intentionally removed from center panels to keep one canonical status source.</div>
  `;

  left.append(statusCard, workflowCard, evidenceCard);
  right.append(benchmarkCard, calibrationCard, feedbackCard, summaryCard);

  frame.append(left, right);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Controls should make assumptions governance explicit before any client-facing decision is logged.",
      "Benchmark and evidence workflows add trust without mutating deterministic engine math.",
      "Use this page to verify auditability and calibration readiness before exporting scenarios."
    ])
  );

  mountLegacyClosest({
    key: "v3-controls-benchmark-table-wrap",
    childSelector: "#intelBenchmarkTbody",
    closestSelector: ".table-wrap",
    target: document.getElementById("v3ControlsBenchmarkTableHost")
  });

  mountLegacyClosest({
    key: "v3-controls-evidence-table-wrap",
    childSelector: "#intelEvidenceTbody",
    closestSelector: ".table-wrap",
    target: document.getElementById("v3ControlsEvidenceTableHost")
  });

  wireControlsWorkflowBridge();
  wireControlsBenchmarkBridge();
  wireControlsEvidenceBridge();
  wireControlsCalibrationBridge();
  wireControlsFeedbackBridge();
  return refreshControlsSummary;
}

function refreshControlsSummary() {
  syncControlsWorkflowBridge();
  syncControlsBenchmarkBridge();
  syncControlsEvidenceBridge();
  syncControlsCalibrationBridge();
  syncControlsFeedbackBridge();

  setText("v3ControlsWorkflowStatus", readText("#intelWorkflowStatus"));
  setText("v3ControlsBenchmarkCount", readText("#intelBenchmarkCount"));
  setText("v3ControlsMissingEvidence", readText("#intelMissingEvidenceCount"));
  setText("v3ControlsCalibrationStatus", readText("#intelCalibrationStatus"));
  setText("v3ControlsRecommendationCount", readText("#intelRecommendationCount"));
  setText("v3ControlsCensusStatus", readText("#censusStatus"));
  setText("v3ControlsCensusSelection", readText("#censusGeoStats"));
}

function buildControlsCensusBridge(target) {
  if (!target) {
    return;
  }

  target.innerHTML = `
    <div id="v3ControlsCensusBridgeRoot">
      <div class="fpe-help">Census-only flow: set geography context, fetch ACS rows, review aggregate demographics, and validate map/selection integrity.</div>
    </div>
  `;
  const root = document.getElementById("v3ControlsCensusBridgeRoot");
  if (!root) {
    return;
  }

  const contextGrid = createFieldGrid("fpe-field-grid--3");
  root.append(contextGrid);
  mountLegacyClosest({
    key: "v3-controls-census-api-key-field",
    childSelector: "#censusApiKey",
    closestSelector: ".field",
    target: contextGrid
  });
  mountLegacyClosest({
    key: "v3-controls-census-year-field",
    childSelector: "#censusAcsYear",
    closestSelector: ".field",
    target: contextGrid
  });
  mountLegacyClosest({
    key: "v3-controls-census-resolution-field",
    childSelector: "#censusResolution",
    closestSelector: ".field",
    target: contextGrid
  });
  mountLegacyNode({
    key: "v3-controls-census-context-hint",
    selector: "#censusContextHint",
    target: root
  });

  const geoGrid = createFieldGrid("fpe-field-grid--3");
  root.append(geoGrid);
  mountLegacyClosest({
    key: "v3-controls-census-state-field",
    childSelector: "#censusStateFips",
    closestSelector: ".field",
    target: geoGrid
  });
  mountLegacyClosest({
    key: "v3-controls-census-county-field",
    childSelector: "#censusCountyFips",
    closestSelector: ".field",
    target: geoGrid
  });
  mountLegacyClosest({
    key: "v3-controls-census-place-field",
    childSelector: "#censusPlaceFips",
    closestSelector: ".field",
    target: geoGrid
  });

  const bundleGrid = createFieldGrid("fpe-field-grid--2");
  root.append(bundleGrid);
  mountLegacyClosest({
    key: "v3-controls-census-metric-set-field",
    childSelector: "#censusMetricSet",
    closestSelector: ".field",
    target: bundleGrid
  });
  const actionField = document.createElement("div");
  actionField.className = "field";
  actionField.innerHTML = `
    <label class="fpe-control-label">Actions</label>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3BtnCensusLoadGeo" type="button">Load GEO list</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusFetchRows" type="button">Fetch ACS rows</button>
    </div>
  `;
  bundleGrid.append(actionField);

  const statusGrid = createFieldGrid("fpe-field-grid--2");
  statusGrid.innerHTML = `
    <div class="fpe-help" id="v3CensusStatus">Ready.</div>
    <div class="fpe-help" id="v3CensusGeoStats">0 selected of 0 GEOs. 0 rows loaded.</div>
  `;
  root.append(statusGrid);

  mountLegacyClosest({
    key: "v3-controls-census-main-grid",
    childSelector: "#censusGeoSearch",
    closestSelector: ".grid2",
    target: root
  });

  const geoSelectionActions = createFieldGrid("fpe-field-grid--2");
  geoSelectionActions.innerHTML = `
    <div class="field">
      <label class="fpe-control-label">GEO selection actions</label>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusApplyGeoPaste" type="button">Apply GEOIDs</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusSelectAll" type="button">Select all</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusClearSelection" type="button">Clear selection</button>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label">Aggregate exports</label>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusExportAggregateCsv" type="button">Export CSV</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusExportAggregateJson" type="button">Export JSON</button>
      </div>
    </div>
  `;
  root.append(geoSelectionActions);

  mountLegacyClosest({
    key: "v3-controls-census-advisory-table",
    childSelector: "#censusAdvisoryTbody",
    closestSelector: ".table-wrap",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-advisory-status",
    selector: "#censusAdvisoryStatus",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-advisory-guide",
    selector: "#censusAdvisoryGuide",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-selection-summary",
    selector: "#censusSelectionSummary",
    target: root
  });
  const footprintActions = document.createElement("div");
  footprintActions.className = "fpe-action-row";
  footprintActions.innerHTML = `
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusSetRaceFootprint" type="button">Set as race footprint</button>
    <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusClearRaceFootprint" type="button">Clear race footprint</button>
  `;
  root.append(footprintActions);
  mountLegacyNode({
    key: "v3-controls-census-footprint-status",
    selector: "#censusRaceFootprintStatus",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-provenance-status",
    selector: "#censusAssumptionProvenanceStatus",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-capacity-status",
    selector: "#censusFootprintCapacityStatus",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-apply-status",
    selector: "#censusApplyAdjustmentsStatus",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-election-details",
    selector: "#censusPhase1Card > details",
    target: root
  });
  const electionActionGrid = createFieldGrid("fpe-field-grid--2");
  electionActionGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label">Election CSV templates</label>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusDownloadElectionCsvTemplate" type="button">Download long-format template</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusDownloadElectionCsvWideTemplate" type="button">Download wide-format template</button>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label">Election CSV dry-run</label>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusElectionCsvDryRun" type="button">Run dry-run parse</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusElectionCsvClear" type="button">Clear preview</button>
      </div>
      <div class="fpe-help" id="v3CensusElectionCsvDryRunStatus">No dry-run run yet.</div>
      <div class="fpe-help" id="v3CensusElectionCsvPreviewMeta">No normalized preview rows.</div>
    </div>
  `;
  root.append(electionActionGrid);

  const selectionSetGrid = createFieldGrid("fpe-field-grid--2");
  selectionSetGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label" for="v3CensusSelectionSetName">Save selection set</label>
      <input class="fpe-input" id="v3CensusSelectionSetName" type="text"/>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusSaveSelectionSet" type="button">Save set</button>
      </div>
    </div>
    <div class="field">
      <label class="fpe-control-label" for="v3CensusSelectionSetSelect">Saved sets</label>
      <select class="fpe-input" id="v3CensusSelectionSetSelect"></select>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusLoadSelectionSet" type="button">Load set</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusDeleteSelectionSet" type="button">Delete</button>
      </div>
    </div>
  `;
  root.append(selectionSetGrid);
  mountLegacyNode({
    key: "v3-controls-census-selection-set-status",
    selector: "#censusSelectionSetStatus",
    target: root
  });
  mountLegacyNode({
    key: "v3-controls-census-last-fetch",
    selector: "#censusLastFetch",
    target: root
  });
  const mapActionsGrid = createFieldGrid("fpe-field-grid--2");
  mapActionsGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label">Map status</label>
      <div class="fpe-help" id="v3CensusMapStatus">Map idle.</div>
      <label class="fpe-switch">
        <input id="v3CensusMapQaVtdToggle" type="checkbox"/>
        <span>VTD QA overlay</span>
      </label>
    </div>
    <div class="field">
      <label class="fpe-control-label">Map actions</label>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusLoadMap" type="button">Load boundaries</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusClearMap" type="button">Clear map</button>
      </div>
    </div>
  `;
  root.append(mapActionsGrid);

  const vtdUploadGrid = createFieldGrid("fpe-field-grid--2");
  vtdUploadGrid.innerHTML = `
    <div class="field">
      <label class="fpe-control-label">VTD ZIP overlay source (optional)</label>
      <div id="v3CensusMapQaVtdZipHost"></div>
    </div>
    <div class="field">
      <label class="fpe-control-label">VTD ZIP action</label>
      <div class="fpe-action-row">
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnCensusMapQaVtdZipClear" type="button">Clear VTD ZIP</button>
      </div>
      <div class="fpe-help" id="v3CensusMapQaVtdZipStatus">No VTD ZIP loaded.</div>
    </div>
  `;
  root.append(vtdUploadGrid);
  mountLegacyNode({
    key: "v3-controls-census-vtd-zip-input",
    selector: "#censusMapQaVtdZip",
    target: document.getElementById("v3CensusMapQaVtdZipHost")
  });

  mountLegacyNode({
    key: "v3-controls-census-map",
    selector: "#censusMap",
    target: root
  });

  hideLegacyCensusActionButtons();
}

function wireControlsWorkflowBridge() {
  const root = document.getElementById("v3ControlsWorkflowBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindCheckboxProxy("v3IntelScenarioLocked", "intelScenarioLocked");
  bindCheckboxProxy("v3IntelRequireCriticalNote", "intelRequireCriticalNote");
  bindCheckboxProxy("v3IntelRequireCriticalEvidence", "intelRequireCriticalEvidence");
  bindFieldProxy("v3IntelScenarioLockReason", "intelScenarioLockReason");
  bindFieldProxy("v3IntelCriticalChangeNote", "intelCriticalChangeNote");
}

function syncControlsWorkflowBridge() {
  syncCheckboxValue("v3IntelScenarioLocked", "intelScenarioLocked");
  syncCheckboxValue("v3IntelRequireCriticalNote", "intelRequireCriticalNote");
  syncCheckboxValue("v3IntelRequireCriticalEvidence", "intelRequireCriticalEvidence");
  syncFieldValue("v3IntelScenarioLockReason", "intelScenarioLockReason");
  syncFieldValue("v3IntelCriticalChangeNote", "intelCriticalChangeNote");
  setText("v3IntelScenarioLockStatus", readText("#intelScenarioLockStatus"));
  setText("v3IntelWorkflowStatus", readText("#intelWorkflowStatus"));
}

function wireControlsCensusBridge() {
  const root = document.getElementById("v3ControlsCensusBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindFieldProxy("v3CensusSelectionSetName", "censusSelectionSetName");
  bindSelectProxy("v3CensusSelectionSetSelect", "censusSelectionSetSelect");
  bindCheckboxProxy("v3CensusMapQaVtdToggle", "censusMapQaVtdToggle");
  bindCheckboxProxy(
    "v3ControlsCensusApplyAdjustmentsToggle",
    "censusApplyAdjustmentsToggle"
  );

  bindClickProxy("v3BtnCensusLoadGeo", "btnCensusLoadGeo");
  bindClickProxy("v3BtnCensusFetchRows", "btnCensusFetchRows");
  bindClickProxy("v3BtnCensusApplyGeoPaste", "btnCensusApplyGeoPaste");
  bindClickProxy("v3BtnCensusSelectAll", "btnCensusSelectAll");
  bindClickProxy("v3BtnCensusClearSelection", "btnCensusClearSelection");
  bindClickProxy("v3BtnCensusExportAggregateCsv", "btnCensusExportAggregateCsv");
  bindClickProxy("v3BtnCensusExportAggregateJson", "btnCensusExportAggregateJson");
  bindClickProxy("v3BtnCensusSetRaceFootprint", "btnCensusSetRaceFootprint");
  bindClickProxy("v3BtnCensusClearRaceFootprint", "btnCensusClearRaceFootprint");
  bindClickProxy(
    "v3BtnCensusDownloadElectionCsvTemplate",
    "btnCensusDownloadElectionCsvTemplate"
  );
  bindClickProxy(
    "v3BtnCensusDownloadElectionCsvWideTemplate",
    "btnCensusDownloadElectionCsvWideTemplate"
  );
  bindClickProxy("v3BtnCensusElectionCsvDryRun", "btnCensusElectionCsvDryRun");
  bindClickProxy("v3BtnCensusElectionCsvClear", "btnCensusElectionCsvClear");
  bindClickProxy("v3BtnCensusSaveSelectionSet", "btnCensusSaveSelectionSet");
  bindClickProxy("v3BtnCensusLoadSelectionSet", "btnCensusLoadSelectionSet");
  bindClickProxy("v3BtnCensusDeleteSelectionSet", "btnCensusDeleteSelectionSet");
  bindClickProxy("v3BtnCensusLoadMap", "btnCensusLoadMap");
  bindClickProxy("v3BtnCensusClearMap", "btnCensusClearMap");
  bindClickProxy("v3BtnCensusMapQaVtdZipClear", "btnCensusMapQaVtdZipClear");
}

function syncControlsCensusBridge() {
  syncFieldValue("v3CensusSelectionSetName", "censusSelectionSetName");
  syncSelectValue("v3CensusSelectionSetSelect", "censusSelectionSetSelect");
  syncCheckboxValue("v3CensusMapQaVtdToggle", "censusMapQaVtdToggle");
  syncCheckboxValue(
    "v3ControlsCensusApplyAdjustmentsToggle",
    "censusApplyAdjustmentsToggle"
  );

  setText("v3CensusStatus", readText("#censusStatus"));
  setText("v3CensusGeoStats", readText("#censusGeoStats"));
  setText("v3CensusMapStatus", readText("#censusMapStatus"));
  setText("v3CensusMapQaVtdZipStatus", readText("#censusMapQaVtdZipStatus"));
  setText("v3CensusElectionCsvDryRunStatus", readText("#censusElectionCsvDryRunStatus"));
  setText("v3CensusElectionCsvPreviewMeta", readText("#censusElectionCsvPreviewMeta"));

  const v3QaToggle = document.getElementById("v3CensusMapQaVtdToggle");
  const legacyQaToggle = document.getElementById("censusMapQaVtdToggle");
  if (v3QaToggle instanceof HTMLInputElement && legacyQaToggle instanceof HTMLInputElement) {
    v3QaToggle.disabled = legacyQaToggle.disabled;
  }
  const v3CensusApplyToggle = document.getElementById("v3ControlsCensusApplyAdjustmentsToggle");
  const legacyCensusApplyToggle = document.getElementById("censusApplyAdjustmentsToggle");
  if (
    v3CensusApplyToggle instanceof HTMLInputElement &&
    legacyCensusApplyToggle instanceof HTMLInputElement
  ) {
    v3CensusApplyToggle.disabled = legacyCensusApplyToggle.disabled;
  }

  syncButtonDisabled("v3BtnCensusLoadGeo", "btnCensusLoadGeo");
  syncButtonDisabled("v3BtnCensusFetchRows", "btnCensusFetchRows");
  syncButtonDisabled("v3BtnCensusApplyGeoPaste", "btnCensusApplyGeoPaste");
  syncButtonDisabled("v3BtnCensusSelectAll", "btnCensusSelectAll");
  syncButtonDisabled("v3BtnCensusClearSelection", "btnCensusClearSelection");
  syncButtonDisabled("v3BtnCensusExportAggregateCsv", "btnCensusExportAggregateCsv");
  syncButtonDisabled("v3BtnCensusExportAggregateJson", "btnCensusExportAggregateJson");
  syncButtonDisabled("v3BtnCensusSetRaceFootprint", "btnCensusSetRaceFootprint");
  syncButtonDisabled("v3BtnCensusClearRaceFootprint", "btnCensusClearRaceFootprint");
  syncButtonDisabled(
    "v3BtnCensusDownloadElectionCsvTemplate",
    "btnCensusDownloadElectionCsvTemplate"
  );
  syncButtonDisabled(
    "v3BtnCensusDownloadElectionCsvWideTemplate",
    "btnCensusDownloadElectionCsvWideTemplate"
  );
  syncButtonDisabled("v3BtnCensusElectionCsvDryRun", "btnCensusElectionCsvDryRun");
  syncButtonDisabled("v3BtnCensusElectionCsvClear", "btnCensusElectionCsvClear");
  syncButtonDisabled("v3BtnCensusSaveSelectionSet", "btnCensusSaveSelectionSet");
  syncButtonDisabled("v3BtnCensusLoadSelectionSet", "btnCensusLoadSelectionSet");
  syncButtonDisabled("v3BtnCensusDeleteSelectionSet", "btnCensusDeleteSelectionSet");
  syncButtonDisabled("v3BtnCensusLoadMap", "btnCensusLoadMap");
  syncButtonDisabled("v3BtnCensusClearMap", "btnCensusClearMap");
  syncButtonDisabled("v3BtnCensusMapQaVtdZipClear", "btnCensusMapQaVtdZipClear");
}

function hideLegacyCensusActionButtons() {
  [
    "btnCensusApplyGeoPaste",
    "btnCensusSelectAll",
    "btnCensusClearSelection",
    "btnCensusExportAggregateCsv",
    "btnCensusExportAggregateJson",
    "btnCensusDownloadElectionCsvTemplate",
    "btnCensusDownloadElectionCsvWideTemplate",
    "btnCensusElectionCsvDryRun",
    "btnCensusElectionCsvClear"
  ].forEach((id) => {
    const legacy = document.getElementById(id);
    if (!(legacy instanceof HTMLElement)) {
      return;
    }
    legacy.style.display = "none";
    legacy.setAttribute("aria-hidden", "true");
  });
}

function wireControlsBenchmarkBridge() {
  const root = document.getElementById("v3ControlsBenchmarkBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindSelectProxy("v3IntelBenchmarkRef", "intelBenchmarkRef");
  bindSelectProxy("v3IntelBenchmarkRaceType", "intelBenchmarkRaceType");
  bindFieldProxy("v3IntelBenchmarkDefault", "intelBenchmarkDefault");
  bindFieldProxy("v3IntelBenchmarkMin", "intelBenchmarkMin");
  bindFieldProxy("v3IntelBenchmarkMax", "intelBenchmarkMax");
  bindFieldProxy("v3IntelBenchmarkWarnAbove", "intelBenchmarkWarnAbove");
  bindFieldProxy("v3IntelBenchmarkHardAbove", "intelBenchmarkHardAbove");
  bindFieldProxy("v3IntelBenchmarkSourceTitle", "intelBenchmarkSourceTitle");
  bindFieldProxy("v3IntelBenchmarkSourceNotes", "intelBenchmarkSourceNotes");

  bindClickProxy("v3BtnIntelBenchmarkLoadDefaults", "btnIntelBenchmarkLoadDefaults");
  bindClickProxy("v3BtnIntelBenchmarkSave", "btnIntelBenchmarkSave");
}

function syncControlsBenchmarkBridge() {
  syncSelectValue("v3IntelBenchmarkRef", "intelBenchmarkRef");
  syncSelectValue("v3IntelBenchmarkRaceType", "intelBenchmarkRaceType");
  syncFieldValue("v3IntelBenchmarkDefault", "intelBenchmarkDefault");
  syncFieldValue("v3IntelBenchmarkMin", "intelBenchmarkMin");
  syncFieldValue("v3IntelBenchmarkMax", "intelBenchmarkMax");
  syncFieldValue("v3IntelBenchmarkWarnAbove", "intelBenchmarkWarnAbove");
  syncFieldValue("v3IntelBenchmarkHardAbove", "intelBenchmarkHardAbove");
  syncFieldValue("v3IntelBenchmarkSourceTitle", "intelBenchmarkSourceTitle");
  syncFieldValue("v3IntelBenchmarkSourceNotes", "intelBenchmarkSourceNotes");
  setText("v3IntelBenchmarkCount", readText("#intelBenchmarkCount"));
  setText("v3IntelBenchmarkStatus", readText("#intelBenchmarkStatus"));

  syncButtonDisabled("v3BtnIntelBenchmarkLoadDefaults", "btnIntelBenchmarkLoadDefaults");
  syncButtonDisabled("v3BtnIntelBenchmarkSave", "btnIntelBenchmarkSave");
}

function wireControlsEvidenceBridge() {
  const root = document.getElementById("v3ControlsEvidenceBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindSelectProxy("v3IntelAuditSelect", "intelAuditSelect");
  bindFieldProxy("v3IntelEvidenceTitle", "intelEvidenceTitle");
  bindFieldProxy("v3IntelEvidenceSource", "intelEvidenceSource");
  bindFieldProxy("v3IntelEvidenceCapturedAt", "intelEvidenceCapturedAt");
  bindFieldProxy("v3IntelEvidenceUrl", "intelEvidenceUrl");
  bindFieldProxy("v3IntelEvidenceNotes", "intelEvidenceNotes");

  bindClickProxy("v3BtnIntelEvidenceAttach", "btnIntelEvidenceAttach");
}

function syncControlsEvidenceBridge() {
  syncSelectValue("v3IntelAuditSelect", "intelAuditSelect");
  syncFieldValue("v3IntelEvidenceTitle", "intelEvidenceTitle");
  syncFieldValue("v3IntelEvidenceSource", "intelEvidenceSource");
  syncFieldValue("v3IntelEvidenceCapturedAt", "intelEvidenceCapturedAt");
  syncFieldValue("v3IntelEvidenceUrl", "intelEvidenceUrl");
  syncFieldValue("v3IntelEvidenceNotes", "intelEvidenceNotes");

  setText("v3IntelMissingEvidenceCount", readText("#intelMissingEvidenceCount"));
  setText("v3IntelMissingNoteCount", readText("#intelMissingNoteCount"));
  setText("v3IntelEvidenceStatus", readText("#intelEvidenceStatus"));

  syncButtonDisabled("v3BtnIntelEvidenceAttach", "btnIntelEvidenceAttach");
}

function wireControlsCalibrationBridge() {
  const root = document.getElementById("v3ControlsCalibrationBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindSelectProxy("v3IntelBriefKind", "intelBriefKind");
  bindSelectProxy("v3IntelMcDistribution", "intelMcDistribution");
  bindCheckboxProxy("v3IntelCorrelatedShocks", "intelCorrelatedShocks");
  bindSelectProxy("v3IntelCorrelationMatrixId", "intelCorrelationMatrixId");
  bindCheckboxProxy("v3IntelCapacityDecayEnabled", "intelCapacityDecayEnabled");
  bindSelectProxy("v3IntelDecayModelType", "intelDecayModelType");
  bindFieldProxy("v3IntelDecayWeeklyPct", "intelDecayWeeklyPct");
  bindFieldProxy("v3IntelDecayFloorPct", "intelDecayFloorPct");
  bindFieldProxy("v3IntelCorrelationJson", "intelCorrelationJson");
  bindCheckboxProxy("v3IntelShockScenariosEnabled", "intelShockScenariosEnabled");
  bindFieldProxy("v3IntelShockJson", "intelShockJson");

  bindClickProxy("v3BtnIntelCalibrationGenerate", "btnIntelCalibrationGenerate");
  bindClickProxy("v3BtnIntelCalibrationCopy", "btnIntelCalibrationCopy");
  bindClickProxy("v3BtnIntelAddDefaultCorrelation", "btnIntelAddDefaultCorrelation");
  bindClickProxy("v3BtnIntelImportCorrelationJson", "btnIntelImportCorrelationJson");
  bindClickProxy("v3BtnIntelAddDefaultShock", "btnIntelAddDefaultShock");
  bindClickProxy("v3BtnIntelImportShockJson", "btnIntelImportShockJson");
}

function syncControlsCalibrationBridge() {
  syncSelectValue("v3IntelBriefKind", "intelBriefKind");
  syncSelectValue("v3IntelMcDistribution", "intelMcDistribution");
  syncCheckboxValue("v3IntelCorrelatedShocks", "intelCorrelatedShocks");
  syncSelectValue("v3IntelCorrelationMatrixId", "intelCorrelationMatrixId");
  syncCheckboxValue("v3IntelCapacityDecayEnabled", "intelCapacityDecayEnabled");
  syncSelectValue("v3IntelDecayModelType", "intelDecayModelType");
  syncFieldValue("v3IntelDecayWeeklyPct", "intelDecayWeeklyPct");
  syncFieldValue("v3IntelDecayFloorPct", "intelDecayFloorPct");
  syncFieldValue("v3IntelCorrelationJson", "intelCorrelationJson");
  syncCheckboxValue("v3IntelShockScenariosEnabled", "intelShockScenariosEnabled");
  syncFieldValue("v3IntelShockJson", "intelShockJson");
  syncFieldValue("v3IntelCalibrationBriefContent", "intelCalibrationBriefContent");

  setText("v3IntelCorrelationDisabledHint", readText("#intelCorrelationDisabledHint"));
  setText("v3IntelDecayStatus", readText("#intelDecayStatus"));
  setText("v3IntelCorrelationStatus", readText("#intelCorrelationStatus"));
  setText("v3IntelShockScenarioCount", readText("#intelShockScenarioCount"));
  setText("v3IntelShockStatus", readText("#intelShockStatus"));
  setText("v3IntelCalibrationStatus", readText("#intelCalibrationStatus"));

  syncButtonDisabled("v3BtnIntelCalibrationGenerate", "btnIntelCalibrationGenerate");
  syncButtonDisabled("v3BtnIntelCalibrationCopy", "btnIntelCalibrationCopy");
  syncButtonDisabled("v3BtnIntelAddDefaultCorrelation", "btnIntelAddDefaultCorrelation");
  syncButtonDisabled("v3BtnIntelImportCorrelationJson", "btnIntelImportCorrelationJson");
  syncButtonDisabled("v3BtnIntelAddDefaultShock", "btnIntelAddDefaultShock");
  syncButtonDisabled("v3BtnIntelImportShockJson", "btnIntelImportShockJson");
}

function wireControlsFeedbackBridge() {
  const root = document.getElementById("v3ControlsFeedbackBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindFieldProxy("v3IntelWhatIfInput", "intelWhatIfInput");

  bindClickProxy("v3BtnIntelCaptureObserved", "btnIntelCaptureObserved");
  bindClickProxy("v3BtnIntelGenerateRecommendations", "btnIntelGenerateRecommendations");
  bindClickProxy("v3BtnIntelApplyTopRecommendation", "btnIntelApplyTopRecommendation");
  bindClickProxy("v3BtnIntelParseWhatIf", "btnIntelParseWhatIf");
}

function syncControlsFeedbackBridge() {
  syncFieldValue("v3IntelWhatIfInput", "intelWhatIfInput");
  syncFieldValue("v3IntelWhatIfPreview", "intelWhatIfPreview");
  syncFieldValue("v3IntelRecommendationPreview", "intelRecommendationPreview");

  setText("v3IntelObservedCount", readText("#intelObservedCount"));
  setText("v3IntelRecommendationCount", readText("#intelRecommendationCount"));
  setText("v3IntelObservedStatus", readText("#intelObservedStatus"));
  setText("v3IntelRecommendationStatus", readText("#intelRecommendationStatus"));
  setText("v3IntelWhatIfCount", readText("#intelWhatIfCount"));
  setText("v3IntelWhatIfStatus", readText("#intelWhatIfStatus"));

  syncButtonDisabled("v3BtnIntelCaptureObserved", "btnIntelCaptureObserved");
  syncButtonDisabled("v3BtnIntelGenerateRecommendations", "btnIntelGenerateRecommendations");
  syncButtonDisabled("v3BtnIntelApplyTopRecommendation", "btnIntelApplyTopRecommendation");
  syncButtonDisabled("v3BtnIntelParseWhatIf", "btnIntelParseWhatIf");
}
