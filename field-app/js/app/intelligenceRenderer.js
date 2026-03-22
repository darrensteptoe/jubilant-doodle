// @ts-check
import { reduceIntelligenceState, makeDefaultIntelligenceState, normalizeIntelligenceState } from "./intelligenceState.js";
import { resolveIntelligencePayload } from "./intelligenceResolver.js";

const PANEL_ID = "v3IntelligencePanel";
const SHELL_API_KEY = "__FPE_SHELL_API__";
const INTEL_API_KEY = "__FPE_INTELLIGENCE_API__";

/** @type {{
 *   slot: HTMLElement | null,
 *   panel: HTMLElement | null,
 *   state: ReturnType<typeof makeDefaultIntelligenceState>,
 * } | null} */
let CONTROLLER = null;

function clean(value){
  return String(value == null ? "" : value).trim();
}

function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readShellView(){
  try{
    const api = window[SHELL_API_KEY];
    if (!api || typeof api.getView !== "function") return null;
    const view = api.getView();
    return (view && typeof view === "object") ? view : null;
  } catch {
    return null;
  }
}

function readLiveContext(state){
  const shell = readShellView();
  return {
    campaignId: clean(shell?.campaignId) || "default",
    campaignName: clean(shell?.campaignName) || "Campaign",
    officeId: clean(shell?.officeId) || "all",
    scenarioId: clean(shell?.scenarioId) || "baseline",
    stageId: clean(state?.stageId) || "district",
    today: new Date().toISOString().slice(0, 10),
    playbookSignals: (shell?.playbookSignals && typeof shell.playbookSignals === "object")
      ? shell.playbookSignals
      : {},
  };
}

function getEl(id){
  return document.getElementById(id);
}

function panelElements(){
  return {
    modeModule: getEl("v3IntelModeModule"),
    modeModel: getEl("v3IntelModeModel"),
    modePlaybook: getEl("v3IntelModePlaybook"),
    modeGlossary: getEl("v3IntelModeGlossary"),
    modeSearch: getEl("v3IntelModeSearch"),
    searchRow: getEl("v3IntelSearchRow"),
    queryInput: getEl("v3IntelQuery"),
    queryBtn: getEl("v3IntelQueryBtn"),
    title: getEl("v3IntelTitle"),
    subtitle: getEl("v3IntelSubtitle"),
    status: getEl("v3IntelModeStatus"),
    body: getEl("v3IntelBody"),
  };
}

function setActiveModeButtons(mode){
  const els = panelElements();
  const pairs = [
    [els.modeModule, "module"],
    [els.modeModel, "model"],
    [els.modePlaybook, "playbook"],
    [els.modeGlossary, "glossary"],
    [els.modeSearch, "search"],
  ];
  for (const [el, id] of pairs){
    if (!(el instanceof HTMLButtonElement)) continue;
    const active = mode === id;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function modeLabel(mode){
  const value = clean(mode).toLowerCase();
  if (value === "module") return "Guide";
  if (value === "model") return "Models";
  if (value === "playbook") return "Playbook";
  if (value === "glossary") return "Terms";
  if (value === "message") return "Signal";
  if (value === "search") return "Search";
  return "Guide";
}

function parseMiniItems(row){
  const items = Array.isArray(row?.items) ? row.items.map((item) => clean(item)).filter(Boolean) : [];
  if (items.length) return items;
  const text = clean(row?.body);
  if (!text) return [];
  return text
    .split(/\s*\|\s*/)
    .map((item) => clean(item))
    .filter(Boolean);
}

function renderSectionHeader(row){
  return `<h4 class="fpe-intel-section__title">${escapeHtml(row?.label || "")}</h4>`;
}

function renderSectionBody(row){
  const body = clean(row?.body);
  return body
    ? `<p class="fpe-intel-section__body">${escapeHtml(body)}</p>`
    : "";
}

function renderSectionContent(row, miniItems){
  if (miniItems.length){
    return `<div class="fpe-intel-mini-row">${miniItems.map((item) => `<span class="fpe-intel-mini-item">${escapeHtml(item)}</span>`).join("")}</div>`;
  }
  return renderSectionBody(row);
}

function renderSection(row){
  const variant = clean(row?.variant) || "card";
  const miniItems = parseMiniItems(row);
  const classes = [
    "fpe-intel-section",
    `fpe-intel-section--${escapeHtml(variant)}`,
  ];

  if (variant === "mini-row"){
    return `
      <section class="${classes.join(" ")}">
        ${renderSectionHeader(row)}
        ${renderSectionContent(row, miniItems)}
      </section>
    `;
  }

  return `
    <section class="${classes.join(" ")}">
      ${renderSectionHeader(row)}
      ${renderSectionContent(row, miniItems)}
    </section>
  `;
}

function renderSections(payload){
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  if (!sections.length) return "";
  return sections.map((row) => renderSection(row)).join("");
}

function renderGlossaryStrip(payload){
  const links = Array.isArray(payload?.links) ? payload.links : [];
  const termLinks = links.filter((row) => clean(row?.type).toLowerCase() === "glossary");
  if (!termLinks.length){
    return "";
  }
  const seen = new Set();
  const items = termLinks
    .filter((row) => {
      const id = clean(row?.id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((row) => {
      const id = clean(row?.id);
      const label = clean(row?.label || id);
      return `
        <button
          class="fpe-intel-chip fpe-intel-glossary-chip"
          type="button"
          data-intel-open-type="glossary"
          data-intel-open-id="${escapeHtml(id)}"
        >
          ${escapeHtml(label)}
        </button>
      `;
    })
    .join("");
  if (!items){
    return "";
  }
  return `
    <section class="fpe-intel-section fpe-intel-section--mini-row fpe-intel-glossary-strip">
      <h4 class="fpe-intel-section__title">Glossary Terms</h4>
      <div class="fpe-intel-glossary-row">${items}</div>
    </section>
  `;
}

function renderLinks(payload, options = {}){
  const links = Array.isArray(payload?.links) ? payload.links : [];
  const omitGlossary = !!options?.omitGlossary;
  const visibleLinks = omitGlossary
    ? links.filter((row) => clean(row?.type).toLowerCase() !== "glossary")
    : links;
  if (!visibleLinks.length) return "";
  const kindLabel = (type) => {
    const t = clean(type).toLowerCase();
    if (t === "module") return "Guide";
    if (t === "model") return "Model";
    if (t === "playbook") return "Playbook";
    if (t === "glossary") return "Term";
    if (t === "message") return "Signal";
    return "Related";
  };
  const items = visibleLinks.map((row) => {
    const type = clean(row?.type);
    const id = clean(row?.id);
    const label = clean(row?.label || id);
    return `
      <button
        class="fpe-intel-link"
        type="button"
        data-intel-link-kind="${escapeHtml(type)}"
        data-intel-open-type="${escapeHtml(type)}"
        data-intel-open-id="${escapeHtml(id)}"
      >
        <span class="fpe-intel-link__kind">${escapeHtml(kindLabel(type))}</span>
        <span class="fpe-intel-link__label">${escapeHtml(label)}</span>
      </button>
    `;
  }).join("");
  return `
    <section class="fpe-intel-links">
      <div class="fpe-intel-links__title">Related Paths</div>
      <div class="fpe-intel-links__list">${items}</div>
    </section>
  `;
}

function renderSearchResults(payload){
  const query = clean(payload?.query);
  const rows = Array.isArray(payload?.results) ? payload.results : [];
  if (!query){
    return `<div class="fpe-intel-empty">Search for a module, term, or message definition.</div>`;
  }
  if (!rows.length){
    return `<div class="fpe-intel-empty">No matches found for "${escapeHtml(query)}".</div>`;
  }
  return rows.map((row) => `
    <button
      class="fpe-intel-result"
      type="button"
      data-intel-open-type="${escapeHtml(clean(row?.type))}"
      data-intel-open-id="${escapeHtml(clean(row?.id))}"
    >
      <span class="fpe-intel-result__meta">${escapeHtml(clean(row?.type))}</span>
      <span class="fpe-intel-result__title">${escapeHtml(clean(row?.title))}</span>
      <span class="fpe-intel-result__summary">${escapeHtml(clean(row?.summary))}</span>
    </button>
  `).join("");
}

function dispatch(action){
  if (!CONTROLLER) return;
  CONTROLLER.state = reduceIntelligenceState(CONTROLLER.state, action);
  render();
}

function render(){
  if (!CONTROLLER || !(CONTROLLER.panel instanceof HTMLElement)) return;
  const els = panelElements();
  if (!(els.body instanceof HTMLElement)) return;
  const state = normalizeIntelligenceState(CONTROLLER.state);
  CONTROLLER.state = state;
  const payload = resolveIntelligencePayload({
    mode: state.mode,
    moduleId: state.moduleId,
    modelId: state.modelId,
    playbookId: state.playbookId,
    termId: state.termId,
    messageId: state.messageId,
    query: state.query,
    context: readLiveContext(state),
  });

  if (els.title) els.title.textContent = clean(payload?.title) || "System Intelligence";
  if (els.subtitle) els.subtitle.textContent = clean(payload?.subtitle) || "";
  if (els.status){
    const statusText = `${modeLabel(state.mode)} | ${state.stageId || "district"}`;
    els.status.textContent = statusText;
  }
  if (els.searchRow instanceof HTMLElement){
    els.searchRow.hidden = state.mode !== "search";
  }
  if (els.queryInput instanceof HTMLInputElement){
    if (state.mode === "search"){
      if (els.queryInput.value !== state.query) els.queryInput.value = state.query;
    } else {
      els.queryInput.value = "";
    }
  }

  setActiveModeButtons(state.mode);

  if (state.mode === "search"){
    els.body.innerHTML = renderSearchResults(payload);
  } else {
    els.body.innerHTML = `${renderGlossaryStrip(payload)}${renderSections(payload)}${renderLinks(payload, { omitGlossary: true })}`;
  }
}

function onPanelClick(event){
  const target = event?.target;
  if (!(target instanceof HTMLElement)) return;

  const modeBtn = target.closest("[data-intel-mode]");
  if (modeBtn instanceof HTMLElement){
    const mode = clean(modeBtn.getAttribute("data-intel-mode"));
    dispatch({ type: "set_mode", payload: { mode } });
    return;
  }

  const openBtn = target.closest("[data-intel-open-type][data-intel-open-id]");
  if (openBtn instanceof HTMLElement){
    const type = clean(openBtn.getAttribute("data-intel-open-type"));
    const id = clean(openBtn.getAttribute("data-intel-open-id"));
    if (type === "module"){
      dispatch({ type: "open_module", payload: { moduleId: id } });
      return;
    }
    if (type === "model"){
      dispatch({ type: "open_model", payload: { modelId: id } });
      return;
    }
    if (type === "glossary"){
      dispatch({ type: "open_glossary", payload: { termId: id } });
      return;
    }
    if (type === "message"){
      dispatch({ type: "open_message", payload: { messageId: id } });
      return;
    }
    if (type === "playbook"){
      dispatch({ type: "open_playbook", payload: { playbookId: id } });
      return;
    }
  }

  if (target.id === "v3IntelQueryBtn"){
    const input = getEl("v3IntelQuery");
    const query = (input instanceof HTMLInputElement) ? input.value : "";
    dispatch({ type: "search", payload: { query } });
  }
}

function onPanelKeydown(event){
  const target = event?.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id !== "v3IntelQuery") return;
  if (event.key !== "Enter") return;
  event.preventDefault();
  const query = (target instanceof HTMLInputElement) ? target.value : "";
  dispatch({ type: "search", payload: { query } });
}

function panelMarkup(){
  return `
    <section class="fpe-intel-panel" id="${PANEL_ID}" aria-label="System intelligence">
      <header class="fpe-intel-panel__head">
        <div class="fpe-intel-panel__title" id="v3IntelTitle">System Intelligence</div>
        <div class="fpe-intel-panel__subtitle" id="v3IntelSubtitle"></div>
      </header>
      <div class="fpe-intel-tabs" role="tablist" aria-label="Intelligence modes">
        <button class="fpe-intel-tab" id="v3IntelModeModule" data-intel-mode="module" type="button">Guide</button>
        <button class="fpe-intel-tab" id="v3IntelModeModel" data-intel-mode="model" type="button">Models</button>
        <button class="fpe-intel-tab" id="v3IntelModePlaybook" data-intel-mode="playbook" type="button">Playbook</button>
        <button class="fpe-intel-tab" id="v3IntelModeGlossary" data-intel-mode="glossary" type="button">Terms</button>
        <button class="fpe-intel-tab" id="v3IntelModeSearch" data-intel-mode="search" type="button">Search</button>
      </div>
      <div class="fpe-intel-search" id="v3IntelSearchRow" hidden>
        <input class="fpe-context__input fpe-intel-search__input" id="v3IntelQuery" type="text" placeholder="Search doctrine/models/playbook/glossary/messages" />
        <button class="fpe-btn fpe-btn--ghost fpe-intel-search__btn" id="v3IntelQueryBtn" type="button">Go</button>
      </div>
      <div class="fpe-intel-mode-status" id="v3IntelModeStatus"></div>
      <div class="fpe-intel-body" id="v3IntelBody"></div>
    </section>
  `;
}

function ensurePanel(slot){
  if (!(slot instanceof HTMLElement)) return null;
  slot.classList.add("fpe-right-rail-slot--intel");
  let panel = slot.querySelector(`#${PANEL_ID}`);
  if (!(panel instanceof HTMLElement)){
    panel = document.createElement("div");
    panel.innerHTML = panelMarkup();
    panel = panel.firstElementChild;
    if (!(panel instanceof HTMLElement)) return null;
    slot.appendChild(panel);
    panel.addEventListener("click", onPanelClick);
    panel.addEventListener("keydown", onPanelKeydown);
  }
  return panel;
}

function installApi(){
  window[INTEL_API_KEY] = {
    getView: () => CONTROLLER ? { ...CONTROLLER.state } : makeDefaultIntelligenceState(),
    setStage: (stageId) => setIntelligencePanelStage(stageId),
    openModule: (moduleId) => dispatch({ type: "open_module", payload: { moduleId } }),
    openModel: (modelId) => dispatch({ type: "open_model", payload: { modelId } }),
    openGlossary: (termId) => dispatch({ type: "open_glossary", payload: { termId } }),
    openMessage: (messageId) => dispatch({ type: "open_message", payload: { messageId } }),
    openPlaybook: (playbookId) => dispatch({ type: "open_playbook", payload: { playbookId } }),
    openSearch: (query) => dispatch({ type: "search", payload: { query } }),
    refresh: () => refreshIntelligencePanel(),
  };
}

/**
 * @param {{ slot?: HTMLElement | null, stageId?: string }=} options
 */
export function mountIntelligencePanel(options = {}){
  const slot = options?.slot instanceof HTMLElement ? options.slot : document.getElementById("v3RightRailSlot");
  if (!(slot instanceof HTMLElement)) return null;

  if (!CONTROLLER){
    CONTROLLER = {
      slot,
      panel: null,
      state: makeDefaultIntelligenceState({ stageId: clean(options?.stageId) || "district" }),
    };
  } else {
    CONTROLLER.slot = slot;
  }

  CONTROLLER.panel = ensurePanel(slot);
  if (clean(options?.stageId)){
    CONTROLLER.state = reduceIntelligenceState(CONTROLLER.state, {
      type: "set_stage",
      payload: { stageId: options.stageId },
    });
  }
  installApi();
  render();
  return CONTROLLER;
}

/**
 * @param {string=} stageId
 */
export function setIntelligencePanelStage(stageId = ""){
  if (!CONTROLLER){
    mountIntelligencePanel({ stageId });
    return;
  }
  CONTROLLER.state = reduceIntelligenceState(CONTROLLER.state, {
    type: "set_stage",
    payload: { stageId },
  });
  render();
}

export function refreshIntelligencePanel(){
  render();
}
