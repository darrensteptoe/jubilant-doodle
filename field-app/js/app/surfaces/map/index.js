import {
  createCenterModuleCard,
  createCenterStackColumn,
  createCenterStackFrame,
  createWhyPanel,
  getCardBody,
} from "../../componentFactory.js";
import {
  readDistrictCensusConfigSnapshot,
  setDistrictCensusField,
  setDistrictCensusGeoSelection,
} from "../../stateBridge.js";
import {
  fetchTigerBoundaryGeojson,
  formatMetricValue,
  getMetricsForSet,
  listMetricSetOptions,
  normalizeGeoidsForResolution,
} from "../../../../core/censusModule.js";
import { getOperationsMetricsSnapshot } from "../../../../features/operations/metricsCache.js";
import { resolveOperationsContext } from "../../../../features/operations/context.js";
import {
  OPERATIONS_MAP_CONTEXT_EVENT,
  operationsMapContextAppliesToScope,
  readOperationsMapContext,
} from "../../../../features/operations/mapContextBridge.js";
import { computeOperationsPerformancePaceView } from "../../../../features/operations/performancePace.js";
import {
  buildWorkedGeographyActivityIndex,
  buildWorkedGeographyUnitJoinKey,
  normalizeWorkedGeographyAlias,
} from "../../../../features/operations/workedGeography.js";
import {
  buildWorkedExecutionSummaryModel,
  deriveWorkedActivityStateRows,
  WORKED_ACTIVITY_STATE_HIGH,
  WORKED_ACTIVITY_STATE_NONE,
  WORKED_ACTIVITY_STATE_RECORDED,
} from "./workedExecutionModel.js";
import { readMapboxPublicTokenConfig, resolveMapboxPublicToken } from "../../../runtimeConfig.js";

const SHELL_API_KEY = "__FPE_SHELL_API__";
const CENSUS_RUNTIME_API_KEY = "__FPE_CENSUS_RUNTIME_API__";

const MAPBOX_CSS_ID = "v3MapboxCss";
const MAPBOX_SCRIPT_ID = "v3MapboxScript";
const MAPBOX_CSS_URL = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
const MAPBOX_JS_URL = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
const MAPBOX_STYLE_URL = "mapbox://styles/mapbox/light-v11";
const MAP_DEFAULT_CENTER = [-98.5795, 39.8283];
const MAP_DEFAULT_ZOOM = 3.25;

const MAP_STATUS_LOADING = "Loading campaign geography…";
const MAP_STATUS_CONTEXT_REQUIRED = "Select campaign, office, and geography context to load the map.";
const MAP_STATUS_TOKEN_MISSING = "No Mapbox token configured. Open Controls and save a Mapbox public token (pk...).";
const MAP_STATUS_TOKEN_INVALID = "Mapbox token is invalid for browser use. Save a valid Mapbox public token (pk...) in Controls.";
const MAP_STATUS_NO_GEOGRAPHY = "No geography matched the current selection.";
const MAP_STATUS_GEOGRAPHY_UNAVAILABLE = "Campaign geography is unavailable for this context right now. Verify geography selections and retry.";
const MAP_STATUS_METRIC_UNAVAILABLE = "This layer does not have data for the selected metric yet.";
const MAP_STATUS_INSPECT_PROMPT = "Select an area on the map to inspect its field context.";
const MAP_STATUS_BOOT_FAILED = "Map boot failed. Check Mapbox token validity/network access, then refresh the current context.";
const MAP_STATUS_BOOT_NETWORK_FAILED = "Map runtime assets could not load. Check network/content blocking and refresh the current context.";
const MAP_STATUS_BOOT_STYLE_FAILED = "Map style configuration could not load. Verify Mapbox style/network access, then refresh the current context.";
const PLANNING_DISPLAY_BOUNDARY_TEXT = "Planning view is display-only; canonical planning/execution math remains unchanged.";

const CARD_STATUS_ID = "v3MapSurfaceCardStatus";
const ROOT_ID = "v3MapSurfaceRoot";
const HOST_ID = "v3MapHost";
const STATUS_ID = "v3MapStatus";
const METRIC_STATUS_ID = "v3MapMetricStatus";
const CONTEXT_STATUS_ID = "v3MapContextStatus";
const HOVER_STATUS_ID = "v3MapHoverStatus";
const LEGEND_STATUS_ID = "v3MapLegendStatus";
const LEGEND_BODY_ID = "v3MapLegendBody";
const LEGEND_PROVENANCE_ID = "v3MapLegendProvenance";
const WORKED_SUMMARY_STATUS_ID = "v3MapWorkedSummaryStatus";
const WORKED_SUMMARY_BODY_ID = "v3MapWorkedSummaryBody";
const INSPECT_STATUS_ID = "v3MapInspectStatus";
const INSPECT_BODY_ID = "v3MapInspectBody";
const METRIC_SELECT_ID = "v3MapMetricSelect";
const METRIC_HELP_ID = "v3MapMetricHelp";
const CONTEXT_MODE_SELECT_ID = "v3MapContextMode";
const CONTEXT_MODE_STATUS_ID = "v3MapContextModeStatus";
const ACTION_BTN_ID = "v3MapActionBtn";
const FIT_BTN_ID = "v3MapFitBtn";
const RESET_BTN_ID = "v3MapResetBtn";
const REFIT_SCOPE_BTN_ID = "v3MapRefitScopeBtn";
const SEARCH_INPUT_ID = "v3MapSearchInput";
const SEARCH_BTN_ID = "v3MapSearchBtn";
const CLEAR_SELECTION_BTN_ID = "v3MapClearSelectionBtn";
const VIEW_CAMPAIGN_BTN_ID = "v3MapViewCampaignBtn";
const VIEW_OFFICE_BTN_ID = "v3MapViewOfficeBtn";
const VIEW_WORKED_ORGANIZER_BTN_ID = "v3MapViewWorkedOrganizerBtn";
const VIEW_SELECTED_BTN_ID = "v3MapViewSelectedBtn";
const SAVE_BOOKMARK_BTN_ID = "v3MapSaveBookmarkBtn";
const JUMP_BOOKMARK_BTN_ID = "v3MapJumpBookmarkBtn";
const COPY_INSPECT_BTN_ID = "v3MapCopyInspectBtn";
const NAV_STATUS_ID = "v3MapNavStatus";
const MODE_SCOPE_STATUS_ID = "v3MapModeScopeStatus";
const TRUST_STATUS_ID = "v3MapTrustStatus";
const DIAGNOSTIC_STATUS_ID = "v3MapDiagnosticStatus";

const AREAS_SOURCE_ID = "v3MapAreasSource";
const POINTS_SOURCE_ID = "v3MapPointsSource";
const FILL_LAYER_ID = "v3MapAreaFillLayer";
const OUTLINE_LAYER_ID = "v3MapAreaOutlineLayer";
const HOVER_LAYER_ID = "v3MapAreaHoverLayer";
const SELECTED_LAYER_ID = "v3MapAreaSelectedLayer";
const POINT_LAYER_ID = "v3MapPointLayer";

const STATUS_LEVELS = ["ok", "warn", "bad", "muted"];
const ROW_LAT_KEYS = ["INTPTLAT", "INTPTLAT20", "intptlat", "lat", "latitude", "centroidLat", "centroid_lat", "y", "Y"];
const ROW_LON_KEYS = ["INTPTLON", "INTPTLON20", "intptlon", "lon", "lng", "longitude", "centroidLon", "centroid_lon", "x", "X"];
const LEGEND_COLORS = ["#dbeafe", "#93c5fd", "#60a5fa", "#2563eb", "#1e3a8a"];
const WORKED_ACTIVITY_STATE_COLOR_MAP = {
  [WORKED_ACTIVITY_STATE_NONE]: "#e2e8f0",
  [WORKED_ACTIVITY_STATE_RECORDED]: "#60a5fa",
  [WORKED_ACTIVITY_STATE_HIGH]: "#1d4ed8",
};
const METRIC_SET_LABEL_MAP = Object.fromEntries(
  listMetricSetOptions().map((row) => [cleanText(row?.id), cleanText(row?.label) || cleanText(row?.id)]),
);
const METRIC_SET_PROVENANCE_MAP = {
  core: "Canonical Census ACS/PL baseline indicators (display-only map rendering).",
  demographics: "Canonical Census ACS demographic shares and totals (display-only map rendering).",
  housing: "Canonical Census ACS housing indicators (display-only map rendering).",
  income: "Canonical Census ACS income indicator (display-only map rendering).",
  education: "Canonical Census ACS education indicator (display-only map rendering).",
  language: "Canonical Census ACS language indicator (display-only map rendering).",
  field_efficiency: "Canonical Census ACS indicators bundled for field-efficiency context (display-only; no planning math mutation).",
  turnout_potential: "Canonical Census ACS indicators bundled for turnout-potential context (display-only; no planning math mutation).",
  all: "Canonical Census ACS/PL full metric bundle (display-only map rendering).",
};
const METRIC_SET_CONTEXT_MAP = {
  core: "Geography baseline context (display-only).",
  demographics: "Geography baseline context (display-only).",
  housing: "Geography baseline context (display-only).",
  income: "Planning support context (display-only).",
  education: "Planning support context (display-only).",
  language: "Planning support context (display-only).",
  field_efficiency: "Operational priority context (display-only, canon-safe).",
  turnout_potential: "Turnout/persuasion pressure context (display-only, canon-safe).",
  all: "Mixed canonical context bundle (display-only).",
};
const METRIC_FAMILY_BY_SET_MAP = {
  core: "Geography / density",
  demographics: "Persuasion context",
  housing: "Geography / density",
  income: "Turnout context",
  education: "Persuasion context",
  language: "Operational priority",
  field_efficiency: "Operational priority",
  turnout_potential: "Turnout context",
  all: "Mixed families",
};
const METRIC_FAMILY_PROVENANCE_MAP = {
  "Geography / density": "Canonical Census ACS/PL population, household, and housing context (display-only map rendering).",
  "Turnout context": "Canonical turnout-support Census indicators (display-only map rendering; no turnout model mutation).",
  "Persuasion context": "Canonical persuasion-support Census demographic/education context (display-only map rendering; no persuasion model mutation).",
  "Early vote context": "Read-only early-vote context indicators when present in canonical map rows (display-only map rendering).",
  "Operational priority": "Canonical operational-friction indicators (display-only map rendering; no execution-model mutation).",
  "Mixed families": "Canonical mixed family bundle for broad geographic screening (display-only map rendering).",
  "Canonical context": "Canonical map-safe Census context (display-only map rendering).",
};
const EARLY_VOTE_METRIC_PATTERNS = ["early", "vbm", "mail_vote", "mailvote", "absentee", "ballot_return"];
const PLANNING_OVERLAY_BY_FAMILY = {
  "Geography / density": {
    id: "universe_density_context",
    label: "Universe concentration context",
    provenance: "Canonical Census population/housing density indicators (display-only overlay).",
    interpretation: "Use to identify where universe concentration is spatially high for staffing and route-shaping conversations.",
  },
  "Turnout context": {
    id: "turnout_need_context",
    label: "Turnout need context",
    provenance: "Canonical turnout-support Census indicators (display-only overlay; no turnout model mutation).",
    interpretation: "Use to prioritize where turnout reinforcement may produce the most practical pressure relief.",
  },
  "Persuasion context": {
    id: "persuasion_need_context",
    label: "Persuasion need context",
    provenance: "Canonical persuasion-support Census indicators (display-only overlay; no persuasion model mutation).",
    interpretation: "Use to compare where persuasion pressure appears most concentrated in current geography.",
  },
  "Operational priority": {
    id: "operational_priority_context",
    label: "Operational priority context",
    provenance: "Canonical operational-friction indicators from map-safe Census variables (display-only overlay).",
    interpretation: "Use to flag areas where operational friction may require tighter organizer/turf sequencing.",
  },
  "Mixed families": {
    id: "mixed_planning_context",
    label: "Mixed planning context",
    provenance: "Canonical mixed metric bundle (display-only overlay; canon math unchanged).",
    interpretation: "Use for broad screening, then switch to a focused family metric before committing operational changes.",
  },
};
const DEFAULT_PLANNING_OVERLAY = {
  id: "canonical_map_context",
  label: "Canonical map context",
  provenance: "Canonical Census map bundle (display-only overlay; canon math unchanged).",
  interpretation: "Display-only map context for geography comparison; validate with core planning and execution surfaces.",
};
const EARLY_VOTE_CONTEXT_KEYS = [
  "expectedEarlyVoteShare",
  "expected_early_vote_share",
  "earlyVoteShare",
  "early_vote_share",
  "mailVoteShare",
  "mail_vote_share",
  "vbmShare",
  "vbm_share",
];
const CONTEXT_MODE_CAMPAIGN = "campaign_footprint";
const CONTEXT_MODE_OFFICE = "office_footprint";
const CONTEXT_MODE_TURF = "turf_context";
const CONTEXT_MODE_EXECUTION = "execution_context";
const CONTEXT_MODE_WORKED = "worked_activity_context";
const CONTEXT_MODE_OPTIONS = [
  { id: CONTEXT_MODE_CAMPAIGN, label: "Campaign footprint" },
  { id: CONTEXT_MODE_OFFICE, label: "Office footprint" },
  { id: CONTEXT_MODE_TURF, label: "Turf assignment context" },
  { id: CONTEXT_MODE_EXECUTION, label: "Execution / ops context" },
  { id: CONTEXT_MODE_WORKED, label: "Worked activity geography" },
];
const OFFICE_CONTEXT_KEYS = ["officeId", "office_id", "office", "officeSlug", "office_slug"];
const TURF_CONTEXT_KEYS = ["turfId", "turf_id", "turf", "turfName", "turf_name", "precinct", "precinct_id"];
const ORGANIZER_CONTEXT_KEYS = ["assignedTo", "assigned_to", "organizer", "organizerName", "organizer_name", "organizerId", "organizer_id"];
const PRECINCT_CONTEXT_KEYS = ["precinct", "precinct_id", "precinctId"];
const EXECUTION_ATTEMPT_KEYS = ["attempts", "activityAttempts", "activity_attempts", "fieldAttempts", "field_attempts"];
const EXECUTION_COVERAGE_KEYS = ["coveragePct", "coverage_pct", "coverage", "contactCoverage", "contact_coverage"];
const EXECUTION_PROGRESS_KEYS = ["progressPct", "progress_pct", "progress", "completionPct", "completion_pct"];
const EXECUTION_VBM_KEYS = ["vbms", "vbm", "vbmCount", "vbm_count", "ballotsCollected", "ballots_collected"];

let mapboxLoadPromise = null;
let mapRuntime = null;
let mapViewportResizeBound = false;
let mapConfigEventBound = false;

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function firstTextByKeys(values, keys) {
  const src = values && typeof values === "object" ? values : {};
  for (const key of Array.isArray(keys) ? keys : []) {
    const text = cleanText(src?.[key]);
    if (text) {
      return text;
    }
  }
  return "";
}

function normalizeContextMode(value) {
  const mode = cleanText(value);
  if (mode === CONTEXT_MODE_OFFICE) return CONTEXT_MODE_OFFICE;
  if (mode === CONTEXT_MODE_TURF) return CONTEXT_MODE_TURF;
  if (mode === CONTEXT_MODE_EXECUTION) return CONTEXT_MODE_EXECUTION;
  if (mode === CONTEXT_MODE_WORKED) return CONTEXT_MODE_WORKED;
  return CONTEXT_MODE_CAMPAIGN;
}

function contextModeLabel(mode) {
  const id = normalizeContextMode(mode);
  return CONTEXT_MODE_OPTIONS.find((row) => row.id === id)?.label || "Campaign footprint";
}

function normalizeGeoidToken(value, expectedLength = 0) {
  const digits = cleanText(value).replace(/\D+/g, "");
  if (!digits) {
    return "";
  }
  if (expectedLength > 0) {
    return digits.slice(-expectedLength).padStart(expectedLength, "0");
  }
  return digits;
}

function resolutionLabel(resolution) {
  const key = cleanText(resolution).toLowerCase();
  if (key === "block_group") return "Block group";
  if (key === "tract") return "Tract";
  if (key === "place") return "Place";
  if (key === "congressional_district") return "Congressional district";
  if (key === "state_senate_district") return "State senate district";
  if (key === "state_house_district") return "State house district";
  return "Geography";
}

function readOperationsScopeFallback(shellScope = {}) {
  try {
    const context = resolveOperationsContext({ fallback: shellScope });
    return {
      campaignId: cleanText(context?.campaignId),
      officeId: cleanText(context?.officeId),
    };
  } catch {
    return { campaignId: "", officeId: "" };
  }
}

function readShellScope() {
  const shellScope = { campaignId: "", officeId: "" };
  try {
    const api = window?.[SHELL_API_KEY];
    if (api && typeof api.getView === "function") {
      const view = api.getView();
      shellScope.campaignId = cleanText(view?.campaignId);
      shellScope.officeId = cleanText(view?.officeId);
    }
  } catch {
    // Fall through to operations/shared-context fallback.
  }
  const opsScope = readOperationsScopeFallback(shellScope);
  const campaignId = shellScope.campaignId || opsScope.campaignId;
  const officeId = shellScope.officeId || opsScope.officeId;
  return {
    campaignId,
    officeId,
    campaignSource: shellScope.campaignId ? "shell" : (opsScope.campaignId ? "operations_context" : ""),
    officeSource: shellScope.officeId ? "shell" : (opsScope.officeId ? "operations_context" : ""),
  };
}

function normalizeBridgeFocusType(value) {
  const token = cleanLower(value);
  if (token === "organizer") return "organizer";
  if (token === "office") return "office";
  return "";
}

function resolveWorkedBridgeContext(shellScope) {
  const scope = shellScope && typeof shellScope === "object" ? shellScope : {};
  const stored = readOperationsMapContext();
  if (!operationsMapContextAppliesToScope(stored, scope)) {
    return {
      available: false,
      focusType: "",
      officeId: "",
      organizerId: "",
      organizerLabel: "",
      requestedMode: "",
      requestId: "",
      source: "",
      campaignId: cleanText(scope?.campaignId),
    };
  }
  const focusType = normalizeBridgeFocusType(stored?.focusType);
  if (!focusType) {
    return {
      available: false,
      focusType: "",
      officeId: "",
      organizerId: "",
      organizerLabel: "",
      requestedMode: "",
      requestId: "",
      source: "",
      campaignId: cleanText(scope?.campaignId),
    };
  }
  const organizerId = cleanText(stored?.organizerId);
  const organizerLabel = cleanText(stored?.organizerName) || organizerId;
  const officeId = cleanText(stored?.officeId) || cleanText(scope?.officeId);
  return {
    available: true,
    focusType,
    officeId,
    organizerId,
    organizerLabel,
    requestedMode: cleanText(stored?.requestedMode),
    requestId: cleanText(stored?.requestId),
    source: cleanText(stored?.source) || "operations_context_bridge",
    campaignId: cleanText(stored?.campaignId) || cleanText(scope?.campaignId),
  };
}

function workedBridgeContextLabel(bridgeContext) {
  const bridge = bridgeContext && typeof bridgeContext === "object" ? bridgeContext : {};
  if (!bridge.available) {
    return "";
  }
  if (bridge.focusType === "organizer") {
    const organizer = cleanText(bridge.organizerLabel) || cleanText(bridge.organizerId) || "selected organizer";
    return `Worked geography focus: organizer ${organizer} (activity evidence).`;
  }
  if (bridge.focusType === "office") {
    const officeId = cleanText(bridge.officeId) || "selected office";
    return `Worked geography focus: office ${officeId} (activity evidence).`;
  }
  return "";
}

function openControlsStage() {
  try {
    const nav = window?.__FPE_V3_NAV__;
    if (!nav || typeof nav.navigateStage !== "function") {
      return false;
    }
    nav.navigateStage("controls", { persist: true });
    return true;
  } catch {
    return false;
  }
}

function readCensusRowsByGeoid() {
  try {
    const api = window?.[CENSUS_RUNTIME_API_KEY];
    if (!api || typeof api.getView !== "function" || typeof api.getRowsForState !== "function") {
      return {};
    }
    const view = api.getView();
    const rows = api.getRowsForState(view);
    return rows && typeof rows === "object" ? rows : {};
  } catch {
    return {};
  }
}

function sumVars(values, variableIds) {
  let total = 0;
  let count = 0;
  for (const id of Array.isArray(variableIds) ? variableIds : []) {
    const value = toFiniteNumber(values?.[id]);
    if (value == null) {
      continue;
    }
    total += value;
    count += 1;
  }
  return { total, count };
}

function metricValueForRow(metric, rowValues) {
  const values = rowValues && typeof rowValues === "object" ? rowValues : {};
  if (!metric || typeof metric !== "object") {
    return null;
  }
  if (metric.kind === "sum") {
    const out = sumVars(values, metric.sumVars);
    return out.count > 0 ? out.total : null;
  }
  if (metric.kind === "ratio") {
    const numerator = sumVars(values, metric.numeratorVars).total;
    const denominator = sumVars(values, metric.denominatorVars).total;
    return denominator > 0 ? numerator / denominator : null;
  }
  if (metric.kind === "weighted_mean") {
    const value = toFiniteNumber(values?.[metric.valueVar]);
    const weight = toFiniteNumber(values?.[metric.weightVar]);
    if (value == null) {
      return null;
    }
    if (weight != null && weight <= 0) {
      return null;
    }
    return value;
  }
  return null;
}

function formatContextScore(value) {
  const num = toFiniteNumber(value);
  if (num == null) {
    return "";
  }
  if (num >= 0 && num <= 1) {
    return formatMetricValue(num, "pct1");
  }
  return formatMetricValue(num, "int");
}

function resolveTurnoutPersuasionSplitContext(rowValues) {
  const values = rowValues && typeof rowValues === "object" ? rowValues : {};
  const turnoutScore = toFiniteNumber(
    values.turnoutOpportunity
      ?? values.turnout_opportunity
      ?? values.turnout_need_index
      ?? values.turnout_index,
  );
  const persuasionScore = toFiniteNumber(
    values.persuasionIndex
      ?? values.persuasion_index
      ?? values.persuasion_need_index
      ?? values.persuasion_score,
  );
  const turnoutPriority = values.is_turnout_priority === true || cleanText(values.turnoutPriority).toLowerCase() === "true";
  const persuasionPriority = values.is_persuasion_priority === true || cleanText(values.persuasionPriority).toLowerCase() === "true";
  if (turnoutScore != null && persuasionScore != null) {
    return `Turnout/Persuasion split context: turnout ${formatContextScore(turnoutScore)}, persuasion ${formatContextScore(persuasionScore)}.`;
  }
  if (turnoutPriority && !persuasionPriority) {
    return "Turnout/Persuasion split context: flagged as turnout-priority in available read-only context.";
  }
  if (persuasionPriority && !turnoutPriority) {
    return "Turnout/Persuasion split context: flagged as persuasion-priority in available read-only context.";
  }
  if (turnoutPriority && persuasionPriority) {
    return "Turnout/Persuasion split context: dual-priority signal in available read-only context.";
  }
  return "";
}

function resolveEarlyVoteContext(rowValues) {
  const values = rowValues && typeof rowValues === "object" ? rowValues : {};
  for (const key of EARLY_VOTE_CONTEXT_KEYS) {
    const value = toFiniteNumber(values?.[key]);
    if (value == null) {
      continue;
    }
    const formatted = (value >= 0 && value <= 1)
      ? formatMetricValue(value, "pct1")
      : formatMetricValue(value, "int");
    return `Expected early-vote context: ${formatted} (read-only context signal).`;
  }
  return "Expected early-vote context: not present in current canonical map rows.";
}

function resolvePlanningOverlayDescriptor(metric, rowValues) {
  const family = cleanText(metric?.family);
  const base = PLANNING_OVERLAY_BY_FAMILY[family] || DEFAULT_PLANNING_OVERLAY;
  const earlyVoteContext = resolveEarlyVoteContext(rowValues);
  const hasEarlyVoteSignal = !earlyVoteContext.includes("not present");
  if (hasEarlyVoteSignal) {
    return {
      id: "expected_early_vote_context",
      label: "Expected early-vote context",
      provenance: "Read-only early-vote context signal from canonical map rows (display-only overlay).",
      interpretation: "Use as directional context when planning vote-mode outreach sequencing; do not treat as standalone turnout math.",
      earlyVoteContext,
    };
  }
  return {
    ...base,
    earlyVoteContext,
  };
}

function firstFiniteByKeys(values, keys) {
  for (const key of keys) {
    const value = toFiniteNumber(values?.[key]);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function formatPercentContext(value) {
  const num = toFiniteNumber(value);
  if (num == null) return "";
  if (num >= 0 && num <= 1) {
    return formatMetricValue(num, "pct1");
  }
  return formatMetricValue(num / 100, "pct1");
}

function normalizeContextKey(value) {
  return cleanLower(value).replace(/[^a-z0-9]/g, "");
}

function toWorkedStats(value) {
  const row = value && typeof value === "object" ? value : {};
  return {
    touches: Math.max(0, Number(row?.touches || 0) || 0),
    attempts: Math.max(0, Number(row?.attempts || 0) || 0),
    canvassed: Math.max(0, Number(row?.canvassed || 0) || 0),
    vbms: Math.max(0, Number(row?.vbms || 0) || 0),
  };
}

function addWorkedStats(target, delta) {
  if (!target || typeof target !== "object") {
    return;
  }
  const next = toWorkedStats(delta);
  target.touches += next.touches;
  target.attempts += next.attempts;
  target.canvassed += next.canvassed;
  target.vbms += next.vbms;
}

function buildFeatureWorkedJoinKeys({ geoid, rowValues, officeTurf } = {}) {
  const values = rowValues && typeof rowValues === "object" ? rowValues : {};
  const office = officeTurf && typeof officeTurf === "object" ? officeTurf : {};
  const keys = new Set();
  const geoidToken = normalizeGeoidToken(geoid);
  if (geoidToken.length === 12) {
    const key = buildWorkedGeographyUnitJoinKey("block_group", geoidToken);
    if (key) keys.add(key);
  } else if (geoidToken.length === 11) {
    const key = buildWorkedGeographyUnitJoinKey("tract", geoidToken);
    if (key) keys.add(key);
  }
  const precinct = firstTextByKeys(values, PRECINCT_CONTEXT_KEYS);
  if (precinct) {
    const key = buildWorkedGeographyUnitJoinKey("precinct", precinct);
    if (key) keys.add(key);
  }
  const turfId = cleanText(office?.turfId);
  if (turfId) {
    const key = buildWorkedGeographyUnitJoinKey("turf", turfId);
    if (key) keys.add(key);
  }
  return Array.from(keys.values());
}

function resolveWorkedActivityContext({ geoid, rowValues, officeTurf, opsContext } = {}) {
  const office = officeTurf && typeof officeTurf === "object" ? officeTurf : {};
  const ops = opsContext && typeof opsContext === "object" ? opsContext : { available: false };
  const joinKeys = buildFeatureWorkedJoinKeys({ geoid, rowValues, officeTurf: office });
  const matchedJoinKeys = [];
  const officeStats = { touches: 0, attempts: 0, canvassed: 0, vbms: 0 };
  const organizerStats = { touches: 0, attempts: 0, canvassed: 0, vbms: 0 };
  const officeKey = cleanLower(ops?.activeOfficeId);
  const organizerScopeId = cleanText(ops?.activeOrganizerId);
  const organizerScopeLabel = cleanText(ops?.activeOrganizerLabel) || organizerScopeId;
  const organizerAlias = normalizeWorkedGeographyAlias(organizerScopeId || organizerScopeLabel || office?.organizer);

  for (const joinKey of joinKeys) {
    const scopedOfficeStats = officeKey
      ? toWorkedStats(ops?.workedByOfficeUnitKey?.get?.(`${officeKey}|${joinKey}`))
      : null;
    const unitStats = scopedOfficeStats && scopedOfficeStats.touches > 0
      ? scopedOfficeStats
      : toWorkedStats(ops?.workedByUnitKey?.get?.(joinKey));
    if (unitStats.touches > 0) {
      matchedJoinKeys.push(joinKey);
      addWorkedStats(officeStats, unitStats);
    }
    if (organizerAlias) {
      const organizerUnit = toWorkedStats(ops?.workedByOrganizerAliasUnitKey?.get?.(`${organizerAlias}|${joinKey}`));
      if (organizerUnit.touches > 0) {
        if (!matchedJoinKeys.includes(joinKey)) {
          matchedJoinKeys.push(joinKey);
        }
        addWorkedStats(organizerStats, organizerUnit);
      }
    }
  }

  const officeTouches = Math.max(0, Number(officeStats.touches || 0) || 0);
  const organizerTouches = Math.max(0, Number(organizerStats.touches || 0) || 0);
  const hasSignal = officeTouches > 0 || organizerTouches > 0;
  const coverageText = officeTouches > 0
    ? `Worked geography (office): ${officeTouches.toLocaleString()} turf-event touch${officeTouches === 1 ? "" : "es"} joined to this area context.`
    : "Worked geography (office): no office-level worked-event geography signal joined to this area context.";
  const organizerText = organizerScopeLabel
    ? (
      organizerTouches > 0
        ? `Worked geography (organizer): ${organizerTouches.toLocaleString()} touch${organizerTouches === 1 ? "" : "es"} logged for selected organizer ${organizerScopeLabel} in this area context.`
        : `Worked geography (organizer): selected organizer ${organizerScopeLabel} has no joined worked-event geography signal in this area context.`
    )
    : (
      organizerTouches > 0
        ? `Worked geography (organizer): ${organizerTouches.toLocaleString()} touch${organizerTouches === 1 ? "" : "es"} logged for organizer-linked geography in this area context.`
        : "Worked geography (organizer): no organizer-linked worked-event geography signal joined to this area context."
    );
  const interpretation = hasSignal
    ? "Worked/activity context: this overlay reflects logged turf-event geography touches (read-only execution evidence), not assigned turf boundaries."
    : "Worked/activity context: no joined worked-event geography signal is available for this area yet.";

  return {
    hasSignal,
    joinCount: matchedJoinKeys.length,
    matchedJoinKeys,
    officeTouches,
    organizerTouches,
    officeAttempts: Math.max(0, Number(officeStats.attempts || 0) || 0),
    organizerAttempts: Math.max(0, Number(organizerStats.attempts || 0) || 0),
    officeCanvassed: Math.max(0, Number(officeStats.canvassed || 0) || 0),
    organizerCanvassed: Math.max(0, Number(organizerStats.canvassed || 0) || 0),
    officeVbms: Math.max(0, Number(officeStats.vbms || 0) || 0),
    organizerVbms: Math.max(0, Number(organizerStats.vbms || 0) || 0),
    coverageText,
    organizerText,
    interpretation,
    scopeType: cleanText(ops?.workedScope?.focusType),
    scopeOfficeId: cleanText(ops?.activeOfficeId),
    scopeOrganizerId: organizerScopeId,
    scopeOrganizerLabel: organizerScopeLabel,
  };
}

function normalizeWorkedScopeType(value) {
  const token = cleanLower(value);
  if (token === "organizer") return "organizer";
  if (token === "office") return "office";
  return "campaign";
}

function resolveWorkedScopeLabel(opsContext = {}, shellScope = {}) {
  const ops = opsContext && typeof opsContext === "object" ? opsContext : {};
  const shell = shellScope && typeof shellScope === "object" ? shellScope : {};
  const scope = ops?.workedScope && typeof ops.workedScope === "object" ? ops.workedScope : {};
  const scopeType = normalizeWorkedScopeType(scope?.focusType);
  if (scopeType === "organizer") {
    return `Organizer ${cleanText(scope?.organizerLabel) || cleanText(scope?.organizerId) || "selected"}`;
  }
  if (scopeType === "office") {
    return `Office ${cleanText(scope?.officeId) || cleanText(shell?.officeId) || "selected"}`;
  }
  return `Office ${cleanText(shell?.officeId) || cleanText(scope?.officeId) || "selected"}`;
}

function resolveWorkedEvidenceCountsFromProps(props = {}) {
  const row = props && typeof props === "object" ? props : {};
  const scopeType = normalizeWorkedScopeType(row?.workedGeographyScopeType);
  const useOrganizer = scopeType === "organizer";
  const touches = Math.max(0, Number(useOrganizer ? row?.workedGeographyOrganizerTouches : row?.workedGeographyOfficeTouches) || 0);
  const attempts = Math.max(0, Number(useOrganizer ? row?.workedGeographyOrganizerAttempts : row?.workedGeographyOfficeAttempts) || 0);
  const canvassed = Math.max(0, Number(useOrganizer ? row?.workedGeographyOrganizerCanvassed : row?.workedGeographyOfficeCanvassed) || 0);
  const vbms = Math.max(0, Number(useOrganizer ? row?.workedGeographyOrganizerVbms : row?.workedGeographyOfficeVbms) || 0);
  return {
    touches,
    attempts,
    canvassed,
    vbms,
    scopeType,
  };
}

async function readOperationsExecutionContext(shellScope, workedBridge = {}) {
  const campaignId = cleanText(shellScope?.campaignId);
  if (!campaignId) {
    return { available: false, reason: "missing_campaign_scope" };
  }
  const bridge = workedBridge && typeof workedBridge === "object" ? workedBridge : {};
  const workedFocusType = normalizeBridgeFocusType(bridge?.focusType);
  const workedOfficeId = cleanText(bridge?.officeId) || cleanText(shellScope?.officeId);
  const workedOrganizerId = workedFocusType === "organizer" ? cleanText(bridge?.organizerId) : "";
  const workedOrganizerLabel = cleanText(bridge?.organizerLabel) || workedOrganizerId;
  const workedScope = {
    focusType: workedFocusType,
    officeId: workedOfficeId,
    organizerId: workedOrganizerId,
    organizerLabel: workedOrganizerLabel,
    source: cleanText(bridge?.source),
  };
  try {
    const snapshot = await getOperationsMetricsSnapshot({
      context: {
        campaignId,
        officeId: workedOfficeId,
      },
    });
    const stores = snapshot?.stores && typeof snapshot.stores === "object" ? snapshot.stores : {};
    const persons = Array.isArray(stores?.persons) ? stores.persons : [];
    const shiftRecords = Array.isArray(stores?.shiftRecords) ? stores.shiftRecords : [];
    const turfEvents = Array.isArray(stores?.turfEvents) ? stores.turfEvents : [];
    const pace = computeOperationsPerformancePaceView({
      stateSnapshot: {},
      persons,
      shiftRecords,
      turfEvents,
    });
    const workedGeographyIndex = buildWorkedGeographyActivityIndex({
      persons,
      turfEvents,
      officeId: workedOfficeId,
      organizerId: workedOrganizerId,
    });

    const touchesByTurfKey = new Map();
    for (const row of Array.isArray(snapshot?.rollups?.coverage?.touchesByTurfId) ? snapshot.rollups.coverage.touchesByTurfId : []) {
      const key = normalizeContextKey(row?.turfId);
      if (!key) continue;
      touchesByTurfKey.set(key, Number(row?.touches || 0) || 0);
    }
    const touchesByPrecinctKey = new Map();
    for (const row of Array.isArray(snapshot?.rollups?.coverage?.touchesByPrecinct) ? snapshot.rollups.coverage.touchesByPrecinct : []) {
      const key = normalizeContextKey(row?.precinct);
      if (!key) continue;
      touchesByPrecinctKey.set(key, Number(row?.touches || 0) || 0);
    }

    const organizerRows = Array.isArray(pace?.organizerRows) ? pace.organizerRows : [];
    const organizerById = new Map();
    const organizerByName = new Map();
    for (const row of organizerRows) {
      const idKey = normalizeContextKey(row?.organizerId);
      const nameKey = normalizeContextKey(row?.name);
      if (idKey) organizerById.set(idKey, row);
      if (nameKey) organizerByName.set(nameKey, row);
    }

    return {
      available: true,
      touchesByTurfKey,
      touchesByPrecinctKey,
      organizerById,
      organizerByName,
      activeOfficeId: workedOfficeId,
      activeOrganizerId: workedOrganizerId,
      activeOrganizerLabel: workedOrganizerLabel,
      workedScope,
      workedScopeToken: `${workedFocusType || "campaign"}|${cleanLower(workedOfficeId)}|${cleanLower(workedOrganizerId)}`,
      workedByUnitKey: workedGeographyIndex?.byUnitKey || new Map(),
      workedByOrganizerAliasUnitKey: workedGeographyIndex?.byOrganizerAliasUnitKey || new Map(),
      workedByOfficeUnitKey: workedGeographyIndex?.byOfficeUnitKey || new Map(),
      workedJoinableEventCount: Number(workedGeographyIndex?.joinableEventCount || 0) || 0,
      workedConsideredEventCount: Number(workedGeographyIndex?.consideredEventCount || 0) || 0,
      workedOfficeTotals: toWorkedStats(workedGeographyIndex?.officeTotals),
      coverageAttempts: Number(snapshot?.rollups?.coverage?.attempts || 0) || 0,
      productionSupportIds: Number(snapshot?.rollups?.production?.supportIds || 0) || 0,
    };
  } catch (error) {
    return {
      available: false,
      reason: "operations_snapshot_failed",
      error: cleanText(error?.message || error),
    };
  }
}

function resolveExecutionContext(rowValues, officeTurf, opsContext) {
  const values = rowValues && typeof rowValues === "object" ? rowValues : {};
  const office = officeTurf && typeof officeTurf === "object" ? officeTurf : {};
  const ops = opsContext && typeof opsContext === "object" ? opsContext : { available: false };
  const localAttempts = firstFiniteByKeys(values, EXECUTION_ATTEMPT_KEYS);
  const localCoveragePct = firstFiniteByKeys(values, EXECUTION_COVERAGE_KEYS);
  const localProgressPct = firstFiniteByKeys(values, EXECUTION_PROGRESS_KEYS);
  const localVbm = firstFiniteByKeys(values, EXECUTION_VBM_KEYS);

  const turfKey = normalizeContextKey(office.turfId);
  const precinctKey = normalizeContextKey(firstTextByKeys(values, ["precinct", "precinct_id", "precinctId"]));
  const turfTouches = turfKey ? Number(ops?.touchesByTurfKey?.get?.(turfKey) || 0) : 0;
  const precinctTouches = precinctKey ? Number(ops?.touchesByPrecinctKey?.get?.(precinctKey) || 0) : 0;
  const touches = Math.max(0, turfTouches, precinctTouches);

  const organizerKey = normalizeContextKey(office.organizer);
  const organizerRow = organizerKey
    ? (ops?.organizerById?.get?.(organizerKey) || ops?.organizerByName?.get?.(organizerKey) || null)
    : null;

  const coverageText = touches > 0
    ? `Activity coverage: ${touches.toLocaleString()} turf/precinct event touch${touches === 1 ? "" : "es"} logged for this area context.`
    : (localCoveragePct != null
      ? `Activity coverage: ${formatPercentContext(localCoveragePct)} in available read-only context.`
      : "Activity coverage: no area-level operations coverage signal in current context.");

  const progressText = organizerRow
    ? `Progress context: ${cleanText(organizerRow?.status) || "Watch"} (${Number(organizerRow?.completedThisWeek || 0).toLocaleString()} support IDs this week; ${Number(organizerRow?.completedToDate || 0).toLocaleString()} to date).`
    : (localProgressPct != null
      ? `Progress context: ${formatPercentContext(localProgressPct)} completion signal in available read-only context.`
      : "Progress context: no area-level execution progress signal in current context.");

  const organizerPresenceText = organizerRow
    ? `Organizer presence: ${cleanText(organizerRow?.name) || cleanText(office.organizer) || "assigned"} with ${Number(organizerRow?.activeVolunteers || 0).toLocaleString()} active volunteers.`
    : (cleanText(office.organizer)
      ? `Organizer presence: ${cleanText(office.organizer)} assigned (office/turf context).`
      : "Organizer presence: no organizer assignment signal in current context.");

  const vbmCount = Math.max(0, Number(localVbm || 0), Number(organizerRow?.vbmsCollected || 0));
  const vbmText = vbmCount > 0
    ? `Ballot collection / VBM context: ${vbmCount.toLocaleString()} recorded in available execution context.`
    : "Ballot collection / VBM context: no area-level VBM signal in current context.";

  const signalCount = [
    localAttempts != null || touches > 0,
    localCoveragePct != null || touches > 0,
    localProgressPct != null || !!organizerRow,
    !!cleanText(office.organizer) || !!organizerRow,
    vbmCount > 0,
  ].filter(Boolean).length;
  const hasSignal = signalCount > 0;

  const interpretation = hasSignal
    ? "Execution/ops context: use this area signal to direct manager check-ins and short-cycle deployment follow-up, not to rewrite planning truth."
    : "Execution/ops context: area-level execution signals are not present; use office-level operations surfaces for immediate decisions.";

  return {
    hasSignal,
    signalCount,
    coverageText,
    progressText,
    organizerPresenceText,
    vbmText,
    interpretation,
    localAttempts: localAttempts == null ? null : localAttempts,
    touches,
    supportIdsGlobal: Number(ops?.productionSupportIds || 0) || 0,
  };
}

function extractCanonicalPoint(rowValues) {
  const lat = firstFiniteByKeys(rowValues, ROW_LAT_KEYS);
  const lon = firstFiniteByKeys(rowValues, ROW_LON_KEYS);
  if (lat == null || lon == null) {
    return null;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  return { lat, lon };
}

function metricDefinitions(metricSetId) {
  const id = cleanText(metricSetId) || "core";
  return getMetricsForSet(id)
    .map((row) => ({
      id: cleanText(row?.id),
      label: cleanText(row?.label) || cleanText(row?.id),
      format: cleanText(row?.format) || "int",
      kind: cleanText(row?.kind),
      sumVars: Array.isArray(row?.sumVars) ? row.sumVars.slice() : [],
      numeratorVars: Array.isArray(row?.numeratorVars) ? row.numeratorVars.slice() : [],
      denominatorVars: Array.isArray(row?.denominatorVars) ? row.denominatorVars.slice() : [],
      valueVar: cleanText(row?.valueVar),
      weightVar: cleanText(row?.weightVar),
      family: metricFamilyLabel(id, cleanText(row?.id)),
      description: metricDescriptionText(row, id),
    }))
    .filter((row) => row.id);
}

function metricFamilyLabel(metricSetId, metricId) {
  const setId = cleanText(metricSetId) || "core";
  const id = cleanLower(metricId);
  const isEarlyVoteMetric = EARLY_VOTE_METRIC_PATTERNS.some((token) => id.includes(token));
  if (isEarlyVoteMetric) {
    return "Early vote context";
  }
  const fromSet = cleanText(METRIC_FAMILY_BY_SET_MAP[setId]);
  if (setId !== "all") {
    return fromSet || "Canonical context";
  }
  if (
    id.includes("population")
    || id.includes("household")
    || id.includes("housing")
    || id.includes("renter")
    || id.includes("owner")
    || id.includes("multi_unit")
  ) {
    return "Geography / density";
  }
  if (
    id.includes("turnout")
    || id.includes("citizen")
    || id.includes("poverty")
    || id.includes("income")
    || id.includes("age_")
  ) {
    return "Turnout context";
  }
  if (
    id.includes("white_share")
    || id.includes("black_share")
    || id.includes("hispanic_share")
    || id.includes("male_share")
    || id.includes("female_share")
    || id.includes("ba_plus")
  ) {
    return "Persuasion context";
  }
  if (
    id.includes("no_vehicle")
    || id.includes("commute")
    || id.includes("internet")
    || id.includes("limited_english")
  ) {
    return "Operational priority";
  }
  return fromSet || "Mixed families";
}

function metricFamilyProvenanceText(familyLabel) {
  const family = cleanText(familyLabel) || "Canonical context";
  return METRIC_FAMILY_PROVENANCE_MAP[family]
    || METRIC_FAMILY_PROVENANCE_MAP["Canonical context"];
}

function metricDescriptionText(metric, metricSetId) {
  const row = metric && typeof metric === "object" ? metric : {};
  const label = cleanText(row?.label) || cleanText(row?.id) || "Metric";
  const family = metricFamilyLabel(metricSetId, cleanText(row?.id));
  const familyProvenance = metricFamilyProvenanceText(family);
  const setLabel = metricSetLabel(metricSetId);
  const kind = cleanText(row?.kind);
  let kindText = "derived from canonical Census rows.";
  if (kind === "ratio") {
    kindText = "computed as a canonical ratio from Census ACS variables.";
  } else if (kind === "sum") {
    kindText = "computed as a canonical sum from Census ACS variables.";
  } else if (kind === "weighted_mean") {
    kindText = "computed as a canonical weighted mean from Census ACS variables.";
  }
  return `${label}: ${family} signal in the ${setLabel} bundle; ${kindText} ${familyProvenance}`;
}

function filterMetricInventoryForDisplay(inventory) {
  // Keep chooser focused on map-ready canon rows; omit empty options instead of presenting stub selections.
  const rows = Array.isArray(inventory) ? inventory : [];
  return rows.filter((row) => Number(row?.availableCount || 0) > 0);
}

function resolveOfficeTurfContext(rowValues, shellScope) {
  const values = rowValues && typeof rowValues === "object" ? rowValues : {};
  const activeOfficeId = cleanText(shellScope?.officeId);
  const officeScopeId = firstTextByKeys(values, OFFICE_CONTEXT_KEYS);
  const turfId = firstTextByKeys(values, TURF_CONTEXT_KEYS);
  const organizer = firstTextByKeys(values, ORGANIZER_CONTEXT_KEYS);
  const officeInScope = !activeOfficeId
    ? true
    : (!!officeScopeId && cleanLower(officeScopeId) === cleanLower(activeOfficeId));
  return {
    officeScopeId,
    officeInScope,
    turfId,
    organizer,
    hasTurfContext: !!(turfId || organizer),
  };
}

function resolveOrganizationalLayerContext({ officeScopeId, turfId, organizer } = {}, shellScope) {
  const office = cleanText(officeScopeId);
  const turf = cleanText(turfId);
  const owner = cleanText(organizer);
  const activeOffice = cleanText(shellScope?.officeId);
  if (turf || owner) {
    return "Turf assignment context";
  }
  if (office) {
    return "Office footprint context";
  }
  if (activeOffice) {
    return "Campaign footprint context (office-scoped selection)";
  }
  return "Campaign footprint context";
}

function buildMetricInventory(metrics, rowsByGeoid, geoids) {
  const out = [];
  for (const metric of metrics) {
    let availableCount = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (const geoid of geoids) {
      const rowValues = rowsByGeoid?.[geoid]?.values;
      const value = metricValueForRow(metric, rowValues);
      if (value == null) {
        continue;
      }
      availableCount += 1;
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    }
    out.push({
      ...metric,
      availableCount,
      minValue: Number.isFinite(minValue) ? minValue : null,
      maxValue: Number.isFinite(maxValue) ? maxValue : null,
    });
  }
  return out;
}

function selectedGeographyFromConfig(config) {
  const options = Array.isArray(config?.geoSelectOptions) ? config.geoSelectOptions : [];
  const labels = new Map();
  const selectedRaw = [];
  for (const row of options) {
    const value = cleanText(row?.value);
    const label = cleanText(row?.label) || value;
    if (value) {
      labels.set(value, label);
    }
    if (row?.selected && value) {
      selectedRaw.push(value);
    }
  }
  const resolution = cleanText(config?.resolution);
  const selectedGeoids = normalizeGeoidsForResolution(selectedRaw, resolution);
  const normalizedLabels = new Map();
  const expectedLength = selectedGeoids[0]?.length || 0;
  for (const [value, label] of labels.entries()) {
    const normalized = normalizeGeoidToken(value, expectedLength);
    if (normalized) {
      normalizedLabels.set(normalized, label);
    }
  }
  return {
    resolution,
    selectedGeoids,
    labelsByGeoid: normalizedLabels,
  };
}

function readFeatureGeoid(feature, expectedLength = 0) {
  const properties = feature?.properties && typeof feature.properties === "object"
    ? feature.properties
    : {};
  const raw = properties.GEOID ?? properties.geoid ?? feature?.id;
  return normalizeGeoidToken(raw, expectedLength);
}

async function fetchBoundaryCollection({ resolution, geoids }) {
  const normalized = normalizeGeoidsForResolution(geoids, resolution);
  const expectedLength = normalized[0]?.length || 0;
  const requested = new Set(normalized);
  const result = await fetchTigerBoundaryGeojson({ resolution, geoids: normalized });
  const features = (result?.featureCollection?.features || [])
    .map((feature) => {
      const geoid = readFeatureGeoid(feature, expectedLength);
      if (!geoid || !requested.has(geoid)) {
        return null;
      }
      const nextProps = feature?.properties && typeof feature.properties === "object"
        ? { ...feature.properties }
        : {};
      nextProps.geoid = geoid;
      return {
        type: "Feature",
        geometry: feature?.geometry || null,
        properties: nextProps,
      };
    })
    .filter((feature) => feature && feature.geometry);
  return {
    featureCollection: {
      type: "FeatureCollection",
      features,
    },
    matchedGeoids: Array.isArray(result?.matchedGeoids)
      ? normalizeGeoidsForResolution(result.matchedGeoids, resolution)
      : [],
    missingGeoids: Array.isArray(result?.missingGeoids)
      ? normalizeGeoidsForResolution(result.missingGeoids, resolution)
      : normalized.filter((geoid) => !features.some((feature) => cleanText(feature?.properties?.geoid) === geoid)),
  };
}

function buildMetricRankMap(areaFeatures) {
  const ranked = (Array.isArray(areaFeatures) ? areaFeatures : [])
    .filter((feature) => feature?.properties?.hasMetric === true)
    .map((feature) => ({
      geoid: cleanText(feature?.properties?.geoid),
      metricValue: toFiniteNumber(feature?.properties?.metricValue),
    }))
    .filter((row) => row.geoid && row.metricValue != null)
    .sort((a, b) => Number(b.metricValue) - Number(a.metricValue));
  const out = new Map();
  const total = ranked.length;
  ranked.forEach((row, idx) => {
    const rank = idx + 1;
    const percentile = total > 1 ? ((total - idx) / total) : 1;
    out.set(row.geoid, { rank, total, percentile });
  });
  return out;
}

function buildMapCollections({
  boundaryCollection,
  labelsByGeoid,
  rowsByGeoid,
  metric,
  resolution,
  shellScope,
  opsContext,
}) {
  const features = Array.isArray(boundaryCollection?.features) ? boundaryCollection.features : [];
  const areaFeatures = [];
  const featureByGeoid = new Map();
  const pointFeatures = [];
  let metricCount = 0;

  for (const feature of features) {
    const geoid = cleanText(feature?.properties?.geoid);
    if (!geoid) {
      continue;
    }
    const row = rowsByGeoid?.[geoid];
    const rowValues = row?.values && typeof row.values === "object" ? row.values : {};
    const metricValue = metric ? metricValueForRow(metric, rowValues) : null;
    const officeTurf = resolveOfficeTurfContext(rowValues, shellScope);
    const planningOverlay = resolvePlanningOverlayDescriptor(metric, rowValues);
    const execution = resolveExecutionContext(rowValues, officeTurf, opsContext);
    const worked = resolveWorkedActivityContext({
      geoid,
      rowValues,
      officeTurf,
      opsContext,
    });
    const hasMetric = metricValue != null;
    if (hasMetric) {
      metricCount += 1;
    }
    const label = cleanText(labelsByGeoid.get(geoid))
      || cleanText(row?.label)
      || cleanText(row?.name)
      || cleanText(feature?.properties?.NAME)
      || geoid;
    const population = toFiniteNumber(rowValues?.B01003_001E);
    const areaFeature = {
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        geoid,
        geographyType: resolutionLabel(resolution),
        label,
        hasMetric,
        metricValue: hasMetric ? metricValue : null,
        metricText: hasMetric ? formatMetricValue(metricValue, metric?.format) : "—",
        population: population == null ? null : population,
        turnoutPersuasionContext: resolveTurnoutPersuasionSplitContext(rowValues),
        planningOverlayId: cleanText(planningOverlay?.id) || DEFAULT_PLANNING_OVERLAY.id,
        planningOverlayLabel: cleanText(planningOverlay?.label) || DEFAULT_PLANNING_OVERLAY.label,
        planningOverlayProvenance: cleanText(planningOverlay?.provenance) || DEFAULT_PLANNING_OVERLAY.provenance,
        planningOverlayInterpretation: cleanText(planningOverlay?.interpretation) || DEFAULT_PLANNING_OVERLAY.interpretation,
        earlyVoteContext: cleanText(planningOverlay?.earlyVoteContext),
        executionHasSignal: execution.hasSignal,
        executionSignalCount: execution.signalCount,
        executionCoverageText: cleanText(execution.coverageText),
        executionProgressText: cleanText(execution.progressText),
        executionPresenceText: cleanText(execution.organizerPresenceText),
        executionVbmText: cleanText(execution.vbmText),
        executionInterpretation: cleanText(execution.interpretation),
        workedGeographyHasSignal: worked.hasSignal,
        workedGeographyJoinCount: worked.joinCount,
        workedGeographyOfficeTouches: worked.officeTouches,
        workedGeographyOrganizerTouches: worked.organizerTouches,
        workedGeographyOfficeAttempts: worked.officeAttempts,
        workedGeographyOrganizerAttempts: worked.organizerAttempts,
        workedGeographyOfficeCanvassed: worked.officeCanvassed,
        workedGeographyOrganizerCanvassed: worked.organizerCanvassed,
        workedGeographyOfficeVbms: worked.officeVbms,
        workedGeographyOrganizerVbms: worked.organizerVbms,
        workedGeographyOfficeText: cleanText(worked.coverageText),
        workedGeographyOrganizerText: cleanText(worked.organizerText),
        workedGeographyInterpretation: cleanText(worked.interpretation),
        workedGeographyJoinKeys: Array.isArray(worked.matchedJoinKeys) ? worked.matchedJoinKeys.join(", ") : "",
        workedGeographyScopeType: cleanText(worked.scopeType),
        workedGeographyScopeOfficeId: cleanText(worked.scopeOfficeId),
        workedGeographyScopeOrganizerId: cleanText(worked.scopeOrganizerId),
        workedGeographyScopeOrganizerLabel: cleanText(worked.scopeOrganizerLabel),
        workedGeographyScopeSource: cleanText(opsContext?.workedScope?.source),
        officeScopeId: officeTurf.officeScopeId,
        officeInScope: officeTurf.officeInScope,
        turfId: officeTurf.turfId,
        organizer: officeTurf.organizer,
        hasTurfContext: officeTurf.hasTurfContext,
      },
    };
    areaFeatures.push(areaFeature);
    if (!featureByGeoid.has(geoid)) {
      featureByGeoid.set(geoid, areaFeature);
    }
  }

  const rankByGeoid = buildMetricRankMap(areaFeatures);
  for (const feature of areaFeatures) {
    const geoid = cleanText(feature?.properties?.geoid);
    const rank = rankByGeoid.get(geoid);
    if (!rank) {
      feature.properties.metricRank = null;
      feature.properties.metricRankTotal = null;
      feature.properties.metricPercentile = null;
      continue;
    }
    feature.properties.metricRank = rank.rank;
    feature.properties.metricRankTotal = rank.total;
    feature.properties.metricPercentile = rank.percentile;
  }

  const workedStateModel = deriveWorkedActivityStateRows(
    areaFeatures.map((feature) => {
      const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
      return {
        geoid: cleanText(props?.geoid),
        officeTouches: Number(props?.workedGeographyOfficeTouches || 0) || 0,
        organizerTouches: Number(props?.workedGeographyOrganizerTouches || 0) || 0,
      };
    }),
    {
      focusType: cleanText(opsContext?.workedScope?.focusType),
      highQuantile: 0.8,
      minPositiveRowsForHigh: 3,
    },
  );
  const workedStateByGeoid = new Map(workedStateModel.rows.map((row) => [cleanText(row?.geoid), row]));
  for (const feature of areaFeatures) {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    const geoid = cleanText(props?.geoid);
    const stateRow = workedStateByGeoid.get(geoid);
    if (!stateRow) {
      feature.properties.workedActivitySignalValue = 0;
      feature.properties.workedActivityState = WORKED_ACTIVITY_STATE_NONE;
      feature.properties.workedActivityStateLabel = "No recorded activity";
      continue;
    }
    feature.properties.workedActivitySignalValue = Math.max(0, Number(stateRow.signalValue || 0) || 0);
    feature.properties.workedActivityState = cleanText(stateRow.state) || WORKED_ACTIVITY_STATE_NONE;
    feature.properties.workedActivityStateLabel = cleanText(stateRow.stateLabel) || "No recorded activity";
  }

  for (const [geoid, areaFeature] of featureByGeoid.entries()) {
    const rowValues = rowsByGeoid?.[geoid]?.values;
    const point = extractCanonicalPoint(rowValues);
    if (!point) {
      continue;
    }
    pointFeatures.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
      properties: {
        geoid,
        label: cleanText(areaFeature?.properties?.label) || geoid,
      },
    });
  }

  return {
    areaFeatureCollection: { type: "FeatureCollection", features: areaFeatures },
    pointFeatureCollection: { type: "FeatureCollection", features: pointFeatures },
    featureByGeoid,
    metricCount,
    rankByGeoid,
    workedActivityModel: {
      focusType: cleanText(workedStateModel?.focusType),
      highThreshold: Number(workedStateModel?.highThreshold || 0) || 0,
      canClassifyHigh: !!workedStateModel?.canClassifyHigh,
      positiveRowCount: Number(workedStateModel?.positiveRowCount || 0) || 0,
      stateCounts: workedStateModel?.stateCounts && typeof workedStateModel.stateCounts === "object"
        ? {
          [WORKED_ACTIVITY_STATE_NONE]: Number(workedStateModel.stateCounts[WORKED_ACTIVITY_STATE_NONE] || 0) || 0,
          [WORKED_ACTIVITY_STATE_RECORDED]: Number(workedStateModel.stateCounts[WORKED_ACTIVITY_STATE_RECORDED] || 0) || 0,
          [WORKED_ACTIVITY_STATE_HIGH]: Number(workedStateModel.stateCounts[WORKED_ACTIVITY_STATE_HIGH] || 0) || 0,
        }
        : {
          [WORKED_ACTIVITY_STATE_NONE]: 0,
          [WORKED_ACTIVITY_STATE_RECORDED]: 0,
          [WORKED_ACTIVITY_STATE_HIGH]: 0,
        },
    },
  };
}

function ensureMapboxCss() {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(MAPBOX_CSS_ID)) {
    return;
  }
  const link = document.createElement("link");
  link.id = MAPBOX_CSS_ID;
  link.rel = "stylesheet";
  link.href = MAPBOX_CSS_URL;
  document.head.append(link);
}

function loadMapboxGl() {
  if (globalThis?.mapboxgl && typeof globalThis.mapboxgl.Map === "function") {
    return Promise.resolve(globalThis.mapboxgl);
  }
  if (mapboxLoadPromise) {
    return mapboxLoadPromise;
  }
  mapboxLoadPromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is unavailable."));
      return;
    }
    ensureMapboxCss();
    let script = document.getElementById(MAPBOX_SCRIPT_ID);
    if (!(script instanceof HTMLScriptElement)) {
      script = document.createElement("script");
      script.id = MAPBOX_SCRIPT_ID;
      script.src = MAPBOX_JS_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    const resolveReady = () => {
      if (globalThis?.mapboxgl && typeof globalThis.mapboxgl.Map === "function") {
        resolve(globalThis.mapboxgl);
        return;
      }
      reject(new Error("Mapbox GL did not initialize."));
    };
    script.addEventListener("load", resolveReady, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Mapbox GL assets.")), { once: true });
  }).catch((error) => {
    mapboxLoadPromise = null;
    throw error;
  });
  return mapboxLoadPromise;
}

function classifyMapBootError(error) {
  const text = cleanText(error?.message).toLowerCase();
  if (!text) {
    return "unknown";
  }
  if (
    text.includes("unauthorized")
    || text.includes("forbidden")
    || text.includes("access token")
    || text.includes("invalid token")
    || text.includes("401")
    || text.includes("403")
  ) {
    return "token";
  }
  if (text.includes("failed to load mapbox gl")) {
    return "assets";
  }
  if (text.includes("style failed to load")) {
    return "style";
  }
  return "unknown";
}

function setStatusLevel(el, level = "muted") {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.classList.remove(...STATUS_LEVELS);
  el.classList.add(STATUS_LEVELS.includes(level) ? level : "muted");
}

function setTextWithLevel(el, text, level = "muted") {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.textContent = text;
  setStatusLevel(el, level);
}

function setCardStatus(text) {
  const el = document.getElementById(CARD_STATUS_ID);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.textContent = cleanText(text) || "Awaiting context";
}

function setMetricSelectorDisabled(selectEl, placeholder = "") {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return;
  }
  selectEl.disabled = true;
  if (!placeholder) {
    return;
  }
  selectEl.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  selectEl.append(option);
  selectEl.value = "";
}

function setMetricSelectorEnabled(selectEl, enabled = true) {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return;
  }
  selectEl.disabled = !enabled;
}

function syncMetricSelector(selectEl, inventory, selectedMetricId) {
  if (!(selectEl instanceof HTMLSelectElement)) {
    return "";
  }
  const options = Array.isArray(inventory) ? inventory : [];
  selectEl.innerHTML = "";
  if (!options.length) {
    selectEl.value = "";
    selectEl.title = "";
    return "";
  }
  const groups = new Map();
  for (const row of options) {
    const family = cleanText(row?.family) || "Canonical context";
    if (!groups.has(family)) {
      groups.set(family, []);
    }
    groups.get(family).push(row);
  }
  for (const [family, rows] of groups.entries()) {
    const group = document.createElement("optgroup");
    group.label = family;
    for (const row of rows) {
      const value = cleanText(row?.id);
      if (!value) {
        continue;
      }
      const option = document.createElement("option");
      option.value = value;
      option.textContent = cleanText(row?.label) || value;
      option.title = cleanText(row?.description);
      group.append(option);
    }
    if (group.children.length) {
      selectEl.append(group);
    }
  }
  const inventoryById = new Map(options.map((row) => [cleanText(row.id), row]));
  const preferred = cleanText(selectedMetricId);
  const fallbackWithData = options.find((row) => row.availableCount > 0)?.id || "";
  const fallbackAny = options[0]?.id || "";
  const nextValue = inventoryById.has(preferred) ? preferred : (fallbackWithData || fallbackAny);
  selectEl.value = nextValue;
  const active = inventoryById.get(nextValue);
  selectEl.title = cleanText(active?.description);
  return nextValue;
}

function syncMetricHelp(metricHelpEl, metric) {
  if (!(metricHelpEl instanceof HTMLElement)) {
    return;
  }
  const row = metric && typeof metric === "object" ? metric : null;
  if (!row) {
    setTextWithLevel(
      metricHelpEl,
      "Metric guidance appears after geography context and metric bundles load.",
      "muted",
    );
    return;
  }
  const family = cleanText(row?.family) || "Canonical context";
  const description = cleanText(row?.description);
  const familyProvenance = metricFamilyProvenanceText(family);
  setTextWithLevel(
    metricHelpEl,
    description
      ? `${family}: ${description}`
      : `${family}: canonical display-only map metric. ${familyProvenance}`,
    "muted",
  );
}

function setMapActionButton(buttonEl, { visible = false, label = "Open Controls", disabled = false } = {}) {
  if (!(buttonEl instanceof HTMLButtonElement)) {
    return;
  }
  buttonEl.hidden = !visible;
  buttonEl.disabled = !!disabled;
  if (label) {
    buttonEl.textContent = String(label);
  }
}

function setControlDisabled(el, disabled = true) {
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    el.disabled = !!disabled;
  }
}

function resolveModeScopeStatus(runtime) {
  const safeRuntime = runtime && typeof runtime === "object" ? runtime : {};
  const mode = normalizeContextMode(safeRuntime.contextMode);
  const modeLabel = contextModeLabel(mode);
  const officeId = cleanText(safeRuntime?.shellScope?.officeId) || cleanText(safeRuntime?.opsContext?.activeOfficeId);
  const workedScope = safeRuntime?.opsContext?.workedScope && typeof safeRuntime.opsContext.workedScope === "object"
    ? safeRuntime.opsContext.workedScope
    : (safeRuntime?.workedBridgeContext && typeof safeRuntime.workedBridgeContext === "object"
      ? safeRuntime.workedBridgeContext
      : null);
  const workedScopeType = normalizeBridgeFocusType(workedScope?.focusType);
  const organizerQuickScope = resolveOrganizerWorkedQuickScope(safeRuntime);
  const organizerLabel = cleanText(organizerQuickScope?.organizerLabel)
    || cleanText(safeRuntime?.opsContext?.activeOrganizerLabel)
    || cleanText(safeRuntime?.opsContext?.activeOrganizerId);
  const selectedGeoid = cleanText(safeRuntime?.selectedGeoid);
  const selectedFeature = selectedGeoid
    ? safeRuntime?.featureByGeoid?.get?.(selectedGeoid)
    : null;
  const selectedLabel = cleanText(selectedFeature?.properties?.label) || selectedGeoid || "None";

  let scopeText = "Campaign footprint";
  let level = "muted";
  if (mode === CONTEXT_MODE_OFFICE) {
    scopeText = officeId ? `Office ${officeId}` : "Office context unavailable";
    if (!officeId) {
      level = "warn";
    }
  } else if (mode === CONTEXT_MODE_TURF) {
    scopeText = "Turf assignment context";
  } else if (mode === CONTEXT_MODE_EXECUTION) {
    scopeText = "Execution / ops context";
  } else if (mode === CONTEXT_MODE_WORKED) {
    if (workedScopeType === "organizer") {
      scopeText = organizerLabel
        ? `Organizer ${organizerLabel} worked geography`
        : "Organizer worked geography (organizer context unavailable)";
      if (!organizerLabel) {
        level = "warn";
      }
    } else {
      const workedOfficeId = cleanText(workedScope?.officeId) || officeId;
      scopeText = workedOfficeId
        ? `Office ${workedOfficeId} worked geography`
        : "Worked geography (office context unavailable)";
      if (!workedOfficeId) {
        level = "warn";
      }
    }
  }

  return {
    text: `Mode: ${modeLabel}. Scope: ${scopeText}. Active office: ${officeId || "—"}. Active organizer: ${organizerLabel || "—"}. Selected area: ${selectedLabel}.`,
    level,
  };
}

function buildModeScopeSummaryText(runtime) {
  const summary = resolveModeScopeStatus(runtime);
  return cleanText(summary?.text);
}

function syncMapModeScopeState(els, runtime) {
  if (!(els?.modeScopeStatus instanceof HTMLElement)) {
    return;
  }
  const summary = resolveModeScopeStatus(runtime);
  setTextWithLevel(els.modeScopeStatus, summary.text, summary.level);
}

function resolveContextTrustStatus(runtime) {
  const safeRuntime = runtime && typeof runtime === "object" ? runtime : {};
  const mode = normalizeContextMode(safeRuntime?.contextMode);
  if (mode === CONTEXT_MODE_OFFICE) {
    return {
      text: "Trust: office view uses canonical office-tagged geography rows when present; if office tags are missing it falls back to campaign footprint (display-only context).",
      level: "muted",
    };
  }
  if (mode === CONTEXT_MODE_TURF) {
    return {
      text: "Trust: turf context is canonical assignment context only when present in rows; this map does not invent or infer assignment turf geometry.",
      level: "muted",
    };
  }
  if (mode === CONTEXT_MODE_EXECUTION) {
    return {
      text: "Trust: execution view shows read-only operations context signals; use as manager visibility, not as a replacement for canon planning truth.",
      level: "muted",
    };
  }
  if (mode === CONTEXT_MODE_WORKED) {
    return {
      text: "Trust: worked geography uses exact geography joins from logged turfEvents activity evidence; no recorded activity means no matching event evidence was joined for that area in scope.",
      level: "muted",
    };
  }
  return {
    text: "Trust: campaign view shows canonical campaign geography footprint and map-safe display overlays; render layer only, canon math unchanged.",
    level: "muted",
  };
}

function syncMapTrustStatus(els, runtime) {
  if (!(els?.trustStatus instanceof HTMLElement)) {
    return;
  }
  const trust = resolveContextTrustStatus(runtime);
  setTextWithLevel(els.trustStatus, trust.text, trust.level);
}

function diagnosticFallbackReasonForStatus(status, runtime) {
  const code = cleanText(status);
  if (code === "token_missing_config") {
    return "No Mapbox public token is configured in Controls.";
  }
  if (code === "token_invalid_config" || code === "boot_failed_token") {
    return "Configured Mapbox token is invalid for browser rendering (must be a valid pk token).";
  }
  if (code === "awaiting_context") {
    return "Campaign, office, and geography context is incomplete.";
  }
  if (code === "geometry_unavailable") {
    return "Boundary geometry request failed for the active campaign geography context.";
  }
  if (code === "no_geography") {
    return "No mapped geography matched the selected campaign/office/geography context.";
  }
  if (code === "boot_failed_style") {
    return "Map style assets did not load.";
  }
  if (code === "boot_failed_runtime") {
    return "Map runtime assets failed to load.";
  }
  if (code === "ready_office_fallback_campaign") {
    return "Office context has no mapped office-tagged geometry in current rows; campaign footprint fallback is active.";
  }
  if (code === "ready_worked_no_activity") {
    return "Worked geography mode is active but no joined turfEvents activity evidence matched the selected scope.";
  }
  const mode = normalizeContextMode(runtime?.contextMode);
  if (mode === CONTEXT_MODE_OFFICE && runtime?.officeFocusState?.fallbackToCampaign) {
    return "Office view has no office-tagged mapped geography in current rows; campaign footprint fallback is active.";
  }
  if (mode === CONTEXT_MODE_WORKED) {
    const focusType = normalizeBridgeFocusType(runtime?.opsContext?.workedScope?.focusType);
    const organizerLabel = cleanText(runtime?.opsContext?.workedScope?.organizerLabel)
      || cleanText(runtime?.opsContext?.workedScope?.organizerId);
    const officeId = cleanText(runtime?.opsContext?.workedScope?.officeId) || cleanText(runtime?.shellScope?.officeId);
    const summary = runtime?.workedExecutionSummary && typeof runtime.workedExecutionSummary === "object"
      ? runtime.workedExecutionSummary
      : null;
    if (summary && !summary.hasEvidence) {
      if (focusType === "organizer") {
        return organizerLabel
          ? `Selected organizer ${organizerLabel} has no joined worked-geography activity evidence in this mapped scope.`
          : "Worked mode is active but organizer scope is missing or has no joined activity evidence.";
      }
      if (officeId) {
        return `Selected office ${officeId} has no joined worked-geography activity evidence in this mapped scope.`;
      }
      return "Worked mode has no joined activity evidence for the current scope.";
    }
  }
  return "";
}

function resolveMapDiagnosticStatus(runtime) {
  const safeRuntime = runtime && typeof runtime === "object" ? runtime : {};
  const tokenConfig = readMapboxPublicTokenConfig();
  const tokenStatus = tokenConfig?.valid
    ? "configured"
    : (tokenConfig?.invalidConfigValue ? "invalid" : "missing");
  const mode = normalizeContextMode(safeRuntime?.contextMode);
  const modeLabel = contextModeLabel(mode);
  const scopeLabel = mode === CONTEXT_MODE_WORKED
    ? resolveWorkedScopeLabel(safeRuntime?.opsContext, safeRuntime?.shellScope)
    : (mode === CONTEXT_MODE_OFFICE
      ? `Office ${cleanText(safeRuntime?.shellScope?.officeId) || "selected"}`
      : (mode === CONTEXT_MODE_CAMPAIGN ? "Campaign footprint" : modeLabel));
  const officeId = cleanText(safeRuntime?.shellScope?.officeId)
    || cleanText(safeRuntime?.opsContext?.workedScope?.officeId);
  const organizerLabel = cleanText(safeRuntime?.opsContext?.workedScope?.organizerLabel)
    || cleanText(safeRuntime?.opsContext?.workedScope?.organizerId);
  const mappedFeatureCount = Number(safeRuntime?.featureByGeoid?.size || 0);
  const summary = safeRuntime?.workedExecutionSummary && typeof safeRuntime.workedExecutionSummary === "object"
    ? safeRuntime.workedExecutionSummary
    : null;
  const workedEvidenceText = summary
    ? `${summary.hasEvidence ? "matched" : "none"} (${Number(summary.joinedUnitCount || 0).toLocaleString()} units, ${Number(summary.touches || 0).toLocaleString()} touches)`
    : "unknown";
  const fallbackReason = diagnosticFallbackReasonForStatus(
    cleanText(globalThis?.__FPE_MAP_RUNTIME_DIAGNOSTICS__?.status) || "",
    safeRuntime,
  );
  return {
    text: `Diagnostics: token ${tokenStatus} • geometry ${mappedFeatureCount.toLocaleString()} mapped • mode ${modeLabel} • scope ${scopeLabel} • office ${officeId || "—"} • organizer ${organizerLabel || "—"} • worked evidence ${workedEvidenceText}${fallbackReason ? ` • fallback: ${fallbackReason}` : ""}.`,
    level: fallbackReason ? "warn" : "muted",
    tokenStatus,
    fallbackReason,
  };
}

function syncMapDiagnosticStatus(els, runtime) {
  if (!(els?.diagnosticStatus instanceof HTMLElement)) {
    return;
  }
  const diag = resolveMapDiagnosticStatus(runtime);
  setTextWithLevel(els.diagnosticStatus, diag.text, diag.level);
}

function syncMapNavigationState(els, runtime, { statusText = "", level = "muted" } = {}) {
  const hasFeatures = Number(runtime?.featureByGeoid?.size || 0) > 0;
  const hasSelection = !!cleanText(runtime?.selectedGeoid) && !!runtime?.featureByGeoid?.has?.(runtime.selectedGeoid);
  const hasBookmark = !!cleanText(runtime?.bookmarkedGeoid) && !!runtime?.featureByGeoid?.has?.(runtime.bookmarkedGeoid);
  const hasBoundary = Array.isArray(runtime?.boundaryFeatureCollection?.features) && runtime.boundaryFeatureCollection.features.length > 0;
  const mapReady = !!runtime?.mapLoaded;
  const hasOrganizerWorkedScope = !!resolveOrganizerWorkedQuickScope(runtime);

  setControlDisabled(els?.searchInput, !hasFeatures);
  setControlDisabled(els?.searchBtn, !hasFeatures);
  setControlDisabled(els?.clearSelectionBtn, !hasSelection);
  setControlDisabled(els?.viewCampaignBtn, !mapReady || !hasBoundary);
  setControlDisabled(els?.viewOfficeBtn, !mapReady || !hasFeatures);
  setControlDisabled(els?.refitScopeBtn, !mapReady || !hasFeatures);
  setControlDisabled(els?.viewWorkedOrganizerBtn, !mapReady || !hasFeatures || !hasOrganizerWorkedScope);
  setControlDisabled(els?.viewSelectedBtn, !mapReady || !hasSelection);
  setControlDisabled(els?.saveBookmarkBtn, !hasSelection);
  setControlDisabled(els?.jumpBookmarkBtn, !mapReady || !hasBookmark);
  setControlDisabled(els?.copyInspectBtn, !hasSelection);
  syncMapModeScopeState(els, runtime);
  syncMapTrustStatus(els, runtime);
  syncMapDiagnosticStatus(els, runtime);

  if (!(els?.navStatus instanceof HTMLElement)) {
    return;
  }
  if (cleanText(statusText)) {
    setTextWithLevel(els.navStatus, statusText, level);
    return;
  }
  if (!mapReady) {
    setTextWithLevel(els.navStatus, "Search and quick navigation become available once map geography loads.", "muted");
    return;
  }
  if (!hasFeatures) {
    setTextWithLevel(els.navStatus, "No mapped areas are available to search for the current context.", "warn");
    return;
  }
  if (!hasSelection) {
    setTextWithLevel(els.navStatus, "Search by area name/GEOID or use prefixes (district:, office:, turf:, organizer:, precinct:, tract:), then click map areas to inspect.", "muted");
    return;
  }
  const selected = runtime?.featureByGeoid?.get?.(runtime.selectedGeoid);
  const label = cleanText(selected?.properties?.label) || cleanText(runtime?.selectedGeoid) || "Selected area";
  const bookmarkLabel = cleanText(runtime?.bookmarkedLabel);
  setTextWithLevel(
    els.navStatus,
    bookmarkLabel
      ? `Selected area: ${label}. Bookmark saved for ${bookmarkLabel}.`
      : `Selected area: ${label}. Use Selected area view, bookmark, or Copy area summary for quick actions.`,
    "ok",
  );
}

function defaultFeatureCollection() {
  return { type: "FeatureCollection", features: [] };
}

function setSourceData(map, sourceId, data) {
  const source = map?.getSource?.(sourceId);
  if (source && typeof source.setData === "function") {
    source.setData(data || defaultFeatureCollection());
  }
}

function quantileAt(values, q) {
  const sorted = Array.isArray(values) ? values : [];
  if (!sorted.length) {
    return null;
  }
  const clamped = Math.max(0, Math.min(1, Number(q)));
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * clamped)));
  const value = toFiniteNumber(sorted[index]);
  return value == null ? null : value;
}

function buildLegendModel(metric, featureCollection) {
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : [];
  const values = features
    .map((feature) => toFiniteNumber(feature?.properties?.metricValue))
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  if (!metric || !values.length) {
    return {
      ready: false,
      bins: [],
      values,
      rangeText: "No mapped values for this metric in the current geography.",
      rangeMode: "n/a",
    };
  }
  const min = values[0];
  const max = values[values.length - 1];
  if (min == null || max == null) {
    return {
      ready: false,
      bins: [],
      values: [],
      rangeText: "No mapped values for this metric in the current geography.",
      rangeMode: "n/a",
    };
  }
  if (min === max) {
    return {
      ready: true,
      bins: [{
        color: LEGEND_COLORS[2],
        min,
        max,
        label: `${formatMetricValue(min, metric?.format)} (uniform value)`,
      }],
      values,
      rangeText: `${formatMetricValue(min, metric?.format)} across mapped areas`,
      rangeMode: "single-value",
    };
  }
  const quantiles = [
    quantileAt(values, 0.2),
    quantileAt(values, 0.4),
    quantileAt(values, 0.6),
    quantileAt(values, 0.8),
  ].map((value) => (value == null ? min : value));
  const thresholds = [min, ...quantiles, max];
  const bins = [];
  for (let idx = 0; idx < LEGEND_COLORS.length; idx += 1) {
    const start = thresholds[idx];
    const end = idx === LEGEND_COLORS.length - 1 ? max : thresholds[idx + 1];
    const low = toFiniteNumber(start);
    const high = toFiniteNumber(end);
    if (low == null || high == null) {
      continue;
    }
    bins.push({
      color: LEGEND_COLORS[idx],
      min: low,
      max: high,
      label: `${formatMetricValue(low, metric?.format)} – ${formatMetricValue(high, metric?.format)}`,
    });
  }
  return {
    ready: true,
    bins,
    values,
    rangeText: `${formatMetricValue(min, metric?.format)} to ${formatMetricValue(max, metric?.format)}`,
    rangeMode: "quantile-5",
  };
}

function fillExpressionForMetric(metric, legend) {
  if (!metric || metric.availableCount <= 0 || !legend?.ready || !Array.isArray(legend?.bins) || !legend.bins.length) {
    return "#e5e7eb";
  }
  const bins = legend.bins;
  if (bins.length === 1) {
    return bins[0]?.color || "#60a5fa";
  }
  const maxByBin = bins.map((row) => toFiniteNumber(row?.max)).filter((value) => value != null);
  const thresholds = maxByBin.slice(0, -1);
  if (!thresholds.length) {
    return bins[0]?.color || "#60a5fa";
  }
  const step = ["step", ["to-number", ["get", "metricValue"], thresholds[0]], bins[0]?.color || "#dbeafe"];
  for (let idx = 0; idx < thresholds.length; idx += 1) {
    const threshold = thresholds[idx];
    const nextColor = bins[idx + 1]?.color || bins[idx]?.color || "#1d4ed8";
    step.push(threshold, nextColor);
  }
  return [
    "case",
    ["boolean", ["get", "hasMetric"], false],
    step,
    "#e5e7eb",
  ];
}

function fillExpressionForContextMode(mode, metric, legend) {
  const base = fillExpressionForMetric(metric, legend);
  const contextMode = normalizeContextMode(mode);
  if (contextMode === CONTEXT_MODE_OFFICE) {
    return [
      "case",
      ["boolean", ["get", "officeInScope"], false],
      base,
      "#e5e7eb",
    ];
  }
  if (contextMode === CONTEXT_MODE_TURF) {
    return [
      "case",
      ["boolean", ["get", "hasTurfContext"], false],
      base,
      "#f3f4f6",
    ];
  }
  if (contextMode === CONTEXT_MODE_EXECUTION) {
    return [
      "case",
      ["boolean", ["get", "executionHasSignal"], false],
      base,
      "#f8fafc",
    ];
  }
  if (contextMode === CONTEXT_MODE_WORKED) {
    return [
      "case",
      ["==", ["get", "workedActivityState"], WORKED_ACTIVITY_STATE_HIGH],
      WORKED_ACTIVITY_STATE_COLOR_MAP[WORKED_ACTIVITY_STATE_HIGH],
      ["==", ["get", "workedActivityState"], WORKED_ACTIVITY_STATE_RECORDED],
      WORKED_ACTIVITY_STATE_COLOR_MAP[WORKED_ACTIVITY_STATE_RECORDED],
      ["boolean", ["get", "workedGeographyHasSignal"], false],
      WORKED_ACTIVITY_STATE_COLOR_MAP[WORKED_ACTIVITY_STATE_RECORDED],
      WORKED_ACTIVITY_STATE_COLOR_MAP[WORKED_ACTIVITY_STATE_NONE],
    ];
  }
  return base;
}

function outlineColorForContextMode(mode) {
  const contextMode = normalizeContextMode(mode);
  if (contextMode === CONTEXT_MODE_OFFICE) return "#0f766e";
  if (contextMode === CONTEXT_MODE_TURF) return "#7c3aed";
  if (contextMode === CONTEXT_MODE_EXECUTION) return "#b45309";
  if (contextMode === CONTEXT_MODE_WORKED) return "#1d4ed8";
  return "#334155";
}

function summarizeContextModeFeatures(featureCollection) {
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : [];
  let officeTaggedCount = 0;
  let officeInScopeCount = 0;
  let turfTaggedCount = 0;
  let organizerTaggedCount = 0;
  let executionTaggedCount = 0;
  let workedTaggedCount = 0;
  let workedNoRecordedCount = 0;
  let workedRecordedCount = 0;
  let workedHigherCount = 0;
  for (const feature of features) {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    if (cleanText(props.officeScopeId)) officeTaggedCount += 1;
    if (props.officeInScope === true) officeInScopeCount += 1;
    if (props.hasTurfContext === true) turfTaggedCount += 1;
    if (cleanText(props.organizer)) organizerTaggedCount += 1;
    if (props.executionHasSignal === true) executionTaggedCount += 1;
    if (props.workedGeographyHasSignal === true) workedTaggedCount += 1;
    const workedState = cleanText(props.workedActivityState);
    if (workedState === WORKED_ACTIVITY_STATE_HIGH) workedHigherCount += 1;
    else if (workedState === WORKED_ACTIVITY_STATE_RECORDED) workedRecordedCount += 1;
    else workedNoRecordedCount += 1;
  }
  return {
    total: features.length,
    officeTaggedCount,
    officeInScopeCount,
    turfTaggedCount,
    organizerTaggedCount,
    executionTaggedCount,
    workedTaggedCount,
    workedNoRecordedCount,
    workedRecordedCount,
    workedHigherCount,
  };
}

function syncContextModeStatus(runtime, featureCollection) {
  const el = document.getElementById(CONTEXT_MODE_STATUS_ID);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const summary = summarizeContextModeFeatures(featureCollection);
  const mode = normalizeContextMode(runtime?.contextMode);
  const officeId = cleanText(runtime?.shellScope?.officeId) || "—";
  if (mode === CONTEXT_MODE_OFFICE) {
    if (summary.officeTaggedCount > 0) {
      if (summary.officeInScopeCount <= 0) {
        setTextWithLevel(
          el,
          `Office footprint mode: no mapped areas match office ${officeId} in current canonical rows; showing campaign footprint as fallback.`,
          "warn",
        );
        return;
      }
      setTextWithLevel(
        el,
        `Office footprint mode: ${summary.officeInScopeCount.toLocaleString()} of ${summary.total.toLocaleString()} mapped areas match office ${officeId}.`,
        "ok",
      );
      return;
    }
    setTextWithLevel(
      el,
      `Office footprint mode: row-level office assignment tags are unavailable; showing campaign footprint for office ${officeId}.`,
      "warn",
    );
    return;
  }
  if (mode === CONTEXT_MODE_TURF) {
    if (summary.turfTaggedCount > 0) {
      setTextWithLevel(
        el,
        `Turf context mode: ${summary.turfTaggedCount.toLocaleString()} mapped areas include turf/precinct assignment context (${summary.organizerTaggedCount.toLocaleString()} organizer-tagged).`,
        "ok",
      );
      return;
    }
    setTextWithLevel(
      el,
      "Turf context mode: turf/organizer assignment context is not present in current canonical map rows.",
      "warn",
    );
    return;
  }
  if (mode === CONTEXT_MODE_EXECUTION) {
    if (summary.executionTaggedCount > 0) {
      setTextWithLevel(
        el,
        `Execution context mode: ${summary.executionTaggedCount.toLocaleString()} of ${summary.total.toLocaleString()} mapped areas contain execution/ops signals (coverage/progress/presence/VBM).`,
        "ok",
      );
      return;
    }
    setTextWithLevel(
      el,
      "Execution context mode: no area-level execution signals are present in current canonical + operations context.",
      "warn",
    );
    return;
  }
  if (mode === CONTEXT_MODE_WORKED) {
    const workedScope = runtime?.opsContext && typeof runtime.opsContext === "object"
      ? runtime.opsContext.workedScope
      : null;
    const focusType = normalizeBridgeFocusType(workedScope?.focusType);
    const scopeOfficeId = cleanText(workedScope?.officeId) || cleanText(runtime?.shellScope?.officeId);
    const scopeOrganizerLabel = cleanText(workedScope?.organizerLabel) || cleanText(workedScope?.organizerId);
    if (summary.workedTaggedCount > 0) {
      const scopeText = focusType === "organizer"
        ? ` selected organizer ${scopeOrganizerLabel || "scope"}`
        : (scopeOfficeId ? ` office ${scopeOfficeId}` : " current scope");
      setTextWithLevel(
        el,
        `Worked activity mode: ${summary.workedTaggedCount.toLocaleString()} active / ${summary.workedNoRecordedCount.toLocaleString()} no-recorded areas for${scopeText}; ${summary.workedHigherCount.toLocaleString()} higher activity concentration area${summary.workedHigherCount === 1 ? "" : "s"} (activity evidence, read-only context).`,
        "ok",
      );
      return;
    }
    if (focusType === "organizer" && scopeOrganizerLabel) {
      setTextWithLevel(
        el,
        `Worked activity mode: selected organizer ${scopeOrganizerLabel} has no mapped worked-geography activity evidence in current selection.`,
        "warn",
      );
      return;
    }
    if (scopeOfficeId) {
      setTextWithLevel(
        el,
        `Worked activity mode: office ${scopeOfficeId} has no joined worked-geography activity evidence in current mapped areas.`,
        "warn",
      );
      return;
    }
    setTextWithLevel(
      el,
      "Worked activity mode: no joined worked-geography touches are available for current mapped areas.",
      "warn",
    );
    return;
  }
  setTextWithLevel(
    el,
    `Campaign footprint mode: ${summary.total.toLocaleString()} mapped areas in current campaign geography selection.`,
    "muted",
  );
}

function metricSetLabel(metricSetId) {
  const id = cleanText(metricSetId) || "core";
  return METRIC_SET_LABEL_MAP[id] || id;
}

function metricProvenanceText(metricSetId) {
  const id = cleanText(metricSetId) || "core";
  return METRIC_SET_PROVENANCE_MAP[id]
    || "Canonical Census ACS/PL map metric bundle (display-only rendering; no campaign math mutation).";
}

function metricContextText(metricSetId) {
  const id = cleanText(metricSetId) || "core";
  return METRIC_SET_CONTEXT_MAP[id] || "Canonical map context (display-only).";
}

function syncLegendPanel(els, runtime, metric, legend) {
  const statusEl = els?.legendStatus;
  const bodyEl = els?.legendBody;
  const provenanceEl = els?.legendProvenance;
  if (!(statusEl instanceof HTMLElement) || !(bodyEl instanceof HTMLElement) || !(provenanceEl instanceof HTMLElement)) {
    return;
  }
  const metricSetId = cleanText(runtime?.metricSetId) || "core";
  const setLabel = metricSetLabel(metricSetId);
  const planningOverlay = resolvePlanningOverlayDescriptor(metric, null);
  const family = cleanText(metric?.family) || "Canonical context";
  const familyProvenance = metricFamilyProvenanceText(family);
  setTextWithLevel(
    provenanceEl,
    `Source: ${metricProvenanceText(metricSetId)} Bundle: ${setLabel}. Context: ${metricContextText(metricSetId)} Family provenance: ${familyProvenance} Overlay: ${planningOverlay.label} (${planningOverlay.id}).`,
    "muted",
  );
  const contextMode = normalizeContextMode(runtime?.contextMode);
  if (contextMode === CONTEXT_MODE_WORKED) {
    const stateCounts = runtime?.workedActivityModel?.stateCounts && typeof runtime.workedActivityModel.stateCounts === "object"
      ? runtime.workedActivityModel.stateCounts
      : {};
    const noRecorded = Number(stateCounts[WORKED_ACTIVITY_STATE_NONE] || 0) || 0;
    const recorded = Number(stateCounts[WORKED_ACTIVITY_STATE_RECORDED] || 0) || 0;
    const higher = Number(stateCounts[WORKED_ACTIVITY_STATE_HIGH] || 0) || 0;
    const scopeLabel = resolveWorkedScopeLabel(runtime?.opsContext, runtime?.shellScope);
    setTextWithLevel(
      provenanceEl,
      `Source: worked geography activity evidence from turf-event joins (read-only execution context). Scope: ${scopeLabel}. This legend represents recorded activity evidence, not assigned turf boundaries.`,
      "muted",
    );
    setTextWithLevel(
      statusEl,
      `Worked activity legend: ${higher.toLocaleString()} higher concentration, ${recorded.toLocaleString()} recorded activity, ${noRecorded.toLocaleString()} no recorded activity area${noRecorded === 1 ? "" : "s"}.`,
      (higher + recorded) > 0 ? "ok" : "warn",
    );
    bodyEl.innerHTML = [
      { state: WORKED_ACTIVITY_STATE_HIGH, label: "Higher activity concentration", count: higher },
      { state: WORKED_ACTIVITY_STATE_RECORDED, label: "Recorded activity", count: recorded },
      { state: WORKED_ACTIVITY_STATE_NONE, label: "No recorded activity", count: noRecorded },
    ]
      .map((row) => [
        '<div class="fpe-map-legend-row">',
        `<span class="fpe-map-legend-swatch" style="background:${escapeHtml(WORKED_ACTIVITY_STATE_COLOR_MAP[row.state] || "#e5e7eb")};"></span>`,
        `<span>${escapeHtml(row.label)} (${Number(row.count || 0).toLocaleString()})</span>`,
        "</div>",
      ].join(""))
      .join("");
    return;
  }
  if (!metric) {
    setTextWithLevel(statusEl, "Legend unavailable until a metric is selected.", "muted");
    bodyEl.innerHTML = "";
    return;
  }
  if (!legend?.ready || !Array.isArray(legend?.bins) || !legend.bins.length) {
    setTextWithLevel(statusEl, "Legend unavailable because this metric has no mapped values in current geography.", "warn");
    bodyEl.innerHTML = "";
    return;
  }
  const rangeMode = cleanText(legend?.rangeMode) || "n/a";
  setTextWithLevel(
    statusEl,
    `Legend: ${cleanText(metric?.label) || cleanText(metric?.id)} • ${legend.rangeText} • ${rangeMode}.`,
    "ok",
  );
  bodyEl.innerHTML = legend.bins
    .map((row) => {
      const color = cleanText(row?.color) || "#e5e7eb";
      const label = cleanText(row?.label) || "—";
      return [
        '<div class="fpe-map-legend-row">',
        `<span class="fpe-map-legend-swatch" style="background:${escapeHtml(color)};"></span>`,
        `<span>${escapeHtml(label)}</span>`,
        "</div>",
      ].join("");
    })
    .join("");
}

function syncWorkedExecutionSummary(els, runtime) {
  const statusEl = els?.workedSummaryStatus;
  const bodyEl = els?.workedSummaryBody;
  if (!(statusEl instanceof HTMLElement) || !(bodyEl instanceof HTMLElement)) {
    return;
  }
  const summary = buildWorkedExecutionSummaryModel({
    workedScope: runtime?.opsContext?.workedScope || runtime?.workedBridgeContext,
    workedOfficeTotals: runtime?.opsContext?.workedOfficeTotals,
    workedJoinableEventCount: runtime?.opsContext?.workedJoinableEventCount,
    workedConsideredEventCount: runtime?.opsContext?.workedConsideredEventCount,
    workedStateCounts: runtime?.workedActivityModel?.stateCounts,
  });
  runtime.workedExecutionSummary = summary;
  const mode = normalizeContextMode(runtime?.contextMode);
  if (mode !== CONTEXT_MODE_WORKED) {
    setTextWithLevel(
      statusEl,
      "Switch to Worked activity geography mode to review organizer/office activity evidence.",
      "muted",
    );
    bodyEl.innerHTML = "";
    return;
  }
  if (!summary.hasEvidence) {
    setTextWithLevel(
      statusEl,
      `${summary.selectedScopeLabel}: no recorded activity evidence is joined to current mapped geography.`,
      "warn",
    );
    bodyEl.innerHTML = [
      '<div class="fpe-map-inspect-row"><span>Joined worked units</span><strong>0</strong></div>',
      '<div class="fpe-map-inspect-row"><span>Recorded activity</span><strong>0 touches</strong></div>',
      '<div class="fpe-map-inspect-row"><span>No recorded activity areas</span><strong>',
      `${Number(summary.noRecordedActivityCount || 0).toLocaleString()}`,
      "</strong></div>",
    ].join("");
    return;
  }
  setTextWithLevel(
    statusEl,
    `${summary.selectedScopeLabel}: ${Number(summary.joinedUnitCount || 0).toLocaleString()} joined worked unit${Number(summary.joinedUnitCount || 0) === 1 ? "" : "s"} and ${Number(summary.touches || 0).toLocaleString()} recorded activity touch${Number(summary.touches || 0) === 1 ? "" : "es"}.`,
    "ok",
  );
  bodyEl.innerHTML = [
    `<div class="fpe-map-inspect-row"><span>Scope</span><strong>${escapeHtml(summary.selectedScopeLabel)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Joined worked units</span><strong>${Number(summary.joinedUnitCount || 0).toLocaleString()}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Activity evidence</span><strong>${Number(summary.touches || 0).toLocaleString()} touches • ${Number(summary.attempts || 0).toLocaleString()} attempts • ${Number(summary.canvassed || 0).toLocaleString()} canvassed • ${Number(summary.vbms || 0).toLocaleString()} VBM</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Higher activity concentration</span><strong>${Number(summary.higherActivityCount || 0).toLocaleString()} area${Number(summary.higherActivityCount || 0) === 1 ? "" : "s"}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Recorded activity areas</span><strong>${Number(summary.recordedActivityCount || 0).toLocaleString()}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>No recorded activity areas</span><strong>${Number(summary.noRecordedActivityCount || 0).toLocaleString()}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Considered turf events</span><strong>${Number(summary.consideredEventCount || 0).toLocaleString()}</strong></div>`,
  ].join("");
}

function updateSelectedFilter(runtime) {
  const map = runtime?.map;
  if (!map?.getLayer?.(SELECTED_LAYER_ID)) {
    return;
  }
  const geoid = cleanText(runtime?.selectedGeoid);
  map.setFilter(
    SELECTED_LAYER_ID,
    geoid ? ["==", ["get", "geoid"], geoid] : ["==", ["get", "geoid"], "__none__"],
  );
}

function updateHoverFilter(runtime) {
  const map = runtime?.map;
  if (!map?.getLayer?.(HOVER_LAYER_ID)) {
    return;
  }
  const geoid = cleanText(runtime?.hoveredGeoid);
  map.setFilter(
    HOVER_LAYER_ID,
    geoid ? ["==", ["get", "geoid"], geoid] : ["==", ["get", "geoid"], "__none__"],
  );
}

function collectCoordinates(geometry, sink) {
  const coords = geometry?.coordinates;
  if (!Array.isArray(coords)) {
    return;
  }
  const walk = (node) => {
    if (!Array.isArray(node)) {
      return;
    }
    if (node.length >= 2 && Number.isFinite(Number(node[0])) && Number.isFinite(Number(node[1]))) {
      sink.push([Number(node[0]), Number(node[1])]);
      return;
    }
    for (const child of node) {
      walk(child);
    }
  };
  walk(coords);
}

function fitMapToFeatures(runtime, featureCollection) {
  const mapboxgl = runtime?.mapboxgl;
  const map = runtime?.map;
  if (!mapboxgl || !map) {
    return;
  }
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : [];
  if (!features.length) {
    return;
  }
  const coords = [];
  for (const feature of features) {
    collectCoordinates(feature?.geometry, coords);
  }
  if (!coords.length) {
    return;
  }
  const bounds = new mapboxgl.LngLatBounds(coords[0], coords[0]);
  for (let i = 1; i < coords.length; i += 1) {
    bounds.extend(coords[i]);
  }
  if (bounds.isEmpty()) {
    return;
  }
  map.fitBounds(bounds, { padding: 44, maxZoom: 11, duration: 0 });
}

function emptyOfficeFocusState() {
  return {
    activeOfficeId: "",
    matchedCount: 0,
    totalCount: 0,
    fallbackToCampaign: false,
    officeTagsAvailable: false,
  };
}

function fitRuntimeBoundary(runtime) {
  const features = runtime?.boundaryFeatureCollection?.features;
  if (!Array.isArray(features) || !features.length) {
    return false;
  }
  fitMapToFeatures(runtime, runtime.boundaryFeatureCollection);
  return true;
}

function resetRuntimeView(runtime) {
  const map = runtime?.map;
  if (!map || typeof map.easeTo !== "function") {
    return false;
  }
  map.easeTo({
    center: MAP_DEFAULT_CENTER,
    zoom: MAP_DEFAULT_ZOOM,
    duration: 0,
  });
  return true;
}

function fitFeatureByGeoid(runtime, geoid) {
  const id = cleanText(geoid);
  if (!id) {
    return false;
  }
  const feature = runtime?.featureByGeoid?.get(id);
  if (!feature) {
    return false;
  }
  fitMapToFeatures(runtime, { type: "FeatureCollection", features: [feature] });
  return true;
}

function fitOfficeScopeFeatures(runtime) {
  const features = Array.from(runtime?.featureByGeoid?.values?.() || []);
  if (!features.length) {
    if (runtime && typeof runtime === "object") {
      runtime.officeFocusState = emptyOfficeFocusState();
    }
    return false;
  }
  const activeOfficeId = cleanText(runtime?.shellScope?.officeId);
  const officeScoped = features.filter((feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    const officeScopeId = cleanText(props.officeScopeId);
    if (!officeScopeId) {
      return false;
    }
    if (props.officeInScope === true) {
      return true;
    }
    return !!officeScopeId && cleanLower(officeScopeId) === cleanLower(activeOfficeId);
  });
  const officeTaggedCount = features.reduce((total, feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    return total + (cleanText(props.officeScopeId) ? 1 : 0);
  }, 0);
  const target = officeScoped.length ? officeScoped : features;
  fitMapToFeatures(runtime, { type: "FeatureCollection", features: target });
  if (runtime && typeof runtime === "object") {
    runtime.officeFocusState = {
      activeOfficeId,
      matchedCount: officeScoped.length,
      totalCount: features.length,
      fallbackToCampaign: !!activeOfficeId && officeScoped.length === 0,
      officeTagsAvailable: officeTaggedCount > 0,
    };
  }
  return true;
}

function fitWorkedScopeFeatures(runtime) {
  const features = Array.from(runtime?.featureByGeoid?.values?.() || []);
  if (!features.length) {
    return false;
  }
  const workedTagged = features.filter((feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    return props.workedGeographyHasSignal === true;
  });
  const target = workedTagged.length ? workedTagged : features;
  fitMapToFeatures(runtime, { type: "FeatureCollection", features: target });
  return true;
}

function fitCurrentScopeFeatures(runtime) {
  const contextMode = normalizeContextMode(runtime?.contextMode);
  if (contextMode === CONTEXT_MODE_OFFICE) {
    return fitOfficeScopeFeatures(runtime);
  }
  if (contextMode === CONTEXT_MODE_WORKED) {
    return fitWorkedScopeFeatures(runtime);
  }
  const features = Array.from(runtime?.featureByGeoid?.values?.() || []);
  if (features.length) {
    fitMapToFeatures(runtime, { type: "FeatureCollection", features });
    return true;
  }
  return fitRuntimeBoundary(runtime);
}

function resolveOrganizerWorkedQuickScope(runtime) {
  const bridge = runtime?.workedBridgeContext && typeof runtime.workedBridgeContext === "object"
    ? runtime.workedBridgeContext
    : null;
  if (bridge && normalizeBridgeFocusType(bridge.focusType) === "organizer") {
    const organizerId = cleanText(bridge.organizerId);
    const organizerLabel = cleanText(bridge.organizerLabel) || organizerId;
    if (organizerId || organizerLabel) {
      return { organizerId, organizerLabel };
    }
  }
  const scope = runtime?.opsContext?.workedScope && typeof runtime.opsContext.workedScope === "object"
    ? runtime.opsContext.workedScope
    : null;
  if (scope && normalizeBridgeFocusType(scope.focusType) === "organizer") {
    const organizerId = cleanText(scope.organizerId);
    const organizerLabel = cleanText(scope.organizerLabel) || organizerId;
    if (organizerId || organizerLabel) {
      return { organizerId, organizerLabel };
    }
  }
  return null;
}

function normalizeSearchDirective(query) {
  const raw = cleanText(query);
  if (!raw) {
    return { mode: "auto", token: "" };
  }
  const idx = raw.indexOf(":");
  if (idx <= 0) {
    return { mode: "auto", token: raw };
  }
  const mode = cleanLower(raw.slice(0, idx));
  const token = cleanText(raw.slice(idx + 1));
  if (!token) {
    return { mode: "auto", token: raw };
  }
  if (["geoid", "id"].includes(mode)) return { mode: "geoid", token };
  if (["name", "label", "area"].includes(mode)) return { mode: "label", token };
  if (["district"].includes(mode)) return { mode: "district", token };
  if (["office"].includes(mode)) return { mode: "office", token };
  if (["turf"].includes(mode)) return { mode: "turf", token };
  if (["organizer", "owner"].includes(mode)) return { mode: "organizer", token };
  if (["precinct"].includes(mode)) return { mode: "precinct", token };
  if (["tract"].includes(mode)) return { mode: "tract", token };
  return { mode: "auto", token: raw };
}

function firstFeatureMatch(entries, predicate) {
  for (const [geoid, feature] of entries) {
    if (predicate(geoid, feature)) {
      return { geoid: cleanText(geoid), feature };
    }
  }
  return null;
}

function findFeatureForQuery(runtime, query) {
  const directive = normalizeSearchDirective(query);
  const token = cleanLower(directive.token);
  if (!token) {
    return null;
  }
  const features = Array.from(runtime?.featureByGeoid?.entries?.() || []);
  if (!features.length) {
    return null;
  }

  const matchGeoidExact = () => firstFeatureMatch(features, (geoid) => cleanLower(geoid) === token);
  const matchGeoidStarts = () => firstFeatureMatch(features, (geoid) => cleanLower(geoid).startsWith(token));
  const matchLabelContains = () => firstFeatureMatch(features, (geoid, feature) => {
    const label = cleanLower(feature?.properties?.label || geoid);
    return label.includes(token);
  });
  const matchOffice = () => firstFeatureMatch(features, (_, feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    const officeScopeId = cleanLower(props.officeScopeId);
    return officeScopeId.includes(token);
  });
  const matchDistrict = () => firstFeatureMatch(features, (_, feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    const districtTokens = [
      props.district,
      props.districtId,
      props.districtName,
      props.officeScopeId,
      props.label,
    ]
      .map((value) => cleanLower(value))
      .filter(Boolean);
    return districtTokens.some((value) => value.includes(token));
  });
  const matchTurf = () => firstFeatureMatch(features, (_, feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    return cleanLower(props.turfId).includes(token);
  });
  const matchOrganizer = () => firstFeatureMatch(features, (_, feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    return cleanLower(props.organizer).includes(token);
  });
  const matchPrecinct = () => firstFeatureMatch(features, (_, feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    return cleanLower(props.turfId).includes(token) || cleanLower(props.label).includes(`precinct ${token}`);
  });
  const matchTract = () => firstFeatureMatch(features, (geoid, feature) => {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    const geoidDigits = normalizeGeoidToken(props.geoid || geoid);
    const tractDigits = normalizeGeoidToken(
      props.tractGeoid
      || props.tract
      || props.tractId
      || props.censusTract
      || props.census_tract,
      11,
    ) || (geoidDigits.length >= 11 ? geoidDigits.slice(0, 11) : "");
    const tokenDigits = normalizeGeoidToken(directive.token);
    if (tokenDigits) {
      if (tractDigits === tokenDigits) return true;
      if (tractDigits.startsWith(tokenDigits)) return true;
      if (geoidDigits.length >= 11 && geoidDigits.slice(0, 11).startsWith(tokenDigits)) return true;
    }
    const tractTokens = [
      props.label,
      props.NAME,
      props.tractGeoid,
      props.tract,
      props.tractId,
      props.censusTract,
      props.census_tract,
    ]
      .map((value) => cleanLower(value))
      .filter(Boolean);
    return tractTokens.some((value) => value.includes(`tract ${token}`) || value === token);
  });

  if (directive.mode === "geoid") return matchGeoidExact() || matchGeoidStarts();
  if (directive.mode === "label") return matchLabelContains();
  if (directive.mode === "district") return matchDistrict();
  if (directive.mode === "office") return matchOffice();
  if (directive.mode === "turf") return matchTurf();
  if (directive.mode === "organizer") return matchOrganizer();
  if (directive.mode === "precinct") return matchPrecinct();
  if (directive.mode === "tract") return matchTract();

  return matchGeoidExact()
    || matchGeoidStarts()
    || matchLabelContains()
    || matchDistrict()
    || matchOffice()
    || matchTurf()
    || matchOrganizer()
    || matchPrecinct()
    || matchTract();
}

function buildSelectedAreaSummaryText(runtime) {
  const selectedGeoid = cleanText(runtime?.selectedGeoid);
  const feature = selectedGeoid ? runtime?.featureByGeoid?.get(selectedGeoid) : null;
  if (!feature) {
    return "";
  }
  const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  const label = cleanText(props.label) || selectedGeoid;
  const geographyType = cleanText(props.geographyType) || resolutionLabel(runtime?.resolution);
  const officeId = cleanText(runtime?.shellScope?.officeId) || "—";
  const officeAssociation = cleanText(props.officeScopeId) || "No office-specific geography tag in canonical rows";
  const turfId = cleanText(props.turfId);
  const organizer = cleanText(props.organizer);
  const organizationalLayer = resolveOrganizationalLayerContext({
    officeScopeId: props.officeScopeId,
    turfId,
    organizer,
  }, runtime?.shellScope);
  const turfContext = (turfId || organizer)
    ? [turfId, organizer ? `organizer ${organizer}` : ""].filter(Boolean).join(" • ")
    : "Not present in canonical rows";
  const metricLabel = cleanText(runtime?.activeMetric?.label) || "Metric";
  const metricText = cleanText(props.metricText) || "—";
  const planningOverlayLabel = cleanText(props.planningOverlayLabel) || DEFAULT_PLANNING_OVERLAY.label;
  const earlyVoteContext = cleanText(props.earlyVoteContext);
  const executionCoverageText = cleanText(props.executionCoverageText);
  const executionProgressText = cleanText(props.executionProgressText);
  const executionPresenceText = cleanText(props.executionPresenceText);
  const executionVbmText = cleanText(props.executionVbmText);
  const workedScopeType = cleanText(props.workedGeographyScopeType);
  const workedScopeOfficeId = cleanText(props.workedGeographyScopeOfficeId);
  const workedScopeOrganizer = cleanText(props.workedGeographyScopeOrganizerLabel)
    || cleanText(props.workedGeographyScopeOrganizerId);
  const workedScopeSource = cleanText(props.workedGeographyScopeSource);
  const workedScopeText = workedScopeType === "organizer"
    ? `Organizer ${workedScopeOrganizer || "selected"}`
    : (workedScopeOfficeId ? `Office ${workedScopeOfficeId}` : "Campaign/office scope");
  const workedState = cleanText(props.workedActivityStateLabel) || "No recorded activity";
  const workedEvidence = resolveWorkedEvidenceCountsFromProps(props);
  const workedEvidenceText = `${Number(workedEvidence.touches || 0).toLocaleString()} touches • ${Number(workedEvidence.attempts || 0).toLocaleString()} attempts • ${Number(workedEvidence.canvassed || 0).toLocaleString()} canvassed • ${Number(workedEvidence.vbms || 0).toLocaleString()} VBM`;
  const workedOfficeText = cleanText(props.workedGeographyOfficeText);
  const workedOrganizerText = cleanText(props.workedGeographyOrganizerText);
  const workedInterpretation = cleanText(props.workedGeographyInterpretation);
  const rank = toFiniteNumber(props.metricRank);
  const rankTotal = toFiniteNumber(props.metricRankTotal);
  const rankText = (rank != null && rankTotal != null && rankTotal > 0) ? `#${rank} of ${rankTotal}` : "—";
  const intensity = resolveLegendIntensity(props.metricValue, runtime?.activeLegend);
  const modeScopeSummary = buildModeScopeSummaryText(runtime);
  return [
    `Map mode/scope: ${modeScopeSummary || "Unavailable"}`,
    `Area: ${label}`,
    `Type: ${geographyType}`,
    `GEOID: ${selectedGeoid}`,
    `Office: ${officeId}`,
    `Office association: ${officeAssociation}`,
    `Organizational layer: ${organizationalLayer}`,
    `Turf context: ${turfContext}`,
    `${metricLabel}: ${metricText}`,
    `Planning overlay: ${planningOverlayLabel}`,
    `Early-vote context: ${earlyVoteContext || "Not present in canonical map rows"}`,
    `Execution coverage: ${executionCoverageText || "Not present"}`,
    `Execution progress: ${executionProgressText || "Not present"}`,
    `Execution presence: ${executionPresenceText || "Not present"}`,
    `Execution VBM: ${executionVbmText || "Not present"}`,
    `Worked scope: ${workedScopeText}`,
    `Worked scope source: ${workedScopeSource || "operations_context_bridge"}`,
    `Worked activity status: ${workedState}`,
    `Worked activity evidence: ${workedEvidenceText}`,
    `Worked geography (office): ${workedOfficeText || "Not present"}`,
    `Worked geography (organizer): ${workedOrganizerText || "Not present"}`,
    `Worked geography interpretation: ${workedInterpretation || "Not present"}`,
    `Relative intensity: ${intensity.label} (${intensity.band})`,
    `Metric rank: ${rankText}`,
  ].join("\n");
}

function buildWorkedScopeSummaryText(runtime, focusType = "") {
  const safeRuntime = runtime && typeof runtime === "object" ? runtime : {};
  const summary = safeRuntime?.workedExecutionSummary && typeof safeRuntime.workedExecutionSummary === "object"
    ? safeRuntime.workedExecutionSummary
    : null;
  const fallbackReason = diagnosticFallbackReasonForStatus(
    cleanText(globalThis?.__FPE_MAP_RUNTIME_DIAGNOSTICS__?.status) || "",
    safeRuntime,
  );
  const normalizedFocusType = normalizeBridgeFocusType(
    focusType || safeRuntime?.opsContext?.workedScope?.focusType,
  );
  const officeId = cleanText(safeRuntime?.shellScope?.officeId)
    || cleanText(safeRuntime?.opsContext?.workedScope?.officeId);
  const organizerLabel = cleanText(safeRuntime?.opsContext?.workedScope?.organizerLabel)
    || cleanText(safeRuntime?.opsContext?.workedScope?.organizerId)
    || cleanText(safeRuntime?.opsContext?.activeOrganizerLabel)
    || cleanText(safeRuntime?.opsContext?.activeOrganizerId);
  const scopeLabel = normalizedFocusType === "organizer"
    ? `Organizer ${organizerLabel || "selected"}`
    : `Office ${officeId || "selected"}`;
  const joinedUnitCount = Number(summary?.joinedUnitCount || 0) || 0;
  const touches = Number(summary?.touches || 0) || 0;
  const attempts = Number(summary?.attempts || 0) || 0;
  const canvassed = Number(summary?.canvassed || 0) || 0;
  const vbms = Number(summary?.vbms || 0) || 0;
  const noRecordedActivityCount = Number(summary?.noRecordedActivityCount || 0) || 0;
  const recordedActivityCount = Number(summary?.recordedActivityCount || 0) || 0;
  const higherActivityCount = Number(summary?.higherActivityCount || 0) || 0;
  const mapModeScope = buildModeScopeSummaryText(safeRuntime);
  return [
    `Map mode/scope: ${mapModeScope || "Unavailable"}`,
    `Worked focus: ${scopeLabel}`,
    "Worked source: turfEvents geography-join activity evidence (read-only execution context).",
    `Joined worked units: ${joinedUnitCount.toLocaleString()}`,
    `Activity totals: ${touches.toLocaleString()} touches • ${attempts.toLocaleString()} attempts • ${canvassed.toLocaleString()} canvassed • ${vbms.toLocaleString()} VBM`,
    `Activity states: ${higherActivityCount.toLocaleString()} higher concentration • ${recordedActivityCount.toLocaleString()} recorded activity • ${noRecordedActivityCount.toLocaleString()} no recorded activity`,
    `Evidence state: ${summary?.hasEvidence ? "Recorded activity evidence joined" : "No recorded activity evidence joined"}`,
    `Fallback reason: ${fallbackReason || "none"}`,
  ].join("\n");
}

async function copyTextToClipboard(text) {
  const value = cleanText(text);
  if (!value) {
    return false;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  try {
    if (typeof document === "undefined") {
      return false;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return !!ok;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveLegendIntensity(value, legend) {
  const metricValue = toFiniteNumber(value);
  const bins = Array.isArray(legend?.bins) ? legend.bins : [];
  if (metricValue == null || !legend?.ready || !bins.length) {
    return { label: "Unavailable", band: "n/a", rankHint: "" };
  }
  if (bins.length === 1) {
    return { label: "Uniform", band: bins[0]?.label || "uniform", rankHint: "All mapped areas share the same value." };
  }
  let idx = bins.findIndex((row) => {
    const min = toFiniteNumber(row?.min);
    const max = toFiniteNumber(row?.max);
    if (min == null || max == null) {
      return false;
    }
    return metricValue >= min && metricValue <= max;
  });
  if (idx < 0) {
    idx = metricValue > toFiniteNumber(bins[bins.length - 1]?.max) ? bins.length - 1 : 0;
  }
  const labels = ["Very low", "Low", "Moderate", "High", "Very high"];
  const safeIdx = Math.max(0, Math.min(labels.length - 1, idx));
  const label = labels[safeIdx] || "Moderate";
  return {
    label,
    band: cleanText(bins[idx]?.label) || "—",
    rankHint: `${label} relative intensity for the selected map metric.`,
  };
}

function buildOperationalNote({ intensityLabel, rank, total }) {
  const rankText = Number.isFinite(Number(rank)) && Number.isFinite(Number(total)) && total > 0
    ? ` (rank ${rank} of ${total})`
    : "";
  const intensity = cleanText(intensityLabel).toLowerCase();
  if (intensity.includes("very high") || intensity === "high") {
    return `Operational note: prioritize organizer review and turf sequencing for this area${rankText}.`;
  }
  if (intensity.includes("very low") || intensity === "low") {
    return `Operational note: lower immediate pressure area; validate coverage before shifting heavy field resources${rankText}.`;
  }
  if (intensity === "uniform") {
    return "Operational note: metric is uniform across selected geography; use local context to set field priority.";
  }
  if (intensity === "unavailable") {
    return "Operational note: metric data unavailable for this area; use canonical context and nearby coverage until data is populated.";
  }
  return `Operational note: balanced-priority area; combine this metric with local organizer intelligence${rankText}.`;
}

function buildWorkedManagerNotice({ workedStateLabel = "", evidenceTouches = 0 } = {}) {
  const state = cleanLower(workedStateLabel);
  const touches = Math.max(0, Number(evidenceTouches || 0) || 0);
  if (state.includes("higher activity concentration")) {
    return `Manager notice: this area shows higher recorded activity concentration (${touches.toLocaleString()} touch${touches === 1 ? "" : "es"}). Validate quality and coverage continuity before reallocation.`;
  }
  if (state.includes("recorded activity")) {
    return `Manager notice: recorded activity evidence is present (${touches.toLocaleString()} touch${touches === 1 ? "" : "es"}). Check recency and follow-through before deprioritizing.`;
  }
  return "Manager notice: no recorded activity evidence is joined to this area. Treat as a cold area until activity is logged.";
}

function syncInspectPanel(runtime, metric) {
  const inspectStatus = document.getElementById(INSPECT_STATUS_ID);
  const inspectBody = document.getElementById(INSPECT_BODY_ID);
  if (!(inspectStatus instanceof HTMLElement) || !(inspectBody instanceof HTMLElement)) {
    return;
  }
  const selectedGeoid = cleanText(runtime?.selectedGeoid);
  const feature = selectedGeoid ? runtime?.featureByGeoid?.get(selectedGeoid) : null;
  if (!feature) {
    inspectBody.innerHTML = "";
    setTextWithLevel(inspectStatus, MAP_STATUS_INSPECT_PROMPT, "muted");
    return;
  }
  const props = feature.properties && typeof feature.properties === "object" ? feature.properties : {};
  const metricLabel = cleanText(metric?.label) || "Metric";
  const metricText = cleanText(props.metricText) || "—";
  const population = toFiniteNumber(props.population);
  const populationText = population == null ? "—" : population.toLocaleString();
  const label = cleanText(props.label) || selectedGeoid;
  const geographyType = cleanText(props.geographyType) || resolutionLabel(runtime?.resolution);
  const officeId = cleanText(runtime?.shellScope?.officeId) || "—";
  const officeAssociation = cleanText(props.officeScopeId)
    || "No office-specific geography tag in canonical rows";
  const turfId = cleanText(props.turfId);
  const organizer = cleanText(props.organizer);
  const organizationalLayer = resolveOrganizationalLayerContext({
    officeScopeId: props.officeScopeId,
    turfId,
    organizer,
  }, runtime?.shellScope);
  const turfContext = (turfId || organizer)
    ? [turfId, organizer ? `organizer ${organizer}` : ""].filter(Boolean).join(" • ")
    : "Not present in canonical rows";
  const rank = toFiniteNumber(props.metricRank);
  const rankTotal = toFiniteNumber(props.metricRankTotal);
  const percentile = toFiniteNumber(props.metricPercentile);
  const intensity = resolveLegendIntensity(props.metricValue, runtime?.activeLegend);
  const rankText = (rank != null && rankTotal != null && rankTotal > 0) ? `#${rank} of ${rankTotal}` : "—";
  const percentileText = percentile == null ? "—" : formatMetricValue(percentile, "pct1");
  const turnoutPersuasionContext = cleanText(props.turnoutPersuasionContext);
  const planningOverlayLabel = cleanText(props.planningOverlayLabel) || DEFAULT_PLANNING_OVERLAY.label;
  const planningOverlayProvenance = cleanText(props.planningOverlayProvenance) || DEFAULT_PLANNING_OVERLAY.provenance;
  const planningOverlayInterpretation = cleanText(props.planningOverlayInterpretation) || DEFAULT_PLANNING_OVERLAY.interpretation;
  const earlyVoteContext = cleanText(props.earlyVoteContext)
    || "Expected early-vote context: not present in current canonical map rows.";
  const executionCoverageText = cleanText(props.executionCoverageText)
    || "Activity coverage: no area-level operations coverage signal in current context.";
  const executionProgressText = cleanText(props.executionProgressText)
    || "Progress context: no area-level execution progress signal in current context.";
  const executionPresenceText = cleanText(props.executionPresenceText)
    || "Organizer presence: no organizer assignment signal in current context.";
  const executionVbmText = cleanText(props.executionVbmText)
    || "Ballot collection / VBM context: no area-level VBM signal in current context.";
  const executionInterpretation = cleanText(props.executionInterpretation)
    || "Execution/ops context: area-level execution signals are not present; use office-level operations surfaces for immediate decisions.";
  const workedScopeType = cleanText(props.workedGeographyScopeType);
  const workedScopeOfficeId = cleanText(props.workedGeographyScopeOfficeId);
  const workedScopeOrganizer = cleanText(props.workedGeographyScopeOrganizerLabel)
    || cleanText(props.workedGeographyScopeOrganizerId);
  const workedScopeSource = cleanText(props.workedGeographyScopeSource) || "operations_context_bridge";
  const workedScopeText = workedScopeType === "organizer"
    ? `Organizer ${workedScopeOrganizer || "selected"}`
    : (workedScopeOfficeId ? `Office ${workedScopeOfficeId}` : "Campaign/office scope");
  const workedOfficeText = cleanText(props.workedGeographyOfficeText)
    || "Worked geography (office): no office-level worked-event geography signal joined to this area context.";
  const workedOrganizerText = cleanText(props.workedGeographyOrganizerText)
    || "Worked geography (organizer): no organizer-linked worked-event geography signal joined to this area context.";
  const workedInterpretation = cleanText(props.workedGeographyInterpretation)
    || "Worked/activity context: no joined worked-event geography signal is available for this area yet.";
  const workedStateLabel = cleanText(props.workedActivityStateLabel) || "No recorded activity";
  const workedEvidence = resolveWorkedEvidenceCountsFromProps(props);
  const workedEvidenceText = `${Number(workedEvidence.touches || 0).toLocaleString()} touches • ${Number(workedEvidence.attempts || 0).toLocaleString()} attempts • ${Number(workedEvidence.canvassed || 0).toLocaleString()} canvassed • ${Number(workedEvidence.vbms || 0).toLocaleString()} VBM`;
  const workedManagerNotice = buildWorkedManagerNotice({
    workedStateLabel,
    evidenceTouches: workedEvidence.touches,
  });
  const universeContext = population == null
    ? "Universe context: population total is unavailable for this area in current canonical rows."
    : `Universe context: population baseline is ${populationText}.`;
  const splitContext = turnoutPersuasionContext
    || "Turnout/Persuasion split context: not present in current canonical map rows.";
  const operationalNote = buildOperationalNote({ intensityLabel: intensity.label, rank, total: rankTotal });
  inspectBody.innerHTML = [
    `<div class="fpe-map-inspect-row"><span>Area</span><strong>${escapeHtml(label)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Type</span><strong>${escapeHtml(geographyType)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>GEOID</span><strong>${escapeHtml(selectedGeoid)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Office context</span><strong>${escapeHtml(officeId)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Office association</span><strong>${escapeHtml(officeAssociation)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Organizational layer</span><strong>${escapeHtml(organizationalLayer)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Turf context</span><strong>${escapeHtml(turfContext)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>${escapeHtml(metricLabel)}</span><strong>${escapeHtml(metricText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Planning overlay</span><strong>${escapeHtml(planningOverlayLabel)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Relative intensity</span><strong>${escapeHtml(intensity.label)} (${escapeHtml(intensity.band)})</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Metric rank</span><strong>${escapeHtml(rankText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Percentile context</span><strong>${escapeHtml(percentileText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Population</span><strong>${escapeHtml(populationText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Planning provenance</span><strong>${escapeHtml(planningOverlayProvenance)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Execution coverage</span><strong>${escapeHtml(executionCoverageText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Execution progress</span><strong>${escapeHtml(executionProgressText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Execution presence</span><strong>${escapeHtml(executionPresenceText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Execution VBM</span><strong>${escapeHtml(executionVbmText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Worked scope</span><strong>${escapeHtml(workedScopeText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Worked scope source</span><strong>${escapeHtml(workedScopeSource)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Worked activity status</span><strong>${escapeHtml(workedStateLabel)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Worked activity evidence</span><strong>${escapeHtml(workedEvidenceText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Worked geography (office)</span><strong>${escapeHtml(workedOfficeText)}</strong></div>`,
    `<div class="fpe-map-inspect-row"><span>Worked geography (organizer)</span><strong>${escapeHtml(workedOrganizerText)}</strong></div>`,
    `<div class="fpe-map-inspect-note">${escapeHtml(workedManagerNotice)}</div>`,
    `<div class="fpe-map-inspect-note">${escapeHtml(operationalNote)}</div>`,
    '<div class="fpe-map-inspect-guide">',
    `<div><strong>What this area represents:</strong> ${escapeHtml(`${label} is the selected ${geographyType.toLowerCase()} within office ${officeId}.`)}</div>`,
    `<div><strong>Why it matters:</strong> ${escapeHtml(intensity.rankHint || "Relative intensity helps compare this area to the rest of the current selection.")}</div>`,
    `<div><strong>How to use it:</strong> ${escapeHtml("Use rank/intensity to sequence turf review and apply organizer validation before changing execution posture.")}</div>`,
    `<div><strong>Planning context:</strong> ${escapeHtml(planningOverlayLabel)}</div>`,
    `<div><strong>Planning interpretation:</strong> ${escapeHtml(planningOverlayInterpretation)}</div>`,
    `<div><strong>${escapeHtml(PLANNING_DISPLAY_BOUNDARY_TEXT)}</strong></div>`,
    `<div><strong>Execution/ops context:</strong> ${escapeHtml(executionInterpretation)}</div>`,
    `<div><strong>Worked/activity context:</strong> ${escapeHtml(workedInterpretation)}</div>`,
    `<div><strong>${escapeHtml(universeContext)}</strong></div>`,
    `<div><strong>${escapeHtml(earlyVoteContext)}</strong></div>`,
    `<div><strong>${escapeHtml(splitContext)}</strong></div>`,
    "</div>",
  ].join("");
  setTextWithLevel(
    inspectStatus,
    `Inspecting ${label} (${selectedGeoid}).`,
    "ok",
  );
}

function syncHoverStatus(runtime) {
  const el = document.getElementById(HOVER_STATUS_ID);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const geoid = cleanText(runtime?.hoveredGeoid);
  const feature = geoid ? runtime?.featureByGeoid?.get(geoid) : null;
  if (!feature) {
    setTextWithLevel(el, "Hover an area to preview name, type, and geography identifier.", "muted");
    return;
  }
  const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  const label = cleanText(props.label) || geoid;
  const geographyType = cleanText(props.geographyType) || resolutionLabel(runtime?.resolution);
  setTextWithLevel(el, `Hover: ${label} • ${geographyType} • ${geoid}`, "ok");
}

function bridgeMapSelection(runtime, geoid) {
  const id = cleanText(geoid);
  if (!id) {
    return;
  }
  const current = Array.isArray(runtime?.selectedGeoids) ? runtime.selectedGeoids : [];
  const next = current.includes(id) ? current.slice() : [id, ...current];
  setDistrictCensusField("geoSearch", id);
  setDistrictCensusGeoSelection(next);
}

function selectRuntimeGeoid(runtime, geoid, { bridge = true, fit = false } = {}) {
  const id = cleanText(geoid);
  if (!id || !runtime?.featureByGeoid?.has?.(id)) {
    return false;
  }
  runtime.selectedGeoid = id;
  runtime.selectionCleared = false;
  updateSelectedFilter(runtime);
  if (fit) {
    fitFeatureByGeoid(runtime, id);
  }
  syncInspectPanel(runtime, runtime.activeMetric || null);
  if (bridge) {
    bridgeMapSelection(runtime, id);
  }
  publishMapRuntimeDiagnostics(runtime, "selected_area");
  return true;
}

function clearRuntimeSelection(runtime) {
  if (!runtime) {
    return;
  }
  runtime.selectedGeoid = "";
  runtime.selectionCleared = true;
  updateSelectedFilter(runtime);
  syncInspectPanel(runtime, runtime.activeMetric || null);
  publishMapRuntimeDiagnostics(runtime, "selection_cleared");
}

function saveRuntimeBookmark(runtime) {
  const geoid = cleanText(runtime?.selectedGeoid);
  if (!geoid || !runtime?.featureByGeoid?.has?.(geoid)) {
    return false;
  }
  runtime.bookmarkedGeoid = geoid;
  const feature = runtime.featureByGeoid.get(geoid);
  runtime.bookmarkedLabel = cleanText(feature?.properties?.label) || geoid;
  publishMapRuntimeDiagnostics(runtime, "bookmark_saved");
  return true;
}

function jumpRuntimeBookmark(runtime, { fit = true, bridge = false } = {}) {
  const geoid = cleanText(runtime?.bookmarkedGeoid);
  if (!geoid) {
    return false;
  }
  const ok = selectRuntimeGeoid(runtime, geoid, { bridge, fit });
  if (!ok) {
    return false;
  }
  publishMapRuntimeDiagnostics(runtime, "bookmark_selected");
  return true;
}

function bindMapInteractions(runtime) {
  if (!runtime?.map || runtime.handlersBound) {
    return;
  }
  const map = runtime.map;
  const onFeatureClick = (event) => {
    const feature = Array.isArray(event?.features) ? event.features[0] : null;
    const geoid = cleanText(feature?.properties?.geoid);
    if (!geoid) {
      return;
    }
    selectRuntimeGeoid(runtime, geoid, { bridge: true, fit: false });
    syncMapNavigationState(readMapElements(), runtime);
  };
  map.on("click", FILL_LAYER_ID, onFeatureClick);
  map.on("click", OUTLINE_LAYER_ID, onFeatureClick);
  const onFeatureHover = (event) => {
    const feature = Array.isArray(event?.features) ? event.features[0] : null;
    const geoid = cleanText(feature?.properties?.geoid);
    runtime.hoveredGeoid = geoid;
    updateHoverFilter(runtime);
    syncHoverStatus(runtime);
  };
  map.on("mousemove", FILL_LAYER_ID, onFeatureHover);
  map.on("mousemove", OUTLINE_LAYER_ID, onFeatureHover);
  map.on("mouseenter", FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseenter", OUTLINE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", FILL_LAYER_ID, () => {
    runtime.hoveredGeoid = "";
    updateHoverFilter(runtime);
    syncHoverStatus(runtime);
    map.getCanvas().style.cursor = "";
  });
  map.on("mouseleave", OUTLINE_LAYER_ID, () => {
    runtime.hoveredGeoid = "";
    updateHoverFilter(runtime);
    syncHoverStatus(runtime);
    map.getCanvas().style.cursor = "";
  });
  runtime.handlersBound = true;
}

function ensureMapLayers(runtime) {
  const map = runtime?.map;
  if (!map || !runtime.mapLoaded) {
    return;
  }
  if (!map.getSource(AREAS_SOURCE_ID)) {
    map.addSource(AREAS_SOURCE_ID, { type: "geojson", data: defaultFeatureCollection() });
  }
  if (!map.getSource(POINTS_SOURCE_ID)) {
    map.addSource(POINTS_SOURCE_ID, { type: "geojson", data: defaultFeatureCollection() });
  }
  if (!map.getLayer(FILL_LAYER_ID)) {
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: AREAS_SOURCE_ID,
      paint: {
        "fill-color": "#e5e7eb",
        "fill-opacity": 0.72,
      },
    });
  }
  if (!map.getLayer(OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: OUTLINE_LAYER_ID,
      type: "line",
      source: AREAS_SOURCE_ID,
      paint: {
        "line-color": "#334155",
        "line-width": 1.1,
        "line-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer(HOVER_LAYER_ID)) {
    map.addLayer({
      id: HOVER_LAYER_ID,
      type: "line",
      source: AREAS_SOURCE_ID,
      filter: ["==", ["get", "geoid"], "__none__"],
      paint: {
        "line-color": "#06b6d4",
        "line-width": 2.2,
        "line-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer(SELECTED_LAYER_ID)) {
    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: "line",
      source: AREAS_SOURCE_ID,
      filter: ["==", ["get", "geoid"], "__none__"],
      paint: {
        "line-color": "#f97316",
        "line-width": 3.1,
        "line-opacity": 1,
      },
    });
  }
  if (!map.getLayer(POINT_LAYER_ID)) {
    map.addLayer({
      id: POINT_LAYER_ID,
      type: "circle",
      source: POINTS_SOURCE_ID,
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#0f172a",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.15,
        "circle-opacity": 0.86,
      },
    });
  }
  bindMapInteractions(runtime);
  updateHoverFilter(runtime);
  updateSelectedFilter(runtime);
}

function clearMapCollections(runtime) {
  const map = runtime?.map;
  if (!map || !runtime?.mapLoaded) {
    return;
  }
  setSourceData(map, AREAS_SOURCE_ID, defaultFeatureCollection());
  setSourceData(map, POINTS_SOURCE_ID, defaultFeatureCollection());
  if (map.getLayer(POINT_LAYER_ID)) {
    map.setLayoutProperty(POINT_LAYER_ID, "visibility", "none");
  }
  runtime.featureByGeoid = new Map();
  runtime.selectedGeoid = "";
  runtime.selectionCleared = false;
  runtime.bookmarkedGeoid = "";
  runtime.bookmarkedLabel = "";
  runtime.hoveredGeoid = "";
  runtime.fittedBoundaryKey = "";
  runtime.fittedWorkedScopeToken = "";
  runtime.boundaryFeatureCollection = defaultFeatureCollection();
  runtime.activeLegend = null;
  runtime.workedActivityModel = null;
  runtime.workedExecutionSummary = null;
  runtime.officeFocusState = emptyOfficeFocusState();
  updateHoverFilter(runtime);
  updateSelectedFilter(runtime);
}

function destroyMapInstance(runtime) {
  const map = runtime?.map;
  if (map && typeof map.remove === "function") {
    try {
      map.remove();
    } catch {}
  }
  if (!runtime || typeof runtime !== "object") {
    return;
  }
  runtime.map = null;
  runtime.mapboxgl = null;
  runtime.mapLoaded = false;
  runtime.handlersBound = false;
  runtime.mapToken = "";
  runtime.boundaryKey = "";
  runtime.fittedBoundaryKey = "";
  runtime.fittedWorkedScopeToken = "";
  runtime.boundaryFeatureCollection = defaultFeatureCollection();
  runtime.featureByGeoid = new Map();
  runtime.selectedGeoid = "";
  runtime.selectionCleared = false;
  runtime.bookmarkedGeoid = "";
  runtime.bookmarkedLabel = "";
  runtime.hoveredGeoid = "";
  runtime.selectedGeoids = [];
  runtime.shellScope = { campaignId: "", officeId: "", campaignSource: "", officeSource: "" };
  runtime.resolution = "";
  runtime.metricSetId = "";
  runtime.activeLegend = null;
  runtime.workedActivityModel = null;
  runtime.workedExecutionSummary = null;
  runtime.contextMode = CONTEXT_MODE_CAMPAIGN;
  runtime.opsContext = { available: false };
  runtime.officeFocusState = emptyOfficeFocusState();
  runtime.workedBridgeContext = { available: false };
  runtime.appliedBridgeRequestId = "";
  publishMapRuntimeDiagnostics(runtime, "destroyed");
}

function bindMapViewportResize() {
  if (mapViewportResizeBound) {
    return;
  }
  mapViewportResizeBound = true;
  window.addEventListener("resize", () => {
    const map = mapRuntime?.map;
    if (!map || typeof map.resize !== "function") {
      return;
    }
    try {
      map.resize();
    } catch {}
  });
}

async function ensureMapInstance(runtime, host, token) {
  const nextToken = cleanText(token);
  if (!nextToken) {
    return;
  }
  if (runtime.map && runtime.mapToken === nextToken) {
    runtime.map.resize();
    return;
  }
  if (runtime.map) {
    runtime.map.remove();
    runtime.map = null;
    runtime.mapLoaded = false;
    runtime.handlersBound = false;
  }
  const mapboxgl = await loadMapboxGl();
  mapboxgl.accessToken = nextToken;
  const map = new mapboxgl.Map({
    container: host,
    style: MAPBOX_STYLE_URL,
    center: MAP_DEFAULT_CENTER,
    zoom: MAP_DEFAULT_ZOOM,
    attributionControl: true,
  });
  runtime.mapboxgl = mapboxgl;
  runtime.map = map;
  runtime.mapLoaded = false;
  runtime.handlersBound = false;
  runtime.mapToken = nextToken;
  await new Promise((resolve, reject) => {
    map.once("load", () => {
      runtime.mapLoaded = true;
      ensureMapLayers(runtime);
      resolve();
    });
    map.once("error", (event) => {
      const detail = cleanText(event?.error?.message || event?.message || event?.type);
      reject(new Error(detail ? `Mapbox style failed to load: ${detail}` : "Mapbox style failed to load."));
    });
  });
}

function applyMapCollections(runtime, mapCollections, metric, legend) {
  const map = runtime?.map;
  if (!map || !runtime.mapLoaded) {
    return;
  }
  ensureMapLayers(runtime);
  setSourceData(map, AREAS_SOURCE_ID, mapCollections.areaFeatureCollection);
  setSourceData(map, POINTS_SOURCE_ID, mapCollections.pointFeatureCollection);
  if (map.getLayer(FILL_LAYER_ID)) {
    map.setPaintProperty(
      FILL_LAYER_ID,
      "fill-color",
      fillExpressionForContextMode(runtime?.contextMode, metric, legend),
    );
  }
  if (map.getLayer(OUTLINE_LAYER_ID)) {
    map.setPaintProperty(OUTLINE_LAYER_ID, "line-color", outlineColorForContextMode(runtime?.contextMode));
  }
  if (map.getLayer(POINT_LAYER_ID)) {
    map.setLayoutProperty(
      POINT_LAYER_ID,
      "visibility",
      (mapCollections?.pointFeatureCollection?.features || []).length ? "visible" : "none",
    );
  }
  updateHoverFilter(runtime);
  updateSelectedFilter(runtime);
}

function readMapElements() {
  return {
    root: document.getElementById(ROOT_ID),
    host: document.getElementById(HOST_ID),
    mapStatus: document.getElementById(STATUS_ID),
    metricStatus: document.getElementById(METRIC_STATUS_ID),
    metricHelp: document.getElementById(METRIC_HELP_ID),
    contextModeSelect: document.getElementById(CONTEXT_MODE_SELECT_ID),
    contextModeStatus: document.getElementById(CONTEXT_MODE_STATUS_ID),
    contextStatus: document.getElementById(CONTEXT_STATUS_ID),
    hoverStatus: document.getElementById(HOVER_STATUS_ID),
    legendStatus: document.getElementById(LEGEND_STATUS_ID),
    legendBody: document.getElementById(LEGEND_BODY_ID),
    legendProvenance: document.getElementById(LEGEND_PROVENANCE_ID),
    workedSummaryStatus: document.getElementById(WORKED_SUMMARY_STATUS_ID),
    workedSummaryBody: document.getElementById(WORKED_SUMMARY_BODY_ID),
    metricSelect: document.getElementById(METRIC_SELECT_ID),
    actionBtn: document.getElementById(ACTION_BTN_ID),
    fitBtn: document.getElementById(FIT_BTN_ID),
    resetBtn: document.getElementById(RESET_BTN_ID),
    refitScopeBtn: document.getElementById(REFIT_SCOPE_BTN_ID),
    searchInput: document.getElementById(SEARCH_INPUT_ID),
    searchBtn: document.getElementById(SEARCH_BTN_ID),
    clearSelectionBtn: document.getElementById(CLEAR_SELECTION_BTN_ID),
    viewCampaignBtn: document.getElementById(VIEW_CAMPAIGN_BTN_ID),
    viewOfficeBtn: document.getElementById(VIEW_OFFICE_BTN_ID),
    viewWorkedOrganizerBtn: document.getElementById(VIEW_WORKED_ORGANIZER_BTN_ID),
    viewSelectedBtn: document.getElementById(VIEW_SELECTED_BTN_ID),
    saveBookmarkBtn: document.getElementById(SAVE_BOOKMARK_BTN_ID),
    jumpBookmarkBtn: document.getElementById(JUMP_BOOKMARK_BTN_ID),
    copyInspectBtn: document.getElementById(COPY_INSPECT_BTN_ID),
    navStatus: document.getElementById(NAV_STATUS_ID),
    modeScopeStatus: document.getElementById(MODE_SCOPE_STATUS_ID),
    trustStatus: document.getElementById(TRUST_STATUS_ID),
    diagnosticStatus: document.getElementById(DIAGNOSTIC_STATUS_ID),
  };
}

function publishMapRuntimeDiagnostics(runtime, status = "") {
  try {
    const safeRuntime = runtime && typeof runtime === "object" ? runtime : {};
    const statusCode = cleanText(status) || "idle";
    const metricSetId = cleanText(safeRuntime?.metricSetId) || "core";
    const selectedGeoid = cleanText(safeRuntime?.selectedGeoid);
    const selectedFeature = selectedGeoid ? safeRuntime?.featureByGeoid?.get?.(selectedGeoid) : null;
    const selectedLabel = cleanText(selectedFeature?.properties?.label);
    const bookmarkedGeoid = cleanText(safeRuntime?.bookmarkedGeoid);
    const bookmarkedLabel = cleanText(safeRuntime?.bookmarkedLabel);
    const boundaryFeatureCount = Array.isArray(safeRuntime?.boundaryFeatureCollection?.features)
      ? safeRuntime.boundaryFeatureCollection.features.length
      : 0;
    const mappedFeatureCount = Number(safeRuntime?.featureByGeoid?.size || 0);
    let officeTaggedCount = 0;
    let turfTaggedCount = 0;
    let executionTaggedCount = 0;
    let workedTaggedCount = 0;
    let workedNoRecordedCount = 0;
    let workedRecordedCount = 0;
    let workedHigherCount = 0;
    for (const feature of Array.from(safeRuntime?.featureByGeoid?.values?.() || [])) {
      const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
      if (cleanText(props.officeScopeId)) officeTaggedCount += 1;
      if (props.hasTurfContext === true) turfTaggedCount += 1;
      if (props.executionHasSignal === true) executionTaggedCount += 1;
      if (props.workedGeographyHasSignal === true) workedTaggedCount += 1;
      const workedState = cleanText(props.workedActivityState);
      if (workedState === WORKED_ACTIVITY_STATE_HIGH) workedHigherCount += 1;
      else if (workedState === WORKED_ACTIVITY_STATE_RECORDED) workedRecordedCount += 1;
      else workedNoRecordedCount += 1;
    }
    const activeMetric = safeRuntime?.activeMetric && typeof safeRuntime.activeMetric === "object"
      ? safeRuntime.activeMetric
      : null;
    const mapboxConfig = readMapboxPublicTokenConfig();
    const mapboxStatus = mapboxConfig?.valid
      ? "configured"
      : (mapboxConfig?.invalidConfigValue ? "invalid" : "missing");
    const overlayFromMetric = resolvePlanningOverlayDescriptor(activeMetric, null);
    const selectedOverlayId = cleanText(selectedFeature?.properties?.planningOverlayId);
    const selectedOverlayLabel = cleanText(selectedFeature?.properties?.planningOverlayLabel);
    const selectedOverlayProvenance = cleanText(selectedFeature?.properties?.planningOverlayProvenance);
    const selectedOverlayInterpretation = cleanText(selectedFeature?.properties?.planningOverlayInterpretation);
    const contextMode = normalizeContextMode(safeRuntime?.contextMode);
    const modeLabel = contextModeLabel(contextMode);
    const scopeLabel = contextMode === CONTEXT_MODE_WORKED
      ? resolveWorkedScopeLabel(safeRuntime?.opsContext, safeRuntime?.shellScope)
      : (contextMode === CONTEXT_MODE_OFFICE
        ? `Office ${cleanText(safeRuntime?.shellScope?.officeId) || "selected"}`
        : (contextMode === CONTEXT_MODE_CAMPAIGN ? "Campaign footprint" : modeLabel));
    const activeOfficeId = cleanText(safeRuntime?.shellScope?.officeId)
      || cleanText(safeRuntime?.opsContext?.workedScope?.officeId);
    const activeOrganizerId = cleanText(safeRuntime?.opsContext?.workedScope?.organizerId);
    const activeOrganizerLabel = cleanText(safeRuntime?.opsContext?.workedScope?.organizerLabel) || activeOrganizerId;
    const workedExecutionSummary = safeRuntime?.workedExecutionSummary && typeof safeRuntime.workedExecutionSummary === "object"
      ? safeRuntime.workedExecutionSummary
      : null;
    const fallbackReason = diagnosticFallbackReasonForStatus(statusCode, safeRuntime);
    globalThis.__FPE_MAP_RUNTIME_DIAGNOSTICS__ = {
      updatedAt: new Date().toISOString(),
      status: statusCode,
      fallbackReason: cleanText(fallbackReason),
      mapLoaded: !!safeRuntime?.mapLoaded,
      mapbox: {
        tokenStatus: mapboxStatus,
        tokenSource: cleanText(mapboxConfig?.source),
      },
      geometry: {
        boundaryFeatureCount,
        mappedFeatureCount,
        resolution: cleanText(safeRuntime?.resolution),
      },
      overlays: {
        contextMode,
        contextModeLabel: modeLabel,
        officeTaggedCount,
        turfTaggedCount,
        executionTaggedCount,
        workedTaggedCount,
        workedNoRecordedCount,
        workedRecordedCount,
        workedHigherCount,
      },
      selected: {
        geoid: selectedGeoid,
        label: selectedLabel,
        bookmarkedGeoid,
        bookmarkedLabel,
      },
      metric: {
        id: cleanText(activeMetric?.id),
        label: cleanText(activeMetric?.label),
        setId: metricSetId,
        setLabel: metricSetLabel(metricSetId),
        provenance: metricProvenanceText(metricSetId),
        context: metricContextText(metricSetId),
        overlayId: selectedOverlayId || cleanText(overlayFromMetric?.id),
        overlayLabel: selectedOverlayLabel || cleanText(overlayFromMetric?.label),
        overlayProvenance: selectedOverlayProvenance || cleanText(overlayFromMetric?.provenance),
        overlayInterpretation: selectedOverlayInterpretation || cleanText(overlayFromMetric?.interpretation),
        legendMode: cleanText(safeRuntime?.activeLegend?.rangeMode),
      },
      officeId: cleanText(safeRuntime?.shellScope?.officeId),
      officeSource: cleanText(safeRuntime?.shellScope?.officeSource),
      scope: {
        mode: contextMode,
        modeLabel,
        scopeLabel: cleanText(scopeLabel),
        activeOfficeId,
        activeOrganizerId,
        activeOrganizerLabel,
      },
      officeFocus: {
        matchedCount: Number(safeRuntime?.officeFocusState?.matchedCount || 0) || 0,
        totalCount: Number(safeRuntime?.officeFocusState?.totalCount || 0) || 0,
        fallbackToCampaign: !!safeRuntime?.officeFocusState?.fallbackToCampaign,
        officeTagsAvailable: !!safeRuntime?.officeFocusState?.officeTagsAvailable,
      },
      workedContext: {
        focusType: cleanText(safeRuntime?.opsContext?.workedScope?.focusType),
        officeId: cleanText(safeRuntime?.opsContext?.workedScope?.officeId),
        organizerId: cleanText(safeRuntime?.opsContext?.workedScope?.organizerId),
        organizerLabel: cleanText(safeRuntime?.opsContext?.workedScope?.organizerLabel),
        source: cleanText(safeRuntime?.opsContext?.workedScope?.source),
        joinableEventCount: Number(safeRuntime?.opsContext?.workedJoinableEventCount || 0) || 0,
        consideredEventCount: Number(safeRuntime?.opsContext?.workedConsideredEventCount || 0) || 0,
        hasMatchingActivityEvidence: !!workedExecutionSummary?.hasEvidence,
      },
      workedExecutionSummary: workedExecutionSummary
        ? {
          selectedScopeLabel: cleanText(workedExecutionSummary.selectedScopeLabel),
          joinedUnitCount: Number(workedExecutionSummary.joinedUnitCount || 0) || 0,
          touches: Number(workedExecutionSummary.touches || 0) || 0,
          attempts: Number(workedExecutionSummary.attempts || 0) || 0,
          canvassed: Number(workedExecutionSummary.canvassed || 0) || 0,
          vbms: Number(workedExecutionSummary.vbms || 0) || 0,
          noRecordedActivityCount: Number(workedExecutionSummary.noRecordedActivityCount || 0) || 0,
          recordedActivityCount: Number(workedExecutionSummary.recordedActivityCount || 0) || 0,
          higherActivityCount: Number(workedExecutionSummary.higherActivityCount || 0) || 0,
          hasEvidence: !!workedExecutionSummary.hasEvidence,
        }
        : null,
    };
  } catch {}
  publishMapReportingHooks(runtime);
}

function buildMapReportingSnapshot(runtime) {
  const safeRuntime = runtime && typeof runtime === "object" ? runtime : {};
  const mapboxConfig = readMapboxPublicTokenConfig();
  const mapboxTokenStatus = mapboxConfig?.valid
    ? "configured"
    : (mapboxConfig?.invalidConfigValue ? "invalid" : "missing");
  const fallbackReason = diagnosticFallbackReasonForStatus(
    cleanText(globalThis?.__FPE_MAP_RUNTIME_DIAGNOSTICS__?.status) || "",
    safeRuntime,
  );
  const metricSetId = cleanText(safeRuntime?.metricSetId) || "core";
  const selectedSummary = buildSelectedAreaSummaryText(safeRuntime);
  const modeScopeSummary = buildModeScopeSummaryText(safeRuntime);
  const organizerWorkedScopeSummary = buildWorkedScopeSummaryText(safeRuntime, "organizer");
  const officeWorkedScopeSummary = buildWorkedScopeSummaryText(safeRuntime, "office");
  const selectedGeoid = cleanText(safeRuntime?.selectedGeoid);
  const selectedFeature = selectedGeoid ? safeRuntime?.featureByGeoid?.get?.(selectedGeoid) : null;
  const selectedLabel = cleanText(selectedFeature?.properties?.label);
  const bookmarkedGeoid = cleanText(safeRuntime?.bookmarkedGeoid);
  const bookmarkedLabel = cleanText(safeRuntime?.bookmarkedLabel);
  const selectedMetric = safeRuntime?.activeMetric && typeof safeRuntime.activeMetric === "object"
    ? safeRuntime.activeMetric
    : null;
  const overlayFromMetric = resolvePlanningOverlayDescriptor(selectedMetric, null);
  const selectedOverlayId = cleanText(selectedFeature?.properties?.planningOverlayId);
  const selectedOverlayLabel = cleanText(selectedFeature?.properties?.planningOverlayLabel);
  const selectedOverlayProvenance = cleanText(selectedFeature?.properties?.planningOverlayProvenance);
  const selectedOverlayInterpretation = cleanText(selectedFeature?.properties?.planningOverlayInterpretation);
  const geometryFeatures = Array.isArray(safeRuntime?.boundaryFeatureCollection?.features)
    ? safeRuntime.boundaryFeatureCollection.features.length
    : 0;
  const mappedFeatures = Number(safeRuntime?.featureByGeoid?.size || 0);
  let officeTaggedCount = 0;
  let turfTaggedCount = 0;
  let executionTaggedCount = 0;
  let workedTaggedCount = 0;
  let workedNoRecordedCount = 0;
  let workedRecordedCount = 0;
  let workedHigherCount = 0;
  for (const feature of Array.from(safeRuntime?.featureByGeoid?.values?.() || [])) {
    const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
    if (cleanText(props.officeScopeId)) officeTaggedCount += 1;
    if (props.hasTurfContext === true) turfTaggedCount += 1;
    if (props.executionHasSignal === true) executionTaggedCount += 1;
    if (props.workedGeographyHasSignal === true) workedTaggedCount += 1;
    const workedState = cleanText(props.workedActivityState);
    if (workedState === WORKED_ACTIVITY_STATE_HIGH) workedHigherCount += 1;
    else if (workedState === WORKED_ACTIVITY_STATE_RECORDED) workedRecordedCount += 1;
    else workedNoRecordedCount += 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    status: cleanText(globalThis?.__FPE_MAP_RUNTIME_DIAGNOSTICS__?.status) || "idle",
    fallbackReason: cleanText(fallbackReason),
    mapbox: {
      tokenStatus: mapboxTokenStatus,
      tokenSource: cleanText(mapboxConfig?.source),
    },
    selectedAreaSummary: selectedSummary,
    modeScopeSummary,
    organizerWorkedScopeSummary,
    officeWorkedScopeSummary,
    selectedArea: {
      geoid: selectedGeoid,
      label: selectedLabel,
      resolution: cleanText(safeRuntime?.resolution),
      bookmarkedGeoid,
      bookmarkedLabel,
    },
    metricSummary: {
      id: cleanText(selectedMetric?.id),
      label: cleanText(selectedMetric?.label),
      setId: metricSetId,
      setLabel: metricSetLabel(metricSetId),
      provenance: metricProvenanceText(metricSetId),
      context: metricContextText(metricSetId),
      overlayId: selectedOverlayId || cleanText(overlayFromMetric?.id),
      overlayLabel: selectedOverlayLabel || cleanText(overlayFromMetric?.label),
      overlayProvenance: selectedOverlayProvenance || cleanText(overlayFromMetric?.provenance),
      overlayInterpretation: selectedOverlayInterpretation || cleanText(overlayFromMetric?.interpretation),
      legendMode: cleanText(safeRuntime?.activeLegend?.rangeMode),
      rangeText: cleanText(safeRuntime?.activeLegend?.rangeText),
    },
    officeGeographySnapshot: {
      officeId: cleanText(safeRuntime?.shellScope?.officeId),
      officeSource: cleanText(safeRuntime?.shellScope?.officeSource),
      campaignId: cleanText(safeRuntime?.shellScope?.campaignId),
      resolution: cleanText(safeRuntime?.resolution),
      contextMode: normalizeContextMode(safeRuntime?.contextMode),
      selectedGeoCount: Array.isArray(safeRuntime?.selectedGeoids) ? safeRuntime.selectedGeoids.length : 0,
      boundaryFeatureCount: geometryFeatures,
      mappedFeatureCount: mappedFeatures,
      officeTaggedCount,
      turfTaggedCount,
      executionTaggedCount,
      workedTaggedCount,
      officeMatchedCount: Number(safeRuntime?.officeFocusState?.matchedCount || 0) || 0,
      officeFocusFallback: !!safeRuntime?.officeFocusState?.fallbackToCampaign,
      workedFocusType: cleanText(safeRuntime?.opsContext?.workedScope?.focusType),
      workedFocusOfficeId: cleanText(safeRuntime?.opsContext?.workedScope?.officeId),
      workedFocusOrganizerId: cleanText(safeRuntime?.opsContext?.workedScope?.organizerId),
      workedFocusOrganizerLabel: cleanText(safeRuntime?.opsContext?.workedScope?.organizerLabel),
      workedFocusSource: cleanText(safeRuntime?.opsContext?.workedScope?.source),
      workedNoRecordedCount,
      workedRecordedCount,
      workedHigherCount,
      workedExecutionSummary: safeRuntime?.workedExecutionSummary && typeof safeRuntime.workedExecutionSummary === "object"
        ? {
          selectedScopeLabel: cleanText(safeRuntime.workedExecutionSummary.selectedScopeLabel),
          joinedUnitCount: Number(safeRuntime.workedExecutionSummary.joinedUnitCount || 0) || 0,
          touches: Number(safeRuntime.workedExecutionSummary.touches || 0) || 0,
          attempts: Number(safeRuntime.workedExecutionSummary.attempts || 0) || 0,
          canvassed: Number(safeRuntime.workedExecutionSummary.canvassed || 0) || 0,
          vbms: Number(safeRuntime.workedExecutionSummary.vbms || 0) || 0,
          noRecordedActivityCount: Number(safeRuntime.workedExecutionSummary.noRecordedActivityCount || 0) || 0,
          recordedActivityCount: Number(safeRuntime.workedExecutionSummary.recordedActivityCount || 0) || 0,
          higherActivityCount: Number(safeRuntime.workedExecutionSummary.higherActivityCount || 0) || 0,
          hasEvidence: !!safeRuntime.workedExecutionSummary.hasEvidence,
        }
        : null,
    },
  };
}

function publishMapReportingHooks(runtime) {
  try {
    globalThis.__FPE_MAP_REPORTING__ = {
      getSnapshot: () => buildMapReportingSnapshot(mapRuntime),
      getSelectedAreaSummary: () => cleanText(buildMapReportingSnapshot(mapRuntime).selectedAreaSummary),
      getModeScopeSummary: () => cleanText(buildMapReportingSnapshot(mapRuntime).modeScopeSummary),
      getOrganizerWorkedScopeSummary: () => cleanText(buildMapReportingSnapshot(mapRuntime).organizerWorkedScopeSummary),
      getOfficeWorkedScopeSummary: () => cleanText(buildMapReportingSnapshot(mapRuntime).officeWorkedScopeSummary),
      getMetricSummary: () => buildMapReportingSnapshot(mapRuntime).metricSummary,
      getOfficeGeographySnapshot: () => buildMapReportingSnapshot(mapRuntime).officeGeographySnapshot,
      copySelectedAreaSummary: async () => {
        const text = cleanText(buildMapReportingSnapshot(mapRuntime).selectedAreaSummary);
        return copyTextToClipboard(text);
      },
      copyModeScopeSummary: async () => {
        const text = cleanText(buildMapReportingSnapshot(mapRuntime).modeScopeSummary);
        return copyTextToClipboard(text);
      },
    };
    if (runtime && typeof runtime === "object") {
      runtime.reportingSnapshot = buildMapReportingSnapshot(runtime);
    }
  } catch {}
}

function ensureRuntime(root) {
  if (mapRuntime && mapRuntime.root === root) {
    return mapRuntime;
  }
  if (mapRuntime?.map) {
    destroyMapInstance(mapRuntime);
  }
  mapRuntime = {
    root,
    map: null,
    mapboxgl: null,
    mapLoaded: false,
    handlersBound: false,
    mapToken: "",
    requestSeq: 0,
    boundaryKey: "",
    boundaryFeatureCollection: defaultFeatureCollection(),
    featureByGeoid: new Map(),
    selectedGeoids: [],
    selectedGeoid: "",
    selectionCleared: false,
    bookmarkedGeoid: "",
    bookmarkedLabel: "",
    hoveredGeoid: "",
    shellScope: { campaignId: "", officeId: "", campaignSource: "", officeSource: "" },
    resolution: "",
    metricSetId: "",
    metricId: "",
    activeMetric: null,
    activeLegend: null,
    fittedBoundaryKey: "",
    fittedWorkedScopeToken: "",
    contextMode: CONTEXT_MODE_CAMPAIGN,
    opsContext: { available: false },
    officeFocusState: emptyOfficeFocusState(),
    workedActivityModel: null,
    workedExecutionSummary: null,
    workedBridgeContext: { available: false },
    appliedBridgeRequestId: "",
  };
  return mapRuntime;
}

async function syncMapSurface() {
  const els = readMapElements();
  if (!(els.root instanceof HTMLElement) || !(els.host instanceof HTMLElement)) {
    return;
  }
  const runtime = ensureRuntime(els.root);
  const requestSeq = ++runtime.requestSeq;
  publishMapRuntimeDiagnostics(runtime, "sync_start");
  setMapActionButton(els.actionBtn, { visible: false });
  if (els.fitBtn instanceof HTMLButtonElement) {
    els.fitBtn.disabled = true;
  }
  if (els.resetBtn instanceof HTMLButtonElement) {
    els.resetBtn.disabled = true;
  }
  setControlDisabled(els.contextModeSelect, true);
  syncMapNavigationState(els, runtime);

  const tokenConfig = readMapboxPublicTokenConfig();
  const token = resolveMapboxPublicToken();
  if (!token) {
    const invalid = !!tokenConfig?.invalidConfigValue;
    setCardStatus("Config unavailable");
    setTextWithLevel(
      els.mapStatus,
      invalid ? MAP_STATUS_TOKEN_INVALID : MAP_STATUS_TOKEN_MISSING,
      "warn",
    );
    setTextWithLevel(els.metricStatus, "Choropleth metrics are unavailable until Mapbox token setup is complete.", "muted");
    syncMetricHelp(els.metricHelp, null);
    setMetricSelectorDisabled(
      els.metricSelect,
      invalid ? "Invalid token; update in Controls" : "Set token in Controls",
    );
    setTextWithLevel(
      els.contextStatus,
      "Token setup is app-level. Configure Mapbox once in Controls for all map sessions.",
      "muted",
    );
    setTextWithLevel(els.contextModeStatus, "Context modes unlock after campaign geography loads.", "muted");
    setTextWithLevel(els.hoverStatus, "Hover preview unavailable until map boot completes.", "muted");
    runtime.activeLegend = null;
    runtime.workedActivityModel = null;
    syncLegendPanel(els, runtime, null, null);
    setMapActionButton(els.actionBtn, {
      visible: true,
      label: "Set Mapbox token in Controls",
      disabled: false,
    });
    destroyMapInstance(runtime);
    syncInspectPanel(runtime, null);
    syncWorkedExecutionSummary(els, runtime);
    publishMapRuntimeDiagnostics(runtime, invalid ? "token_invalid_config" : "token_missing_config");
    syncMapNavigationState(els, runtime, {
      statusText: invalid
        ? "Map configuration blocked: invalid token. Open Controls, save a valid pk token, then return to Map."
        : "Map configuration required: save a Mapbox public token in Controls to enable search and navigation.",
      level: "warn",
    });
    return;
  }
  setMapActionButton(els.actionBtn, { visible: false });

  const shellScope = readShellScope();
  const workedBridgeContext = resolveWorkedBridgeContext(shellScope);
  const censusConfig = readDistrictCensusConfigSnapshot() || {};
  const geoContext = selectedGeographyFromConfig(censusConfig);
  runtime.shellScope = shellScope;
  runtime.resolution = geoContext.resolution;
  runtime.metricSetId = cleanText(censusConfig?.metricSet) || "core";
  runtime.selectedGeoids = geoContext.selectedGeoids.slice();
  runtime.workedBridgeContext = workedBridgeContext;
  const bridgeRequestId = cleanText(workedBridgeContext?.requestId);
  const shouldApplyBridgeWorkedMode = workedBridgeContext.available
    && cleanText(workedBridgeContext?.requestedMode) === CONTEXT_MODE_WORKED
    && bridgeRequestId
    && bridgeRequestId !== cleanText(runtime.appliedBridgeRequestId);
  if (shouldApplyBridgeWorkedMode) {
    runtime.contextMode = CONTEXT_MODE_WORKED;
    runtime.appliedBridgeRequestId = bridgeRequestId;
  }
  if (!workedBridgeContext.available) {
    runtime.appliedBridgeRequestId = "";
  }
  runtime.contextMode = normalizeContextMode(runtime.contextMode);
  if (els.contextModeSelect instanceof HTMLSelectElement) {
    els.contextModeSelect.value = runtime.contextMode;
  }

  const hasContext = !!cleanText(shellScope.campaignId)
    && !!cleanText(shellScope.officeId)
    && !!cleanText(censusConfig?.stateFips)
    && !!cleanText(geoContext.resolution)
    && geoContext.selectedGeoids.length > 0;

  if (!hasContext) {
    setCardStatus("Awaiting context");
    setTextWithLevel(els.mapStatus, MAP_STATUS_CONTEXT_REQUIRED, "muted");
    setTextWithLevel(els.metricStatus, "Metric selector is disabled until geography context is selected.", "muted");
    syncMetricHelp(els.metricHelp, null);
    setTextWithLevel(els.contextStatus, "Waiting for canonical campaign, office, and geography selections.", "muted");
    setTextWithLevel(els.contextModeStatus, "Context modes unlock after campaign, office, and geography context is selected.", "muted");
    setTextWithLevel(els.hoverStatus, "Hover preview unavailable until geography is loaded.", "muted");
    runtime.activeLegend = null;
    runtime.workedActivityModel = null;
    syncLegendPanel(els, runtime, null, null);
    setMetricSelectorDisabled(els.metricSelect, "Awaiting geography context");
    clearMapCollections(runtime);
    runtime.featureByGeoid = new Map();
    runtime.selectedGeoid = "";
    runtime.selectionCleared = false;
    syncInspectPanel(runtime, null);
    syncWorkedExecutionSummary(els, runtime);
    publishMapRuntimeDiagnostics(runtime, "awaiting_context");
    syncMapNavigationState(els, runtime, {
      statusText: "Search and quick actions are unavailable until campaign, office, and geography context is selected.",
      level: "muted",
    });
    return;
  }

  const rowsByGeoid = readCensusRowsByGeoid();
  const metrics = metricDefinitions(censusConfig?.metricSet);
  const metricInventory = filterMetricInventoryForDisplay(
    buildMetricInventory(metrics, rowsByGeoid, geoContext.selectedGeoids),
  );
  runtime.metricId = syncMetricSelector(els.metricSelect, metricInventory, runtime.metricId);
  const activeMetric = metricInventory.find((row) => cleanText(row.id) === cleanText(runtime.metricId)) || null;
  syncMetricHelp(els.metricHelp, activeMetric);
  runtime.activeMetric = activeMetric;
  setMetricSelectorEnabled(els.metricSelect, false);
  setTextWithLevel(
    els.contextStatus,
    [
      `Context: office ${cleanText(shellScope.officeId) || "—"} • ${resolutionLabel(geoContext.resolution)} • ${geoContext.selectedGeoids.length.toLocaleString()} selected area${geoContext.selectedGeoids.length === 1 ? "" : "s"}.`,
      workedBridgeContextLabel(workedBridgeContext),
    ].filter(Boolean).join(" "),
    "muted",
  );
  setTextWithLevel(els.hoverStatus, "Hover an area to preview name, type, and geography identifier.", "muted");

  setCardStatus("Loading map");
  setTextWithLevel(els.mapStatus, MAP_STATUS_LOADING, "muted");
  setTextWithLevel(els.metricStatus, "Preparing map and choropleth controls…", "muted");
  runtime.activeLegend = null;
  runtime.workedActivityModel = null;
  syncLegendPanel(els, runtime, activeMetric, null);
  syncWorkedExecutionSummary(els, runtime);

  try {
    await ensureMapInstance(runtime, els.host, token);
    if (requestSeq !== runtime.requestSeq) {
      return;
    }
    runtime.map?.resize?.();
    requestAnimationFrame(() => {
      try {
        runtime.map?.resize?.();
      } catch {}
    });
  } catch (error) {
    const bootFailure = classifyMapBootError(error);
    if (bootFailure === "token") {
      setCardStatus("Invalid token");
      setTextWithLevel(els.mapStatus, MAP_STATUS_TOKEN_INVALID, "bad");
      setTextWithLevel(els.metricStatus, "Mapbox rejected the configured token during map bootstrap. Save a valid public token in Controls, then retry.", "bad");
      syncMetricHelp(els.metricHelp, null);
      setMetricSelectorDisabled(els.metricSelect, "Invalid token; update in Controls");
      setMapActionButton(els.actionBtn, {
        visible: true,
        label: "Set Mapbox token in Controls",
        disabled: false,
      });
    } else if (bootFailure === "assets") {
      setCardStatus("Boot failed");
      setTextWithLevel(els.mapStatus, MAP_STATUS_BOOT_NETWORK_FAILED, "bad");
      setTextWithLevel(els.metricStatus, "Map runtime assets did not load, so choropleth controls are unavailable.", "bad");
      syncMetricHelp(els.metricHelp, null);
      setMetricSelectorDisabled(els.metricSelect, "Map assets unavailable");
    } else if (bootFailure === "style") {
      setCardStatus("Boot failed");
      setTextWithLevel(els.mapStatus, MAP_STATUS_BOOT_STYLE_FAILED, "bad");
      setTextWithLevel(els.metricStatus, "Map style failed to load, so choropleth controls are unavailable.", "bad");
      syncMetricHelp(els.metricHelp, null);
      setMetricSelectorDisabled(els.metricSelect, "Map style unavailable");
    } else {
      setCardStatus("Boot failed");
      setTextWithLevel(els.mapStatus, MAP_STATUS_BOOT_FAILED, "bad");
      setTextWithLevel(els.metricStatus, "Map bootstrap failed before choropleth controls became available.", "bad");
      syncMetricHelp(els.metricHelp, null);
      setMetricSelectorDisabled(els.metricSelect, "Map boot failed");
    }
    setTextWithLevel(els.hoverStatus, "Hover preview unavailable because map boot failed.", "bad");
    setTextWithLevel(els.contextModeStatus, "Context modes are unavailable because map boot failed.", "bad");
    runtime.activeLegend = null;
    runtime.workedActivityModel = null;
    syncLegendPanel(els, runtime, activeMetric, null);
    publishMapRuntimeDiagnostics(
      runtime,
      bootFailure === "token"
        ? "boot_failed_token"
        : (bootFailure === "style" ? "boot_failed_style" : "boot_failed_runtime"),
    );
    syncMapNavigationState(els, runtime, {
      statusText: bootFailure === "token"
        ? "Token rejected by Mapbox. Open Controls and save a valid public token, then retry."
        : (bootFailure === "style"
          ? "Map style failed to load. Search and quick actions are disabled until style assets recover."
          : "Map boot failed. Search and quick actions are disabled until the map loads."),
      level: "bad",
    });
    clearMapCollections(runtime);
    runtime.featureByGeoid = new Map();
    runtime.selectedGeoid = "";
    runtime.selectionCleared = false;
    syncInspectPanel(runtime, activeMetric);
    syncWorkedExecutionSummary(els, runtime);
    return;
  }

  const boundaryKey = `${geoContext.resolution}|${geoContext.selectedGeoids.join(",")}`;
  if (runtime.boundaryKey !== boundaryKey) {
    try {
      const fetched = await fetchBoundaryCollection({
        resolution: geoContext.resolution,
        geoids: geoContext.selectedGeoids,
      });
      if (requestSeq !== runtime.requestSeq) {
        return;
      }
      runtime.boundaryFeatureCollection = fetched.featureCollection;
      runtime.boundaryKey = boundaryKey;
      runtime.fittedBoundaryKey = "";
      runtime.fittedWorkedScopeToken = "";
      runtime.selectionCleared = false;
      publishMapRuntimeDiagnostics(runtime, "geometry_loaded");
    } catch {
      setCardStatus("Geography unavailable");
      setTextWithLevel(els.mapStatus, MAP_STATUS_GEOGRAPHY_UNAVAILABLE, "bad");
      setTextWithLevel(els.metricStatus, "Boundary data request failed for this geography context.", "bad");
      syncMetricHelp(els.metricHelp, null);
      setMetricSelectorDisabled(els.metricSelect, "Geography unavailable");
      setTextWithLevel(els.contextModeStatus, "Context modes are unavailable because geometry failed to load.", "bad");
      setTextWithLevel(els.hoverStatus, "Hover preview unavailable because geography did not load.", "bad");
      runtime.activeLegend = null;
      runtime.workedActivityModel = null;
      syncLegendPanel(els, runtime, activeMetric, null);
      clearMapCollections(runtime);
      runtime.featureByGeoid = new Map();
      runtime.selectedGeoid = "";
      runtime.selectionCleared = false;
      syncInspectPanel(runtime, activeMetric);
      syncWorkedExecutionSummary(els, runtime);
      publishMapRuntimeDiagnostics(runtime, "geometry_unavailable");
      syncMapNavigationState(els, runtime, {
        statusText: "Geography boundary data is unavailable. Search and quick actions are disabled for this context.",
        level: "bad",
      });
      return;
    }
  }

  const workedBridgeForOps = normalizeContextMode(runtime.contextMode) === CONTEXT_MODE_WORKED
    ? workedBridgeContext
    : {
      available: false,
      focusType: "",
      officeId: cleanText(shellScope?.officeId),
      organizerId: "",
      organizerLabel: "",
      source: "",
    };
  const opsContext = await readOperationsExecutionContext(shellScope, workedBridgeForOps);
  if (requestSeq !== runtime.requestSeq) {
    return;
  }
  runtime.opsContext = opsContext;

  const mapCollections = buildMapCollections({
    boundaryCollection: runtime.boundaryFeatureCollection,
    labelsByGeoid: geoContext.labelsByGeoid,
    rowsByGeoid,
    metric: activeMetric,
    resolution: geoContext.resolution,
    shellScope,
    opsContext,
  });

  if (!mapCollections.areaFeatureCollection.features.length) {
    setCardStatus("No geography");
    setTextWithLevel(els.mapStatus, MAP_STATUS_NO_GEOGRAPHY, "warn");
    setTextWithLevel(els.metricStatus, "No mapped areas are available for the current geography selection.", "warn");
    syncMetricHelp(els.metricHelp, activeMetric);
    setMetricSelectorDisabled(els.metricSelect, "No geography available");
    setTextWithLevel(els.contextModeStatus, "Context modes are unavailable because no mapped geography was returned.", "warn");
    setTextWithLevel(els.hoverStatus, "No mapped areas are available to inspect.", "warn");
    runtime.activeLegend = null;
    runtime.workedActivityModel = mapCollections.workedActivityModel || null;
    syncLegendPanel(els, runtime, activeMetric, null);
    runtime.featureByGeoid = new Map();
    runtime.selectedGeoid = "";
    runtime.selectionCleared = false;
    runtime.bookmarkedGeoid = "";
    runtime.bookmarkedLabel = "";
    runtime.officeFocusState = emptyOfficeFocusState();
    applyMapCollections(runtime, mapCollections, activeMetric, null);
    syncInspectPanel(runtime, activeMetric);
    syncWorkedExecutionSummary(els, runtime);
    publishMapRuntimeDiagnostics(runtime, "no_geography");
    syncMapNavigationState(els, runtime, {
      statusText: "No mapped areas available in this context, so search and quick actions are disabled.",
      level: "warn",
    });
    return;
  }

  const legend = buildLegendModel(activeMetric, mapCollections.areaFeatureCollection);
  runtime.activeLegend = legend;
  runtime.workedActivityModel = mapCollections.workedActivityModel || null;
  syncLegendPanel(els, runtime, activeMetric, legend);
  runtime.featureByGeoid = mapCollections.featureByGeoid;
  if (!cleanText(runtime.selectedGeoid) || !runtime.featureByGeoid.has(runtime.selectedGeoid)) {
    if (runtime.selectionCleared) {
      runtime.selectedGeoid = "";
    } else {
      runtime.selectedGeoid = geoContext.selectedGeoids[0] || "";
    }
  }
  if (cleanText(runtime.selectedGeoid) && runtime.featureByGeoid.has(runtime.selectedGeoid)) {
    runtime.selectionCleared = false;
  }
  if (cleanText(runtime.bookmarkedGeoid) && !runtime.featureByGeoid.has(runtime.bookmarkedGeoid)) {
    runtime.bookmarkedGeoid = "";
    runtime.bookmarkedLabel = "";
  }
  applyMapCollections(runtime, mapCollections, activeMetric, legend);
  syncContextModeStatus(runtime, mapCollections.areaFeatureCollection);
  syncWorkedExecutionSummary(els, runtime);

  const contextMode = normalizeContextMode(runtime.contextMode);
  const fitScopeKey = contextMode === CONTEXT_MODE_OFFICE
    ? `${boundaryKey}|office:${cleanText(shellScope.officeId)}`
    : `${boundaryKey}|${contextMode}`;
  const workedScopeToken = contextMode === CONTEXT_MODE_WORKED
    ? (cleanText(runtime?.opsContext?.workedScopeToken) || "default")
    : "";
  const workedScopeChanged = contextMode === CONTEXT_MODE_WORKED
    && workedScopeToken !== cleanText(runtime?.fittedWorkedScopeToken);
  const applyContextFit = () => {
    if (contextMode === CONTEXT_MODE_OFFICE) {
      fitOfficeScopeFeatures(runtime);
    } else if (contextMode === CONTEXT_MODE_WORKED) {
      fitWorkedScopeFeatures(runtime);
    } else {
      fitMapToFeatures(runtime, mapCollections.areaFeatureCollection);
    }
    runtime.fittedBoundaryKey = fitScopeKey;
    runtime.fittedWorkedScopeToken = contextMode === CONTEXT_MODE_WORKED ? workedScopeToken : "";
  };
  if (runtime.fittedBoundaryKey !== fitScopeKey) {
    applyContextFit();
  } else if (workedScopeChanged) {
    applyContextFit();
  }

  const metricsReady = metricInventory.length > 0;
  setMetricSelectorEnabled(els.metricSelect, metricsReady);
  const activeContextMode = normalizeContextMode(runtime.contextMode);
  let readyStatus = "ready";
  if (activeContextMode === CONTEXT_MODE_WORKED) {
    const summary = runtime.workedExecutionSummary && typeof runtime.workedExecutionSummary === "object"
      ? runtime.workedExecutionSummary
      : null;
    if (summary?.hasEvidence) {
      setTextWithLevel(
        els.metricStatus,
        `Worked activity geography mode: map shading reflects activity evidence (${Number(summary.higherActivityCount || 0).toLocaleString()} higher concentration, ${Number(summary.recordedActivityCount || 0).toLocaleString()} recorded activity, ${Number(summary.noRecordedActivityCount || 0).toLocaleString()} no recorded activity).`,
        "ok",
      );
    } else {
      setTextWithLevel(
        els.metricStatus,
        "Worked activity geography mode: no recorded activity evidence is joined to current map scope.",
        "warn",
      );
      readyStatus = "ready_worked_no_activity";
    }
    syncMetricHelp(els.metricHelp, activeMetric);
  } else if (!metricsReady) {
    setTextWithLevel(els.metricStatus, "No choropleth metrics are available for the current geography context.", "warn");
    syncMetricHelp(els.metricHelp, null);
  } else if (!activeMetric || activeMetric.availableCount <= 0 || mapCollections.metricCount <= 0) {
    setTextWithLevel(els.metricStatus, MAP_STATUS_METRIC_UNAVAILABLE, "warn");
    syncMetricHelp(els.metricHelp, activeMetric);
  } else {
    const count = mapCollections.metricCount.toLocaleString();
    setTextWithLevel(
      els.metricStatus,
      `Choropleth metric: ${activeMetric.label} (${count} mapped area${mapCollections.metricCount === 1 ? "" : "s"}).`,
      "ok",
    );
    syncMetricHelp(els.metricHelp, activeMetric);
  }
  if (activeContextMode === CONTEXT_MODE_OFFICE && runtime?.officeFocusState?.fallbackToCampaign) {
    readyStatus = "ready_office_fallback_campaign";
  }
  setCardStatus("Ready");
  setTextWithLevel(
    els.mapStatus,
    `Campaign geography loaded (${mapCollections.areaFeatureCollection.features.length.toLocaleString()} polygon feature${mapCollections.areaFeatureCollection.features.length === 1 ? "" : "s"}).`,
    "ok",
  );
  if (els.fitBtn instanceof HTMLButtonElement) {
    els.fitBtn.disabled = !mapCollections.areaFeatureCollection.features.length;
  }
  if (els.resetBtn instanceof HTMLButtonElement) {
    els.resetBtn.disabled = false;
  }
  setControlDisabled(els.contextModeSelect, false);
  syncHoverStatus(runtime);
  syncInspectPanel(runtime, activeMetric);
  if (readyStatus === "ready") {
    publishMapRuntimeDiagnostics(runtime, "ready");
  } else {
    publishMapRuntimeDiagnostics(runtime, readyStatus);
  }
  syncMapNavigationState(els, runtime);
}

function bindMapSurfaceEvents() {
  const metricSelect = document.getElementById(METRIC_SELECT_ID);
  if (!(metricSelect instanceof HTMLSelectElement) || metricSelect.dataset.v3MapBound === "1") {
    // no-op
  } else {
    metricSelect.dataset.v3MapBound = "1";
    metricSelect.addEventListener("change", () => {
      const runtime = mapRuntime;
      if (runtime) {
        runtime.metricId = cleanText(metricSelect.value);
      }
      void syncMapSurface();
    });
  }

  const contextModeSelect = document.getElementById(CONTEXT_MODE_SELECT_ID);
  if (!(contextModeSelect instanceof HTMLSelectElement) || contextModeSelect.dataset.v3MapBound === "1") {
    // no-op
  } else {
    contextModeSelect.dataset.v3MapBound = "1";
    contextModeSelect.addEventListener("change", () => {
      const runtime = mapRuntime;
      if (runtime) {
        runtime.contextMode = normalizeContextMode(contextModeSelect.value);
      }
      void syncMapSurface();
    });
  }

  const actionBtn = document.getElementById(ACTION_BTN_ID);
  if (actionBtn instanceof HTMLButtonElement && actionBtn.dataset.v3MapBound !== "1") {
    actionBtn.dataset.v3MapBound = "1";
    actionBtn.addEventListener("click", () => {
      const ok = openControlsStage();
      if (!ok) {
        const statusEl = document.getElementById(STATUS_ID);
        setTextWithLevel(statusEl, "Controls navigation is unavailable. Open the Controls stage from the top navigation.", "warn");
      }
    });
  }

  const fitBtn = document.getElementById(FIT_BTN_ID);
  if (fitBtn instanceof HTMLButtonElement && fitBtn.dataset.v3MapBound !== "1") {
    fitBtn.dataset.v3MapBound = "1";
    fitBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = fitRuntimeBoundary(runtime);
      const metricStatus = document.getElementById(METRIC_STATUS_ID);
      if (!ok) {
        setTextWithLevel(metricStatus, "No boundary geometry is available to fit right now.", "warn");
      }
    });
  }

  const resetBtn = document.getElementById(RESET_BTN_ID);
  if (resetBtn instanceof HTMLButtonElement && resetBtn.dataset.v3MapBound !== "1") {
    resetBtn.dataset.v3MapBound = "1";
    resetBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = resetRuntimeView(runtime);
      const metricStatus = document.getElementById(METRIC_STATUS_ID);
      if (!ok) {
        setTextWithLevel(metricStatus, "Map is not ready to reset yet.", "warn");
      }
    });
  }

  const refitScopeBtn = document.getElementById(REFIT_SCOPE_BTN_ID);
  if (refitScopeBtn instanceof HTMLButtonElement && refitScopeBtn.dataset.v3MapBound !== "1") {
    refitScopeBtn.dataset.v3MapBound = "1";
    refitScopeBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = fitCurrentScopeFeatures(runtime);
      const mode = normalizeContextMode(runtime?.contextMode);
      const scopeLabel = mode === CONTEXT_MODE_WORKED
        ? resolveWorkedScopeLabel(runtime?.opsContext, runtime?.shellScope)
        : (mode === CONTEXT_MODE_OFFICE
          ? `Office ${cleanText(runtime?.shellScope?.officeId) || "selected"}`
          : contextModeLabel(mode));
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: ok
          ? `Refit applied for ${scopeLabel}.`
          : `Refit unavailable: no mapped geometry is available for ${scopeLabel}.`,
        level: ok ? "ok" : "warn",
      });
    });
  }

  const runSearch = () => {
    const runtime = mapRuntime;
    const els = readMapElements();
    const input = els.searchInput;
    const query = input instanceof HTMLInputElement ? cleanText(input.value) : "";
    if (!runtime || !query) {
      syncMapNavigationState(els, runtime, {
        statusText: "Enter area name/GEOID or use search prefixes (district:, office:, turf:, organizer:, precinct:, tract:), then run search.",
        level: "muted",
      });
      return;
    }
    const match = findFeatureForQuery(runtime, query);
    if (!match?.geoid) {
      syncMapNavigationState(els, runtime, {
        statusText: `No mapped area matched "${query}" in the current context.`,
        level: "warn",
      });
      return;
    }
    const selected = selectRuntimeGeoid(runtime, match.geoid, { bridge: true, fit: true });
    if (!selected) {
      syncMapNavigationState(els, runtime, {
        statusText: "Search match could not be selected in the current map collection.",
        level: "warn",
      });
      return;
    }
    syncMapNavigationState(els, runtime, {
      statusText: `Jumped to ${cleanText(match?.feature?.properties?.label) || match.geoid}.`,
      level: "ok",
    });
  };

  const searchBtn = document.getElementById(SEARCH_BTN_ID);
  if (searchBtn instanceof HTMLButtonElement && searchBtn.dataset.v3MapBound !== "1") {
    searchBtn.dataset.v3MapBound = "1";
    searchBtn.addEventListener("click", runSearch);
  }

  const searchInput = document.getElementById(SEARCH_INPUT_ID);
  if (searchInput instanceof HTMLInputElement && searchInput.dataset.v3MapBound !== "1") {
    searchInput.dataset.v3MapBound = "1";
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });
  }

  const clearSelectionBtn = document.getElementById(CLEAR_SELECTION_BTN_ID);
  if (clearSelectionBtn instanceof HTMLButtonElement && clearSelectionBtn.dataset.v3MapBound !== "1") {
    clearSelectionBtn.dataset.v3MapBound = "1";
    clearSelectionBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      clearRuntimeSelection(runtime);
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: "Selection cleared. Click an area or search by GEOID/name to inspect again.",
        level: "muted",
      });
    });
  }

  const viewCampaignBtn = document.getElementById(VIEW_CAMPAIGN_BTN_ID);
  if (viewCampaignBtn instanceof HTMLButtonElement && viewCampaignBtn.dataset.v3MapBound !== "1") {
    viewCampaignBtn.dataset.v3MapBound = "1";
    viewCampaignBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      if (!runtime) {
        syncMapNavigationState(readMapElements(), runtime, {
          statusText: "Campaign view is unavailable because map runtime is not ready.",
          level: "warn",
        });
        return;
      }
      runtime.contextMode = CONTEXT_MODE_CAMPAIGN;
      const modeSelect = document.getElementById(CONTEXT_MODE_SELECT_ID);
      if (modeSelect instanceof HTMLSelectElement) {
        modeSelect.value = CONTEXT_MODE_CAMPAIGN;
      }
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: "Returning to campaign footprint context…",
        level: "muted",
      });
      void syncMapSurface().then(() => {
        const latest = mapRuntime;
        const ok = fitCurrentScopeFeatures(latest);
        syncMapNavigationState(readMapElements(), latest, {
          statusText: ok
            ? "Campaign view applied to current geometry footprint."
            : "Campaign view is unavailable because boundary geometry is not loaded.",
          level: ok ? "ok" : "warn",
        });
      });
    });
  }

  const viewOfficeBtn = document.getElementById(VIEW_OFFICE_BTN_ID);
  if (viewOfficeBtn instanceof HTMLButtonElement && viewOfficeBtn.dataset.v3MapBound !== "1") {
    viewOfficeBtn.dataset.v3MapBound = "1";
    viewOfficeBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      if (!runtime) {
        syncMapNavigationState(readMapElements(), runtime, {
          statusText: "Office view is unavailable because map runtime is not ready.",
          level: "warn",
        });
        return;
      }
      runtime.contextMode = CONTEXT_MODE_OFFICE;
      const modeSelect = document.getElementById(CONTEXT_MODE_SELECT_ID);
      if (modeSelect instanceof HTMLSelectElement) {
        modeSelect.value = CONTEXT_MODE_OFFICE;
      }
      const activeOfficeId = cleanText(runtime?.shellScope?.officeId) || "scope";
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: `Returning to office context for ${activeOfficeId}…`,
        level: "muted",
      });
      void syncMapSurface().then(() => {
        const latest = mapRuntime;
        const ok = fitCurrentScopeFeatures(latest);
        const focus = latest?.officeFocusState && typeof latest.officeFocusState === "object"
          ? latest.officeFocusState
          : emptyOfficeFocusState();
        const latestOfficeId = cleanText(latest?.shellScope?.officeId) || activeOfficeId;
        syncMapNavigationState(readMapElements(), latest, {
          statusText: !ok
            ? "Office view is unavailable because mapped areas are not loaded."
            : (focus.fallbackToCampaign
              ? `Office view fallback: no mapped geography is tagged to office ${latestOfficeId} in current canonical rows; showing campaign footprint.`
              : `Office view applied for office ${latestOfficeId} (${Number(focus.matchedCount || 0).toLocaleString()} mapped area${Number(focus.matchedCount || 0) === 1 ? "" : "s"}).`),
          level: !ok ? "warn" : (focus.fallbackToCampaign ? "warn" : "ok"),
        });
      });
    });
  }

  const viewWorkedOrganizerBtn = document.getElementById(VIEW_WORKED_ORGANIZER_BTN_ID);
  if (viewWorkedOrganizerBtn instanceof HTMLButtonElement && viewWorkedOrganizerBtn.dataset.v3MapBound !== "1") {
    viewWorkedOrganizerBtn.dataset.v3MapBound = "1";
    viewWorkedOrganizerBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const organizerScope = resolveOrganizerWorkedQuickScope(runtime);
      if (!runtime || !organizerScope) {
        syncMapNavigationState(readMapElements(), runtime, {
          statusText: "Organizer worked view is unavailable because no organizer worked-geography context is active.",
          level: "warn",
        });
        return;
      }
      runtime.contextMode = CONTEXT_MODE_WORKED;
      const modeSelect = document.getElementById(CONTEXT_MODE_SELECT_ID);
      if (modeSelect instanceof HTMLSelectElement) {
        modeSelect.value = CONTEXT_MODE_WORKED;
      }
      const organizerLabel = cleanText(organizerScope.organizerLabel) || cleanText(organizerScope.organizerId) || "selected organizer";
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: `Returning to worked geography for organizer ${organizerLabel}…`,
        level: "muted",
      });
      void syncMapSurface().then(() => {
        const latest = mapRuntime;
        const summary = latest?.workedExecutionSummary && typeof latest.workedExecutionSummary === "object"
          ? latest.workedExecutionSummary
          : null;
        const ok = fitCurrentScopeFeatures(latest);
        const hasJoinedUnits = Number(summary?.joinedUnitCount || 0) > 0;
        syncMapNavigationState(readMapElements(), latest, {
          statusText: hasJoinedUnits && ok
            ? `Organizer worked view applied for ${organizerLabel}.`
            : `Organizer ${organizerLabel} has no mapped worked-geography activity evidence in this context.`,
          level: hasJoinedUnits && ok ? "ok" : "warn",
        });
      });
    });
  }

  const viewSelectedBtn = document.getElementById(VIEW_SELECTED_BTN_ID);
  if (viewSelectedBtn instanceof HTMLButtonElement && viewSelectedBtn.dataset.v3MapBound !== "1") {
    viewSelectedBtn.dataset.v3MapBound = "1";
    viewSelectedBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = fitFeatureByGeoid(runtime, runtime?.selectedGeoid);
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: ok
          ? "Selected area view centered on current inspect target."
          : "Select an area first, then use Selected area view.",
        level: ok ? "ok" : "warn",
      });
    });
  }

  const saveBookmarkBtn = document.getElementById(SAVE_BOOKMARK_BTN_ID);
  if (saveBookmarkBtn instanceof HTMLButtonElement && saveBookmarkBtn.dataset.v3MapBound !== "1") {
    saveBookmarkBtn.dataset.v3MapBound = "1";
    saveBookmarkBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = saveRuntimeBookmark(runtime);
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: ok
          ? `Area bookmark saved for ${cleanText(runtime?.bookmarkedLabel) || cleanText(runtime?.bookmarkedGeoid) || "selected area"}.`
          : "Bookmark save failed. Select an area first.",
        level: ok ? "ok" : "warn",
      });
    });
  }

  const jumpBookmarkBtn = document.getElementById(JUMP_BOOKMARK_BTN_ID);
  if (jumpBookmarkBtn instanceof HTMLButtonElement && jumpBookmarkBtn.dataset.v3MapBound !== "1") {
    jumpBookmarkBtn.dataset.v3MapBound = "1";
    jumpBookmarkBtn.addEventListener("click", () => {
      const runtime = mapRuntime;
      const ok = jumpRuntimeBookmark(runtime, { fit: true, bridge: true });
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: ok
          ? `Jumped to bookmarked area ${cleanText(runtime?.bookmarkedLabel) || cleanText(runtime?.bookmarkedGeoid)}.`
          : "No valid bookmark is available in the current map context.",
        level: ok ? "ok" : "warn",
      });
    });
  }

  const copyInspectBtn = document.getElementById(COPY_INSPECT_BTN_ID);
  if (copyInspectBtn instanceof HTMLButtonElement && copyInspectBtn.dataset.v3MapBound !== "1") {
    copyInspectBtn.dataset.v3MapBound = "1";
    copyInspectBtn.addEventListener("click", async () => {
      const runtime = mapRuntime;
      const areaSummaryText = buildSelectedAreaSummaryText(runtime);
      const modeScopeSummaryText = buildModeScopeSummaryText(runtime);
      const summaryText = areaSummaryText || modeScopeSummaryText;
      const ok = await copyTextToClipboard(summaryText);
      syncMapNavigationState(readMapElements(), runtime, {
        statusText: ok
          ? (areaSummaryText ? "Area summary copied to clipboard." : "Map scope summary copied to clipboard.")
          : "Copy failed. Select an area first, then retry.",
        level: ok ? "ok" : "warn",
      });
    });
  }
}

function bindMapConfigEvents() {
  if (mapConfigEventBound) {
    return;
  }
  mapConfigEventBound = true;
  window.addEventListener("vice:mapbox-config-updated", () => {
    void syncMapSurface();
  });
  window.addEventListener(OPERATIONS_MAP_CONTEXT_EVENT, () => {
    void syncMapSurface();
  });
}

export function renderMapSurface(mount) {
  const frame = createCenterStackFrame();
  const center = createCenterStackColumn();

  const mapCard = createCenterModuleCard({
    title: "Campaign geography map",
    description: "Render canonical campaign geography as a secure Mapbox visualization surface.",
    status: "Awaiting context",
  });
  mapCard.id = "v3MapSurfaceCard";
  const statusEl = mapCard.querySelector(".fpe-card__status");
  if (statusEl instanceof HTMLElement) {
    statusEl.id = CARD_STATUS_ID;
  }

  const body = getCardBody(mapCard);
  if (body instanceof HTMLElement) {
    body.innerHTML = `
      <div class="fpe-map-surface" id="${ROOT_ID}">
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="${METRIC_SELECT_ID}">Choropleth metric</label>
            <select class="fpe-input" id="${METRIC_SELECT_ID}" disabled>
              <option value="">Awaiting map readiness</option>
            </select>
            <div class="fpe-help fpe-help--flush muted" id="${METRIC_HELP_ID}">Metric guidance appears after geography context and metric bundles load.</div>
          </div>
          <div class="fpe-contained-block fpe-contained-block--status">
            <div class="fpe-control-label">Geography load</div>
            <div class="fpe-help fpe-help--flush muted" id="${STATUS_ID}">${MAP_STATUS_CONTEXT_REQUIRED}</div>
            <div class="fpe-action-row">
              <button class="fpe-btn fpe-btn--ghost" hidden id="${ACTION_BTN_ID}" type="button">Set Mapbox token in Controls</button>
            </div>
          </div>
        </div>
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="${CONTEXT_MODE_SELECT_ID}">Map context mode</label>
            <select class="fpe-input" id="${CONTEXT_MODE_SELECT_ID}" disabled>
              <option value="${CONTEXT_MODE_CAMPAIGN}">Campaign footprint</option>
              <option value="${CONTEXT_MODE_OFFICE}">Office footprint</option>
              <option value="${CONTEXT_MODE_TURF}">Turf assignment context</option>
              <option value="${CONTEXT_MODE_EXECUTION}">Execution / ops context</option>
              <option value="${CONTEXT_MODE_WORKED}">Worked activity geography</option>
            </select>
            <div class="fpe-help fpe-help--flush muted" id="${CONTEXT_MODE_STATUS_ID}">Context modes unlock after campaign geography loads.</div>
          </div>
        </div>
        <div class="fpe-help fpe-help--flush muted" id="${CONTEXT_STATUS_ID}">Waiting for canonical campaign, office, and geography selections.</div>
        <div class="fpe-field-grid fpe-field-grid--2">
          <div class="field">
            <label class="fpe-control-label" for="${SEARCH_INPUT_ID}">Find geography</label>
            <input class="fpe-input" id="${SEARCH_INPUT_ID}" placeholder="GEOID/name or district:, office:, turf:, organizer:, precinct:, tract:" type="text" />
          </div>
          <div class="field">
            <label class="fpe-control-label" for="${SEARCH_BTN_ID}">Search action</label>
            <button class="fpe-btn" disabled id="${SEARCH_BTN_ID}" type="button">Find area</button>
          </div>
        </div>
        <div class="fpe-action-row fpe-map-quick-actions">
          <button class="fpe-btn fpe-btn--ghost" disabled id="${FIT_BTN_ID}" type="button">Fit to boundary</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${REFIT_SCOPE_BTN_ID}" type="button">Refit current scope</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${VIEW_CAMPAIGN_BTN_ID}" type="button">Campaign view</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${VIEW_OFFICE_BTN_ID}" type="button">Office view</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${VIEW_WORKED_ORGANIZER_BTN_ID}" type="button">Organizer worked view</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${RESET_BTN_ID}" type="button">Reset view</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${VIEW_SELECTED_BTN_ID}" type="button">Selected area view</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${SAVE_BOOKMARK_BTN_ID}" type="button">Save bookmark</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${JUMP_BOOKMARK_BTN_ID}" type="button">Jump bookmark</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${CLEAR_SELECTION_BTN_ID}" type="button">Clear selection</button>
          <button class="fpe-btn fpe-btn--ghost" disabled id="${COPY_INSPECT_BTN_ID}" type="button">Copy area summary</button>
        </div>
        <div class="fpe-map-status-stack">
          <div class="fpe-help fpe-help--flush muted fpe-map-surface-status fpe-map-surface-status--nav" id="${NAV_STATUS_ID}">Search and quick navigation become available once map geography loads.</div>
          <div class="fpe-help fpe-help--flush muted fpe-map-surface-status fpe-map-surface-status--mode" id="${MODE_SCOPE_STATUS_ID}">Mode and scope status appears after map context is ready.</div>
          <div class="fpe-help fpe-help--flush muted fpe-map-surface-status fpe-map-surface-status--trust" id="${TRUST_STATUS_ID}">Trust/provenance guidance appears after map context is ready.</div>
          <div class="fpe-help fpe-help--flush muted fpe-map-surface-status fpe-map-surface-status--diagnostic" id="${DIAGNOSTIC_STATUS_ID}">Diagnostics summary appears after map context is ready.</div>
        </div>

        <div class="fpe-mapbox-shell">
          <div class="fpe-mapbox-host" id="${HOST_ID}" role="img" aria-label="Campaign geography map"></div>
        </div>

        <div class="fpe-help fpe-help--flush muted" id="${METRIC_STATUS_ID}"></div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Legend</div>
          <div class="fpe-help fpe-help--flush muted" id="${LEGEND_STATUS_ID}">Legend unavailable until map metrics are ready.</div>
          <div class="fpe-map-legend" id="${LEGEND_BODY_ID}"></div>
          <div class="fpe-help fpe-help--flush muted" id="${LEGEND_PROVENANCE_ID}">Source: canonical geography + Census map metrics (display-only overlay; canon math unchanged).</div>
        </div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Worked execution summary</div>
          <div class="fpe-help fpe-help--flush muted" id="${WORKED_SUMMARY_STATUS_ID}">Switch to Worked activity geography mode to review organizer/office activity evidence.</div>
          <div class="fpe-map-inspect" id="${WORKED_SUMMARY_BODY_ID}"></div>
        </div>
        <div class="fpe-help fpe-help--flush muted" id="${HOVER_STATUS_ID}">Hover an area to preview name, type, and geography identifier.</div>
        <div class="fpe-contained-block">
          <div class="fpe-control-label">Area inspect</div>
          <div class="fpe-help fpe-help--flush muted" id="${INSPECT_STATUS_ID}">${MAP_STATUS_INSPECT_PROMPT}</div>
          <div class="fpe-map-inspect" id="${INSPECT_BODY_ID}"></div>
        </div>
      </div>
    `;
  }

  center.append(
    createWhyPanel([
      "Mapbox is used here as a rendering layer only; campaign canon calculations remain unchanged.",
      "Geography overlays and choropleth values come from canonical campaign/Census context as display-only interpretation surfaces.",
      "Worked geography shows activity evidence from matched turfEvents joins; it is not assigned turf unless assignment context exists elsewhere.",
    ]),
    mapCard,
  );
  frame.append(center);
  mount.innerHTML = "";
  mount.append(frame);

  bindMapViewportResize();
  bindMapConfigEvents();
  bindMapSurfaceEvents();
  publishMapRuntimeDiagnostics(ensureRuntime(document.getElementById(ROOT_ID)), "rendered");
  void syncMapSurface();

  return () => {
    bindMapViewportResize();
    bindMapConfigEvents();
    bindMapSurfaceEvents();
    void syncMapSurface();
  };
}
