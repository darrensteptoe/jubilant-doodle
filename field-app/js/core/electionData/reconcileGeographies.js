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

function rowGeoKeys(row) {
  return [
    cleanText(row?.geographyId),
    cleanText(row?.precinctId),
    cleanText(row?.precinct_id),
    cleanText(row?.wardId),
    cleanText(row?.ward_id),
    cleanText(row?.districtId),
    cleanText(row?.district_id),
  ].filter(Boolean);
}

export function reconcileElectionDataGeographyRows(rows = [], mapping = {}) {
  const mapped = mapping && typeof mapping === "object" ? mapping : {};
  const out = [];
  let changed = false;
  const unresolvedGeographies = new Set();

  asArray(rows).forEach((sourceRow) => {
    const row = sourceRow && typeof sourceRow === "object" ? clone(sourceRow) : {};
    const keys = rowGeoKeys(row);

    let nextGeographyId = "";
    for (const key of keys) {
      nextGeographyId = cleanText(mapped[key] || mapped[key.toLowerCase()] || "");
      if (nextGeographyId) break;
    }

    const currentGeographyId = cleanText(row.geographyId);
    if (nextGeographyId && nextGeographyId !== currentGeographyId) {
      row.geographyId = nextGeographyId;
      changed = true;
    }

    if (!cleanText(row.geographyId) && keys.length) {
      unresolvedGeographies.add(keys[0]);
    }

    out.push(row);
  });

  return {
    rows: out,
    changed,
    unresolvedGeographies: Array.from(unresolvedGeographies),
  };
}

export function buildGeographyReconciliationWarnings(unresolvedGeographies = [], options = {}) {
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 25;
  const geographies = asArray(unresolvedGeographies).map((item) => cleanText(item)).filter(Boolean);
  if (!geographies.length) {
    return [];
  }
  const shown = geographies.slice(0, limit);
  const overflow = Math.max(0, geographies.length - shown.length);
  const suffix = overflow > 0 ? ` (+${overflow} more)` : "";
  return [
    `Unmapped geography identifiers remain for: ${shown.join(", ")}${suffix}.`,
  ];
}
