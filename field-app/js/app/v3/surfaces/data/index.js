import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody,
  setCardHeaderControl
} from "../../componentFactory.js";
import { setText } from "../../surfaceUtils.js";
import {
  buildDataArchiveTableSummaryText,
  buildDataArchiveLearningView,
  buildDataArchiveLearningSignalsView,
  buildDataArchiveSelectedSnapshotView,
  buildDataImportFileStatus,
  buildDataSurfaceSummaryView,
  buildDataVoterSchemaGuideView,
  buildDataVoterLayerSnapshotView,
  DATA_ARCHIVE_DETAIL_FALLBACK,
  DATA_BACKUP_SELECTION_FALLBACK,
  DATA_IMPORT_FILE_STATUS_FALLBACK,
  DATA_LEARNING_LABEL_FALLBACK,
  DATA_LEARNING_RECOMMENDATION_FALLBACK,
  DATA_STATUS_AWAITING_STORAGE,
  DATA_VOTER_IMPORT_STATUS_FALLBACK,
  classifyDataStatusTone,
  formatDataScopeCampaign,
  formatDataScopeLocks,
  formatDataScopeOffice,
  formatDataArchiveRecordedAt,
  formatDataArchiveCount,
  formatDataPercentFromPct,
  formatDataSampleCount,
  formatDataSignedDecimal,
  normalizeDataArchiveSummary,
  parseDataOptionalNumber,
  formatDataArchiveDecimal,
  inferDataVoterInputFormat,
  listDataVoterAdapterOptions,
} from "../../../../core/dataView.js";
import {
  bindDataImportExportEvents,
  syncDataImportExportModule,
} from "./importExport.js";
import {
  bindDataRecoveryEvents,
  syncDataRecoveryModule,
} from "./recovery.js";
import {
  bindDataForecastArchiveEvents,
  syncArchiveRows,
  syncArchiveSelect,
  syncDataForecastArchiveModule,
} from "./forecastArchive.js";
import { syncDataLearningModule } from "./learning.js";
import {
  bindDataReportingEvents,
  syncDataReportingModule,
} from "./reporting.js";

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
  const frame = createCenterStackFrame();
  const centerCol = createCenterStackColumn();

  const policyCard = createCenterModuleCard({
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

  const exchangeCard = createCenterModuleCard({
    title: "Import / export",
    description: "JSON/CSV export and summary handoff controls.",
    status: "Ready"
  });

  const storageCard = createCenterModuleCard({
    title: "Backups & storage",
    description: "Connect removable storage and manage manual sync operations.",
    status: "Browser storage"
  });

  const summaryCard = createCenterModuleCard({
    title: "Data summary",
    description: "Current policy and storage posture.",
    status: "Stable"
  });
  const auditCard = createCenterModuleCard({
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
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DataVoterFile">Voter file (CSV/JSON)</label>
        <input class="fpe-input" id="v3DataVoterFile" type="file" accept=".csv,text/csv,.json,application/json"/>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DataVoterAdapter">Voter adapter</label>
        <select class="fpe-input" id="v3DataVoterAdapter">
          <option value="canonical">Canonical v1</option>
        </select>
      </div>
      <div class="field">
        <label class="fpe-control-label" for="v3DataVoterSourceId">Voter source ID</label>
        <input class="fpe-input" id="v3DataVoterSourceId" type="text" placeholder="optional source tag"/>
      </div>
    </div>
    <div class="fpe-action-row">
      <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnImportVoter" type="button">Import Voter File</button>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Voter import status</div>
      <div class="fpe-help fpe-help--flush" id="v3DataVoterImportStatus">${DATA_VOTER_IMPORT_STATUS_FALLBACK}</div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Campaign intelligence reports</div>
      <div class="fpe-help fpe-help--flush">Compose typed reporting families from canonical selectors and export with print-to-PDF flow.</div>
    </div>
    <div class="fpe-field-grid fpe-field-grid--2">
      <div class="field">
        <label class="fpe-control-label" for="v3DataReportType">Report type</label>
        <select class="fpe-input" id="v3DataReportType">
          <option value="internal_full">Internal Full</option>
          <option value="client_standard">Client Standard</option>
        </select>
      </div>
      <div class="field">
        <label class="fpe-control-label">Report actions</label>
        <div class="fpe-action-row">
          <button class="fpe-btn" id="v3DataBtnComposeReport" type="button">Compose Report</button>
          <button class="fpe-btn fpe-btn--ghost" id="v3DataBtnExportReportPdf" type="button">Export PDF</button>
        </div>
      </div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Report status</div>
      <div class="fpe-help fpe-help--flush" id="v3DataReportStatus">Choose report type and compose.</div>
    </div>
    <div class="fpe-contained-block">
      <div class="fpe-control-label">Report preview</div>
      <textarea class="fpe-input" id="v3DataReportPreview" rows="9" readonly></textarea>
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
        <li>Model audit metrics update from campaign+office scoped archive records.</li>
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
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Learning guidance</div>
      <div class="fpe-help fpe-help--flush" id="v3DataAuditLearningLabel">-</div>
    </div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Recommended calibration action</div>
      <div class="fpe-help fpe-help--flush" id="v3DataAuditLearningRecommendation">-</div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Learning voter rows</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditLearningVoterRows">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Learning geo coverage</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditLearningGeoCoverage">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Learning contactable rate</div>
        <div class="fpe-help fpe-help--flush" id="v3DataAuditLearningContactableRate">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Target rows</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveTargetRows">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Top targets</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveTargetTop">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Target value total</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveTargetValueTotal">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Office paths</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficePathRows">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / dollar</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficeBestDollar">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / org hour</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficeBestOrganizerHour">-</div>
      </div>
    </div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Office path status</div>
      <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficePathStatus">-</div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / dollar uplift</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficeBestDollarUpliftExpected">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / dollar source</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficeBestDollarUpliftSource">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / org-hour uplift</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficeBestOrganizerHourUpliftExpected">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Best office / org-hour source</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveOfficeBestOrganizerHourUpliftSource">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift expected</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveUpliftExpected">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift low-bound</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveUpliftLow">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift best channel</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveUpliftBestChannel">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift source</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveUpliftSource">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Uplift uncertainty</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveUpliftUncertaintyBand">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Saturation pressure</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveUpliftSaturationPressure">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Template</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveTemplateSummary">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Workforce mix</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveWorkforceSummary">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Budget posture</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveBudgetSummary">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter rows</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveVoterRows">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter scoping rule</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveVoterScopingRule">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter source</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveVoterSource">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter geo coverage</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveVoterGeoCoverage">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter contactable rate</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveVoterContactableRate">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Governance confidence</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveGovernanceConfidence">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Governance execution</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveGovernanceExecution">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Governance uplift source</div>
        <div class="fpe-help fpe-help--flush" id="v3DataArchiveGovernanceUpliftSource">-</div>
      </div>
    </div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Governance top warning</div>
      <div class="fpe-help fpe-help--flush" id="v3DataArchiveGovernanceWarning">-</div>
    </div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Governance learning</div>
      <div class="fpe-help fpe-help--flush" id="v3DataArchiveGovernanceLearning">-</div>
    </div>
    <div class="fpe-contained-block fpe-contained-block--status">
      <div class="fpe-control-label">Governance recommendation</div>
      <div class="fpe-help fpe-help--flush" id="v3DataArchiveGovernanceRecommendation">-</div>
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
            <th scope="col">Target rows</th>
            <th scope="col">Office paths</th>
          </tr>
        </thead>
        <tbody id="v3DataArchiveRows">
          <tr><td colspan="6">No archive records.</td></tr>
        </tbody>
      </table>
    </div>
  `;

  getCardBody(summaryCard).innerHTML = `
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Campaign scope</div>
        <div class="fpe-help fpe-help--flush" id="v3DataScopeCampaign">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Office scope</div>
        <div class="fpe-help fpe-help--flush" id="v3DataScopeOffice">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Context locks</div>
        <div class="fpe-help fpe-help--flush" id="v3DataScopeLocks">-</div>
      </div>
    </div>
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
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter scoping rule</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterScopingRule">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter source</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterSource">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Voter rows</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterRows">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Last voter import</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterImportedAt">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Mapped canonical fields</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterMappedFields">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Ignored headers</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterIgnoredHeaders">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Geo coverage</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterGeoCoverage">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--3">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Contactable rate</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterContactableRate">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Recent contact rate</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterRecentContactRate">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Conversation rate</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterConversationRate">-</div>
      </div>
    </div>
    <div class="fpe-status-strip fpe-status-strip--2">
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Required canonical fields</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterRequiredFieldsCount">-</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterRequiredFields">-</div>
      </div>
      <div class="fpe-contained-block fpe-contained-block--status">
        <div class="fpe-control-label">Recommended canonical fields</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterRecommendedFieldsCount">-</div>
        <div class="fpe-help fpe-help--flush" id="v3DataVoterRecommendedFields">-</div>
      </div>
    </div>
  `;

  centerCol.append(policyCard, exchangeCard, storageCard, auditCard, summaryCard);
  frame.append(centerCol);
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
  const dataViewState = syncDataBridgeUi();
  const dataViewApi = getDataApi();
  const dataView = dataViewState && typeof dataViewState === "object"
    ? dataViewState
    : dataViewApi?.getView?.();
  const summary = buildDataSurfaceSummaryView(dataView);

  setText("v3DataStrictImport", summary.strictImportText);
  setText("v3DataBackupCount", summary.backupCountText);
  setText("v3DataHashBanner", summary.hashBannerSummary);
  setText("v3DataWarnBanner", summary.warnBannerSummary);
  setText("v3DataUsbStatus", summary.usbStatusSummary);
  setText("v3DataRestoreSelection", summary.restoreSelection || DATA_BACKUP_SELECTION_FALLBACK);
  setText("v3DataImportFileSummary", summary.importFileSummary || DATA_IMPORT_FILE_STATUS_FALLBACK);

  syncDataCardStatus(
    "v3DataPolicyCardStatus",
    summary.policyCardStatus
  );
  syncDataCardStatus(
    "v3DataExchangeCardStatus",
    summary.exchangeCardStatus
  );
  syncDataCardStatus(
    "v3DataStorageCardStatus",
    summary.storageCardStatus
  );
  syncDataCardStatus(
    "v3DataAuditCardStatus",
    summary.auditCardStatus
  );
  syncDataCardStatus(
    "v3DataSummaryCardStatus",
    summary.summaryCardStatus
  );
}

function wireDataBridge() {
  const root = document.getElementById("v3DataBridgeRoot");
  if (!root || root.dataset.wired === "1") {
    return;
  }
  root.dataset.wired = "1";

  const moduleContext = {
    getDataApi,
    refreshDataSummary,
    bindDataAction,
    inferDataVoterInputFormat,
    readInputValue,
    readSelectValue,
    parseDataOptionalNumber,
  };
  bindDataImportExportEvents(moduleContext);
  bindDataRecoveryEvents(moduleContext);
  bindDataForecastArchiveEvents(moduleContext);
  bindDataReportingEvents(moduleContext);
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
    return null;
  }

  const summary = buildDataSurfaceSummaryView(view);
  const scope = view?.context && typeof view.context === "object" ? view.context : {};

  const voterLayerView = buildDataVoterLayerSnapshotView(view?.voterLayer);
  const voterSchemaGuide = buildDataVoterSchemaGuideView();

  syncDataImportExportModule({
    view,
    scope: {
      scopeCampaign: formatDataScopeCampaign(scope),
      scopeOffice: formatDataScopeOffice(scope),
      scopeLocks: formatDataScopeLocks(scope),
    },
    voterLayerView,
    voterSchemaGuide,
    summary,
    buildDataImportFileStatus,
    fallbackVoterImportStatus: DATA_VOTER_IMPORT_STATUS_FALLBACK,
    fallbackImportFileStatus: DATA_IMPORT_FILE_STATUS_FALLBACK,
    setText,
    syncButtonDisabledLocal,
    syncVoterAdapterSelect,
  });

  syncDataRecoveryModule({
    view,
    summary,
    fallbackBackupSelection: DATA_BACKUP_SELECTION_FALLBACK,
    setText,
    syncBackupSelect,
    syncButtonDisabledLocal,
  });

  const archiveView = view?.forecastArchive && typeof view.forecastArchive === "object" ? view.forecastArchive : {};
  const selectedEntry = archiveView?.selectedEntry && typeof archiveView.selectedEntry === "object"
    ? archiveView.selectedEntry
    : {};
  const archiveDetail = buildDataArchiveSelectedSnapshotView(selectedEntry);

  const archiveRows = Array.isArray(archiveView.rows) ? archiveView.rows : [];
  const archiveSummary = archiveView?.summary && typeof archiveView.summary === "object"
    ? archiveView.summary
    : {};
  const normalizedArchiveSummary = normalizeDataArchiveSummary(archiveSummary, archiveRows);

  const archiveRowsView = archiveRows.map((row) => ({
    recordedAtText: formatDataArchiveRecordedAt(row?.recordedAt),
    scenarioName: String(row?.scenarioName || "—"),
    forecastMarginText: formatDataSignedDecimal(row?.forecastMargin, 2),
    actualMarginText: row?.actualMargin == null ? "—" : formatDataSignedDecimal(row.actualMargin, 2),
    targetingRowCountText: formatDataArchiveCount(row?.targetingRowCount),
    officePathRowCountText: formatDataArchiveCount(row?.officePathRowCount),
  }));

  syncDataForecastArchiveModule({
    view,
    archiveView,
    archiveDetail,
    archiveRows: archiveRowsView,
    normalizedArchiveSummary,
    buildDataArchiveTableSummaryText,
    fallbackArchiveDetail: DATA_ARCHIVE_DETAIL_FALLBACK,
    setText,
    syncButtonDisabledLocal,
    syncInputValue,
    syncArchiveSelect,
    syncArchiveRows,
  });

  syncDataLearningModule({
    archiveView,
    setText,
    buildDataArchiveLearningView,
    buildDataArchiveLearningSignalsView,
    formatDataSampleCount,
    formatDataPercentFromPct,
    formatDataSignedDecimal,
    formatDataArchiveDecimal,
    DATA_LEARNING_LABEL_FALLBACK,
    DATA_LEARNING_RECOMMENDATION_FALLBACK,
  });

  syncDataReportingModule({
    view,
    setText,
    syncInputValue,
    syncButtonDisabledLocal,
  });

  return view;
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

function syncVoterAdapterSelect(selectEl) {
  const options = listDataVoterAdapterOptions();
  const selected = String(selectEl.value || "").trim() || String(options[0]?.id || "canonical");
  const nextValues = options.map((opt) => `${String(opt.id || "")}::${String(opt.label || "")}`);
  const currentValues = Array.from(selectEl.options)
    .map((opt) => `${String(opt.value || "")}::${String(opt.textContent || "")}`);
  const matches = nextValues.length === currentValues.length && nextValues.every((v, i) => v === currentValues[i]);
  if (!matches) {
    selectEl.innerHTML = "";
    options.forEach((opt) => {
      const item = document.createElement("option");
      item.value = String(opt.id || "");
      item.textContent = String(opt.label || opt.id || "");
      selectEl.appendChild(item);
    });
  }
  if (document.activeElement !== selectEl) {
    const allowed = options.some((opt) => String(opt.id || "") === selected);
    selectEl.value = allowed ? selected : String(options[0]?.id || "canonical");
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

function readSelectValue(id) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    return "";
  }
  return String(el.value || "").trim();
}

function syncButtonDisabledLocal(id, disabled) {
  const btn = document.getElementById(id);
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = !!disabled;
  }
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
