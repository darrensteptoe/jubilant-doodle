// @ts-check
/**
 * @param {() => void} fn
 * @returns {void}
 */
export function safeCallModule(fn){
  try{
    fn();
  } catch {
    // keep UI alive
  }
}

/**
 * @param {string} stageId
 * @returns {void}
 */
export function switchToStageModule(stageId){
  const id = String(stageId || "").trim();
  if (!id) return;
  const btn = document.querySelector(`.nav-item-new[data-stage="${id}"]`);
  if (btn && typeof window.switchStage === "function"){
    window.switchStage(btn, id);
    return;
  }
  document.querySelectorAll(".nav-item-new").forEach((el) => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.querySelectorAll(".stage-new").forEach((el) => el.classList.remove("active-stage"));
  const target = document.getElementById(`stage-${id}`);
  if (target) target.classList.add("active-stage");
}
