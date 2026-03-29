// @ts-check
import {
  assessRaceFootprintAlignment,
  buildCensusPaceFeasibilitySnapshot,
  formatRaceFootprintScope,
  normalizeFootprintCapacity,
  resolutionLabel,
} from "../core/censusModule.js";
import { clamp, roundWholeNumberByMode, safeNum } from "../core/utils.js";
import { UNIVERSE_DEFAULTS } from "../core/universeLayer.js";
import {
  buildAssumptionsApplyModeText,
  buildAssumptionsBandWidthText,
  buildAssumptionsFeasibilityText,
  buildAssumptionsSignalCoverageText,
  buildAssumptionsTurnoutCyclesText,
  buildAssumptionsWeeksText,
  formatAssumptionsBand,
  formatAssumptionsOneDecimal,
  formatAssumptionsPercent,
} from "./assumptionsViewHelpers.js";
import { selectDistrictCanonicalView } from "../core/selectors/districtCanonical.js";
import { resolveCensusRowsForState } from "./censusRowsRuntimeStore.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDateDayMs(rawValue){
  const value = String(rawValue || "").trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day);
}

function buildElectionCountdownView(electionDate, nowDate = new Date()){
  const isoDate = String(electionDate || "").trim();
  const electionDayMs = parseIsoDateDayMs(isoDate);
  if (electionDayMs == null){
    return {
      daysLabel: "—",
      note: "Set Election Date",
      electionDateText: "—",
    };
  }
  const todayMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const dayDiffRaw = (electionDayMs - todayMs) / MS_PER_DAY;
  const dayDiff = roundWholeNumberByMode(dayDiffRaw, { mode: "round", fallback: 0 }) ?? 0;
  if (dayDiff < 0){
    return {
      daysLabel: "Passed",
      note: `${Math.abs(dayDiff)}d ago`,
      electionDateText: isoDate,
    };
  }
  if (dayDiff === 0){
    return {
      daysLabel: "0",
      note: "Election Day is today",
      electionDateText: isoDate,
    };
  }
  return {
    daysLabel: String(dayDiff),
    note: dayDiff === 1 ? "day remaining" : "days remaining",
    electionDateText: isoDate,
  };
}

export function renderAssumptionsModule(args){
  const {
    els,
    state,
    res,
    weeks,
    block,
    kv,
    assumptionsProfileLabel,
    labelUndecidedMode,
    getYourName,
    fmtInt,
  } = args || {};

  const blocks = [];
  const runtimeState = state && typeof state === "object" ? state : {};
  const districtCanonical = selectDistrictCanonicalView(runtimeState);
  const canonicalForm = districtCanonical?.form && typeof districtCanonical.form === "object"
    ? districtCanonical.form
    : {};
  const canonicalUniverse = districtCanonical?.universeComposition && typeof districtCanonical.universeComposition === "object"
    ? districtCanonical.universeComposition
    : {};
  const canonicalMode = String(canonicalForm.mode || runtimeState.mode || "").trim();
  const canonicalElectionDate = String(canonicalForm.electionDate || "").trim();

  const footprint = assessRaceFootprintAlignment({
    censusState: state?.census,
    raceFootprint: state?.raceFootprint,
    assumptionsProvenance: state?.assumptionsProvenance,
  });
  const capacity = normalizeFootprintCapacity(state?.footprintCapacity);
  const storedFootprint = footprint.stored;
  const scope = formatRaceFootprintScope(storedFootprint);
  const resolutionText = resolutionLabel(storedFootprint.resolution) || "—";
  const retentionStateValue = safeNum(runtimeState.retentionFactor);
  const retentionCanonicalValue = safeNum(canonicalUniverse.retentionFactor);
  const retentionEffectiveValue = retentionStateValue == null ? retentionCanonicalValue : retentionStateValue;
  const retentionPct = retentionEffectiveValue == null
    ? UNIVERSE_DEFAULTS.retentionFactor * 100
    : (retentionEffectiveValue <= 1
      ? clamp(retentionEffectiveValue, 0.60, 1.00) * 100
      : retentionEffectiveValue);

  blocks.push(block("Race & scenario", [
    kv("Scenario", state.scenarioName || "—"),
    kv("Assumptions profile", assumptionsProfileLabel(state)),
    kv("Mode", canonicalMode === "late_start" ? "Late-start / turnout-heavy" : "Persuasion-first"),
    kv("Election date", canonicalElectionDate || String(runtimeState.electionDate || "").trim() || "—"),
    kv("Weeks remaining", buildAssumptionsWeeksText(weeks)),
  ]));

  blocks.push(block("Race footprint", [
    kv("Defined", footprint.footprintDefined ? "Yes" : "No"),
    kv("Resolution", resolutionText),
    kv("GEO units", footprint.footprintDefined ? String(storedFootprint.geoids.length) : "—"),
    kv("Population capacity", fmtInt(capacity.population)),
    kv("Scope", scope),
    kv("Selection alignment", !footprint.footprintDefined
      ? "—"
      : (footprint.selectionHasContext ? (footprint.selectionMatches ? "Match" : "Different") : "No context")),
    kv("Provenance", !footprint.footprintDefined
      ? "—"
      : (footprint.provenanceAligned ? "Aligned" : "Stale / missing")),
  ]));

  const censusRuntimeState = runtimeState?.census && typeof runtimeState.census === "object"
    ? runtimeState.census
    : {};
  const censusRuntimeRows = resolveCensusRowsForState(censusRuntimeState);
  const censusSelectedGeoids = Array.isArray(censusRuntimeState?.selectedGeoids)
    ? censusRuntimeState.selectedGeoids
    : [];

  const censusPaceSnapshot = buildCensusPaceFeasibilitySnapshot({
    state,
    needVotes: res?.expected?.persuasionNeed,
    weeks,
    rowsByGeoid: censusRuntimeRows,
    selectedGeoids: censusSelectedGeoids,
  });
  const censusState = censusPaceSnapshot.censusState;
  const hasRows = !!censusPaceSnapshot.activeRowsReady;
  const advisory = censusPaceSnapshot.advisory;
  const pace = censusPaceSnapshot.pace;
  const applyGate = censusPaceSnapshot.applyGate;
  const applyMultipliers = censusPaceSnapshot.applyMultipliers;
  const loadedRowCount = Number.isFinite(Number(censusState?.loadedRowCount))
    ? Math.max(0, Number(censusState.loadedRowCount))
    : Object.keys(censusPaceSnapshot.rowsByGeoid || {}).length;
  const selectedGeoCount = Array.isArray(censusState?.selectedGeoids) ? censusState.selectedGeoids.length : 0;
  const rowsContextText = hasRows
    ? (censusState.activeRowsKey || `Loaded (${loadedRowCount.toLocaleString("en-US")} rows)`)
    : (loadedRowCount > 0 && selectedGeoCount > 0
      ? `Loaded (${loadedRowCount.toLocaleString("en-US")} rows), runtime context unavailable`
      : "Not loaded");

  const feasibilityText = buildAssumptionsFeasibilityText(pace);
  const applyModeText = buildAssumptionsApplyModeText({
    applyGate,
    applyMultipliers,
  });

  blocks.push(block("Census operating band", [
    kv("Rows context", rowsContextText),
    kv("Signal coverage", buildAssumptionsSignalCoverageText(advisory)),
    kv("Apply mode", applyModeText),
    kv("Achievable APH (p25/p50/p75)", advisory?.ready ? formatAssumptionsBand(advisory.aph?.range) : "—"),
    kv("Required APH", pace?.ready ? formatAssumptionsOneDecimal(pace.requiredAph) : "—"),
    kv("Feasibility", feasibilityText),
  ]));

  blocks.push(block("Universe & turnout", [
    kv("Universe basis", state.universeBasis === "active" ? "Active (advanced)" : "Registered"),
    kv("Universe size", fmtInt(res.raw.universeSize)),
    kv("Turnout cycles", buildAssumptionsTurnoutCyclesText(res.raw.turnoutA, res.raw.turnoutB)),
    kv("Expected turnout", formatAssumptionsPercent(res.turnout.expectedPct)),
    kv("Band width", buildAssumptionsBandWidthText(res.raw.bandWidth)),
    kv("Votes per 1% turnout", fmtInt(res.turnout.votesPer1pct)),
    kv("Source note", state.sourceNote || "—"),
  ]));

  blocks.push(block("Vote landscape", [
    kv("Candidates", String(state.candidates.length)),
    kv("Undecided break", labelUndecidedMode(state.undecidedMode)),
    kv("You are", getYourName() || "—"),
  ]));

  blocks.push(block("Persuasion & early vote", [
    kv("Persuasion % of universe", formatAssumptionsPercent(res.raw.persuasionPct)),
    kv("Support retention", formatAssumptionsPercent(retentionPct)),
    kv("Early vote % (Expected)", formatAssumptionsPercent(res.raw.earlyVoteExp)),
  ]));

  const assumptionsSnapshotEl = els?.assumptionsSnapshot || null;
  if (assumptionsSnapshotEl){
    assumptionsSnapshotEl.innerHTML = "";
    for (const b of blocks) assumptionsSnapshotEl.appendChild(b);
  }

  const electionCountdown = buildElectionCountdownView(canonicalElectionDate);
  const daysToEdayEl = els?.daysToEdaySidebar || null;
  const daysToEdayNoteEl = els?.daysToEdayNoteSidebar || null;
  const electionDateSidebarEl = els?.electionDateCanonicalSidebar || null;
  if (daysToEdayEl) daysToEdayEl.textContent = electionCountdown.daysLabel;
  if (daysToEdayNoteEl) daysToEdayNoteEl.textContent = electionCountdown.note;
  if (electionDateSidebarEl) electionDateSidebarEl.textContent = electionCountdown.electionDateText;
}
