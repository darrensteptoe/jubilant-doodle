// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeCanonicalState } from "../state/schema.js";
import {
  deriveDistrictBaselineCardStatus,
  deriveDistrictElectorateCardStatus,
  deriveDistrictRaceCardStatus,
} from "../districtView.js";
import {
  updateDistrictFormField,
  updateDistrictTemplateField,
  updateDistrictUniverseField,
} from "../actions/district.js";
import {
  addBallotCandidate,
  setBallotUndecided,
  setBallotYourCandidate,
  updateBallotCandidate,
  updateBallotUserSplit,
} from "../actions/ballot.js";
import {
  addCandidateHistoryRecord,
  updateCandidateHistoryRecord,
} from "../actions/candidateHistory.js";
import { selectDistrictCanonicalView } from "./districtCanonical.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const districtSurfacePath = path.resolve(__dirname, "../../app/v3/surfaces/district/index.js");
const outcomeSurfacePath = path.resolve(__dirname, "../../app/v3/surfaces/outcome/index.js");

const districtSource = fs.readFileSync(districtSurfacePath, "utf8");
const outcomeSource = fs.readFileSync(outcomeSurfacePath, "utf8");

function extractFunctionBody(source, functionName, nextFunctionName) {
  const pattern = new RegExp(
    `function ${functionName}\\([\\s\\S]*?\\) \\{([\\s\\S]*?)\\n\\}\\n\\nfunction ${nextFunctionName}\\(`,
  );
  const match = source.match(pattern);
  return String(match?.[1] || "");
}

test("replacement reference architecture: outcome card binder pattern is present and explicit", () => {
  assert.match(outcomeSource, /function bindOutcomeInputField\(/);
  assert.match(outcomeSource, /function bindOutcomeSelectField\(/);
  assert.match(outcomeSource, /function syncOutcomeInputValue\(/);
  assert.match(outcomeSource, /if \(document\.activeElement === input\) \{\s*return;\s*\}/);
});

test("district replacement form binders follow standard input+change commit pattern without pending-write hydration hold", () => {
  const fieldBody = extractFunctionBody(districtSource, "bindDistrictFormField", "bindDistrictFormCheckbox");
  assert.match(fieldBody, /const onCommit = \(\) => \{/);
  assert.match(fieldBody, /control\.addEventListener\("input", onCommit\);/);
  assert.match(fieldBody, /control\.addEventListener\("change", onCommit\);/);
  assert.doesNotMatch(fieldBody, /markDistrictPendingWrite\(/);

  const selectBody = extractFunctionBody(districtSource, "bindDistrictFormSelect", "bindDistrictFormField");
  assert.doesNotMatch(selectBody, /markDistrictPendingWrite\(/);
});

test("district replacement ballot + candidate history cards use delegated change/click handlers", () => {
  const ballotHandlerBody = extractFunctionBody(
    districtSource,
    "bindDistrictBallotReplacementHandlers",
    "bindDistrictCandidateHistoryReplacementHandlers",
  );
  assert.match(ballotHandlerBody, /candidateBody\.addEventListener\("change"/);
  assert.match(ballotHandlerBody, /candidateBody\.addEventListener\("click"/);
  assert.match(ballotHandlerBody, /userSplitList\.addEventListener\("change"/);

  const historyHandlerBody = extractFunctionBody(
    districtSource,
    "bindDistrictCandidateHistoryReplacementHandlers",
    "syncDistrictBallotBaseline",
  );
  assert.match(historyHandlerBody, /historyBody\.addEventListener\("change"/);
  assert.match(historyHandlerBody, /historyBody\.addEventListener\("click"/);

  const candidateTableBody = extractFunctionBody(districtSource, "syncDistrictCandidateTable", "syncDistrictUserSplitTable");
  assert.doesNotMatch(candidateTableBody, /addEventListener\("input"/);
  const historyTableBody = extractFunctionBody(districtSource, "syncDistrictCandidateHistoryTable", "syncDistrictBallotWarning");
  assert.doesNotMatch(historyTableBody, /addEventListener\("input"/);
});

test("replacement race context card: select/date/number inputs persist through canonical state and reopen", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T12:00:00.000Z") });
  state = updateDistrictTemplateField(state, { field: "raceType", value: "city_council" }).state;
  state = updateDistrictTemplateField(state, { field: "officeLevel", value: "local" }).state;
  state = updateDistrictFormField(state, { field: "electionDate", value: "2026-11-03" }).state;
  state = updateDistrictFormField(state, { field: "weeksRemaining", value: "20" }).state;

  const canonical = selectDistrictCanonicalView(state);
  assert.equal(canonical.templateProfile.raceType, "city_council");
  assert.equal(canonical.templateProfile.officeLevel, "local");
  assert.equal(canonical.form.electionDate, "2026-11-03");
  assert.equal(canonical.form.weeksRemaining, "20");
  assert.equal(
    deriveDistrictRaceCardStatus({
      raceType: canonical.templateProfile.raceType,
      electionDate: canonical.form.electionDate,
      mode: canonical.form.mode || "persuasion",
    }),
    "Configured",
  );

  const reopened = JSON.parse(JSON.stringify(state));
  const reopenedCanonical = selectDistrictCanonicalView(reopened);
  assert.equal(reopenedCanonical.templateProfile.raceType, "city_council");
  assert.equal(reopenedCanonical.form.electionDate, "2026-11-03");
  assert.equal(reopenedCanonical.form.weeksRemaining, "20");
});

test("replacement electorate card: numeric/select/toggle values persist through navigation/reopen and status updates", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T12:30:00.000Z") });
  state = updateDistrictFormField(state, { field: "universeSize", value: "98000" }).state;
  state = updateDistrictFormField(state, { field: "universeBasis", value: "registered" }).state;
  state = updateDistrictFormField(state, { field: "sourceNote", value: "County file" }).state;
  state = updateDistrictUniverseField(state, { field: "enabled", value: true }).state;
  state = updateDistrictUniverseField(state, { field: "demPct", value: 38 }).state;

  const canonical = selectDistrictCanonicalView(state);
  assert.equal(canonical.form.universeSize, 98000);
  assert.equal(canonical.form.universeBasis, "registered");
  assert.equal(canonical.form.sourceNote, "County file");
  assert.equal(canonical.universeComposition.enabled, true);
  assert.equal(canonical.universeComposition.demPct, 38);
  assert.equal(
    deriveDistrictElectorateCardStatus({
      universe: String(canonical.form.universeSize),
      basis: canonical.form.universeBasis,
      sourceNote: canonical.form.sourceNote,
    }),
    "Sourced",
  );

  const reopened = JSON.parse(JSON.stringify(state));
  const reopenedCanonical = selectDistrictCanonicalView(reopened);
  assert.equal(reopenedCanonical.form.universeSize, 98000);
  assert.equal(reopenedCanonical.universeComposition.enabled, true);
});

test("replacement ballot card: candidate rows and ballot controls persist through reopen", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T13:00:00.000Z") });
  state = addBallotCandidate(state, { name: "Alex Rivera", supportPct: 14 }).state;
  const candidateId = state.domains.ballot.candidateRefs.order.find((id) => id.includes("alex_rivera"));
  assert.ok(candidateId, "expected ballot candidate id");

  state = updateBallotCandidate(state, { candidateId, field: "supportPct", value: 19.5 }).state;
  state = updateBallotUserSplit(state, { candidateId, value: 37 }).state;
  state = setBallotYourCandidate(state, { candidateId }).state;
  state = setBallotUndecided(state, { undecidedPct: 11, undecidedMode: "user_defined" }).state;

  const canonical = selectDistrictCanonicalView(state);
  assert.equal(canonical.ballot.yourCandidateId, candidateId);
  assert.equal(canonical.ballot.undecidedPct, 11);
  assert.equal(canonical.ballot.undecidedMode, "user_defined");
  assert.equal(canonical.ballot.candidateRefs.byId[candidateId].supportPct, 19.5);
  assert.equal(canonical.ballot.userSplitByCandidateId[candidateId], 37);
  assert.equal(
    deriveDistrictBaselineCardStatus({
      warning: "",
      supportTotal: "100.0%",
    }),
    "Balanced",
  );

  const reopened = JSON.parse(JSON.stringify(state));
  const reopenedCanonical = selectDistrictCanonicalView(reopened);
  assert.equal(reopenedCanonical.ballot.yourCandidateId, candidateId);
  assert.equal(reopenedCanonical.ballot.userSplitByCandidateId[candidateId], 37);
});

test("replacement candidate history card: row add/edit persists through reopen", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T13:15:00.000Z") });
  state = addCandidateHistoryRecord(state, {
    office: "City Council",
    cycleYear: 2022,
    electionType: "general",
    candidateName: "Alex Rivera",
    party: "NPA",
    voteShare: 52.2,
  }).state;
  const recordId = state.domains.candidateHistory.records[0]?.recordId;
  assert.ok(recordId, "expected candidate history record id");

  state = updateCandidateHistoryRecord(state, {
    recordId,
    field: "margin",
    value: 4.8,
  }).state;

  const canonical = selectDistrictCanonicalView(state);
  assert.equal(canonical.candidateHistory.records.length, 1);
  assert.equal(canonical.candidateHistory.records[0].recordId, recordId);
  assert.equal(canonical.candidateHistory.records[0].margin, 4.8);

  const reopened = JSON.parse(JSON.stringify(state));
  const reopenedCanonical = selectDistrictCanonicalView(reopened);
  assert.equal(reopenedCanonical.candidateHistory.records.length, 1);
  assert.equal(reopenedCanonical.candidateHistory.records[0].margin, 4.8);
});

