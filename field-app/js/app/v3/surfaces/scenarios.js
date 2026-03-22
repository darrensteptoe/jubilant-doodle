import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { setText } from "../surfaceUtils.js";
import {
  SCENARIO_ACTIVE_LABEL_FALLBACK,
  buildScenarioComparisonView,
  SCENARIO_STATUS_AWAITING_SCENARIO,
  SCENARIO_COMPARE_MODE_DISABLED_TEXT,
  SCENARIO_STORAGE_STATUS_SESSION_ONLY,
  SCENARIO_STATUS_UNAVAILABLE,
  classifyScenarioStatusTone,
  deriveScenarioCompareCardStatus,
  deriveScenarioNotesCardStatus,
  deriveScenarioSummaryCardStatus,
  deriveScenarioWorkspaceCardStatus,
} from "../../../core/scenarioView.js";

const SCENARIO_API_KEY = "__FPE_SCENARIO_API__";

export function renderScenariosSurface(mount) {
  const frame = createSurfaceFrame("two-col-balanced");
  const left = createColumn("workspace");
  const right = createColumn("comparison");

  const workspaceCard = createCard({
    title: "Scenario list & actions",
    description: "Create, clone, load, return, and delete scenarios.",
    status: "Baseline ready"
  });

  const compareCard = createCard({
    title: "Compare actions & differences",
    description: "Baseline versus active scenario differences in inputs and outputs.",
    status: "No compare"
  });

  const guidanceCard = createCard({
    title: "Scenario notes",
    description: "Operational guidance and dynamic warnings for scenario management.",
    status: "Storage ready"
  });

  const summaryCard = createCard({
    title: "Current scenario detail",
    description: "Quick readout of active scenario state and diff volume.",
    status: "Baseline"
  });

  assignCardStatusId(workspaceCard, "v3ScenarioWorkspaceCardStatus");
  assignCardStatusId(compareCard, "v3ScenarioCompareCardStatus");
  assignCardStatusId(guidanceCard, "v3ScenarioNotesCardStatus");
  assignCardStatusId(summaryCard, "v3ScenarioSummaryCardStatus");

  getCardBody(workspaceCard).innerHTML = `
    <div id="v3ScenarioBridgeRoot">
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Active scenario</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioActiveLabel">-</div>
      </div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3ScenarioSelect">Scenarios</label>
          <select class="fpe-input" id="v3ScenarioSelect"></select>
        </div>
        <div class="field">
          <label class="fpe-control-label" for="v3ScenarioNewName">New scenario name</label>
          <input class="fpe-input" id="v3ScenarioNewName" placeholder="e.g., Path A - full GOTV" type="text"/>
        </div>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnScenarioSaveNew" type="button">Save as new scenario</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnScenarioCloneBaseline" type="button">Clone baseline</button>
      </div>
      <div class="fpe-action-row">
        <button class="fpe-btn" id="v3BtnScenarioLoadSelected" type="button">Load selected</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnScenarioReturnBaseline" type="button">Return to baseline</button>
        <button class="fpe-btn fpe-btn--ghost" id="v3BtnScenarioDelete" type="button">Delete scenario</button>
      </div>
    </div>
  `;

  getCardBody(compareCard).innerHTML = `
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Scenario comparison</div>
      <div class="fpe-help fpe-help--flush" id="v3ScenarioCompareModeText">
        ${SCENARIO_COMPARE_MODE_DISABLED_TEXT}
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Compare tag</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioCompareTagView">—</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Output rows</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioCompareOutputRows">0</div>
      </div>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Input differences</div>
        <ul class="bullets" id="v3ScenarioDiffInputs">
          <li>No input differences.</li>
        </ul>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioDiffInputsFoot"></div>
      </div>
      <div class="fpe-contained-block">
        <div class="fpe-control-label">Output differences</div>
        <div class="table-wrap">
          <table class="table" aria-label="Scenario output differences">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Baseline</th>
                <th>Scenario</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody id="v3ScenarioDiffOutputs">
              <tr>
                <td class="muted" colspan="4">No output differences.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const guidanceBody = getCardBody(guidanceCard);
  guidanceBody.innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Keep baseline as a stable reference and branch alternatives as named scenarios.</li>
        <li>Use compare mode to isolate exactly which assumptions or outputs changed.</li>
        <li>Log decision rationale against explicit scenario IDs, not ad-hoc edits.</li>
      </ul>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Warning status</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioLegacyWarn">No warnings.</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Storage status</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioLegacyStorageNote">Scenario storage ready.</div>
      </div>
    </div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Active scenario</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioActive">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Compare mode</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioCompareMode">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Compare tag</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioCompareTag">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Input differences</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioInputDiffCount">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Output differences</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioOutputDiffCount">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Warning status</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioWarningStatus">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Storage status</div>
        <div class="fpe-help fpe-help--flush" id="v3ScenarioStorageStatus">-</div>
      </div>
    </div>
  `;

  left.append(summaryCard, workspaceCard);
  right.append(compareCard, guidanceCard);
  frame.append(left, right);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Scenarios preserve alternate assumptions without overwriting baseline work.",
      "Comparison should focus on feasibility, risk, and resource tradeoffs.",
      "Decision sessions should reference explicit scenario IDs rather than ad-hoc snapshots."
    ])
  );

  wireScenariosEvents();
  return refreshScenariosSummary;
}

function refreshScenariosSummary() {
  const api = getScenarioApi();
  if (!api) {
    renderScenariosUnavailable();
    return;
  }

  const payload = api.getView?.();
  const view = payload && typeof payload === "object" ? payload : null;
  if (!view) {
    renderScenariosUnavailable();
    return;
  }

  syncScenarioSelect(view);
  syncActionStates(view);

  const comparison = buildScenarioComparisonView(view);
  renderScenarioDiffInputs(comparison.inputDiffs);
  renderScenarioDiffOutputs(comparison.outputDiffs);

  setText("v3ScenarioActiveLabel", view.activeLabel || SCENARIO_ACTIVE_LABEL_FALLBACK);
  setText("v3ScenarioActive", view.activeLabel || SCENARIO_ACTIVE_LABEL_FALLBACK);
  setText("v3ScenarioCompareMode", comparison.modeText);
  setText("v3ScenarioCompareModeText", comparison.modeText);
  setText("v3ScenarioCompareTag", comparison.tag);
  setText("v3ScenarioCompareTagView", comparison.tag);
  setText("v3ScenarioInputDiffCount", String(comparison.inputDiffCount));
  setText("v3ScenarioOutputDiffCount", String(comparison.outputDiffCount));
  setText("v3ScenarioCompareOutputRows", String(comparison.outputDiffCount));
  setText("v3ScenarioDiffInputsFoot", comparison.inputDiffFoot);

  const warning = view.warning || "No warnings.";
  const storage = view.storageStatus || SCENARIO_STORAGE_STATUS_SESSION_ONLY;
  setText("v3ScenarioWarningStatus", warning);
  setText("v3ScenarioStorageStatus", storage);
  setText("v3ScenarioLegacyWarn", warning);
  setText("v3ScenarioLegacyStorageNote", storage);

  syncScenarioCardStatus(
    "v3ScenarioWorkspaceCardStatus",
    deriveScenarioWorkspaceCardStatus(view)
  );
  syncScenarioCardStatus(
    "v3ScenarioCompareCardStatus",
    deriveScenarioCompareCardStatus(comparison)
  );
  syncScenarioCardStatus(
    "v3ScenarioNotesCardStatus",
    deriveScenarioNotesCardStatus(warning, storage)
  );
  syncScenarioCardStatus(
    "v3ScenarioSummaryCardStatus",
    deriveScenarioSummaryCardStatus(view, comparison)
  );
}

function wireScenariosEvents() {
  const root = document.getElementById("v3ScenarioBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  const selectEl = document.getElementById("v3ScenarioSelect");
  const inputEl = document.getElementById("v3ScenarioNewName");
  const btnSave = document.getElementById("v3BtnScenarioSaveNew");
  const btnClone = document.getElementById("v3BtnScenarioCloneBaseline");
  const btnLoad = document.getElementById("v3BtnScenarioLoadSelected");
  const btnReturn = document.getElementById("v3BtnScenarioReturnBaseline");
  const btnDelete = document.getElementById("v3BtnScenarioDelete");

  selectEl?.addEventListener("change", () => {
    const api = getScenarioApi();
    if (api?.selectScenario) {
      api.selectScenario(selectEl.value);
      refreshScenariosSummary();
    }
  });

  btnSave?.addEventListener("click", () => {
    const api = getScenarioApi();
    if (api?.saveNew) {
      const result = api.saveNew(inputEl instanceof HTMLInputElement ? inputEl.value : "");
      if (result?.ok && inputEl instanceof HTMLInputElement) {
        inputEl.value = "";
      }
      refreshScenariosSummary();
    }
  });

  btnClone?.addEventListener("click", () => {
    const api = getScenarioApi();
    if (api?.cloneBaseline) {
      const result = api.cloneBaseline(inputEl instanceof HTMLInputElement ? inputEl.value : "");
      if (result?.ok && inputEl instanceof HTMLInputElement) {
        inputEl.value = "";
      }
      refreshScenariosSummary();
    }
  });

  btnLoad?.addEventListener("click", () => {
    const view = getScenarioApi()?.getView?.();
    const selected = getSelectedScenario(view);
    const name = selected?.name || selected?.id || "scenario";
    if (!window.confirm(`Load scenario "${name}"? This will replace current inputs.`)) {
      return;
    }
    getScenarioApi()?.loadSelected?.();
    refreshScenariosSummary();
  });

  btnReturn?.addEventListener("click", () => {
    if (!window.confirm("Return to baseline? This will replace current inputs.")) {
      return;
    }
    getScenarioApi()?.returnBaseline?.();
    refreshScenariosSummary();
  });

  btnDelete?.addEventListener("click", () => {
    const view = getScenarioApi()?.getView?.();
    const selected = getSelectedScenario(view);
    const name = selected?.name || selected?.id || "this scenario";
    if (!window.confirm(`Delete "${name}"?`)) {
      return;
    }
    getScenarioApi()?.deleteSelected?.();
    refreshScenariosSummary();
  });
}

function getScenarioApi() {
  return window[SCENARIO_API_KEY] || null;
}

function getSelectedScenario(view) {
  const selectedId = String(view?.selectedScenarioId || "");
  const list = Array.isArray(view?.scenarios) ? view.scenarios : [];
  return list.find((row) => String(row?.id || "") === selectedId) || null;
}

function syncScenarioSelect(view) {
  const selectEl = document.getElementById("v3ScenarioSelect");
  if (!(selectEl instanceof HTMLSelectElement)) {
    return;
  }

  const list = Array.isArray(view?.scenarios) ? view.scenarios : [];
  const selectedId = String(view?.selectedScenarioId || view?.activeScenarioId || "");
  const currentSig = Array.from(selectEl.options).map((opt) => `${opt.value}::${opt.textContent}`).join("|");
  const nextSig = list.map((row) => `${row.id}::${row.name || row.id}`).join("|");
  if (currentSig !== nextSig) {
    selectEl.innerHTML = "";
    list.forEach((row) => {
      const opt = document.createElement("option");
      opt.value = row.id;
      opt.textContent = row.name || row.id;
      selectEl.appendChild(opt);
    });
  }
  if (document.activeElement !== selectEl) {
    selectEl.value = selectedId;
  }
}

function syncActionStates(view) {
  const selectedId = String(view?.selectedScenarioId || "");
  const activeId = String(view?.activeScenarioId || "");
  const baselineId = String(view?.baselineId || "baseline");
  const scenarios = Array.isArray(view?.scenarios) ? view.scenarios : [];
  const hasSelected = scenarios.some((row) => String(row?.id || "") === selectedId);

  const loadBtn = document.getElementById("v3BtnScenarioLoadSelected");
  const delBtn = document.getElementById("v3BtnScenarioDelete");
  const retBtn = document.getElementById("v3BtnScenarioReturnBaseline");

  if (loadBtn instanceof HTMLButtonElement) {
    loadBtn.disabled = !hasSelected || selectedId === activeId;
  }
  if (delBtn instanceof HTMLButtonElement) {
    delBtn.disabled = !hasSelected || selectedId === baselineId;
  }
  if (retBtn instanceof HTMLButtonElement) {
    retBtn.disabled = activeId === baselineId;
  }
}

function renderScenarioDiffInputs(items) {
  const list = document.getElementById("v3ScenarioDiffInputs");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No input differences.";
    list.appendChild(li);
    return;
  }

  items.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    list.appendChild(li);
  });
}

function renderScenarioDiffOutputs(rows) {
  const body = document.getElementById("v3ScenarioDiffOutputs");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "muted";
    td.colSpan = 4;
    td.textContent = "No output differences.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const metric = document.createElement("td");
    metric.textContent = row.metric;
    const baseline = document.createElement("td");
    baseline.textContent = row.baseline;
    const scenario = document.createElement("td");
    scenario.textContent = row.scenario;
    const delta = document.createElement("td");
    delta.className = "num";
    delta.textContent = row.delta;
    tr.append(metric, baseline, scenario, delta);
    body.appendChild(tr);
  });
}

function renderScenariosUnavailable() {
  setText("v3ScenarioWarningStatus", "Scenario runtime bridge unavailable.");
  setText("v3ScenarioLegacyWarn", "Scenario runtime bridge unavailable.");
  setText("v3ScenarioStorageStatus", "Scenario storage unavailable.");
  setText("v3ScenarioLegacyStorageNote", "Scenario storage unavailable.");
  syncScenarioCardStatus("v3ScenarioWorkspaceCardStatus", SCENARIO_STATUS_UNAVAILABLE);
  syncScenarioCardStatus("v3ScenarioCompareCardStatus", SCENARIO_STATUS_UNAVAILABLE);
  syncScenarioCardStatus("v3ScenarioNotesCardStatus", SCENARIO_STATUS_UNAVAILABLE);
  syncScenarioCardStatus("v3ScenarioSummaryCardStatus", SCENARIO_STATUS_UNAVAILABLE);
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

function syncScenarioCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || SCENARIO_STATUS_AWAITING_SCENARIO;
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyScenarioStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
}
