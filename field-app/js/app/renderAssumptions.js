// @ts-check
import {
  assessRaceFootprintAlignment,
  buildCensusPaceFeasibilitySnapshot,
  formatRaceFootprintScope,
  normalizeFootprintCapacity,
  resolutionLabel,
} from "../core/censusModule.js";
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

export function renderAssumptionsModule(args){
  const {
    els,
    state,
    res,
    weeks,
    block,
    kv,
    labelTemplate,
    assumptionsProfileLabel,
    labelUndecidedMode,
    getYourName,
    fmtInt,
  } = args || {};

  const blocks = [];
  const footprint = assessRaceFootprintAlignment({
    censusState: state?.census,
    raceFootprint: state?.raceFootprint,
    assumptionsProvenance: state?.assumptionsProvenance,
  });
  const capacity = normalizeFootprintCapacity(state?.footprintCapacity);
  const storedFootprint = footprint.stored;
  const scope = formatRaceFootprintScope(storedFootprint);
  const resolutionText = resolutionLabel(storedFootprint.resolution) || "—";

  blocks.push(block("Race & scenario", [
    kv("Scenario", state.scenarioName || "—"),
    kv("Template", labelTemplate(state)),
    kv("Assumptions profile", assumptionsProfileLabel(state)),
    kv("Mode", state.mode === "late_start" ? "Late-start / turnout-heavy" : "Persuasion-first"),
    kv("Election date", state.electionDate || "—"),
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

  const censusPaceSnapshot = buildCensusPaceFeasibilitySnapshot({
    state,
    needVotes: res?.expected?.persuasionNeed,
    weeks,
  });
  const censusState = censusPaceSnapshot.censusState;
  const hasRows = !!censusPaceSnapshot.activeRowsReady;
  const advisory = censusPaceSnapshot.advisory;
  const pace = censusPaceSnapshot.pace;
  const applyGate = censusPaceSnapshot.applyGate;
  const applyMultipliers = censusPaceSnapshot.applyMultipliers;

  const feasibilityText = buildAssumptionsFeasibilityText(pace);
  const applyModeText = buildAssumptionsApplyModeText({
    applyGate,
    applyMultipliers,
  });

  blocks.push(block("Census operating band", [
    kv("Rows context", hasRows ? (censusState.activeRowsKey || "Loaded") : "Not loaded"),
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
    kv("Early vote % (Expected)", formatAssumptionsPercent(res.raw.earlyVoteExp)),
  ]));

  const assumptionsSnapshotEl = els?.assumptionsSnapshot || null;
  if (assumptionsSnapshotEl){
    assumptionsSnapshotEl.innerHTML = "";
    for (const b of blocks) assumptionsSnapshotEl.appendChild(b);
  }
}
