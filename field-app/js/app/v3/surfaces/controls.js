import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  countSelectOptions,
  setText,
} from "../surfaceUtils.js";
import {
  benchmarkRefLabel,
  intelBriefKindLabel,
  listBenchmarkRefs,
  listIntelBenchmarks,
  listIntelBriefKinds,
  listIntelEvidence,
  listMissingEvidenceAudit,
  listMissingNoteAudit
} from "../../intelControlsRuntime.js";
import {
  buildControlsBenchmarkDraftStatus,
  buildControlsCalibrationStatus,
  buildControlsCorrelationDisabledHint,
  buildControlsCorrelationStatus,
  buildControlsDecayStatus,
  buildControlsEvidenceAttachStatus,
  buildControlsObservedCaptureStatus,
  buildControlsRecommendationRefreshStatus,
  buildObservedCountText,
  buildObservedStatusText,
  buildRecommendationCountText,
  buildRecommendationPreviewTextFromIntel,
  buildRecommendationStatusText,
  buildControlsScenarioLockStatus,
  buildControlsShockScenarioCountText,
  buildControlsShockStatus,
  buildControlsWhatIfSavedStatus,
  buildControlsWorkflowStatus,
  buildWhatIfCountText,
  buildWhatIfPreviewTextFromIntel,
  buildWhatIfStatusText,
  CONTROLS_STATUS_AWAITING_REVIEW,
  classifyControlsStatusTone,
  deriveControlsBenchmarkCardStatus,
  deriveControlsEvidenceCardStatus,
  deriveControlsIntegrityCardStatus,
  deriveControlsReviewCardStatus,
  deriveControlsWarningsCardStatus,
  deriveControlsWorkflowCardStatus,
  formatControlsIsoDate,
  formatControlsNumber,
  formatControlsRecordCount,
  parseControlsOptionalNumber,
} from "../../../core/controlsView.js";
import {
  benchmarkScopeLabel,
  benchmarkScopeToBenchmarkKey,
  benchmarkScopeToRaceType,
  listBenchmarkScopeOptions,
} from "../../../core/benchmarkProfiles.js";
import { formatPercentFromUnit } from "../../../core/utils.js";
import { formatOfficeContextLabel } from "../../../core/officeContextLabels.js";
import { pctOverrideToDecimal } from "../../../core/voteProduction.js";
import {
  clearSavedMapboxPublicToken,
  MAPBOX_PUBLIC_TOKEN_STORAGE_KEY,
  readMapboxPublicTokenConfig,
  saveMapboxPublicToken,
} from "../../runtimeConfig.js";

const SCENARIO_API_KEY = "__FPE_SCENARIO_API__";
const BENCHMARK_REF_OPTIONS = listBenchmarkRefs();
const BENCHMARK_SCOPE_OPTIONS = listBenchmarkScopeOptions();
const MAPBOX_PUBLIC_PREFIX = "pk.";
const MAPBOX_SOURCE_LABELS = {
  saved_storage: "Saved browser config",
  legacy_config: "Legacy app config",
  legacy_meta: "Legacy meta config",
  legacy_env: "Legacy env config",
};
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
let mapboxActionStatus = "";

export function renderControlsSurface(mount) {
  const frame = createCenterStackFrame();
  const centerCol = createCenterStackColumn();

  const workflowCard = createCenterModuleCard({
    title: "Guardrails",
    description: "Lock windows and enforce rationale/evidence policy before high-impact changes.",
    status: "Healthy"
  });

  const evidenceCard = createCenterModuleCard({
    title: "Evidence workflow",
    description: "Resolve missing rationale/evidence so decisions stay auditable.",
    status: "Awaiting audit"
  });

  const benchmarkCard = createCenterModuleCard({
    title: "Benchmark catalog",
    description: "Warning thresholds for critical assumptions; benchmark ranges do not alter canonical math.",
    status: "Catalog empty"
  });

  const feedbackCard = createCenterModuleCard({
    title: "Review workflow",
    description: "Capture observed performance and queue review-ready drift recommendations.",
    status: "Awaiting feedback"
  });

  const calibrationCard = createCenterModuleCard({
    title: "Integrity summary",
    description: "Calibration briefs plus simulation stress controls; deterministic baseline remains canonical.",
    status: "Needs brief"
  });

  const mapConfigCard = createCenterModuleCard({
    title: "Map configuration",
    description: "Configure the app-level Mapbox browser token used by the Campaign Geography surface.",
    status: "Token required"
  });

  const summaryCard = createCenterModuleCard({
    title: "Current warnings",
    description: "At-a-glance governance posture across evidence, calibration, and recommendation workflows.",
    status: "Watchlist"
  });

  assignCardStatusId(workflowCard, "v3ControlsWorkflowCardStatus");
  assignCardStatusId(evidenceCard, "v3ControlsEvidenceCardStatus");
  assignCardStatusId(benchmarkCard, "v3ControlsBenchmarkCardStatus");
  assignCardStatusId(feedbackCard, "v3ControlsReviewCardStatus");
  assignCardStatusId(calibrationCard, "v3ControlsIntegrityCardStatus");
  assignCardStatusId(mapConfigCard, "v3ControlsMapConfigCardStatus");
  assignCardStatusId(summaryCard, "v3ControlsWarningsCardStatus");

  getCardBody(workflowCard).innerHTML = `
    <div class="fpe-module-stack" id="v3ControlsWorkflowBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Use scenario lock during client review windows or sign-off meetings.</li>
          <li>For critical edits, require rationale notes and evidence attachments when policy requires both.</li>
          <li>Example: if turnout reliability changes, record why now and attach the source used for the change.</li>
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
    <div class="fpe-module-stack" id="v3ControlsEvidenceBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Select the unresolved critical edit first so the attachment resolves the correct audit item.</li>
          <li>Attach title, source, date, and URL/file hint so another reviewer can reproduce the evidence path.</li>
          <li>Example: if policy guidance changed a cost assumption, attach memo link + short note on applicability.</li>
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
    <div class="fpe-module-stack" id="v3ControlsBenchmarkBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Benchmarks set warning bands only; they do not rewrite deterministic outputs, Monte Carlo draws, or target rankings.</li>
          <li>Use scope to keep thresholds context-aware and avoid false alarms from mismatched race environments.</li>
          <li>Keep source title + notes current so reviewers can audit why each threshold exists.</li>
        </ul>
      </div>
      <div class="fpe-field-grid fpe-field-grid--3">
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkRef">Reference</label>
          <select class="fpe-input" id="v3IntelBenchmarkRef"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3IntelBenchmarkRaceType">Benchmark scope</label>
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
              <th>Scope</th>
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
    <div class="fpe-module-stack" id="v3ControlsCalibrationBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Generate calibration briefs after benchmark and evidence review so narrative matches governance state.</li>
          <li>Simulation toggles (distribution, correlation, shock, decay) are stress-test controls, not baseline truth edits.</li>
          <li>Example: enable shocks for downside planning, then keep deterministic assumptions unchanged unless review approves edits.</li>
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
    <div class="fpe-module-stack" id="v3ControlsFeedbackBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Capture observed metrics first so recommendation generation is anchored in current evidence.</li>
          <li>Use recommendation preview for review, then apply only approved changes.</li>
          <li>What-if parsing stores metadata only and never bypasses governance approvals for assumption edits.</li>
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
        <label class="fpe-control-label" for="v3IntelWhatIfInput">What-if request parser (metadata only)</label>
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

  getCardBody(mapConfigCard).innerHTML = `
    <div class="fpe-module-stack" id="v3ControlsMapConfigBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Mapbox browser rendering requires a public token that starts with <code>${MAPBOX_PUBLIC_PREFIX}</code>.</li>
          <li>Do not use Mapbox secret tokens in this app. Secret-scoped tokens must remain server-side.</li>
          <li>This token is app-level config, not scenario data, and does not change campaign canon calculations.</li>
          <li>Saving or clearing the token broadcasts a map refresh event so an open Map stage can re-check config immediately.</li>
        </ul>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3MapboxPublicTokenInput">Mapbox public token</label>
        <input autocomplete="off" class="fpe-input" id="v3MapboxPublicTokenInput" placeholder="pk.••••••••" type="password"/>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnMapboxTokenSave" type="button">Save token</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnMapboxTokenClear" type="button">Clear saved token</button>
      </div>
      <div class="fpe-status-strip fpe-status-strip--2">
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Saved token</div>
          <div class="fpe-help fpe-help--flush" id="v3MapboxTokenMasked">Not configured</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Token status</div>
          <div class="fpe-help fpe-help--flush" id="v3MapboxTokenStatus">Set a Mapbox public token to enable the map stage.</div>
        </div>
      </div>
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Admin note</div>
        <div class="fpe-help fpe-help--flush">Token persistence is browser-local under <code>${MAPBOX_PUBLIC_TOKEN_STORAGE_KEY}</code>. Use Clear saved token to reset this device.</div>
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
      <div class="fpe-help fpe-help--flush">Right rail remains the canonical narrative output. This card mirrors key warning signals for quick triage.</div>
    </div>
  `;

  centerCol.append(summaryCard, mapConfigCard, workflowCard, benchmarkCard, evidenceCard, calibrationCard, feedbackCard);
  frame.append(centerCol);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Controls separates governance policy from model behavior so teams can change assumptions responsibly.",
      "Benchmark and evidence workflows add trust signals without mutating deterministic baseline math.",
      "Use this page to verify auditability and simulation-readiness before exporting scenarios or decision briefs."
    ])
  );

  wireControlsWorkflowBridge();
  wireControlsBenchmarkBridge();
  wireControlsEvidenceBridge();
  wireControlsCalibrationBridge();
  wireControlsFeedbackBridge();
  wireControlsMapConfigBridge();
  return refreshControlsSummary;
}

function refreshControlsSummary() {
  syncControlsWorkflowBridge();
  syncControlsBenchmarkBridge();
  syncControlsEvidenceBridge();
  syncControlsCalibrationBridge();
  syncControlsFeedbackBridge();
  syncControlsMapConfigBridge();

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
    "v3ControlsMapConfigCardStatus",
    deriveMapboxConfigCardStatus(readDomTextById("v3MapboxTokenStatus"))
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

  setText(
    "v3IntelScenarioLockStatus",
    buildControlsScenarioLockStatus({
      locked: isCheckedById("v3IntelScenarioLocked"),
      lockReason: readInputValueById("v3IntelScenarioLockReason"),
    })
  );
  setText(
    "v3IntelWorkflowStatus",
    buildControlsWorkflowStatus({
      scenarioLocked: isCheckedById("v3IntelScenarioLocked"),
      requireCriticalNote: isCheckedById("v3IntelRequireCriticalNote"),
      requireCriticalEvidence: isCheckedById("v3IntelRequireCriticalEvidence"),
    })
  );
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
      const selectedScope = readInputValueById("v3IntelBenchmarkRaceType") || "default";
      const result = loadDefaultBenchmarksViaScenarioApi({
        raceType: benchmarkScopeToRaceType(selectedScope),
        benchmarkKey: benchmarkScopeToBenchmarkKey(selectedScope),
      });
      if (result?.ok) {
        const raceLabel = formatOfficeContextLabel(result?.raceType || selectedScope, {
          legacyIntent: benchmarkScopeToRaceType(selectedScope),
        });
        benchmarkActionStatus = `Loaded defaults for ${result.benchmarkKey || raceLabel}. Created ${Number(result.created || 0)}, updated ${Number(result.updated || 0)}.`;
      } else {
        benchmarkActionStatus = String(result?.error || "Failed to load default benchmarks.");
      }
    });
  }

  const saveBtn = document.getElementById("v3BtnIntelBenchmarkSave");
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.addEventListener("click", () => {
      const selectedScope = readInputValueById("v3IntelBenchmarkRaceType") || "default";
      const payload = {
        ref: readInputValueById("v3IntelBenchmarkRef"),
        raceType: benchmarkScopeToRaceType(selectedScope),
        benchmarkKey: benchmarkScopeToBenchmarkKey(selectedScope),
        defaultValue: parseControlsOptionalNumber(readInputValueById("v3IntelBenchmarkDefault")),
        min: parseControlsOptionalNumber(readInputValueById("v3IntelBenchmarkMin")),
        max: parseControlsOptionalNumber(readInputValueById("v3IntelBenchmarkMax")),
        warnAbove: parseControlsOptionalNumber(readInputValueById("v3IntelBenchmarkWarnAbove")),
        hardAbove: parseControlsOptionalNumber(readInputValueById("v3IntelBenchmarkHardAbove")),
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
  setText("v3IntelBenchmarkCount", formatControlsRecordCount(benchmarkRows, "benchmark entry", "configured"));
  setText(
    "v3IntelBenchmarkStatus",
    benchmarkActionStatus || buildControlsBenchmarkDraftStatus({
      reference: readInputValueById("v3IntelBenchmarkRef"),
    })
  );
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
    const range = `${formatControlsNumber(row?.range?.min)} .. ${formatControlsNumber(row?.range?.max)}`;
    const severity = `${formatControlsNumber(row?.severityBands?.warnAbove)} / ${formatControlsNumber(row?.severityBands?.hardAbove)}`;
    const source = row?.source?.title || row?.source?.type || "—";
    const removeId = String(row?.id || "");

    appendCell(tr, benchmarkRefLabel(row?.ref), { subtext: row?.ref || "—" });
    appendCell(
      tr,
      benchmarkScopeLabel(row?.benchmarkKey || row?.templateBenchmarkKey || row?.raceType || "all"),
      {
        subtext: row?.benchmarkKey
          ? `race: ${formatOfficeContextLabel(row?.raceType || "all", { legacyIntent: row?.benchmarkKey })}`
          : "",
      },
    );
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
  setText(
    "v3IntelEvidenceStatus",
    evidenceActionStatus || buildControlsEvidenceAttachStatus({
      evidenceRowCount: evidenceRows,
      unresolvedAuditCount: unresolved,
      evidenceTitle: readInputValueById("v3IntelEvidenceTitle"),
      evidenceSource: readInputValueById("v3IntelEvidenceSource"),
    })
  );
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
    appendCell(tr, formatControlsIsoDate(row?.capturedAt));
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
      const parsed = pctOverrideToDecimal(decayWeeklyPctEl.value, null);
      if (parsed == null) {
        return;
      }
      applyExpertPatch({ decayModel: { weeklyDecayPct: parsed } });
    };
    decayWeeklyPctEl.addEventListener("change", push);
    decayWeeklyPctEl.addEventListener("blur", push);
  }

  const decayFloorPctEl = document.getElementById("v3IntelDecayFloorPct");
  if (decayFloorPctEl instanceof HTMLInputElement) {
    const push = () => {
      const parsed = pctOverrideToDecimal(decayFloorPctEl.value, null);
      if (parsed == null) {
        return;
      }
      applyExpertPatch({ decayModel: { floorPctOfBaseline: parsed } });
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
    const weeklyText = formatPercentFromUnit(weekly, 2, "");
    decayWeeklyPctEl.value = weeklyText ? weeklyText.replace("%", "").replace(/\.00$/, "") : "";
  }
  const decayFloorPctEl = document.getElementById("v3IntelDecayFloorPct");
  if (decayFloorPctEl instanceof HTMLInputElement && document.activeElement !== decayFloorPctEl) {
    const floor = Number(decayModel.floorPctOfBaseline);
    const floorText = formatPercentFromUnit(floor, 2, "");
    decayFloorPctEl.value = floorText ? floorText.replace("%", "").replace(/\.00$/, "") : "";
  }
  const shockEnabledEl = document.getElementById("v3IntelShockScenariosEnabled");
  if (shockEnabledEl instanceof HTMLInputElement && document.activeElement !== shockEnabledEl) {
    shockEnabledEl.checked = sim.shockScenariosEnabled !== false;
  }

  const selectedKind = selectedBriefKind();
  const selectedKindContent = latestBriefContentForKind(selectedKind);
  const content = selectedKindContent || latestBriefContentForKind("calibrationSources");
  const correlationModelCount = countCorrelationModelsFromIntel();
  const shockScenarioCount = countShockScenariosFromIntel();
  setTextareaValue("v3IntelCalibrationBriefContent", hasApi ? content : "");

  setText("v3IntelCorrelationDisabledHint", buildControlsCorrelationDisabledHint(correlationModelCount));
  setText(
    "v3IntelDecayStatus",
    buildControlsDecayStatus({
      enabled: isCheckedById("v3IntelCapacityDecayEnabled"),
      weeklyPct: readInputValueById("v3IntelDecayWeeklyPct"),
    })
  );
  if (!hasApi) {
    setText("v3IntelCorrelationStatus", "Scenario bridge unavailable.");
    setText("v3IntelShockScenarioCount", "0 scenarios configured.");
    setText("v3IntelShockStatus", "Scenario bridge unavailable.");
    setText("v3IntelCalibrationStatus", "Scenario bridge unavailable.");
  } else {
    setText(
      "v3IntelCorrelationStatus",
      buildControlsCorrelationStatus({
        enabled: isCheckedById("v3IntelCorrelatedShocks"),
        modelCount: correlationModelCount,
        selectedModelId: readInputValueById("v3IntelCorrelationMatrixId"),
        selectedModelLabel: readSelectedOptionLabelById("v3IntelCorrelationMatrixId"),
      })
    );
    setText("v3IntelShockScenarioCount", buildControlsShockScenarioCountText(shockScenarioCount));
    setText(
      "v3IntelShockStatus",
      shockActionStatus || buildControlsShockStatus({
        enabled: isCheckedById("v3IntelShockScenariosEnabled"),
        scenarioCount: shockScenarioCount,
      })
    );
    setText(
      "v3IntelCalibrationStatus",
      calibrationActionStatus || buildControlsCalibrationStatus({
        briefKindLabel: intelBriefKindLabel(selectedKind),
        hasBrief: Boolean(selectedKindContent),
      })
    );
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
      observedActionStatus = buildControlsObservedCaptureStatus(
        Number(result.created || 0),
        Number(result.updated || 0),
      );
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
        observedActionStatus = buildControlsObservedCaptureStatus(
          Number(result.metricsCreated || 0),
          Number(result.metricsUpdated || 0),
        );
      } else if (result.metricsError) {
        observedActionStatus = String(result.metricsError);
      }
      recommendationActionStatus = buildControlsRecommendationRefreshStatus(Number(result.autoTotal || 0));
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
      whatIfActionStatus = buildControlsWhatIfSavedStatus(
        Number(result.parsedTargets || 0),
        Number(result.unresolved || 0),
      );
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

  const intel = getActiveIntelStateSnapshot();
  setTextareaValue("v3IntelWhatIfPreview", buildWhatIfPreviewTextFromIntel(intel));
  setTextareaValue("v3IntelRecommendationPreview", buildRecommendationPreviewTextFromIntel(intel));

  setText("v3IntelObservedCount", buildObservedCountText(intel));
  setText("v3IntelRecommendationCount", buildRecommendationCountText(intel));
  setText("v3IntelObservedStatus", observedActionStatus || buildObservedStatusText(intel));
  setText("v3IntelRecommendationStatus", recommendationActionStatus || buildRecommendationStatusText(intel));
  setText("v3IntelWhatIfCount", buildWhatIfCountText(intel));
  setText("v3IntelWhatIfStatus", whatIfActionStatus || buildWhatIfStatusText(intel));
}

function wireControlsMapConfigBridge() {
  const root = document.getElementById("v3ControlsMapConfigBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  const input = document.getElementById("v3MapboxPublicTokenInput");
  if (input instanceof HTMLInputElement) {
    input.addEventListener("input", () => {
      mapboxActionStatus = `Draft token edited. Save a ${MAPBOX_PUBLIC_PREFIX} token to apply it.`;
      syncControlsMapConfigBridge();
    });
  }

  const saveBtn = document.getElementById("v3BtnMapboxTokenSave");
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.addEventListener("click", () => {
      const input = document.getElementById("v3MapboxPublicTokenInput");
      const value = input instanceof HTMLInputElement ? String(input.value || "") : "";
      const result = saveMapboxPublicToken(value);
      mapboxActionStatus = result?.ok
        ? "Mapbox token saved for this browser. Map stage will refresh on next sync (or immediately if already open)."
        : String(result?.message || "Mapbox token save failed.");
      dispatchMapConfigUpdated();
      syncControlsMapConfigBridge();
    });
  }

  const clearBtn = document.getElementById("v3BtnMapboxTokenClear");
  if (clearBtn instanceof HTMLButtonElement) {
    clearBtn.addEventListener("click", () => {
      clearSavedMapboxPublicToken();
      mapboxActionStatus = "Saved Mapbox token cleared from this browser. Map stage will refresh and return to config-required state.";
      dispatchMapConfigUpdated();
      syncControlsMapConfigBridge();
    });
  }
}

function syncControlsMapConfigBridge() {
  const config = readMapboxPublicTokenConfig();
  const input = document.getElementById("v3MapboxPublicTokenInput");
  const saveBtn = document.getElementById("v3BtnMapboxTokenSave");
  const clearBtn = document.getElementById("v3BtnMapboxTokenClear");
  if (input instanceof HTMLInputElement && document.activeElement !== input) {
    input.value = config?.token || "";
  }
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.disabled = false;
  }
  if (clearBtn instanceof HTMLButtonElement) {
    clearBtn.disabled = !config?.valid && !config?.invalidConfigValue;
  }

  const sourceLabel = MAPBOX_SOURCE_LABELS[String(config?.source || "")] || "";
  setText("v3MapboxTokenMasked", config?.maskedToken || "Not configured");

  if (mapboxActionStatus) {
    setText("v3MapboxTokenStatus", mapboxActionStatus);
    return;
  }

  if (config?.valid) {
    if (String(config?.source) === "saved_storage") {
      setText("v3MapboxTokenStatus", "Saved browser token is active for Map stage rendering. Save/Clear actions trigger a map config refresh signal.");
    } else {
      setText("v3MapboxTokenStatus", `Using ${sourceLabel || "legacy config"} token. Save it here to persist in browser storage.`);
    }
    return;
  }

  if (config?.invalidConfigValue) {
    setText("v3MapboxTokenStatus", `Invalid Mapbox token. Enter a public token starting with ${MAPBOX_PUBLIC_PREFIX}.`);
    return;
  }

  setText("v3MapboxTokenStatus", "No Mapbox token configured. Save a public pk token here to enable the Map stage.");
}

function dispatchMapConfigUpdated() {
  try {
    window.dispatchEvent(new CustomEvent("vice:mapbox-config-updated"));
  } catch {}
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

function loadDefaultBenchmarksViaScenarioApi(scopeInput) {
  const api = getScenarioBridgeApi();
  if (!api || typeof api.loadDefaultBenchmarks !== "function") {
    return { ok: false, error: "Benchmark defaults API unavailable." };
  }
  try {
    const payload = scopeInput && typeof scopeInput === "object"
      ? scopeInput
      : String(scopeInput || "default");
    const result = api.loadDefaultBenchmarks(payload);
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
    BENCHMARK_SCOPE_OPTIONS.forEach((scope) => {
      const opt = document.createElement("option");
      opt.value = String(scope?.value || "default");
      opt.textContent = String(scope?.label || scope?.value || "default");
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
    const ts = formatControlsIsoDate(row?.ts || row?.updatedAt || row?.createdAt || "");
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
  const text = String(value || "").trim() || CONTROLS_STATUS_AWAITING_REVIEW;
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

function deriveMapboxConfigCardStatus(statusText) {
  const text = String(statusText || "").toLowerCase();
  if (text.includes("invalid") || text.includes("failed")) {
    return "Config issue";
  }
  if (text.includes("active") || text.includes("saved")) {
    return "Map ready";
  }
  if (text.includes("no mapbox token")) {
    return "Token required";
  }
  return "Awaiting setup";
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

function countCorrelationModelsFromIntel() {
  const intel = getActiveIntelStateSnapshot();
  return Array.isArray(intel?.correlationModels)
    ? intel.correlationModels.length
    : countSelectOptions("v3IntelCorrelationMatrixId", { excludeFirst: true });
}

function countShockScenariosFromIntel() {
  const intel = getActiveIntelStateSnapshot();
  return Array.isArray(intel?.shockScenarios) ? intel.shockScenarios.length : 0;
}

function readSelectedOptionLabelById(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return "";
  }
  const option = el.selectedOptions && el.selectedOptions.length ? el.selectedOptions[0] : null;
  return option ? String(option.textContent || "").trim() : "";
}

function getActiveIntelStateSnapshot() {
  const inputs = getActiveScenarioInputsSnapshot();
  if (!inputs || typeof inputs !== "object") {
    return null;
  }
  const intel = inputs.intelState;
  return intel && typeof intel === "object" ? intel : null;
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
