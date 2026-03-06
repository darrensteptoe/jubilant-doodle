export function withPatchedStateModule({
  getStateSnapshot,
  getState,
  setState,
  syncFeatureFlagsFromState,
  patch,
  fn,
} = {}){
  const prev = getStateSnapshot();
  const patchHasFeatures = !!(
    patch &&
    typeof patch === "object" &&
    patch.features &&
    typeof patch.features === "object" &&
    !Array.isArray(patch.features)
  );
  const merge = (target, src) => {
    if (!src || typeof src !== "object") return;
    for (const k of Object.keys(src)){
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v)){
        if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
        merge(target[k], v);
      } else {
        target[k] = v;
      }
    }
  };
  try{
    const current = getState();
    merge(current, patch || {});
    syncFeatureFlagsFromState(current, { preferFeatures: patchHasFeatures });
    return fn();
  } finally {
    setState(prev);
  }
}
