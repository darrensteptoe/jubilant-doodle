// @ts-check
import {
  aggregateRowsForSelection,
  buildCensusAssumptionAdvisory,
  clampCensusApplyMultipliers,
  evaluateCensusApplyMode,
  evaluateCensusPaceAgainstAdvisory,
  evaluateFootprintFeasibility,
  evaluateResolutionContract,
} from "../core/censusModule.js";

export function renderValidationModule(args){
  const {
    els,
    state,
    res,
    weeks,
    benchmarkWarnings = [],
    evidenceWarnings = [],
    driftSummary = null,
  } = args || {};

  const list = els?.validationList || els?.validationListSidebar;
  if (!list) return;
  const items = [];
  const fPct = (v) => (v == null || !isFinite(v)) ? "—" : `${(v * 100).toFixed(1)}%`;
  const fNum = (v) => (v == null || !isFinite(v)) ? "—" : Number(v).toFixed(1);

  const uOk = res.validation.universeOk;
  items.push({
    kind: uOk ? "ok" : "bad",
    text: uOk ? "Universe size set." : "Universe size missing or invalid."
  });

  const turnoutOk = res.validation.turnoutOk;
  items.push({
    kind: turnoutOk ? "ok" : "warn",
    text: turnoutOk ? "Turnout baseline set (2 cycles + band)." : "Turnout baseline incomplete. Add Cycle A and Cycle B turnout %."
  });

  const candOk = res.validation.candidateTableOk;
  items.push({
    kind: candOk ? "ok" : "bad",
    text: candOk ? "Candidate + undecided totals = 100%." : "Candidate + undecided totals must equal 100%."
  });

  const splitOk = res.validation.userSplitOk;
  if (state.undecidedMode === "user_defined"){
    items.push({
      kind: splitOk ? "ok" : "bad",
      text: splitOk ? "User-defined undecided split totals = 100%." : "User-defined undecided split must total 100% across candidates."
    });
  }

  const persOk = res.validation.persuasionOk;
  items.push({
    kind: persOk ? "ok" : "warn",
    text: persOk ? "Persuasion % set." : "Persuasion % missing."
  });

  if (weeks != null){
    items.push({
      kind: "ok",
      text: `Weeks remaining: ${weeks} (reference for later phases).`
    });
  }

  const footprint = evaluateFootprintFeasibility({ state, res });
  const resolutionContract = evaluateResolutionContract();
  if (!resolutionContract.ok){
    const issueIds = Array.from(new Set([
      ...(Array.isArray(resolutionContract.missingInOptions) ? resolutionContract.missingInOptions : []),
      ...(Array.isArray(resolutionContract.unsupportedByNormalize) ? resolutionContract.unsupportedByNormalize : []),
    ]));
    items.push({
      kind: "bad",
      text: `Census resolution contract mismatch (${issueIds.join(", ")}). Refresh runtime before using Census selectors.`,
    });
  }
  for (const issue of footprint.issues){
    items.push({
      kind: issue.kind === "bad" ? "bad" : "warn",
      text: String(issue.text || ""),
    });
  }
  if (footprint.alignment.footprintDefined && footprint.alignment.selectionMatches){
    items.push({
      kind: "ok",
      text: "Census selection matches race footprint.",
    });
  }
  if (footprint.alignment.footprintDefined && footprint.alignment.provenanceAligned){
    items.push({
      kind: "ok",
      text: "Assumption provenance aligned with race footprint.",
    });
  }

  const censusState = state?.census && typeof state.census === "object" ? state.census : null;
  const rowsByGeoid = censusState?.rowsByGeoid && typeof censusState.rowsByGeoid === "object" ? censusState.rowsByGeoid : {};
  const selectedGeoids = Array.isArray(censusState?.selectedGeoids) ? censusState.selectedGeoids : [];
  if (selectedGeoids.length && Object.keys(rowsByGeoid).length){
    const canonicalDoorShare = (() => {
      const rawPct = Number(state?.channelDoorPct);
      if (Number.isFinite(rawPct)){
        const pct = Math.min(100, Math.max(0, rawPct));
        return pct / 100;
      }
      return 0.5;
    })();
    const aggregate = aggregateRowsForSelection({
      rowsByGeoid,
      selectedGeoids,
      metricSet: censusState?.metricSet,
    });
    const advisory = buildCensusAssumptionAdvisory({
      aggregate,
      doorShare: canonicalDoorShare,
      doorsPerHour: Number(state?.doorsPerHour3 ?? state?.doorsPerHour),
      callsPerHour: Number(state?.callsPerHour3),
      rowsByGeoid,
      selectedGeoids,
    });
    const applyGate = evaluateCensusApplyMode({
      applyRequested: !!censusState?.applyAdjustedAssumptions,
      censusState,
      raceFootprint: state?.raceFootprint,
      assumptionsProvenance: state?.assumptionsProvenance,
      advisoryReady: !!advisory.ready,
      hasRows: !!Object.keys(rowsByGeoid).length && !!String(censusState?.activeRowsKey || "").trim(),
    });
    const applyMultipliers = (applyGate.ready && applyGate.requested)
      ? clampCensusApplyMultipliers(advisory.multipliers)
      : null;
    const adjustedSupportRatePct = applyMultipliers
      ? (Number(state?.supportRatePct) * applyMultipliers.persuasion)
      : Number(state?.supportRatePct);
    const adjustedTurnoutReliabilityPct = applyMultipliers
      ? (Number(state?.turnoutReliabilityPct) * applyMultipliers.turnoutLift)
      : Number(state?.turnoutReliabilityPct);
    const adjustedOrgHoursPerWeek = applyMultipliers
      ? (Number(state?.orgHoursPerWeek) / applyMultipliers.organizerLoad)
      : Number(state?.orgHoursPerWeek);
    const pace = evaluateCensusPaceAgainstAdvisory({
      advisory,
      needVotes: Number(res?.expected?.persuasionNeed),
      weeks: Number(state?.weeksRemaining),
      contactRatePct: Number(state?.contactRatePct),
      supportRatePct: adjustedSupportRatePct,
      turnoutReliabilityPct: adjustedTurnoutReliabilityPct,
      orgCount: Number(state?.orgCount),
      orgHoursPerWeek: adjustedOrgHoursPerWeek,
      volunteerMult: Number(state?.volunteerMultBase),
    });
    if (pace.ready){
      const req = fNum(pace.requiredAph);
      const sourceTag = applyMultipliers ? " (Census-adjusted assumptions ON)" : "";
      if (pace.availableAphRange){
        const low = fNum(pace.availableAphRange.low);
        const mid = fNum(pace.availableAphRange.mid);
        const high = fNum(pace.availableAphRange.high);
        if (pace.severity === "bad"){
          items.push({
            kind: "bad",
            text: `Census APH feasibility${sourceTag}: required ${req} is above achievable band ${low}/${mid}/${high}.`,
          });
        } else if (pace.severity === "warn"){
          items.push({
            kind: "warn",
            text: `Census APH feasibility${sourceTag}: required ${req} is near the top of achievable band ${low}/${mid}/${high}.`,
          });
        } else {
          items.push({
            kind: "ok",
            text: `Census APH feasibility${sourceTag}: required ${req} is inside achievable band ${low}/${mid}/${high}.`,
          });
        }
      } else {
        const available = fNum(pace.availableAph);
        items.push({
          kind: pace.severity === "bad" ? "bad" : (pace.severity === "warn" ? "warn" : "ok"),
          text: `Census APH feasibility${sourceTag}: required ${req} vs adjusted ${available}.`,
        });
      }
    }
  }

  if (Array.isArray(benchmarkWarnings) && benchmarkWarnings.length){
    for (const msg of benchmarkWarnings.slice(0, 4)){
      items.push({
        kind: "warn",
        text: String(msg),
      });
    }
  }

  if (Array.isArray(evidenceWarnings) && evidenceWarnings.length){
    for (const msg of evidenceWarnings.slice(0, 3)){
      items.push({
        kind: "warn",
        text: String(msg),
      });
    }
  }

  if (driftSummary?.hasLog){
    const crActual = driftSummary.actualCR;
    const crAssumed = driftSummary.assumedCR;
    if (crActual != null && isFinite(crActual)){
      const crLow = (crAssumed != null && isFinite(crAssumed) && crAssumed > 0 && crActual < crAssumed * 0.9);
      items.push({
        kind: crLow ? "warn" : "ok",
        text: `Rolling CR ${fPct(crActual)} vs assumed ${fPct(crAssumed)}.`,
      });
    }

    const srActual = driftSummary.actualSR;
    const srAssumed = driftSummary.assumedSR;
    if (srActual != null && isFinite(srActual)){
      const srLow = (srAssumed != null && isFinite(srAssumed) && srAssumed > 0 && srActual < srAssumed * 0.9);
      items.push({
        kind: srLow ? "warn" : "ok",
        text: `Rolling SR ${fPct(srActual)} vs assumed ${fPct(srAssumed)}.`,
      });
    }

    const aphActual = driftSummary.actualAPH;
    const aphAssumed = driftSummary.expectedAPH;
    if (aphActual != null && isFinite(aphActual)){
      const aphLow = (aphAssumed != null && isFinite(aphAssumed) && aphAssumed > 0 && aphActual < aphAssumed * 0.9);
      items.push({
        kind: aphLow ? "warn" : "ok",
        text: `Rolling APH ${fNum(aphActual)} vs assumed ${fNum(aphAssumed)}.`,
      });
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const it of items){
    const key = `${it.kind}::${it.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  list.innerHTML = "";
  for (const it of deduped){
    const li = document.createElement("li");
    li.className = it.kind;
    li.textContent = it.text;
    list.appendChild(li);
  }
}
