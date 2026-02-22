const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const setStage = (stage) => {
  const nav = $$(".nav-item-new[data-stage]");
  const panels = $$(".stage-new[data-stage]");
  nav.forEach(b => b.classList.toggle("active", b.dataset.stage === stage));
  panels.forEach(p => p.classList.toggle("active-stage", p.dataset.stage === stage));
  try { history.replaceState(null, "", `#${stage}`); } catch {}
};

const init = () => {
  const navButtons = $$(".nav-item-new[data-stage]");
  navButtons.forEach(b => b.addEventListener("click", () => setStage(b.dataset.stage)));

  const initial = (location.hash || "").replace("#", "") || "inputs";
  const exists = $$(".stage-new[data-stage]").some(p => p.dataset.stage === initial);
  setStage(exists ? initial : "inputs");
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
