import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyNode } from "../compat.js";
import {
  bindClickProxy,
  getLegacyEl,
  readText,
  setText,
  syncButtonDisabled,
  syncSelectOptions
} from "../surfaceUtils.js";

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

  getCardBody(workspaceCard).innerHTML = `
    <div id="v3ScenarioBridgeRoot">
      <div class="fpe-help" id="v3ScenarioActiveLabel">Active scenario: -</div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3ScenarioSelect">Scenarios</label>
          <select class="fpe-input" id="v3ScenarioSelect"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3ScenarioNewName">New scenario</label>
          <input class="fpe-input" id="v3ScenarioNewName" placeholder="e.g., Path A - full GOTV" type="text"/>
        </div>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnScenarioSaveNew" type="button">Save as new scenario</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnScenarioCloneBaseline" type="button">Clone baseline</button>
        <button class="fpe-btn" id="v3BtnScenarioLoadSelected" type="button">Load selected</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnScenarioReturnBaseline" type="button">Return to baseline</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnScenarioDelete" type="button">Delete scenario</button>
      </div>
    </div>
  `;

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

  wireScenariosBridge();
  return refreshScenariosSummary;
}

function refreshScenariosSummary() {
  syncScenariosBridgeUi();

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

function wireScenariosBridge() {
  const root = document.getElementById("v3ScenarioBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  const select = document.getElementById("v3ScenarioSelect");
  select?.addEventListener("change", () => {
    const legacy = getLegacyEl("scenarioSelect");
    if (!(legacy instanceof HTMLSelectElement)) {
      return;
    }
    legacy.value = select.value;
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const newName = document.getElementById("v3ScenarioNewName");
  newName?.addEventListener("input", () => {
    const legacy = getLegacyEl("scenarioNewName");
    if (!(legacy instanceof HTMLInputElement)) {
      return;
    }
    legacy.value = newName.value;
    legacy.dispatchEvent(new Event("input", { bubbles: true }));
  });

  bindClickProxy("v3BtnScenarioSaveNew", "btnScenarioSaveNew");
  bindClickProxy("v3BtnScenarioCloneBaseline", "btnScenarioCloneBaseline");
  bindClickProxy("v3BtnScenarioLoadSelected", "btnScenarioLoadSelected");
  bindClickProxy("v3BtnScenarioReturnBaseline", "btnScenarioReturnBaseline");
  bindClickProxy("v3BtnScenarioDelete", "btnScenarioDelete");
}

function syncScenariosBridgeUi() {
  const legacySelect = getLegacyEl("scenarioSelect");
  const legacyName = getLegacyEl("scenarioNewName");
  const legacyActive = getLegacyEl("activeScenarioLabel");

  const v3Select = document.getElementById("v3ScenarioSelect");
  if (v3Select instanceof HTMLSelectElement && legacySelect instanceof HTMLSelectElement) {
    syncSelectOptions(v3Select, legacySelect);
    v3Select.value = legacySelect.value;
  }

  const v3Name = document.getElementById("v3ScenarioNewName");
  if (v3Name instanceof HTMLInputElement && legacyName instanceof HTMLInputElement) {
    v3Name.value = legacyName.value;
  }

  setText("v3ScenarioActiveLabel", legacyActive ? (legacyActive.textContent || "").trim() : "");

  syncButtonDisabled("v3BtnScenarioSaveNew", "btnScenarioSaveNew");
  syncButtonDisabled("v3BtnScenarioCloneBaseline", "btnScenarioCloneBaseline");
  syncButtonDisabled("v3BtnScenarioLoadSelected", "btnScenarioLoadSelected");
  syncButtonDisabled("v3BtnScenarioReturnBaseline", "btnScenarioReturnBaseline");
  syncButtonDisabled("v3BtnScenarioDelete", "btnScenarioDelete");
}
