// @ts-check
export function renderGuardrailsModule(args){
  const {
    els,
    res,
    block,
    kv,
    governance = null,
  } = args || {};

  const gs = [];
  const guardrails = Array.isArray(res?.guardrails) ? res.guardrails : [];
  for (const g of guardrails){
    gs.push(block(g.title, g.lines.map(l => kv(l.k, l.v))));
  }
  const governanceGuardrails = Array.isArray(governance?.guardrails) ? governance.guardrails : [];
  for (const g of governanceGuardrails){
    const lines = Array.isArray(g?.lines) ? g.lines : [];
    gs.push(block(String(g?.title || "Governance"), lines.map((line) => kv(line.k, line.v))));
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
