// @ts-check

import { clone, ensureCanonicalState } from "./_core.js";

export function selectDistrictCanonicalView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const district = canonical.domains?.district || {};
  const ballot = canonical.domains?.ballot || {};
  const candidateHistory = canonical.domains?.candidateHistory || {};
  const targeting = canonical.domains?.targeting || {};
  const census = canonical.domains?.census || {};
  const electionData = canonical.domains?.electionData || {};

  return {
    revision: Number(canonical.revision || 0),
    districtRevision: Number(district.revision || 0),
    templateProfile: clone(district.templateProfile || {}),
    form: clone(district.form || {}),
    universeComposition: clone(district.universeComposition || {}),
    ballot: {
      yourCandidateId: ballot.yourCandidateId || "",
      undecidedPct: ballot.undecidedPct ?? null,
      undecidedMode: ballot.undecidedMode || "",
      candidateRefs: clone(ballot.candidateRefs || { byId: {}, order: [] }),
      userSplitByCandidateId: clone(ballot.userSplitByCandidateId || {}),
    },
    candidateHistory: {
      records: clone(candidateHistory.records || []),
      matchedRecordCount: Number(candidateHistory.matchedRecordCount || 0),
    },
    targetingConfig: clone(targeting.config || {}),
    censusConfig: clone(census.config || {}),
    electionDataMeta: {
      importedAt: electionData?.import?.importedAt || "",
      fileName: electionData?.import?.fileName || "",
      qualityScore: electionData?.quality?.score ?? null,
      confidenceBand: electionData?.quality?.confidenceBand || "unknown",
      normalizedRowCount: Array.isArray(electionData?.normalizedRows) ? electionData.normalizedRows.length : 0,
    },
  };
}

