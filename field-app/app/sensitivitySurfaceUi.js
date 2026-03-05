export function surfaceLeverSpecCore(key){
  const k = String(key || "");
  const specs = {
    volunteerMultiplier: { label: "Volunteer multiplier", stateKey: "volunteerMultBase", clampLo: 0.1, clampHi: 6.0, step: 0.01, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(2) },
    supportRate: { label: "Support rate (%)", stateKey: "supportRatePct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(1) },
    contactRate: { label: "Contact rate (%)", stateKey: "contactRatePct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(1) },
    turnoutReliability: { label: "Turnout reliability (%)", stateKey: "turnoutReliabilityPct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v)=> (v==null||!isFinite(v))?"—":Number(v).toFixed(1) },
  };
  return specs[k] || null;
}

export function surfaceClampCore(v, lo, hi){
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function surfaceBaselineValueCore(spec, state){
  if (!spec) return null;
  const v = Number(state?.[spec.stateKey]);
  if (Number.isFinite(v)) return v;
  // fallbacks aligned with MC defaults
  if (spec.stateKey === "supportRatePct") return 55;
  if (spec.stateKey === "contactRatePct") return 22;
  if (spec.stateKey === "turnoutReliabilityPct") return 80;
  if (spec.stateKey === "volunteerMultBase") return 1.0;
  return null;
}

export function applySurfaceDefaultsCore({
  els,
  surfaceLeverSpec,
  surfaceBaselineValue,
  surfaceClamp,
}){
  if (!els.surfaceLever || !els.surfaceMin || !els.surfaceMax) return;
  const spec = surfaceLeverSpec(els.surfaceLever.value);
  if (!spec) return;

  const base = surfaceBaselineValue(spec);
  const lo = (base != null) ? (base * 0.8) : spec.clampLo;
  const hi = (base != null) ? (base * 1.2) : spec.clampHi;

  const minV = surfaceClamp(lo, spec.clampLo, spec.clampHi);
  const maxV = surfaceClamp(hi, spec.clampLo, spec.clampHi);

  els.surfaceMin.step = String(spec.step);
  els.surfaceMax.step = String(spec.step);

  els.surfaceMin.value = String(minV);
  els.surfaceMax.value = String(maxV);
}

export function renderSurfaceStubCore({ els }){
  if (!els.surfaceTbody) return;
  els.surfaceTbody.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td></tr>';
  if (els.surfaceSummary) els.surfaceSummary.textContent = "Compute to see safe zones, cliffs, and diminishing returns.";
  if (els.surfaceStatus) els.surfaceStatus.textContent = "";
}

export function renderSurfaceResultCore({
  els,
  spec,
  result,
  fmtSigned,
}){
  if (!els.surfaceTbody) return;

  const pts = Array.isArray(result?.points) ? result.points : [];
  const analysis = result?.analysis || null;

  els.surfaceTbody.innerHTML = "";
  if (!pts.length){
    renderSurfaceStubCore({ els });
    if (els.surfaceSummary) els.surfaceSummary.textContent = result?.warning ? String(result.warning) : "No points returned.";
    return;
  }

  for (const p of pts){
    const tr = document.createElement("tr");

    const td0 = document.createElement("td");
    td0.textContent = spec?.fmt ? spec.fmt(p.leverValue) : String(p.leverValue);

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = (p.winProb == null || !isFinite(p.winProb)) ? "—" : `${(p.winProb * 100).toFixed(1)}%`;

    const td2 = document.createElement("td"); td2.className = "num"; td2.textContent = fmtSigned(p.p10);
    const td3 = document.createElement("td"); td3.className = "num"; td3.textContent = fmtSigned(p.p50);
    const td4 = document.createElement("td"); td4.className = "num"; td4.textContent = fmtSigned(p.p90);

    tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    els.surfaceTbody.appendChild(tr);
  }

  const parts = [];
  const T = Number(els.surfaceTarget?.value);
  const target = (Number.isFinite(T) ? (T / 100) : 0.70);

  if (analysis?.safeZone){
    const z = analysis.safeZone;
    parts.push(`Safe zone (≥ ${Math.round(target * 100)}%): ${spec.fmt(z.min)} to ${spec.fmt(z.max)}`);
  } else {
    parts.push(`Safe zone (≥ ${Math.round(target * 100)}%): none`);
  }

  const cliffs = Array.isArray(analysis?.cliffPoints) ? analysis.cliffPoints : [];
  if (cliffs.length){
    const xs = cliffs.slice(0, 3).map((c) => spec.fmt(c.at)).join(", ");
    parts.push(`Cliff edges: ${xs}${cliffs.length > 3 ? "…" : ""}`);
  } else {
    parts.push("Cliff edges: none");
  }

  const dims = Array.isArray(analysis?.diminishingZones) ? analysis.diminishingZones : [];
  if (dims.length){
    const r = dims[0];
    parts.push(`Diminishing returns: ${spec.fmt(r.min)} to ${spec.fmt(r.max)}${dims.length > 1 ? "…" : ""}`);
  } else {
    parts.push("Diminishing returns: none");
  }

  const fr = Array.isArray(analysis?.fragilityPoints) ? analysis.fragilityPoints : [];
  if (fr.length){
    const xs = fr.slice(0, 3).map((c) => spec.fmt(c.at)).join(", ");
    parts.push(`Fragility points: ${xs}${fr.length > 3 ? "…" : ""}`);
  } else {
    parts.push("Fragility points: none");
  }

  if (els.surfaceSummary) els.surfaceSummary.textContent = parts.join(" • ");
}
