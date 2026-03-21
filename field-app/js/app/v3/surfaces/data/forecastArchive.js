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
  setText("v3DataArchiveOfficeBestDollar", archiveDetail.officeBestByDollar);
  setText("v3DataArchiveOfficeBestOrganizerHour", archiveDetail.officeBestByOrganizerHour);
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
  setText("v3DataArchiveTemplateSummary", archiveDetail.templateSummary);
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
