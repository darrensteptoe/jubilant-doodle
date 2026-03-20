// @ts-check

const INTEL_API_KEY = "__FPE_INTELLIGENCE_API__";

export const INTEL_SELECT_OPTION_MESSAGE_MAP = Object.freeze({
  v3DistrictUndecidedMode: Object.freeze({
    proportional: "undecidedModeProportional",
    against: "undecidedModeAgainst",
    user_defined: "undecidedModeUserDefined",
    toward: "undecidedModeProportional",
    even: "undecidedModeProportional",
  }),
  v3TurnoutMode: Object.freeze({
    basic: "gotvModeBasic",
    simple: "gotvModeBasic",
    advanced: "gotvModeAdvanced",
  }),
  v3ReachCapOverrideMode: Object.freeze({
    baseline: "capacityOverrideBaseline",
    ramp: "capacityOverrideRamp",
    scheduled: "capacityOverrideScheduled",
    max: "capacityOverrideMax",
  }),
  v3DataVoterAdapter: Object.freeze({
    canonical: "voterAdapterCanonicalV1",
  }),
});

export const INTEL_WARNING_MESSAGE_BY_ID = Object.freeze({
  v3DistrictCandWarn: "ballotBaselineConflict",
  v3DistrictStructureWarn: "electorateStructureNormalization",
  v3DataWarnBannerUi: "strictImportEnabled",
  v3DataHashBannerUi: "strictImportEnabled",
  v3ReachWkBanner: "capacityGapWarning",
  v3ReachWkExecBanner: "executionGapWarning",
  v3TurnoutRoiBanner: "turnoutRoiNeedsRefresh",
  v3TurnoutStatusBanner: "turnoutStatusContext",
});

let INTERACTIONS_INSTALLED = false;

function clean(value){
  return String(value == null ? "" : value).trim();
}

function normalizeToken(value){
  return clean(value).toLowerCase();
}

function isSummaryInteractiveElement(el){
  if (!(el instanceof Element)) return false;
  if (typeof HTMLSummaryElement !== "undefined"){
    return el instanceof HTMLSummaryElement;
  }
  return String(el.tagName || "").toLowerCase() === "summary";
}

function isNativeInteractive(el){
  return (
    el instanceof HTMLButtonElement
    || el instanceof HTMLAnchorElement
    || el instanceof HTMLInputElement
    || el instanceof HTMLSelectElement
    || el instanceof HTMLTextAreaElement
    || isSummaryInteractiveElement(el)
  );
}

function markIntelAnchor(el){
  if (!(el instanceof HTMLElement)) return;
  el.classList.add("fpe-intel-anchor");
  if (isNativeInteractive(el)) return;
  if (!el.hasAttribute("role")){
    el.setAttribute("role", "button");
    el.setAttribute("data-intel-auto-role", "1");
  }
  if (el.tabIndex < 0){
    el.tabIndex = 0;
    el.setAttribute("data-intel-auto-tabindex", "1");
  }
}

function clearIntelAnchor(el){
  if (!(el instanceof HTMLElement)) return;
  el.classList.remove("fpe-intel-anchor");
  if (el.getAttribute("data-intel-auto-role") === "1"){
    el.removeAttribute("role");
    el.removeAttribute("data-intel-auto-role");
  }
  if (el.getAttribute("data-intel-auto-tabindex") === "1"){
    el.removeAttribute("tabindex");
    el.removeAttribute("data-intel-auto-tabindex");
  }
}

function findIntelApi(){
  const api = window[INTEL_API_KEY];
  if (!api || typeof api !== "object") return null;
  return api;
}

function openIntelByType(type, id){
  const api = findIntelApi();
  if (!api) return false;
  const normalizedType = normalizeToken(type);
  const normalizedId = clean(id);
  if (!normalizedId) return false;
  if (normalizedType === "glossary" && typeof api.openGlossary === "function"){
    api.openGlossary(normalizedId);
    return true;
  }
  if (normalizedType === "module" && typeof api.openModule === "function"){
    api.openModule(normalizedId);
    return true;
  }
  if (normalizedType === "model" && typeof api.openModel === "function"){
    api.openModel(normalizedId);
    return true;
  }
  if (normalizedType === "message" && typeof api.openMessage === "function"){
    api.openMessage(normalizedId);
    return true;
  }
  if (normalizedType === "playbook" && typeof api.openPlaybook === "function"){
    api.openPlaybook(normalizedId);
    return true;
  }
  return false;
}

function resolveAnchorIntent(el){
  if (!(el instanceof HTMLElement)) return null;
  const modelId = clean(el.getAttribute("data-intel-model"));
  if (modelId) return { type: "model", id: modelId };
  const playbookId = clean(el.getAttribute("data-intel-playbook"));
  if (playbookId) return { type: "playbook", id: playbookId };
  const glossaryId = clean(el.getAttribute("data-intel-glossary"));
  if (glossaryId) return { type: "glossary", id: glossaryId };
  const messageId = clean(el.getAttribute("data-intel-message"));
  if (messageId) return { type: "message", id: messageId };
  const moduleId = clean(el.getAttribute("data-intel-module"));
  if (moduleId) return { type: "module", id: moduleId };
  return null;
}

function handleAnchorAction(target){
  const anchor = target instanceof HTMLElement
    ? target.closest("[data-intel-model], [data-intel-playbook], [data-intel-glossary], [data-intel-message], [data-intel-module]")
    : null;
  if (!(anchor instanceof HTMLElement)) return false;
  const intent = resolveAnchorIntent(anchor);
  if (!intent) return false;
  return openIntelByType(intent.type, intent.id);
}

function resolveSelectMessageId(select, mapping){
  if (!(select instanceof HTMLSelectElement)) return "";
  const src = (mapping && typeof mapping === "object") ? mapping : {};
  const selected = select.selectedOptions && select.selectedOptions.length
    ? select.selectedOptions[0]
    : null;
  const optionMessage = clean(selected?.getAttribute("data-intel-message"));
  if (optionMessage) return optionMessage;
  const value = normalizeToken(select.value);
  return clean(src[value]);
}

function syncSelectOptionMessages(select, mapping){
  if (!(select instanceof HTMLSelectElement)) return;
  const src = (mapping && typeof mapping === "object") ? mapping : {};
  Array.from(select.options).forEach((option) => {
    const value = normalizeToken(option.value);
    const messageId = clean(src[value]);
    if (messageId){
      option.setAttribute("data-intel-message", messageId);
    } else {
      option.removeAttribute("data-intel-message");
    }
  });
}

function ensureSelectHelpButton(select, mapping){
  if (!(select instanceof HTMLSelectElement) || !clean(select.id)) return;
  const field = select.closest(".field");
  if (!(field instanceof HTMLElement)) return;
  const buttonId = `${select.id}__intelHelpBtn`;
  let button = field.querySelector(`#${buttonId}`);
  if (!(button instanceof HTMLButtonElement)){
    button = document.createElement("button");
    button.type = "button";
    button.id = buttonId;
    button.className = "fpe-intel-select-help";
    button.textContent = "Explain selected option";
    field.appendChild(button);
    button.addEventListener("click", () => {
      const messageId = resolveSelectMessageId(select, mapping);
      if (!messageId) return;
      openIntelByType("message", messageId);
    });
  }
  markIntelAnchor(button);
  button.disabled = !resolveSelectMessageId(select, mapping);
}

function bindSelectOptionMap(select, mapping){
  if (!(select instanceof HTMLSelectElement)) return;
  syncSelectOptionMessages(select, mapping);
  ensureSelectHelpButton(select, mapping);
  if (select.dataset.intelOptionMapBound === "1") return;
  select.dataset.intelOptionMapBound = "1";
  select.addEventListener("change", () => {
    const messageId = resolveSelectMessageId(select, mapping);
    if (!messageId) return;
    openIntelByType("message", messageId);
    ensureSelectHelpButton(select, mapping);
  });
}

function syncSelectBindings(){
  for (const [selectId, mapping] of Object.entries(INTEL_SELECT_OPTION_MESSAGE_MAP)){
    const select = document.getElementById(selectId);
    if (!(select instanceof HTMLSelectElement)) continue;
    bindSelectOptionMap(select, mapping);
  }
}

function syncWarningBindings(){
  for (const [id, messageId] of Object.entries(INTEL_WARNING_MESSAGE_BY_ID)){
    const el = document.getElementById(id);
    if (!(el instanceof HTMLElement)) continue;
    const hasVisibleText = !el.hidden && !!clean(el.textContent);
    if (!hasVisibleText){
      if (clean(el.getAttribute("data-intel-message")) === clean(messageId)){
        el.removeAttribute("data-intel-message");
        clearIntelAnchor(el);
      }
      continue;
    }
    el.setAttribute("data-intel-message", clean(messageId));
    markIntelAnchor(el);
  }
}

function syncExplicitAnchors(){
  document
    .querySelectorAll("[data-intel-model], [data-intel-playbook], [data-intel-glossary], [data-intel-message], [data-intel-module]")
    .forEach((node) => markIntelAnchor(node));
}

function handleRootClick(event){
  const target = event?.target;
  if (!(target instanceof HTMLElement)) return;
  handleAnchorAction(target);
}

function handleRootKeydown(event){
  const target = event?.target;
  if (!(target instanceof HTMLElement)) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  const handled = handleAnchorAction(target);
  if (handled){
    event.preventDefault();
  }
}

export function refreshIntelligenceInteractions(){
  syncExplicitAnchors();
  syncWarningBindings();
  syncSelectBindings();
}

export function installIntelligenceInteractions(){
  if (!INTERACTIONS_INSTALLED){
    document.addEventListener("click", handleRootClick);
    document.addEventListener("keydown", handleRootKeydown);
    INTERACTIONS_INSTALLED = true;
  }
  refreshIntelligenceInteractions();
}
