const DATA_REPORT_STATUS_FALLBACK = "Choose report type and compose.";

export function syncDataReportingModule(context = {}) {
  const {
    view,
    setText,
    syncInputValue,
    syncButtonDisabledLocal,
  } = context;

  if (
    typeof setText !== "function"
    || typeof syncInputValue !== "function"
    || typeof syncButtonDisabledLocal !== "function"
  ) {
    return;
  }

  const reportingView = view?.reporting && typeof view.reporting === "object" ? view.reporting : {};
  const reportTypeSelect = document.getElementById("v3DataReportType");
  if (reportTypeSelect instanceof HTMLSelectElement) {
    syncReportTypeSelect(
      reportTypeSelect,
      Array.isArray(reportingView.options) ? reportingView.options : [],
      reportingView.selectedType,
    );
    reportTypeSelect.disabled = !!view?.controls?.reportTypeDisabled;
  }

  setText(
    "v3DataReportStatus",
    String(reportingView.status || "").trim() || DATA_REPORT_STATUS_FALLBACK,
  );
  syncInputValue("v3DataReportPreview", reportingView.previewText);
  syncButtonDisabledLocal("v3DataBtnComposeReport", !!view?.controls?.reportComposeDisabled);
  syncButtonDisabledLocal("v3DataBtnExportReportPdf", !!view?.controls?.reportExportPdfDisabled);
}

export function bindDataReportingEvents(context = {}) {
  const {
    getDataApi,
    refreshDataSummary,
    readSelectValue,
  } = context;

  if (
    typeof getDataApi !== "function"
    || typeof refreshDataSummary !== "function"
    || typeof readSelectValue !== "function"
  ) {
    return;
  }

  const reportTypeSelect = document.getElementById("v3DataReportType");
  if (reportTypeSelect instanceof HTMLSelectElement) {
    reportTypeSelect.addEventListener("change", () => {
      const api = getDataApi();
      if (!api || typeof api.setReportType !== "function") {
        return;
      }
      const result = api.setReportType(reportTypeSelect.value);
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
    });
  }

  const composeReportBtn = document.getElementById("v3DataBtnComposeReport");
  if (composeReportBtn instanceof HTMLButtonElement) {
    composeReportBtn.addEventListener("click", () => {
      const api = getDataApi();
      if (!api || typeof api.composeReport !== "function") {
        return;
      }
      const reportType = readSelectValue("v3DataReportType");
      const result = api.composeReport({ reportType });
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
    });
  }

  const exportReportBtn = document.getElementById("v3DataBtnExportReportPdf");
  if (exportReportBtn instanceof HTMLButtonElement) {
    exportReportBtn.addEventListener("click", () => {
      const api = getDataApi();
      if (!api || typeof api.exportReportPdf !== "function") {
        return;
      }
      const reportType = readSelectValue("v3DataReportType");
      const result = api.exportReportPdf({ reportType });
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
    });
  }
}

function syncReportTypeSelect(selectEl, options, selectedValue) {
  const list = Array.isArray(options) ? options : [];
  const selected = String(selectedValue || "").trim();
  replaceReportTypeOptionsInPlace(selectEl, list);

  if (document.activeElement !== selectEl) {
    const allowed = list.some((opt) => String(opt.value || "") === selected);
    selectEl.value = allowed ? selected : String(list[0]?.value || "internal_full");
  }
}

function replaceReportTypeOptionsInPlace(selectEl, options) {
  const list = Array.isArray(options) ? options : [];
  for (let idx = 0; idx < list.length; idx += 1) {
    const next = list[idx];
    let option = selectEl.options[idx] || null;
    if (!(option instanceof HTMLOptionElement)) {
      option = document.createElement("option");
      selectEl.appendChild(option);
    }
    const nextValue = String(next?.value || "");
    const nextLabel = String(next?.label || next?.value || "");
    if (String(option.value) !== nextValue) {
      option.value = nextValue;
    }
    if (String(option.textContent || "") !== nextLabel) {
      option.textContent = nextLabel;
    }
  }
  while (selectEl.options.length > list.length) {
    selectEl.remove(selectEl.options.length - 1);
  }
}
