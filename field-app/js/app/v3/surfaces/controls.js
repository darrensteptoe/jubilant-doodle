import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import { getLegacyEl, readText, setText } from "../surfaceUtils.js";

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

  mountLegacyNode({
    key: "v3-controls-evidence-card",
    selector: "#intelEvidenceCard",
    target: getCardBody(evidenceCard)
  });

  mountLegacyNode({
    key: "v3-controls-benchmark-card",
    selector: "#intelBenchmarkCard",
    target: getCardBody(benchmarkCard)
  });

  mountLegacyNode({
    key: "v3-controls-calibration-card",
    selector: "#intelCalibrationBriefCard",
    target: getCardBody(calibrationCard)
  });

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

  wireControlsWorkflowBridge();
  return refreshControlsSummary;
}

function refreshControlsSummary() {
  syncControlsWorkflowBridge();

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

  bindCheckboxBridge("v3IntelScenarioLocked", "intelScenarioLocked");
  bindCheckboxBridge("v3IntelRequireCriticalNote", "intelRequireCriticalNote");
  bindCheckboxBridge("v3IntelRequireCriticalEvidence", "intelRequireCriticalEvidence");
  bindInputBridge("v3IntelScenarioLockReason", "intelScenarioLockReason");
  bindInputBridge("v3IntelCriticalChangeNote", "intelCriticalChangeNote");
}

function syncControlsWorkflowBridge() {
  syncCheckboxValue("v3IntelScenarioLocked", "intelScenarioLocked");
  syncCheckboxValue("v3IntelRequireCriticalNote", "intelRequireCriticalNote");
  syncCheckboxValue("v3IntelRequireCriticalEvidence", "intelRequireCriticalEvidence");
  syncInputValue("v3IntelScenarioLockReason", "intelScenarioLockReason");
  syncInputValue("v3IntelCriticalChangeNote", "intelCriticalChangeNote");
  setText("v3IntelScenarioLockStatus", readText("#intelScenarioLockStatus"));
  setText("v3IntelWorkflowStatus", readText("#intelWorkflowStatus"));
}

function bindCheckboxBridge(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement)) {
    return;
  }

  v3.addEventListener("change", () => {
    const legacy = getLegacyEl(legacyId);
    if (!(legacy instanceof HTMLInputElement)) {
      return;
    }
    legacy.checked = v3.checked;
    legacy.dispatchEvent(new Event("input", { bubbles: true }));
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function bindInputBridge(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement || v3 instanceof HTMLTextAreaElement)) {
    return;
  }

  v3.addEventListener("input", () => {
    const legacy = getLegacyEl(legacyId);
    if (!(legacy instanceof HTMLInputElement || legacy instanceof HTMLTextAreaElement)) {
      return;
    }
    legacy.value = v3.value;
    legacy.dispatchEvent(new Event("input", { bubbles: true }));
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function syncCheckboxValue(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = getLegacyEl(legacyId);
  if (!(v3 instanceof HTMLInputElement) || !(legacy instanceof HTMLInputElement)) {
    return;
  }
  v3.checked = legacy.checked;
}

function syncInputValue(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = getLegacyEl(legacyId);
  if (
    !(v3 instanceof HTMLInputElement || v3 instanceof HTMLTextAreaElement) ||
    !(legacy instanceof HTMLInputElement || legacy instanceof HTMLTextAreaElement)
  ) {
    return;
  }
  v3.value = legacy.value;
}
