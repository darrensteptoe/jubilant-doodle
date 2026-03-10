import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyNode } from "../compat.js";
import { readText, setText } from "../surfaceUtils.js";

export function renderScenariosSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const statusCard = createCard({
    title: "Scenario status",
    description: "Current scenario context, warnings, and storage behavior."
  });

  const workspaceCard = createCard({
    title: "Scenario workspace",
    description: "Create, clone, load, return, and delete scenarios."
  });

  const compareCard = createCard({
    title: "Scenario comparison",
    description: "Baseline versus active scenario differences in inputs and outputs."
  });

  const summaryCard = createCard({
    title: "Comparison summary",
    description: "Quick readout of active scenario state and diff volume."
  });

  const statusBody = getCardBody(statusCard);
  mountLegacyNode({
    key: "v3-scenarios-help",
    selector: "#scenarioCompareCard .help-text",
    target: statusBody
  });
  mountLegacyNode({
    key: "v3-scenarios-warning",
    selector: "#scWarn",
    target: statusBody
  });
  mountLegacyNode({
    key: "v3-scenarios-storage-note",
    selector: "#scenarioCompareCard > .note:last-of-type",
    target: statusBody
  });

  mountLegacyNode({
    key: "v3-scenarios-workspace",
    selector: "#scenarioCompareCard .scm",
    target: getCardBody(workspaceCard)
  });

  mountLegacyNode({
    key: "v3-scenarios-compare-wrap",
    selector: "#scmCompareWrap",
    target: getCardBody(compareCard)
  });

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Active scenario</span><strong id="v3ScenarioActive">-</strong></div>
      <div class="fpe-summary-row"><span>Compare mode</span><strong id="v3ScenarioCompareMode">-</strong></div>
      <div class="fpe-summary-row"><span>Compare tag</span><strong id="v3ScenarioCompareTag">-</strong></div>
      <div class="fpe-summary-row"><span>Input differences</span><strong id="v3ScenarioInputDiffCount">-</strong></div>
      <div class="fpe-summary-row"><span>Output differences</span><strong id="v3ScenarioOutputDiffCount">-</strong></div>
    </div>
  `;

  left.append(statusCard, workspaceCard);
  right.append(compareCard, summaryCard);
  frame.append(left, right);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Scenarios preserve alternate assumptions without overwriting baseline work.",
      "Comparison should focus on feasibility, risk, and resource tradeoffs.",
      "Decision sessions should reference explicit scenario IDs rather than ad-hoc snapshots."
    ])
  );

  return refreshScenariosSummary;
}

function refreshScenariosSummary() {
  const compareGrid = document.getElementById("scmCompareGrid");
  const compareEmpty = document.getElementById("scmCompareEmpty");
  const inputDiffCount = document.querySelectorAll("#scmDiffInputs li").length;
  const outputRows = document.querySelectorAll("#scmDiffOutputs tr");

  setText("v3ScenarioActive", readText("#activeScenarioLabel"));
  setText(
    "v3ScenarioCompareMode",
    compareGrid && !compareGrid.hidden ? "Comparing active scenario" : readText("#scmCompareEmpty") || "-"
  );
  setText("v3ScenarioCompareTag", readText("#scmCompareTag"));
  setText("v3ScenarioInputDiffCount", inputDiffCount ? String(inputDiffCount) : "0");
  setText("v3ScenarioOutputDiffCount", outputRows.length ? String(outputRows.length) : "0");

  if (compareEmpty && compareGrid && compareGrid.hidden) {
    setText("v3ScenarioCompareMode", (compareEmpty.textContent || "").trim());
  }
}
