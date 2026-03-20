#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { V3_STAGE_REGISTRY } from "../js/app/v3/stageRegistry.js";

const ROOT = process.cwd();
const INTERACTION_DIR = path.join(ROOT, "interaction");
const PAGE_REPORT_DIR = path.join(INTERACTION_DIR, "page-reports");
const INVENTORY_PATH = path.join(INTERACTION_DIR, "interaction-inventory.csv");
const RESULTS_PATH = path.join(INTERACTION_DIR, "interaction-results.json");
const DISTRICT_REPORT_PATH = path.join(INTERACTION_DIR, "district-page-report.md");

const SURFACES = [
  { tier: "tier1", key: "district", title: "District" },
  { tier: "tier1", key: "targeting", title: "Targeting" },
  { tier: "tier1", key: "outcome_forecast", title: "Outcome / Forecast" },
  { tier: "tier1", key: "plan_optimizer", title: "Plan / Optimizer" },
  { tier: "tier1", key: "turnout", title: "Turnout" },
  { tier: "tier1", key: "scenarios", title: "Scenarios" },
  { tier: "tier1", key: "controls", title: "Controls" },
  { tier: "tier1", key: "data", title: "Data" },
  { tier: "tier1", key: "war_room", title: "War Room" },
  { tier: "tier2", key: "operations_workforce", title: "Workforce / Operations" },
  { tier: "tier2", key: "budget_channel_controls", title: "Budget / Channel Controls" },
  { tier: "tier2", key: "event_calendar", title: "Event Calendar" },
  { tier: "tier2", key: "reporting_controls", title: "Reporting Controls" },
  { tier: "tier3", key: "intelligence_manual_navigation", title: "Intelligence / Manual Navigation" },
  { tier: "tier3", key: "admin_support", title: "Admin / Supporting Surfaces" },
];

const CHECK_KEYS = [
  ["A", "population"],
  ["B", "state_write"],
  ["C", "recompute"],
  ["D", "render"],
  ["E", "persistence"],
  ["F", "legacy"],
];

const SURFACE_STAGE_REQUIREMENTS = Object.freeze({
  war_room: Object.freeze(["war-room", "war_room", "warroom", "decision-log"]),
});

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

const AVAILABLE_STAGE_IDS = new Set(
  (Array.isArray(V3_STAGE_REGISTRY) ? V3_STAGE_REGISTRY : [])
    .map((stage) => normalizeKey(stage?.id))
    .filter(Boolean),
);

function resolveSurfaceAvailability(surface) {
  const requirements = SURFACE_STAGE_REQUIREMENTS[surface.key];
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return {
      status: "available",
      reason: "",
    };
  }

  const matched = requirements.some((requiredStageId) => AVAILABLE_STAGE_IDS.has(normalizeKey(requiredStageId)));
  if (matched) {
    return {
      status: "available",
      reason: "",
    };
  }

  return {
    status: "unavailable",
    reason: `No required stage mounted in V3 registry (expected one of: ${requirements.join(", ")}).`,
  };
}

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return { header: [], rows: [] };

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQuote && line[i + 1] === "\"") {
          cur += "\"";
          i += 1;
        } else {
          inQuote = !inQuote;
        }
        continue;
      }
      if (ch === "," && !inQuote) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((value) => String(value || "").trim());
  };

  const header = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return { header, rows };
}

function statusTextForCheck(check) {
  if (check?.pass) return "PASS";
  const code = String(check?.classification || "UNKNOWN").trim();
  return `FAIL (${code || "UNKNOWN"})`;
}

function collectFailureSummary(result) {
  const failures = Array.isArray(result?.failures) ? result.failures : [];
  if (!failures.length) return "none";
  return failures
    .map((row) => `${String(row.classification || "").trim()}: ${String(row.details || "").trim()}`)
    .filter(Boolean)
    .join(" | ");
}

function collectFailureClasses(result) {
  const failures = Array.isArray(result?.failures) ? result.failures : [];
  if (!failures.length) return "none";
  return Array.from(new Set(
    failures
      .map((row) => String(row.rootCause || "").trim())
      .filter(Boolean),
  )).join(", ");
}

function buildSurfaceReport({ surface, controls, plannedControls, resultById, generatedAt, availability }) {
  const escapeCell = (value) => String(value == null ? "" : value).replace(/\|/g, "\\|");
  const unavailableByDesign = availability?.status === "unavailable";
  const rows = controls.map((control) => {
    const interactionId = String(control.interaction_id || "").trim();
    const result = resultById.get(interactionId);
    const checks = result?.checks || {};
    const checkRows = Object.fromEntries(
      CHECK_KEYS.map(([label, key]) => [label, statusTextForCheck(checks[key])]),
    );
    const aToFPass = CHECK_KEYS.every(([, key]) => checks[key]?.pass === true);
    return {
      interactionId,
      label: String(control.label || "").trim() || interactionId,
      canonicalOwner: String(control.canonical_state_path || "").trim(),
      aToFPass,
      checkRows,
      rootCause: collectFailureSummary(result),
      failureClass: collectFailureClasses(result),
      persistenceContract: String(control.persistence_contract || "").trim(),
    };
  });

  const failing = rows.filter((row) => !row.aToFPass);
  let status = "PASS";
  if (unavailableByDesign || !rows.length) {
    status = "UNAVAILABLE";
  } else if (failing.length > 0) {
    status = "FAIL";
  }
  const surfacePass = status === "PASS";

  const lines = [];
  lines.push(`# ${surface.title} Interaction Integrity Report`);
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Tier: ${surface.tier}`);
  lines.push(`Surface key: ${surface.key}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Controls audited: ${rows.length}`);
  lines.push(`- Controls failing A-F: ${failing.length}`);
  lines.push(`- Surface status: ${status}`);
  if (status === "UNAVAILABLE" && availability?.reason) {
    lines.push(`- Availability note: ${availability.reason}`);
  }
  if (Array.isArray(plannedControls) && plannedControls.length > 0) {
    lines.push(`- Planned controls not yet mounted on this surface: ${plannedControls.length}`);
  }
  lines.push("");
  lines.push("## A-F Matrix");
  lines.push("| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    lines.push(
      `| ${escapeCell(`${row.interactionId} (${row.label})`)} | ${escapeCell(row.checkRows.A)} | ${escapeCell(row.checkRows.B)} | ${escapeCell(row.checkRows.C)} | ${escapeCell(row.checkRows.D)} | ${escapeCell(row.checkRows.E)} | ${escapeCell(row.checkRows.F)} | ${escapeCell(row.persistenceContract || "—")} | ${escapeCell(row.canonicalOwner || "—")} | ${escapeCell(row.rootCause)} | ${escapeCell(row.failureClass)} |`,
    );
  }
  if (!rows.length) {
    lines.push("| — | — | — | — | — | — | — | — | — | no controls mapped | unavailable |");
  }
  lines.push("");
  if (Array.isArray(plannedControls) && plannedControls.length > 0) {
    lines.push("## Planned Controls (Not Yet Mounted)");
    lines.push("| control | status | notes |");
    lines.push("|---|---|---|");
    for (const control of plannedControls) {
      lines.push(
        `| ${escapeCell(String(control.interaction_id || "").trim())} | ${escapeCell(String(control.status || "").trim() || "planned")} | ${escapeCell(String(control.notes || "").trim() || "—")} |`,
      );
    }
    lines.push("");
  }
  lines.push("## Classification");
  if (status === "UNAVAILABLE") {
    lines.push("- Surface is not currently available in the mounted V3 stage set.");
  } else if (!rows.length) {
    lines.push("- No controls currently mapped to this surface.");
  } else if (!failing.length) {
    lines.push("- No open A-F interaction integrity defects on this surface.");
  } else {
    lines.push("- Open A-F interaction integrity defects remain; see matrix rows marked FAIL.");
  }

  return {
    content: `${lines.join("\n")}\n`,
    controlCount: rows.length,
    plannedControlCount: Array.isArray(plannedControls) ? plannedControls.length : 0,
    failCount: failing.length,
    surfacePass,
    status,
    availabilityReason: availability?.reason || "",
  };
}

function run() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error(`missing inventory file: ${INVENTORY_PATH}`);
  }
  if (!fs.existsSync(RESULTS_PATH)) {
    throw new Error(`missing results file: ${RESULTS_PATH}`);
  }

  const inventory = parseCsv(fs.readFileSync(INVENTORY_PATH, "utf8")).rows;
  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
  const resultById = new Map((results?.controls || []).map((row) => [String(row?.interaction_id || "").trim(), row]));
  const generatedAt = new Date().toISOString();

  fs.mkdirSync(PAGE_REPORT_DIR, { recursive: true });

  const summaries = [];
  for (const surface of SURFACES) {
    const allSurfaceControls = inventory.filter((row) => String(row.surface || "").trim() === surface.key);
    const availability = resolveSurfaceAvailability(surface);
    const controls = availability.status === "unavailable" ? [] : allSurfaceControls;
    const plannedControls = availability.status === "unavailable" ? allSurfaceControls : [];
    const report = buildSurfaceReport({
      surface,
      controls,
      plannedControls,
      resultById,
      generatedAt,
      availability,
    });
    const reportPath = path.join(PAGE_REPORT_DIR, `${surface.key}-report.md`);
    fs.writeFileSync(reportPath, report.content, "utf8");
    summaries.push({
      ...surface,
      path: path.relative(ROOT, reportPath),
      ...report,
    });
  }

  const tierSummaries = ["tier1", "tier2", "tier3"].map((tier) => {
    const rows = summaries.filter((entry) => entry.tier === tier);
    const pass = rows.filter((entry) => entry.status === "PASS").length;
    const fail = rows.filter((entry) => entry.status === "FAIL").length;
    const unavailable = rows.filter((entry) => entry.status === "UNAVAILABLE").length;
    return { tier, rows, pass, fail, unavailable };
  });

  const tier1Rows = summaries.filter((entry) => entry.tier === "tier1");
  const tier1AvailableRows = tier1Rows.filter((entry) => entry.status !== "UNAVAILABLE");
  const tier1Pass = tier1AvailableRows.length > 0 && tier1AvailableRows.every((entry) => entry.status === "PASS");

  const indexLines = [];
  indexLines.push("# Interaction Page Reports");
  indexLines.push("");
  indexLines.push(`Generated: ${generatedAt}`);
  indexLines.push("");
  indexLines.push("## Tier Gate");
  indexLines.push(`- Tier 1 interaction-stable: ${tier1Pass ? "YES" : "NO"}`);
  const unavailableTier1 = tier1Rows.filter((entry) => entry.status === "UNAVAILABLE").map((entry) => entry.title);
  if (unavailableTier1.length > 0) {
    indexLines.push(`- Tier 1 unavailable surfaces (excluded from gate): ${unavailableTier1.join(", ")}`);
  }
  if (!tier1Pass) {
    const failingTier1 = tier1Rows.filter((entry) => entry.status === "FAIL").map((entry) => entry.title);
    indexLines.push(`- Tier 1 blockers: ${failingTier1.join(", ") || "unknown"}`);
  }
  indexLines.push("");
  indexLines.push("## Tier Summary");
  indexLines.push("| tier | surfaces | pass | fail | unavailable |");
  indexLines.push("|---|---:|---:|---:|---:|");
  for (const tierRow of tierSummaries) {
    indexLines.push(`| ${tierRow.tier} | ${tierRow.rows.length} | ${tierRow.pass} | ${tierRow.fail} | ${tierRow.unavailable} |`);
  }
  indexLines.push("");
  indexLines.push("## Surface Reports");
  indexLines.push("| tier | surface | status | controls | report |");
  indexLines.push("|---|---|---|---:|---|");
  for (const row of summaries) {
    indexLines.push(`| ${row.tier} | ${row.title} | ${row.status} | ${row.controlCount} | [${row.path}](${path.join(ROOT, row.path)}) |`);
  }
  indexLines.push("");
  fs.writeFileSync(path.join(PAGE_REPORT_DIR, "README.md"), `${indexLines.join("\n")}\n`, "utf8");

  const districtEntry = summaries.find((row) => row.key === "district");
  if (districtEntry) {
    fs.copyFileSync(path.join(PAGE_REPORT_DIR, "district-report.md"), DISTRICT_REPORT_PATH);
  }

  process.stdout.write(
    `interaction-page-reports: tier1_stable=${tier1Pass ? "yes" : "no"} tier1_available=${tier1AvailableRows.length} surfaces=${summaries.length}\n`,
  );
}

try {
  run();
} catch (err) {
  const message = err?.message ? String(err.message) : String(err);
  process.stderr.write(`interaction-page-reports: FAIL (${message})\n`);
  process.exit(1);
}
