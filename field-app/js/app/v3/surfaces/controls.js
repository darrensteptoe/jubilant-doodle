import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  setText,
} from "../surfaceUtils.js";
import {
  benchmarkRefLabel,
  intelBriefKindLabel,
  listIntelBenchmarks,
  listIntelBriefKinds,
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
const MC_DISTRIBUTION_OPTIONS = [
  { value: "triangular", label: "Triangular" },
  { value: "uniform", label: "Uniform" },
  { value: "normal", label: "Normal" }
];
const DECAY_MODEL_OPTIONS = [
  { value: "linear", label: "Linear" }
];
let benchmarkActionStatus = "";
let evidenceActionStatus = "";
let calibrationActionStatus = "";
let shockActionStatus = "";
let observedActionStatus = "";
let recommendationActionStatus = "";
let whatIfActionStatus = "";

export function renderControlsSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const governanceCol = createColumn("governance");
  const benchmarkCol = createColumn("benchmark");
  const calibrationCol = createColumn("calibration");

  const workflowCard = createCard({
    title: "Guardrails",
    description: "Scenario lock and critical-change documentation requirements.",
    status: "Healthy"
  });

  const evidenceCard = createCard({
    title: "Evidence workflow",
    description: "Attach references to missing audit items before decisions are logged.",
    status: "Awaiting audit"
  });

  const benchmarkCard = createCard({
    title: "Benchmark catalog",
    description: "Empirical ranges for critical assumptions, used for warnings only.",
    status: "Catalog empty"
  });

  const feedbackCard = createCard({
    title: "Review workflow",
    description: "Capture observed metrics and generate metadata-only drift recommendations.",
    status: "Awaiting feedback"
  });

  const calibrationCard = createCard({
    title: "Integrity summary",
    description: "Calibration narrative, expert toggles, and stochastic model controls.",
    status: "Needs brief"
  });

  const summaryCard = createCard({
    title: "Current warnings",
    description: "Live governance warning posture across evidence, calibration, and recommendation workflows.",
    status: "Watchlist"
  });

  assignCardStatusId(workflowCard, "v3ControlsWorkflowCardStatus");
  assignCardStatusId(evidenceCard, "v3ControlsEvidenceCardStatus");
  assignCardStatusId(benchmarkCard, "v3ControlsBenchmarkCardStatus");
  assignCardStatusId(feedbackCard, "v3ControlsReviewCardStatus");
  assignCardStatusId(calibrationCard, "v3ControlsIntegrityCardStatus");
  assignCardStatusId(summaryCard, "v3ControlsWarningsCardStatus");

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

  syncControlsCardStatus(
    "v3ControlsWorkflowCardStatus",
    deriveControlsWorkflowCardStatus(
      readDomTextById("v3IntelScenarioLockStatus"),
      readDomTextById("v3IntelWorkflowStatus")
    )
  );
  syncControlsCardStatus(
    "v3ControlsEvidenceCardStatus",
    deriveControlsEvidenceCardStatus(
      readDomTextById("v3IntelMissingEvidenceCount"),
      readDomTextById("v3IntelMissingNoteCount"),
      readDomTextById("v3IntelEvidenceStatus")
    )
  );
  syncControlsCardStatus(
    "v3ControlsBenchmarkCardStatus",
    deriveControlsBenchmarkCardStatus(
      readDomTextById("v3IntelBenchmarkCount"),
      readDomTextById("v3IntelBenchmarkStatus")
    )
  );
  syncControlsCardStatus(
    "v3ControlsReviewCardStatus",
    deriveControlsReviewCardStatus(
      readDomTextById("v3IntelObservedCount"),
      readDomTextById("v3IntelRecommendationCount"),
      readDomTextById("v3IntelRecommendationStatus"),
      readDomTextById("v3IntelWhatIfCount")
    )
  );
  syncControlsCardStatus(
    "v3ControlsIntegrityCardStatus",
    deriveControlsIntegrityCardStatus(
      readDomTextById("v3IntelCalibrationStatus"),
      readDomTextById("v3IntelCorrelationStatus"),
      readDomTextById("v3IntelShockStatus"),
      readDomTextById("v3IntelDecayStatus")
    )
  );
  syncControlsCardStatus(
    "v3ControlsWarningsCardStatus",
    deriveControlsWarningsCardStatus(
      readDomTextById("v3IntelMissingEvidenceCount"),
      readDomTextById("v3IntelMissingNoteCount"),
      readDomTextById("v3IntelRecommendationCount"),
      readDomTextById("v3IntelWorkflowStatus")
    )
  );
}

function wireControlsWorkflowBridge() {
  const root = document.getElementById("v3ControlsWorkflowBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  if (!hasWorkflowScenarioApi()) {
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
  const hasApi = hasWorkflowScenarioApi();
  const lockEl = document.getElementById("v3IntelScenarioLocked");
  const requireNoteEl = document.getElementById("v3IntelRequireCriticalNote");
  const requireEvidenceEl = document.getElementById("v3IntelRequireCriticalEvidence");
  const reasonEl = document.getElementById("v3IntelScenarioLockReason");
  const noteEl = document.getElementById("v3IntelCriticalChangeNote");

  if (lockEl instanceof HTMLInputElement) lockEl.disabled = !hasApi;
  if (requireNoteEl instanceof HTMLInputElement) requireNoteEl.disabled = !hasApi;
  if (requireEvidenceEl instanceof HTMLInputElement) requireEvidenceEl.disabled = !hasApi;
  if (reasonEl instanceof HTMLInputElement) reasonEl.disabled = !hasApi;
  if (noteEl instanceof HTMLTextAreaElement) noteEl.disabled = !hasApi;

  if (!hasApi) {
    setText("v3IntelScenarioLockStatus", "Scenario bridge unavailable.");
    setText("v3IntelWorkflowStatus", "Scenario bridge unavailable.");
    return;
  }

  const inputs = getActiveScenarioInputsSnapshot();
  const workflow = (inputs?.intelState && typeof inputs.intelState === "object" && inputs.intelState.workflow && typeof inputs.intelState.workflow === "object")
    ? inputs.intelState.workflow
    : {};
  const pendingCriticalNote = String(inputs?.ui?.pendingCriticalNote || "");

  if (lockEl instanceof HTMLInputElement && document.activeElement !== lockEl) {
    lockEl.checked = !!workflow.scenarioLocked;
  }

  if (requireNoteEl instanceof HTMLInputElement && document.activeElement !== requireNoteEl) {
    requireNoteEl.checked = workflow.requireCriticalNote !== false;
  }

  if (requireEvidenceEl instanceof HTMLInputElement && document.activeElement !== requireEvidenceEl) {
    requireEvidenceEl.checked = workflow.requireCriticalEvidence !== false;
  }

  if (reasonEl instanceof HTMLInputElement && document.activeElement !== reasonEl) {
    reasonEl.value = String(workflow.lockReason || "");
  }

  if (noteEl instanceof HTMLTextAreaElement && document.activeElement !== noteEl) {
    noteEl.value = pendingCriticalNote;
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
    return;
  }

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

  const v3BenchmarkTbody = document.getElementById("v3IntelBenchmarkTbody");
  if (v3BenchmarkTbody) {
    v3BenchmarkTbody.addEventListener("click", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLElement)) return;
      const removeBtn = target.closest("[data-bm-remove]");
      if (!(removeBtn instanceof HTMLElement)) return;
      const removeId = String(removeBtn.getAttribute("data-bm-remove") || "").trim();
      if (!removeId) return;

      if (!hasBenchmarkScenarioApi()) {
        benchmarkActionStatus = "Scenario bridge unavailable.";
        return;
      }

      const result = removeBenchmarkViaScenarioApi(removeId);
      benchmarkActionStatus = result?.ok
        ? "Benchmark removed."
        : String(result?.error || "Failed to remove benchmark.");
    });
  }
}

function syncControlsBenchmarkBridge() {
  const hasApi = hasBenchmarkScenarioApi();
  const controlIds = [
    "v3IntelBenchmarkRef",
    "v3IntelBenchmarkRaceType",
    "v3IntelBenchmarkDefault",
    "v3IntelBenchmarkMin",
    "v3IntelBenchmarkMax",
    "v3IntelBenchmarkWarnAbove",
    "v3IntelBenchmarkHardAbove",
    "v3IntelBenchmarkSourceTitle",
    "v3IntelBenchmarkSourceNotes",
    "v3BtnIntelBenchmarkLoadDefaults",
    "v3BtnIntelBenchmarkSave"
  ];
  controlIds.forEach((id) => {
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLButtonElement
    ) {
      el.disabled = !hasApi;
    }
  });

  if (!hasApi) {
    setText("v3IntelBenchmarkCount", "0 benchmark entries configured.");
    setText("v3IntelBenchmarkStatus", "Scenario bridge unavailable.");
    const tbody = document.getElementById("v3IntelBenchmarkTbody");
    if (tbody instanceof HTMLTableSectionElement) {
      tbody.innerHTML = `<tr><td class="muted" colspan="6">Scenario bridge unavailable.</td></tr>`;
    }
    return;
  }

  ensureBenchmarkSelectOptions();
  const benchmarkRows = syncBenchmarkRowsFromIntel();
  setText("v3IntelBenchmarkCount", formatRecordCount(benchmarkRows, "benchmark entry", "configured"));
  setText("v3IntelBenchmarkStatus", benchmarkActionStatus || buildBenchmarkStatus());
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
  const hasApi = hasEvidenceScenarioApi();
  [
    "v3IntelAuditSelect",
    "v3IntelEvidenceTitle",
    "v3IntelEvidenceSource",
    "v3IntelEvidenceCapturedAt",
    "v3IntelEvidenceUrl",
    "v3IntelEvidenceNotes",
    "v3BtnIntelEvidenceAttach"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLButtonElement
    ) {
      el.disabled = !hasApi;
    }
  });

  if (!hasApi) {
    setText("v3IntelMissingEvidenceCount", "0 critical assumption edit(s) missing evidence.");
    setText("v3IntelMissingNoteCount", "0 critical assumption edit(s) missing note.");
    setText("v3IntelEvidenceStatus", "Scenario bridge unavailable.");
    const tbody = document.getElementById("v3IntelEvidenceTbody");
    if (tbody instanceof HTMLTableSectionElement) {
      tbody.innerHTML = `<tr><td class="muted" colspan="5">Scenario bridge unavailable.</td></tr>`;
    }
    return;
  }

  syncEvidenceAuditSelectFromIntel();
  const capturedEl = document.getElementById("v3IntelEvidenceCapturedAt");
  if (capturedEl instanceof HTMLInputElement && !capturedEl.value) {
    capturedEl.value = new Date().toISOString().slice(0, 10);
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

  if (!hasCalibrationScenarioApi()) {
    return;
  }

  const applySimPatch = (patch) => {
    return updateSimTogglesViaScenarioApi(patch || {});
  };
  const applyExpertPatch = (patch) => {
    return updateExpertTogglesViaScenarioApi(patch || {});
  };

  const briefKindEl = document.getElementById("v3IntelBriefKind");
  if (briefKindEl instanceof HTMLSelectElement) {
    briefKindEl.addEventListener("change", () => {
      const kind = selectedBriefKind();
      const content = latestBriefContentForKind(kind) || latestBriefContentForKind("calibrationSources");
      setTextareaValue("v3IntelCalibrationBriefContent", content);
    });
  }

  const mcDistributionEl = document.getElementById("v3IntelMcDistribution");
  if (mcDistributionEl instanceof HTMLSelectElement) {
    mcDistributionEl.addEventListener("change", () => {
      applySimPatch({ mcDistribution: String(mcDistributionEl.value || "triangular") });
    });
  }

  const correlatedEl = document.getElementById("v3IntelCorrelatedShocks");
  if (correlatedEl instanceof HTMLInputElement) {
    correlatedEl.addEventListener("change", () => {
      applySimPatch({ correlatedShocks: !!correlatedEl.checked });
    });
  }

  const correlationIdEl = document.getElementById("v3IntelCorrelationMatrixId");
  if (correlationIdEl instanceof HTMLSelectElement) {
    correlationIdEl.addEventListener("change", () => {
      const raw = String(correlationIdEl.value || "").trim();
      applySimPatch({ correlationMatrixId: raw ? raw : null });
    });
  }

  const decayEnabledEl = document.getElementById("v3IntelCapacityDecayEnabled");
  if (decayEnabledEl instanceof HTMLInputElement) {
    decayEnabledEl.addEventListener("change", () => {
      applyExpertPatch({ capacityDecayEnabled: !!decayEnabledEl.checked });
    });
  }

  const decayModelTypeEl = document.getElementById("v3IntelDecayModelType");
  if (decayModelTypeEl instanceof HTMLSelectElement) {
    decayModelTypeEl.addEventListener("change", () => {
      const type = String(decayModelTypeEl.value || "linear");
      applyExpertPatch({ decayModel: { type } });
    });
  }

  const decayWeeklyPctEl = document.getElementById("v3IntelDecayWeeklyPct");
  if (decayWeeklyPctEl instanceof HTMLInputElement) {
    const push = () => {
      const parsed = parseOptionalNumber(decayWeeklyPctEl.value);
      if (!Number.isFinite(parsed)) {
        return;
      }
      applyExpertPatch({ decayModel: { weeklyDecayPct: parsed / 100 } });
    };
    decayWeeklyPctEl.addEventListener("change", push);
    decayWeeklyPctEl.addEventListener("blur", push);
  }

  const decayFloorPctEl = document.getElementById("v3IntelDecayFloorPct");
  if (decayFloorPctEl instanceof HTMLInputElement) {
    const push = () => {
      const parsed = parseOptionalNumber(decayFloorPctEl.value);
      if (!Number.isFinite(parsed)) {
        return;
      }
      applyExpertPatch({ decayModel: { floorPctOfBaseline: parsed / 100 } });
    };
    decayFloorPctEl.addEventListener("change", push);
    decayFloorPctEl.addEventListener("blur", push);
  }

  const shockEnabledEl = document.getElementById("v3IntelShockScenariosEnabled");
  if (shockEnabledEl instanceof HTMLInputElement) {
    shockEnabledEl.addEventListener("change", () => {
      applySimPatch({ shockScenariosEnabled: !!shockEnabledEl.checked });
    });
  }

  const generateBtn = document.getElementById("v3BtnIntelCalibrationGenerate");
  if (generateBtn instanceof HTMLButtonElement) {
    generateBtn.addEventListener("click", () => {
      const kind = selectedBriefKind();
      const result = generateIntelBriefViaScenarioApi(kind);
      if (!result?.ok) {
        calibrationActionStatus = String(result?.error || `Failed to generate ${intelBriefKindLabel(kind).toLowerCase()} brief.`);
        return;
      }
      const textarea = document.getElementById("v3IntelCalibrationBriefContent");
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = String(result?.brief?.content || latestBriefContentForKind(kind) || "");
      }
      calibrationActionStatus = `${intelBriefKindLabel(kind)} brief generated.`;
    });
  }

  const copyBtn = document.getElementById("v3BtnIntelCalibrationCopy");
  if (copyBtn instanceof HTMLButtonElement) {
    copyBtn.addEventListener("click", async () => {
      const kind = selectedBriefKind();
      const content = readInputValueById("v3IntelCalibrationBriefContent") || latestBriefContentForKind(kind);
      if (!content) {
        calibrationActionStatus = `No ${intelBriefKindLabel(kind).toLowerCase()} brief to copy yet.`;
        return;
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(content);
          calibrationActionStatus = `${intelBriefKindLabel(kind)} brief copied to clipboard.`;
        } else {
          throw new Error("Clipboard API unavailable");
        }
      } catch {
        calibrationActionStatus = "Clipboard blocked. Copy text manually from the brief box.";
      }
    });
  }

  const addCorrBtn = document.getElementById("v3BtnIntelAddDefaultCorrelation");
  if (addCorrBtn instanceof HTMLButtonElement) {
    addCorrBtn.addEventListener("click", () => {
      const result = addDefaultCorrelationViaScenarioApi();
      if (!result?.ok) {
        return;
      }
    });
  }

  const importCorrBtn = document.getElementById("v3BtnIntelImportCorrelationJson");
  if (importCorrBtn instanceof HTMLButtonElement) {
    importCorrBtn.addEventListener("click", () => {
      const result = importCorrelationModelsViaScenarioApi(readInputValueById("v3IntelCorrelationJson"));
      if (!result?.ok) {
        return;
      }
    });
  }

  const addShockBtn = document.getElementById("v3BtnIntelAddDefaultShock");
  if (addShockBtn instanceof HTMLButtonElement) {
    addShockBtn.addEventListener("click", () => {
      const result = addDefaultShockViaScenarioApi();
      if (!result?.ok) {
        shockActionStatus = String(result?.error || "Failed to add default shock scenario.");
        return;
      }
      shockActionStatus = result.mode === "created"
        ? "Default shock scenario added."
        : "Default shock scenario updated.";
    });
  }

  const importShockBtn = document.getElementById("v3BtnIntelImportShockJson");
  if (importShockBtn instanceof HTMLButtonElement) {
    importShockBtn.addEventListener("click", () => {
      const result = importShockScenariosViaScenarioApi(readInputValueById("v3IntelShockJson"));
      if (!result?.ok) {
        shockActionStatus = String(result?.error || "Shock scenario import failed.");
        return;
      }
      shockActionStatus = `Imported shock scenarios: ${Number(result.created || 0)} created, ${Number(result.updated || 0)} updated.`;
    });
  }
}

function syncControlsCalibrationBridge() {
  const hasApi = hasCalibrationScenarioApi();
  if (hasApi) {
    ensureBriefKindOptions();
    ensureCalibrationSelectOptions();
  }
  [
    "v3IntelBriefKind",
    "v3IntelMcDistribution",
    "v3IntelCorrelatedShocks",
    "v3IntelCorrelationMatrixId",
    "v3IntelCapacityDecayEnabled",
    "v3IntelDecayModelType",
    "v3IntelDecayWeeklyPct",
    "v3IntelDecayFloorPct",
    "v3IntelShockScenariosEnabled"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLButtonElement
    ) {
      el.disabled = !hasApi;
    }
  });

  const inputs = getActiveScenarioInputsSnapshot();
  const intel = (inputs?.intelState && typeof inputs.intelState === "object") ? inputs.intelState : {};
  const sim = (intel?.simToggles && typeof intel.simToggles === "object") ? intel.simToggles : {};
  const expert = (intel?.expertToggles && typeof intel.expertToggles === "object") ? intel.expertToggles : {};
  const decayModel = (expert?.decayModel && typeof expert.decayModel === "object") ? expert.decayModel : {};

  const briefKindEl = document.getElementById("v3IntelBriefKind");
  if (briefKindEl instanceof HTMLSelectElement && document.activeElement !== briefKindEl) {
    const kind = selectedBriefKind();
    if (kind) {
      briefKindEl.value = kind;
    }
  }
  const mcDistributionEl = document.getElementById("v3IntelMcDistribution");
  if (mcDistributionEl instanceof HTMLSelectElement && document.activeElement !== mcDistributionEl) {
    mcDistributionEl.value = String(sim.mcDistribution || "triangular");
  }
  const correlatedEl = document.getElementById("v3IntelCorrelatedShocks");
  if (correlatedEl instanceof HTMLInputElement && document.activeElement !== correlatedEl) {
    correlatedEl.checked = !!sim.correlatedShocks;
  }
  const correlationIdEl = document.getElementById("v3IntelCorrelationMatrixId");
  if (correlationIdEl instanceof HTMLSelectElement && document.activeElement !== correlationIdEl) {
    const current = String(sim.correlationMatrixId || "");
    correlationIdEl.value = current;
  }
  const decayEnabledEl = document.getElementById("v3IntelCapacityDecayEnabled");
  if (decayEnabledEl instanceof HTMLInputElement && document.activeElement !== decayEnabledEl) {
    decayEnabledEl.checked = !!expert.capacityDecayEnabled;
  }
  const decayModelTypeEl = document.getElementById("v3IntelDecayModelType");
  if (decayModelTypeEl instanceof HTMLSelectElement && document.activeElement !== decayModelTypeEl) {
    decayModelTypeEl.value = String(decayModel.type || "linear");
  }
  const decayWeeklyPctEl = document.getElementById("v3IntelDecayWeeklyPct");
  if (decayWeeklyPctEl instanceof HTMLInputElement && document.activeElement !== decayWeeklyPctEl) {
    const weekly = Number(decayModel.weeklyDecayPct);
    decayWeeklyPctEl.value = Number.isFinite(weekly) ? String((weekly * 100).toFixed(2).replace(/\.00$/, "")) : "";
  }
  const decayFloorPctEl = document.getElementById("v3IntelDecayFloorPct");
  if (decayFloorPctEl instanceof HTMLInputElement && document.activeElement !== decayFloorPctEl) {
    const floor = Number(decayModel.floorPctOfBaseline);
    decayFloorPctEl.value = Number.isFinite(floor) ? String((floor * 100).toFixed(2).replace(/\.00$/, "")) : "";
  }
  const shockEnabledEl = document.getElementById("v3IntelShockScenariosEnabled");
  if (shockEnabledEl instanceof HTMLInputElement && document.activeElement !== shockEnabledEl) {
    shockEnabledEl.checked = sim.shockScenariosEnabled !== false;
  }

  const selectedKind = selectedBriefKind();
  const content = latestBriefContentForKind(selectedKind) || latestBriefContentForKind("calibrationSources");
  setTextareaValue("v3IntelCalibrationBriefContent", hasApi ? content : "");

  setText("v3IntelCorrelationDisabledHint", buildCorrelationDisabledHint());
  setText("v3IntelDecayStatus", buildDecayStatus());
  if (!hasApi) {
    setText("v3IntelCorrelationStatus", "Scenario bridge unavailable.");
    setText("v3IntelShockScenarioCount", "0 scenarios configured.");
    setText("v3IntelShockStatus", "Scenario bridge unavailable.");
    setText("v3IntelCalibrationStatus", "Scenario bridge unavailable.");
  } else {
    setText("v3IntelCorrelationStatus", buildCorrelationStatus());
    setText("v3IntelShockScenarioCount", buildShockScenarioCount());
    setText("v3IntelShockStatus", shockActionStatus || buildShockStatus());
    setText("v3IntelCalibrationStatus", calibrationActionStatus || buildCalibrationStatus());
  }

  const ids = [
    "v3BtnIntelCalibrationGenerate",
    "v3BtnIntelCalibrationCopy",
    "v3BtnIntelAddDefaultCorrelation",
    "v3BtnIntelImportCorrelationJson",
    "v3BtnIntelAddDefaultShock",
    "v3BtnIntelImportShockJson"
  ];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = !hasApi;
    }
  });

  const importAreas = [
    "v3IntelCorrelationJson",
    "v3IntelShockJson"
  ];
  importAreas.forEach((id) => {
    const field = document.getElementById(id);
    if (field instanceof HTMLTextAreaElement) {
      field.disabled = !hasApi;
    }
  });

  if (!hasApi) {
    const brief = document.getElementById("v3IntelCalibrationBriefContent");
    if (brief instanceof HTMLTextAreaElement) {
      brief.value = "";
    }
  }
}

function wireControlsFeedbackBridge() {
  const root = document.getElementById("v3ControlsFeedbackBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  if (!hasFeedbackScenarioApi()) {
    return;
  }

  const captureBtn = document.getElementById("v3BtnIntelCaptureObserved");
  if (captureBtn instanceof HTMLButtonElement) {
    captureBtn.addEventListener("click", () => {
      const result = captureObservedMetricsViaScenarioApi();
      if (!result?.ok) {
        observedActionStatus = String(result?.error || "Observed metrics capture failed.");
        return;
      }
      observedActionStatus = `Observed metrics captured (${Number(result.created || 0)} new, ${Number(result.updated || 0)} updated).`;
    });
  }

  const generateBtn = document.getElementById("v3BtnIntelGenerateRecommendations");
  if (generateBtn instanceof HTMLButtonElement) {
    generateBtn.addEventListener("click", () => {
      const result = generateDriftRecommendationsViaScenarioApi();
      if (!result?.ok) {
        recommendationActionStatus = String(result?.error || "Recommendation generation failed.");
        if (result?.metricsError) {
          observedActionStatus = String(result.metricsError);
        }
        return;
      }
      if (result.metricsOk) {
        observedActionStatus = `Observed metrics captured (${Number(result.metricsCreated || 0)} new, ${Number(result.metricsUpdated || 0)} updated).`;
      } else if (result.metricsError) {
        observedActionStatus = String(result.metricsError);
      }
      const active = Number(result.autoTotal || 0);
      recommendationActionStatus = active > 0
        ? `Drift recommendations updated (${active} active).`
        : "No active drift recommendations (rolling metrics are within tolerance).";
    });
  }

  const parseBtn = document.getElementById("v3BtnIntelParseWhatIf");
  if (parseBtn instanceof HTMLButtonElement) {
    parseBtn.addEventListener("click", () => {
      const result = parseWhatIfViaScenarioApi(readInputValueById("v3IntelWhatIfInput"));
      if (!result?.ok) {
        whatIfActionStatus = String(result?.error || "Failed to parse what-if request.");
        return;
      }
      const unresolved = Number(result.unresolved || 0);
      const parsedTargets = Number(result.parsedTargets || 0);
      whatIfActionStatus = unresolved > 0
        ? `Saved what-if request (${parsedTargets} parsed, ${unresolved} unresolved segment${unresolved === 1 ? "" : "s"}).`
        : `Saved what-if request (${parsedTargets} parsed target${parsedTargets === 1 ? "" : "s"}).`;
    });
  }

  const applyBtn = document.getElementById("v3BtnIntelApplyTopRecommendation");
  if (applyBtn instanceof HTMLButtonElement) {
    applyBtn.addEventListener("click", () => {
      const result = applyTopRecommendationViaScenarioApi();
      if (!result?.ok) {
        recommendationActionStatus = String(result?.error || "Failed to apply recommendation patch.");
        return;
      }
      const title = String(result.recommendationTitle || "recommendation");
      const changes = Number(result.changesCount || 0);
      if (result.noop) {
        recommendationActionStatus = `${title} already matches current assumptions.`;
        return;
      }
      recommendationActionStatus = result.needsGovernance
        ? `Applied ${title} (${changes} change${changes === 1 ? "" : "s"}). Governance follow-up required.`
        : `Applied ${title} (${changes} change${changes === 1 ? "" : "s"}).`;
    });
  }
}

function syncControlsFeedbackBridge() {
  const hasApi = hasFeedbackScenarioApi();
  const input = document.getElementById("v3IntelWhatIfInput");
  if (input instanceof HTMLTextAreaElement) {
    input.disabled = !hasApi;
  }

  [
    "v3BtnIntelCaptureObserved",
    "v3BtnIntelGenerateRecommendations",
    "v3BtnIntelApplyTopRecommendation",
    "v3BtnIntelParseWhatIf"
  ].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = !hasApi;
    }
  });

  if (!hasApi) {
    setText("v3IntelObservedStatus", "Scenario bridge unavailable.");
    setText("v3IntelRecommendationStatus", "Scenario bridge unavailable.");
    setText("v3IntelWhatIfStatus", "Scenario bridge unavailable.");
    setText("v3IntelObservedCount", "0 observed metric entries captured.");
    setText("v3IntelRecommendationCount", "0 active drift recommendations.");
    setText("v3IntelWhatIfCount", "0 what-if requests parsed.");
    setTextareaValue("v3IntelWhatIfPreview", "");
    setTextareaValue("v3IntelRecommendationPreview", "");
    return;
  }

  setTextareaValue("v3IntelWhatIfPreview", buildWhatIfPreviewFromIntel());
  setTextareaValue("v3IntelRecommendationPreview", buildRecommendationPreviewFromIntel());

  setText("v3IntelObservedCount", buildObservedCount());
  setText("v3IntelRecommendationCount", buildRecommendationCount());
  setText("v3IntelObservedStatus", observedActionStatus || buildObservedStatus());
  setText("v3IntelRecommendationStatus", recommendationActionStatus || buildRecommendationStatus());
  setText("v3IntelWhatIfCount", buildWhatIfCount());
  setText("v3IntelWhatIfStatus", whatIfActionStatus || buildWhatIfStatus());
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

function hasCalibrationScenarioApi() {
  const api = getScenarioBridgeApi();
  return !!api
    && typeof api.getView === "function"
    && typeof api.generateIntelBrief === "function"
    && typeof api.addDefaultCorrelationModel === "function"
    && typeof api.importCorrelationModels === "function"
    && typeof api.addDefaultShockScenario === "function"
    && typeof api.importShockScenarios === "function"
    && typeof api.updateIntelSimToggles === "function"
    && typeof api.updateIntelExpertToggles === "function";
}

function hasFeedbackScenarioApi() {
  const api = getScenarioBridgeApi();
  return !!api
    && typeof api.getView === "function"
    && typeof api.captureObservedMetrics === "function"
    && typeof api.generateDriftRecommendations === "function"
    && typeof api.parseWhatIf === "function"
    && typeof api.applyTopRecommendation === "function";
}

function getActiveScenarioInputsSnapshot() {
  const api = getScenarioBridgeApi();
  if (!api) {
    return null;
  }
  if (typeof api.getLiveInputs === "function") {
    try {
      const live = api.getLiveInputs();
      if (live && typeof live === "object") {
        return live;
      }
    } catch {
      // fall through to view snapshot
    }
  }
  if (typeof api.getView !== "function") {
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

function updateSimTogglesViaScenarioApi(patch) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.updateIntelSimToggles !== "function") {
    return false;
  }
  try {
    const result = api.updateIntelSimToggles(patch || {});
    return !!result?.ok;
  } catch {
    return false;
  }
}

function updateExpertTogglesViaScenarioApi(patch) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.updateIntelExpertToggles !== "function") {
    return false;
  }
  try {
    const result = api.updateIntelExpertToggles(patch || {});
    return !!result?.ok;
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

function generateIntelBriefViaScenarioApi(kind) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.generateIntelBrief !== "function") {
    return { ok: false, error: "Calibration brief API unavailable." };
  }
  try {
    const result = api.generateIntelBrief(String(kind || "calibrationSources"));
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to generate brief." };
  } catch {
    return { ok: false, error: "Failed to generate brief." };
  }
}

function addDefaultCorrelationViaScenarioApi() {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.addDefaultCorrelationModel !== "function") {
    return { ok: false, error: "Correlation API unavailable." };
  }
  try {
    const result = api.addDefaultCorrelationModel();
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to add default correlation model." };
  } catch {
    return { ok: false, error: "Failed to add default correlation model." };
  }
}

function importCorrelationModelsViaScenarioApi(jsonText) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.importCorrelationModels !== "function") {
    return { ok: false, error: "Correlation import API unavailable." };
  }
  try {
    const result = api.importCorrelationModels(String(jsonText || ""));
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to import correlation models." };
  } catch {
    return { ok: false, error: "Failed to import correlation models." };
  }
}

function addDefaultShockViaScenarioApi() {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.addDefaultShockScenario !== "function") {
    return { ok: false, error: "Shock scenario API unavailable." };
  }
  try {
    const result = api.addDefaultShockScenario();
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to add default shock scenario." };
  } catch {
    return { ok: false, error: "Failed to add default shock scenario." };
  }
}

function importShockScenariosViaScenarioApi(jsonText) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.importShockScenarios !== "function") {
    return { ok: false, error: "Shock import API unavailable." };
  }
  try {
    const result = api.importShockScenarios(String(jsonText || ""));
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to import shock scenarios." };
  } catch {
    return { ok: false, error: "Failed to import shock scenarios." };
  }
}

function captureObservedMetricsViaScenarioApi() {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.captureObservedMetrics !== "function") {
    return { ok: false, error: "Observed metrics API unavailable." };
  }
  try {
    const result = api.captureObservedMetrics();
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Observed metrics capture failed." };
  } catch {
    return { ok: false, error: "Observed metrics capture failed." };
  }
}

function generateDriftRecommendationsViaScenarioApi() {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.generateDriftRecommendations !== "function") {
    return { ok: false, error: "Recommendation API unavailable." };
  }
  try {
    const result = api.generateDriftRecommendations();
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Recommendation generation failed." };
  } catch {
    return { ok: false, error: "Recommendation generation failed." };
  }
}

function parseWhatIfViaScenarioApi(requestText) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.parseWhatIf !== "function") {
    return { ok: false, error: "What-if parser API unavailable." };
  }
  try {
    const result = api.parseWhatIf(String(requestText || ""));
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to parse what-if request." };
  } catch {
    return { ok: false, error: "Failed to parse what-if request." };
  }
}

function applyTopRecommendationViaScenarioApi() {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.applyTopRecommendation !== "function") {
    return { ok: false, error: "Recommendation apply API unavailable." };
  }
  try {
    const result = api.applyTopRecommendation();
    return result && typeof result === "object"
      ? result
      : { ok: false, error: "Failed to apply recommendation patch." };
  } catch {
    return { ok: false, error: "Failed to apply recommendation patch." };
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

function ensureBriefKindOptions() {
  const select = document.getElementById("v3IntelBriefKind");
  if (!(select instanceof HTMLSelectElement) || select.options.length > 0) {
    return;
  }
  const kinds = listIntelBriefKinds();
  kinds.forEach((kind) => {
    const opt = document.createElement("option");
    opt.value = kind;
    opt.textContent = intelBriefKindLabel(kind);
    select.appendChild(opt);
  });
  if (kinds.includes("calibrationSources")) {
    select.value = "calibrationSources";
  }
}

function ensureCalibrationSelectOptions() {
  const distSelect = document.getElementById("v3IntelMcDistribution");
  if (distSelect instanceof HTMLSelectElement && distSelect.options.length === 0) {
    MC_DISTRIBUTION_OPTIONS.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      distSelect.appendChild(opt);
    });
  }

  const decaySelect = document.getElementById("v3IntelDecayModelType");
  if (decaySelect instanceof HTMLSelectElement && decaySelect.options.length === 0) {
    DECAY_MODEL_OPTIONS.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      decaySelect.appendChild(opt);
    });
  }

  const corrSelect = document.getElementById("v3IntelCorrelationMatrixId");
  if (!(corrSelect instanceof HTMLSelectElement)) {
    return;
  }
  const previous = String(corrSelect.value || "");
  corrSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select correlation model";
  corrSelect.appendChild(placeholder);

  const intel = getActiveIntelStateSnapshot();
  const rows = Array.isArray(intel?.correlationModels) ? intel.correlationModels.slice() : [];
  rows
    .sort((a, b) => String(a?.label || a?.id || "").localeCompare(String(b?.label || b?.id || "")))
    .forEach((row) => {
      const id = String(row?.id || "").trim();
      if (!id) return;
      const opt = document.createElement("option");
      opt.value = id;
      const label = String(row?.label || "").trim();
      opt.textContent = label ? `${label} (${id})` : id;
      corrSelect.appendChild(opt);
    });

  const hasPrevious = rows.some((row) => String(row?.id || "").trim() === previous);
  corrSelect.value = hasPrevious ? previous : "";
}

function selectedBriefKind() {
  const raw = readInputValueById("v3IntelBriefKind");
  const known = listIntelBriefKinds();
  return known.includes(raw) ? raw : "calibrationSources";
}

function latestBriefContentForKind(kind) {
  const intel = getActiveIntelStateSnapshot();
  const rows = Array.isArray(intel?.briefs) ? intel.briefs.slice() : [];
  const targetKind = String(kind || "").trim();
  const candidates = rows
    .filter((row) => String(row?.kind || "").trim() === targetKind)
    .sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
  const latest = candidates[0] || null;
  return String(latest?.content || "").trim();
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

function assignCardStatusId(card, id) {
  if (!(card instanceof HTMLElement) || !id) {
    return;
  }
  const badge = card.querySelector(".fpe-card__status");
  if (badge instanceof HTMLElement) {
    badge.id = id;
  }
}

function syncControlsCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || "Awaiting review";
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyControlsStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
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

function parseLeadingCount(text) {
  const match = String(text || "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function deriveControlsWorkflowCardStatus(lockStatus, workflowStatus) {
  const combined = `${lockStatus} ${workflowStatus}`.toLowerCase();
  if (combined.includes("unavailable")) {
    return "Unavailable";
  }
  if (combined.includes("lock on")) {
    return "Locked";
  }
  if (combined.includes("active")) {
    return "Guarded";
  }
  if (combined.includes("healthy")) {
    return "Healthy";
  }
  return "Awaiting review";
}

function deriveControlsEvidenceCardStatus(missingEvidenceText, missingNoteText, evidenceStatus) {
  const missingEvidence = parseLeadingCount(missingEvidenceText);
  const missingNote = parseLeadingCount(missingNoteText);
  const status = String(evidenceStatus || "").toLowerCase();
  if (status.includes("unavailable")) {
    return "Unavailable";
  }
  if (missingEvidence > 0 || missingNote > 0) {
    return "Needs evidence";
  }
  if (status.includes("ready to attach")) {
    return "Ready to attach";
  }
  if (status.includes("resolved") || status.includes("no unresolved")) {
    return "Audit clear";
  }
  return "Awaiting audit";
}

function deriveControlsBenchmarkCardStatus(countText, benchmarkStatus) {
  const count = parseLeadingCount(countText);
  const status = String(benchmarkStatus || "").toLowerCase();
  if (status.includes("unavailable")) {
    return "Unavailable";
  }
  if (count > 0) {
    return "Benchmarks set";
  }
  if (status.includes("ready")) {
    return "Ready";
  }
  return "Catalog empty";
}

function deriveControlsReviewCardStatus(observedCountText, recommendationCountText, recommendationStatus, whatIfCountText) {
  const observedCount = parseLeadingCount(observedCountText);
  const recommendationCount = parseLeadingCount(recommendationCountText);
  const whatIfCount = parseLeadingCount(whatIfCountText);
  const recommendation = String(recommendationStatus || "").toLowerCase();
  if (recommendation.includes("unavailable")) {
    return "Unavailable";
  }
  if (recommendationCount > 0) {
    return "Review ready";
  }
  if (observedCount > 0) {
    return "Observed captured";
  }
  if (whatIfCount > 0) {
    return "Parser active";
  }
  return "Awaiting feedback";
}

function deriveControlsIntegrityCardStatus(calibrationStatus, correlationStatus, shockStatus, decayStatus) {
  const calibration = String(calibrationStatus || "").toLowerCase();
  const correlation = String(correlationStatus || "").toLowerCase();
  const shock = String(shockStatus || "").toLowerCase();
  const decay = String(decayStatus || "").toLowerCase();
  const combined = `${calibration} ${correlation} ${shock} ${decay}`;
  if (combined.includes("unavailable")) {
    return "Unavailable";
  }
  if (calibration.includes("generated")) {
    return "Brief ready";
  }
  if (correlation.includes(" on") || shock.includes("enabled") || decay.includes(" on")) {
    return "Sim ready";
  }
  return "Needs brief";
}

function deriveControlsWarningsCardStatus(missingEvidenceText, missingNoteText, recommendationCountText, workflowStatus) {
  const missingEvidence = parseLeadingCount(missingEvidenceText);
  const missingNote = parseLeadingCount(missingNoteText);
  const recommendationCount = parseLeadingCount(recommendationCountText);
  const workflow = String(workflowStatus || "").toLowerCase();
  if (workflow.includes("unavailable")) {
    return "Unavailable";
  }
  if (missingEvidence > 0 || missingNote > 0) {
    return "Action needed";
  }
  if (recommendationCount > 0 || workflow.includes("active")) {
    return "Watchlist";
  }
  return "Quiet";
}

function classifyControlsStatusTone(text) {
  const lower = String(text || "").trim().toLowerCase();
  if (!lower) {
    return "neutral";
  }
  if (/(healthy|audit clear|benchmarks set|review ready|brief ready|sim ready|quiet|ready$)/.test(lower)) {
    return "ok";
  }
  if (/(unavailable|needs evidence|action needed|failed|broken)/.test(lower)) {
    return "bad";
  }
  if (/(locked|guarded|watchlist|awaiting|needs brief|catalog empty|parser active|observed captured|ready to attach)/.test(lower)) {
    return "warn";
  }
  return "neutral";
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
  const intel = getActiveIntelStateSnapshot();
  const count = Array.isArray(intel?.correlationModels)
    ? intel.correlationModels.length
    : Math.max(0, selectOptionCount("v3IntelCorrelationMatrixId") - 1);
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
  const enabled = isCheckedById("v3IntelCorrelatedShocks");
  const selectedModelId = readInputValueById("v3IntelCorrelationMatrixId");
  const selectedModelLabel = readSelectedOptionLabelById("v3IntelCorrelationMatrixId");
  const intel = getActiveIntelStateSnapshot();
  const count = Array.isArray(intel?.correlationModels)
    ? intel.correlationModels.length
    : Math.max(0, selectOptionCount("v3IntelCorrelationMatrixId") - 1);

  if (!enabled) {
    return count > 0
      ? `Correlation model OFF (${count} model${count === 1 ? "" : "s"} available).`
      : "Correlation model OFF (no models configured).";
  }

  if (count <= 0) {
    return "Correlation model ON, but no models are configured.";
  }

  const hasSelection = selectedModelId && selectedModelId.toLowerCase() !== "none";
  if (!hasSelection) {
    return `Correlation model ON (${count} model${count === 1 ? "" : "s"} available, select one).`;
  }

  return `Correlation model ON (${selectedModelLabel || selectedModelId}).`;
}

function readSelectedOptionLabelById(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return "";
  }
  const option = el.selectedOptions && el.selectedOptions.length ? el.selectedOptions[0] : null;
  return option ? String(option.textContent || "").trim() : "";
}

function buildShockScenarioCount() {
  const intel = getActiveIntelStateSnapshot();
  const count = Array.isArray(intel?.shockScenarios) ? intel.shockScenarios.length : 0;
  return `${count} scenario${count === 1 ? "" : "s"} configured.`;
}

function buildShockStatus() {
  const enabled = isCheckedById("v3IntelShockScenariosEnabled");
  const intel = getActiveIntelStateSnapshot();
  const count = Array.isArray(intel?.shockScenarios) ? intel.shockScenarios.length : 0;
  if (!enabled) {
    return "Shock scenarios disabled.";
  }
  return count > 0 ? "Shock scenarios enabled and ready." : "Shock scenarios enabled (no scenario set loaded).";
}

function buildCalibrationStatus() {
  const kind = selectedBriefKind();
  const brief = latestBriefContentForKind(kind);
  return brief ? `${intelBriefKindLabel(kind)} brief generated.` : "No calibration brief generated yet.";
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
