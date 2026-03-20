// @ts-check
/** @param {import("./types").InitTabsCtx} ctx */
export function initTabsModule(ctx){
  const { state } = ctx || {};
  const requested = state?.ui?.activeTab || "win";
  const tab = document.getElementById(`tab-${requested}`) ? requested : "win";
  if (state?.ui) state.ui.activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
}

/** @param {import("./types").InitExplainCardCtx} ctx */
export function initExplainCardModule(ctx){
  const { els, state } = ctx || {};
  if (!els?.explainCard) return;
  const playbookEnabled = (state?.ui && typeof state.ui === "object" && Object.prototype.hasOwnProperty.call(state.ui, "playbook"))
    ? !!state.ui.playbook
    : !!state?.ui?.training;
  els.explainCard.hidden = !playbookEnabled;
}

export function isDevModeModule(){
  try{
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("dev") === "1") return true;
  } catch {}
  try{
    return localStorage.getItem("devMode") === "1";
  } catch {
    return false;
  }
}
