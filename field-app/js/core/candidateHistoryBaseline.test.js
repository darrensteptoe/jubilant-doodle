// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveCandidateHistoryBaseline,
  normalizeCandidateHistoryRecord,
} from "./candidateHistoryBaseline.js";

function makeHistoryRow(office, overrides = {}){
  return {
    recordId: "history_1",
    office,
    cycleYear: 2022,
    electionType: "general",
    candidateName: "Candidate A",
    party: "DEM",
    incumbencyStatus: "incumbent",
    voteShare: 52.1,
    margin: 4.2,
    turnoutContext: 49.8,
    repeatCandidate: true,
    overUnderPerformancePct: 2.8,
    ...overrides,
  };
}

function makeCandidates(){
  return [
    { id: "cand_a", name: "Candidate A", supportPct: 45 },
    { id: "cand_b", name: "Candidate B", supportPct: 45 },
  ];
}

test("candidate history office normalization: governor matches statewide_executive context", () => {
  const baseline = deriveCandidateHistoryBaseline({
    records: [makeHistoryRow("governor")],
    candidates: makeCandidates(),
    yourCandidateId: "cand_a",
    office: "statewide_executive",
    electionType: "general",
    nowYear: 2026,
  });

  assert.equal(baseline.filteredRecordCount, 1);
  assert.equal(baseline.matchedRecordCount, 1);
  assert.equal(baseline.excludedByOfficeCount, 0);
});

test("candidate history office normalization: statewide governor alias matches statewide_executive context", () => {
  const baseline = deriveCandidateHistoryBaseline({
    records: [makeHistoryRow("statewide governor")],
    candidates: makeCandidates(),
    yourCandidateId: "cand_a",
    office: "statewide_executive",
    electionType: "general",
    nowYear: 2026,
  });

  assert.equal(baseline.filteredRecordCount, 1);
  assert.equal(baseline.matchedRecordCount, 1);
  assert.equal(baseline.excludedByOfficeCount, 0);
});

test("candidate history office normalization: canonical statewide_executive value still matches", () => {
  const baseline = deriveCandidateHistoryBaseline({
    records: [makeHistoryRow("statewide_executive")],
    candidates: makeCandidates(),
    yourCandidateId: "cand_a",
    office: "statewide_executive",
    electionType: "general",
    nowYear: 2026,
  });

  assert.equal(baseline.filteredRecordCount, 1);
  assert.equal(baseline.matchedRecordCount, 1);
  assert.equal(baseline.excludedByOfficeCount, 0);
});

test("candidate history office filtering: blank office remains wildcard", () => {
  const baseline = deriveCandidateHistoryBaseline({
    records: [makeHistoryRow("", { recordId: "history_blank" })],
    candidates: makeCandidates(),
    yourCandidateId: "cand_a",
    office: "statewide_executive",
    electionType: "general",
    nowYear: 2026,
  });

  assert.equal(baseline.filteredRecordCount, 1);
  assert.equal(baseline.matchedRecordCount, 1);
  assert.equal(baseline.excludedByOfficeCount, 0);
});

test("candidate history normalization stores canonical office token instead of raw governor text", () => {
  const normalized = normalizeCandidateHistoryRecord(makeHistoryRow("governor"));
  assert.equal(normalized.office, "statewide_executive");
  assert.notEqual(normalized.office, "governor");
});

test("candidate history matching keeps candidate-id and candidate-name resolution", () => {
  const baseline = deriveCandidateHistoryBaseline({
    records: [
      makeHistoryRow("statewide_executive", {
        recordId: "history_id",
        candidateId: "cand_a",
        candidateName: "Alias Name",
      }),
      makeHistoryRow("statewide_executive", {
        recordId: "history_name",
        candidateName: "Candidate B",
        incumbencyStatus: "challenger",
      }),
    ],
    candidates: makeCandidates(),
    yourCandidateId: "cand_a",
    office: "statewide_executive",
    electionType: "general",
    nowYear: 2026,
  });

  assert.equal(baseline.filteredRecordCount, 2);
  assert.equal(baseline.matchedRecordCount, 2);
  assert.equal(baseline.unmatchedCandidateRecordCount, 0);
  assert.equal(baseline.byCandidateId.cand_a.recordCount, 1);
  assert.equal(baseline.byCandidateId.cand_b.recordCount, 1);
});
