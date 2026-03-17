import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { setText } from "../surfaceUtils.js";

const SCENARIO_API_KEY = "__FPE_SCENARIO_API__";
const OUTPUT_DIFF_LIMIT = 24;
const INPUT_DIFF_LIMIT = 12;
const FLATTEN_LIMIT = 1200;

export function renderScenariosSurface(mount) {
  const frame = createSurfaceFrame("two-col");
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
        Select a non-baseline active scenario to view differences.
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

  left.append(workspaceCard, summaryCard);
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

  const comparison = buildScenarioComparison(view);
  renderScenarioDiffInputs(comparison.inputDiffs);
  renderScenarioDiffOutputs(comparison.outputDiffs);

  setText("v3ScenarioActiveLabel", view.activeLabel || "Active Scenario: —");
  setText("v3ScenarioActive", view.activeLabel || "Active Scenario: —");
  setText("v3ScenarioCompareMode", comparison.modeText);
  setText("v3ScenarioCompareModeText", comparison.modeText);
  setText("v3ScenarioCompareTag", comparison.tag);
  setText("v3ScenarioCompareTagView", comparison.tag);
  setText("v3ScenarioInputDiffCount", String(comparison.inputDiffCount));
  setText("v3ScenarioOutputDiffCount", String(comparison.outputDiffCount));
  setText("v3ScenarioCompareOutputRows", String(comparison.outputDiffCount));
  setText("v3ScenarioDiffInputsFoot", comparison.inputDiffFoot);

  const warning = view.warning || "No warnings.";
  const storage = view.storageStatus || "Scenario storage ready.";
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

function buildScenarioComparison(view) {
  const baseline = view?.baseline || null;
  const active = view?.active || null;
  const baselineId = String(view?.baselineId || "baseline");
  const compareEnabled = !!baseline && !!active && String(active.id || "") !== baselineId;

  if (!compareEnabled) {
    return {
      modeText: "Select a non-baseline active scenario to view differences.",
      tag: "—",
      inputDiffCount: 0,
      outputDiffCount: 0,
      inputDiffs: [],
      outputDiffs: [],
      inputDiffFoot: ""
    };
  }

  const inputDiffs = computeFlatDiffRows(baseline.inputs, active.inputs);
  const outputDiffs = computeFlatDiffRows(baseline.outputs, active.outputs);
  const outputRows = outputDiffs
    .sort((a, b) => b.sortScore - a.sortScore)
    .slice(0, OUTPUT_DIFF_LIMIT)
    .map((row) => ({
      metric: row.metric,
      baseline: row.beforeText,
      scenario: row.afterText,
      delta: row.deltaText
    }));

  return {
    modeText: "Comparing active scenario",
    tag: `${baseline.name || baseline.id} vs ${active.name || active.id}`,
    inputDiffCount: inputDiffs.length,
    outputDiffCount: outputRows.length,
    inputDiffs: inputDiffs.slice(0, INPUT_DIFF_LIMIT).map((row) => row.text),
    outputDiffs: outputRows,
    inputDiffFoot:
      inputDiffs.length > INPUT_DIFF_LIMIT
        ? `${inputDiffs.length} fields differ (${INPUT_DIFF_LIMIT} shown).`
        : `${inputDiffs.length} fields differ.`
  };
}

function computeFlatDiffRows(beforeObj, afterObj) {
  const before = flattenObject(beforeObj);
  const after = flattenObject(afterObj);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const rows = [];

  keys.forEach((key) => {
    const a = before[key];
    const b = after[key];
    if (areValuesEqual(a, b)) {
      return;
    }

    const beforeText = formatValue(a);
    const afterText = formatValue(b);
    const delta = typeof a === "number" && typeof b === "number" ? b - a : NaN;
    const deltaText = Number.isFinite(delta) ? formatDelta(delta) : "—";

    rows.push({
      metric: formatMetricKey(key),
      text: `${formatMetricKey(key)}: ${beforeText} -> ${afterText}`,
      beforeText,
      afterText,
      deltaText,
      sortScore: Number.isFinite(delta) ? Math.abs(delta) : 0
    });
  });

  return rows;
}

function flattenObject(value, prefix = "", out = {}, count = { n: 0 }) {
  if (count.n > FLATTEN_LIMIT) {
    return out;
  }

  const pushLeaf = (leaf) => {
    out[prefix || "(root)"] = leaf;
    count.n += 1;
  };

  if (value === null || value === undefined) {
    pushLeaf(value);
    return out;
  }

  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    pushLeaf(value);
    return out;
  }

  if (Array.isArray(value)) {
    pushLeaf(`[${value.length} items]`);
    return out;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    if (!keys.length) {
      pushLeaf("{}");
      return out;
    }

    keys.forEach((key) => {
      if (count.n > FLATTEN_LIMIT) {
        return;
      }
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObject(value[key], nextPrefix, out, count);
    });
    return out;
  }

  pushLeaf(String(value));
  return out;
}

function areValuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatMetricKey(key) {
  return String(key || "metric")
    .replaceAll(".", " / ")
    .replaceAll("_", " ");
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "—";
    }
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
}

function formatDelta(delta) {
  if (!Number.isFinite(delta)) {
    return "—";
  }
  const sign = delta > 0 ? "+" : "";
  if (Math.abs(delta) >= 1000) {
    return `${sign}${delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${sign}${delta.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
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
  syncScenarioCardStatus("v3ScenarioWorkspaceCardStatus", "Unavailable");
  syncScenarioCardStatus("v3ScenarioCompareCardStatus", "Unavailable");
  syncScenarioCardStatus("v3ScenarioNotesCardStatus", "Unavailable");
  syncScenarioCardStatus("v3ScenarioSummaryCardStatus", "Unavailable");
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
  const text = String(value || "").trim() || "Awaiting scenario";
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

function deriveScenarioWorkspaceCardStatus(view) {
  const scenarios = Array.isArray(view?.scenarios) ? view.scenarios : [];
  const activeId = String(view?.activeScenarioId || view?.baselineId || "");
  const baselineId = String(view?.baselineId || "baseline");
  if (!scenarios.length) {
    return "Unavailable";
  }
  if (activeId && activeId !== baselineId) {
    return "Scenario active";
  }
  return "Baseline ready";
}

function deriveScenarioCompareCardStatus(comparison) {
  const count = Number(comparison?.outputDiffCount || 0);
  if (!comparison || comparison.modeText === "Select a non-baseline active scenario to view differences.") {
    return "No compare";
  }
  if (count > 0) {
    return "Diffs ready";
  }
  return "Compared";
}

function deriveScenarioNotesCardStatus(warning, storage) {
  const warningText = String(warning || "").toLowerCase();
  const storageText = String(storage || "").toLowerCase();
  if (warningText.includes("unavailable") || storageText.includes("unavailable")) {
    return "Unavailable";
  }
  if (!warningText || warningText === "no warnings.") {
    return "Storage ready";
  }
  if (warningText.includes("warning") || warningText.includes("diff") || warningText.includes("delete")) {
    return "Watchlist";
  }
  return "Storage ready";
}

function deriveScenarioSummaryCardStatus(view, comparison) {
  const activeId = String(view?.activeScenarioId || view?.baselineId || "");
  const baselineId = String(view?.baselineId || "baseline");
  if (!view) {
    return "Unavailable";
  }
  if (activeId && activeId !== baselineId) {
    return Number(comparison?.inputDiffCount || 0) > 0 ? "Delta tracked" : "Scenario active";
  }
  return "Baseline";
}

function classifyScenarioStatusTone(text) {
  const lower = String(text || "").trim().toLowerCase();
  if (!lower) {
    return "neutral";
  }
  if (/(baseline ready|storage ready|compared|baseline)/.test(lower)) {
    return "ok";
  }
  if (/(unavailable)/.test(lower)) {
    return "bad";
  }
  if (/(scenario active|diffs ready|watchlist|delta tracked|no compare|awaiting)/.test(lower)) {
    return "warn";
  }
  return "neutral";
}
