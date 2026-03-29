export function syncWarRoomDecisionSessions(view, helpers = {}) {
  const {
    syncSelect,
    syncInput,
    setChecked,
    setDisabled,
    setText,
  } = helpers;

  if (
    typeof syncSelect !== "function"
    || typeof syncInput !== "function"
    || typeof setChecked !== "function"
    || typeof setDisabled !== "function"
    || typeof setText !== "function"
  ) {
    return;
  }

  syncSelect("v3DecisionSessionSelect", view.sessions || [], view.activeSessionId || "");
  syncSelect("v3DecisionObjective", view.objectiveOptions || [], view.session?.objectiveKey || "", "key", "label");
  syncSelect("v3DecisionTurfAccess", view.turfAccessOptions || [], view.session?.constraints?.turfAccess || "", "key", "label");
  syncSelect("v3DecisionRiskPosture", view.riskPostureOptions || [], view.session?.riskPosture || "", "key", "label");
  syncSelect("v3DecisionOptionSelect", view.options || [], view.activeOptionId || "", "id", "displayLabel");
  syncSelect("v3DecisionRecommendSelect", view.options || [], view.recommendedOptionId || "", "id", "displayLabel");

  syncInput("v3DecisionRename", view.session?.name || "");
  syncInput("v3DecisionNotes", view.session?.notes || "");
  syncInput("v3DecisionBudget", view.session?.constraints?.budget || "");
  syncInput("v3DecisionVolunteerHrs", view.session?.constraints?.volunteerHrs || "");
  syncInput("v3DecisionBlackoutDates", view.session?.constraints?.blackoutDates || "");
  syncInput("v3DecisionNonNegotiables", view.session?.nonNegotiablesText || "");
  syncInput("v3DecisionOptionRename", view.activeOption?.label || "");
  syncInput("v3DecisionWhatTrue", view.whatNeedsTrueText || "");
  syncInput("v3DecisionWatchItems", view.warRoom?.watchItemsText || "");
  syncInput("v3DecisionDecisionItems", view.warRoom?.decisionItemsText || "");
  syncInput("v3DecisionOwner", view.warRoom?.owner || "");
  syncInput("v3DecisionFollowUpDate", view.warRoom?.followUpDate || "");
  syncInput("v3DecisionDecisionSummary", view.warRoom?.decisionSummary || "");
  syncInput("v3DecisionSummaryPreview", view.summaryPreview || "");

  setChecked("v3DecisionOptionTacticDoors", !!view.activeOption?.tactics?.doors);
  setChecked("v3DecisionOptionTacticPhones", !!view.activeOption?.tactics?.phones);
  setChecked("v3DecisionOptionTacticDigital", !!view.activeOption?.tactics?.digital);

  const hasSession = !!view.session;
  const hasOption = !!view.activeOption;

  setDisabled("v3BtnDecisionRenameSave", !hasSession);
  setDisabled("v3BtnDecisionDelete", !view.canDeleteSession);
  setDisabled("v3BtnDecisionLinkScenario", !hasSession);
  setDisabled("v3DecisionObjective", !hasSession);
  setDisabled("v3DecisionNotes", !hasSession);
  setDisabled("v3DecisionBudget", !hasSession);
  setDisabled("v3DecisionVolunteerHrs", !hasSession);
  setDisabled("v3DecisionTurfAccess", !hasSession);
  setDisabled("v3DecisionBlackoutDates", !hasSession);
  setDisabled("v3DecisionRiskPosture", !hasSession);
  setDisabled("v3DecisionNonNegotiables", !hasSession);
  setDisabled("v3DecisionOptionSelect", !hasSession || !(view.options || []).length);
  setDisabled("v3DecisionOptionRename", !hasOption);
  setDisabled("v3BtnDecisionOptionRenameSave", !hasOption);
  setDisabled("v3BtnDecisionOptionDelete", !view.canDeleteOption);
  setDisabled("v3BtnDecisionOptionLinkScenario", !hasOption);
  setDisabled("v3DecisionOptionTacticDoors", !hasOption);
  setDisabled("v3DecisionOptionTacticPhones", !hasOption);
  setDisabled("v3DecisionOptionTacticDigital", !hasOption);
  setDisabled("v3DecisionRecommendSelect", !hasSession || !(view.options || []).length);
  setDisabled("v3DecisionWhatTrue", !hasSession);
  setDisabled("v3DecisionWatchItems", !hasSession);
  setDisabled("v3DecisionDecisionItems", !hasSession);
  setDisabled("v3DecisionOwner", !hasSession);
  setDisabled("v3DecisionFollowUpDate", !hasSession);
  setDisabled("v3DecisionDecisionSummary", !hasSession);
  setDisabled("v3BtnDecisionLogDecision", !hasSession);

  setText("v3DecisionActiveLabel", view.activeSessionLabel || "Active session: —");
  setText("v3DecisionScenarioLabel", view.session?.scenarioLabel || "—");
  setText("v3DecisionOptionScenarioLabel", view.activeOption?.scenarioLabel || "—");
  setText("v3DecisionCopyStatus", view.copyStatus || "");
}

export function bindWarRoomDecisionSessionEvents(context = {}) {
  const {
    run,
    on,
    valueOf,
    checkedOf,
    confirmThenRun,
  } = context;

  if (
    typeof run !== "function"
    || typeof on !== "function"
    || typeof valueOf !== "function"
    || typeof checkedOf !== "function"
    || typeof confirmThenRun !== "function"
  ) {
    return;
  }

  on("v3DecisionSessionSelect", "change", () => run((api) => api.selectSession?.(valueOf("v3DecisionSessionSelect"))));
  on("v3BtnDecisionNew", "click", () => run((api) => api.createSession?.("")));
  on("v3BtnDecisionRenameSave", "click", () => run((api) => api.renameSession?.(valueOf("v3DecisionRename"))));
  on("v3BtnDecisionDelete", "click", () => confirmThenRun("Delete active decision session?", (api) => api.deleteSession?.()));
  on("v3BtnDecisionLinkScenario", "click", () => run((api) => api.linkSessionToActiveScenario?.()));

  on("v3DecisionObjective", "change", () => run((api) => api.updateSessionField?.("objectiveKey", valueOf("v3DecisionObjective"))));
  on("v3DecisionNotes", "input", () => run((api) => api.updateSessionField?.("notes", valueOf("v3DecisionNotes"))));
  on("v3DecisionBudget", "input", () => run((api) => api.updateSessionField?.("budget", valueOf("v3DecisionBudget"))));
  on("v3DecisionVolunteerHrs", "input", () => run((api) => api.updateSessionField?.("volunteerHrs", valueOf("v3DecisionVolunteerHrs"))));
  on("v3DecisionTurfAccess", "change", () => run((api) => api.updateSessionField?.("turfAccess", valueOf("v3DecisionTurfAccess"))));
  on("v3DecisionBlackoutDates", "input", () => run((api) => api.updateSessionField?.("blackoutDates", valueOf("v3DecisionBlackoutDates"))));
  on("v3DecisionRiskPosture", "change", () => run((api) => api.updateSessionField?.("riskPosture", valueOf("v3DecisionRiskPosture"))));
  on("v3DecisionNonNegotiables", "input", () => run((api) => api.updateSessionField?.("nonNegotiables", valueOf("v3DecisionNonNegotiables"))));

  on("v3DecisionOptionSelect", "change", () => run((api) => api.selectOption?.(valueOf("v3DecisionOptionSelect"))));
  on("v3BtnDecisionOptionNew", "click", () => run((api) => api.createOption?.("")));
  on("v3BtnDecisionOptionRenameSave", "click", () => run((api) => api.renameOption?.(valueOf("v3DecisionOptionRename"))));
  on("v3BtnDecisionOptionDelete", "click", () => confirmThenRun("Delete active decision option?", (api) => api.deleteOption?.()));
  on("v3BtnDecisionOptionLinkScenario", "click", () => run((api) => api.linkOptionToActiveScenario?.()));

  on("v3DecisionOptionTacticDoors", "change", () => run((api) => api.setOptionTactic?.("doors", checkedOf("v3DecisionOptionTacticDoors"))));
  on("v3DecisionOptionTacticPhones", "change", () => run((api) => api.setOptionTactic?.("phones", checkedOf("v3DecisionOptionTacticPhones"))));
  on("v3DecisionOptionTacticDigital", "change", () => run((api) => api.setOptionTactic?.("digital", checkedOf("v3DecisionOptionTacticDigital"))));

  on("v3DecisionRecommendSelect", "change", () => run((api) => api.setRecommendedOption?.(valueOf("v3DecisionRecommendSelect"))));
  on("v3DecisionWhatTrue", "input", () => run((api) => api.setWhatNeedsTrue?.(valueOf("v3DecisionWhatTrue"))));
  on("v3DecisionWatchItems", "input", () => run((api) => api.updateSessionField?.("warRoomWatchItems", valueOf("v3DecisionWatchItems"))));
  on("v3DecisionDecisionItems", "input", () => run((api) => api.updateSessionField?.("warRoomDecisionItems", valueOf("v3DecisionDecisionItems"))));
  on("v3DecisionOwner", "input", () => run((api) => api.updateSessionField?.("warRoomOwner", valueOf("v3DecisionOwner"))));
  on("v3DecisionFollowUpDate", "change", () => run((api) => api.updateSessionField?.("warRoomFollowUpDate", valueOf("v3DecisionFollowUpDate"))));
  on("v3DecisionDecisionSummary", "input", () => run((api) => api.updateSessionField?.("warRoomDecisionSummary", valueOf("v3DecisionDecisionSummary"))));

  on("v3BtnDecisionLogDecision", "click", () => run((api) => api.logDecision?.()));
  on("v3BtnDecisionCopyMd", "click", () => run((api) => api.copySummary?.("markdown")));
  on("v3BtnDecisionCopyText", "click", () => run((api) => api.copySummary?.("text")));
  on("v3BtnDecisionDownloadJson", "click", () => run((api) => api.downloadSummaryJson?.()));
}
