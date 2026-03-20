// @ts-check
import { listIntelligenceEntities } from "./intelligenceRegistry.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function sectionTextFromModule(moduleEntry){
  const sections = moduleEntry?.sections && typeof moduleEntry.sections === "object"
    ? moduleEntry.sections
    : {};
  const out = [];
  for (const value of Object.values(sections)){
    const text = clean(value);
    if (text) out.push(text);
  }
  return out.join(" ");
}

function aliasText(entry){
  const aliases = Array.isArray(entry?.aliases) ? entry.aliases : [];
  return aliases.map((item) => clean(item)).filter(Boolean).join(" ");
}

export function buildIntelligenceSearchIndex(){
  const all = listIntelligenceEntities();
  const rows = [];

  for (const entry of all.modules){
    rows.push({
      type: "module",
      id: clean(entry?.id),
      title: clean(entry?.title),
      summary: clean(entry?.summary),
      text: `${clean(entry?.title)} ${clean(entry?.summary)} ${sectionTextFromModule(entry)}`.trim(),
    });
  }

  for (const entry of all.models || []){
    rows.push({
      type: "model",
      id: clean(entry?.id),
      title: clean(entry?.displayName || entry?.id),
      summary: clean(entry?.purpose),
      text: [
        clean(entry?.displayName || entry?.id),
        clean(entry?.purpose),
        clean(entry?.formulaLabel),
        clean(entry?.outputName),
        clean(entry?.architectureLayer),
        clean(entry?.status),
        clean(entry?.canonicalImplementation?.module),
        clean(entry?.canonicalImplementation?.fn),
      ].join(" ").trim(),
    });
  }

  for (const entry of all.glossary){
    rows.push({
      type: "glossary",
      id: clean(entry?.id),
      title: clean(entry?.term),
      summary: clean(entry?.definition),
      text: `${clean(entry?.term)} ${clean(entry?.definition)} ${clean(entry?.whyItMatters)} ${aliasText(entry)}`.trim(),
    });
  }

  for (const entry of all.messages){
    rows.push({
      type: "message",
      id: clean(entry?.id),
      title: clean(entry?.title),
      summary: clean(entry?.meaning),
      text: [
        clean(entry?.title),
        aliasText(entry),
        clean(entry?.meaning),
        clean(entry?.whyItHappens),
        clean(entry?.whatToDo),
      ].join(" ").trim(),
    });
  }

  for (const entry of all.playbook || []){
    rows.push({
      type: "playbook",
      id: clean(entry?.id),
      title: clean(entry?.title),
      summary: clean(entry?.summary),
      text: [
        clean(entry?.title),
        clean(entry?.summary),
        clean(entry?.triggerCondition || entry?.situation),
        clean(entry?.whatPatternMeans),
        clean(entry?.whyItMatters),
        Array.isArray(entry?.whatToDo) ? entry.whatToDo.map((row) => clean(row)).join(" ") : clean(entry?.whatToDo),
        Array.isArray(entry?.whatNotToDo) ? entry.whatNotToDo.map((row) => clean(row)).join(" ") : clean(entry?.whatNotToDo),
        clean(entry?.commonTrap || entry?.commonTraps),
        clean(entry?.watchSignals),
      ].join(" ").trim(),
    });
  }

  return rows.filter((row) => row.id && row.title && row.text);
}
