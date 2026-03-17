import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody,
  setCardHeaderControl
} from "../componentFactory.js";
import { setText } from "../surfaceUtils.js";
import {
  DATA_STATUS_AWAITING_STORAGE,
  classifyDataStatusTone,
  deriveDataAuditCardStatus,
  deriveDataExchangeCardStatus,
  deriveDataPolicyCardStatus,
  deriveDataStorageCardStatus,
  deriveDataSummaryCardStatus,
} from "../../../core/dataView.js";

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
    description: "Strict import mode, integrity warnings, and local backup restore controls.",
    status: "Restore ready"
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
    description: "JSON/CSV export and summary handoff controls.",
    status: "Ready"
  });

  const storageCard = createCard({
    title: "Backups & storage",
    description: "Connect removable storage and manage manual sync operations.",
    status: "Browser storage"
  });

  const summaryCard = createCard({
    title: "Data summary",
    description: "Current policy and storage posture.",
    status: "Stable"
  });
  const auditCard = createCard({
    title: "Forecast learning",
    description: "Archive forecasts, record actual outcomes, and track model error posture.",
    status: "Awaiting archive"
  });

  assignCardStatusId(policyCard, "v3DataPolicyCardStatus");
  assignCardStatusId(exchangeCard, "v3DataExchangeCardStatus");
  assignCardStatusId(storageCard, "v3DataStorageCardStatus");
  assignCardStatusId(auditCard, "v3DataAuditCardStatus");
  assignCardStatusId(summaryCard, "v3DataSummaryCardStatus");

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

  getCardBody(auditCard).innerHTML = `
    <div class="fpe-contained-block">
      <ul class="bullets">
        <li>Select an archived forecast, then record certified actuals for model learning.</li>
        <li>Model audit metrics update from campaign-scoped archive records.</li>
      </ul>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DataArchiveSelect">Archived forecast</label>
        <select class="fpe-input" id="v3DataArchiveSelect">
          <option value="">No archived forecasts</option>
        </select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DataArchiveActualMargin">Actual margin</label>
        <input class="fpe-input" id="v3DataArchiveActualMargin" type="number" step="0.01" placeholder="e.g. 1.2"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DataArchiveActualYourVotes">Actual your votes</label>
        <input class="fpe-input" id="v3DataArchiveActualYourVotes" type="number" step="1" placeholder="e.g. 6320"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DataArchiveActualWinThreshold">Actual win threshold</label>
        <input class="fpe-input" id="v3DataArchiveActualWinThreshold" type="number" step="1" placeholder="e.g. 6200"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DataArchiveActualWinner">Winner</label>
        <input class="fpe-input" id="v3DataArchiveActualWinner" type="text" placeholder="Candidate name"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DataArchiveActualDate">Result date</label>
        <input class="fpe-input" id="v3DataArchiveActualDate" type="date"/>
      </div>
    </div>
    <div class="fpe-field-grid fpe-field-grid--1">
      <div class="field">
        <label class="fpe-control-label" for="v3DataArchiveActualNotes">Audit notes</label>
        <textarea class="fpe-input" id="v3DataArchiveActualNotes" rows="2" placeholder="Certification notes, anomalies, recount details..."></textarea>
      </div>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3DataArchiveSaveActual" type="button">Save Actual Outcome</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataArchiveRefresh" type="button">Refresh Archive</button>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Audit samples</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditSampleSize">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Within 1 pt</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditWithin1">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Within 2 pts</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditWithin2">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Mean error</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditMeanError">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Mean abs error</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditMae">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Bias direction</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditBias">-</div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Recent forecast archive</div>
      <div class="fpe-help fpe-help--flush" id="v3DataArchiveTableSummary">No archive records yet.</div>
    </div>
    <div class="fpe-table-wrap">
      <table class="fpe-table fpe-table--compact">
        <thead>
          <tr>
            <th scope="col">Recorded</th>
            <th scope="col">Scenario</th>
            <th scope="col">Forecast margin</th>
            <th scope="col">Actual margin</th>
          </tr>
        </thead>
        <tbody id="v3DataArchiveRows">
          <tr><td colspan="4">No archive records.</td></tr>
        </tbody>
      </table>
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
  infraCol.append(storageCard, auditCard, summaryCard);

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
  const auditSampleSize = readElText("v3DataAuditSampleSize");
  const auditBias = readElText("v3DataAuditBias");
  const archiveSummary = readElText("v3DataArchiveTableSummary");

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

  syncDataCardStatus(
    "v3DataPolicyCardStatus",
    deriveDataPolicyCardStatus(
      strictToggle instanceof HTMLInputElement && strictToggle.checked,
      hashBannerUi instanceof HTMLElement && !hashBannerUi.hidden
        ? (hashBannerUi.textContent || "").trim()
        : "",
      warnBannerUi instanceof HTMLElement && !warnBannerUi.hidden
        ? (warnBannerUi.textContent || "").trim()
        : "",
      restoreSelect instanceof HTMLSelectElement
        ? Math.max(0, restoreSelect.options.length - 1)
        : 0
    )
  );
  syncDataCardStatus(
    "v3DataExchangeCardStatus",
    deriveDataExchangeCardStatus(importFileStatus)
  );
  syncDataCardStatus(
    "v3DataStorageCardStatus",
    deriveDataStorageCardStatus(usbStatusUi)
  );
  syncDataCardStatus(
    "v3DataAuditCardStatus",
    deriveDataAuditCardStatus(auditSampleSize, auditBias, archiveSummary)
  );
  syncDataCardStatus(
    "v3DataSummaryCardStatus",
    deriveDataSummaryCardStatus(
      strictToggle instanceof HTMLInputElement && strictToggle.checked,
      hashBannerUi instanceof HTMLElement && !hashBannerUi.hidden,
      warnBannerUi instanceof HTMLElement && !warnBannerUi.hidden,
      usbStatusUi
    )
  );
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

  const archiveSelect = document.getElementById("v3DataArchiveSelect");
  if (archiveSelect instanceof HTMLSelectElement) {
    archiveSelect.addEventListener("change", () => {
      const value = String(archiveSelect.value || "").trim();
      const api = getDataApi();
      if (!api || typeof api.setArchiveSelection !== "function") {
        return;
      }
      api.setArchiveSelection(value);
      refreshDataSummary();
    });
  }

  const archiveSaveBtn = document.getElementById("v3DataArchiveSaveActual");
  if (archiveSaveBtn instanceof HTMLButtonElement) {
    archiveSaveBtn.addEventListener("click", () => {
      const api = getDataApi();
      if (!api || typeof api.saveArchiveActual !== "function") {
        return;
      }
      const payload = {
        snapshotHash: readInputValue("v3DataArchiveSelect"),
        actual: {
          margin: parseNumericInput("v3DataArchiveActualMargin"),
          yourVotes: parseNumericInput("v3DataArchiveActualYourVotes"),
          winThreshold: parseNumericInput("v3DataArchiveActualWinThreshold"),
          winner: readInputValue("v3DataArchiveActualWinner"),
          resultDate: readInputValue("v3DataArchiveActualDate"),
        },
        notes: readInputValue("v3DataArchiveActualNotes"),
      };
      const result = api.saveArchiveActual(payload);
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
    });
  }

  const archiveRefreshBtn = document.getElementById("v3DataArchiveRefresh");
  if (archiveRefreshBtn instanceof HTMLButtonElement) {
    archiveRefreshBtn.addEventListener("click", () => {
      const api = getDataApi();
      if (!api || typeof api.refreshArchive !== "function") {
        return;
      }
      const result = api.refreshArchive();
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
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

  const archiveView = view?.forecastArchive && typeof view.forecastArchive === "object" ? view.forecastArchive : {};
  const archiveSelect = document.getElementById("v3DataArchiveSelect");
  if (archiveSelect instanceof HTMLSelectElement) {
    syncArchiveSelect(
      archiveSelect,
      Array.isArray(archiveView.options) ? archiveView.options : [],
      archiveView.selectedHash
    );
    archiveSelect.disabled = !!view?.controls?.archiveSelectionDisabled;
  }
  const selectedEntry = archiveView?.selectedEntry && typeof archiveView.selectedEntry === "object"
    ? archiveView.selectedEntry
    : {};
  const selectedActual = selectedEntry?.actual && typeof selectedEntry.actual === "object"
    ? selectedEntry.actual
    : {};
  syncInputValue("v3DataArchiveActualMargin", selectedActual.margin);
  syncInputValue("v3DataArchiveActualYourVotes", selectedActual.yourVotes);
  syncInputValue("v3DataArchiveActualWinThreshold", selectedActual.winThreshold);
  syncInputValue("v3DataArchiveActualWinner", selectedActual.winner);
  syncInputValue("v3DataArchiveActualDate", selectedActual.resultDate);
  syncInputValue("v3DataArchiveActualNotes", selectedEntry.notes);

  const audit = archiveView?.modelAudit && typeof archiveView.modelAudit === "object"
    ? archiveView.modelAudit
    : {};
  setText("v3DataAuditSampleSize", formatSampleCount(audit.sampleSize));
  setText("v3DataAuditWithin1", formatPercent(audit.within1ptPct));
  setText("v3DataAuditWithin2", formatPercent(audit.within2ptPct));
  setText("v3DataAuditMeanError", formatSignedNumber(audit.meanErrorMargin, 2));
  setText("v3DataAuditMae", formatNumber(audit.meanAbsErrorMargin, 2));
  setText("v3DataAuditBias", String(audit.biasDirection || "none"));

  const archiveRows = Array.isArray(archiveView.rows) ? archiveView.rows : [];
  const archiveSummary = archiveView?.summary && typeof archiveView.summary === "object"
    ? archiveView.summary
    : {};
  const totalArchiveCount = Number.isFinite(Number(archiveSummary?.totalEntries))
    ? Math.max(0, Math.floor(Number(archiveSummary.totalEntries)))
    : archiveRows.length;
  const withActualArchiveCount = Number.isFinite(Number(archiveSummary?.withActualEntries))
    ? Math.max(0, Math.floor(Number(archiveSummary.withActualEntries)))
    : archiveRows.filter((row) => row?.actualMargin != null).length;
  const pendingArchiveCount = Math.max(0, totalArchiveCount - withActualArchiveCount);
  syncArchiveRows(archiveRows);
  setText(
    "v3DataArchiveTableSummary",
    totalArchiveCount
      ? `Showing ${totalArchiveCount.toLocaleString("en-US")} archived forecasts (${withActualArchiveCount.toLocaleString("en-US")} with actuals, ${pendingArchiveCount.toLocaleString("en-US")} pending).`
      : "No archive records yet."
  );
  syncButtonDisabledLocal("v3DataArchiveSaveActual", !!view?.controls?.archiveSaveDisabled);
  syncButtonDisabledLocal("v3DataArchiveRefresh", !!view?.controls?.archiveRefreshDisabled);
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

function syncArchiveSelect(selectEl, options, selectedValue) {
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
    base.textContent = "Select archived forecast…";
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

function syncInputValue(id, value) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return;
  }
  if (document.activeElement === el) {
    return;
  }
  const next = value == null ? "" : String(value);
  el.value = next;
}

function readInputValue(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return "";
  }
  return String(el.value || "").trim();
}

function parseNumericInput(id) {
  const text = readInputValue(id);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function formatSampleCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return `${Math.max(0, Math.floor(n)).toLocaleString("en-US")}`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function formatNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function formatSignedNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const out = n.toFixed(digits);
  return n > 0 ? `+${out}` : out;
}

function formatRecordedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return raw.replace("T", " ").replace("Z", "");
}

function syncArchiveRows(rows) {
  const body = document.getElementById("v3DataArchiveRows");
  if (!(body instanceof HTMLTableSectionElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  body.innerHTML = "";
  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4">No archive records.</td>`;
    body.appendChild(tr);
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(formatRecordedAt(row?.recordedAt))}</td>
      <td>${escapeHtml(String(row?.scenarioName || "—"))}</td>
      <td>${escapeHtml(formatSignedNumber(row?.forecastMargin, 2))}</td>
      <td>${escapeHtml(row?.actualMargin == null ? "—" : formatSignedNumber(row.actualMargin, 2))}</td>
    `;
    body.appendChild(tr);
  });
}

function escapeHtml(value) {
  const text = String(value == null ? "" : value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function assignCardStatusId(card, id) {
  if (!(card instanceof HTMLElement) || !id) {
    return;
  }
  const badge = card.querySelector(".fpe-card__status");
  if (badge instanceof HTMLElement) {
    badge.id = id;
  }
}

function syncDataCardStatus(id, value) {
  const badge = document.getElementById(id);
  if (!(badge instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || DATA_STATUS_AWAITING_STORAGE;
  badge.textContent = text;
  badge.classList.add("fpe-status-pill");
  badge.classList.remove(
    "fpe-status-pill--ok",
    "fpe-status-pill--warn",
    "fpe-status-pill--bad",
    "fpe-status-pill--neutral"
  );
  const tone = classifyDataStatusTone(text);
  badge.classList.add(`fpe-status-pill--${tone}`);
}

function getDataApi() {
  const api = window?.[DATA_API_KEY];
  if (!api || typeof api.getView !== "function") {
    return null;
  }
  return api;
}
