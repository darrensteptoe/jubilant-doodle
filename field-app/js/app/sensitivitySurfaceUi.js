// @ts-check
import { buildOutcomeSurfaceSummaryText } from "../core/outcomeView.js";
import { formatFixedNumber, formatPercentFromUnit } from "../core/utils.js";
export function surfaceLeverSpecCore(key){
  const k = String(key || "");
  const specs = {
    volunteerMultiplier: { label: "Volunteer multiplier", stateKey: "volunteerMultBase", clampLo: 0.1, clampHi: 6.0, step: 0.01, fmt: (v) => formatFixedNumber(v, 2) },
    supportRate: { label: "Support rate (%)", stateKey: "supportRatePct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v) => formatFixedNumber(v, 1) },
    contactRate: { label: "Contact rate (%)", stateKey: "contactRatePct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v) => formatFixedNumber(v, 1) },
    turnoutReliability: { label: "Turnout reliability (%)", stateKey: "turnoutReliabilityPct", clampLo: 0, clampHi: 100, step: 0.1, fmt: (v) => formatFixedNumber(v, 1) },
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
  const surfaceLeverEl = els?.surfaceLever || null;
  const surfaceMinEl = els?.surfaceMin || null;
  const surfaceMaxEl = els?.surfaceMax || null;
  if (!surfaceLeverEl || !surfaceMinEl || !surfaceMaxEl) return;
  const spec = surfaceLeverSpec(surfaceLeverEl.value);
  if (!spec) return;

  const base = surfaceBaselineValue(spec);
  const lo = (base != null) ? (base * 0.8) : spec.clampLo;
  const hi = (base != null) ? (base * 1.2) : spec.clampHi;

  const minV = surfaceClamp(lo, spec.clampLo, spec.clampHi);
  const maxV = surfaceClamp(hi, spec.clampLo, spec.clampHi);

  surfaceMinEl.step = String(spec.step);
  surfaceMaxEl.step = String(spec.step);

  surfaceMinEl.value = String(minV);
  surfaceMaxEl.value = String(maxV);
}

export function renderSurfaceStubCore({ els }){
  const surfaceTbodyEl = els?.surfaceTbody || null;
  if (surfaceTbodyEl){
    surfaceTbodyEl.innerHTML = '<tr><td class="muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td></tr>';
  }
  if (els.surfaceSummary) els.surfaceSummary.textContent = "Compute to see safe zones, cliffs, and diminishing returns.";
  if (els.surfaceStatus) els.surfaceStatus.textContent = "";
}

export function renderSurfaceResultCore({
  els,
  spec,
  result,
  fmtSigned,
}){
  const surfaceTbodyEl = els?.surfaceTbody || null;

  const pts = Array.isArray(result?.points) ? result.points : [];

  if (surfaceTbodyEl){
    surfaceTbodyEl.innerHTML = "";
  }
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
    td1.textContent = formatPercentFromUnit(p.winProb, 1);

    const td2 = document.createElement("td"); td2.className = "num"; td2.textContent = fmtSigned(p.p10);
    const td3 = document.createElement("td"); td3.className = "num"; td3.textContent = fmtSigned(p.p50);
    const td4 = document.createElement("td"); td4.className = "num"; td4.textContent = fmtSigned(p.p90);

    tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    if (surfaceTbodyEl) surfaceTbodyEl.appendChild(tr);
  }

  const targetPercentRaw = Number(els.surfaceTarget?.value);
  const summaryText = buildOutcomeSurfaceSummaryText({
    spec,
    result,
    targetPercent: Number.isFinite(targetPercentRaw) ? targetPercentRaw : 70,
  });
  if (els.surfaceSummary) els.surfaceSummary.textContent = summaryText;
}
