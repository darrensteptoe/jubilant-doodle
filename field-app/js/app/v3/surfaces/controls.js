import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest, mountLegacyNode } from "../compat.js";
import { readText, setText } from "../surfaceUtils.js";

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

  mountLegacyNode({
    key: "v3-controls-workflow-card",
    selector: "#intelWorkflowCard",
    target: getCardBody(workflowCard)
  });

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

  return refreshControlsSummary;
}

function refreshControlsSummary() {
  setText("v3ControlsWorkflowStatus", readText("#intelWorkflowStatus"));
  setText("v3ControlsBenchmarkCount", readText("#intelBenchmarkCount"));
  setText("v3ControlsMissingEvidence", readText("#intelMissingEvidenceCount"));
  setText("v3ControlsCalibrationStatus", readText("#intelCalibrationStatus"));
  setText("v3ControlsRecommendationCount", readText("#intelRecommendationCount"));
  setText("v3ControlsCensusStatus", readText("#censusStatus"));
  setText("v3ControlsCensusSelection", readText("#censusGeoStats"));
}
