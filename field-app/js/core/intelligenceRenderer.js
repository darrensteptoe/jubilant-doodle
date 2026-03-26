// @ts-check
import { reduceIntelligenceState, makeDefaultIntelligenceState, normalizeIntelligenceState } from "./intelligenceState.js";
import { resolveIntelligencePayload } from "./intelligenceResolver.js";

const PANEL_ID = "v3IntelligencePanel";
const SHELL_API_KEY = "__FPE_SHELL_API__";
const INTEL_API_KEY = "__FPE_INTELLIGENCE_API__";
const DISTRICT_API_KEY = "__FPE_DISTRICT_API__";
const REACH_API_KEY = "__FPE_REACH_API__";
const TURNOUT_API_KEY = "__FPE_TURNOUT_API__";
const PLAN_API_KEY = "__FPE_PLAN_API__";
const OUTCOME_API_KEY = "__FPE_OUTCOME_API__";
const DECISION_API_KEY = "__FPE_DECISION_API__";

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

function readBridgeView(key){
  try{
    const api = window[key];
    if (!api || typeof api.getView !== "function") return null;
    const view = api.getView();
    return (view && typeof view === "object") ? view : null;
  } catch {
    return null;
  }
}

function readStageViews(){
  return {
    district: readBridgeView(DISTRICT_API_KEY),
    reach: readBridgeView(REACH_API_KEY),
    turnout: readBridgeView(TURNOUT_API_KEY),
    plan: readBridgeView(PLAN_API_KEY),
    outcome: readBridgeView(OUTCOME_API_KEY),
    decision: readBridgeView(DECISION_API_KEY),
  };
}

function readLiveContext(state){
  const shell = readShellView();
  const stageViews = readStageViews();
  return {
    campaignId: clean(shell?.campaignId) || "default",
    campaignName: clean(shell?.campaignName) || "Campaign",
    officeId: clean(shell?.officeId) || "all",
    scenarioId: clean(shell?.scenarioId) || "baseline",
    stageId: clean(state?.stageId) || "district",
    today: new Date().toISOString().slice(0, 10),
    shellView: shell || {},
    stageViews,
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

function parseMiniItems(row, variant = ""){
  const currentVariant = clean(variant) || clean(row?.variant);
  const items = Array.isArray(row?.items) ? row.items.map((item) => clean(item)).filter(Boolean) : [];
  if (items.length){
    return items.map((item) => {
      const idx = item.indexOf(":");
      if (idx <= 0 || idx === item.length - 1){
        return { label: "", value: item };
      }
      return {
        label: clean(item.slice(0, idx)),
        value: clean(item.slice(idx + 1)),
      };
    });
  }
  if (currentVariant !== "mini-row"){
    return [];
  }
  const text = clean(row?.body);
  if (!text) return [];
  return text
    .split(/\s*\|\s*/)
    .map((item) => clean(item))
    .filter(Boolean)
    .map((item) => {
      const idx = item.indexOf(":");
      if (idx <= 0 || idx === item.length - 1){
        return { label: "", value: item };
      }
      return {
        label: clean(item.slice(0, idx)),
        value: clean(item.slice(idx + 1)),
      };
    });
}

function renderSectionHeader(row){
  return `<h4 class="fpe-intel-section__title">${escapeHtml(row?.label || "")}</h4>`;
}

function renderSectionBody(row){
  const body = String(row?.body == null ? "" : row.body);
  const paragraphs = body
    .split(/\n{2,}/)
    .map((entry) => clean(entry))
    .filter(Boolean);
  if (!paragraphs.length){
    return "";
  }
  return paragraphs
    .map((entry) => `<p class="fpe-intel-section__body">${escapeHtml(entry)}</p>`)
    .join("");
}

function renderSectionContent(row, miniItems){
  if (miniItems.length){
    return `<div class="fpe-intel-mini-row">${miniItems.map((item) => `
      <span class="fpe-intel-mini-item">
        ${item.label ? `<span class="fpe-intel-mini-item__label">${escapeHtml(item.label)}</span>` : ""}
        <span class="fpe-intel-mini-item__value">${escapeHtml(item.value)}</span>
      </span>
    `).join("")}</div>`;
  }
  return renderSectionBody(row);
}

function renderSectionMeta(row){
  void row;
  return "";
}

function renderSection(row){
  const variant = clean(row?.variant) || "card";
  const miniItems = parseMiniItems(row, variant);
  const classes = [
    "fpe-intel-section",
    `fpe-intel-section--${escapeHtml(variant)}`,
  ];

  if (variant === "mini-row"){
    return `
      <section class="${classes.join(" ")}">
        ${renderSectionHeader(row)}
        ${renderSectionContent(row, miniItems)}
        ${renderSectionMeta(row)}
      </section>
    `;
  }

  return `
    <section class="${classes.join(" ")}">
      ${renderSectionHeader(row)}
      ${renderSectionContent(row, miniItems)}
      ${renderSectionMeta(row)}
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
      <div class="fpe-intel-links__title">Related Guide Paths</div>
      <div class="fpe-intel-links__list">${items}</div>
    </section>
  `;
}

function renderTrustTiers(trust){
  const tiers = trust?.tiers && typeof trust.tiers === "object" ? trust.tiers : {};
  const tierRows = [
    { id: "tier1", label: "Tier 1 now", rows: Array.isArray(tiers.tier1) ? tiers.tier1 : [] },
    { id: "tier2", label: "Tier 2 next", rows: Array.isArray(tiers.tier2) ? tiers.tier2 : [] },
    { id: "tier3", label: "Tier 3 later", rows: Array.isArray(tiers.tier3) ? tiers.tier3 : [] },
  ];
  return tierRows.map((group) => {
    const pills = group.rows
      .map((row) => `<span class="fpe-intel-trust-tier-pill">${escapeHtml(clean(row?.title || row?.id))}</span>`)
      .join("");
    return `
      <div class="fpe-intel-trust-tier">
        <div class="fpe-intel-trust-tier__label">${escapeHtml(group.label)}</div>
        <div class="fpe-intel-trust-tier__list">${pills}</div>
      </div>
    `;
  }).join("");
}

function renderTrustFigure(figure){
  const assumptions = Array.isArray(figure?.assumptions) ? figure.assumptions.map((row) => clean(row)).filter(Boolean) : [];
  const reasons = Array.isArray(figure?.changeReasons) ? figure.changeReasons.map((row) => clean(row)).filter(Boolean) : [];
  const displaySurfaces = Array.isArray(figure?.displaySurfaces) ? figure.displaySurfaces.map((row) => clean(row)).filter(Boolean) : [];
  const reportSurfaces = Array.isArray(figure?.reportSurfaces) ? figure.reportSurfaces.map((row) => clean(row)).filter(Boolean) : [];
  const reportParityMappings = Array.isArray(figure?.reportParityMappings)
    ? figure.reportParityMappings
      .map((row) => {
        const reportType = clean(row?.reportType);
        const sectionId = clean(row?.sectionId);
        const metricLabel = clean(row?.metricLabel);
        if (!reportType || !sectionId || !metricLabel) return "";
        return `${reportType}:${sectionId}:${metricLabel}`;
      })
      .filter(Boolean)
    : [];
  const trustCode = clean(figure?.trustState?.code) || "ready";
  const trustLabel = clean(figure?.trustState?.label) || "Ready";
  const trustDetail = clean(figure?.trustState?.detail);
  const assumptionsHtml = assumptions.length
    ? assumptions.map((row) => `<li class="fpe-intel-trust-figure__assumption">${escapeHtml(row)}</li>`).join("")
    : `<li class="fpe-intel-trust-figure__assumption">No assumptions in play captured.</li>`;
  const reasonsHtml = reasons.length
    ? reasons.map((row) => `<li class="fpe-intel-trust-figure__reason">${escapeHtml(row)}</li>`).join("")
    : `<li class="fpe-intel-trust-figure__reason">No change reason templates configured.</li>`;

  return `
    <article class="fpe-intel-trust-figure">
      <div class="fpe-intel-trust-figure__head">
        <h4 class="fpe-intel-trust-figure__title">${escapeHtml(clean(figure?.title))}</h4>
        <div class="fpe-intel-trust-figure__value">${escapeHtml(clean(figure?.displayValue) || "—")}</div>
      </div>
      <div class="fpe-intel-trust-figure__state fpe-intel-trust-figure__state--${escapeHtml(trustCode)}">${escapeHtml(trustLabel)}</div>
      ${trustDetail ? `<p class="fpe-intel-trust-figure__state-detail">${escapeHtml(trustDetail)}</p>` : ""}
      <p class="fpe-intel-trust-figure__text"><strong>What this is:</strong> ${escapeHtml(clean(figure?.shortDefinition))}</p>
      <p class="fpe-intel-trust-figure__text"><strong>What it means:</strong> ${escapeHtml(clean(figure?.whatItMeans))}</p>
      <p class="fpe-intel-trust-figure__text"><strong>What drives it:</strong> ${escapeHtml(clean(figure?.whatDrives))}</p>
      <p class="fpe-intel-trust-figure__text"><strong>How to use it:</strong> ${escapeHtml(clean(figure?.howToUse))}</p>
      <div class="fpe-intel-trust-figure__block">
        <div class="fpe-intel-trust-figure__label">Assumptions in play</div>
        <ul class="fpe-intel-trust-figure__list">${assumptionsHtml}</ul>
      </div>
      <p class="fpe-intel-trust-figure__text"><strong>Canonical source:</strong> ${escapeHtml(clean(figure?.canonicalPath) || "Unassigned")}</p>
      <p class="fpe-intel-trust-figure__text"><strong>Traced value:</strong> ${escapeHtml(clean(figure?.tracedValue) || "—")}</p>
      <p class="fpe-intel-trust-figure__text"><strong>Screen surfaces:</strong> ${escapeHtml(displaySurfaces.join(" | ") || "Not mapped")}</p>
      <p class="fpe-intel-trust-figure__text"><strong>Report surfaces:</strong> ${escapeHtml(reportSurfaces.join(" | ") || "Not mapped")}</p>
      <p class="fpe-intel-trust-figure__text"><strong>Report metric parity:</strong> ${escapeHtml(reportParityMappings.join(" | ") || "No direct numeric report mapping.")}</p>
      <div class="fpe-intel-trust-figure__block">
        <div class="fpe-intel-trust-figure__label">Why this changed</div>
        <ul class="fpe-intel-trust-figure__list">${reasonsHtml}</ul>
      </div>
      <p class="fpe-intel-trust-figure__text"><strong>Displayed value:</strong> ${escapeHtml(clean(figure?.roundingNote) || "Displayed values are rounded for readability.")}</p>
    </article>
  `;
}

function renderTrustStateLegend(trust){
  const states = trust?.globalMicrocopy?.states && typeof trust.globalMicrocopy.states === "object"
    ? trust.globalMicrocopy.states
    : {};
  const rows = [
    { label: "Ready", detail: clean(states.ready) || "Source path is present and current enough to support normal use." },
    { label: "Review", detail: clean(states.review) || "The figure may still be useful, but the team should verify before leaning on it hard." },
    { label: "Missing", detail: clean(states.missing) || "Required input or evidence path is absent, so confidence should drop." },
    { label: "Fallback", detail: clean(states.fallback) || "A backup path is being used; treat this as informative, not settled." },
    { label: "Mismatch", detail: clean(states.mismatch) || "Related signals disagree; reconcile before escalating claims." },
  ];
  return `
    <section class="fpe-intel-trust-legend" aria-label="Trust state guide">
      ${rows.map((row) => `
        <div class="fpe-intel-trust-legend__row">
          <div class="fpe-intel-trust-legend__label">${escapeHtml(row.label)}</div>
          <div class="fpe-intel-trust-legend__detail">${escapeHtml(row.detail)}</div>
        </div>
      `).join("")}
    </section>
  `;
}

function renderTrust(payload){
  const trust = payload?.trust && typeof payload.trust === "object" ? payload.trust : null;
  if (!trust) return "";
  const figures = Array.isArray(trust?.figures) ? trust.figures : [];
  if (!figures.length) return "";
  const hero = clean(trust?.globalMicrocopy?.showYourWork)
    || "See what this figure is based on, which assumptions are in play, and how the displayed value was produced.";
  const sub = clean(trust?.globalMicrocopy?.reviewBeforeActing)
    || "Use this figure as a decision aid. Review assumptions before acting.";
  return `
    <section class="fpe-intel-trust">
      <header class="fpe-intel-trust__hero">
        <h3 class="fpe-intel-trust__title">${escapeHtml(clean(trust?.title) || "Decision Trust Layer")}</h3>
        <p class="fpe-intel-trust__subtitle">${escapeHtml(clean(trust?.subtitle))}</p>
        <p class="fpe-intel-trust__microcopy">${escapeHtml(hero)}</p>
        <p class="fpe-intel-trust__microcopy">${escapeHtml(sub)}</p>
      </header>
      ${renderTrustStateLegend(trust)}
      <div class="fpe-intel-trust__tiers">${renderTrustTiers(trust)}</div>
      <div class="fpe-intel-trust__figures">${figures.map((figure) => renderTrustFigure(figure)).join("")}</div>
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
    els.body.innerHTML = `${renderTrust(payload)}${renderGlossaryStrip(payload)}${renderSections(payload)}${renderLinks(payload, { omitGlossary: true })}`;
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
