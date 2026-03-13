// @ts-check
export function renderMcVisualsModule(args){
  const {
    els,
    summary,
    clamp,
    fmtSigned,
  } = args || {};

  const svgWinProbMarkerEl = els?.svgWinProbMarker || null;
  const vizWinProbNoteEl = els?.vizWinProbNote || null;
  const svgMarginBarsEl = els?.svgMarginBars || null;
  const svgMarginZeroEl = els?.svgMarginZero || null;
  const svgMarginMinEl = els?.svgMarginMin || null;
  const svgMarginMaxEl = els?.svgMarginMax || null;
  const svgMarginWinShadeEl = els?.svgMarginWinShade || null;

  if (svgWinProbMarkerEl && vizWinProbNoteEl){
    const p = clamp(summary?.winProb ?? 0, 0, 1);
    const x = 300 * p;
    svgWinProbMarkerEl.setAttribute("cx", x.toFixed(2));
    vizWinProbNoteEl.textContent = `${(p * 100).toFixed(1)}% chance to win (model-based).`;
  }

  const h = summary?.histogram;
  if (svgMarginBarsEl) svgMarginBarsEl.innerHTML = "";
  if (svgMarginWinShadeEl) svgMarginWinShadeEl.innerHTML = "";
  if (!h || !h.counts || !h.counts.length || !isFinite(h.min) || !isFinite(h.max)){
    if (svgMarginMinEl) svgMarginMinEl.textContent = "—";
    if (svgMarginMaxEl) svgMarginMaxEl.textContent = "—";
    if (svgMarginZeroEl){
      svgMarginZeroEl.setAttribute("x1", 150);
      svgMarginZeroEl.setAttribute("x2", 150);
    }
    return;
  }

  if (!svgMarginBarsEl) return;

  const W = 300;
  const baseY = 76;
  const topY = 12;
  const H = (baseY - topY);
  const counts = h.counts;
  const maxC = Math.max(1, ...counts);
  const n = counts.length;
  const bw = W / n;

  const span = (h.max - h.min) || 1;
  const x0 = clamp(((0 - h.min) / span) * W, 0, W);
  if (svgMarginZeroEl){
    svgMarginZeroEl.setAttribute("x1", x0.toFixed(2));
    svgMarginZeroEl.setAttribute("x2", x0.toFixed(2));
  }

  if (svgMarginWinShadeEl && x0 > 0 && x0 < W){
    const shade = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shade.setAttribute("x", x0.toFixed(2));
    shade.setAttribute("y", topY);
    shade.setAttribute("width", (W - x0).toFixed(2));
    shade.setAttribute("height", H);
    shade.setAttribute("class", "viz-winshade");
    svgMarginWinShadeEl.appendChild(shade);
  }

  for (let i = 0; i < n; i++){
    const c = counts[i];
    const bh = (c / maxC) * H;
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", (i * bw + 0.6).toFixed(2));
    r.setAttribute("y", (baseY - bh).toFixed(2));
    r.setAttribute("width", Math.max(0.5, bw - 1.2).toFixed(2));
    r.setAttribute("height", bh.toFixed(2));
    r.setAttribute("class", "viz-bar");
    svgMarginBarsEl.appendChild(r);
  }

  if (svgMarginMinEl) svgMarginMinEl.textContent = fmtSigned(h.min);
  if (svgMarginMaxEl) svgMarginMaxEl.textContent = fmtSigned(h.max);
}
