import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest } from "../compat.js";
import { readSelectedLabel, readText, setText } from "../surfaceUtils.js";

export function renderDecisionLogSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const sessionCard = createCard({
    title: "Session context",
    description: "Session selection, naming, objective, scenario linkage, and working notes."
  });

  const assumptionsCard = createCard({
    title: "Assumptions & constraints",
    description: "Budget, volunteer capacity, turf limits, blackout windows, and non-negotiables."
  });

  const optionsCard = createCard({
    title: "Option design",
    description: "Alternative paths, option linkage, and tactic tagging for each option."
  });

  const diagnosticsCard = createCard({
    title: "Decision diagnostics",
    description: "Drift, risk, bottlenecks, sensitivity snapshot, and confidence framing."
  });

  const recommendationCard = createCard({
    title: "Recommendation output",
    description: "Selected recommendation, required truths, and client-ready summary export."
  });

  const summaryCard = createCard({
    title: "Decision summary",
    description: "Current decision posture at a glance."
  });

  const sessionBody = getCardBody(sessionCard);
  mountDecisionRowline(sessionBody, "v3-decision-active-row", "#decisionActiveLabel");
  mountDecisionRow(sessionBody, "v3-decision-session-row", "#decisionSessionSelect");
  mountDecisionRow(sessionBody, "v3-decision-rename-row", "#decisionRename");
  mountDecisionRow(sessionBody, "v3-decision-objective-row", "#decisionObjective");
  mountDecisionRow(sessionBody, "v3-decision-notes-row", "#decisionNotes");

  const assumptionsBody = getCardBody(assumptionsCard);
  mountDecisionRow(assumptionsBody, "v3-decision-budget-row", "#decisionBudget");
  mountDecisionRow(assumptionsBody, "v3-decision-turf-row", "#decisionTurfAccess");
  mountDecisionRow(assumptionsBody, "v3-decision-risk-posture-row", "#decisionRiskPosture");
  mountDecisionRow(assumptionsBody, "v3-decision-non-negotiables-row", "#decisionNonNegotiables");

  const optionsBody = getCardBody(optionsCard);
  mountDecisionRow(optionsBody, "v3-decision-option-select-row", "#decisionOptionSelect");
  mountDecisionRow(optionsBody, "v3-decision-option-rename-row", "#decisionOptionRename");
  mountDecisionRow(optionsBody, "v3-decision-option-scenario-row", "#decisionOptionScenarioLabel");
  mountDecisionRow(optionsBody, "v3-decision-option-tactics-row", "#decisionOptionTacticDoors");

  const diagnosticsBody = getCardBody(diagnosticsCard);
  mountDecisionRow(diagnosticsBody, "v3-decision-drift-tag-row", "#driftStatusTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-drift-kpis-row", "#driftReq");
  mountDecisionRow(diagnosticsBody, "v3-decision-drift-banner-row", "#driftSlipBanner");
  mountDecisionRow(diagnosticsBody, "v3-decision-risk-tag-row", "#riskBandTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-risk-kpis-row", "#riskWinProb");
  mountDecisionRow(diagnosticsBody, "v3-decision-risk-banner-row", "#riskPlainBanner");
  mountDecisionRow(diagnosticsBody, "v3-decision-bneck-tag-row", "#bneckTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-bneck-kpis-row", "#bneckPrimary");
  mountDecisionRow(diagnosticsBody, "v3-decision-bneck-table-row", "#bneckTbody");
  mountDecisionRow(diagnosticsBody, "v3-decision-sens-tag-row", "#sensTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-sens-table-row", "#sensTbody");
  mountDecisionRow(diagnosticsBody, "v3-decision-conf-tag-row", "#confTag");
  mountDecisionRow(diagnosticsBody, "v3-decision-conf-kpis-row", "#confExec");
  mountDecisionRow(diagnosticsBody, "v3-decision-conf-banner-row", "#confBanner");

  const recommendationBody = getCardBody(recommendationCard);
  mountDecisionRow(recommendationBody, "v3-decision-recommend-row", "#decisionRecommendSelect");
  mountDecisionRow(recommendationBody, "v3-decision-what-true-row", "#decisionWhatTrue");
  mountDecisionRow(recommendationBody, "v3-decision-summary-preview-row", "#decisionSummaryPreview");
  mountDecisionRow(recommendationBody, "v3-decision-copy-row", "#decisionCopyStatus");

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Active session</span><strong id="v3DecisionActiveSession">-</strong></div>
      <div class="fpe-summary-row"><span>Linked scenario</span><strong id="v3DecisionScenario">-</strong></div>
      <div class="fpe-summary-row"><span>Objective</span><strong id="v3DecisionObjective">-</strong></div>
      <div class="fpe-summary-row"><span>Selected option</span><strong id="v3DecisionOption">-</strong></div>
      <div class="fpe-summary-row"><span>Recommended option</span><strong id="v3DecisionRecommended">-</strong></div>
      <div class="fpe-summary-row"><span>Confidence tag</span><strong id="v3DecisionConfidence">-</strong></div>
      <div class="fpe-summary-row"><span>Risk tag</span><strong id="v3DecisionRisk">-</strong></div>
      <div class="fpe-summary-row"><span>Bottleneck tag</span><strong id="v3DecisionBottleneck">-</strong></div>
    </div>
  `;

  left.append(sessionCard, assumptionsCard, optionsCard);
  right.append(diagnosticsCard, recommendationCard, summaryCard);
  frame.append(left, right);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Decision logs turn model output into explicit operating choices with traceable rationale.",
      "Constraints, options, and recommendation should be reviewed together to prevent hidden tradeoffs.",
      "The confidence framing helps teams calibrate execution risk before commitment."
    ])
  );

  return refreshDecisionSummary;
}

function mountDecisionRow(target, key, childSelector) {
  mountLegacyClosest({
    key,
    childSelector,
    closestSelector: ".scm-row",
    target
  });
}

function mountDecisionRowline(target, key, childSelector) {
  mountLegacyClosest({
    key,
    childSelector,
    closestSelector: ".rowline",
    target
  });
}

function refreshDecisionSummary() {
  setText("v3DecisionActiveSession", readText("#decisionActiveLabel"));
  setText("v3DecisionScenario", readText("#decisionScenarioLabel"));
  setText("v3DecisionObjective", readSelectedLabel("#decisionObjective"));
  setText("v3DecisionOption", readSelectedLabel("#decisionOptionSelect"));
  setText("v3DecisionRecommended", readSelectedLabel("#decisionRecommendSelect"));
  setText("v3DecisionConfidence", readText("#confTag"));
  setText("v3DecisionRisk", readText("#riskBandTag"));
  setText("v3DecisionBottleneck", readText("#bneckTag"));
}
