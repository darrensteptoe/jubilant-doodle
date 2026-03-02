export function createUiUpdateQueue(ctx){
  const {
    render,
    persist,
    debounceMs = 220,
    getWindow = () => (typeof window !== "undefined" ? window : null),
  } = ctx || {};

  let renderQueued = false;
  let persistQueuedTimer = null;

  const scheduleRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    const flush = () => {
      renderQueued = false;
      render();
    };
    const win = getWindow();
    if (win && typeof win.requestAnimationFrame === "function"){
      win.requestAnimationFrame(flush);
      return;
    }
    setTimeout(flush, 0);
  };

  const schedulePersist = ({ immediate = false } = {}) => {
    if (immediate){
      if (persistQueuedTimer){
        clearTimeout(persistQueuedTimer);
        persistQueuedTimer = null;
      }
      persist();
      return;
    }
    if (persistQueuedTimer) clearTimeout(persistQueuedTimer);
    persistQueuedTimer = setTimeout(() => {
      persistQueuedTimer = null;
      persist();
    }, debounceMs);
  };

  const commitUIUpdate = ({ render: doRender = true, persist: doPersist = true, immediatePersist = false } = {}) => {
    if (doRender) scheduleRender();
    if (doPersist) schedulePersist({ immediate: immediatePersist });
  };

  return { scheduleRender, schedulePersist, commitUIUpdate };
}
