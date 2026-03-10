import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyClosest } from "../compat.js";
import { readText, setText } from "../surfaceUtils.js";

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

  mountLegacyClosest({
    key: "v3-data-policy-card",
    childSelector: "#toggleStrictImport",
    closestSelector: ".card",
    target: getCardBody(policyCard)
  });

  mountLegacyClosest({
    key: "v3-data-exchange-card",
    childSelector: "#btnSaveJson",
    closestSelector: ".card",
    target: getCardBody(exchangeCard)
  });

  mountLegacyClosest({
    key: "v3-data-storage-card",
    childSelector: "#btnUsbStorageConnect",
    closestSelector: ".card",
    target: getCardBody(storageCard)
  });

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

  return refreshDataSummary;
}

function refreshDataSummary() {
  const strictToggle = document.getElementById("toggleStrictImport");
  const restoreBackup = document.getElementById("restoreBackup");
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
