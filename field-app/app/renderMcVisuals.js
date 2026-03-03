export function renderMcVisualsModule(args){
  const {
    els,
    summary,
    clamp,
    fmtSigned,
  } = args || {};

  if (els.svgWinProbMarker && els.vizWinProbNote){
    const p = clamp(summary?.winProb ?? 0, 0, 1);
    const x = 300 * p;
    els.svgWinProbMarker.setAttribute("cx", x.toFixed(2));
    els.vizWinProbNote.textContent = `${(p * 100).toFixed(1)}% chance to win (model-based).`;
  }

  if (!els.svgMarginBars || !els.svgMarginZero || !els.svgMarginMin || !els.svgMarginMax || !els.svgMarginWinShade) return;
  const h = summary?.histogram;
  els.svgMarginBars.innerHTML = "";
  els.svgMarginWinShade.innerHTML = "";
  if (!h || !h.counts || !h.counts.length || !isFinite(h.min) || !isFinite(h.max)){
    els.svgMarginMin.textContent = "—";
    els.svgMarginMax.textContent = "—";
    els.svgMarginZero.setAttribute("x1", 150);
    els.svgMarginZero.setAttribute("x2", 150);
    return;
  }

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
  els.svgMarginZero.setAttribute("x1", x0.toFixed(2));
  els.svgMarginZero.setAttribute("x2", x0.toFixed(2));

  if (x0 > 0 && x0 < W){
    const shade = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shade.setAttribute("x", x0.toFixed(2));
    shade.setAttribute("y", topY);
    shade.setAttribute("width", (W - x0).toFixed(2));
    shade.setAttribute("height", H);
    shade.setAttribute("class", "viz-winshade");
    els.svgMarginWinShade.appendChild(shade);
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
    els.svgMarginBars.appendChild(r);
  }

  els.svgMarginMin.textContent = fmtSigned(h.min);
  els.svgMarginMax.textContent = fmtSigned(h.max);
}
