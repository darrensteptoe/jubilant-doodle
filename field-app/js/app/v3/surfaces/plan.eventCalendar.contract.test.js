// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const planSource = fs.readFileSync(path.join(__dirname, "plan.js"), "utf8");
const warRoomSource = fs.readFileSync(path.join(__dirname, "warRoom/index.js"), "utf8");

test("plan contract: calendar/events module is rendered and wired on plan surface", () => {
  assert.match(planSource, /from "\.\/warRoom\/eventCalendar\.js"/);
  assert.match(planSource, /title: "Calendar \/ Events"/);
  assert.match(planSource, /id="v3PlanEventCalendarRoot"/);
  assert.match(planSource, /id="v3PlanDecisionSessionSelect"/);
  assert.match(planSource, /id="v3BtnPlanDecisionNewSession"/);
  assert.match(planSource, /id="v3BtnPlanEventApplyFilters"/);
  assert.match(planSource, /id="v3BtnPlanEventResetFilters"/);
  assert.match(planSource, /id="v3PlanEventActionStatus"/);
  assert.match(planSource, /assignCardStatusId\(eventsCard,\s*"v3PlanEventsCardStatus"\);/);
  assert.match(planSource, /wirePlanDecisionEventCalendarProxies\(\);/);
  assert.match(planSource, /syncWarRoomEventCalendar\(decisionView,\s*\{/);
  assert.match(planSource, /syncPlanEventSessionControls\(decisionView\);/);
  assert.match(planSource, /run\(\(api\) => api\.selectSession\?\./);
  assert.match(planSource, /run\(\(api\) => api\.createSession\?\./);
  assert.match(planSource, /resolvePlanEventActionError\(/);
});

test("plan contract: war room no longer renders calendar/events module", () => {
  assert.doesNotMatch(warRoomSource, /title: "Calendar \/ Events"/);
  assert.doesNotMatch(warRoomSource, /v3DecisionEventModuleBlock/);
});
