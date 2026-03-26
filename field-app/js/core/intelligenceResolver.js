// @ts-check
import { getDefaultModelForStage, getDefaultModuleForStage, getIntelligenceEntity } from "./intelligenceRegistry.js";
import { searchIntelligence } from "./intelligenceSearch.js";
import { getDefaultPlaybookForStage } from "./playbookRegistry.js";
import {
  evaluatePlaybookTrigger,
  formatPlaybookTriggerSummary,
  normalizePlaybookSignals,
  resolvePlaybookIdForSignals,
} from "./playbookResolver.js";
import { buildDecisionTrustSurface } from "./decisionTrustLayer.js";

const MODE_MODULE = "module";
const MODE_MODEL = "model";
const MODE_GLOSSARY = "glossary";
const MODE_MESSAGE = "message";
const MODE_PLAYBOOK = "playbook";
const MODE_SEARCH = "search";
const MODULE_PLAYBOOK_LINKS = Object.freeze({
  targetingLab: Object.freeze(["persuasionUniverseTooBroad"]),
  optimizer: Object.freeze(["optimizerOvervaluesCheapChannels", "behindButStillLive"]),
  forecastOutcome: Object.freeze(["forecastImprovedBecauseAssumptionsChanged", "aheadButFragile"]),
  operationsWorkforce: Object.freeze(["strongVolunteerCountWeakRealCapacity"]),
  turnoutContactSaturation: Object.freeze(["lateCycleRepeatedContactFlattened"]),
  warRoomDecisionSession: Object.freeze(["lowConfidenceHighPressure", "weatherThreatensElectionDayPlan"]),
});
const STAGE_GLOSSARY_DEFAULTS = Object.freeze({
  district: Object.freeze([
    "raceTemplate",
    "officeLevelContext",
    "electionTypeField",
    "seatContextField",
    "partisanshipModeField",
    "salienceLevelField",
    "supportRetention",
    "turnoutBandWidth",
    "topN",
    "minimumScore",
    "densityFloor",
    "readiness",
  ]),
  reach: Object.freeze([
    "persuasionUniverse",
    "mobilizationUniverse",
    "turnoutOpportunity",
    "contactProbability",
    "earlyVoteExpected",
    "supportRetention",
  ]),
  turnout: Object.freeze(["turnoutOpportunity", "turnoutElasticity", "saturation", "contactProbability", "turnoutBandWidth"]),
  outcome: Object.freeze(["percentileRange", "median", "planningFloor", "upsideCase", "confidenceBand"]),
  plan: Object.freeze(["votePath", "costPerContact", "capacity", "realism", "actionability"]),
  scenarios: Object.freeze(["scenarioDrift", "signal", "noise", "materialChange", "confidenceBand"]),
  controls: Object.freeze(["readiness", "confidence", "calibration", "bias", "realism"]),
  data: Object.freeze([
    "readiness",
    "confidence",
    "confidenceBand",
    "calibration",
    "scenarioDrift",
    "dataBundleField",
    "geoUnitsField",
    "geographyLevelField",
    "sourceNoteField",
  ]),
  "war-room": Object.freeze(["signal", "noise", "decisionSignificance", "actionability", "planningFloor", "upsideCase"]),
  "decision-log": Object.freeze(["signal", "noise", "decisionSignificance", "actionability", "planningFloor", "upsideCase"]),
});

function clean(value){
  return String(value == null ? "" : value).trim();
}

/**
 * @param {string=} input
 */
export function normalizeIntelligenceMode(input = ""){
  const mode = clean(input).toLowerCase();
  if (mode === MODE_MODEL) return MODE_MODEL;
  if (mode === MODE_GLOSSARY) return MODE_GLOSSARY;
  if (mode === MODE_MESSAGE) return MODE_MESSAGE;
  if (mode === MODE_PLAYBOOK) return MODE_PLAYBOOK;
  if (mode === MODE_SEARCH) return MODE_SEARCH;
  return MODE_MODULE;
}

function normalizeContext(raw = {}){
  const src = (raw && typeof raw === "object") ? raw : {};
  return {
    campaignId: clean(src.campaignId) || "default",
    campaignName: clean(src.campaignName) || "Campaign",
    officeId: clean(src.officeId) || "all",
    scenarioId: clean(src.scenarioId) || "baseline",
    stageId: clean(src.stageId) || "district",
    today: clean(src.today) || new Date().toISOString().slice(0, 10),
    shellView: (src.shellView && typeof src.shellView === "object") ? src.shellView : {},
    stageViews: (src.stageViews && typeof src.stageViews === "object") ? src.stageViews : {},
    playbookSignals: normalizePlaybookSignals({
      ...(src.playbookSignals && typeof src.playbookSignals === "object" ? src.playbookSignals : {}),
      stageId: clean(src.stageId) || "district",
    }),
  };
}

function injectLiveValues(text, context){
  const raw = String(text == null ? "" : text);
  return raw
    .replace(/\{\{campaignId\}\}/g, context.campaignId)
    .replace(/\{\{campaignName\}\}/g, context.campaignName)
    .replace(/\{\{officeId\}\}/g, context.officeId)
    .replace(/\{\{scenarioId\}\}/g, context.scenarioId)
    .replace(/\{\{stageId\}\}/g, context.stageId)
    .replace(/\{\{today\}\}/g, context.today);
}

function toList(value){
  return Array.isArray(value) ? value.map((v) => clean(v)).filter(Boolean) : [];
}

function formatActionList(value, context){
  const rows = toList(value);
  if (!rows.length){
    return "";
  }
  return injectLiveValues(rows.join(" | "), context);
}

function makeSection({ id, label, body, variant = "card", expandable = false, items = [] }){
  return {
    id: clean(id),
    label: clean(label),
    body: clean(body),
    variant: clean(variant) || "card",
    expandable: !!expandable,
    items: Array.isArray(items) ? items.map((item) => clean(item)).filter(Boolean) : [],
  };
}

function splitMiniItems(value){
  const raw = clean(value);
  if (!raw) return [];
  return raw
    .split(/\s*\|\s*/)
    .map((item) => clean(item))
    .filter(Boolean);
}

function panelBody(paragraphs = []){
  const rows = Array.isArray(paragraphs) ? paragraphs.map((row) => clean(row)).filter(Boolean) : [];
  return rows.join("\n\n");
}

function panelItems(items = []){
  const rows = Array.isArray(items) ? items : [];
  return rows
    .map((row) => {
      const label = clean(row?.label);
      const body = clean(row?.body);
      if (!label || !body) return "";
      return `${label}: ${body}`;
    })
    .filter(Boolean);
}

function shouldShowOperatingPostureWarning(context){
  const signals = context?.playbookSignals && typeof context.playbookSignals === "object"
    ? context.playbookSignals
    : {};
  const fieldRisk = clean(signals.weatherFieldExecutionRisk).toLowerCase();
  const turnoutRisk = clean(signals.weatherElectionDayTurnoutRisk).toLowerCase();
  const pressure = clean(signals.decisionPressureLevel).toLowerCase();
  return fieldRisk === "medium"
    || fieldRisk === "high"
    || turnoutRisk === "medium"
    || turnoutRisk === "high"
    || pressure === "medium"
    || pressure === "high";
}

function shouldShowTemporaryCapacityNote(context){
  const signals = context?.playbookSignals && typeof context.playbookSignals === "object"
    ? context.playbookSignals
    : {};
  const appliedEvents = Number(signals.appliedCampaignEvents || 0);
  const todayEvents = Number(signals.todayCampaignEvents || 0);
  return appliedEvents > 0 || todayEvents > 0;
}

function helperPanelSections(entry, context){
  const moduleId = clean(entry?.id);
  if (!moduleId) return [];

  /** @type {Array<{ title: string, paragraphs: string[], items?: Array<{ label: string, body: string }>, variant?: string }>} */
  const panels = [];

  if (moduleId === "forecastOutcome"){
    panels.push({
      title: "How to read this forecast",
      paragraphs: [
        "This forecast is not a promise. It is the campaign's current best read of the range of outcomes implied by the assumptions, evidence, and execution posture in the system right now.",
        "A healthy forecast is not just one with a high top-end case. A healthy forecast has a believable middle, a downside the campaign can survive, and movement that can be explained by real changes in evidence or execution.",
        "If only the upside case looks good, do not treat that as plan safety. If the middle of the distribution is weak, the team should act like the plan still needs help.",
      ],
      items: [
        { label: "What good looks like", body: "The middle of the range supports the goal and the downside is manageable." },
        { label: "What weak usage looks like", body: "The team points to the nicest number and ignores the rest of the range." },
        { label: "What to do next", body: "Check whether confidence, readiness, and pace support the story this forecast is telling." },
      ],
      variant: "hero",
    });
  }

  if (moduleId === "governanceConfidence"){
    panels.push({
      title: "How to use trust correctly",
      paragraphs: [
        "Trust is not about whether the output looks polished. Trust is about whether the campaign can explain why the current read deserves to be believed right now.",
        "High trust should come from evidence quality, update discipline, source clarity, and operational realism. Low trust does not always mean the model is wrong. It means the campaign should speak and commit more carefully.",
        "If confidence language is getting stronger while the evidence stays flat, the campaign is drifting into false certainty.",
      ],
      items: [
        { label: "What good looks like", body: "The team can name the source, owner, freshness, and reason behind the current read." },
        { label: "What weak usage looks like", body: "Missing, stale, thin, or contradictory inputs are ignored because the dashboard still looks clean." },
        { label: "What to do next", body: "Refresh weak evidence, fix ownership gaps, and reduce claim strength until the source path improves." },
      ],
      variant: "hero",
    });
  }

  if (moduleId === "warRoomDecisionSession"){
    panels.push({
      title: "How to use this in the war room",
      paragraphs: [
        "This surface is for decisions that cannot wait. It should answer whether the campaign should hold, shift, escalate, reduce, or redirect effort in the current operating window.",
        "Use it when weather, staffing, benchmark quality, pace, or readiness create a real difference between the plan on paper and the plan the team can actually execute today.",
        "Do not use war room framing to quietly rewrite long-run assumptions. Use it to make explicit short-horizon operating decisions and log why they changed.",
      ],
      items: [
        { label: "What good looks like", body: "Same-day risk is named clearly, and the recommended action matches the evidence." },
        { label: "What weak usage looks like", body: "The team improvises around disruption without changing posture, logging assumptions, or adjusting expectations." },
        { label: "What to do next", body: "Make the operating decision explicit, communicate it, and preserve a clean trail of why it changed." },
      ],
      variant: "hero",
    });
    if (shouldShowOperatingPostureWarning(context)){
      panels.push({
        title: "Operating posture warning",
        paragraphs: [
          "Current conditions may justify a short-horizon shift in execution, but they do not automatically justify rewriting long-run assumptions. Make the operational posture explicit, keep the adjustment date-bound, and preserve a clean explanation of why the shift was made.",
        ],
        variant: "callout",
      });
    }
    if (shouldShowTemporaryCapacityNote(context)){
      panels.push({
        title: "Temporary capacity note",
        paragraphs: [
          "A short-term event advantage can improve near-term field opportunity, but it should be treated as date-bound capacity, not permanent campaign strength.",
        ],
        variant: "callout",
      });
    }
  }

  if (moduleId === "campaignDataRequirements"){
    panels.push({
      title: "How to use benchmark data without fooling yourself",
      paragraphs: [
        "Benchmark data is useful when it improves judgment. It becomes dangerous when weak comparables quietly harden into strategy.",
        "A benchmark should help the campaign understand what is plausible, not force the current race to behave like a different one.",
        "The key question is not whether there is data. The key question is whether the comparison set is actually credible for this race, this electorate, and this decision.",
      ],
      items: [
        { label: "What good looks like", body: "Comparables are relevant, recent enough, and clearly connected to the current decision." },
        { label: "What weak usage looks like", body: "The team leans on old, mismatched, or context-poor results because they are available." },
        { label: "What to do next", body: "Check relevance, scope, and downstream impact before treating benchmark-driven assumptions as solid ground." },
      ],
      variant: "hero",
    });
    panels.push({
      title: "How to turn this into action",
      paragraphs: [
        "Analysis only matters if it changes what the team does next. The purpose of this view is to convert the current read into owned work over the next operating window.",
        "A useful weekly action plan names what must move, who owns it, what risk it addresses, and what happens if it does not improve.",
      ],
      items: [
        { label: "What good looks like", body: "The next seven days have clear owners, clear priorities, and clear reason." },
        { label: "What weak usage looks like", body: "The analysis is accurate but nobody's behavior changes." },
        { label: "What to do next", body: "Name the blockers, assign the response, and tie each action back to the pressure point it is meant to move." },
      ],
      variant: "card",
    });
  }

  const out = [];
  for (let index = 0; index < panels.length; index += 1){
    const panel = panels[index];
    const idBase = `helper-${moduleId}-${index + 1}`;
    out.push(makeSection({
      id: `${idBase}-panel`,
      label: panel.title,
      body: injectLiveValues(panelBody(panel.paragraphs), context),
      variant: clean(panel.variant) || "card",
      expandable: false,
    }));
    const items = panelItems(panel.items);
    if (items.length){
      out.push(makeSection({
        id: `${idBase}-mini`,
        label: "Operator check",
        body: "",
        variant: "mini-row",
        items,
      }));
    }
  }
  return out;
}

function buildForecastOutcomeGuideSections(entry, context){
  const sections = entry?.sections && typeof entry.sections === "object" ? entry.sections : {};
  const rows = [];
  const push = ({ id, label, key, variant = "card", expandable = false, items = [] }) => {
    const resolvedBody = injectLiveValues(sections[key] || "", context);
    if (!clean(resolvedBody) && !items.length) return;
    rows.push(makeSection({
      id,
      label,
      body: resolvedBody,
      variant,
      expandable,
      items,
    }));
  };

  push({ id: "howToReadTool", label: "How to Read This Tool", key: "whatItIs", variant: "hero" });
  push({ id: "whatRangeIsShowing", label: "What the Range Is Showing", key: "rangesExplained" });
  push({
    id: "whatEachNumberMeans",
    label: "What Each Number Means",
    key: "whatEachNumberMeans",
    variant: "mini-row",
    items: splitMiniItems(injectLiveValues(sections.whatEachNumberMeans || "", context)),
  });
  push({ id: "whichNumberShouldYouUse", label: "Which Number Should You Use", key: "whichNumberShouldYouUse" });
  push({ id: "whatGoodRangeLooksLike", label: "What a Good Range Looks Like", key: "whatGoodLooksLike" });
  push({ id: "tightVsWideRanges", label: "Tight vs Wide Ranges", key: "tightVsWideRanges", expandable: true });
  push({ id: "howToReadChange", label: "How to Read Change", key: "howToReadChange", expandable: true });
  push({ id: "howTeamsShouldUseThis", label: "How Teams Should Use This", key: "howToThink", expandable: true });
  push({ id: "oneMinuteExplanation", label: "One-Minute Explanation", key: "oneMinuteExplanation", expandable: true });
  push({ id: "concreteExample", label: "Concrete Example", key: "concreteExample", expandable: true });

  // Backfill when old keys exist but the new editorial keys are not populated.
  if (!rows.some((row) => row.id === "whichNumberShouldYouUse")){
    push({ id: "whichNumberShouldYouUse", label: "Which Number Should You Use", key: "adjustmentRules" });
  }
  if (!rows.some((row) => row.id === "howToReadChange")){
    push({ id: "howToReadChange", label: "How to Read Change", key: "warningSigns", expandable: true });
  }

  return [...helperPanelSections(entry, context), ...rows];
}

function buildModuleSections(entry, context){
  if (clean(entry?.id) === "forecastOutcome"){
    return buildForecastOutcomeGuideSections(entry, context);
  }
  const sections = entry?.sections && typeof entry.sections === "object" ? entry.sections : {};
  const order = [
    ["whatItIs", "What It Is"],
    ["whenToUse", "When To Use"],
    ["whenNotToUse", "When Not To Use"],
    ["feedsInto", "Feeds Into"],
    ["parametersExplained", "Parameters Explained"],
    ["rangesExplained", "Ranges Explained"],
    ["howToThink", "How To Think About It"],
    ["mathBehindIt", "Math Behind It"],
    ["whatGoodLooksLike", "What Good Looks Like"],
    ["warningSigns", "Warning Signs"],
    ["adjustmentRules", "Adjustment Rules"],
    ["origins", "Origins"],
    ["modelPhilosophy", "Model Philosophy"],
  ];
  const out = [];
  for (let index = 0; index < order.length; index += 1){
    const [id, label] = order[index];
    const value = clean(sections[id]);
    if (!value) continue;
    const variant = index === 0
      ? "hero"
      : (id === "whenNotToUse" || id === "warningSigns"
        ? "callout"
        : "card");
    const expandable = id === "mathBehindIt" || id === "origins" || id === "modelPhilosophy";
    out.push(makeSection({
      id,
      label,
      body: injectLiveValues(value, context),
      variant,
      expandable,
    }));
  }
  return [...helperPanelSections(entry, context), ...out];
}

function relatedLinks(entry){
  const moduleIds = [
    ...toList(entry?.relatedModules),
    ...toList(entry?.relatedDoctrinePages),
  ];
  const dedupModuleIds = Array.from(new Set(moduleIds.map((id) => clean(id)).filter(Boolean)));
  const modules = dedupModuleIds.map((id) => {
    const resolved = getIntelligenceEntity(MODE_MODULE, id);
    const resolvedId = clean(resolved?.id) || clean(id);
    const label = clean(resolved?.title) || clean(id);
    return {
      type: MODE_MODULE,
      id: resolvedId,
      label,
    };
  }).filter((row) => clean(row.id));
  const terms = toList(entry?.relatedTerms).map((id) => {
    const resolved = getIntelligenceEntity(MODE_GLOSSARY, id);
    const resolvedId = clean(resolved?.id) || clean(id);
    const label = clean(resolved?.term) || clean(id);
    return {
      type: MODE_GLOSSARY,
      id: resolvedId,
      label,
    };
  }).filter((row) => clean(row.id));
  const messages = toList(entry?.relatedMessages).map((id) => {
    const resolved = getIntelligenceEntity(MODE_MESSAGE, id);
    const resolvedId = clean(resolved?.id) || clean(id);
    const label = clean(resolved?.title) || clean(id);
    return {
      type: MODE_MESSAGE,
      id: resolvedId,
      label,
    };
  }).filter((row) => clean(row.id));
  const models = toList(entry?.relatedModels).map((id) => {
    const resolved = getIntelligenceEntity(MODE_MODEL, id);
    const resolvedId = clean(resolved?.id) || clean(id);
    const label = clean(resolved?.displayName) || clean(id);
    return {
      type: MODE_MODEL,
      id: resolvedId,
      label,
    };
  }).filter((row) => clean(row.id));
  const playbookIds = [
    ...toList(entry?.relatedPlaybook),
    ...(MODULE_PLAYBOOK_LINKS[clean(entry?.id)] || []),
  ];
  const dedupPlaybookIds = Array.from(new Set(playbookIds.map((id) => clean(id)).filter(Boolean)));
  const playbooks = dedupPlaybookIds.map((id) => {
    const resolved = getIntelligenceEntity(MODE_PLAYBOOK, id);
    const resolvedId = clean(resolved?.id) || clean(id);
    const label = clean(resolved?.title) || clean(id);
    return {
      type: MODE_PLAYBOOK,
      id: resolvedId,
      label,
    };
  }).filter((row) => clean(row.id));
  return [...modules, ...models, ...terms, ...messages, ...playbooks];
}

function fallbackGlossaryTermsForStage(stageId){
  const id = clean(stageId).toLowerCase();
  return STAGE_GLOSSARY_DEFAULTS[id] || Object.freeze(["readiness", "confidence", "signal"]);
}

function resolveGlossaryLink(termId){
  const resolved = getIntelligenceEntity(MODE_GLOSSARY, termId);
  if (!resolved) return null;
  const id = clean(resolved?.id);
  if (!id) return null;
  return {
    type: MODE_GLOSSARY,
    id,
    label: clean(resolved?.term) || id,
  };
}

function withFallbackGlossaryLinks(links, context, entry){
  const list = Array.isArray(links) ? links.slice() : [];
  const seen = new Set(
    list
      .filter((row) => clean(row?.type).toLowerCase() === MODE_GLOSSARY)
      .map((row) => clean(row?.id))
      .filter(Boolean),
  );
  const preferred = toList(entry?.relatedTerms);
  const fallback = fallbackGlossaryTermsForStage(context?.stageId);
  for (const termId of [...preferred, ...fallback]){
    const row = resolveGlossaryLink(termId);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    list.push(row);
  }
  return list;
}

function resolveModuleMode(input, context){
  const stageDefault = getDefaultModuleForStage(context.stageId);
  const moduleId = clean(input.moduleId) || stageDefault;
  const entry = getIntelligenceEntity(MODE_MODULE, moduleId);
  const trust = buildDecisionTrustSurface({
    stageId: context.stageId,
    shellView: context.shellView,
    stageViews: context.stageViews,
  });
  if (!entry){
    return {
      mode: MODE_MODULE,
      title: "Doctrine Missing",
      subtitle: `No doctrine entry found for module '${moduleId}'.`,
      sections: [],
      links: [],
      trust,
    };
  }
  const links = withFallbackGlossaryLinks(relatedLinks(entry), context, entry);
  return {
    mode: MODE_MODULE,
    id: entry.id,
    title: entry.title,
    subtitle: injectLiveValues(entry.summary || "", context),
    sections: buildModuleSections(entry, context),
    links,
    trust,
  };
}

function resolveModelMode(input, context){
  const fallbackId = getDefaultModelForStage(context.stageId);
  const modelId = clean(input.modelId) || fallbackId;
  const entry = getIntelligenceEntity(MODE_MODEL, modelId);
  if (!entry){
    return {
      mode: MODE_MODEL,
      title: "Model Definition Missing",
      subtitle: modelId ? `No model registry entry found for '${modelId}'.` : "Select a model definition.",
      sections: [],
      links: [],
    };
  }
  const implementationBits = [];
  if (clean(entry?.canonicalImplementation?.module)){
    implementationBits.push(clean(entry.canonicalImplementation.module));
  }
  if (clean(entry?.canonicalImplementation?.fn)){
    implementationBits.push(`#${clean(entry.canonicalImplementation.fn)}`);
  }
  const implementationLabel = implementationBits.join("");
  const links = withFallbackGlossaryLinks(relatedLinks({
    ...entry,
    relatedModules: toList(entry?.relatedDoctrinePages),
    relatedPlaybook: toList(entry?.relatedPlaybookEntries),
  }), context, entry);
  return {
    mode: MODE_MODEL,
    id: entry.id,
    title: entry.displayName || entry.id,
    subtitle: injectLiveValues(entry.purpose || "", context),
    sections: [
      makeSection({ id: "purpose", label: "Purpose", body: injectLiveValues(entry.purpose || "", context), variant: "hero" }),
      makeSection({ id: "formula", label: "Formula Label", body: injectLiveValues(entry.formulaLabel || "", context), variant: "mini-row" }),
      makeSection({ id: "implementation", label: "Canonical Implementation", body: injectLiveValues(implementationLabel || "Unassigned", context), expandable: true }),
      makeSection({ id: "output", label: "Output", body: injectLiveValues(entry.outputName || "", context) }),
      makeSection({ id: "layer", label: "Architecture Layer", body: injectLiveValues(entry.architectureLayer || "", context), variant: "mini-row" }),
      makeSection({
        id: "inputs",
        label: "Required Inputs",
        body: injectLiveValues(toList(entry.requiredInputs).join(", "), context),
      }),
      makeSection({
        id: "usedBy",
        label: "Used In",
        body: injectLiveValues(toList(entry.whereUsed).join(", "), context),
      }),
      makeSection({ id: "status", label: "Status", body: injectLiveValues(clean(entry.status) || "planned", context), variant: "mini-row" }),
      makeSection({ id: "notes", label: "Coverage Notes", body: injectLiveValues(entry.notes || "", context), expandable: true }),
    ].filter((row) => clean(row.body) || row.items.length),
    links,
  };
}

function resolveGlossaryMode(input, context){
  const termId = clean(input.termId);
  const entry = getIntelligenceEntity(MODE_GLOSSARY, termId);
  if (!entry){
    return {
      mode: MODE_GLOSSARY,
      title: "Glossary Term Missing",
      subtitle: termId ? `No glossary entry found for '${termId}'.` : "Select a glossary term.",
      sections: [],
      links: [],
    };
  }
  const links = withFallbackGlossaryLinks(relatedLinks(entry), context, entry);
  return {
    mode: MODE_GLOSSARY,
    id: entry.id,
    title: entry.term,
    subtitle: injectLiveValues(entry.definition || "", context),
    sections: [
      makeSection({
        id: "definition",
        label: "Definition",
        body: injectLiveValues(entry.definition || "", context),
        variant: "hero",
      }),
      makeSection({
        id: "whyItMatters",
        label: "Why It Matters",
        body: injectLiveValues(entry.whyItMatters || "", context),
      }),
    ].filter((row) => clean(row.body) || row.items.length),
    links,
  };
}

function resolveMessageMode(input, context){
  const messageId = clean(input.messageId);
  const entry = getIntelligenceEntity(MODE_MESSAGE, messageId);
  if (!entry){
    return {
      mode: MODE_MESSAGE,
      title: "Message Definition Missing",
      subtitle: messageId ? `No message entry found for '${messageId}'.` : "Select a message definition.",
      sections: [],
      links: [],
    };
  }
  const links = withFallbackGlossaryLinks(relatedLinks(entry), context, entry);
  return {
    mode: MODE_MESSAGE,
    id: entry.id,
    title: entry.title,
    subtitle: injectLiveValues(entry.meaning || "", context),
    sections: [
      makeSection({ id: "meaning", label: "What It Means", body: injectLiveValues(entry.meaning || "", context), variant: "hero" }),
      makeSection({ id: "why", label: "Why It Happens", body: injectLiveValues(entry.whyItHappens || "", context) }),
      makeSection({ id: "do", label: "What To Do", body: injectLiveValues(entry.whatToDo || "", context), variant: "mini-row" }),
      makeSection({ id: "affects", label: "What It Affects", body: injectLiveValues(entry.whatItAffects || "", context) }),
      makeSection({ id: "ignored", label: "If Ignored", body: injectLiveValues(entry.ifIgnored || "", context), expandable: true }),
    ].filter((row) => clean(row.body) || row.items.length),
    links,
    kind: clean(entry.kind),
  };
}

function resolvePlaybookMode(input, context){
  const fallbackId = getDefaultPlaybookForStage(context.stageId);
  const playbookId = clean(input.playbookId)
    || resolvePlaybookIdForSignals(context.playbookSignals, { fallbackId });
  const entry = getIntelligenceEntity(MODE_PLAYBOOK, playbookId);
  if (!entry){
    return {
      mode: MODE_PLAYBOOK,
      title: "Playbook Entry Missing",
      subtitle: playbookId ? `No playbook entry found for '${playbookId}'.` : "Select a playbook entry.",
      sections: [],
      links: [],
    };
  }
  const triggerResult = evaluatePlaybookTrigger(entry, context.playbookSignals);
  const triggerSummary = formatPlaybookTriggerSummary(triggerResult);
  const triggerRules = Array.isArray(entry?.triggerRules) ? entry.triggerRules : [];
  const triggerRuleText = triggerRules
    .map((rule) => clean(rule?.label) || clean(rule?.signal))
    .filter(Boolean)
    .join(" | ");
  const links = withFallbackGlossaryLinks(relatedLinks(entry), context, entry);
  return {
    mode: MODE_PLAYBOOK,
    id: entry.id,
    title: entry.title,
    subtitle: injectLiveValues(entry.summary || "", context),
    sections: [
      makeSection({
        id: "triggerCondition",
        label: "Trigger Condition",
        body: injectLiveValues(entry.triggerCondition || entry.situation || "", context),
        variant: "hero",
      }),
      makeSection({
        id: "triggerSignals",
        label: "Signal Pattern",
        body: injectLiveValues(triggerRuleText || entry.watchSignals || "", context),
      }),
      makeSection({
        id: "triggerMatch",
        label: "Current-State Match",
        body: injectLiveValues(
          triggerSummary || "No current-state trigger match detected. Manual selection still allowed.",
          context,
        ),
        variant: "mini-row",
      }),
      makeSection({
        id: "patternMeans",
        label: "What This Pattern Means",
        body: injectLiveValues(entry.whatPatternMeans || "", context),
      }),
      makeSection({
        id: "whyMatters",
        label: "Why It Matters",
        body: injectLiveValues(entry.whyItMatters || "", context),
      }),
      makeSection({
        id: "doNow",
        label: "What To Do",
        body: formatActionList(entry.whatToDo, context) || injectLiveValues(entry.disciplinedResponse || "", context),
        variant: "mini-row",
      }),
      makeSection({
        id: "dontDo",
        label: "What Not To Do",
        body: formatActionList(entry.whatNotToDo, context),
        variant: "callout",
      }),
      makeSection({
        id: "trap",
        label: "Common Trap",
        body: injectLiveValues(entry.commonTrap || entry.commonTraps || "", context),
        expandable: true,
      }),
    ].filter((row) => clean(row.body) || row.items.length),
    links,
  };
}

function resolveSearchMode(input){
  const query = clean(input.query);
  const rows = query ? searchIntelligence(query, { limit: 24 }) : [];
  return {
    mode: MODE_SEARCH,
    title: "Search",
    subtitle: query ? `Results for "${query}"` : "Search doctrine, models, playbook, glossary, and message definitions.",
    query,
    results: rows.map((row) => ({
      type: row.type,
      id: row.id,
      title: row.title,
      summary: row.summary,
      score: Number(row.score || 0),
    })),
    sections: [],
    links: [],
  };
}

/**
 * @param {{
 *   mode?: string,
 *   moduleId?: string,
 *   modelId?: string,
 *   termId?: string,
 *   messageId?: string,
 *   query?: string,
 *   context?: any,
 *   playbookSignals?: any,
 * }=} input
 */
export function resolveIntelligencePayload(input = {}){
  const src = (input && typeof input === "object") ? input : {};
  const mode = normalizeIntelligenceMode(src.mode);
  const context = normalizeContext(src.context);
  if (mode === MODE_MODEL) return resolveModelMode(src, context);
  if (mode === MODE_GLOSSARY) return resolveGlossaryMode(src, context);
  if (mode === MODE_MESSAGE) return resolveMessageMode(src, context);
  if (mode === MODE_PLAYBOOK) return resolvePlaybookMode(src, context);
  if (mode === MODE_SEARCH) return resolveSearchMode(src);
  return resolveModuleMode(src, context);
}
