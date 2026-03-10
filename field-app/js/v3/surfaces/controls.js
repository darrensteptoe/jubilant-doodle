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

  const censusCard = createCard({
    title: "Census assumptions",
    description: "Geography context, ACS rows, aggregate demographics, and election CSV dry-run workflow."
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

  mountLegacyNode({
    key: "v3-controls-status-stack-card",
    selector: "#stage-checks .stage-body-new > .card:first-of-type",
    target: getCardBody(statusCard)
  });

  mountLegacyNode({
    key: "v3-controls-census-card",
    selector: "#censusPhase1Card",
    target: getCardBody(censusCard)
  });

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
      <div id="v3ControlsBenchmarkTableHost" style="margin-top:10px;"></div>
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
      <div id="v3ControlsEvidenceTableHost" style="margin-top:10px;"></div>
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

  mountLegacyClosest({
    key: "v3-controls-feedback-card",
    childSelector: "#btnIntelCaptureObserved",
    closestSelector: ".card",
    target: getCardBody(feedbackCard)
  });

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
    <div class="note" style="margin-top:12px;">Recommended sequence before decisions or exports: validate right-rail checks, confirm assumption intent, review guardrails, then run self-test.</div>
    <div class="note" style="margin-top:8px;">Dynamic output duplication is intentionally removed from center panels to keep one canonical status source.</div>
  `;

  left.append(statusCard, censusCard, workflowCard, evidenceCard);
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
  return refreshControlsSummary;
}

function refreshControlsSummary() {
  syncControlsWorkflowBridge();
  syncControlsBenchmarkBridge();
  syncControlsEvidenceBridge();
  syncControlsCalibrationBridge();

  setText("v3ControlsWorkflowStatus", readText("#intelWorkflowStatus"));
  setText("v3ControlsBenchmarkCount", readText("#intelBenchmarkCount"));
  setText("v3ControlsMissingEvidence", readText("#intelMissingEvidenceCount"));
  setText("v3ControlsCalibrationStatus", readText("#intelCalibrationStatus"));
  setText("v3ControlsRecommendationCount", readText("#intelRecommendationCount"));
  setText("v3ControlsCensusStatus", readText("#censusStatus"));
  setText("v3ControlsCensusSelection", readText("#censusGeoStats"));
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
