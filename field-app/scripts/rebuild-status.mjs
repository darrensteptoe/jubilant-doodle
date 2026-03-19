#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const MILESTONE_FILE = join(ROOT, "checkpoints", "workstream_milestones_2026-03-19.md");

function parseStatus(markdown){
  const lines = String(markdown || "").split(/\r?\n/);
  const orderedRows = lines
    .map((line) => {
      const m = line.match(/^\d+\.\s+Workstream\s+\d+\s+—\s+.+:\s+\*\*(Complete|In Progress|Pending)\*\*/i);
      if (!m) return null;
      return { line, status: String(m[1] || "").toLowerCase() };
    })
    .filter(Boolean);

  const total = orderedRows.length;
  const complete = orderedRows.filter((row) => row.status === "complete").length;
  const remaining = Math.max(0, total - complete);

  const foundationLine = lines.find((line) => /Phase 0\.5\s+—\s+Voter data layer:\s+\*\*(.+)\*\*/i.test(line)) || "";
  const foundationStatus = foundationLine.match(/Phase 0\.5\s+—\s+Voter data layer:\s+\*\*(.+)\*\*/i)?.[1] || "Unknown";

  return { total, complete, remaining, foundationStatus };
}

function main(){
  const raw = readFileSync(MILESTONE_FILE, "utf8");
  const status = parseStatus(raw);
  process.stdout.write(JSON.stringify(status, null, 2));
  process.stdout.write("\n");
}

main();
