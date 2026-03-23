const DATA_REPORT_STATUS_FALLBACK = "Choose report type and compose.";
const REPORT_GUIDANCE_FALLBACK = "Select a report type to see what conversation it is built for.";
const REPORT_GUIDANCE = Object.freeze({
  internal_full: Object.freeze({
    label: "Internal Full",
    audience: "Audience: Internal leadership and senior operators",
    purpose: "Purpose: Full operating read with risk, assumptions, trust, and owner-level action context.",
    whenToUse: "Use before strategy meetings, major resource decisions, internal reviews, and any moment when the team needs the full picture rather than a simplified summary.",
    decisionSupport: "Best for decisions about scope, pacing, staffing, budget posture, and whether the current path is genuinely strong enough to trust.",
    cadence: "Recommended cadence: Weekly, and again before any high-stakes shift in plan.",
    operatorNote: "This is the default internal truth-telling report. Use it when the team needs the whole story, including uncertainty and weaknesses.",
  }),
  client_standard: Object.freeze({
    label: "Client Standard",
    audience: "Audience: Candidate, client, principal, or external stakeholder",
    purpose: "Purpose: Strategic summary of what changed, what matters now, and what leadership should understand without drowning in internal detail.",
    whenToUse: "Use before client calls, principal briefings, candidate updates, and external-facing strategy conversations.",
    decisionSupport: "Best for decisions about message framing, confidence posture, major asks, and what the client should focus on right now.",
    cadence: "Recommended cadence: Weekly or at each major turning point.",
    operatorNote: "This report should stay clear, calm, and honest. It should not hide risk, but it should translate the internal picture into leadership-ready language.",
  }),
  war_room_brief: Object.freeze({
    label: "War Room Brief",
    audience: "Audience: Internal war room, rapid-response team, senior day-to-day decision makers",
    purpose: "Purpose: Fast decision brief for the current operating window.",
    whenToUse: "Use before daily huddles, same-day pivots, major event windows, weather disruptions, turnout scares, or rapid field-response conversations.",
    decisionSupport: "Best for decisions that must be made quickly: whether to hold, shift, escalate, reduce, or redirect effort right now.",
    cadence: "Recommended cadence: Daily when conditions are moving, otherwise as needed.",
    operatorNote: "This is not a full narrative report. It is a decision brief. Keep it tight, immediate, and action-oriented.",
  }),
  weekly_actions: Object.freeze({
    label: "Weekly Actions",
    audience: "Audience: Internal managers, functional leads, execution owners",
    purpose: "Purpose: Turn the current picture into owned work for the next seven days.",
    whenToUse: "Use after weekly check-ins, pace reviews, organizer meetings, and anytime the team needs to convert analysis into assignments.",
    decisionSupport: "Best for decisions about who owns what, what must move this week, and which blockers need direct intervention.",
    cadence: "Recommended cadence: Weekly.",
    operatorNote: "This report should answer one practical question: what exactly needs to happen next, by whom, and why.",
  }),
  readiness_audit: Object.freeze({
    label: "Readiness Audit",
    audience: "Audience: Internal quality control, analytics lead, operations lead",
    purpose: "Purpose: Assess whether current assumptions, evidence, ownership, and update discipline are strong enough for trusted decision-making.",
    whenToUse: "Use before major commitments, external reporting, launch moments, persuasion pushes, GOTV shifts, and any point where weak discipline could be mistaken for confidence.",
    decisionSupport: "Best for decisions about whether the campaign is truly ready to rely on the current numbers.",
    cadence: "Recommended cadence: Before major strategic moves and whenever confidence feels stronger than the evidence.",
    operatorNote: "This is the honesty report. Use it to catch stale, thin, missing, or weakly governed inputs before they distort decisions.",
  }),
  election_data_benchmark: Object.freeze({
    label: "Election Data Benchmark",
    audience: "Audience: Internal analytics, strategy, targeting, and research leads",
    purpose: "Purpose: Examine benchmark quality, comparables, and how election data is shaping downstream assumptions.",
    whenToUse: "Use after benchmark refreshes, election-data imports, district history updates, targeting revisions, or any time the campaign is leaning heavily on past results.",
    decisionSupport: "Best for decisions about whether the comparison set is credible and whether benchmark-driven assumptions deserve real weight.",
    cadence: "Recommended cadence: After each benchmark update and during major targeting reviews.",
    operatorNote: "This report exists to stop bad comparables from quietly driving good-looking but weak recommendations.",
  }),
  post_election_learning: Object.freeze({
    label: "Post-Election Learning",
    audience: "Audience: Internal analytics, leadership, future-cycle planning",
    purpose: "Purpose: Compare expectation versus reality, identify misses, and turn one race into stronger future judgment.",
    whenToUse: "Use after the election, after major outcome events, or after enough real results exist to compare forecasted posture against reality.",
    decisionSupport: "Best for decisions about calibration, model discipline, future defaults, and what the team should carry forward into the next cycle.",
    cadence: "Recommended cadence: At race close and during retrospective review.",
    operatorNote: "This is how the system compounds over time. Do not skip it. The point is not blame. The point is learning with receipts.",
  }),
});

export function syncDataReportingModule(context = {}) {
  const {
    view,
    setText,
    syncInputValue,
    syncButtonDisabledLocal,
  } = context;

  if (
    typeof setText !== "function"
    || typeof syncInputValue !== "function"
    || typeof syncButtonDisabledLocal !== "function"
  ) {
    return;
  }

  const reportingView = view?.reporting && typeof view.reporting === "object" ? view.reporting : {};
  const reportTypeSelect = document.getElementById("v3DataReportType");
  let selectedReportType = String(reportingView.selectedType || "").trim();
  if (reportTypeSelect instanceof HTMLSelectElement) {
    syncReportTypeSelect(
      reportTypeSelect,
      Array.isArray(reportingView.options) ? reportingView.options : [],
      reportingView.selectedType,
    );
    reportTypeSelect.disabled = !!view?.controls?.reportTypeDisabled;
    selectedReportType = String(reportTypeSelect.value || reportingView.selectedType || "").trim();
  }

  setText(
    "v3DataReportStatus",
    String(reportingView.status || "").trim() || DATA_REPORT_STATUS_FALLBACK,
  );
  syncReportGuidance(selectedReportType, setText);
  syncInputValue("v3DataReportPreview", reportingView.previewText);
  syncButtonDisabledLocal("v3DataBtnComposeReport", !!view?.controls?.reportComposeDisabled);
  syncButtonDisabledLocal("v3DataBtnExportReportPdf", !!view?.controls?.reportExportPdfDisabled);
}

export function bindDataReportingEvents(context = {}) {
  const {
    getDataApi,
    refreshDataSummary,
    readSelectValue,
  } = context;

  if (
    typeof getDataApi !== "function"
    || typeof refreshDataSummary !== "function"
    || typeof readSelectValue !== "function"
  ) {
    return;
  }

  const reportTypeSelect = document.getElementById("v3DataReportType");
  if (reportTypeSelect instanceof HTMLSelectElement) {
    reportTypeSelect.addEventListener("change", () => {
      const api = getDataApi();
      if (!api || typeof api.setReportType !== "function") {
        return;
      }
      const result = api.setReportType(reportTypeSelect.value);
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
    });
  }

  const composeReportBtn = document.getElementById("v3DataBtnComposeReport");
  if (composeReportBtn instanceof HTMLButtonElement) {
    composeReportBtn.addEventListener("click", () => {
      const api = getDataApi();
      if (!api || typeof api.composeReport !== "function") {
        return;
      }
      const reportType = readSelectValue("v3DataReportType");
      const result = api.composeReport({ reportType });
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
    });
  }

  const exportReportBtn = document.getElementById("v3DataBtnExportReportPdf");
  if (exportReportBtn instanceof HTMLButtonElement) {
    exportReportBtn.addEventListener("click", () => {
      const api = getDataApi();
      if (!api || typeof api.exportReportPdf !== "function") {
        return;
      }
      const reportType = readSelectValue("v3DataReportType");
      const result = api.exportReportPdf({ reportType });
      if (result && typeof result.then === "function") {
        result.finally(() => refreshDataSummary());
      } else {
        refreshDataSummary();
      }
    });
  }
}

function syncReportTypeSelect(selectEl, options, selectedValue) {
  const list = Array.isArray(options) ? options : [];
  const selected = String(selectedValue || "").trim();
  replaceReportTypeOptionsInPlace(selectEl, list);

  if (document.activeElement !== selectEl) {
    const allowed = list.some((opt) => String(opt.value || "") === selected);
    selectEl.value = allowed ? selected : String(list[0]?.value || "internal_full");
  }
}

function replaceReportTypeOptionsInPlace(selectEl, options) {
  const list = Array.isArray(options) ? options : [];
  for (let idx = 0; idx < list.length; idx += 1) {
    const next = list[idx];
    let option = selectEl.options[idx] || null;
    if (!(option instanceof HTMLOptionElement)) {
      option = document.createElement("option");
      selectEl.appendChild(option);
    }
    const nextValue = String(next?.value || "");
    const nextLabel = String(next?.label || next?.value || "");
    if (String(option.value) !== nextValue) {
      option.value = nextValue;
    }
    if (String(option.textContent || "") !== nextLabel) {
      option.textContent = nextLabel;
    }
  }
  while (selectEl.options.length > list.length) {
    selectEl.remove(selectEl.options.length - 1);
  }
}

function syncReportGuidance(reportType, setText) {
  const guidance = getReportGuidance(reportType);
  setText("v3DataReportGuideLabel", guidance.label || REPORT_GUIDANCE_FALLBACK);
  setText("v3DataReportGuideAudience", guidance.audience || REPORT_GUIDANCE_FALLBACK);
  setText("v3DataReportGuidePurpose", guidance.purpose || REPORT_GUIDANCE_FALLBACK);
  setText("v3DataReportGuideWhen", guidance.whenToUse || REPORT_GUIDANCE_FALLBACK);
  setText("v3DataReportGuideDecision", guidance.decisionSupport || REPORT_GUIDANCE_FALLBACK);
  setText("v3DataReportGuideCadence", guidance.cadence || REPORT_GUIDANCE_FALLBACK);
  setText("v3DataReportGuideOperator", guidance.operatorNote || REPORT_GUIDANCE_FALLBACK);
}

function getReportGuidance(reportType) {
  const canonicalType = normalizeReportType(reportType);
  return REPORT_GUIDANCE[canonicalType] || REPORT_GUIDANCE.internal_full;
}

function normalizeReportType(reportType) {
  const token = String(reportType || "").trim().toLowerCase();
  if (token === "internal") return "internal_full";
  if (token === "client") return "client_standard";
  if (token in REPORT_GUIDANCE) return token;
  return "internal_full";
}
