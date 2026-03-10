// @ts-check
import { evaluateFootprintFeasibility } from "../core/censusModule.js";

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
