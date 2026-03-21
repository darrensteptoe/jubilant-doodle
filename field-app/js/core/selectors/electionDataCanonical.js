// @ts-check

import { clone, ensureCanonicalState } from "./_core.js";

export function selectElectionDataCanonicalView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const electionData = canonical.domains?.electionData || {};

  return {
    revision: Number(electionData.revision || 0),
    import: clone(electionData.import || {}),
    schemaMapping: clone(electionData.schemaMapping || {}),
    rawRows: clone(electionData.rawRows || []),
    normalizedRows: clone(electionData.normalizedRows || []),
    jurisdictionKeys: clone(electionData.jurisdictionKeys || []),
    raceMeta: clone(electionData.raceMeta || {}),
    geographyRefs: clone(electionData.geographyRefs || { byId: {}, order: [] }),
    candidateRefs: clone(electionData.candidateRefs || { byId: {}, order: [] }),
    partyRefs: clone(electionData.partyRefs || { byId: {}, order: [] }),
    turnoutTotals: clone(electionData.turnoutTotals || {}),
    voteTotals: clone(electionData.voteTotals || {}),
    qa: clone(electionData.qa || {}),
    quality: clone(electionData.quality || {}),
    benchmarks: clone(electionData.benchmarks || {}),
  };
}

