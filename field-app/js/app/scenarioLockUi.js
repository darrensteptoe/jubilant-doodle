// @ts-check
/**
 * @param {Record<string, any>} srcState
 */
export function isScenarioLockedForEditsModule(srcState){
  try{
    const raw = srcState?.intelState?.workflow?.scenarioLocked;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw !== 0 : false;
    if (typeof raw === "string"){
      const text = raw.trim().toLowerCase();
      if (!text) return false;
      if (text === "false" || text === "0" || text === "no" || text === "off" || text === "n") return false;
      if (text === "true" || text === "1" || text === "yes" || text === "on" || text === "y") return true;
      return false;
    }
    return !!raw;
  } catch {
    return false;
  }
}

/**
 * @param {{ state?: Record<string, any>, root?: HTMLElement | null }=} args
 */
export function applyScenarioLockUiModule({ state, root } = {}){
  if (!root) return;

  const locked = isScenarioLockedForEditsModule(state);
  root.classList.toggle("scenario-locked", locked);
  const isLockExempt = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.dataset.lockExempt === "1" || el.closest("#intelWorkflowCard")) {
      return true;
    }
    const id = String(el.id || "").trim();
    return id === "censusMapQaVtdToggle" || id === "censusMapQaVtdZip";
  };

  const controls = root.querySelectorAll('input:not([type="hidden"]), select, textarea');
  for (const el of controls){
    if (!(el instanceof HTMLElement)) continue;
    if (isLockExempt(el)){
      if (el.dataset.lockManaged === "1"){
        el.removeAttribute("disabled");
        delete el.dataset.lockManaged;
      }
      continue;
    }

    if (locked){
      if (el.hasAttribute("disabled")) continue;
      el.setAttribute("disabled", "disabled");
      el.dataset.lockManaged = "1";
      continue;
    }

    if (el.dataset.lockManaged === "1"){
      el.removeAttribute("disabled");
      delete el.dataset.lockManaged;
    }
  }
}
