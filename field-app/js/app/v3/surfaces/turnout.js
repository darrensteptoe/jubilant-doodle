import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyCardFromChild } from "../compat.js";
import { readTurnoutSnapshot } from "../stateBridge.js";

export function renderTurnoutSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const assumptionsCard = createCard({
    title: "Turnout assumptions",
    description: "Baseline turnout, lift behavior, and diminishing-return controls."
  });

  const efficiencyCard = createCard({
    title: "Efficiency",
    description: "Cost-per-net-vote and tactic comparison under current assumptions."
  });

  const costInputsCard = createCard({
    title: "Cost model inputs",
    description: "Per-attempt costs, tactic settings, and overhead behavior."
  });

  const summaryCard = createCard({
    title: "Turnout summary",
    description: "Current turnout context and vote-impact readout."
  });

  mountLegacyCardFromChild({
    key: "v3-turnout-assumptions",
    childSelector: "#turnoutEnabled",
    target: getCardBody(assumptionsCard)
  });

  mountLegacyCardFromChild({
    key: "v3-turnout-efficiency",
    childSelector: "#roiTbody",
    target: getCardBody(efficiencyCard)
  });

  mountLegacyCardFromChild({
    key: "v3-turnout-cost-inputs",
    childSelector: "#roiDoorsEnabled",
    target: getCardBody(costInputsCard)
  });

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Turnout summary</span><strong id="v3TurnoutSummary">-</strong></div>
      <div class="fpe-summary-row"><span>Expected turnout votes</span><strong id="v3TurnoutVotes">-</strong></div>
      <div class="fpe-summary-row"><span>Persuasion votes needed</span><strong id="v3TurnoutNeedVotes">-</strong></div>
    </div>
  `;

  left.append(assumptionsCard, efficiencyCard);
  right.append(costInputsCard, summaryCard);

  frame.append(left, right);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Turnout mechanics are distinct from persuasion assumptions and should be tuned separately.",
      "Efficiency comparisons help prevent over-investment in low-yield tactics.",
      "Use this page to test lift realism before finalizing execution workload."
    ])
  );

  return refreshTurnoutSummary;
}

function refreshTurnoutSummary() {
  const snapshot = readTurnoutSnapshot();
  setText("v3TurnoutSummary", snapshot.turnoutSummary || "-");
  setText("v3TurnoutVotes", snapshot.turnoutVotes || "-");
  setText("v3TurnoutNeedVotes", snapshot.needVotes || "-");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}
