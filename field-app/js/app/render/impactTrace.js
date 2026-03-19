// @ts-check
import { buildImpactTraceItemsView } from "../../core/impactTraceView.js";

function appendLine(parent, label, value){
  const div = document.createElement("div");
  div.className = "impact-trace-line";
  div.textContent = `${label}: ${value}`;
  parent.appendChild(div);
}

export function renderImpactTracePanel({
  els,
  state,
  res,
  weeks,
  fmtInt,
  weeklyContext = null,
  executionSnapshot = null,
}){
  if (!els?.impactTraceList) return;

  const list = els.impactTraceList;
  list.innerHTML = "";

  const items = buildImpactTraceItemsView({
    state: state || {},
    res: res || {},
    weeks: Number.isFinite(Number(weeks)) ? Number(weeks) : 0,
    fmtInt,
    weeklyContext,
    executionSnapshot,
  });

  for (const item of items){
    const box = document.createElement("section");
    box.className = "impact-trace-item";

    const head = document.createElement("div");
    head.className = "impact-trace-head";

    const title = document.createElement("span");
    title.textContent = item.title;
    head.appendChild(title);

    const value = document.createElement("span");
    value.className = "impact-trace-value";
    value.textContent = item.value;
    head.appendChild(value);

    box.appendChild(head);
    appendLine(box, "Cells", item.outputs);
    if (item.explain){
      appendLine(box, "Formula", item.explain.formula);
      appendLine(box, "Upstream inputs", item.explain.upstream);
      appendLine(box, "Depends on", item.explain.dependsOn);
      appendLine(box, "Explain note", item.explain.note);
      appendLine(box, "Downstream effects", item.downstream);
    } else {
      appendLine(box, "Formula", item.formula);
      appendLine(box, "Upstream inputs", item.upstream);
      appendLine(box, "Downstream effects", item.downstream);
    }

    list.appendChild(box);
  }
}
