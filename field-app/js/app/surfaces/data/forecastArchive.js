import { formatOfficeContextLabel } from "../../../../core/officeContextLabels.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function formatArchiveOfficeWinnerDisplayText(value) {
  const raw = cleanText(value);
  if (!raw || raw === "—") {
    return raw;
  }
  const segments = raw.split("·");
  const officeToken = cleanText(segments.shift());
  if (!officeToken) {
    return raw;
  }
  const officeLabel = formatOfficeContextLabel(officeToken, { unmappedLabel: "Unmapped Office Context" });
  const suffix = cleanText(segments.join("·"));
  return suffix ? `${officeLabel} · ${suffix}` : officeLabel;
}

export function formatArchiveTemplateSummaryDisplayText(value) {
  const raw = cleanText(value);
  if (!raw || raw === "—") {
    return raw;
  }
  const withVersion = raw.match(/^(.*?)\s*\(v([^)]+)\)$/);
  if (withVersion) {
    const templateToken = cleanText(withVersion[1]);
    const version = cleanText(withVersion[2]);
    const templateLabel = formatOfficeContextLabel(templateToken, { unmappedLabel: "Unmapped Office Context" });
    return version ? `${templateLabel} (v${version})` : templateLabel;
  }
  return formatOfficeContextLabel(raw, { unmappedLabel: "Unmapped Office Context" });
}

export function syncDataForecastArchiveModule(context = {}) {
  const {
    view,
    archiveView,
    archiveDetail,
    archiveRows,
    normalizedArchiveSummary,
    buildDataArchiveTableSummaryText,
    fallbackArchiveDetail,
    setText,
    syncButtonDisabledLocal,
    syncInputValue,
    syncArchiveSelect,
    syncArchiveRows,
  } = context;

  if (
    typeof setText !== "function"
    || typeof syncButtonDisabledLocal !== "function"
    || typeof syncInputValue !== "function"
    || typeof syncArchiveSelect !== "function"
    || typeof syncArchiveRows !== "function"
  ) {
    return;
  }

  const archiveSelect = document.getElementById("v3DataArchiveSelect");
  if (archiveSelect instanceof HTMLSelectElement) {
    syncArchiveSelect(
      archiveSelect,
      Array.isArray(archiveView.options) ? archiveView.options : [],
      archiveView.selectedHash,
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

  setText("v3DataArchiveTargetRows", archiveDetail.targetRows);
  setText("v3DataArchiveTargetTop", archiveDetail.topTargets);
  setText("v3DataArchiveTargetValueTotal", archiveDetail.targetValueTotal);
  setText("v3DataArchiveOfficePathRows", archiveDetail.officePathRows);
  setText("v3DataArchiveOfficeBestDollar", formatArchiveOfficeWinnerDisplayText(archiveDetail.officeBestByDollar));
  setText("v3DataArchiveOfficeBestOrganizerHour", formatArchiveOfficeWinnerDisplayText(archiveDetail.officeBestByOrganizerHour));
  setText("v3DataArchiveOfficeBestDollarUpliftExpected", archiveDetail.officeBestByDollarUpliftExpected);
  setText("v3DataArchiveOfficeBestDollarUpliftSource", archiveDetail.officeBestByDollarUpliftSource);
  setText("v3DataArchiveOfficeBestOrganizerHourUpliftExpected", archiveDetail.officeBestByOrganizerHourUpliftExpected);
  setText("v3DataArchiveOfficeBestOrganizerHourUpliftSource", archiveDetail.officeBestByOrganizerHourUpliftSource);
  setText("v3DataArchiveOfficePathStatus", archiveDetail.officePathStatus || fallbackArchiveDetail);
  setText("v3DataArchiveUpliftExpected", archiveDetail.upliftExpected);
  setText("v3DataArchiveUpliftLow", archiveDetail.upliftLow);
  setText("v3DataArchiveUpliftBestChannel", archiveDetail.upliftBestChannel);
  setText("v3DataArchiveUpliftSource", archiveDetail.upliftSource);
  setText("v3DataArchiveUpliftUncertaintyBand", archiveDetail.upliftUncertaintyBand);
  setText("v3DataArchiveUpliftSaturationPressure", archiveDetail.upliftSaturationPressure);
  setText("v3DataArchiveTemplateSummary", formatArchiveTemplateSummaryDisplayText(archiveDetail.templateSummary));
  setText("v3DataArchiveWorkforceSummary", archiveDetail.workforceSummary);
  setText("v3DataArchiveBudgetSummary", archiveDetail.budgetSummary);
  setText("v3DataArchiveVoterRows", archiveDetail.voterRows);
  setText("v3DataArchiveVoterScopingRule", archiveDetail.voterScopingRule);
  setText("v3DataArchiveVoterSource", archiveDetail.voterSource);
  setText("v3DataArchiveVoterGeoCoverage", archiveDetail.voterGeoCoverage);
  setText("v3DataArchiveVoterContactableRate", archiveDetail.voterContactableRate);
  setText("v3DataArchiveGovernanceConfidence", archiveDetail.governanceConfidence);
  setText("v3DataArchiveGovernanceExecution", archiveDetail.governanceExecution);
  setText("v3DataArchiveGovernanceUpliftSource", archiveDetail.governanceUpliftSource);
  setText("v3DataArchiveGovernanceWarning", archiveDetail.governanceTopWarning);
  setText("v3DataArchiveGovernanceLearning", archiveDetail.governanceLearning);
  setText("v3DataArchiveGovernanceRecommendation", archiveDetail.governanceRecommendation);

  syncArchiveRows(archiveRows);
  setText(
    "v3DataArchiveTableSummary",
    buildDataArchiveTableSummaryText(normalizedArchiveSummary, archiveRows),
  );

  syncButtonDisabledLocal("v3DataArchiveSaveActual", !!view?.controls?.archiveSaveDisabled);
  syncButtonDisabledLocal("v3DataArchiveRefresh", !!view?.controls?.archiveRefreshDisabled);
}

export function bindDataForecastArchiveEvents(context = {}) {
  const {
    getDataApi,
    refreshDataSummary,
    readInputValue,
    readSelectValue,
    parseDataOptionalNumber,
  } = context;

  if (
    typeof getDataApi !== "function"
    || typeof refreshDataSummary !== "function"
    || typeof readInputValue !== "function"
    || typeof readSelectValue !== "function"
    || typeof parseDataOptionalNumber !== "function"
  ) {
    return;
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
        snapshotHash: readSelectValue("v3DataArchiveSelect"),
        actual: {
          margin: parseDataOptionalNumber(readInputValue("v3DataArchiveActualMargin")),
          yourVotes: parseDataOptionalNumber(readInputValue("v3DataArchiveActualYourVotes")),
          winThreshold: parseDataOptionalNumber(readInputValue("v3DataArchiveActualWinThreshold")),
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
}

export function syncArchiveSelect(selectEl, options, selectedValue) {
  const selected = String(selectedValue || "");
  replaceArchiveSelectOptionsInPlace(
    selectEl,
    Array.isArray(options) ? options : [],
    { value: "", label: "Select archived forecast…" },
  );
  if (document.activeElement !== selectEl) {
    selectEl.value = selected;
  }
}

function replaceArchiveSelectOptionsInPlace(selectEl, options, baseOption = null) {
  const list = [];
  if (baseOption && typeof baseOption === "object") {
    list.push({
      value: String(baseOption.value || ""),
      label: String(baseOption.label || ""),
    });
  }
  const rows = Array.isArray(options) ? options : [];
  rows.forEach((row) => {
    list.push({
      value: String(row?.value || ""),
      label: String(row?.label || row?.value || ""),
    });
  });

  for (let idx = 0; idx < list.length; idx += 1) {
    const next = list[idx];
    let option = selectEl.options[idx] || null;
    if (!(option instanceof HTMLOptionElement)) {
      option = document.createElement("option");
      selectEl.appendChild(option);
    }
    if (String(option.value) !== next.value) {
      option.value = next.value;
    }
    if (String(option.textContent || "") !== next.label) {
      option.textContent = next.label;
    }
  }
  while (selectEl.options.length > list.length) {
    selectEl.remove(selectEl.options.length - 1);
  }
}

export function syncArchiveRows(rows) {
  const body = document.getElementById("v3DataArchiveRows");
  if (!(body instanceof HTMLTableSectionElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  body.innerHTML = "";
  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">No archive records.</td>`;
    body.appendChild(tr);
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row?.recordedAtText || "—")}</td>
      <td>${escapeHtml(String(row?.scenarioName || "—"))}</td>
      <td>${escapeHtml(String(row?.forecastMarginText || "—"))}</td>
      <td>${escapeHtml(String(row?.actualMarginText || "—"))}</td>
      <td>${escapeHtml(String(row?.targetingRowCountText || "—"))}</td>
      <td>${escapeHtml(String(row?.officePathRowCountText || "—"))}</td>
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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
