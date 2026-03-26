// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveContextPatchFailureStatus,
  validateContextScopeDraft,
} from "./contextScopeDraft.js";

test("context scope draft: valid campaign/office slugs normalize cleanly", () => {
  const result = validateContextScopeDraft({
    campaignId: " IL HD 21 ",
    officeId: " West Field ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.normalizedCampaignId, "il-hd-21");
  assert.equal(result.normalizedOfficeId, "west-field");
  assert.equal(result.issues.length, 0);
});

test("context scope draft: invalid campaign id is rejected with explicit message", () => {
  const result = validateContextScopeDraft({
    campaignId: "!!!",
    officeId: "west-field",
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.code, "invalid_campaign_id");
  assert.match(String(result.issues[0]?.message || ""), /Campaign ID is invalid/i);
});

test("context scope draft: invalid office id is rejected with explicit message", () => {
  const result = validateContextScopeDraft({
    campaignId: "il-hd-21",
    officeId: "###",
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.code, "invalid_office_id");
  assert.match(String(result.issues[0]?.message || ""), /Office ID is invalid/i);
});

test("context scope draft: locked and invalid context patch failures map to user-facing status", () => {
  assert.match(
    resolveContextPatchFailureStatus({ code: "campaign_locked" }).statusText,
    /locked by URL/i,
  );
  assert.match(
    resolveContextPatchFailureStatus({ code: "invalid_campaign_id" }).statusText,
    /Campaign ID is invalid/i,
  );
});
