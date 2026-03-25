// @ts-check
import {
  assessRaceFootprintAlignment,
  buildCensusPaceFeasibilitySnapshot,
  formatRaceFootprintScope,
  normalizeFootprintCapacity,
  resolutionLabel,
} from "../core/censusModule.js";
import { roundWholeNumberByMode } from "../core/utils.js";
import {
  buildAssumptionsApplyModeText,
  buildAssumptionsBandWidthText,
  buildAssumptionsFeasibilityText,
  buildAssumptionsSignalCoverageText,
  buildAssumptionsTurnoutCyclesText,
  buildAssumptionsWeeksText,
  formatAssumptionsBand,
  formatAssumptionsOneDecimal,
  formatAssumptionsPercent,
} from "./assumptionsViewHelpers.js";
import { selectDistrictCanonicalView } from "../core/selectors/districtCanonical.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDateDayMs(rawValue){
  const value = String(rawValue || "").trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day);
}

function buildElectionCountdownView(electionDate, nowDate = new Date()){
  const isoDate = String(electionDate || "").trim();
  const electionDayMs = parseIsoDateDayMs(isoDate);
  if (electionDayMs == null){
    return {
      daysLabel: "—",
      note: "Set Election Date",
      electionDateText: "—",
    };
  }
  const todayMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const dayDiffRaw = (electionDayMs - todayMs) / MS_PER_DAY;
  const dayDiff = roundWholeNumberByMode(dayDiffRaw, { mode: "round", fallback: 0 }) ?? 0;
  if (dayDiff < 0){
    return {
      daysLabel: "Passed",
      note: `${Math.abs(dayDiff)}d ago`,
      electionDateText: isoDate,
    };
  }
  if (dayDiff === 0){
    return {
      daysLabel: "0",
      note: "Election Day is today",
      electionDateText: isoDate,
    };
  }
  return {
    daysLabel: String(dayDiff),
    note: dayDiff === 1 ? "day remaining" : "days remaining",
    electionDateText: isoDate,
  };
}

function cleanToken(value){
  return String(value == null ? "" : value).trim().toLowerCase();
}

function normalizeOfficeContextKey(templateMeta = {}, raceType = ""){
  const officeLevel = cleanToken(templateMeta?.officeLevel);
  const raceToken = cleanToken(raceType);
  if (officeLevel === "statewide_executive" || raceToken === "statewide_executive") return "statewide_executive";
  if (officeLevel === "statewide_federal" || raceToken === "statewide_federal") return "statewide_federal";
  if (officeLevel === "congressional_district" || raceToken === "congressional_district") return "congressional_district";
  if (officeLevel === "state_legislative_lower" || raceToken === "state_house" || raceToken === "state_leg") return "state_house";
  if (officeLevel === "state_legislative_upper" || raceToken === "state_senate") return "state_senate";
  if (officeLevel === "countywide" || raceToken === "countywide" || raceToken === "county") return "countywide";
  if (officeLevel === "municipal_executive" || raceToken === "municipal_executive") return "municipal_executive";
  if (officeLevel === "municipal_legislative" || raceToken === "municipal_legislative" || raceToken === "municipal") return "municipal_legislative";
  if (officeLevel === "judicial_other" || raceToken === "judicial_other") return "judicial_other";
  if (officeLevel === "custom_context" || raceToken === "custom_context") return "custom_context";
  return "";
}

const TEMPLATE_CONTEXT_EXPLAINER = Object.freeze({
  title: "Templates and office context",
  rows: Object.freeze([
    Object.freeze({
      label: "What this is",
      text: "Templates are operating presets. They do not tell the model what to believe. They give the system a realistic starting posture based on office type, contest context, and campaign environment.",
    }),
    Object.freeze({
      label: "How to think about it",
      text: "The template is not the answer. It is the opening frame. Good operators start from the closest honest context, then tighten or widen assumptions based on local evidence. The danger is not using a template. The danger is using the wrong one and forgetting what it quietly implies.",
    }),
    Object.freeze({
      label: "Why this matters",
      text: "A state house race, a governor’s race, and a U.S. Senate race can all be competitive without behaving the same way. Geography, vote mode, message environment, field repeatability, and coalition breadth all change with office type.",
    }),
    Object.freeze({
      label: "When to override",
      text: "Override when local data, polling, historical turnout behavior, or operational evidence clearly support a better assumption than the template default. Do not override simply to make the plan look easier.",
    }),
  ]),
});

const OFFICE_CONTEXT_GUIDANCE = Object.freeze({
  statewide_executive: Object.freeze({
    title: "Governor / Statewide Executive",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this when the candidate is running statewide for governor or another major statewide executive office. This context assumes a broader, more uneven electorate than district-sized races." }),
      Object.freeze({ label: "How to think about it", text: "A statewide executive race is not just a larger district race. Coalition management, geography, vote mode, and message reach all become more uneven. A plan that looks safe in aggregate can still be fragile if it depends too heavily on a few metro areas, one turnout mode, or one segment of the coalition." }),
      Object.freeze({ label: "What the band means", text: "The default band is wider here because statewide executive races usually carry more moving parts: regional variation, state-specific vote methods, changing media conditions, and uneven execution across a large map." }),
      Object.freeze({ label: "When to tighten the band", text: "Tighten the band only when the campaign has unusually strong polling, stable vote history, disciplined execution, and clear visibility into regional performance." }),
      Object.freeze({ label: "When to widen the band", text: "Widen the band when the state is politically volatile, the coalition is unstable, turnout mode is changing, or the campaign lacks strong regional certainty." }),
      Object.freeze({ label: "Persuasion guidance", text: "Persuasion should usually be treated as real but bounded. Do not inflate the persuadable universe just because the electorate is large." }),
      Object.freeze({ label: "Early vote guidance", text: "Set early vote expectations from the state’s actual voting environment, not generic national instincts. Some states are heavily early-vote driven. Others remain much more Election Day dependent." }),
      Object.freeze({ label: "What good looks like", text: "A strong statewide executive plan is not just ahead in the topline. It is geographically credible, vote-mode aware, and not overly dependent on one fragile regional story." }),
      Object.freeze({ label: "Warning signs", text: "Nice statewide numbers paired with weak regional depth. Heavy reliance on one media market. Early-vote assumptions borrowed from the wrong state context. Leadership treating a broad map as if it will perform uniformly." }),
    ]),
  }),
  statewide_federal: Object.freeze({
    title: "U.S. Senate / Statewide Federal",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this for statewide federal races such as U.S. Senate. This context assumes nationalized attention, heavier outside influence, and a potentially faster-moving message environment than many lower-salience contests." }),
      Object.freeze({ label: "How to think about it", text: "Statewide federal races often carry both the scale of a governor’s race and the narrative volatility of a national contest. The question is not just whether the campaign has a path. It is whether that path can survive rapid swings in attention, spending, and message conditions." }),
      Object.freeze({ label: "What the band means", text: "The band remains wide because statewide federal races can look stable until outside events, national narratives, or spending shifts reopen uncertainty." }),
      Object.freeze({ label: "Warning signs", text: "Narrow path relying on favorable late movement. Heavy confidence in baseline support with weak evidence refresh. Treating a media-driven race as if field execution alone will stabilize the entire map." }),
    ]),
  }),
  congressional_district: Object.freeze({
    title: "U.S. House / Congressional",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this for district-sized federal races. These contests can still be expensive and volatile, but they are usually more geographically legible than statewide contests." }),
      Object.freeze({ label: "How to think about it", text: "Congressional races are often easier to segment and track than statewide races, but they can still become fragile when the field plan assumes uniform district performance." }),
    ]),
  }),
  state_house: Object.freeze({
    title: "State House",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this for lower-chamber state legislative races. These contests are often the most field-legible in the system, but only when the district reality is understood correctly." }),
      Object.freeze({ label: "How to think about it", text: "Because the district is smaller, operators are tempted to over-trust local familiarity. That is useful only if the campaign’s turnout history, coalition shape, and contact capacity are actually grounded." }),
    ]),
  }),
  state_senate: Object.freeze({
    title: "State Senate",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this for upper-chamber state legislative races. These races often sit between state house and congressional contests in scale, complexity, and coalition variation." }),
    ]),
  }),
  countywide: Object.freeze({
    title: "Countywide",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this for countywide executive or countywide judicial-style contests where the electorate is broader than a single municipality but more locally legible than a statewide map." }),
      Object.freeze({ label: "How to think about it", text: "Countywide races often look simpler than they are. Composition can vary sharply between municipal anchors, suburban rings, and lower-density precincts." }),
    ]),
  }),
  municipal_executive: Object.freeze({
    title: "City / Municipal Executive",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this for mayoral and similar executive contests within a municipality." }),
      Object.freeze({ label: "How to think about it", text: "These races often reward coalition assembly, neighborhood-level variation awareness, and practical turnout discipline more than broad ideological storytelling." }),
    ]),
  }),
  municipal_legislative: Object.freeze({
    title: "City / Municipal Legislative",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this for ward, city council, aldermanic, or similarly bounded municipal legislative contests." }),
      Object.freeze({ label: "How to think about it", text: "These races are often highly field-legible, but they can also be distorted by overconfidence, low-turnout irregularity, and very local issue shocks." }),
    ]),
  }),
  judicial_other: Object.freeze({
    title: "Judicial / Other",
    rows: Object.freeze([
      Object.freeze({ label: "What it is", text: "Use this when the race does not fit the standard partisan office ladder cleanly. This template defaults to a cautious posture and expects operator judgment." }),
      Object.freeze({ label: "How to think about it", text: "If the race structure is unusual, resist fake precision. Use a cautious band, document your reasoning, and override with care." }),
    ]),
  }),
});

const OFFICE_WARNING_COPY = Object.freeze({
  statewide_executive: Object.freeze({
    info: "This template assumes a statewide executive race. Expect wider regional variation, a more uneven coalition map, and more sensitivity to vote-mode composition than in district-sized contests.",
    caution: "Statewide executive races can hide local weakness inside strong statewide toplines. Stress-test the plan by region, vote mode, and coalition segment before treating the path as stable.",
    highRisk: "The current plan is carrying a statewide executive office with district-style assumptions. That usually understates volatility and can overstate how repeatable field gains will be across the map.",
  }),
  statewide_federal: Object.freeze({
    info: "This template assumes a statewide federal race. Media environment, outside spending, and message nationalization may widen uncertainty even when the topline looks stable.",
    caution: "Federal statewide races often experience faster narrative swings than local contests. Treat narrow paths as fragile unless both the field plan and vote-mode capture are ahead of pace.",
  }),
  state_house: Object.freeze({
    info: "Legislative races are usually more field-legible than statewide contests, but they can still break quickly when district composition is misunderstood.",
  }),
  state_senate: Object.freeze({
    info: "Legislative races are usually more field-legible than statewide contests, but they can still break quickly when district composition is misunderstood.",
  }),
  countywide: Object.freeze({
    info: "Countywide races often look simpler than they are. Turnout composition can differ sharply between municipal anchors and lower-density precincts.",
  }),
});

export function renderAssumptionsModule(args){
  const {
    els,
    state,
    res,
    weeks,
    block,
    kv,
    labelTemplate,
    assumptionsProfileLabel,
    labelUndecidedMode,
    getYourName,
    fmtInt,
  } = args || {};

  const blocks = [];
  const runtimeState = state && typeof state === "object" ? state : {};
  const districtCanonical = selectDistrictCanonicalView(runtimeState);
  const canonicalTemplate = districtCanonical?.templateProfile && typeof districtCanonical.templateProfile === "object"
    ? districtCanonical.templateProfile
    : {};
  const canonicalForm = districtCanonical?.form && typeof districtCanonical.form === "object"
    ? districtCanonical.form
    : {};
  const canonicalRaceType = String(canonicalTemplate.raceType || runtimeState.raceType || "").trim();
  const canonicalMode = String(canonicalForm.mode || runtimeState.mode || "").trim();
  const canonicalElectionDate = String(canonicalForm.electionDate || "").trim();
  const canonicalTemplateMeta = {
    ...(runtimeState.templateMeta && typeof runtimeState.templateMeta === "object" ? runtimeState.templateMeta : {}),
    officeLevel: String(canonicalTemplate.officeLevel || "").trim(),
    electionType: String(canonicalTemplate.electionType || "").trim(),
    seatContext: String(canonicalTemplate.seatContext || "").trim(),
    partisanshipMode: String(canonicalTemplate.partisanshipMode || "").trim(),
    salienceLevel: String(canonicalTemplate.salienceLevel || "").trim(),
  };
  const templateLabelState = {
    ...runtimeState,
    raceType: canonicalRaceType || runtimeState.raceType,
    templateMeta: canonicalTemplateMeta,
  };
  const templateLabel = (typeof labelTemplate === "function")
    ? labelTemplate(templateLabelState)
    : (canonicalRaceType || "—");
  const officeContextKey = normalizeOfficeContextKey(canonicalTemplateMeta, canonicalRaceType);
  const officeGuidance = OFFICE_CONTEXT_GUIDANCE[officeContextKey] || null;
  const officeWarnings = OFFICE_WARNING_COPY[officeContextKey] || null;

  const footprint = assessRaceFootprintAlignment({
    censusState: state?.census,
    raceFootprint: state?.raceFootprint,
    assumptionsProvenance: state?.assumptionsProvenance,
  });
  const capacity = normalizeFootprintCapacity(state?.footprintCapacity);
  const storedFootprint = footprint.stored;
  const scope = formatRaceFootprintScope(storedFootprint);
  const resolutionText = resolutionLabel(storedFootprint.resolution) || "—";

  blocks.push(block("Race & scenario", [
    kv("Scenario", state.scenarioName || "—"),
    kv("Template", templateLabel || "—"),
    kv("Race template", templateLabel || canonicalRaceType || "—"),
    kv("Template key", canonicalRaceType || "—"),
    kv("Office level", canonicalTemplateMeta.officeLevel || "—"),
    kv("Election type", canonicalTemplateMeta.electionType || "—"),
    kv("Seat context", canonicalTemplateMeta.seatContext || "—"),
    kv("Partisanship mode", canonicalTemplateMeta.partisanshipMode || "—"),
    kv("Salience level", canonicalTemplateMeta.salienceLevel || "—"),
    kv("Assumptions profile", assumptionsProfileLabel(state)),
    kv("Mode", canonicalMode === "late_start" ? "Late-start / turnout-heavy" : "Persuasion-first"),
    kv("Election date", canonicalElectionDate || String(runtimeState.electionDate || "").trim() || "—"),
    kv("Weeks remaining", buildAssumptionsWeeksText(weeks)),
  ]));

  blocks.push(block(TEMPLATE_CONTEXT_EXPLAINER.title, TEMPLATE_CONTEXT_EXPLAINER.rows.map((row) => (
    kv(row.label, row.text)
  ))));

  if (officeGuidance){
    blocks.push(block(officeGuidance.title, officeGuidance.rows.map((row) => (
      kv(row.label, row.text)
    ))));
  }

  if (officeWarnings){
    const warningRows = [
      officeWarnings.info ? kv("Info", officeWarnings.info) : null,
      officeWarnings.caution ? kv("Caution", officeWarnings.caution) : null,
      officeWarnings.highRisk ? kv("High risk", officeWarnings.highRisk) : null,
    ].filter(Boolean);
    blocks.push(block("Office risk flags", warningRows));
  }

  blocks.push(block("Race footprint", [
    kv("Defined", footprint.footprintDefined ? "Yes" : "No"),
    kv("Resolution", resolutionText),
    kv("GEO units", footprint.footprintDefined ? String(storedFootprint.geoids.length) : "—"),
    kv("Population capacity", fmtInt(capacity.population)),
    kv("Scope", scope),
    kv("Selection alignment", !footprint.footprintDefined
      ? "—"
      : (footprint.selectionHasContext ? (footprint.selectionMatches ? "Match" : "Different") : "No context")),
    kv("Provenance", !footprint.footprintDefined
      ? "—"
      : (footprint.provenanceAligned ? "Aligned" : "Stale / missing")),
  ]));

  const censusPaceSnapshot = buildCensusPaceFeasibilitySnapshot({
    state,
    needVotes: res?.expected?.persuasionNeed,
    weeks,
  });
  const censusState = censusPaceSnapshot.censusState;
  const hasRows = !!censusPaceSnapshot.activeRowsReady;
  const advisory = censusPaceSnapshot.advisory;
  const pace = censusPaceSnapshot.pace;
  const applyGate = censusPaceSnapshot.applyGate;
  const applyMultipliers = censusPaceSnapshot.applyMultipliers;

  const feasibilityText = buildAssumptionsFeasibilityText(pace);
  const applyModeText = buildAssumptionsApplyModeText({
    applyGate,
    applyMultipliers,
  });

  blocks.push(block("Census operating band", [
    kv("Rows context", hasRows ? (censusState.activeRowsKey || "Loaded") : "Not loaded"),
    kv("Signal coverage", buildAssumptionsSignalCoverageText(advisory)),
    kv("Apply mode", applyModeText),
    kv("Achievable APH (p25/p50/p75)", advisory?.ready ? formatAssumptionsBand(advisory.aph?.range) : "—"),
    kv("Required APH", pace?.ready ? formatAssumptionsOneDecimal(pace.requiredAph) : "—"),
    kv("Feasibility", feasibilityText),
  ]));

  blocks.push(block("Universe & turnout", [
    kv("Universe basis", state.universeBasis === "active" ? "Active (advanced)" : "Registered"),
    kv("Universe size", fmtInt(res.raw.universeSize)),
    kv("Turnout cycles", buildAssumptionsTurnoutCyclesText(res.raw.turnoutA, res.raw.turnoutB)),
    kv("Expected turnout", formatAssumptionsPercent(res.turnout.expectedPct)),
    kv("Band width", buildAssumptionsBandWidthText(res.raw.bandWidth)),
    kv("Votes per 1% turnout", fmtInt(res.turnout.votesPer1pct)),
    kv("Source note", state.sourceNote || "—"),
  ]));

  blocks.push(block("Vote landscape", [
    kv("Candidates", String(state.candidates.length)),
    kv("Undecided break", labelUndecidedMode(state.undecidedMode)),
    kv("You are", getYourName() || "—"),
  ]));

  blocks.push(block("Persuasion & early vote", [
    kv("Persuasion % of universe", formatAssumptionsPercent(res.raw.persuasionPct)),
    kv("Early vote % (Expected)", formatAssumptionsPercent(res.raw.earlyVoteExp)),
  ]));

  const assumptionsSnapshotEl = els?.assumptionsSnapshot || null;
  if (assumptionsSnapshotEl){
    assumptionsSnapshotEl.innerHTML = "";
    for (const b of blocks) assumptionsSnapshotEl.appendChild(b);
  }

  const electionCountdown = buildElectionCountdownView(canonicalElectionDate);
  const daysToEdayEl = els?.daysToEdaySidebar || null;
  const daysToEdayNoteEl = els?.daysToEdayNoteSidebar || null;
  const electionDateSidebarEl = els?.electionDateCanonicalSidebar || null;
  if (daysToEdayEl) daysToEdayEl.textContent = electionCountdown.daysLabel;
  if (daysToEdayNoteEl) daysToEdayNoteEl.textContent = electionCountdown.note;
  if (electionDateSidebarEl) electionDateSidebarEl.textContent = electionCountdown.electionDateText;
}
