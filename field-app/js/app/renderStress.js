// @ts-check
export function renderStressModule(args){
  const {
    els,
    res,
  } = args || {};

  const stressBoxEl = els?.stressBox;
  if (!stressBoxEl) return;
  const lines = Array.isArray(res?.stressSummary) ? res.stressSummary : [];
  stressBoxEl.innerHTML = "";
  if (!lines.length){
    const div = document.createElement("div");
    div.className = "stress-item";
    div.textContent = "—";
    stressBoxEl.appendChild(div);
    return;
  }
  for (const s of lines){
    const div = document.createElement("div");
    div.className = "stress-item";
    div.textContent = s;
    stressBoxEl.appendChild(div);
  }
}
