// @ts-check

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function reconcileElectionDataCandidateRows(rows = [], mapping = {}) {
  const mapped = mapping && typeof mapping === "object" ? mapping : {};
  const out = [];
  let changed = false;
  const unresolvedNames = new Set();

  asArray(rows).forEach((sourceRow) => {
    const row = sourceRow && typeof sourceRow === "object" ? clone(sourceRow) : {};
    const candidateId = cleanText(row.candidateId);
    const candidateName = cleanText(row.candidateName || row.candidate);

    const nextCandidateId = cleanText(
      mapped[candidateId]
      || mapped[candidateName]
      || mapped[candidateName.toLowerCase()]
      || "",
    );

    if (nextCandidateId && nextCandidateId !== candidateId) {
      row.candidateId = nextCandidateId;
      changed = true;
    }

    if (!cleanText(row.candidateId) && candidateName) {
      unresolvedNames.add(candidateName);
    }

    out.push(row);
  });

  return {
    rows: out,
    changed,
    unresolvedNames: Array.from(unresolvedNames),
  };
}

export function buildCandidateReconciliationWarnings(unresolvedNames = [], options = {}) {
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 25;
  const names = asArray(unresolvedNames).map((item) => cleanText(item)).filter(Boolean);
  if (!names.length) {
    return [];
  }
  const shown = names.slice(0, limit);
  const overflow = Math.max(0, names.length - shown.length);
  const suffix = overflow > 0 ? ` (+${overflow} more)` : "";
  return [
    `Unmapped candidate identifiers remain for: ${shown.join(", ")}${suffix}.`,
  ];
}
