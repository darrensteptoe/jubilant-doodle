// @ts-check
export function renderGuardrailsModule(args){
  const {
    els,
    res,
    block,
    kv,
  } = args || {};

  const gs = [];
  for (const g of res.guardrails){
    gs.push(block(g.title, g.lines.map(l => kv(l.k, l.v))));
  }
  if (!els.guardrails) return;
  els.guardrails.innerHTML = "";
  if (!gs.length){
    els.guardrails.textContent = "—";
    return;
  }
  for (const b of gs) els.guardrails.appendChild(b);
}
