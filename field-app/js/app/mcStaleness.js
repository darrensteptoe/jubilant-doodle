export function getMcStaleness(args){
  const {
    state,
    res,
    weeks,
    hashMcInputs,
    computeDailyLogHash,
  } = args || {};

  if (!state || !state.mcLast){
    return {
      hasRun: false,
      isStale: false,
      inputsChanged: false,
      executionUpdated: false,
      reasonCode: "",
      reasonText: "",
    };
  }

  const meta = (state.ui && state.ui.mcMeta && typeof state.ui.mcMeta === "object")
    ? state.ui.mcMeta
    : null;

  if (!meta || !res || !hashMcInputs || !computeDailyLogHash){
    return {
      hasRun: true,
      isStale: false,
      inputsChanged: false,
      executionUpdated: false,
      reasonCode: "",
      reasonText: "",
    };
  }

  const nowHash = String(hashMcInputs(res, weeks));
  const inputsAtRun = meta.inputsHash ? String(meta.inputsHash) : String(state.mcLastHash || "");
  const logAtRun = meta.dailyLogHash ? String(meta.dailyLogHash) : "";
  const logNow = String(computeDailyLogHash());

  const inputsChanged = !!inputsAtRun && inputsAtRun !== nowHash;
  const executionUpdated = !!logAtRun && logAtRun !== logNow;
  const isStale = inputsChanged || executionUpdated;

  let reasonCode = "";
  let reasonText = "";
  if (inputsChanged && executionUpdated){
    reasonCode = "inputs_and_execution";
    reasonText = "inputs and execution updates changed since last MC run";
  } else if (inputsChanged){
    reasonCode = "inputs";
    reasonText = "inputs changed since last MC run";
  } else if (executionUpdated){
    reasonCode = "execution";
    reasonText = "execution updates changed since last MC run";
  }

  return {
    hasRun: true,
    isStale,
    inputsChanged,
    executionUpdated,
    reasonCode,
    reasonText,
  };
}
