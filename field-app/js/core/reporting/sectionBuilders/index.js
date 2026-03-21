// @ts-check

import { buildClientStandardSections } from "./clientStandard.js";
import { buildElectionDataBenchmarkSections } from "./electionDataBenchmark.js";
import { buildInternalFullSections } from "./internalFull.js";
import { buildPostElectionLearningSections } from "./postElectionLearning.js";
import { buildReadinessAuditSections } from "./readinessAudit.js";
import { buildWarRoomBriefSections } from "./warRoomBrief.js";
import { buildWeeklyActionsSections } from "./weeklyActions.js";

const FAMILY_BUILDERS = Object.freeze({
  internal_full: buildInternalFullSections,
  client_standard: buildClientStandardSections,
  war_room_brief: buildWarRoomBriefSections,
  weekly_actions: buildWeeklyActionsSections,
  readiness_audit: buildReadinessAuditSections,
  election_data_benchmark: buildElectionDataBenchmarkSections,
  post_election_learning: buildPostElectionLearningSections,
});

export function buildReportSections(reportType, context) {
  const builder = FAMILY_BUILDERS[reportType] || FAMILY_BUILDERS.internal_full;
  return builder(context);
}
