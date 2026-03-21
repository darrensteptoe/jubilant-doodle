// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeCanonicalState } from "../state/schema.js";
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
const districtV2SurfacePath = path.resolve(__dirname, "../../app/v3/surfaces/districtV2/index.js");
const districtV2Source = fs.readFileSync(districtV2SurfacePath, "utf8");

function extractFunctionBody(source, functionName, nextFunctionName) {
  const pattern = new RegExp(
    `function ${functionName}\\([\\s\\S]*?\\) \\{([\\s\\S]*?)\\n\\}\\n\\nfunction ${nextFunctionName}\\(`,
  );
  const match = source.match(pattern);
  return String(match?.[1] || "");
}

test("district_v2 replacement uses no legacy pending-write hold path", () => {
  assert.doesNotMatch(districtV2Source, /markDistrictPendingWrite\(/);
  assert.doesNotMatch(districtV2Source, /shouldHoldDistrictControlSync\(/);
  assert.doesNotMatch(districtV2Source, /districtPendingWrites/);

  const formFieldBody = extractFunctionBody(districtV2Source, "bindDistrictV2FormField", "bindDistrictV2FormCheckbox");
  assert.match(formFieldBody, /const onCommit = \([^)]*\) => \{/);
  assert.match(formFieldBody, /control\.addEventListener\("input", onCommit\);/);
  assert.match(formFieldBody, /control\.addEventListener\("change", onCommit\);/);

  const syncInputBody = extractFunctionBody(districtV2Source, "syncInputControlInPlace", "syncCheckboxControlInPlace");
  assert.match(syncInputBody, /if \(document\.activeElement === control\) \{/);
});

test("district_v2 ballot and candidate-history handlers stay delegated and hold-free", () => {
  const ballotBody = extractFunctionBody(districtV2Source, "bindDistrictV2BallotHandlers", "bindDistrictV2CandidateHistoryHandlers");
  const historyBody = extractFunctionBody(districtV2Source, "bindDistrictV2CandidateHistoryHandlers", "bindDistrictV2TargetingHandlers");

  assert.match(ballotBody, /candidateBody\.addEventListener\("change"/);
  assert.match(ballotBody, /candidateBody\.addEventListener\("click"/);
  assert.match(ballotBody, /userSplitList\.addEventListener\("change"/);
  assert.match(historyBody, /historyBody\.addEventListener\("change"/);
  assert.match(historyBody, /historyBody\.addEventListener\("click"/);

  assert.doesNotMatch(ballotBody, /markDistrictPendingWrite\(/);
  assert.doesNotMatch(historyBody, /markDistrictPendingWrite\(/);
});

test("district_v2 Race Context select/date/number persist after reopen", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T15:00:00.000Z") });
  state = updateDistrictTemplateField(state, { field: "raceType", value: "county_commission" }).state;
  state = updateDistrictTemplateField(state, { field: "officeLevel", value: "county" }).state;
  state = updateDistrictFormField(state, { field: "electionDate", value: "2026-11-03" }).state;
  state = updateDistrictFormField(state, { field: "universeSize", value: 123456 }).state;

  const reopenedCanonical = selectDistrictCanonicalView(JSON.parse(JSON.stringify(state)));
  assert.equal(reopenedCanonical.templateProfile.raceType, "county_commission");
  assert.equal(reopenedCanonical.templateProfile.officeLevel, "county");
  assert.equal(reopenedCanonical.form.electionDate, "2026-11-03");
  assert.equal(reopenedCanonical.form.universeSize, 123456);
});

test("district_v2 Ballot fields persist after reopen", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T15:10:00.000Z") });
  state = addBallotCandidate(state, { name: "Alex Rivera", supportPct: 14 }).state;
  const candidateId = state.domains.ballot.candidateRefs.order.find((id) => id.includes("alex_rivera"));
  assert.ok(candidateId, "expected ballot candidate id");

  state = updateBallotCandidate(state, { candidateId, field: "supportPct", value: 19.5 }).state;
  state = updateBallotUserSplit(state, { candidateId, value: 37 }).state;
  state = setBallotYourCandidate(state, { candidateId }).state;
  state = setBallotUndecided(state, { undecidedPct: 11, undecidedMode: "user_defined" }).state;

  const reopenedCanonical = selectDistrictCanonicalView(JSON.parse(JSON.stringify(state)));
  assert.equal(reopenedCanonical.ballot.yourCandidateId, candidateId);
  assert.equal(reopenedCanonical.ballot.undecidedPct, 11);
  assert.equal(reopenedCanonical.ballot.userSplitByCandidateId[candidateId], 37);
});

test("district_v2 Candidate History fields persist after reopen", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T15:15:00.000Z") });
  state = addCandidateHistoryRecord(state, {
    recordId: "history_a",
    office: "City Council",
    cycleYear: 2022,
    electionType: "general",
    candidateName: "Casey Park",
    voteShare: 51.4,
  }).state;
  state = updateCandidateHistoryRecord(state, {
    recordId: "history_a",
    field: "margin",
    value: 3.2,
  }).state;

  const reopenedCanonical = selectDistrictCanonicalView(JSON.parse(JSON.stringify(state)));
  assert.equal(reopenedCanonical.candidateHistory.records[0]?.recordId, "history_a");
  assert.equal(reopenedCanonical.candidateHistory.records[0]?.margin, 3.2);
});

test("district_v2 values survive navigation and refresh snapshots", () => {
  let state = makeCanonicalState({ nowDate: new Date("2026-03-21T15:30:00.000Z") });
  state = updateDistrictFormField(state, { field: "electionDate", value: "2026-11-03" }).state;
  state = updateDistrictFormField(state, { field: "universeSize", value: 88888 }).state;
  state = updateDistrictUniverseField(state, { field: "enabled", value: true }).state;

  const canonicalBefore = selectDistrictCanonicalView(state);
  const canonicalAfterNavigation = selectDistrictCanonicalView(JSON.parse(JSON.stringify(state)));

  assert.equal(canonicalBefore.form.electionDate, canonicalAfterNavigation.form.electionDate);
  assert.equal(canonicalBefore.form.universeSize, canonicalAfterNavigation.form.universeSize);
  assert.equal(canonicalBefore.universeComposition.enabled, canonicalAfterNavigation.universeComposition.enabled);
});
