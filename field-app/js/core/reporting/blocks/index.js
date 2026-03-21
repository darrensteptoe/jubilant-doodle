// @ts-check

let nextBlockId = 1;

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function makeId(prefix = "block") {
  const id = `${prefix}_${nextBlockId}`;
  nextBlockId += 1;
  return id;
}

export function resetBlockIdCounter() {
  nextBlockId = 1;
}

export function createBlock(type, payload = {}, { id = "", sectionId = "" } = {}) {
  return {
    id: cleanText(id) || makeId(type),
    type: cleanText(type),
    sectionId: cleanText(sectionId),
    ...clone(payload || {}),
  };
}

export function createHeadlineBlock(payload = {}, options = {}) {
  return createBlock("headline", payload, options);
}

export function createStatusBlock(payload = {}, options = {}) {
  return createBlock("status", payload, options);
}

export function createMetricGridBlock(payload = {}, options = {}) {
  return createBlock("metric_grid", payload, options);
}

export function createTrendBlock(payload = {}, options = {}) {
  return createBlock("trend", payload, options);
}

export function createBenchmarkBlock(payload = {}, options = {}) {
  return createBlock("benchmark", payload, options);
}

export function createRiskBlock(payload = {}, options = {}) {
  return createBlock("risk", payload, options);
}

export function createRecommendationBlock(payload = {}, options = {}) {
  return createBlock("recommendation", payload, options);
}

export function createActionOwnerBlock(payload = {}, options = {}) {
  return createBlock("action_owner", payload, options);
}

export function createConfidenceMethodologyBlock(payload = {}, options = {}) {
  return createBlock("confidence_methodology", payload, options);
}

export function createAppendixBlock(payload = {}, options = {}) {
  return createBlock("appendix", payload, options);
}

export function flattenSectionBlocks(sections = []) {
  const out = [];
  const rows = Array.isArray(sections) ? sections : [];
  rows.forEach((section) => {
    const sectionId = cleanText(section?.id || "");
    const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
    blocks.forEach((block) => {
      if (!block || typeof block !== "object") return;
      out.push({
        ...clone(block),
        sectionId: cleanText(block.sectionId || sectionId),
      });
    });
  });
  return out;
}
