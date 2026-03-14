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
  syncSelectValue
} from "../surfaceUtils.js";
import {
  benchmarkRefLabel,
  listIntelBenchmarks,
  listIntelEvidence,
  listMissingEvidenceAudit,
  listMissingNoteAudit
} from "../../intelControlsRuntime.js";

const SCENARIO_API_KEY = "__FPE_SCENARIO_API__";
const BENCHMARK_REF_OPTIONS = [
  "core.universeSize",
  "core.persuasionUniversePct",
  "core.supportRatePct",
  "core.contactRatePct",
  "core.turnoutCycleA",
  "core.turnoutCycleB",
  "core.turnoutBandWidth",
  "core.turnoutBaselinePct",
  "core.gotvLiftPP",
  "core.gotvLiftCeilingPP",
  "core.orgCount",
  "core.orgHoursPerWeek",
  "core.volunteerMultiplier",
  "core.channelDoorPct",
  "core.doorsPerHour",
  "core.callsPerHour"
];
const BENCHMARK_RACE_TYPE_OPTIONS = ["all", "federal", "state_leg", "municipal", "county"];
let benchmarkActionStatus = "";
let evidenceActionStatus = "";

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

  if (!hasWorkflowScenarioApi()) {
    bindCheckboxProxy("v3IntelScenarioLocked", "intelScenarioLocked");
    bindCheckboxProxy("v3IntelRequireCriticalNote", "intelRequireCriticalNote");
    bindCheckboxProxy("v3IntelRequireCriticalEvidence", "intelRequireCriticalEvidence");
    bindFieldProxy("v3IntelScenarioLockReason", "intelScenarioLockReason");
    bindFieldProxy("v3IntelCriticalChangeNote", "intelCriticalChangeNote");
    return;
  }

  const lockEl = document.getElementById("v3IntelScenarioLocked");
  if (lockEl instanceof HTMLInputElement) {
    lockEl.addEventListener("change", () => {
      updateWorkflowViaScenarioApi({ scenarioLocked: !!lockEl.checked });
    });
  }

  const requireNoteEl = document.getElementById("v3IntelRequireCriticalNote");
  if (requireNoteEl instanceof HTMLInputElement) {
    requireNoteEl.addEventListener("change", () => {
      updateWorkflowViaScenarioApi({ requireCriticalNote: !!requireNoteEl.checked });
    });
  }

  const requireEvidenceEl = document.getElementById("v3IntelRequireCriticalEvidence");
  if (requireEvidenceEl instanceof HTMLInputElement) {
    requireEvidenceEl.addEventListener("change", () => {
      updateWorkflowViaScenarioApi({ requireCriticalEvidence: !!requireEvidenceEl.checked });
    });
  }

  const lockReasonEl = document.getElementById("v3IntelScenarioLockReason");
  if (lockReasonEl instanceof HTMLInputElement) {
    const push = () => {
      updateWorkflowViaScenarioApi({ lockReason: String(lockReasonEl.value || "").trim() });
    };
    lockReasonEl.addEventListener("change", push);
    lockReasonEl.addEventListener("blur", push);
  }

  const criticalNoteEl = document.getElementById("v3IntelCriticalChangeNote");
  if (criticalNoteEl instanceof HTMLTextAreaElement) {
    const push = () => {
      updatePendingNoteViaScenarioApi(String(criticalNoteEl.value || ""));
    };
    criticalNoteEl.addEventListener("change", push);
    criticalNoteEl.addEventListener("blur", push);
  }
}

function syncControlsWorkflowBridge() {
  if (!hasWorkflowScenarioApi()) {
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
  } else {
    const inputs = getActiveScenarioInputsSnapshot();
    const workflow = (inputs?.intelState && typeof inputs.intelState === "object" && inputs.intelState.workflow && typeof inputs.intelState.workflow === "object")
      ? inputs.intelState.workflow
      : {};
    const pendingCriticalNote = String(inputs?.ui?.pendingCriticalNote || "");

    const lockEl = document.getElementById("v3IntelScenarioLocked");
    if (lockEl instanceof HTMLInputElement && document.activeElement !== lockEl) {
      lockEl.checked = !!workflow.scenarioLocked;
    }

    const requireNoteEl = document.getElementById("v3IntelRequireCriticalNote");
    if (requireNoteEl instanceof HTMLInputElement && document.activeElement !== requireNoteEl) {
      requireNoteEl.checked = workflow.requireCriticalNote !== false;
    }

    const requireEvidenceEl = document.getElementById("v3IntelRequireCriticalEvidence");
    if (requireEvidenceEl instanceof HTMLInputElement && document.activeElement !== requireEvidenceEl) {
      requireEvidenceEl.checked = workflow.requireCriticalEvidence !== false;
    }

    const reasonEl = document.getElementById("v3IntelScenarioLockReason");
    if (reasonEl instanceof HTMLInputElement && document.activeElement !== reasonEl) {
      reasonEl.value = String(workflow.lockReason || "");
    }

    const noteEl = document.getElementById("v3IntelCriticalChangeNote");
    if (noteEl instanceof HTMLTextAreaElement && document.activeElement !== noteEl) {
      noteEl.value = pendingCriticalNote;
    }
  }

  setText("v3IntelScenarioLockStatus", buildScenarioLockStatus());
  setText("v3IntelWorkflowStatus", buildWorkflowStatus());
}

function wireControlsBenchmarkBridge() {
  const root = document.getElementById("v3ControlsBenchmarkBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  if (!hasBenchmarkScenarioApi()) {
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
  } else {
    const loadDefaultsBtn = document.getElementById("v3BtnIntelBenchmarkLoadDefaults");
    if (loadDefaultsBtn instanceof HTMLButtonElement) {
      loadDefaultsBtn.addEventListener("click", () => {
        const raceType = readInputValueById("v3IntelBenchmarkRaceType") || "all";
        const result = loadDefaultBenchmarksViaScenarioApi(raceType);
        if (result?.ok) {
          benchmarkActionStatus = `Loaded defaults for ${result.raceType || raceType}. Created ${Number(result.created || 0)}, updated ${Number(result.updated || 0)}.`;
        } else {
          benchmarkActionStatus = String(result?.error || "Failed to load default benchmarks.");
        }
      });
    }

    const saveBtn = document.getElementById("v3BtnIntelBenchmarkSave");
    if (saveBtn instanceof HTMLButtonElement) {
      saveBtn.addEventListener("click", () => {
        const payload = {
          ref: readInputValueById("v3IntelBenchmarkRef"),
          raceType: readInputValueById("v3IntelBenchmarkRaceType") || "all",
          defaultValue: parseOptionalNumber(readInputValueById("v3IntelBenchmarkDefault")),
          min: parseOptionalNumber(readInputValueById("v3IntelBenchmarkMin")),
          max: parseOptionalNumber(readInputValueById("v3IntelBenchmarkMax")),
          warnAbove: parseOptionalNumber(readInputValueById("v3IntelBenchmarkWarnAbove")),
          hardAbove: parseOptionalNumber(readInputValueById("v3IntelBenchmarkHardAbove")),
          sourceTitle: readInputValueById("v3IntelBenchmarkSourceTitle"),
          sourceNotes: readInputValueById("v3IntelBenchmarkSourceNotes")
        };
        const result = saveBenchmarkViaScenarioApi(payload);
        if (result?.ok) {
          benchmarkActionStatus = result.mode === "created"
            ? "Benchmark created."
            : "Benchmark updated.";
        } else {
          benchmarkActionStatus = String(result?.error || "Benchmark save failed.");
        }
      });
    }
  }

  const v3BenchmarkTbody = document.getElementById("v3IntelBenchmarkTbody");
  if (v3BenchmarkTbody) {
    v3BenchmarkTbody.addEventListener("click", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLElement)) return;
      const removeBtn = target.closest("[data-bm-remove]");
      if (!(removeBtn instanceof HTMLElement)) return;
      const removeId = String(removeBtn.getAttribute("data-bm-remove") || "").trim();
      if (!removeId) return;

      if (hasBenchmarkScenarioApi()) {
        const result = removeBenchmarkViaScenarioApi(removeId);
        benchmarkActionStatus = result?.ok
          ? "Benchmark removed."
          : String(result?.error || "Failed to remove benchmark.");
        return;
      }

      const legacyButtons = Array.from(document.querySelectorAll("#app-shell-legacy [data-bm-remove]"));
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
  if (!hasBenchmarkScenarioApi()) {
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
  } else {
    ensureBenchmarkSelectOptions();
  }
  const benchmarkRows = syncBenchmarkRowsFromIntel();
  setText("v3IntelBenchmarkCount", formatRecordCount(benchmarkRows, "benchmark entry", "configured"));
  setText("v3IntelBenchmarkStatus", benchmarkActionStatus || buildBenchmarkStatus());

  if (!hasBenchmarkScenarioApi()) {
    syncButtonDisabled("v3BtnIntelBenchmarkLoadDefaults", "btnIntelBenchmarkLoadDefaults");
    syncButtonDisabled("v3BtnIntelBenchmarkSave", "btnIntelBenchmarkSave");
  } else {
    const loadDefaultsBtn = document.getElementById("v3BtnIntelBenchmarkLoadDefaults");
    if (loadDefaultsBtn instanceof HTMLButtonElement) loadDefaultsBtn.disabled = false;
    const saveBtn = document.getElementById("v3BtnIntelBenchmarkSave");
    if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = false;
  }
}

function syncBenchmarkRowsFromIntel() {
  const tbody = document.getElementById("v3IntelBenchmarkTbody");
  if (!(tbody instanceof HTMLTableSectionElement)) {
    return 0;
  }

  const intel = getActiveIntelStateSnapshot();
  const rows = intel
    ? listIntelBenchmarks({ intelState: intel }).slice().sort((a, b) => {
        const ar = String(a?.ref || "");
        const br = String(b?.ref || "");
        return ar.localeCompare(br);
      })
    : [];
  tbody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "muted";
    td.textContent = "No benchmark entries configured.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return 0;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const range = `${fmtNum(row?.range?.min)} .. ${fmtNum(row?.range?.max)}`;
    const severity = `${fmtNum(row?.severityBands?.warnAbove)} / ${fmtNum(row?.severityBands?.hardAbove)}`;
    const source = row?.source?.title || row?.source?.type || "—";
    const removeId = String(row?.id || "");

    appendCell(tr, benchmarkRefLabel(row?.ref), { subtext: row?.ref || "—" });
    appendCell(tr, row?.raceType || "all");
    appendCell(tr, range, { numeric: true });
    appendCell(tr, severity, { numeric: true });
    appendCell(tr, source);
    appendCell(tr, "—", { numeric: true, actionId: removeId });
    tbody.appendChild(tr);
  });

  return rows.length;
}

function wireControlsEvidenceBridge() {
  const root = document.getElementById("v3ControlsEvidenceBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  if (!hasEvidenceScenarioApi()) {
    bindSelectProxy("v3IntelAuditSelect", "intelAuditSelect");
    bindFieldProxy("v3IntelEvidenceTitle", "intelEvidenceTitle");
    bindFieldProxy("v3IntelEvidenceSource", "intelEvidenceSource");
    bindFieldProxy("v3IntelEvidenceCapturedAt", "intelEvidenceCapturedAt");
    bindFieldProxy("v3IntelEvidenceUrl", "intelEvidenceUrl");
    bindFieldProxy("v3IntelEvidenceNotes", "intelEvidenceNotes");

    bindClickProxy("v3BtnIntelEvidenceAttach", "btnIntelEvidenceAttach");
    return;
  }

  const attachBtn = document.getElementById("v3BtnIntelEvidenceAttach");
  if (attachBtn instanceof HTMLButtonElement) {
    attachBtn.addEventListener("click", () => {
      const missingRows = listMissingEvidenceRowsFromIntel();
      const selectedAuditId = readInputValueById("v3IntelAuditSelect");
      const selectedAudit = missingRows.find((row) => String(row?.id || "").trim() === selectedAuditId) || null;
      const draftNote = readInputValueById("v3IntelEvidenceNotes");
      if (missingRows.length > 0 && !selectedAuditId) {
        evidenceActionStatus = "Select a missing evidence audit item before attaching evidence.";
        return;
      }
      if (selectedAudit && selectedAudit.requiresNote === true && !String(selectedAudit.note || "").trim() && !draftNote) {
        evidenceActionStatus = "This audit item also requires a note. Add a short note before attaching evidence.";
        return;
      }
      const payload = {
        auditId: selectedAuditId,
        title: readInputValueById("v3IntelEvidenceTitle"),
        source: readInputValueById("v3IntelEvidenceSource"),
        capturedAt: readInputValueById("v3IntelEvidenceCapturedAt"),
        url: readInputValueById("v3IntelEvidenceUrl"),
        notes: draftNote
      };
      const result = attachEvidenceViaScenarioApi(payload);
      if (result?.ok) {
        evidenceActionStatus = result.resolvedAuditId
          ? "Evidence attached and audit item resolved."
          : "Evidence attached.";
        clearEvidenceDraftInputs();
      } else {
        evidenceActionStatus = String(result?.error || "Evidence attach failed.");
      }
    });
  }
}

function syncControlsEvidenceBridge() {
  if (!hasEvidenceScenarioApi()) {
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
  } else {
    syncEvidenceAuditSelectFromIntel();
    const capturedEl = document.getElementById("v3IntelEvidenceCapturedAt");
    if (capturedEl instanceof HTMLInputElement && !capturedEl.value) {
      capturedEl.value = new Date().toISOString().slice(0, 10);
    }
  }

  const evidenceRows = syncEvidenceRowsFromIntel();
  const unresolved = missingEvidenceCountFromIntel();
  const missingNotes = missingNoteCountFromIntel();
  setText(
    "v3IntelMissingEvidenceCount",
    unresolved > 0
      ? `${unresolved} critical assumption edit(s) missing evidence.`
      : "0 critical assumption edit(s) missing evidence."
  );
  setText(
    "v3IntelMissingNoteCount",
    missingNotes > 0
      ? `${missingNotes} critical assumption edit(s) missing note.`
      : "0 critical assumption edit(s) missing note."
  );
  setText("v3IntelEvidenceStatus", evidenceActionStatus || buildEvidenceStatus(evidenceRows, unresolved));

  if (!hasEvidenceScenarioApi()) {
    syncButtonDisabled("v3BtnIntelEvidenceAttach", "btnIntelEvidenceAttach");
  } else {
    const attachBtn = document.getElementById("v3BtnIntelEvidenceAttach");
    if (attachBtn instanceof HTMLButtonElement) attachBtn.disabled = false;
  }
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
  setTextareaValue("v3IntelWhatIfPreview", buildWhatIfPreviewFromIntel());
  setTextareaValue("v3IntelRecommendationPreview", buildRecommendationPreviewFromIntel());
  syncControlsDisabled([
    ["v3IntelWhatIfInput", "intelWhatIfInput"]
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

function getScenarioBridgeApi() {
  const api = window?.[SCENARIO_API_KEY];
  return api && typeof api === "object" ? api : null;
}

function hasWorkflowScenarioApi() {
  const api = getScenarioBridgeApi();
  return !!api
    && typeof api.getView === "function"
    && typeof api.updateIntelWorkflow === "function"
    && typeof api.setPendingCriticalNote === "function";
}

function hasBenchmarkScenarioApi() {
  const api = getScenarioBridgeApi();
  return !!api
    && typeof api.getView === "function"
    && typeof api.saveBenchmark === "function"
    && typeof api.loadDefaultBenchmarks === "function"
    && typeof api.removeBenchmark === "function";
}

function hasEvidenceScenarioApi() {
  const api = getScenarioBridgeApi();
  return !!api
    && typeof api.getView === "function"
    && typeof api.attachEvidence === "function";
}

function getActiveScenarioInputsSnapshot() {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.getView !== "function") {
    return null;
  }
  const view = api.getView();
  const activeInputs = view?.active?.inputs;
  if (activeInputs && typeof activeInputs === "object") {
    return activeInputs;
  }
  const baselineInputs = view?.baseline?.inputs;
  if (baselineInputs && typeof baselineInputs === "object") {
    return baselineInputs;
  }
  return null;
}

function updateWorkflowViaScenarioApi(patch) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.updateIntelWorkflow !== "function") {
    return false;
  }
  try {
    api.updateIntelWorkflow(patch || {});
    return true;
  } catch {
    return false;
  }
}

function updatePendingNoteViaScenarioApi(note) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.setPendingCriticalNote !== "function") {
    return false;
  }
  try {
    api.setPendingCriticalNote(String(note || ""));
    return true;
  } catch {
    return false;
  }
}

function saveBenchmarkViaScenarioApi(payload) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.saveBenchmark !== "function") {
    return { ok: false, error: "Benchmark API unavailable." };
  }
  try {
    const result = api.saveBenchmark(payload || {});
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Benchmark save failed." };
  } catch {
    return { ok: false, error: "Benchmark save failed." };
  }
}

function loadDefaultBenchmarksViaScenarioApi(raceType) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.loadDefaultBenchmarks !== "function") {
    return { ok: false, error: "Benchmark defaults API unavailable." };
  }
  try {
    const result = api.loadDefaultBenchmarks(String(raceType || "all"));
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to load benchmark defaults." };
  } catch {
    return { ok: false, error: "Failed to load benchmark defaults." };
  }
}

function removeBenchmarkViaScenarioApi(benchmarkId) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.removeBenchmark !== "function") {
    return { ok: false, error: "Benchmark remove API unavailable." };
  }
  try {
    const result = api.removeBenchmark(String(benchmarkId || ""));
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to remove benchmark." };
  } catch {
    return { ok: false, error: "Failed to remove benchmark." };
  }
}

function attachEvidenceViaScenarioApi(payload) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.attachEvidence !== "function") {
    return { ok: false, error: "Evidence API unavailable." };
  }
  try {
    const result = api.attachEvidence(payload || {});
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Evidence attach failed." };
  } catch {
    return { ok: false, error: "Evidence attach failed." };
  }
}

function ensureBenchmarkSelectOptions() {
  const refSelect = document.getElementById("v3IntelBenchmarkRef");
  if (refSelect instanceof HTMLSelectElement && refSelect.options.length === 0) {
    BENCHMARK_REF_OPTIONS.forEach((ref) => {
      const opt = document.createElement("option");
      opt.value = ref;
      opt.textContent = benchmarkRefLabel(ref);
      refSelect.appendChild(opt);
    });
  }

  const raceTypeSelect = document.getElementById("v3IntelBenchmarkRaceType");
  if (raceTypeSelect instanceof HTMLSelectElement && raceTypeSelect.options.length === 0) {
    BENCHMARK_RACE_TYPE_OPTIONS.forEach((raceType) => {
      const opt = document.createElement("option");
      opt.value = raceType;
      opt.textContent = raceType === "state_leg" ? "state legislative" : raceType;
      raceTypeSelect.appendChild(opt);
    });
  }
}

function parseOptionalNumber(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function clearEvidenceDraftInputs() {
  const titleEl = document.getElementById("v3IntelEvidenceTitle");
  if (titleEl instanceof HTMLInputElement) titleEl.value = "";
  const sourceEl = document.getElementById("v3IntelEvidenceSource");
  if (sourceEl instanceof HTMLInputElement) sourceEl.value = "";
  const urlEl = document.getElementById("v3IntelEvidenceUrl");
  if (urlEl instanceof HTMLInputElement) urlEl.value = "";
  const notesEl = document.getElementById("v3IntelEvidenceNotes");
  if (notesEl instanceof HTMLTextAreaElement) notesEl.value = "";
}

function syncEvidenceAuditSelectFromIntel() {
  const selectEl = document.getElementById("v3IntelAuditSelect");
  if (!(selectEl instanceof HTMLSelectElement)) {
    return 0;
  }
  const rows = listMissingEvidenceRowsFromIntel();
  const previous = selectEl.value;
  selectEl.innerHTML = "";
  if (!rows.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No missing evidence items";
    selectEl.appendChild(opt);
    selectEl.disabled = true;
    return 0;
  }

  selectEl.disabled = false;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select missing evidence item…";
  selectEl.appendChild(placeholder);

  rows.forEach((row) => {
    const opt = document.createElement("option");
    const ts = formatIsoDate(row?.ts || row?.updatedAt || row?.createdAt || "");
    const ref = String(row?.label || row?.ref || row?.key || "critical assumption").trim();
    opt.value = String(row?.id || "");
    opt.textContent = `${ts} · ${ref}`;
    selectEl.appendChild(opt);
  });

  const hasPrevious = rows.some((row) => String(row?.id || "") === previous);
  if (hasPrevious) {
    selectEl.value = previous;
  } else {
    const firstId = String(rows[0]?.id || "");
    selectEl.value = firstId;
  }
  return rows.length;
}

function listMissingEvidenceRowsFromIntel() {
  const scenarioState = getActiveScenarioStateSnapshot();
  if (!scenarioState) return [];
  return listMissingEvidenceAudit(scenarioState, { limit: 200 });
}

function missingEvidenceCountFromIntel() {
  return listMissingEvidenceRowsFromIntel().length;
}

function missingNoteCountFromIntel() {
  const scenarioState = getActiveScenarioStateSnapshot();
  if (!scenarioState) return 0;
  return listMissingNoteAudit(scenarioState, { limit: 200 }).length;
}

function getActiveScenarioStateSnapshot() {
  const inputs = getActiveScenarioInputsSnapshot();
  if (!inputs || typeof inputs !== "object") {
    return null;
  }
  return inputs;
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
  const intel = getActiveIntelStateSnapshot();
  if (!intel || typeof intel !== "object") {
    return 0;
  }
  const whatIfRows = Array.isArray(intel.intelRequests) ? intel.intelRequests.length : 0;
  const recommendationRows = Array.isArray(intel.recommendations) ? intel.recommendations.length : 0;
  const observedRows = Array.isArray(intel.observedMetrics) ? intel.observedMetrics.length : 0;
  if (id === "v3IntelObserved") {
    return observedRows;
  }
  if (id === "v3IntelWhatIfPreview") {
    return whatIfRows;
  }
  if (id === "v3IntelRecommendationPreview") {
    return recommendationRows;
  }
  return 0;
}

function buildObservedCount() {
  const lines = previewLineCount("v3IntelObserved");
  return lines > 0 ? `${lines} observed metric entries captured.` : "0 observed metric entries captured.";
}

function buildRecommendationCount() {
  const lines = previewLineCount("v3IntelRecommendationPreview");
  return lines > 0 ? `${lines} active drift recommendations.` : "0 active drift recommendations.";
}

function buildObservedStatus() {
  const lines = previewLineCount("v3IntelObserved");
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

function buildWhatIfPreviewFromIntel() {
  const intel = getActiveIntelStateSnapshot();
  const rows = Array.isArray(intel?.intelRequests) ? intel.intelRequests.slice() : [];
  if (!rows.length) {
    return "";
  }
  rows.sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
  const latest = rows[0] || {};
  const summary = String(latest?.summary || "").trim();
  const prompt = String(latest?.prompt || "").trim();
  const status = String(latest?.status || "").trim() || "parsed";
  const lines = [];
  lines.push(`Status: ${status}`);
  if (summary) lines.push(`Summary: ${summary}`);
  if (prompt) lines.push(`Prompt: ${prompt}`);
  return lines.join("\n");
}

function buildRecommendationPreviewFromIntel() {
  const intel = getActiveIntelStateSnapshot();
  const rows = Array.isArray(intel?.recommendations) ? intel.recommendations.slice() : [];
  if (!rows.length) {
    return "";
  }
  rows.sort((a, b) => Number(a?.priority ?? 999) - Number(b?.priority ?? 999));
  return rows
    .slice(0, 8)
    .map((row, idx) => {
      const priority = Number.isFinite(Number(row?.priority)) ? `P${Number(row.priority)}` : "P?";
      const title = String(row?.title || `Recommendation ${idx + 1}`).trim();
      const detail = String(row?.detail || "").trim();
      return detail ? `[${priority}] ${title}: ${detail}` : `[${priority}] ${title}`;
    })
    .join("\n");
}

function getActiveIntelStateSnapshot() {
  const inputs = getActiveScenarioInputsSnapshot();
  if (!inputs || typeof inputs !== "object") {
    return null;
  }
  const intel = inputs.intelState;
  return intel && typeof intel === "object" ? intel : null;
}

function formatIsoDate(iso) {
  const text = String(iso || "").trim();
  return text ? text.slice(0, 10) : "—";
}

function appendCell(row, value, options = null) {
  const td = document.createElement("td");
  if (options?.numeric) {
    td.classList.add("num");
  }
  if (options?.actionId) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fpe-btn fpe-btn--ghost";
    btn.textContent = "Remove";
    btn.setAttribute("data-bm-remove", String(options.actionId));
    td.appendChild(btn);
    row.appendChild(td);
    return;
  }
  const main = document.createElement("div");
  main.textContent = String(value ?? "—");
  td.appendChild(main);
  if (options?.subtext) {
    const sub = document.createElement("div");
    sub.className = "muted";
    sub.style.fontSize = "11px";
    sub.textContent = String(options.subtext);
    td.appendChild(sub);
  }
  row.appendChild(td);
}

function fmtNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "—";
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function setTextareaValue(id, value) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLTextAreaElement)) {
    return;
  }
  if (document.activeElement === el) {
    return;
  }
  el.value = String(value || "");
}
