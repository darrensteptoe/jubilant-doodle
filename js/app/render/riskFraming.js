export function renderRiskFramingPanel({ els, state, setTextPair, fmtSigned, clamp }){
  if (!els.riskBandTag || !els.riskWinProb || !els.riskMarginBand || !els.riskVolatility || !els.riskPlainBanner) return;

  const setTag = (label, cls) => {
    setTextPair(els.riskBandTag, els.riskBandTagSidebar, label || "—");
    els.riskBandTag.classList.remove("ok", "warn", "bad");
    if (cls) els.riskBandTag.classList.add(cls);
  };

  const setBanner = (text, cls) => {
    els.riskPlainBanner.className = `banner ${cls || ""}`.trim();
    els.riskPlainBanner.textContent = text || "—";
  };

  const s = state.mcLast;
  if (!s){
    setTag("—", null);
    setTextPair(els.riskWinProb, els.riskWinProbSidebar, "—");
    setTextPair(els.riskMarginBand, els.riskMarginBandSidebar, "—");
    setTextPair(els.riskVolatility, els.riskVolatilitySidebar, "—");
    setBanner("Run Monte Carlo to populate risk framing.", "warn");
    return;
  }

  const p = clamp(Number(s.winProb ?? 0), 0, 1);
  setTextPair(els.riskWinProb, els.riskWinProbSidebar, `${(p * 100).toFixed(1)}%`);

  const ce = s.confidenceEnvelope;
  const lo = (ce?.percentiles?.p10 != null) ? Number(ce.percentiles.p10) : (s.p5 != null ? Number(s.p5) : null);
  const hi = (ce?.percentiles?.p90 != null) ? Number(ce.percentiles.p90) : (s.p95 != null ? Number(s.p95) : null);
  const mid = (ce?.percentiles?.p50 != null) ? Number(ce.percentiles.p50) : (s.median != null ? Number(s.median) : null);

  const fmtBand = (a, b, m) => {
    if (a == null || b == null || !isFinite(a) || !isFinite(b)) return "—";
    const mtxt = (m == null || !isFinite(m)) ? "" : ` (p50: ${fmtSigned(m)})`;
    return `${fmtSigned(a)} to ${fmtSigned(b)}${mtxt}`;
  };

  setTextPair(els.riskMarginBand, els.riskMarginBandSidebar, fmtBand(lo, hi, mid));

  const span = (lo == null || hi == null || !isFinite(lo) || !isFinite(hi)) ? null : Math.abs(hi - lo);
  let volClass = "—";
  if (span != null && isFinite(span)){
    if (span <= 2) volClass = "Low";
    else if (span <= 5) volClass = "Medium";
    else volClass = "High";
  }
  setTextPair(els.riskVolatility, els.riskVolatilitySidebar, (span == null || !isFinite(span)) ? "—" : `${volClass} (±${(span / 2).toFixed(1)} pts)`);

  const dir = (p >= 0.5) ? "win" : "loss";
  const volHigh = (volClass === "High");

  let band = "Volatile";
  let cls = "bad";
  if (!volHigh && p >= 0.75){
    band = "High confidence";
    cls = "ok";
  } else if (!volHigh && p >= 0.60){
    band = "Lean";
    cls = "warn";
  }

  setTag(band, cls);

  const marginLine = (mid == null || !isFinite(mid))
    ? ""
    : `Expected margin (p50): ${fmtSigned(mid)}.`;

  let plain = "";
  if (band === "High confidence"){
    plain = `Model indicates ${(p * 100).toFixed(0)}% chance to ${dir}. ${marginLine} Volatility: ${volClass}.`;
  } else if (band === "Lean"){
    plain = `Leaning ${dir}: ${(p * 100).toFixed(0)}% model win chance. ${marginLine} Volatility: ${volClass}.`;
  } else {
    plain = `Volatile outlook: ${(p * 100).toFixed(0)}% model win chance. Small changes in execution or assumptions can swing outcomes. ${marginLine} Volatility: ${volClass}.`;
  }

  setBanner(plain, cls);
}
