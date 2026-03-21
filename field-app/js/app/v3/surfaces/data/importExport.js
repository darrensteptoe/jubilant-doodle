export function syncDataImportExportModule(context = {}) {
  const {
    view,
    scope,
    voterLayerView,
    voterSchemaGuide,
    summary,
    buildDataImportFileStatus,
    fallbackVoterImportStatus,
    fallbackImportFileStatus,
    setText,
    syncButtonDisabledLocal,
    syncVoterAdapterSelect,
  } = context;

  if (
    typeof setText !== "function"
    || typeof syncButtonDisabledLocal !== "function"
    || typeof syncVoterAdapterSelect !== "function"
  ) {
    return;
  }

  setText("v3DataScopeCampaign", scope.scopeCampaign);
  setText("v3DataScopeOffice", scope.scopeOffice);
  setText("v3DataScopeLocks", scope.scopeLocks);

  const voterAdapterSelect = document.getElementById("v3DataVoterAdapter");
  if (voterAdapterSelect instanceof HTMLSelectElement) {
    syncVoterAdapterSelect(voterAdapterSelect);
  }

  setText("v3DataVoterScopingRule", voterLayerView.scopingRule);
  setText("v3DataVoterSource", voterLayerView.source);
  setText("v3DataVoterRows", voterLayerView.rowCount);
  setText("v3DataVoterImportedAt", voterLayerView.importedAt);
  setText("v3DataVoterMappedFields", voterLayerView.mappedCanonicalFields);
  setText("v3DataVoterIgnoredHeaders", voterLayerView.ignoredHeaders);
  setText("v3DataVoterGeoCoverage", voterLayerView.geoCoverage);
  setText("v3DataVoterContactableRate", voterLayerView.contactableRate);
  setText("v3DataVoterRecentContactRate", voterLayerView.recentContactRate);
  setText("v3DataVoterConversationRate", voterLayerView.conversationRate);
  setText("v3DataVoterRequiredFieldsCount", voterSchemaGuide.requiredCount);
  setText("v3DataVoterRequiredFields", voterSchemaGuide.requiredFields);
  setText("v3DataVoterRecommendedFieldsCount", voterSchemaGuide.recommendedCount);
  setText("v3DataVoterRecommendedFields", voterSchemaGuide.recommendedFields);

  setText("v3DataImportFileStatus", buildDataImportFileStatus(view?.importFileName));
  setText(
    "v3DataVoterImportStatus",
    String(view?.voterImportStatus || "").trim() || fallbackVoterImportStatus,
  );
  setText("v3DataImportFileSummary", summary.importFileSummary || fallbackImportFileStatus);

  syncButtonDisabledLocal("v3DataBtnSaveJson", !!view?.controls?.saveJsonDisabled);
  syncButtonDisabledLocal("v3DataBtnLoadJson", !!view?.controls?.loadJsonDisabled);
  syncButtonDisabledLocal("v3DataBtnCopySummary", !!view?.controls?.copySummaryDisabled);
  syncButtonDisabledLocal("v3DataBtnExportCsv", !!view?.controls?.exportCsvDisabled);
  syncButtonDisabledLocal("v3DataBtnImportVoter", !!view?.controls?.voterImportDisabled);
}

export function bindDataImportExportEvents(context = {}) {
  const {
    getDataApi,
    refreshDataSummary,
    bindDataAction,
    inferDataVoterInputFormat,
  } = context;

  if (
    typeof getDataApi !== "function"
    || typeof refreshDataSummary !== "function"
    || typeof bindDataAction !== "function"
    || typeof inferDataVoterInputFormat !== "function"
  ) {
    return;
  }

  const voterImportBtn = document.getElementById("v3DataBtnImportVoter");
  if (voterImportBtn instanceof HTMLButtonElement) {
    voterImportBtn.addEventListener("click", async () => {
      const api = getDataApi();
      if (!api || typeof api.importVoterRows !== "function") {
        return;
      }
      const fileInput = document.getElementById("v3DataVoterFile");
      const adapterSelect = document.getElementById("v3DataVoterAdapter");
      const sourceInput = document.getElementById("v3DataVoterSourceId");
      if (!(fileInput instanceof HTMLInputElement) || !fileInput.files || !fileInput.files.length) {
        const fallbackStatus = document.getElementById("v3DataVoterImportStatus");
        if (fallbackStatus instanceof HTMLElement) {
          fallbackStatus.textContent = "Select a voter CSV/JSON file first.";
        }
        return;
      }
      const file = fileInput.files[0];
      const adapterId = adapterSelect instanceof HTMLSelectElement ? String(adapterSelect.value || "").trim() : "";
      const sourceId = sourceInput instanceof HTMLInputElement ? String(sourceInput.value || "").trim() : "";
      const inferredFormat = inferDataVoterInputFormat(file?.name);
      try {
        const text = await file.text();
        const result = api.importVoterRows({
          text,
          adapterId,
          sourceId,
          fileName: String(file?.name || "").trim(),
          format: inferredFormat,
        });
        if (result && typeof result.then === "function") {
          result.finally(() => refreshDataSummary());
        } else {
          refreshDataSummary();
        }
      } catch {
        const fallbackStatus = document.getElementById("v3DataVoterImportStatus");
        if (fallbackStatus instanceof HTMLElement) {
          fallbackStatus.textContent = "Voter import failed: could not read file.";
        }
      }
    });
  }

  bindDataAction("v3DataBtnSaveJson", "save_json");
  bindDataAction("v3DataBtnLoadJson", "load_json");
  bindDataAction("v3DataBtnCopySummary", "copy_summary");
  bindDataAction("v3DataBtnExportCsv", "export_csv");
}
