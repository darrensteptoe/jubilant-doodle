import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody,
  setCardHeaderControl
} from "../componentFactory.js";
import { setText } from "../surfaceUtils.js";

const DATA_API_KEY = "__FPE_DATA_API__";
const DATA_ACTIONS = {
  saveJson: "save_json",
  loadJson: "load_json",
  copySummary: "copy_summary",
  exportCsv: "export_csv",
  usbConnect: "usb_connect",
  usbLoad: "usb_load",
  usbSave: "usb_save",
  usbDisconnect: "usb_disconnect",
};

export function renderDataSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const policyCol = createColumn("policy");
  const exchangeCol = createColumn("exchange");
  const infraCol = createColumn("infra");

  const policyCard = createCard({
    title: "Policy & restore",
    description: "Strict import mode, integrity warnings, and local backup restore controls."
  });
  const policyHeaderToggle = document.createElement("div");
  policyHeaderToggle.className = "fpe-header-switch";
  policyHeaderToggle.innerHTML = `
    <span class="fpe-header-switch__label">Strict import policy</span>
    <label class="fpe-switch">
      <input id="v3DataStrictToggle" type="checkbox"/>
      <span>Enable</span>
    </label>
  `;
  setCardHeaderControl(policyCard, policyHeaderToggle);

  const exchangeCard = createCard({
    title: "Import / export",
    description: "JSON/CSV export and summary handoff controls."
  });

  const storageCard = createCard({
    title: "Backups & storage",
    description: "Connect removable storage and manage manual sync operations."
  });

  const summaryCard = createCard({
    title: "Data summary",
    description: "Current policy and storage posture."
  });

  getCardBody(policyCard).innerHTML = `
    <div id="v3DataBridgeRoot">
      <div class="fpe-contained-block">
        <ul class="bullets">
          <li>Use strict mode when import integrity must be enforced for client-safe handoff.</li>
          <li>Restore backup only after confirming scenario and timestamp.</li>
        </ul>
      </div>
      <div class="fpe-alert fpe-alert--warn" id="v3DataHashBannerUi" hidden>Snapshot hash differs from exported hash.</div>
      <div class="fpe-alert fpe-alert--warn" id="v3DataWarnBannerUi" hidden></div>
      <div class="fpe-field-grid fpe-field-grid--1">
        <div class="field">
          <label class="fpe-control-label" for="v3DataRestoreBackup">Restore auto-backup</label>
          <select class="fpe-input" id="v3DataRestoreBackup">
            <option value="">Restore backup…</option>
          </select>
          <div class="fpe-help">Restores saved planner inputs from local browser backups.</div>
        </div>
      </div>
    </div>
  `;

  getCardBody(exchangeCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Use JSON for full scenario interchange and CSV for reporting extracts.</li>
        <li>Copy summary after final QA to avoid stale handoff text.</li>
      </ul>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3DataBtnSaveJson" type="button">Export Scenario JSON</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnLoadJson" type="button">Import Scenario JSON</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnCopySummary" type="button">Copy Summary</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnExportCsv" type="button">Export CSV</button>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Import file status</div>
      <div class="fpe-help fpe-help--flush" id="v3DataImportFileStatus">No import file selected.</div>
    </div>
  `;

  getCardBody(storageCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Use folder connect/load/save for controlled external storage workflows.</li>
        <li>Disconnect when done to avoid accidental writes to prior sessions.</li>
      </ul>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3DataBtnUsbConnect" type="button">Connect folder</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnUsbLoad" type="button">Load from folder</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnUsbSave" type="button">Save to folder now</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnUsbDisconnect" type="button">Disconnect</button>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">USB status</div>
      <div class="fpe-help fpe-help--flush" id="v3DataUsbStatusUi">Using browser storage only.</div>
    </div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Strict import</div>
        <div class="fpe-help fpe-help--flush" id="v3DataStrictImport">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Backup options</div>
        <div class="fpe-help fpe-help--flush" id="v3DataBackupCount">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Import hash banner</div>
        <div class="fpe-help fpe-help--flush" id="v3DataHashBanner">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Import warning banner</div>
        <div class="fpe-help fpe-help--flush" id="v3DataWarnBanner">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">USB storage status</div>
        <div class="fpe-help fpe-help--flush" id="v3DataUsbStatus">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Selected backup</div>
        <div class="fpe-help fpe-help--flush" id="v3DataRestoreSelection">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Import file</div>
        <div class="fpe-help fpe-help--flush" id="v3DataImportFileSummary">-</div>
      </div>
    </div>
  `;

  policyCol.append(policyCard);
  exchangeCol.append(exchangeCard);
  infraCol.append(storageCard, summaryCard);

  frame.append(policyCol, exchangeCol, infraCol);
  mount.append(frame);

  mount.append(
    createWhyPanel([
      "Data operations are infrastructure tasks and should stay isolated from modeling surfaces.",
      "Recovery workflows should be validated before any destructive import/export step.",
      "Policy clarity prevents accidental drift between local, removable, and exported state."
    ])
  );

  wireDataBridge();
  return refreshDataSummary;
}

function refreshDataSummary() {
  syncDataBridgeUi();

  const strictToggle = document.getElementById("v3DataStrictToggle");
  const restoreSelect = document.getElementById("v3DataRestoreBackup");
  const hashBannerUi = document.getElementById("v3DataHashBannerUi");
  const warnBannerUi = document.getElementById("v3DataWarnBannerUi");
  const usbStatusUi = readElText("v3DataUsbStatusUi");
  const importFileStatus = readElText("v3DataImportFileStatus");

  setText(
    "v3DataStrictImport",
    strictToggle instanceof HTMLInputElement && strictToggle.checked ? "ON" : "OFF"
  );
  setText(
    "v3DataBackupCount",
    restoreSelect instanceof HTMLSelectElement
      ? String(Math.max(0, restoreSelect.options.length - 1))
      : "0"
  );
  setText(
    "v3DataHashBanner",
    hashBannerUi instanceof HTMLElement && !hashBannerUi.hidden
      ? (hashBannerUi.textContent || "").trim() || "Visible"
      : "Hidden"
  );
  setText(
    "v3DataWarnBanner",
    warnBannerUi instanceof HTMLElement && !warnBannerUi.hidden
      ? (warnBannerUi.textContent || "").trim() || "Visible"
      : "Hidden"
  );
  setText("v3DataUsbStatus", usbStatusUi || "Using browser storage only.");
  setText(
    "v3DataRestoreSelection",
    readSelectLabel(restoreSelect instanceof HTMLSelectElement ? restoreSelect : null) || "No backup selected."
  );
  setText("v3DataImportFileSummary", importFileStatus || "No import file selected.");
}

function wireDataBridge() {
  const root = document.getElementById("v3DataBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  const strictToggle = document.getElementById("v3DataStrictToggle");
  if (strictToggle instanceof HTMLInputElement) {
    strictToggle.addEventListener("change", () => {
      const api = getDataApi();
      if (!api || typeof api.setStrictImport !== "function") {
        return;
      }
      api.setStrictImport(!!strictToggle.checked);
      refreshDataSummary();
    });
  }

  const restoreSelect = document.getElementById("v3DataRestoreBackup");
  if (restoreSelect instanceof HTMLSelectElement) {
    restoreSelect.addEventListener("change", () => {
      const value = String(restoreSelect.value || "").trim();
      if (!value) {
        return;
      }
      const api = getDataApi();
      if (!api || typeof api.restoreBackup !== "function") {
        return;
      }
      api.restoreBackup(value);
      refreshDataSummary();
    });
  }

  bindDataAction("v3DataBtnSaveJson", DATA_ACTIONS.saveJson);
  bindDataAction("v3DataBtnLoadJson", DATA_ACTIONS.loadJson);
  bindDataAction("v3DataBtnCopySummary", DATA_ACTIONS.copySummary);
  bindDataAction("v3DataBtnExportCsv", DATA_ACTIONS.exportCsv);
  bindDataAction("v3DataBtnUsbConnect", DATA_ACTIONS.usbConnect);
  bindDataAction("v3DataBtnUsbLoad", DATA_ACTIONS.usbLoad);
  bindDataAction("v3DataBtnUsbSave", DATA_ACTIONS.usbSave);
  bindDataAction("v3DataBtnUsbDisconnect", DATA_ACTIONS.usbDisconnect);
}

function bindDataAction(v3Id, action) {
  const btn = document.getElementById(v3Id);
  if (!(btn instanceof HTMLButtonElement)) {
    return;
  }
  btn.addEventListener("click", () => {
    const api = getDataApi();
    if (!api || typeof api.trigger !== "function") {
      return;
    }
    const result = api.trigger(action);
    if (result && typeof result.then === "function") {
      result.finally(() => refreshDataSummary());
      return;
    }
    refreshDataSummary();
  });
}

function syncDataBridgeUi() {
  const api = getDataApi();
  const view = api?.getView?.();
  if (!view || typeof view !== "object") {
    return;
  }

  const strictToggle = document.getElementById("v3DataStrictToggle");
  if (strictToggle instanceof HTMLInputElement) {
    if (document.activeElement !== strictToggle) {
      strictToggle.checked = !!view.strictImport;
    }
    strictToggle.disabled = !!view?.controls?.strictToggleDisabled;
  }

  const restoreSelect = document.getElementById("v3DataRestoreBackup");
  if (restoreSelect instanceof HTMLSelectElement) {
    syncBackupSelect(restoreSelect, Array.isArray(view.backupOptions) ? view.backupOptions : [], view.selectedBackup);
    restoreSelect.disabled = !!view?.controls?.restoreDisabled;
  }

  const hashBannerUi = document.getElementById("v3DataHashBannerUi");
  if (hashBannerUi instanceof HTMLElement) {
    const text = String(view.hashBannerText || "").trim();
    hashBannerUi.hidden = !text;
    hashBannerUi.textContent = text || "No import hash warning.";
  }

  const warnBannerUi = document.getElementById("v3DataWarnBannerUi");
  if (warnBannerUi instanceof HTMLElement) {
    const text = String(view.warnBannerText || "").trim();
    warnBannerUi.hidden = !text;
    warnBannerUi.textContent = text || "No import warnings.";
  }

  setText("v3DataUsbStatusUi", String(view.usbStatus || "Using browser storage only."));
  setText(
    "v3DataImportFileStatus",
    view.importFileName ? `Selected import: ${view.importFileName}` : "No import file selected."
  );

  syncButtonDisabledLocal("v3DataBtnSaveJson", !!view?.controls?.saveJsonDisabled);
  syncButtonDisabledLocal("v3DataBtnLoadJson", !!view?.controls?.loadJsonDisabled);
  syncButtonDisabledLocal("v3DataBtnCopySummary", !!view?.controls?.copySummaryDisabled);
  syncButtonDisabledLocal("v3DataBtnExportCsv", !!view?.controls?.exportCsvDisabled);
  syncButtonDisabledLocal("v3DataBtnUsbConnect", !!view?.controls?.usbConnectDisabled);
  syncButtonDisabledLocal("v3DataBtnUsbLoad", !!view?.controls?.usbLoadDisabled);
  syncButtonDisabledLocal("v3DataBtnUsbSave", !!view?.controls?.usbSaveDisabled);
  syncButtonDisabledLocal("v3DataBtnUsbDisconnect", !!view?.controls?.usbDisconnectDisabled);
}

function syncBackupSelect(selectEl, options, selectedValue) {
  const selected = String(selectedValue || "");
  const nextValues = options.map((opt) => `${String(opt.value || "")}::${String(opt.label || "")}`);
  const currentValues = Array.from(selectEl.options)
    .slice(1)
    .map((opt) => `${String(opt.value || "")}::${String(opt.textContent || "")}`);
  const matches = nextValues.length === currentValues.length && nextValues.every((v, i) => v === currentValues[i]);
  if (!matches) {
    selectEl.innerHTML = "";
    const base = document.createElement("option");
    base.value = "";
    base.textContent = "Restore backup…";
    selectEl.appendChild(base);
    options.forEach((opt) => {
      const item = document.createElement("option");
      item.value = String(opt.value || "");
      item.textContent = String(opt.label || opt.value || "");
      selectEl.appendChild(item);
    });
  }
  if (document.activeElement !== selectEl) {
    selectEl.value = selected;
  }
}

function syncButtonDisabledLocal(id, disabled) {
  const btn = document.getElementById(id);
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = !!disabled;
  }
}

function readElText(id) {
  const el = document.getElementById(id);
  return el ? String(el.textContent || "").trim() : "";
}

function readSelectLabel(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return "";
  }
  const option = selectEl.options[selectEl.selectedIndex];
  return option ? String(option.textContent || "").trim() : "";
}

function getDataApi() {
  const api = window?.[DATA_API_KEY];
  if (!api || typeof api.getView !== "function") {
    return null;
  }
  return api;
}
