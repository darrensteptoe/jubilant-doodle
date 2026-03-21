import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody,
} from "../../componentFactory.js";
import { createFieldGrid, setText } from "../../surfaceUtils.js";
import {
  addDistrictCandidate,
  addDistrictCandidateHistory,
  applyDistrictTemplateDefaults,
  applyDistrictTargetingPreset,
  exportDistrictTargetingCsv,
  exportDistrictTargetingJson,
  readDistrictBallotSnapshot,
  readDistrictCensusConfigSnapshot,
  readDistrictCensusResultsSnapshot,
  readDistrictControlSnapshot,
  readDistrictElectionDataSummarySnapshot,
  readDistrictFormSnapshot,
  readDistrictSummarySnapshot,
  readDistrictTargetingConfigSnapshot,
  readDistrictTargetingResultsSnapshot,
  readDistrictTemplateSnapshot,
  removeDistrictCandidate,
  removeDistrictCandidateHistory,
  resetDistrictTargetingWeights,
  runDistrictTargeting,
  setDistrictCensusField,
  setDistrictCensusGeoSelection,
  setDistrictFormField,
  setDistrictTargetingField,
  setDistrictUserSplit,
  triggerDistrictCensusAction,
  updateDistrictCandidate,
  updateDistrictCandidateHistory,
} from "../../stateBridge.js";
import {
  classifyDistrictStatusTone,
  deriveDistrictBaselineCardStatus,
  deriveDistrictCensusCardStatus,
  deriveDistrictElectorateCardStatus,
  deriveDistrictRaceCardStatus,
  deriveDistrictSummaryCardStatus,
  deriveDistrictTargetingCardStatus,
} from "../../../../core/districtView.js";
import {
  listDistrictModeOptions,
  listDistrictRaceTypeOptions,
  listDistrictUndecidedModeOptions,
  listDistrictUniverseBasisOptions,
} from "../../../districtOptionRegistry.js";
import { listTemplateDimensionOptions } from "../../../templateRegistry.js";
import {
  listTargetGeoLevels,
  listTargetModelOptions,
} from "../../../targetingRuntime.js";
import {
  listAcsYears,
  listMetricSetOptions,
  listResolutionOptions,
} from "../../../../core/censusModule.js";
import { renderDistrictV2RaceContextCard } from "./raceContext.js";
import { renderDistrictV2ElectorateCard } from "./electorate.js";
import { renderDistrictV2BallotCard } from "./ballot.js";
import { renderDistrictV2CandidateHistoryCard } from "./candidateHistory.js";
import { renderDistrictV2TargetingCard } from "./targetingConfig.js";
import { renderDistrictV2CensusCard } from "./censusConfig.js";
import {
  renderDistrictV2ElectionDataCard,
  syncDistrictV2ElectionDataSummary,
} from "./electionDataSummary.js";
import {
  renderDistrictV2SummaryCard,
  syncDistrictV2Summary,
} from "./summary.js";

const TARGETING_DENSITY_OPTIONS = Object.freeze([
  { value: "none", label: "None" },
  { value: "medium", label: "Medium+" },
  { value: "high", label: "High" },
]);

const DISTRICT_V2_BRIDGE_STATUS_ID = "v3DistrictV2BridgeStatus";

export function renderDistrictV2Surface(mount) {
  console.info("[district_v2] mounted");

  const frame = createCenterStackFrame();
  const center = createCenterStackColumn();

  const raceCard = createCenterModuleCard({
    title: "Race context",
    description: "Race template, election date, weeks remaining, and operating mode.",
    status: "Awaiting context",
  });
  assignCardStatusId(raceCard, "v3DistrictV2RaceCardStatus");

  const electorateCard = createCenterModuleCard({
    title: "Electorate",
    description: "Universe definition, basis, and weighted composition.",
    status: "Awaiting universe",
  });
  assignCardStatusId(electorateCard, "v3DistrictV2ElectorateCardStatus");

  const ballotCard = createCenterModuleCard({
    title: "Ballot",
    description: "Candidate support baseline, undecided handling, and user split.",
    status: "Awaiting ballot",
  });
  assignCardStatusId(ballotCard, "v3DistrictV2BallotCardStatus");

  const candidateHistoryCard = createCenterModuleCard({
    title: "Candidate history",
    description: "Historical office-cycle records feeding baseline confidence.",
    status: "No rows",
  });
  assignCardStatusId(candidateHistoryCard, "v3DistrictV2CandidateHistoryCardStatus");

  const targetingCard = createCenterModuleCard({
    title: "Targeting config",
    description: "Canonical targeting filters, weights, and ranking output.",
    status: "Run targeting",
  });
  assignCardStatusId(targetingCard, "v3DistrictV2TargetingCardStatus");

  const censusCard = createCenterModuleCard({
    title: "Census assumptions",
    description: "Canonical Census inputs with derived GEO/row status.",
    status: "Awaiting GEOs",
  });
  assignCardStatusId(censusCard, "v3DistrictV2CensusCardStatus");

  const electionDataCard = createCenterModuleCard({
    title: "Election data summary",
    description: "Election import quality and downstream benchmark readiness.",
    status: "Awaiting import",
  });
  assignCardStatusId(electionDataCard, "v3DistrictV2ElectionDataCardStatus");

  const summaryCard = createCenterModuleCard({
    title: "District summary",
    description: "Canonical baseline output snapshot for this district.",
    status: "Awaiting baseline",
  });
  assignCardStatusId(summaryCard, "v3DistrictV2SummaryCardStatus");

  const bridgeStatus = document.createElement("div");
  bridgeStatus.id = DISTRICT_V2_BRIDGE_STATUS_ID;
  bridgeStatus.className = "fpe-alert fpe-alert--warn";
  bridgeStatus.hidden = true;

  renderDistrictV2RaceContextCard({ raceCard, createFieldGrid, getCardBody });
  renderDistrictV2ElectorateCard({ electorateCard, createFieldGrid, getCardBody });
  renderDistrictV2BallotCard({ ballotCard, createFieldGrid, getCardBody });
  renderDistrictV2CandidateHistoryCard({ candidateHistoryCard, getCardBody });
  renderDistrictV2TargetingCard({ targetingCard, getCardBody });
  renderDistrictV2CensusCard({ censusCard, getCardBody });
  renderDistrictV2ElectionDataCard({ electionDataCard, getCardBody });
  renderDistrictV2SummaryCard({ summaryCard, getCardBody });

  center.append(
    bridgeStatus,
    createWhyPanel([
      "District V2 uses canonical snapshots for inputs and derived snapshots for outputs.",
      "All writes dispatch through bridge action methods; no District-only pending-write hold path is used.",
      "Modules follow one full-width center stack contract with no mixed card widths.",
    ]),
    raceCard,
    electorateCard,
    ballotCard,
    candidateHistoryCard,
    targetingCard,
    censusCard,
    electionDataCard,
    summaryCard,
  );

  frame.append(center);
  mount.innerHTML = "";
  mount.append(frame);

  bindDistrictV2RaceContextHandlers();
  bindDistrictV2ElectorateHandlers();
  bindDistrictV2BallotHandlers();
  bindDistrictV2CandidateHistoryHandlers();
  bindDistrictV2TargetingHandlers();
  bindDistrictV2CensusHandlers();

  refreshDistrictV2Surface();
  return refreshDistrictV2Surface;
}

export function refreshDistrictV2Surface() {
  const controlSnapshot = readDistrictControlSnapshot();
  const templateSnapshot = readDistrictTemplateSnapshot();
  const formSnapshot = readDistrictFormSnapshot();
  const ballotSnapshot = readDistrictBallotSnapshot();
  const targetingConfigSnapshot = readDistrictTargetingConfigSnapshot();
  const targetingResultsSnapshot = readDistrictTargetingResultsSnapshot();
  const censusConfigSnapshot = readDistrictCensusConfigSnapshot();
  const censusResultsSnapshot = readDistrictCensusResultsSnapshot();
  const electionDataSummarySnapshot = readDistrictElectionDataSummarySnapshot();
  const snapshot = readDistrictSummarySnapshot();

  const hasBridgeView = !!(
    templateSnapshot
    || formSnapshot
    || ballotSnapshot
    || targetingConfigSnapshot
    || targetingResultsSnapshot
    || censusConfigSnapshot
    || censusResultsSnapshot
    || electionDataSummarySnapshot
    || snapshot
  );

  syncDistrictV2BridgeAvailability(hasBridgeView);
  if (!hasBridgeView) {
    return;
  }

  syncDistrictV2RaceContext(templateSnapshot, formSnapshot, controlSnapshot);
  syncDistrictV2Electorate(formSnapshot, controlSnapshot);
  syncDistrictV2Ballot(ballotSnapshot, controlSnapshot);
  syncDistrictV2CandidateHistory(ballotSnapshot, controlSnapshot);
  syncDistrictV2Targeting(targetingConfigSnapshot, targetingResultsSnapshot);
  syncDistrictV2Census(censusConfigSnapshot, censusResultsSnapshot);
  syncDistrictV2ElectionDataSummary(electionDataSummarySnapshot);
  syncDistrictV2Summary(snapshot);

  syncDistrictV2CardStatus("v3DistrictV2RaceCardStatus", deriveDistrictRaceCardStatus({
    raceType: templateSnapshot?.raceType,
    electionDate: formSnapshot?.electionDate,
    mode: formSnapshot?.mode,
  }));

  syncDistrictV2CardStatus("v3DistrictV2ElectorateCardStatus", deriveDistrictElectorateCardStatus({
    universe: formSnapshot?.universeSize,
    basis: formSnapshot?.universeBasis,
    sourceNote: formSnapshot?.sourceNote,
  }));

  syncDistrictV2CardStatus("v3DistrictV2BallotCardStatus", deriveDistrictBaselineCardStatus({
    warning: ballotSnapshot?.warningText,
    supportTotal: ballotSnapshot?.supportTotalText,
  }));

  const historyCount = Array.isArray(ballotSnapshot?.candidateHistoryRecords)
    ? ballotSnapshot.candidateHistoryRecords.length
    : 0;
  syncDistrictV2CardStatus("v3DistrictV2CandidateHistoryCardStatus", historyCount > 0 ? `${historyCount} row${historyCount === 1 ? "" : "s"}` : "No rows");

  const targetRows = Array.isArray(targetingResultsSnapshot?.rows)
    ? targetingResultsSnapshot.rows.length
    : 0;
  syncDistrictV2CardStatus("v3DistrictV2TargetingCardStatus", deriveDistrictTargetingCardStatus({
    status: targetingResultsSnapshot?.statusText,
    rowCount: targetRows,
  }));

  syncDistrictV2CardStatus("v3DistrictV2CensusCardStatus", deriveDistrictCensusCardStatus({
    status: censusResultsSnapshot?.statusText,
    geoStats: censusResultsSnapshot?.geoStatsText,
  }));

  const electionRows = Number(electionDataSummarySnapshot?.normalizedRowCount || 0);
  syncDistrictV2CardStatus("v3DistrictV2ElectionDataCardStatus", electionRows > 0 ? `${electionRows.toLocaleString("en-US")} rows` : "Awaiting import");

  syncDistrictV2CardStatus("v3DistrictV2SummaryCardStatus", deriveDistrictSummaryCardStatus(snapshot || {}));
}

function handleDistrictV2MutationResult(result, source) {
  if (result && typeof result === "object" && result.ok === false) {
    const code = String(result.code || "unknown").trim();
    console.warn(`[district_v2] mutation rejected (${source}): ${code}`, result);
  }
  refreshDistrictV2Surface();
}

function syncDistrictV2BridgeAvailability(hasBridgeView) {
  const status = document.getElementById(DISTRICT_V2_BRIDGE_STATUS_ID);
  if (!(status instanceof HTMLElement)) {
    return;
  }
  status.hidden = hasBridgeView;
  status.textContent = hasBridgeView
    ? ""
    : "District bridge unavailable. District V2 controls are disabled until runtime bridge is ready.";
}

function syncDistrictV2RaceContext(templateSnapshot, formSnapshot, controlSnapshot) {
  const template = templateSnapshot && typeof templateSnapshot === "object" ? templateSnapshot : {};
  const form = formSnapshot && typeof formSnapshot === "object" ? formSnapshot : {};

  syncSelectOptions("v3DistrictV2RaceType", listDistrictRaceTypeOptions(), template.raceType || form.raceType || "");
  syncInputValueFromRaw("v3DistrictV2ElectionDate", form.electionDate);
  syncInputValueFromRaw("v3DistrictV2WeeksRemaining", form.weeksRemaining);
  syncSelectOptions("v3DistrictV2Mode", listDistrictModeOptions(), form.mode);

  syncSelectOptions("v3DistrictV2OfficeLevel", listTemplateDimensionOptions("officeLevel"), template.officeLevel);
  syncSelectOptions("v3DistrictV2ElectionType", listTemplateDimensionOptions("electionType"), template.electionType);
  syncSelectOptions("v3DistrictV2SeatContext", listTemplateDimensionOptions("seatContext"), template.seatContext);
  syncSelectOptions("v3DistrictV2PartisanshipMode", listTemplateDimensionOptions("partisanshipMode"), template.partisanshipMode);
  syncSelectOptions("v3DistrictV2SalienceLevel", listTemplateDimensionOptions("salienceLevel"), template.salienceLevel);

  const templateMeta = [
    template.appliedTemplateId ? `template ${template.appliedTemplateId}` : "",
    template.appliedVersion ? `v${template.appliedVersion}` : "",
    template.assumptionsProfile ? `profile ${template.assumptionsProfile}` : "",
  ].filter(Boolean).join(" · ");
  setText("v3DistrictV2TemplateMeta", templateMeta || "Template profile unavailable.");

  const locked = !!controlSnapshot?.locked;
  const disabledMap = controlSnapshot?.disabledMap && typeof controlSnapshot.disabledMap === "object"
    ? controlSnapshot.disabledMap
    : {};

  applyDisabled("v3DistrictV2RaceType", locked || !!disabledMap.raceType);
  applyDisabled("v3DistrictV2ElectionDate", locked || !!disabledMap.electionDate);
  applyDisabled("v3DistrictV2WeeksRemaining", locked || !!disabledMap.weeksRemaining);
  applyDisabled("v3DistrictV2Mode", locked || !!disabledMap.mode);
  applyDisabled("v3DistrictV2OfficeLevel", locked || !!disabledMap.officeLevel);
  applyDisabled("v3DistrictV2ElectionType", locked || !!disabledMap.electionType);
  applyDisabled("v3DistrictV2SeatContext", locked || !!disabledMap.seatContext);
  applyDisabled("v3DistrictV2PartisanshipMode", locked || !!disabledMap.partisanshipMode);
  applyDisabled("v3DistrictV2SalienceLevel", locked || !!disabledMap.salienceLevel);
  applyDisabled("v3BtnDistrictV2ApplyTemplateDefaults", locked);
}

function syncDistrictV2Electorate(formSnapshot, controlSnapshot) {
  const form = formSnapshot && typeof formSnapshot === "object" ? formSnapshot : {};

  syncInputValueFromRaw("v3DistrictV2UniverseSize", form.universeSize);
  syncSelectOptions("v3DistrictV2UniverseBasis", listDistrictUniverseBasisOptions(), form.universeBasis);
  syncInputValueFromRaw("v3DistrictV2SourceNote", form.sourceNote);
  syncCheckboxCheckedFromRaw("v3DistrictV2Universe16Enabled", form.universe16Enabled);
  syncInputValueFromRaw("v3DistrictV2UniverseDemPct", form.universe16DemPct);
  syncInputValueFromRaw("v3DistrictV2UniverseRepPct", form.universe16RepPct);
  syncInputValueFromRaw("v3DistrictV2UniverseNpaPct", form.universe16NpaPct);
  syncInputValueFromRaw("v3DistrictV2UniverseOtherPct", form.universe16OtherPct);
  syncInputValueFromRaw("v3DistrictV2RetentionFactor", form.retentionFactor);

  const locked = !!controlSnapshot?.locked;
  const disabledMap = controlSnapshot?.disabledMap && typeof controlSnapshot.disabledMap === "object"
    ? controlSnapshot.disabledMap
    : {};
  applyDisabled("v3DistrictV2UniverseSize", locked || !!disabledMap.universeSize);
  applyDisabled("v3DistrictV2UniverseBasis", locked || !!disabledMap.universeBasis);
  applyDisabled("v3DistrictV2SourceNote", locked || !!disabledMap.sourceNote);
  applyDisabled("v3DistrictV2Universe16Enabled", locked || !!disabledMap.universe16Enabled);
  applyDisabled("v3DistrictV2UniverseDemPct", locked || !!disabledMap.universe16DemPct);
  applyDisabled("v3DistrictV2UniverseRepPct", locked || !!disabledMap.universe16RepPct);
  applyDisabled("v3DistrictV2UniverseNpaPct", locked || !!disabledMap.universe16NpaPct);
  applyDisabled("v3DistrictV2UniverseOtherPct", locked || !!disabledMap.universe16OtherPct);
  applyDisabled("v3DistrictV2RetentionFactor", locked || !!disabledMap.retentionFactor);
}

function syncDistrictV2Ballot(ballotSnapshot, controlSnapshot) {
  const ballot = ballotSnapshot && typeof ballotSnapshot === "object" ? ballotSnapshot : {};
  const candidates = Array.isArray(ballot.candidates) ? ballot.candidates : [];

  syncSelectOptions(
    "v3DistrictV2YourCandidate",
    candidates.map((row) => ({ value: String(row.id || ""), label: String(row.name || row.id || "").trim() || String(row.id || "") })),
    ballot.yourCandidateId,
    { placeholder: "Select candidate" },
  );
  syncInputValueFromRaw("v3DistrictV2UndecidedPct", ballot.undecidedPct);
  syncSelectOptions("v3DistrictV2UndecidedMode", listDistrictUndecidedModeOptions(), ballot.undecidedMode);

  setText("v3DistrictV2SupportTotal", String(ballot.supportTotalText || "—") || "—");

  const warning = String(ballot.warningText || "").trim();
  const warningEl = document.getElementById("v3DistrictV2CandWarn");
  if (warningEl instanceof HTMLElement) {
    warningEl.hidden = !warning;
    warningEl.textContent = warning;
  }

  syncDistrictV2CandidateTable(ballot, controlSnapshot);
  syncDistrictV2UserSplitTable(ballot, controlSnapshot);

  const locked = !!controlSnapshot?.locked;
  applyDisabled("v3DistrictV2YourCandidate", locked);
  applyDisabled("v3DistrictV2UndecidedPct", locked);
  applyDisabled("v3DistrictV2UndecidedMode", locked);
  applyDisabled("v3BtnDistrictV2AddCandidate", locked);
}

function syncDistrictV2CandidateTable(ballotSnapshot, controlSnapshot) {
  const tbody = document.getElementById("v3DistrictV2CandTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  const candidates = Array.isArray(ballotSnapshot?.candidates) ? ballotSnapshot.candidates : [];
  const locked = !!controlSnapshot?.locked;

  if (!candidates.length) {
    tbody.innerHTML = `<tr><td class="muted" colspan="3">No candidates yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = candidates.map((row) => {
    const candidateId = escapeHtml(String(row?.id || ""));
    const name = escapeHtml(String(row?.name || ""));
    const support = row?.supportPct == null ? "" : escapeHtml(String(row.supportPct));
    const canRemove = !locked && !!row?.canRemove;
    return `
      <tr data-candidate-id="${candidateId}">
        <td>
          <input class="fpe-input" data-v3d2-candidate-id="${candidateId}" data-v3d2-candidate-field="name" type="text" value="${name}" ${locked ? "disabled" : ""}/>
        </td>
        <td class="num">
          <input class="fpe-input" data-v3d2-candidate-id="${candidateId}" data-v3d2-candidate-field="supportPct" max="100" min="0" step="0.1" type="number" value="${support}" ${locked ? "disabled" : ""}/>
        </td>
        <td>
          ${canRemove ? `<button class="fpe-btn fpe-btn--ghost" data-v3d2-remove-candidate="${candidateId}" type="button">Remove</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}

function syncDistrictV2UserSplitTable(ballotSnapshot, controlSnapshot) {
  const wrap = document.getElementById("v3DistrictV2UserSplitWrap");
  const list = document.getElementById("v3DistrictV2UserSplitList");
  if (!(wrap instanceof HTMLElement) || !(list instanceof HTMLElement)) {
    return;
  }

  const rows = Array.isArray(ballotSnapshot?.userSplitRows) ? ballotSnapshot.userSplitRows : [];
  const visible = !!ballotSnapshot?.userSplitVisible;
  wrap.hidden = !visible;
  if (!visible) {
    list.innerHTML = "";
    return;
  }

  const locked = !!controlSnapshot?.locked;
  list.innerHTML = rows.map((row) => {
    const candidateId = escapeHtml(String(row?.id || ""));
    const label = escapeHtml(String(row?.name || row?.id || ""));
    const value = row?.value == null ? "" : escapeHtml(String(row.value));
    return `
      <div class="field">
        <label class="fpe-control-label" for="v3DistrictV2UserSplit_${candidateId}">${label}</label>
        <input class="fpe-input" data-v3d2-user-split-id="${candidateId}" id="v3DistrictV2UserSplit_${candidateId}" max="100" min="0" step="0.1" type="number" value="${value}" ${locked ? "disabled" : ""}/>
      </div>
    `;
  }).join("");
}

function syncDistrictV2CandidateHistory(ballotSnapshot, controlSnapshot) {
  const tbody = document.getElementById("v3DistrictV2CandidateHistoryTbody");
  const summary = document.getElementById("v3DistrictV2CandidateHistorySummary");
  const warn = document.getElementById("v3DistrictV2CandidateHistoryWarn");

  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  const rows = Array.isArray(ballotSnapshot?.candidateHistoryRecords)
    ? ballotSnapshot.candidateHistoryRecords
    : [];
  const electionTypeOptions = normalizeSnapshotOptions(ballotSnapshot?.candidateHistoryOptions?.electionType);
  const incumbencyOptions = normalizeSnapshotOptions(ballotSnapshot?.candidateHistoryOptions?.incumbencyStatus);
  const locked = !!controlSnapshot?.locked;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td class="muted" colspan="12">No candidate history rows.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map((row) => {
      const recordId = escapeHtml(String(row?.recordId || ""));
      return `
        <tr data-record-id="${recordId}">
          <td><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="office" type="text" value="${escapeHtml(String(row?.office || ""))}" ${locked ? "disabled" : ""}/></td>
          <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="cycleYear" min="1900" step="1" type="number" value="${row?.cycleYear == null ? "" : escapeHtml(String(row.cycleYear))}" ${locked ? "disabled" : ""}/></td>
          <td>${buildSelect("history-election", recordId, "electionType", electionTypeOptions, row?.electionType, locked)}</td>
          <td><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="candidateName" type="text" value="${escapeHtml(String(row?.candidateName || ""))}" ${locked ? "disabled" : ""}/></td>
          <td><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="party" type="text" value="${escapeHtml(String(row?.party || ""))}" ${locked ? "disabled" : ""}/></td>
          <td>${buildSelect("history-incumbency", recordId, "incumbencyStatus", incumbencyOptions, row?.incumbencyStatus, locked)}</td>
          <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="voteShare" max="100" min="0" step="0.1" type="number" value="${row?.voteShare == null ? "" : escapeHtml(String(row.voteShare))}" ${locked ? "disabled" : ""}/></td>
          <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="margin" step="0.1" type="number" value="${row?.margin == null ? "" : escapeHtml(String(row.margin))}" ${locked ? "disabled" : ""}/></td>
          <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="turnoutContext" max="100" min="0" step="0.1" type="number" value="${row?.turnoutContext == null ? "" : escapeHtml(String(row.turnoutContext))}" ${locked ? "disabled" : ""}/></td>
          <td class="num"><input data-v3d2-history-id="${recordId}" data-v3d2-history-field="repeatCandidate" type="checkbox" ${row?.repeatCandidate ? "checked" : ""} ${locked ? "disabled" : ""}/></td>
          <td class="num"><input class="fpe-input" data-v3d2-history-id="${recordId}" data-v3d2-history-field="overUnderPerformancePct" step="0.1" type="number" value="${row?.overUnderPerformancePct == null ? "" : escapeHtml(String(row.overUnderPerformancePct))}" ${locked ? "disabled" : ""}/></td>
          <td>${locked ? "" : `<button class="fpe-btn fpe-btn--ghost" data-v3d2-remove-history="${recordId}" type="button">Remove</button>`}</td>
        </tr>
      `;
    }).join("");
  }

  if (summary instanceof HTMLElement) {
    summary.textContent = String(ballotSnapshot?.candidateHistorySummaryText || "No candidate history rows.") || "No candidate history rows.";
  }
  if (warn instanceof HTMLElement) {
    const warningText = String(ballotSnapshot?.candidateHistoryWarningText || "").trim();
    warn.hidden = !warningText;
    warn.textContent = warningText;
  }

  applyDisabled("v3BtnDistrictV2AddCandidateHistory", locked);
}

function syncDistrictV2Targeting(configSnapshot, resultsSnapshot) {
  const config = configSnapshot && typeof configSnapshot === "object" ? configSnapshot : {};
  const results = resultsSnapshot && typeof resultsSnapshot === "object" ? resultsSnapshot : {};

  syncSelectOptions("v3DistrictV2TargetingGeoLevel", normalizeTargetingOptions(listTargetGeoLevels()), config.geoLevel);
  syncSelectOptions("v3DistrictV2TargetingModelId", normalizeTargetingOptions(listTargetModelOptions()), config.modelId || config.presetId);
  syncInputValueFromRaw("v3DistrictV2TargetingTopN", config.topN);
  syncInputValueFromRaw("v3DistrictV2TargetingMinHousingUnits", config.minHousingUnits);
  syncInputValueFromRaw("v3DistrictV2TargetingMinPopulation", config.minPopulation);
  syncInputValueFromRaw("v3DistrictV2TargetingMinScore", config.minScore);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingOnlyRaceFootprint", config.onlyRaceFootprint);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingPrioritizeYoung", config.prioritizeYoung);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingPrioritizeRenters", config.prioritizeRenters);
  syncCheckboxCheckedFromRaw("v3DistrictV2TargetingAvoidHighMultiUnit", config.avoidHighMultiUnit);
  syncSelectOptions("v3DistrictV2TargetingDensityFloor", TARGETING_DENSITY_OPTIONS, config.densityFloor, { placeholder: "none" });
  syncInputValueFromRaw("v3DistrictV2TargetingWeightVotePotential", config.weightVotePotential);
  syncInputValueFromRaw("v3DistrictV2TargetingWeightTurnoutOpportunity", config.weightTurnoutOpportunity);
  syncInputValueFromRaw("v3DistrictV2TargetingWeightPersuasionIndex", config.weightPersuasionIndex);
  syncInputValueFromRaw("v3DistrictV2TargetingWeightFieldEfficiency", config.weightFieldEfficiency);

  setText("v3DistrictV2TargetingStatus", String(results.statusText || "Run targeting.") || "Run targeting.");
  setText("v3DistrictV2TargetingMeta", String(results.metaText || "") || "-");
  renderDistrictV2TargetingRows(results.rows);

  const locked = !!config.controlsLocked;
  applyDisabled("v3DistrictV2TargetingGeoLevel", locked);
  applyDisabled("v3DistrictV2TargetingModelId", locked);
  applyDisabled("v3DistrictV2TargetingTopN", locked);
  applyDisabled("v3DistrictV2TargetingMinHousingUnits", locked);
  applyDisabled("v3DistrictV2TargetingMinPopulation", locked);
  applyDisabled("v3DistrictV2TargetingMinScore", locked);
  applyDisabled("v3DistrictV2TargetingOnlyRaceFootprint", locked);
  applyDisabled("v3DistrictV2TargetingPrioritizeYoung", locked);
  applyDisabled("v3DistrictV2TargetingPrioritizeRenters", locked);
  applyDisabled("v3DistrictV2TargetingAvoidHighMultiUnit", locked);
  applyDisabled("v3DistrictV2TargetingDensityFloor", locked);
  applyDisabled("v3DistrictV2TargetingWeightVotePotential", locked);
  applyDisabled("v3DistrictV2TargetingWeightTurnoutOpportunity", locked);
  applyDisabled("v3DistrictV2TargetingWeightPersuasionIndex", locked);
  applyDisabled("v3DistrictV2TargetingWeightFieldEfficiency", locked);
  applyDisabled("v3BtnDistrictV2TargetingResetWeights", locked || !config.canResetWeights);
  applyDisabled("v3BtnDistrictV2RunTargeting", locked || !config.canRun);
  applyDisabled("v3BtnDistrictV2ExportTargetingCsv", locked || !config.canExport);
  applyDisabled("v3BtnDistrictV2ExportTargetingJson", locked || !config.canExport);
}

function syncDistrictV2Census(configSnapshot, resultsSnapshot) {
  const config = configSnapshot && typeof configSnapshot === "object" ? configSnapshot : {};
  const results = resultsSnapshot && typeof resultsSnapshot === "object" ? resultsSnapshot : {};

  syncInputValueFromRaw("v3DistrictV2CensusApiKey", config.apiKey);
  syncSelectOptions("v3DistrictV2CensusAcsYear", normalizeIdOptions(listAcsYears()), config.year);
  syncSelectOptions("v3DistrictV2CensusResolution", normalizeIdOptions(listResolutionOptions()), config.resolution);
  syncSelectOptions("v3DistrictV2CensusStateFips", normalizeSnapshotOptions(config.stateOptions), config.stateFips, { placeholder: "Select state" });
  syncSelectOptions("v3DistrictV2CensusCountyFips", normalizeSnapshotOptions(config.countyOptions), config.countyFips, { placeholder: "Select county" });
  syncSelectOptions("v3DistrictV2CensusPlaceFips", normalizeSnapshotOptions(config.placeOptions), config.placeFips, { placeholder: "Select place" });
  syncSelectOptions("v3DistrictV2CensusMetricSet", normalizeIdOptions(listMetricSetOptions()), config.metricSet);
  syncSelectOptions("v3DistrictV2CensusTractFilter", normalizeSnapshotOptions(config.tractFilterOptions), config.tractFilter, { placeholder: "All tracts" });
  syncInputValueFromRaw("v3DistrictV2CensusGeoSearch", config.geoSearch);
  syncInputValueFromRaw("v3DistrictV2CensusGeoPaste", config.geoPaste);
  syncMultiSelectOptions("v3DistrictV2CensusGeoSelect", normalizeSnapshotOptions(config.geoSelectOptions), config.geoSelectOptions);
  syncCheckboxCheckedFromRaw("v3DistrictV2CensusApplyAdjustments", config.applyAdjustedAssumptions);
  syncCheckboxCheckedFromRaw("v3DistrictV2CensusMapQaVtdOverlay", config.mapQaVtdOverlay);

  setText("v3DistrictV2CensusContextHint", String(results.contextHint || "Set state and resolution to define Census context.") || "Set state and resolution to define Census context.");
  setText("v3DistrictV2CensusStatus", String(results.statusText || "Ready.") || "Ready.");
  setText("v3DistrictV2CensusGeoStats", String(results.geoStatsText || "0 selected of 0 GEOs. 0 rows loaded.") || "0 selected of 0 GEOs. 0 rows loaded.");
  setText("v3DistrictV2CensusLastFetch", String(results.lastFetchText || "No fetch yet.") || "No fetch yet.");
  setText("v3DistrictV2CensusSelectionSummary", String(results.selectionSummaryText || "No GEO selected.") || "No GEO selected.");

  renderDistrictV2CensusAggregateRows(results.aggregateRows);

  const controlsLocked = !!config.controlsLocked;
  const disabledMap = config.disabledMap && typeof config.disabledMap === "object"
    ? config.disabledMap
    : {};

  applyDisabled("v3DistrictV2CensusApiKey", controlsLocked || !!disabledMap.apiKey);
  applyDisabled("v3DistrictV2CensusAcsYear", controlsLocked || !!disabledMap.year);
  applyDisabled("v3DistrictV2CensusResolution", controlsLocked || !!disabledMap.resolution);
  applyDisabled("v3DistrictV2CensusStateFips", controlsLocked || !!disabledMap.stateFips);
  applyDisabled("v3DistrictV2CensusCountyFips", controlsLocked || !!disabledMap.countyFips);
  applyDisabled("v3DistrictV2CensusPlaceFips", controlsLocked || !!disabledMap.placeFips);
  applyDisabled("v3DistrictV2CensusMetricSet", controlsLocked || !!disabledMap.metricSet);
  applyDisabled("v3DistrictV2CensusTractFilter", controlsLocked || !!disabledMap.tractFilter);
  applyDisabled("v3DistrictV2CensusGeoSearch", controlsLocked || !!disabledMap.geoSearch);
  applyDisabled("v3DistrictV2CensusGeoPaste", controlsLocked || !!disabledMap.geoPaste);
  applyDisabled("v3DistrictV2CensusGeoSelect", controlsLocked || !!disabledMap.geoSelect);
  applyDisabled("v3DistrictV2CensusApplyAdjustments", controlsLocked || !!disabledMap.applyAdjustedAssumptions);
  applyDisabled("v3DistrictV2CensusMapQaVtdOverlay", controlsLocked || !!disabledMap.mapQaVtdOverlay);
  applyDisabled("v3BtnDistrictV2CensusLoadGeo", controlsLocked || !!disabledMap.loadGeo);
  applyDisabled("v3BtnDistrictV2CensusApplyGeoPaste", controlsLocked || !!disabledMap.applyGeoPaste);
  applyDisabled("v3BtnDistrictV2CensusSelectAll", controlsLocked || !!disabledMap.selectAllGeo);
  applyDisabled("v3BtnDistrictV2CensusClearSelection", controlsLocked || !!disabledMap.clearGeoSelection);
  applyDisabled("v3BtnDistrictV2CensusFetchRows", controlsLocked || !!disabledMap.fetchRows);
}

function renderDistrictV2TargetingRows(rows) {
  const tbody = document.getElementById("v3DistrictV2TargetingResultsTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = `<tr><td class="muted" colspan="6">Run targeting to generate ranked GEOs.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((row) => `
    <tr>
      <td>${escapeHtml(String(row?.rank || ""))}</td>
      <td>${escapeHtml(String(row?.geography || ""))}</td>
      <td class="num">${escapeHtml(String(row?.score || ""))}</td>
      <td class="num">${escapeHtml(String(row?.votesPerHour || ""))}</td>
      <td>${escapeHtml(String(row?.reason || ""))}</td>
      <td>${escapeHtml(String(row?.flags || ""))}</td>
    </tr>
  `).join("");
}

function renderDistrictV2CensusAggregateRows(rows) {
  const tbody = document.getElementById("v3DistrictV2CensusAggregateTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = `<tr><td class="muted" colspan="2">No ACS rows loaded.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((row) => {
    const cells = Array.isArray(row) ? row : [];
    const label = escapeHtml(String(cells[0] || ""));
    const value = escapeHtml(String(cells[1] || ""));
    return `<tr><td>${label}</td><td class="num">${value}</td></tr>`;
  }).join("");
}

function bindDistrictV2RaceContextHandlers() {
  bindDistrictV2FormSelect("v3DistrictV2RaceType", "raceType");
  bindDistrictV2FormField("v3DistrictV2ElectionDate", "electionDate");
  bindDistrictV2FormField("v3DistrictV2WeeksRemaining", "weeksRemaining");
  bindDistrictV2FormSelect("v3DistrictV2Mode", "mode");

  bindDistrictV2FormSelect("v3DistrictV2OfficeLevel", "officeLevel");
  bindDistrictV2FormSelect("v3DistrictV2ElectionType", "electionType");
  bindDistrictV2FormSelect("v3DistrictV2SeatContext", "seatContext");
  bindDistrictV2FormSelect("v3DistrictV2PartisanshipMode", "partisanshipMode");
  bindDistrictV2FormSelect("v3DistrictV2SalienceLevel", "salienceLevel");

  const applyBtn = document.getElementById("v3BtnDistrictV2ApplyTemplateDefaults");
  if (applyBtn instanceof HTMLButtonElement && applyBtn.dataset.v3DistrictV2Bound !== "1") {
    applyBtn.dataset.v3DistrictV2Bound = "1";
    applyBtn.addEventListener("click", () => {
      const result = applyDistrictTemplateDefaults("all");
      handleDistrictV2MutationResult(result, "applyTemplateDefaults");
    });
  }
}

function bindDistrictV2ElectorateHandlers() {
  bindDistrictV2FormField("v3DistrictV2UniverseSize", "universeSize");
  bindDistrictV2FormSelect("v3DistrictV2UniverseBasis", "universeBasis");
  bindDistrictV2FormField("v3DistrictV2SourceNote", "sourceNote");

  bindDistrictV2FormCheckbox("v3DistrictV2Universe16Enabled", "universe16Enabled");
  bindDistrictV2FormField("v3DistrictV2UniverseDemPct", "universe16DemPct");
  bindDistrictV2FormField("v3DistrictV2UniverseRepPct", "universe16RepPct");
  bindDistrictV2FormField("v3DistrictV2UniverseNpaPct", "universe16NpaPct");
  bindDistrictV2FormField("v3DistrictV2UniverseOtherPct", "universe16OtherPct");
  bindDistrictV2FormField("v3DistrictV2RetentionFactor", "retentionFactor");
}

function bindDistrictV2BallotHandlers() {
  bindDistrictV2FormSelect("v3DistrictV2YourCandidate", "yourCandidate");
  bindDistrictV2FormField("v3DistrictV2UndecidedPct", "undecidedPct");
  bindDistrictV2FormSelect("v3DistrictV2UndecidedMode", "undecidedMode");

  const addBtn = document.getElementById("v3BtnDistrictV2AddCandidate");
  if (addBtn instanceof HTMLButtonElement && addBtn.dataset.v3DistrictV2Bound !== "1") {
    addBtn.dataset.v3DistrictV2Bound = "1";
    addBtn.addEventListener("click", () => {
      const result = addDistrictCandidate();
      handleDistrictV2MutationResult(result, "addCandidate");
    });
  }

  const candidateBody = document.getElementById("v3DistrictV2CandTbody");
  if (candidateBody instanceof HTMLElement && candidateBody.dataset.v3DistrictV2Bound !== "1") {
    candidateBody.dataset.v3DistrictV2Bound = "1";

    candidateBody.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      const candidateId = String(target.dataset.v3d2CandidateId || "").trim();
      const field = String(target.dataset.v3d2CandidateField || "").trim();
      if (!candidateId || !field) {
        return;
      }
      const value = target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
      const result = updateDistrictCandidate(candidateId, field, value);
      handleDistrictV2MutationResult(result, `updateCandidate:${field}`);
    });

    candidateBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest("[data-v3d2-remove-candidate]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const candidateId = String(button.dataset.v3d2RemoveCandidate || "").trim();
      if (!candidateId) {
        return;
      }
      const result = removeDistrictCandidate(candidateId);
      handleDistrictV2MutationResult(result, "removeCandidate");
    });
  }

  const userSplitList = document.getElementById("v3DistrictV2UserSplitList");
  if (userSplitList instanceof HTMLElement && userSplitList.dataset.v3DistrictV2Bound !== "1") {
    userSplitList.dataset.v3DistrictV2Bound = "1";
    userSplitList.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const candidateId = String(target.dataset.v3d2UserSplitId || "").trim();
      if (!candidateId) {
        return;
      }
      const result = setDistrictUserSplit(candidateId, target.value);
      handleDistrictV2MutationResult(result, "setUserSplit");
    });
  }
}

function bindDistrictV2CandidateHistoryHandlers() {
  const addBtn = document.getElementById("v3BtnDistrictV2AddCandidateHistory");
  if (addBtn instanceof HTMLButtonElement && addBtn.dataset.v3DistrictV2Bound !== "1") {
    addBtn.dataset.v3DistrictV2Bound = "1";
    addBtn.addEventListener("click", () => {
      const result = addDistrictCandidateHistory();
      handleDistrictV2MutationResult(result, "addCandidateHistory");
    });
  }

  const historyBody = document.getElementById("v3DistrictV2CandidateHistoryTbody");
  if (historyBody instanceof HTMLElement && historyBody.dataset.v3DistrictV2Bound !== "1") {
    historyBody.dataset.v3DistrictV2Bound = "1";

    historyBody.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      const recordId = String(target.dataset.v3d2HistoryId || "").trim();
      const field = String(target.dataset.v3d2HistoryField || "").trim();
      if (!recordId || !field) {
        return;
      }
      const value = target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
      const result = updateDistrictCandidateHistory(recordId, field, value);
      handleDistrictV2MutationResult(result, `updateCandidateHistory:${field}`);
    });

    historyBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest("[data-v3d2-remove-history]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const recordId = String(button.dataset.v3d2RemoveHistory || "").trim();
      if (!recordId) {
        return;
      }
      const result = removeDistrictCandidateHistory(recordId);
      handleDistrictV2MutationResult(result, "removeCandidateHistory");
    });
  }
}

function bindDistrictV2TargetingHandlers() {
  bindDistrictV2TargetingSelect("v3DistrictV2TargetingGeoLevel", "geoLevel");
  bindDistrictV2TargetingModelSelect("v3DistrictV2TargetingModelId");
  bindDistrictV2TargetingField("v3DistrictV2TargetingTopN", "topN");
  bindDistrictV2TargetingField("v3DistrictV2TargetingMinHousingUnits", "minHousingUnits");
  bindDistrictV2TargetingField("v3DistrictV2TargetingMinPopulation", "minPopulation");
  bindDistrictV2TargetingField("v3DistrictV2TargetingMinScore", "minScore");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingOnlyRaceFootprint", "onlyRaceFootprint");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingPrioritizeYoung", "prioritizeYoung");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingPrioritizeRenters", "prioritizeRenters");
  bindDistrictV2TargetingCheckbox("v3DistrictV2TargetingAvoidHighMultiUnit", "avoidHighMultiUnit");
  bindDistrictV2TargetingSelect("v3DistrictV2TargetingDensityFloor", "densityFloor");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightVotePotential", "weightVotePotential");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightTurnoutOpportunity", "weightTurnoutOpportunity");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightPersuasionIndex", "weightPersuasionIndex");
  bindDistrictV2TargetingField("v3DistrictV2TargetingWeightFieldEfficiency", "weightFieldEfficiency");

  bindDistrictV2TargetingAction("v3BtnDistrictV2TargetingResetWeights", () => resetDistrictTargetingWeights(), "resetTargetingWeights");
  bindDistrictV2TargetingAction("v3BtnDistrictV2RunTargeting", () => runDistrictTargeting(), "runTargeting");
  bindDistrictV2TargetingAction("v3BtnDistrictV2ExportTargetingCsv", () => exportDistrictTargetingCsv(), "exportTargetingCsv");
  bindDistrictV2TargetingAction("v3BtnDistrictV2ExportTargetingJson", () => exportDistrictTargetingJson(), "exportTargetingJson");
}

function bindDistrictV2CensusHandlers() {
  bindDistrictV2CensusField("v3DistrictV2CensusApiKey", "apiKey", "input");
  bindDistrictV2CensusField("v3DistrictV2CensusAcsYear", "year", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusResolution", "resolution", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusStateFips", "stateFips", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusCountyFips", "countyFips", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusPlaceFips", "placeFips", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusMetricSet", "metricSet", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusTractFilter", "tractFilter", "change");
  bindDistrictV2CensusField("v3DistrictV2CensusGeoSearch", "geoSearch", "input");
  bindDistrictV2CensusField("v3DistrictV2CensusGeoPaste", "geoPaste", "input");

  bindDistrictV2CensusCheckbox("v3DistrictV2CensusApplyAdjustments", "applyAdjustedAssumptions");
  bindDistrictV2CensusCheckbox("v3DistrictV2CensusMapQaVtdOverlay", "mapQaVtdOverlay");
  bindDistrictV2CensusGeoSelection("v3DistrictV2CensusGeoSelect");

  bindDistrictV2CensusAction("v3BtnDistrictV2CensusLoadGeo", "loadGeo");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusApplyGeoPaste", "applyGeoPaste");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusSelectAll", "selectAllGeo");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusClearSelection", "clearGeoSelection");
  bindDistrictV2CensusAction("v3BtnDistrictV2CensusFetchRows", "fetchRows");
}

function bindDistrictV2FormSelect(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictFormField(field, control.value);
    handleDistrictV2MutationResult(result, `setFormField:${field}`);
  });
}

function bindDistrictV2FormField(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (
    !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
    || control.dataset.v3DistrictV2Bound === "1"
  ) {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  const onCommit = () => {
    const result = setDistrictFormField(field, control.value);
    handleDistrictV2MutationResult(result, `setFormField:${field}`);
  };
  control.addEventListener("input", onCommit);
  control.addEventListener("change", onCommit);
}

function bindDistrictV2FormCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictFormField(field, control.checked);
    handleDistrictV2MutationResult(result, `setFormField:${field}`);
  });
}

function bindDistrictV2TargetingSelect(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictTargetingField(field, control.value);
    handleDistrictV2MutationResult(result, `setTargetingField:${field}`);
  });
}

function bindDistrictV2TargetingModelSelect(v3Id) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = applyDistrictTargetingPreset(control.value);
    handleDistrictV2MutationResult(result, "applyTargetingPreset");
  });
}

function bindDistrictV2TargetingField(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  const onCommit = () => {
    const result = setDistrictTargetingField(field, control.value);
    handleDistrictV2MutationResult(result, `setTargetingField:${field}`);
  };
  control.addEventListener("input", onCommit);
  control.addEventListener("change", onCommit);
}

function bindDistrictV2TargetingCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictTargetingField(field, control.checked);
    handleDistrictV2MutationResult(result, `setTargetingField:${field}`);
  });
}

function bindDistrictV2TargetingAction(v3Id, action, source) {
  const button = document.getElementById(v3Id);
  if (!(button instanceof HTMLButtonElement) || button.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  button.dataset.v3DistrictV2Bound = "1";
  button.addEventListener("click", () => {
    const result = action();
    handleDistrictV2MutationResult(result, source);
  });
}

function bindDistrictV2CensusField(v3Id, field, eventName = "input") {
  const control = document.getElementById(v3Id);
  if (
    !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)
    || control.dataset.v3DistrictV2Bound === "1"
  ) {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener(eventName, () => {
    const result = setDistrictCensusField(field, control.value);
    handleDistrictV2MutationResult(result, `setCensusField:${field}`);
  });
}

function bindDistrictV2CensusCheckbox(v3Id, field) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLInputElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const result = setDistrictCensusField(field, control.checked);
    handleDistrictV2MutationResult(result, `setCensusField:${field}`);
  });
}

function bindDistrictV2CensusGeoSelection(v3Id) {
  const control = document.getElementById(v3Id);
  if (!(control instanceof HTMLSelectElement) || control.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  control.dataset.v3DistrictV2Bound = "1";
  control.addEventListener("change", () => {
    const values = Array.from(control.selectedOptions).map((option) => option.value);
    const result = setDistrictCensusGeoSelection(values);
    handleDistrictV2MutationResult(result, "setCensusGeoSelection");
  });
}

function bindDistrictV2CensusAction(v3Id, action) {
  const button = document.getElementById(v3Id);
  if (!(button instanceof HTMLButtonElement) || button.dataset.v3DistrictV2Bound === "1") {
    return;
  }
  button.dataset.v3DistrictV2Bound = "1";
  button.addEventListener("click", () => {
    const result = triggerDistrictCensusAction(action);
    handleDistrictV2MutationResult(result, `triggerCensusAction:${action}`);
  });
}

function assignCardStatusId(card, id) {
  if (!(card instanceof HTMLElement)) {
    return;
  }
  const statusEl = card.querySelector(".fpe-card__status");
  if (statusEl instanceof HTMLElement) {
    statusEl.id = id;
  }
}

function syncDistrictV2CardStatus(id, value) {
  const status = document.getElementById(id);
  if (!(status instanceof HTMLElement)) {
    return;
  }
  const text = String(value || "").trim() || "Awaiting inputs";
  status.textContent = text;
  status.classList.remove("is-good", "is-warn", "is-bad");
  const tone = classifyDistrictStatusTone(text);
  if (tone === "ok") {
    status.classList.add("is-good");
  } else if (tone === "warn") {
    status.classList.add("is-warn");
  } else if (tone === "bad") {
    status.classList.add("is-bad");
  }
}

function syncSelectOptions(id, options, selectedValue, { placeholder = "" } = {}) {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const normalized = normalizeSnapshotOptions(options);
  const wanted = String(selectedValue == null ? "" : selectedValue);

  const nextOptions = [];
  if (placeholder) {
    nextOptions.push({ value: "", label: String(placeholder) });
  }
  nextOptions.push(...normalized);

  const current = Array.from(select.options).map((option) => `${option.value}::${option.textContent || ""}`);
  const next = nextOptions.map((option) => `${option.value}::${option.label}`);
  const same = current.length === next.length && current.every((value, index) => value === next[index]);

  if (!same) {
    select.innerHTML = "";
    nextOptions.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      select.append(node);
    });
  }

  if (document.activeElement !== select) {
    if (wanted && !Array.from(select.options).some((row) => row.value === wanted)) {
      const extra = document.createElement("option");
      extra.value = wanted;
      extra.textContent = wanted;
      select.append(extra);
    }
    select.value = wanted;
  }
}

function syncMultiSelectOptions(id, options, selectedOptions) {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalized = normalizeSnapshotOptions(options);
  const selectedSet = new Set(
    (Array.isArray(selectedOptions) ? selectedOptions : [])
      .filter((row) => row && typeof row === "object" && row.selected)
      .map((row) => String(row.value || "").trim())
      .filter(Boolean),
  );

  const current = Array.from(select.options).map((option) => `${option.value}::${option.textContent || ""}`);
  const next = normalized.map((option) => `${option.value}::${option.label}`);
  const same = current.length === next.length && current.every((value, index) => value === next[index]);

  if (!same) {
    select.innerHTML = "";
    normalized.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      node.selected = selectedSet.has(option.value);
      select.append(node);
    });
    return;
  }

  if (document.activeElement === select) {
    return;
  }

  Array.from(select.options).forEach((option) => {
    option.selected = selectedSet.has(option.value);
  });
}

function syncInputValueFromRaw(id, rawValue) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.value = rawValue == null ? "" : String(rawValue);
}

function syncCheckboxCheckedFromRaw(id, rawValue) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === input) {
    return;
  }
  input.checked = !!rawValue;
}

function applyDisabled(id, disabled) {
  const control = document.getElementById(id);
  if (
    !(control instanceof HTMLInputElement)
    && !(control instanceof HTMLSelectElement)
    && !(control instanceof HTMLTextAreaElement)
    && !(control instanceof HTMLButtonElement)
  ) {
    return;
  }
  control.disabled = !!disabled;
}

function normalizeSnapshotOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const value = String(row.value ?? row.id ?? "").trim();
      const label = String(row.label ?? row.value ?? row.id ?? "").trim() || value;
      if (!value && !label) {
        return null;
      }
      return { value, label };
    })
    .filter(Boolean);
}

function normalizeIdOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      const value = String(row?.id ?? row?.value ?? "").trim();
      const label = String(row?.label ?? row?.id ?? row?.value ?? "").trim() || value;
      if (!value && !label) {
        return null;
      }
      return { value, label };
    })
    .filter(Boolean);
}

function normalizeTargetingOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      const value = String(row?.id ?? row?.value ?? "").trim();
      const label = String(row?.label ?? row?.id ?? row?.value ?? "").trim() || value;
      if (!value) {
        return null;
      }
      return { value, label };
    })
    .filter(Boolean);
}

function buildSelect(prefix, recordId, field, options, selectedValue, disabled) {
  const selectId = `v3DistrictV2_${prefix}_${recordId}`;
  return `
    <select class="fpe-input" id="${escapeHtml(selectId)}" data-v3d2-history-id="${escapeHtml(recordId)}" data-v3d2-history-field="${escapeHtml(field)}" ${disabled ? "disabled" : ""}>
      ${buildOptionsHtml(options, selectedValue)}
    </select>
  `;
}

function buildOptionsHtml(options, selectedValue) {
  const selected = String(selectedValue || "").trim();
  return normalizeSnapshotOptions(options).map((row) => {
    const isSelected = row.value === selected;
    return `<option value="${escapeHtml(row.value)}"${isSelected ? " selected" : ""}>${escapeHtml(row.label)}</option>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
