// @ts-check

export const REPORT_FAMILIES = Object.freeze({
  internal_full: Object.freeze({
    id: "internal_full",
    label: "Internal Full",
    audience: "internal",
    tone: "operational",
    description: "Full internal operating report with risk, governance, and owner-level actions.",
  }),
  client_standard: Object.freeze({
    id: "client_standard",
    label: "Client Standard",
    audience: "client",
    tone: "strategic",
    description: "Concise strategic client report focused on what changed and what matters now.",
  }),
  war_room_brief: Object.freeze({
    id: "war_room_brief",
    label: "War Room Brief",
    audience: "internal",
    tone: "operational",
    description: "Short-cycle decision brief for war room, diagnostics, and immediate actions.",
  }),
  weekly_actions: Object.freeze({
    id: "weekly_actions",
    label: "Weekly Actions",
    audience: "internal",
    tone: "operational",
    description: "Action-owner weekly plan with blockers, deltas, and due windows.",
  }),
  readiness_audit: Object.freeze({
    id: "readiness_audit",
    label: "Readiness Audit",
    audience: "internal",
    tone: "assurance",
    description: "Readiness and governance control report for assumptions and model confidence.",
  }),
  election_data_benchmark: Object.freeze({
    id: "election_data_benchmark",
    label: "Election Data Benchmark",
    audience: "internal",
    tone: "analytics",
    description: "Benchmark-focused report emphasizing election data quality, comparables, and downstream impact.",
  }),
  post_election_learning: Object.freeze({
    id: "post_election_learning",
    label: "Post-Election Learning",
    audience: "internal",
    tone: "learning",
    description: "Post-election learning report covering deltas, model calibration, and recommended updates.",
  }),
});

export const REPORT_FAMILY_ORDER = Object.freeze([
  "internal_full",
  "client_standard",
  "war_room_brief",
  "weekly_actions",
  "readiness_audit",
  "election_data_benchmark",
  "post_election_learning",
]);

export const REPORT_TYPE_ALIASES = Object.freeze({
  internal: "internal_full",
  client: "client_standard",
});

export const REPORT_DEFAULT_TYPE = "internal_full";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

export function normalizeReportType(reportType, { preserveLegacyAlias = false } = {}) {
  const token = cleanText(reportType).toLowerCase();
  if (!token) {
    return preserveLegacyAlias ? "internal" : REPORT_DEFAULT_TYPE;
  }
  if (Object.prototype.hasOwnProperty.call(REPORT_TYPE_ALIASES, token)) {
    return preserveLegacyAlias ? token : REPORT_TYPE_ALIASES[token];
  }
  if (Object.prototype.hasOwnProperty.call(REPORT_FAMILIES, token)) {
    return token;
  }
  return preserveLegacyAlias ? "internal" : REPORT_DEFAULT_TYPE;
}

export function resolveCanonicalReportType(reportType) {
  return normalizeReportType(reportType, { preserveLegacyAlias: false });
}

export function getReportDefinition(reportType) {
  const id = resolveCanonicalReportType(reportType);
  return REPORT_FAMILIES[id] || REPORT_FAMILIES[REPORT_DEFAULT_TYPE];
}

export function listReportTypeOptions() {
  return REPORT_FAMILY_ORDER.map((id) => {
    const row = REPORT_FAMILIES[id];
    return {
      id: row.id,
      label: row.label,
      audience: row.audience,
      description: row.description,
    };
  });
}

export function toLegacyAlias(reportType) {
  const canonical = resolveCanonicalReportType(reportType);
  if (canonical === "internal_full") return "internal";
  if (canonical === "client_standard") return "client";
  return canonical;
}
