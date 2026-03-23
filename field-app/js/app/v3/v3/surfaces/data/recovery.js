export function syncDataRecoveryModule(context = {}) {
  const {
    view,
    summary,
    fallbackBackupSelection,
    setText,
    syncBackupSelect,
    syncButtonDisabledLocal,
  } = context;

  if (
    typeof setText !== "function"
    || typeof syncBackupSelect !== "function"
    || typeof syncButtonDisabledLocal !== "function"
  ) {
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

  setText("v3DataUsbStatusUi", summary.usbStatusSummary);
  setText("v3DataStrictImport", summary.strictImportText);
  setText("v3DataBackupCount", summary.backupCountText);
  setText("v3DataHashBanner", summary.hashBannerSummary);
  setText("v3DataWarnBanner", summary.warnBannerSummary);
  setText("v3DataUsbStatus", summary.usbStatusSummary);
  setText("v3DataRestoreSelection", summary.restoreSelection || fallbackBackupSelection);

  syncButtonDisabledLocal("v3DataBtnUsbConnect", !!view?.controls?.usbConnectDisabled);
  syncButtonDisabledLocal("v3DataBtnUsbLoad", !!view?.controls?.usbLoadDisabled);
  syncButtonDisabledLocal("v3DataBtnUsbSave", !!view?.controls?.usbSaveDisabled);
  syncButtonDisabledLocal("v3DataBtnUsbDisconnect", !!view?.controls?.usbDisconnectDisabled);
}

export function bindDataRecoveryEvents(context = {}) {
  const {
    getDataApi,
    refreshDataSummary,
    bindDataAction,
  } = context;

  if (
    typeof getDataApi !== "function"
    || typeof refreshDataSummary !== "function"
    || typeof bindDataAction !== "function"
  ) {
    return;
  }

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

  bindDataAction("v3DataBtnUsbConnect", "usb_connect");
  bindDataAction("v3DataBtnUsbLoad", "usb_load");
  bindDataAction("v3DataBtnUsbSave", "usb_save");
  bindDataAction("v3DataBtnUsbDisconnect", "usb_disconnect");
}
