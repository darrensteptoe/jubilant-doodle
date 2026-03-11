import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest } from "../compat.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  bindFieldProxy,
  bindSelectProxy,
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncFieldValue,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderControlsSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const governanceCol = createColumn("governance");
  const benchmarkCol = createColumn("benchmark");
  const calibrationCol = createColumn("calibration");

  const workflowCard = createCard({
    title: "Scenario governance",
    description: "Scenario lock and critical-change documentation requirements."
  });

  const evidenceCard = createCard({
    title: "Evidence workflow",
    description: "Attach references to missing audit items before decisions are logged."
  });

  const benchmarkCard = createCard({
    title: "Benchmark catalog",
    description: "Empirical ranges for critical assumptions, used for warnings only."
  });

  const feedbackCard = createCard({
    title: "Feedback loop",
    description: "Capture observed metrics and generate metadata-only drift recommendations."
  });

  const calibrationCard = createCard({
    title: "Calibration brief",
    description: "Client-facing calibration narrative, expert toggles, and stochastic model controls."
  });

  const summaryCard = createCard({
    title: "Governance summary",
    description: "Current controls posture, evidence status, and calibration readiness."
  });

  getCardBody(workflowCard).innerHTML = `
    <div id="v3ControlsWorkflowBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Use scenario lock for client-safe review windows.</li>
          <li>Require note/evidence when critical assumptions are changed.</li>
          <li>Keep rationale and lock reason current before export or decision log updates.</li>
        </ul>
      </div>
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
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Lock status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelScenarioLockStatus">Scenario lock OFF.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Workflow status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelWorkflowStatus">Governance controls healthy.</div>
        </div>
      </div>
    </div>
  `;

  getCardBody(evidenceCard).innerHTML = `
    <div id="v3ControlsEvidenceBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Select the unresolved critical edit first.</li>
          <li>Attach title/source/date and supporting URL or file hint.</li>
          <li>Add notes when policy requires rationale in addition to evidence.</li>
        </ul>
      </div>
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
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Missing evidence</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelMissingEvidenceCount">0 critical assumption edit(s) missing evidence.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Missing note</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelMissingNoteCount">0 critical assumption edit(s) missing note.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Attach status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelEvidenceStatus">Select an audit item, then attach evidence.</div>
        </div>
      </div>
      <div id="v3ControlsEvidenceTableHost"></div>
    </div>
  `;

  getCardBody(benchmarkCard).innerHTML = `
    <div id="v3ControlsBenchmarkBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Ranges are governance signals only and do not alter deterministic or Monte Carlo math.</li>
          <li>Use race-type scope to keep warning thresholds context-aware.</li>
          <li>Keep source title and notes current for review traceability.</li>
        </ul>
      </div>
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
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Catalog size</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelBenchmarkCount">0 benchmark entries configured.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Save status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelBenchmarkStatus">Ready.</div>
        </div>
      </div>
      <div id="v3ControlsBenchmarkTableHost"></div>
    </div>
  `;

  getCardBody(calibrationCard).innerHTML = `
    <div id="v3ControlsCalibrationBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Generate a client-facing calibration brief after benchmarks and evidence are reviewed.</li>
          <li>Use stochastic toggles for scenario stress testing, not for primary deterministic assumptions.</li>
          <li>Document capacity-decay and shock settings before sharing forecast outputs.</li>
        </ul>
      </div>
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
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Correlation model status</div>
        <div class="fpe-help fpe-help--flush" id="v3IntelCorrelationDisabledHint">No models yet.</div>
      </div>
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
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Decay status</div>
        <div class="fpe-help fpe-help--flush" id="v3IntelDecayStatus">Capacity decay OFF.</div>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnIntelAddDefaultCorrelation" type="button">Add default model</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelImportCorrelationJson" type="button">Import model JSON</button>
      </div>
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Correlation status</div>
        <div class="fpe-help fpe-help--flush" id="v3IntelCorrelationStatus">No correlation models configured.</div>
      </div>
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
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Configured shocks</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelShockScenarioCount">0 scenarios configured.</div>
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
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Shock status</div>
        <div class="fpe-help fpe-help--flush" id="v3IntelShockStatus">No shock scenarios configured.</div>
      </div>
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Calibration status</div>
        <div class="fpe-help fpe-help--flush" id="v3IntelCalibrationStatus">No calibration brief generated yet.</div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelCalibrationBriefContent">Brief content</label>
        <textarea class="fpe-input" id="v3IntelCalibrationBriefContent" rows="14" readonly></textarea>
      </div>
    </div>
  `;

  getCardBody(feedbackCard).innerHTML = `
    <div id="v3ControlsFeedbackBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Capture observed metrics before generating recommendations.</li>
          <li>Use recommendation preview for review, then apply only approved changes.</li>
          <li>What-if parsing is metadata only and should not bypass governance workflow.</li>
        </ul>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnIntelCaptureObserved" type="button">Capture observed metrics</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelGenerateRecommendations" type="button">Generate drift recommendations</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelApplyTopRecommendation" type="button">Apply top recommendation</button>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Observed count</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelObservedCount">0 observed metric entries captured.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Recommendation count</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelRecommendationCount">0 active drift recommendations.</div>
        </div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Observed status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelObservedStatus">No observed metrics captured yet.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Recommendation status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelRecommendationStatus">No drift recommendations generated yet.</div>
        </div>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3IntelWhatIfInput">What-if request parser</label>
        <div class="fpe-action-row">
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnIntelParseWhatIf" type="button">Parse what-if request</button>
        </div>
        <textarea class="fpe-input" id="v3IntelWhatIfInput" rows="3"></textarea>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Parsed request count</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelWhatIfCount">0 what-if requests parsed.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Parser status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelWhatIfStatus">No what-if requests parsed yet.</div>
        </div>
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
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-help fpe-help--flush">Dynamic status remains canonical in the right rail to avoid duplicated and diverging outputs.</div>
    </div>
  `;

  governanceCol.append(workflowCard, evidenceCard);
  benchmarkCol.append(benchmarkCard, feedbackCard);
  calibrationCol.append(calibrationCard, summaryCard);

  frame.append(governanceCol, benchmarkCol, calibrationCol);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Controls should make assumption governance explicit before client-facing decisions are logged.",
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
