import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  bindFieldProxy,
  bindSelectProxy,
  syncControlDisabled,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncFieldValue,
  syncLegacyTableRows,
  syncSelectValue
} from "../surfaceUtils.js";
import { listIntelEvidence } from "../../intelControlsRuntime.js";

const SCENARIO_API_KEY = "__FPE_SCENARIO_API__";

export function renderControlsSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const governanceCol = createColumn("governance");
  const benchmarkCol = createColumn("benchmark");
  const calibrationCol = createColumn("calibration");

  const workflowCard = createCard({
    title: "Guardrails",
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
    title: "Review workflow",
    description: "Capture observed metrics and generate metadata-only drift recommendations."
  });

  const calibrationCard = createCard({
    title: "Integrity summary",
    description: "Calibration narrative, expert toggles, and stochastic model controls."
  });

  const summaryCard = createCard({
    title: "Current warnings",
    description: "Live governance warning posture across evidence, calibration, and recommendation workflows."
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
      <div class="fpe-status-strip fpe-status-strip--2">
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
      <div class="fpe-status-strip fpe-status-strip--3">
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
      <div class="table-wrap">
        <table class="table" aria-label="Controls evidence records">
          <thead>
            <tr>
              <th>Evidence title</th>
              <th>Source</th>
              <th>Captured</th>
              <th>Ref</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody id="v3IntelEvidenceTbody">
            <tr><td class="muted" colspan="5">No evidence records yet.</td></tr>
          </tbody>
        </table>
      </div>
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
      <div class="fpe-status-strip fpe-status-strip--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Catalog size</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelBenchmarkCount">0 benchmark entries configured.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Save status</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelBenchmarkStatus">Ready.</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table" aria-label="Controls benchmark catalog">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Race type</th>
              <th class="num">Range</th>
              <th class="num">Warn/Hard</th>
              <th>Source</th>
              <th class="num">Action</th>
            </tr>
          </thead>
          <tbody id="v3IntelBenchmarkTbody">
            <tr><td class="muted" colspan="6">No benchmark entries configured.</td></tr>
          </tbody>
        </table>
      </div>
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
      <div class="fpe-status-strip fpe-status-strip--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Observed count</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelObservedCount">0 observed metric entries captured.</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Recommendation count</div>
          <div class="fpe-help fpe-help--flush" id="v3IntelRecommendationCount">0 active drift recommendations.</div>
        </div>
      </div>
      <div class="fpe-status-strip fpe-status-strip--2">
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
      <div class="fpe-status-strip fpe-status-strip--2">
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
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Governance status</div>
        <div class="fpe-help fpe-help--flush" id="v3ControlsWorkflowStatus">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Benchmark entries</div>
        <div class="fpe-help fpe-help--flush" id="v3ControlsBenchmarkCount">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Missing evidence</div>
        <div class="fpe-help fpe-help--flush" id="v3ControlsMissingEvidence">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Calibration status</div>
        <div class="fpe-help fpe-help--flush" id="v3ControlsCalibrationStatus">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Drift recommendation count</div>
        <div class="fpe-help fpe-help--flush" id="v3ControlsRecommendationCount">-</div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-help fpe-help--flush">Dynamic status remains canonical in the right rail to avoid duplicated and diverging outputs.</div>
    </div>
  `;

  governanceCol.append(benchmarkCard, evidenceCard);
  benchmarkCol.append(workflowCard, feedbackCard);
  calibrationCol.append(summaryCard, calibrationCard);

  frame.append(governanceCol, benchmarkCol, calibrationCol);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Controls should make assumption governance explicit before client-facing decisions are logged.",
      "Benchmark and evidence workflows add trust without mutating deterministic engine math.",
      "Use this page to verify auditability and calibration readiness before exporting scenarios."
    ])
  );

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

  setText("v3ControlsWorkflowStatus", readDomTextById("v3IntelWorkflowStatus") || "Governance controls healthy.");
  setText("v3ControlsBenchmarkCount", readDomTextById("v3IntelBenchmarkCount") || "0 benchmark entries configured.");
  setText("v3ControlsMissingEvidence", readDomTextById("v3IntelMissingEvidenceCount") || "0 critical assumption edit(s) missing evidence.");
  setText("v3ControlsCalibrationStatus", readDomTextById("v3IntelCalibrationStatus") || "No calibration brief generated yet.");
  setText("v3ControlsRecommendationCount", readDomTextById("v3IntelRecommendationCount") || "0 active drift recommendations.");
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
  syncControlsDisabled([
    ["v3IntelScenarioLocked", "intelScenarioLocked"],
    ["v3IntelRequireCriticalNote", "intelRequireCriticalNote"],
    ["v3IntelRequireCriticalEvidence", "intelRequireCriticalEvidence"],
    ["v3IntelScenarioLockReason", "intelScenarioLockReason"],
    ["v3IntelCriticalChangeNote", "intelCriticalChangeNote"]
  ]);
  setText("v3IntelScenarioLockStatus", buildScenarioLockStatus());
  setText("v3IntelWorkflowStatus", buildWorkflowStatus());
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

  const v3BenchmarkTbody = document.getElementById("v3IntelBenchmarkTbody");
  if (v3BenchmarkTbody) {
    v3BenchmarkTbody.addEventListener("click", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLElement)) return;
      const removeBtn = target.closest("[data-bm-remove]");
      if (!(removeBtn instanceof HTMLElement)) return;
      const removeId = String(removeBtn.getAttribute("data-bm-remove") || "").trim();
      if (!removeId) return;

      const legacyButtons = Array.from(
        document.querySelectorAll("#intelBenchmarkTbody [data-bm-remove]")
      );
      const legacyBtn = legacyButtons.find((btn) => {
        if (!(btn instanceof HTMLElement)) return false;
        return String(btn.getAttribute("data-bm-remove") || "").trim() === removeId;
      });
      if (legacyBtn instanceof HTMLElement) {
        legacyBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
  }
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
  syncControlsDisabled([
    ["v3IntelBenchmarkRef", "intelBenchmarkRef"],
    ["v3IntelBenchmarkRaceType", "intelBenchmarkRaceType"],
    ["v3IntelBenchmarkDefault", "intelBenchmarkDefault"],
    ["v3IntelBenchmarkMin", "intelBenchmarkMin"],
    ["v3IntelBenchmarkMax", "intelBenchmarkMax"],
    ["v3IntelBenchmarkWarnAbove", "intelBenchmarkWarnAbove"],
    ["v3IntelBenchmarkHardAbove", "intelBenchmarkHardAbove"],
    ["v3IntelBenchmarkSourceTitle", "intelBenchmarkSourceTitle"],
    ["v3IntelBenchmarkSourceNotes", "intelBenchmarkSourceNotes"]
  ]);
  const benchmarkRows = syncLegacyTableRows({
    sourceSelector: "#intelBenchmarkTbody",
    targetBodyId: "v3IntelBenchmarkTbody",
    expectedCols: 6,
    emptyLabel: "No benchmark entries configured."
  });
  setText("v3IntelBenchmarkCount", formatRecordCount(benchmarkRows, "benchmark entry", "configured"));
  setText("v3IntelBenchmarkStatus", buildBenchmarkStatus());

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
  syncControlsDisabled([
    ["v3IntelAuditSelect", "intelAuditSelect"],
    ["v3IntelEvidenceTitle", "intelEvidenceTitle"],
    ["v3IntelEvidenceSource", "intelEvidenceSource"],
    ["v3IntelEvidenceCapturedAt", "intelEvidenceCapturedAt"],
    ["v3IntelEvidenceUrl", "intelEvidenceUrl"],
    ["v3IntelEvidenceNotes", "intelEvidenceNotes"]
  ]);

  const evidenceRows = syncEvidenceRowsFromIntel();
  const unresolved = unresolvedAuditCount();
  setText(
    "v3IntelMissingEvidenceCount",
    unresolved > 0
      ? `${unresolved} critical assumption edit(s) missing evidence.`
      : "0 critical assumption edit(s) missing evidence."
  );
  setText(
    "v3IntelMissingNoteCount",
    unresolved > 0
      ? `${unresolved} critical assumption edit(s) missing note.`
      : "0 critical assumption edit(s) missing note."
  );
  setText("v3IntelEvidenceStatus", buildEvidenceStatus(evidenceRows, unresolved));

  syncButtonDisabled("v3BtnIntelEvidenceAttach", "btnIntelEvidenceAttach");
}

function syncEvidenceRowsFromIntel() {
  const tbody = document.getElementById("v3IntelEvidenceTbody");
  if (!(tbody instanceof HTMLTableSectionElement)) {
    return 0;
  }

  const intel = getActiveIntelStateSnapshot();
  const rows = intel ? listIntelEvidence({ intelState: intel }, { limit: 12 }) : [];
  tbody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "muted";
    td.textContent = "No evidence records yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return 0;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    appendCell(tr, row?.title || "—");
    appendCell(tr, row?.source || "—");
    appendCell(tr, formatIsoDate(row?.capturedAt));
    appendCell(tr, row?.ref || "—");
    appendCell(tr, row?.id || "—");
    tbody.appendChild(tr);
  });

  return rows.length;
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
  syncControlsDisabled([
    ["v3IntelBriefKind", "intelBriefKind"],
    ["v3IntelMcDistribution", "intelMcDistribution"],
    ["v3IntelCorrelatedShocks", "intelCorrelatedShocks"],
    ["v3IntelCorrelationMatrixId", "intelCorrelationMatrixId"],
    ["v3IntelCapacityDecayEnabled", "intelCapacityDecayEnabled"],
    ["v3IntelDecayModelType", "intelDecayModelType"],
    ["v3IntelDecayWeeklyPct", "intelDecayWeeklyPct"],
    ["v3IntelDecayFloorPct", "intelDecayFloorPct"],
    ["v3IntelCorrelationJson", "intelCorrelationJson"],
    ["v3IntelShockScenariosEnabled", "intelShockScenariosEnabled"],
    ["v3IntelShockJson", "intelShockJson"],
    ["v3IntelCalibrationBriefContent", "intelCalibrationBriefContent"]
  ]);

  setText("v3IntelCorrelationDisabledHint", buildCorrelationDisabledHint());
  setText("v3IntelDecayStatus", buildDecayStatus());
  setText("v3IntelCorrelationStatus", buildCorrelationStatus());
  setText("v3IntelShockScenarioCount", buildShockScenarioCount());
  setText("v3IntelShockStatus", buildShockStatus());
  setText("v3IntelCalibrationStatus", buildCalibrationStatus());

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
  syncControlsDisabled([
    ["v3IntelWhatIfInput", "intelWhatIfInput"],
    ["v3IntelWhatIfPreview", "intelWhatIfPreview"],
    ["v3IntelRecommendationPreview", "intelRecommendationPreview"]
  ]);

  setText("v3IntelObservedCount", buildObservedCount());
  setText("v3IntelRecommendationCount", buildRecommendationCount());
  setText("v3IntelObservedStatus", buildObservedStatus());
  setText("v3IntelRecommendationStatus", buildRecommendationStatus());
  setText("v3IntelWhatIfCount", buildWhatIfCount());
  setText("v3IntelWhatIfStatus", buildWhatIfStatus());

  syncButtonDisabled("v3BtnIntelCaptureObserved", "btnIntelCaptureObserved");
  syncButtonDisabled("v3BtnIntelGenerateRecommendations", "btnIntelGenerateRecommendations");
  syncButtonDisabled("v3BtnIntelApplyTopRecommendation", "btnIntelApplyTopRecommendation");
  syncButtonDisabled("v3BtnIntelParseWhatIf", "btnIntelParseWhatIf");
}

function syncControlsDisabled(pairs) {
  pairs.forEach(([v3Id, legacyId]) => {
    syncControlDisabled(v3Id, legacyId);
  });
}

function readDomTextById(id) {
  const el = document.getElementById(id);
  return el ? (el.textContent || "").trim() : "";
}

function readInputValueById(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
    return "";
  }
  return String(el.value || "").trim();
}

function isCheckedById(id) {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? Boolean(el.checked) : false;
}

function selectOptionCount(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return 0;
  }
  return Math.max(0, el.options.length);
}

function unresolvedAuditCount() {
  const options = selectOptionCount("v3IntelAuditSelect");
  return Math.max(0, options - 1);
}

function formatRecordCount(count, noun, suffix) {
  const n = Number.isFinite(Number(count)) ? Number(count) : 0;
  const label = n === 1 ? noun : `${noun}s`;
  return `${n} ${label} ${suffix}.`;
}

function buildScenarioLockStatus() {
  const locked = isCheckedById("v3IntelScenarioLocked");
  const reason = readInputValueById("v3IntelScenarioLockReason");
  if (!locked) {
    return "Scenario lock OFF.";
  }
  return reason ? `Scenario lock ON (${reason}).` : "Scenario lock ON.";
}

function buildWorkflowStatus() {
  const requireNote = isCheckedById("v3IntelRequireCriticalNote");
  const requireEvidence = isCheckedById("v3IntelRequireCriticalEvidence");
  const lock = isCheckedById("v3IntelScenarioLocked");
  if (lock || requireNote || requireEvidence) {
    return "Governance controls active.";
  }
  return "Governance controls healthy.";
}

function buildBenchmarkStatus() {
  const ref = readInputValueById("v3IntelBenchmarkRef");
  return ref ? "Benchmark ready to save." : "Select reference and race type, then save benchmark.";
}

function buildEvidenceStatus(evidenceRows, unresolved) {
  const title = readInputValueById("v3IntelEvidenceTitle");
  const source = readInputValueById("v3IntelEvidenceSource");
  if (unresolved === 0) {
    return evidenceRows > 0 ? "All critical edits resolved with evidence." : "No unresolved critical edits.";
  }
  if (title && source) {
    return "Ready to attach evidence.";
  }
  return "Select an audit item, then attach evidence.";
}

function buildCorrelationDisabledHint() {
  const count = Math.max(0, selectOptionCount("v3IntelCorrelationMatrixId") - 1);
  return count > 0 ? "Correlation models available. Select a model to apply." : "No models yet.";
}

function buildDecayStatus() {
  const enabled = isCheckedById("v3IntelCapacityDecayEnabled");
  const weeklyPct = readInputValueById("v3IntelDecayWeeklyPct");
  if (!enabled) {
    return "Capacity decay OFF.";
  }
  return weeklyPct ? `Capacity decay ON at ${weeklyPct}% weekly.` : "Capacity decay ON.";
}

function buildCorrelationStatus() {
  const count = Math.max(0, selectOptionCount("v3IntelCorrelationMatrixId") - 1);
  return count > 0 ? `${count} correlation model(s) configured.` : "No correlation models configured.";
}

function buildShockScenarioCount() {
  const json = readInputValueById("v3IntelShockJson");
  if (!json) {
    return "0 scenarios configured.";
  }
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return `${parsed.length} scenarios configured.`;
    }
    if (parsed && Array.isArray(parsed.scenarios)) {
      return `${parsed.scenarios.length} scenarios configured.`;
    }
  } catch {}
  return "1 scenario payload loaded.";
}

function buildShockStatus() {
  const enabled = isCheckedById("v3IntelShockScenariosEnabled");
  const json = readInputValueById("v3IntelShockJson");
  if (!enabled) {
    return "Shock scenarios disabled.";
  }
  return json ? "Shock scenarios enabled and ready." : "Shock scenarios enabled (no payload loaded).";
}

function buildCalibrationStatus() {
  const brief = readInputValueById("v3IntelCalibrationBriefContent");
  return brief ? "Calibration brief generated." : "No calibration brief generated yet.";
}

function previewLineCount(id) {
  const text = readInputValueById(id);
  if (!text) {
    return 0;
  }
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).length;
}

function buildObservedCount() {
  const lines = previewLineCount("v3IntelRecommendationPreview");
  return lines > 0 ? `${lines} observed metric entries captured.` : "0 observed metric entries captured.";
}

function buildRecommendationCount() {
  const lines = previewLineCount("v3IntelRecommendationPreview");
  return lines > 0 ? `${lines} active drift recommendations.` : "0 active drift recommendations.";
}

function buildObservedStatus() {
  const lines = previewLineCount("v3IntelRecommendationPreview");
  return lines > 0 ? "Observed metrics captured." : "No observed metrics captured yet.";
}

function buildRecommendationStatus() {
  const lines = previewLineCount("v3IntelRecommendationPreview");
  return lines > 0 ? "Drift recommendations ready for review." : "No drift recommendations generated yet.";
}

function buildWhatIfCount() {
  const lines = previewLineCount("v3IntelWhatIfPreview");
  return lines > 0 ? `${lines} what-if request(s) parsed.` : "0 what-if requests parsed.";
}

function buildWhatIfStatus() {
  const lines = previewLineCount("v3IntelWhatIfPreview");
  return lines > 0 ? "What-if request parsed." : "No what-if requests parsed yet.";
}

function getActiveIntelStateSnapshot() {
  const api = window?.[SCENARIO_API_KEY];
  if (!api || typeof api.getView !== "function") {
    return null;
  }
  const view = api.getView();
  const activeIntel = view?.active?.inputs?.intelState;
  if (activeIntel && typeof activeIntel === "object") {
    return activeIntel;
  }
  const baselineIntel = view?.baseline?.inputs?.intelState;
  if (baselineIntel && typeof baselineIntel === "object") {
    return baselineIntel;
  }
  return null;
}

function formatIsoDate(iso) {
  const text = String(iso || "").trim();
  return text ? text.slice(0, 10) : "—";
}

function appendCell(row, value) {
  const td = document.createElement("td");
  td.textContent = String(value ?? "—");
  row.appendChild(td);
}
