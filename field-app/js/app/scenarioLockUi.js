export function isScenarioLockedForEditsModule(srcState){
  try{
    return !!srcState?.intelState?.workflow?.scenarioLocked;
  } catch {
    return false;
  }
}

export function applyScenarioLockUiModule({ state, root } = {}){
  if (!root) return;

  const locked = isScenarioLockedForEditsModule(state);
  root.classList.toggle("scenario-locked", locked);

  const controls = root.querySelectorAll('input:not([type="hidden"]), select, textarea');
  for (const el of controls){
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.lockExempt === "1" || el.closest("#intelWorkflowCard")) continue;

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

