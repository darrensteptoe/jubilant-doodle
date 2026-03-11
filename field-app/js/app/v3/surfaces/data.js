import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody,
  setCardHeaderControl
} from "../componentFactory.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  bindSelectProxy,
  getLegacyEl,
  readText,
  setText,
  syncButtonDisabled,
  syncCheckboxValue,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderDataSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const policyCol = createColumn("policy");
  const exchangeCol = createColumn("exchange");
  const infraCol = createColumn("infra");

  const policyCard = createCard({
    title: "Import policy & recovery",
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
    title: "Scenario import/export",
    description: "JSON/CSV export and summary handoff controls."
  });

  const storageCard = createCard({
    title: "External storage",
    description: "Connect removable storage and manage manual sync operations."
  });

  const summaryCard = createCard({
    title: "Data operations summary",
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
    <div class="fpe-summary-grid">
      <div class="fpe-summary-row"><span>Strict import</span><strong id="v3DataStrictImport">-</strong></div>
      <div class="fpe-summary-row"><span>Backup options</span><strong id="v3DataBackupCount">-</strong></div>
      <div class="fpe-summary-row"><span>Import hash banner</span><strong id="v3DataHashBanner">-</strong></div>
      <div class="fpe-summary-row"><span>Import warning banner</span><strong id="v3DataWarnBanner">-</strong></div>
      <div class="fpe-summary-row"><span>USB storage status</span><strong id="v3DataUsbStatus">-</strong></div>
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

  const strictToggle = getLegacyEl("toggleStrictImport");
  const restoreBackup = getLegacyEl("restoreBackup");
  const hashBanner = document.getElementById("importHashBanner");
  const warnBanner = document.getElementById("importWarnBanner");

  setText(
    "v3DataStrictImport",
    strictToggle && "checked" in strictToggle && strictToggle.checked ? "ON" : "OFF"
  );
  setText(
    "v3DataBackupCount",
    restoreBackup && "options" in restoreBackup
      ? String(Math.max(0, restoreBackup.options.length - 1))
      : "0"
  );
  setText(
    "v3DataHashBanner",
    hashBanner && !hashBanner.hidden ? readText("#importHashBanner") || "Visible" : "Hidden"
  );
  setText(
    "v3DataWarnBanner",
    warnBanner && !warnBanner.hidden ? readText("#importWarnBanner") || "Visible" : "Hidden"
  );
  setText("v3DataUsbStatus", readText("#usbStorageStatus"));
}

function wireDataBridge() {
  const root = document.getElementById("v3DataBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  bindCheckboxProxy("v3DataStrictToggle", "toggleStrictImport");
  bindSelectProxy("v3DataRestoreBackup", "restoreBackup");

  bindClickProxy("v3DataBtnSaveJson", "btnSaveJson");
  bindClickProxy("v3DataBtnLoadJson", "loadJson");
  bindClickProxy("v3DataBtnCopySummary", "btnCopySummary");
  bindClickProxy("v3DataBtnExportCsv", "btnExportCsv");
  bindClickProxy("v3DataBtnUsbConnect", "btnUsbStorageConnect");
  bindClickProxy("v3DataBtnUsbLoad", "btnUsbStorageLoad");
  bindClickProxy("v3DataBtnUsbSave", "btnUsbStorageSave");
  bindClickProxy("v3DataBtnUsbDisconnect", "btnUsbStorageDisconnect");
}

function syncDataBridgeUi() {
  const legacyLoadJson = getLegacyEl("loadJson");
  const legacyHashBanner = getLegacyEl("importHashBanner");
  const legacyWarnBanner = getLegacyEl("importWarnBanner");
  const legacyUsbStatus = getLegacyEl("usbStorageStatus");

  syncCheckboxValue("v3DataStrictToggle", "toggleStrictImport");
  syncSelectValue("v3DataRestoreBackup", "restoreBackup");

  const hashBannerUi = document.getElementById("v3DataHashBannerUi");
  if (hashBannerUi && legacyHashBanner instanceof HTMLElement) {
    hashBannerUi.hidden = legacyHashBanner.hidden;
    hashBannerUi.textContent =
      (legacyHashBanner.textContent || "").trim() || "Snapshot hash differs from exported hash.";
  }

  const warnBannerUi = document.getElementById("v3DataWarnBannerUi");
  if (warnBannerUi && legacyWarnBanner instanceof HTMLElement) {
    warnBannerUi.hidden = legacyWarnBanner.hidden;
    warnBannerUi.textContent = (legacyWarnBanner.textContent || "").trim() || "Import warning.";
  }

  setText("v3DataUsbStatusUi", legacyUsbStatus ? (legacyUsbStatus.textContent || "").trim() : "");
  setText("v3DataImportFileStatus", describeImportFile(legacyLoadJson));

  syncButtonDisabled("v3DataBtnSaveJson", "btnSaveJson");
  syncButtonDisabled("v3DataBtnLoadJson", "loadJson");
  syncButtonDisabled("v3DataBtnCopySummary", "btnCopySummary");
  syncButtonDisabled("v3DataBtnExportCsv", "btnExportCsv");
  syncButtonDisabled("v3DataBtnUsbConnect", "btnUsbStorageConnect");
  syncButtonDisabled("v3DataBtnUsbLoad", "btnUsbStorageLoad");
  syncButtonDisabled("v3DataBtnUsbSave", "btnUsbStorageSave");
  syncButtonDisabled("v3DataBtnUsbDisconnect", "btnUsbStorageDisconnect");
}

function describeImportFile(legacyLoadJson) {
  if (
    !(legacyLoadJson instanceof HTMLInputElement) ||
    !legacyLoadJson.files ||
    !legacyLoadJson.files.length
  ) {
    return "No import file selected.";
  }
  return `Selected import: ${legacyLoadJson.files[0].name}`;
}
