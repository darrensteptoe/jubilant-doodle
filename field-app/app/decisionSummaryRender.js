export function renderDecisionSummaryPanelCore({
  els,
  session,
  decisionOptionDisplay,
  buildDecisionSummaryText,
}){
  if (!session) return;

  if (els.decisionRecommendSelect){
    els.decisionRecommendSelect.innerHTML = "";
    const options = (session.options && typeof session.options === "object") ? Object.values(session.options) : [];
    options.sort((a, b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "—";
    els.decisionRecommendSelect.appendChild(ph);
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = decisionOptionDisplay(o);
      els.decisionRecommendSelect.appendChild(opt);
    }
    els.decisionRecommendSelect.value = session.recommendedOptionId || "";
  }

  if (els.decisionWhatTrue){
    const lines = Array.isArray(session.whatNeedsTrue) ? session.whatNeedsTrue : [];
    els.decisionWhatTrue.value = lines.join("\n");
  }

  if (els.decisionSummaryPreview){
    els.decisionSummaryPreview.value = buildDecisionSummaryText(session);
  }
}
