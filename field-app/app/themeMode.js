export function systemPrefersDarkModule(){
  try{
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch {
    return false;
  }
}

export function normalizeThemeModeModule(state){
  if (!state.ui) state.ui = {};
  if (state.ui.themeMode !== "system" && state.ui.themeMode !== "dark" && state.ui.themeMode !== "light"){
    state.ui.themeMode = (state.ui.dark === true) ? "dark" : "system";
  }
}

export function computeThemeIsDarkModule(state, systemPrefersDark){
  const mode = state.ui?.themeMode || "system";
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark();
}

export function applyThemeFromStateModule(state, els, normalizeThemeMode, computeThemeIsDark){
  normalizeThemeMode();
  const isDark = computeThemeIsDark();

  document.body.classList.toggle("dark", !!isDark);

  if (els.toggleDark){
    els.toggleDark.checked = (state.ui.themeMode === "dark");
  }

  state.ui.dark = !!isDark;
}

export function initThemeSystemListenerModule(state, applyThemeFromState){
  try{
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((state.ui?.themeMode || "system") === "system"){
        applyThemeFromState();
      }
    };
    if (mq && mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq && mq.addListener) mq.addListener(handler);
  } catch {}
}
