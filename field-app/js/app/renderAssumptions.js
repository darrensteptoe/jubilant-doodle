// @ts-check
import {
  aggregateRowsForSelection,
  assessRaceFootprintAlignment,
  buildCensusAssumptionAdvisory,
  clampCensusApplyMultipliers,
  evaluateCensusApplyMode,
  evaluateCensusPaceAgainstAdvisory,
  formatRaceFootprintScope,
  normalizeFootprintCapacity,
  resolutionLabel,
} from "../core/censusModule.js";

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
    kv("Template", labelTemplate(state.raceType)),
    kv("Assumptions profile", assumptionsProfileLabel(state)),
    kv("Mode", state.mode === "late_start" ? "Late-start / turnout-heavy" : "Persuasion-first"),
    kv("Election date", state.electionDate || "—"),
    kv("Weeks remaining", weeks == null ? "—" : String(weeks)),
  ]));

  blocks.push(block("Race footprint", [
    kv("Defined", footprint.footprintDefined ? "Yes" : "No"),
    kv("Resolution", resolutionText),
    kv("GEO units", footprint.footprintDefined ? String(storedFootprint.geoids.length) : "—"),
    kv("Population capacity", Number.isFinite(Number(capacity.population)) ? fmtInt(Number(capacity.population)) : "—"),
    kv("Scope", scope),
    kv("Selection alignment", !footprint.footprintDefined
      ? "—"
      : (footprint.selectionHasContext ? (footprint.selectionMatches ? "Match" : "Different") : "No context")),
    kv("Provenance", !footprint.footprintDefined
      ? "—"
      : (footprint.provenanceAligned ? "Aligned" : "Stale / missing")),
  ]));

  const applyModeReasonLabel = (reason) => {
    const code = String(reason || "").trim();
    if (!code || code === "toggle_off") return "OFF";
    if (code === "ready") return "ON";
    if (code === "rows_not_ready") return "Blocked (rows not ready)";
    if (code === "advisory_not_ready") return "Blocked (advisory not ready)";
    if (code === "selection_mismatch") return "Blocked (selection mismatch)";
    if (code.startsWith("provenance_")) return "Blocked (provenance stale)";
    if (code === "alignment_not_ready") return "Blocked (alignment)";
    return `Blocked (${code})`;
  };
  const fmtOne = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : "—";
  };
  const fmtBand = (band) => {
    const low = Number(band?.low);
    const mid = Number(band?.mid);
    const high = Number(band?.high);
    if (!Number.isFinite(low) || !Number.isFinite(mid) || !Number.isFinite(high)) return "—";
    return `${low.toFixed(1)} / ${mid.toFixed(1)} / ${high.toFixed(1)}`;
  };

  const censusState = state?.census && typeof state.census === "object" ? state.census : null;
  const rowsByGeoid = censusState?.rowsByGeoid && typeof censusState.rowsByGeoid === "object" ? censusState.rowsByGeoid : {};
  const selectedGeoids = Array.isArray(censusState?.selectedGeoids) ? censusState.selectedGeoids : [];
  const hasRows = selectedGeoids.length > 0 && Object.keys(rowsByGeoid).length > 0 && !!String(censusState?.activeRowsKey || "").trim();
  let advisory = null;
  let pace = null;
  let applyGate = { requested: false, ready: false, reason: "toggle_off" };
  let applyMultipliers = null;

  if (hasRows){
    const rawPct = Number(state?.channelDoorPct);
    const doorShare = Number.isFinite(rawPct) ? (Math.max(0, Math.min(100, rawPct)) / 100) : 0.5;
    const aggregate = aggregateRowsForSelection({
      rowsByGeoid,
      selectedGeoids,
      metricSet: censusState?.metricSet,
    });
    advisory = buildCensusAssumptionAdvisory({
      aggregate,
      doorShare,
      doorsPerHour: Number(state?.doorsPerHour3 ?? state?.doorsPerHour),
      callsPerHour: Number(state?.callsPerHour3),
      rowsByGeoid,
      selectedGeoids,
    });
    applyGate = evaluateCensusApplyMode({
      applyRequested: !!censusState?.applyAdjustedAssumptions,
      censusState,
      raceFootprint: state?.raceFootprint,
      assumptionsProvenance: state?.assumptionsProvenance,
      advisoryReady: !!advisory?.ready,
      hasRows,
    });
    if (applyGate.ready && applyGate.requested){
      applyMultipliers = clampCensusApplyMultipliers(advisory?.multipliers || {});
    }
    pace = evaluateCensusPaceAgainstAdvisory({
      advisory,
      needVotes: Number(res?.expected?.persuasionNeed),
      weeks: Number(weeks),
      contactRatePct: applyMultipliers
        ? (Number(state?.contactRatePct) * applyMultipliers.contactRate)
        : Number(state?.contactRatePct),
      supportRatePct: applyMultipliers
        ? (Number(state?.supportRatePct) * applyMultipliers.persuasion)
        : Number(state?.supportRatePct),
      turnoutReliabilityPct: applyMultipliers
        ? (Number(state?.turnoutReliabilityPct) * applyMultipliers.turnoutLift)
        : Number(state?.turnoutReliabilityPct),
      orgCount: Number(state?.orgCount),
      orgHoursPerWeek: applyMultipliers
        ? (Number(state?.orgHoursPerWeek) / applyMultipliers.organizerLoad)
        : Number(state?.orgHoursPerWeek),
      volunteerMult: Number(state?.volunteerMultBase),
    });
  }

  const feasibilityText = (() => {
    if (!pace?.ready) return "—";
    if (pace.severity === "bad") return "Above plausible range";
    if (pace.severity === "warn") return "Near top of achievable range";
    return "Inside achievable range";
  })();
  const applyModeText = (() => {
    if (applyMultipliers){
      return `ON (${applyMultipliers.doorsPerHour.toFixed(2)}x DPH, ${applyMultipliers.contactRate.toFixed(2)}x CR, ${applyMultipliers.persuasion.toFixed(2)}x SR, ${applyMultipliers.turnoutLift.toFixed(2)}x TR, ${applyMultipliers.organizerLoad.toFixed(2)}x load)`;
    }
    return applyModeReasonLabel(applyGate.reason);
  })();

  blocks.push(block("Census operating band", [
    kv("Rows context", hasRows ? (censusState.activeRowsKey || "Loaded") : "Not loaded"),
    kv("Signal coverage", advisory?.ready ? `${advisory.coverage.availableSignals}/${advisory.coverage.totalSignals}` : "—"),
    kv("Apply mode", applyModeText),
    kv("Achievable APH (p25/p50/p75)", advisory?.ready ? fmtBand(advisory.aph?.range) : "—"),
    kv("Required APH", pace?.ready ? fmtOne(pace.requiredAph) : "—"),
    kv("Feasibility", feasibilityText),
  ]));

  blocks.push(block("Universe & turnout", [
    kv("Universe basis", state.universeBasis === "active" ? "Active (advanced)" : "Registered"),
    kv("Universe size", res.raw.universeSize == null ? "—" : fmtInt(res.raw.universeSize)),
    kv("Turnout cycles", (res.raw.turnoutA == null || res.raw.turnoutB == null) ? "—" : `${res.raw.turnoutA.toFixed(1)}% & ${res.raw.turnoutB.toFixed(1)}%`),
    kv("Expected turnout", res.turnout.expectedPct == null ? "—" : `${res.turnout.expectedPct.toFixed(1)}%`),
    kv("Band width", res.raw.bandWidth == null ? "—" : `±${res.raw.bandWidth.toFixed(1)}%`),
    kv("Votes per 1% turnout", res.turnout.votesPer1pct == null ? "—" : fmtInt(res.turnout.votesPer1pct)),
    kv("Source note", state.sourceNote || "—"),
  ]));

  blocks.push(block("Vote landscape", [
    kv("Candidates", String(state.candidates.length)),
    kv("Undecided break", labelUndecidedMode(state.undecidedMode)),
    kv("You are", getYourName() || "—"),
  ]));

  blocks.push(block("Persuasion & early vote", [
    kv("Persuasion % of universe", res.raw.persuasionPct == null ? "—" : `${res.raw.persuasionPct.toFixed(1)}%`),
    kv("Early vote % (Expected)", res.raw.earlyVoteExp == null ? "—" : `${res.raw.earlyVoteExp.toFixed(1)}%`),
  ]));

  const assumptionsSnapshotEl = els?.assumptionsSnapshot || null;
  if (assumptionsSnapshotEl){
    assumptionsSnapshotEl.innerHTML = "";
    for (const b of blocks) assumptionsSnapshotEl.appendChild(b);
  }
}
