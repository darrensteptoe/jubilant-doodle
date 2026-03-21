export const TEMPLATE_DIMENSION_SELECTS = [
  { id: "v3DistrictOfficeLevel", field: "officeLevel", label: "Office level" },
  { id: "v3DistrictElectionType", field: "electionType", label: "Election type" },
  { id: "v3DistrictSeatContext", field: "seatContext", label: "Seat context" },
  { id: "v3DistrictPartisanshipMode", field: "partisanshipMode", label: "Partisanship mode" },
  { id: "v3DistrictSalienceLevel", field: "salienceLevel", label: "Salience level" },
];

export function hydrateTemplateDimensionOptions({ hydrateSelectOptions, listTemplateDimensionOptions }) {
  TEMPLATE_DIMENSION_SELECTS.forEach(({ id, field, label }) => {
    const options = listTemplateDimensionOptions(field);
    const withPlaceholder = [{ value: "", label: `Select ${label.toLowerCase()}` }, ...options];
    hydrateSelectOptions(id, withPlaceholder);
  });
}

export function syncDistrictTemplateProfile(templateSnapshot) {
  const target = document.getElementById("v3DistrictTemplateMeta");
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const snapshot = templateSnapshot && typeof templateSnapshot === "object" ? templateSnapshot : null;
  if (!snapshot) {
    target.textContent = "Template profile unavailable.";
    return;
  }
  const templateId = String(snapshot.appliedTemplateId || "").trim() || "unresolved";
  const version = String(snapshot.appliedVersion || "").trim();
  const benchmarkKey = String(snapshot.benchmarkKey || "").trim();
  const overrides = Array.isArray(snapshot.overriddenFields) ? snapshot.overriddenFields.length : 0;
  const profile = String(snapshot.assumptionsProfile || "").trim() || (overrides > 0 ? "custom" : "template");
  const candidateHistoryCoverageBand = String(snapshot.candidateHistoryCoverageBand || "").trim();
  const candidateHistoryConfidenceBand = String(snapshot.candidateHistoryConfidenceBand || "").trim();
  const candidateHistoryRecordCount = Number.isFinite(Number(snapshot.candidateHistoryRecordCount))
    ? Number(snapshot.candidateHistoryRecordCount)
    : 0;
  const parts = [`Template: ${templateId}`];
  if (version) parts.push(`v${version}`);
  if (benchmarkKey) parts.push(`Benchmark: ${benchmarkKey}`);
  parts.push(`Profile: ${profile}`);
  parts.push(`Overrides: ${overrides}`);
  if (candidateHistoryRecordCount > 0) {
    parts.push(`History: ${candidateHistoryRecordCount} row(s), ${candidateHistoryCoverageBand || "none"} coverage, ${candidateHistoryConfidenceBand || "missing"} confidence`);
  } else {
    parts.push("History: none");
  }
  target.textContent = parts.join(" · ");
}
