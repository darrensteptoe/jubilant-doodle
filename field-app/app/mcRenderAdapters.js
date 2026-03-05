export function fmtSignedModule(v, fmtInt){
  if (v == null || !isFinite(v)) return "—";
  const n = Math.round(v);
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtInt(Math.abs(n))}`;
}

export function renderMcVisualsAdapterModule(args){
  const {
    renderMcVisualsModule,
    els,
    summary,
    clamp,
    fmtSigned,
  } = args || {};
  return renderMcVisualsModule({ els, summary, clamp, fmtSigned });
}

export function renderMcResultsAdapterModule(args){
  const {
    renderMcResultsModule,
    els,
    summary,
    setTextPair,
    fmtSigned,
    fmtInt,
    renderMcVisuals,
  } = args || {};
  return renderMcResultsModule({
    els,
    summary,
    setTextPair,
    fmtSigned,
    fmtInt,
    renderMcVisuals,
  });
}
