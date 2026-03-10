import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import {
  bindCheckboxProxy,
  bindClickProxy,
  bindSelectProxy,
  getLegacyEl,
  readText,
  setText,
  syncCheckboxValue,
  syncButtonDisabled,
  syncSelectValue
} from "../surfaceUtils.js";

export function renderDataSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const policyCard = createCard({
    title: "Import policy & recovery",
    description: "Strict import mode, integrity warnings, and local backup restore controls."
  });

  const exchangeCard = createCard({
    title: "Scenario import/export",
    description: "JSON/CSV export and summary handoff tools."
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
      <div class="fpe-alert fpe-alert--warn" id="v3DataHashBannerUi" hidden>Snapshot hash differs from exported hash.</div>
      <div class="fpe-alert fpe-alert--warn" id="v3DataWarnBannerUi" hidden></div>
      <div class="fpe-field-grid fpe-field-grid--2">
        <div class="field">
          <label class="fpe-control-label" for="v3DataStrictToggle">Strict import policy</label>
          <label class="fpe-switch">
            <input id="v3DataStrictToggle" type="checkbox"/>
            <span>Block newer schema and hash-mismatch imports</span>
          </label>
          <div class="fpe-help">When ON, imports are blocked for newer schema versions and integrity hash mismatches.</div>
        </div>
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
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3DataBtnSaveJson" type="button">Export Scenario JSON</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnLoadJson" type="button">Import Scenario JSON</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnCopySummary" type="button">Copy Summary</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnExportCsv" type="button">Export CSV</button>
    </div>
    <div class="fpe-help">Use these controls for file exchange, reporting, and audit-safe handoffs.</div>
    <div class="fpe-help" id="v3DataImportFileStatus">No import file selected.</div>
  `;

  getCardBody(storageCard).innerHTML = `
    <div class="fpe-action-row">
      <button class="fpe-btn" id="v3DataBtnUsbConnect" type="button">Connect folder</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnUsbLoad" type="button">Load from folder</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnUsbSave" type="button">Save to folder now</button>
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnUsbDisconnect" type="button">Disconnect</button>
    </div>
    <div class="fpe-help" id="v3DataUsbStatusUi">Using browser storage only.</div>
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

  left.append(policyCard, exchangeCard);
  right.append(storageCard, summaryCard);
  frame.append(left, right);
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
  const legacyStrict = getLegacyEl("toggleStrictImport");
  const legacyRestore = getLegacyEl("restoreBackup");
  const legacyLoadJson = getLegacyEl("loadJson");
  const legacyHashBanner = getLegacyEl("importHashBanner");
  const legacyWarnBanner = getLegacyEl("importWarnBanner");
  const legacyUsbStatus = getLegacyEl("usbStorageStatus");

  syncCheckboxValue("v3DataStrictToggle", "toggleStrictImport");
  syncSelectValue("v3DataRestoreBackup", "restoreBackup");

  const hashBannerUi = document.getElementById("v3DataHashBannerUi");
  if (hashBannerUi && legacyHashBanner instanceof HTMLElement) {
    hashBannerUi.hidden = legacyHashBanner.hidden;
    hashBannerUi.textContent = (legacyHashBanner.textContent || "").trim() || "Snapshot hash differs from exported hash.";
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
  if (!(legacyLoadJson instanceof HTMLInputElement) || !legacyLoadJson.files || !legacyLoadJson.files.length) {
    return "No import file selected.";
  }
  return `Selected import: ${legacyLoadJson.files[0].name}`;
}
