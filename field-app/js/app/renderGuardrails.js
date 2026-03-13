// @ts-check
export function renderGuardrailsModule(args){
  const {
    els,
    res,
    block,
    kv,
  } = args || {};

  const gs = [];
  const guardrails = Array.isArray(res?.guardrails) ? res.guardrails : [];
  for (const g of guardrails){
    gs.push(block(g.title, g.lines.map(l => kv(l.k, l.v))));
  }
  const guardrailsEl = els?.guardrails || null;
  if (guardrailsEl){
    guardrailsEl.innerHTML = "";
    if (!gs.length){
      guardrailsEl.textContent = "—";
      return;
    }
    for (const b of gs) guardrailsEl.appendChild(b);
  }
}
