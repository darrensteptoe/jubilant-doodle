// @ts-check
/**
 * @param {() => void} fn
 * @returns {void}
 */
export function safeCallModule(fn, opts = {}){
  try{
    fn();
    return true;
  } catch (err){
    if (typeof opts?.onError === "function"){
      opts.onError(err, String(opts?.label || ""));
    }
    return false;
  }
}

/**
 * @param {string} stageId
 * @returns {void}
 */
export function switchToStageModule(stageId){
  const id = String(stageId || "").trim();
  if (!id) return;

  const v3NavBridge = window["__FPE_V3_NAV__"];
  if (v3NavBridge?.active && typeof v3NavBridge.navigateStage === "function"){
    const nextStageId =
      typeof v3NavBridge.resolveStageId === "function"
        ? v3NavBridge.resolveStageId(id)
        : id;
    v3NavBridge.navigateStage(nextStageId, { persist: true });
    return;
  }

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
