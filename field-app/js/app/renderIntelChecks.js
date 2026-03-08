// @ts-check
import {
  benchmarkRefLabel,
  computeIntelIntegrityScore,
  ensureIntelCollections,
  getIntelWorkflow,
  getLatestBriefByKind,
  intelBriefKindLabel,
  listIntelBenchmarks,
  listIntelBriefKinds,
  listIntelEvidence,
  listIntelRequests,
  listMissingEvidenceAudit,
  listMissingNoteAudit,
  listShockScenarios,
} from "./intelControlsRuntime.js";
import { renderIntelGeoMap } from "./intelGeoMap.js";

function fmtNum(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function pctInputValue(ratio, digits = 1){
  const n = Number(ratio);
  if (!Number.isFinite(n)) return "";
  const pct = n * 100;
  const fixed = pct.toFixed(Math.max(0, digits | 0));
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function fmtDate(iso){
  const s = String(iso || "").trim();
  return s ? s.slice(0, 10) : "—";
}

function makeOption(value, label){
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

const STATE_LABEL_BY_FIPS = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
  "72": "PR",
};

function fillCorrelationSelect(selectEl, rows, selectedId){
  if (!selectEl) return;
  const keep = String(selectedId || "");
  selectEl.innerHTML = "";
  selectEl.appendChild(makeOption("", "None selected"));
  for (const row of rows){
    const id = String(row?.id || "").trim();
    if (!id) continue;
    const label = String(row?.label || id);
    selectEl.appendChild(makeOption(id, label));
  }
  selectEl.value = keep;
  if (selectEl.value !== keep) selectEl.value = "";
}

function fillBenchmarkTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="muted">No benchmark entries configured.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows){
    const tr = document.createElement("tr");
    const range = `${fmtNum(row?.range?.min)} .. ${fmtNum(row?.range?.max)}`;
    const sev = `${fmtNum(row?.severityBands?.warnAbove)} / ${fmtNum(row?.severityBands?.hardAbove)}`;
    const source = row?.source?.title || row?.source?.type || "—";
    tr.innerHTML = `
      <td>
        <div>${benchmarkRefLabel(row?.ref)}</div>
        <div class="muted" style="font-size:11px;">${row?.ref || "—"}</div>
      </td>
      <td>${row?.raceType || "all"}</td>
      <td class="num">${range}</td>
      <td class="num">${sev}</td>
      <td>${source}</td>
      <td class="num">
        <button type="button" class="btn btn-sm btn-ghost" data-bm-remove="${row?.id || ""}">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function fillAuditSelect(selectEl, rows){
  if (!selectEl) return;
  const previous = selectEl.value;
  selectEl.innerHTML = "";

  if (!rows.length){
    selectEl.appendChild(makeOption("", "No missing evidence items"));
    selectEl.disabled = true;
    return;
  }

  selectEl.disabled = false;
  selectEl.appendChild(makeOption("", "Select missing evidence item…"));
  for (const row of rows){
    const ref = row?.label || row?.ref || row?.key || "critical assumption";
    const ts = fmtDate(row?.ts);
    selectEl.appendChild(makeOption(String(row?.id || ""), `${ts} · ${ref}`));
  }

  const exists = rows.some((x) => String(x?.id || "") === previous);
  if (exists){
    selectEl.value = previous;
    return;
  }

  const firstId = String(rows[0]?.id || "");
  if (firstId){
    selectEl.value = firstId;
  }
}

function fillEvidenceTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="5" class="muted">No evidence records yet.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row?.title || "—"}</td>
      <td>${row?.source || "—"}</td>
      <td>${fmtDate(row?.capturedAt)}</td>
      <td>${row?.ref || "—"}</td>
      <td>${row?.id || "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fmtPct(v, digits = 1){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(Math.max(0, digits | 0))}%`;
}

function fmtInt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fillDistrictEvidenceCandidateTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="3" class="muted">No candidate totals available.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const row of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${String(row?.candidateId || "—")}</td>
      <td class="num">${fmtInt(row?.votes)}</td>
      <td class="num">${fmtPct(row?.sharePct, 2)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fillDistrictEvidenceLinkTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4" class="muted">No precinct-to-geo links available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const top = rows.slice(0, 20);
  for (const row of top){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${String(row?.precinctId || "—")}</td>
      <td>${String(row?.geoid || "—")}</td>
      <td class="num">${fmtNum(row?.crosswalkWeight)}</td>
      <td class="num">${fmtNum(row?.effectiveWeight)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function summarizeEvidenceGeoRows(rows, maxRows = 20){
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const row of list){
    const geoid = String(row?.geoid || "").trim();
    if (!geoid) continue;
    const totalVotes = Number(row?.totalVotes);
    const sourcePrecincts = Number(row?.sourcePrecincts);
    const candidateVotes = row && typeof row.candidateVotes === "object" ? row.candidateVotes : {};
    const ranked = Object.keys(candidateVotes)
      .map((candidateId) => ({
        candidateId: String(candidateId || "").trim(),
        votes: Number(candidateVotes[candidateId]) || 0,
      }))
      .filter((x) => x.candidateId && x.votes > 0)
      .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));
    const leader = ranked[0] || null;
    const runnerUp = ranked[1] || null;
    const leaderVotes = leader ? leader.votes : 0;
    const runnerVotes = runnerUp ? runnerUp.votes : 0;
    const marginVotes = Math.max(0, leaderVotes - runnerVotes);
    const leaderSharePct = totalVotes > 0 ? (leaderVotes / totalVotes) * 100 : null;
    const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
    out.push({
      geoid,
      totalVotes,
      sourcePrecincts,
      hasElection: !!row?.hasElection,
      hasCensus: !!row?.hasCensus,
      leaderCandidateId: leader ? leader.candidateId : null,
      leaderVotes,
      leaderSharePct,
      marginVotes,
      marginPct,
    });
  }
  out.sort((a, b) => (Number(b?.totalVotes) || 0) - (Number(a?.totalVotes) || 0));
  return out.slice(0, Math.max(1, Math.min(500, Math.floor(Number(maxRows) || 20))));
}

function fillDistrictEvidenceGeoTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="muted">No GEO layer rows available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const top = rows.slice(0, 20);
  for (const row of top){
    const tr = document.createElement("tr");
    const leaderId = String(row?.leaderCandidateId || "").trim();
    const leaderVotes = Number(row?.leaderVotes);
    const leaderSharePct = Number(row?.leaderSharePct);
    const marginVotes = Number(row?.marginVotes);
    const marginPct = Number(row?.marginPct);
    const topCandidate = leaderId
      ? `${leaderId} (${fmtInt(leaderVotes)} · ${fmtPct(leaderSharePct, 1)})`
      : "—";
    const marginText = Number.isFinite(marginVotes)
      ? `${fmtInt(marginVotes)}${Number.isFinite(marginPct) ? ` (${fmtPct(marginPct, 1)})` : ""}`
      : "—";
    const dataFlags = `${row?.hasElection ? "E" : "—"}/${row?.hasCensus ? "C" : "—"}`;
    tr.innerHTML = `
      <td>${String(row?.geoid || "—")}</td>
      <td class="num">${fmtInt(row?.totalVotes)}</td>
      <td>${topCandidate}</td>
      <td class="num">${marginText}</td>
      <td class="num">${fmtInt(row?.sourcePrecincts)}</td>
      <td>${dataFlags}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fillDistrictEvidenceOpportunityTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="9" class="muted">No GEO opportunity rows available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const top = rows.slice(0, 20);
  for (let i = 0; i < top.length; i += 1){
    const row = top[i];
    const tr = document.createElement("tr");
    const marginPct = Number(row?.marginPct);
    const reasons = Array.isArray(row?.reasons)
      ? row.reasons.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    tr.innerHTML = `
      <td class="num">${i + 1}</td>
      <td>${String(row?.geoid || "—")}</td>
      <td class="num">${Number.isFinite(Number(row?.opportunityScore)) ? Number(row.opportunityScore).toFixed(1) : "—"}</td>
      <td class="num">${Number.isFinite(Number(row?.competitiveness)) ? Number(row.competitiveness).toFixed(2) : "—"}</td>
      <td class="num">${Number.isFinite(Number(row?.voteMassNorm)) ? Number(row.voteMassNorm).toFixed(2) : "—"}</td>
      <td class="num">${Number.isFinite(Number(row?.densityNorm)) ? Number(row.densityNorm).toFixed(2) : "—"}</td>
      <td class="num">${fmtInt(row?.totalVotes)}</td>
      <td class="num">${Number.isFinite(marginPct) ? fmtPct(marginPct, 1) : "—"}</td>
      <td>${reasons.length ? reasons.join(", ") : "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function pickCensusMetric(censusTotals, keys){
  const src = (censusTotals && typeof censusTotals === "object") ? censusTotals : {};
  for (const key of keys){
    const n = Number(src[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sumCensusMetric(censusTotals, keys){
  const src = (censusTotals && typeof censusTotals === "object") ? censusTotals : {};
  let any = false;
  let total = 0;
  for (const key of keys){
    const n = Number(src[key]);
    if (!Number.isFinite(n)) continue;
    any = true;
    total += n;
  }
  return any ? total : null;
}

function ratioCensusMetric(censusTotals, numeratorKeys, denominatorKeys){
  const num = sumCensusMetric(censusTotals, numeratorKeys);
  const den = sumCensusMetric(censusTotals, denominatorKeys);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

function toSharePct(raw){
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n * 100;
  if (n > 1 && n <= 100) return n;
  return null;
}

function mergeCensusTotalsFromGeoRows(censusTotals, geoRows){
  const out = { ...(censusTotals && typeof censusTotals === "object" ? censusTotals : {}) };
  if (Object.keys(out).length) return out;
  const rows = Array.isArray(geoRows) ? geoRows : [];
  for (const row of rows){
    const census = (row && typeof row.census === "object") ? row.census : {};
    for (const key of Object.keys(census)){
      const n = Number(census[key]);
      if (!Number.isFinite(n)) continue;
      out[key] = (Number(out[key]) || 0) + n;
    }
  }
  return out;
}

function fillDistrictDemographicsTable(tbody, evidence){
  if (!tbody) return;
  tbody.innerHTML = "";
  const ev = (evidence && typeof evidence === "object") ? evidence : {};
  const censusTotalsRaw = (ev.censusTotals && typeof ev.censusTotals === "object") ? ev.censusTotals : {};
  const censusTotals = mergeCensusTotalsFromGeoRows(censusTotalsRaw, ev.geoRows);
  const summary = (ev.summary && typeof ev.summary === "object") ? ev.summary : {};
  const signal = (ev.persuasionSignal && typeof ev.persuasionSignal === "object") ? ev.persuasionSignal : {};

  const pop = pickCensusMetric(censusTotals, ["pop", "population", "total_population", "B01003_001E", "B01003_001"]);
  const housing = pickCensusMetric(censusTotals, ["housing_units", "housing", "total_housing_units", "B25001_001E", "B25001_001"]);
  const renterShare = toSharePct(
    pickCensusMetric(censusTotals, ["renter_share", "renters_share", "renterPct", "renter_pct"])
    ?? ratioCensusMetric(censusTotals, ["B25003_003E", "B25003_003"], ["B25003_001E", "B25003_001"])
  );
  const multiunitShare = toSharePct(
    pickCensusMetric(censusTotals, ["multiunit_share", "multi_unit_share", "multiunit5p_share"])
    ?? ratioCensusMetric(
      censusTotals,
      ["B25024_006E", "B25024_006", "B25024_007E", "B25024_007", "B25024_008E", "B25024_008", "B25024_009E", "B25024_009"],
      ["B25024_001E", "B25024_001"]
    )
  );
  const baShare = toSharePct(
    pickCensusMetric(censusTotals, ["ba_plus_share", "baShare", "education_ba_plus", "BA_share", "ba_share"])
    ?? ratioCensusMetric(
      censusTotals,
      ["B15003_022E", "B15003_022", "B15003_023E", "B15003_023", "B15003_024E", "B15003_024", "B15003_025E", "B15003_025"],
      ["B15003_001E", "B15003_001"]
    )
  );
  const youthShare = toSharePct(
    pickCensusMetric(censusTotals, ["age_18_34_share", "youth_share"])
    ?? ratioCensusMetric(
      censusTotals,
      ["B01001_007E", "B01001_007", "B01001_008E", "B01001_008", "B01001_009E", "B01001_009", "B01001_010E", "B01001_010", "B01001_011E", "B01001_011", "B01001_012E", "B01001_012", "B01001_031E", "B01001_031", "B01001_032E", "B01001_032", "B01001_033E", "B01001_033", "B01001_034E", "B01001_034", "B01001_035E", "B01001_035", "B01001_036E", "B01001_036"],
      ["B01001_001E", "B01001_001"]
    )
  );
  const olderShare = toSharePct(
    pickCensusMetric(censusTotals, ["age_65_plus_share", "older_share"])
    ?? ratioCensusMetric(
      censusTotals,
      ["B01001_020E", "B01001_020", "B01001_021E", "B01001_021", "B01001_022E", "B01001_022", "B01001_023E", "B01001_023", "B01001_024E", "B01001_024", "B01001_025E", "B01001_025", "B01001_044E", "B01001_044", "B01001_045E", "B01001_045", "B01001_046E", "B01001_046", "B01001_047E", "B01001_047", "B01001_048E", "B01001_048", "B01001_049E", "B01001_049"],
      ["B01001_001E", "B01001_001"]
    )
  );
  const lepShare = toSharePct(
    pickCensusMetric(censusTotals, ["limited_english_share", "lep_share"])
    ?? ratioCensusMetric(
      censusTotals,
      ["C16002_004E", "C16002_004", "C16002_007E", "C16002_007", "C16002_010E", "C16002_010", "C16002_013E", "C16002_013"],
      ["C16002_001E", "C16002_001"]
    )
  );
  const commute = pickCensusMetric(censusTotals, ["mean_commute_min", "commute_min", "mean_commute_minutes"]);
  const totalVotes = Number(summary.totalVotes);
  const competitiveness = Number(signal.competitivenessPct);
  const marginPct = Number(signal.marginPct);

  const rows = [
    { label: "Population", value: Number.isFinite(pop) ? fmtInt(pop) : "—" },
    { label: "Households", value: Number.isFinite(housing) ? fmtInt(housing) : "—" },
    { label: "Renter share", value: Number.isFinite(renterShare) ? fmtPct(renterShare, 1) : "—" },
    { label: "Multi-unit share", value: Number.isFinite(multiunitShare) ? fmtPct(multiunitShare, 1) : "—" },
    { label: "BA+ share", value: Number.isFinite(baShare) ? fmtPct(baShare, 1) : "—" },
    { label: "Age 18-34 share", value: Number.isFinite(youthShare) ? fmtPct(youthShare, 1) : "—" },
    { label: "Age 65+ share", value: Number.isFinite(olderShare) ? fmtPct(olderShare, 1) : "—" },
    { label: "Limited English share", value: Number.isFinite(lepShare) ? fmtPct(lepShare, 1) : "—" },
    { label: "Mean commute", value: Number.isFinite(commute) ? `${commute.toFixed(1)} min` : "—" },
    { label: "Weighted election votes", value: Number.isFinite(totalVotes) ? fmtInt(totalVotes) : "—" },
    { label: "Competitiveness", value: Number.isFinite(competitiveness) ? fmtPct(competitiveness, 1) : "—" },
    { label: "Prior margin", value: Number.isFinite(marginPct) ? fmtPct(marginPct, 1) : "—" },
  ];

  const hasAny = rows.some((row) => row.value !== "—");
  if (!hasAny){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="2" class="muted">No district demographic rollup yet.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const row of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.label}</td><td class="num">${row.value}</td>`;
    tbody.appendChild(tr);
  }
}

function formatAssumptionValue(kind, raw){
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  if (kind === "rate") return fmtPct(n * 100, 1);
  if (kind === "lift") return n.toFixed(2);
  if (kind === "count") return n.toFixed(2);
  return n.toFixed(2);
}

function formatAssumptionDelta(kind, base, adjusted){
  const b = Number(base);
  const a = Number(adjusted);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return "—";
  const d = a - b;
  const sign = d > 0 ? "+" : "";
  if (kind === "rate"){
    return `${sign}${(d * 100).toFixed(1)} pp`;
  }
  if (kind === "lift"){
    return `${sign}${d.toFixed(2)}`;
  }
  return `${sign}${d.toFixed(2)}`;
}

function fillDistrictAssumptionTable(tbody, pack, useDistrictIntel, sourceKind = "pack"){
  if (!tbody) return;
  tbody.innerHTML = "";
  const intel = (pack && typeof pack === "object") ? pack : {};
  const ready = !!intel.ready;
  const indices = (intel.indices && typeof intel.indices === "object") ? intel.indices : {};
  const derived = (intel.derivedAssumptions && typeof intel.derivedAssumptions === "object") ? intel.derivedAssumptions : {};
  const rows = [
    {
      label: "Doors per hour",
      kind: "num",
      base: Number(derived?.doorsPerHour?.base),
      adjusted: Number(derived?.doorsPerHour?.adjusted),
      driver: Number.isFinite(Number(indices.fieldSpeed)) ? `fieldSpeed ${Number(indices.fieldSpeed).toFixed(2)}` : "fieldSpeed",
    },
    {
      label: "Support rate",
      kind: "rate",
      base: Number(derived?.persuasionRate?.base),
      adjusted: Number(derived?.persuasionRate?.adjusted),
      driver: Number.isFinite(Number(indices.persuasionEnv)) ? `persuasionEnv ${Number(indices.persuasionEnv).toFixed(2)}` : "persuasionEnv",
    },
    {
      label: "Turnout lift",
      kind: "lift",
      base: Number(derived?.turnoutLift?.base),
      adjusted: Number(derived?.turnoutLift?.adjusted),
      driver: Number.isFinite(Number(indices.turnoutElasticity)) ? `turnoutElasticity ${Number(indices.turnoutElasticity).toFixed(2)}` : "turnoutElasticity",
    },
    {
      label: "Organizer capacity",
      kind: "count",
      base: Number(derived?.organizerCapacity?.base),
      adjusted: Number(derived?.organizerCapacity?.adjusted),
      driver: Number.isFinite(Number(indices.fieldDifficulty)) ? `fieldDifficulty ${Number(indices.fieldDifficulty).toFixed(2)}` : "fieldDifficulty",
    },
  ];
  const hasValues = rows.some((row) => Number.isFinite(row.base) || Number.isFinite(row.adjusted));
  if (!ready && !hasValues){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="5" class="muted">No district-intel assumption pack generated yet.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const row of rows){
    const tr = document.createElement("tr");
    const baseText = formatAssumptionValue(row.kind, row.base);
    const adjustedText = formatAssumptionValue(row.kind, row.adjusted);
    const deltaText = formatAssumptionDelta(row.kind, row.base, row.adjusted);
    const driverText = useDistrictIntel && ready
      ? `${row.driver} · applied`
      : (sourceKind === "preview" ? `${row.driver} · preview` : `${row.driver} · generated`);
    tr.innerHTML = `
      <td>${row.label}</td>
      <td class="num">${baseText}</td>
      <td class="num">${adjustedText}</td>
      <td class="num">${deltaText}</td>
      <td>${driverText}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fillDistrictEvidencePrecinctTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="7" class="muted">No precinct layer rows available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const top = rows.slice(0, 30);
  for (const row of top){
    const tr = document.createElement("tr");
    const leaderId = String(row?.leaderCandidateId || "").trim();
    const leaderVotes = Number(row?.leaderVotes);
    const leaderSharePct = Number(row?.leaderSharePct);
    const marginVotes = Number(row?.marginVotes);
    const marginPct = Number(row?.marginPct);
    const topCandidate = leaderId
      ? `${leaderId} (${fmtInt(leaderVotes)} · ${fmtPct(leaderSharePct, 1)})`
      : "—";
    const marginText = Number.isFinite(marginVotes)
      ? `${fmtInt(marginVotes)}${Number.isFinite(marginPct) ? ` (${fmtPct(marginPct, 1)})` : ""}`
      : "—";
    const mappedGeoCount = Number(row?.mappedGeoCount);
    const districtWeightPct = Number(row?.districtWeightPct);
    const mappingText = `${Number.isFinite(mappedGeoCount) ? fmtInt(mappedGeoCount) : "—"} · ${Number.isFinite(districtWeightPct) ? fmtPct(districtWeightPct, 1) : "—"}`;
    const topGeoLinks = Array.isArray(row?.topGeoLinks) ? row.topGeoLinks : [];
    const topLinksText = topGeoLinks.length
      ? topGeoLinks.map((x) => `${String(x?.geoid || "—")} (${fmtPct(Number(x?.effectiveWeightPct) / 100, 1)})`).join(", ")
      : "—";
    tr.innerHTML = `
      <td>${String(row?.precinctId || "—")}</td>
      <td class="num">${fmtInt(row?.totalVotes)}</td>
      <td>${topCandidate}</td>
      <td class="num">${marginText}</td>
      <td class="num">${mappingText}</td>
      <td>${topLinksText}</td>
      <td class="num">${fmtInt(row?.candidateCount)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderDistrictEvidenceMap(svgEl, statusEl, mapLayer, opts = {}){
  renderIntelGeoMap(svgEl, statusEl, {
    mapLayer,
    yourCandidateId: String(opts?.yourCandidateId || "").trim(),
    area: opts?.area || null,
    areaBoundary: opts?.areaBoundary || null,
    selectedGeoId: String(opts?.selectedGeoId || "").trim(),
    onSelectGeo: typeof opts?.onSelectGeo === "function" ? opts.onSelectGeo : null,
  });
}

function extractGeoInspectorRow(geoRows, geoid){
  const id = String(geoid || "").trim();
  if (!id) return null;
  const rows = Array.isArray(geoRows) ? geoRows : [];
  for (const row of rows){
    if (String(row?.geoid || "").trim() === id) return row;
  }
  return null;
}

function fillGeoInspectorSelect(selectEl, geoRows, selectedGeoId){
  if (!selectEl) return;
  const rows = Array.isArray(geoRows) ? geoRows : [];
  const keep = String(selectedGeoId || "").trim();
  selectEl.innerHTML = "";
  if (!rows.length){
    selectEl.disabled = true;
    selectEl.appendChild(makeOption("", "No GEO available"));
    selectEl.value = "";
    return;
  }
  selectEl.disabled = false;
  let hasSelected = false;
  for (const row of rows){
    const geoid = String(row?.geoid || "").trim();
    if (!geoid) continue;
    if (geoid === keep) hasSelected = true;
    const votes = Number.isFinite(Number(row?.totalVotes)) ? fmtInt(row.totalVotes) : "—";
    const margin = Number.isFinite(Number(row?.marginPct)) ? fmtPct(row.marginPct, 1) : "—";
    const label = `${geoid} · votes ${votes} · margin ${margin}`;
    selectEl.appendChild(makeOption(geoid, label));
  }
  const fallback = String(rows[0]?.geoid || "").trim();
  selectEl.value = hasSelected ? keep : fallback;
}

function fillGeoInspectorCensusTable(tbody, census){
  if (!tbody) return;
  tbody.innerHTML = "";
  const data = (census && typeof census === "object") ? census : {};
  const keys = Object.keys(data).sort((a, b) => a.localeCompare(b));
  if (!keys.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="2" class="muted">No census values loaded for selected GEO.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const key of keys){
    const raw = data[key];
    const num = Number(raw);
    const value = Number.isFinite(num)
      ? (Number.isInteger(num) ? num.toLocaleString() : num.toFixed(3))
      : String(raw == null ? "—" : raw);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${key}</td><td class="num">${value}</td>`;
    tbody.appendChild(tr);
  }
}

function buildGeoInspectorSummaryText(args){
  const geoid = String(args?.geoid || "").trim();
  if (!geoid) return "";
  const totalVotes = Math.max(0, Number(args?.totalVotes) || 0);
  const leaderId = String(args?.leaderId || "").trim();
  const leaderVotes = Math.max(0, Number(args?.leaderVotes) || 0);
  const leaderSharePct = Number.isFinite(Number(args?.leaderSharePct)) ? Number(args.leaderSharePct) : null;
  const marginVotes = Math.max(0, Number(args?.marginVotes) || 0);
  const marginPct = Number.isFinite(Number(args?.marginPct)) ? Number(args.marginPct) : null;
  const pop = Number.isFinite(Number(args?.population)) ? Number(args.population) : null;
  const housing = Number.isFinite(Number(args?.housingUnits)) ? Number(args.housingUnits) : null;
  const sourcePrecincts = Math.max(0, Number(args?.sourcePrecincts) || 0);
  const census = (args?.census && typeof args.census === "object") ? args.census : {};
  const censusKeys = Object.keys(census).sort((a, b) => a.localeCompare(b));
  const lines = [
    `GEOID: ${geoid}`,
    `Total votes: ${fmtInt(totalVotes)}`,
    `Leader: ${leaderId || "—"}${leaderId ? ` (${fmtInt(leaderVotes)}${leaderSharePct != null ? `, ${fmtPct(leaderSharePct, 1)}` : ""})` : ""}`,
    `Margin: ${fmtInt(marginVotes)}${marginPct != null ? ` (${fmtPct(marginPct, 1)})` : ""}`,
    `Precinct links: ${fmtInt(sourcePrecincts)}`,
    `Population: ${pop != null ? fmtInt(pop) : "—"}`,
    `Households: ${housing != null ? fmtInt(housing) : "—"}`,
    "",
    "Census values:",
  ];
  if (!censusKeys.length){
    lines.push("- none");
  } else {
    for (const key of censusKeys){
      const raw = census[key];
      const n = Number(raw);
      const value = Number.isFinite(n)
        ? (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(3))
        : String(raw == null ? "—" : raw);
      lines.push(`- ${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

function renderGeoInspector(els, geoRows, selectedGeoId){
  const rows = Array.isArray(geoRows) ? geoRows : [];
  const row = extractGeoInspectorRow(rows, selectedGeoId);
  const geoid = String(selectedGeoId || "").trim();
  const candidateVotes = row && typeof row.candidateVotes === "object" ? row.candidateVotes : {};
  const ranked = Object.keys(candidateVotes)
    .map((candidateId) => ({
      candidateId: String(candidateId || "").trim(),
      votes: Number(candidateVotes[candidateId]) || 0,
    }))
    .filter((x) => x.candidateId && x.votes > 0)
    .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));
  const totalVotes = Math.max(0, Number(row?.totalVotes) || 0);
  const leader = ranked[0] || null;
  const runner = ranked[1] || null;
  const leaderVotes = Number(leader?.votes || 0);
  const marginVotes = Math.max(0, leaderVotes - Number(runner?.votes || 0));
  const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
  const leaderSharePct = totalVotes > 0 ? (leaderVotes / totalVotes) * 100 : null;
  const census = row && typeof row.census === "object" ? row.census : {};
  const pop = Number(census?.pop ?? census?.B01003_001E ?? census?.B01003_001 ?? census?.total_population);
  const housing = Number(census?.housing_units ?? census?.B25001_001E ?? census?.B25001_001 ?? census?.total_housing_units);

  const selectorRows = rows
    .map((row) => {
      const geoid = String(row?.geoid || "").trim();
      const totalVotes = Number(row?.totalVotes);
      const candidateVotes = row && typeof row.candidateVotes === "object" ? row.candidateVotes : {};
      const ranked = Object.keys(candidateVotes)
        .map((candidateId) => ({
          candidateId: String(candidateId || "").trim(),
          votes: Number(candidateVotes[candidateId]) || 0,
        }))
        .filter((x) => x.candidateId && x.votes > 0)
        .sort((a, b) => (b.votes - a.votes) || a.candidateId.localeCompare(b.candidateId));
      const leaderVotes = Number(ranked?.[0]?.votes || 0);
      const runnerVotes = Number(ranked?.[1]?.votes || 0);
      const marginVotes = Math.max(0, leaderVotes - runnerVotes);
      const marginPct = totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
      return { geoid, totalVotes, marginPct };
    })
    .filter((x) => x.geoid)
    .sort((a, b) => (Number(b?.totalVotes) || 0) - (Number(a?.totalVotes) || 0));
  fillGeoInspectorSelect(els.intelGeoInspectorSelect, selectorRows, geoid);
  if (els.intelGeoInspectorStatus){
    els.intelGeoInspectorStatus.classList.remove("ok", "warn", "bad", "muted");
    if (!geoid){
      els.intelGeoInspectorStatus.classList.add("muted");
      els.intelGeoInspectorStatus.textContent = "No GEO selected.";
    } else if (!row){
      els.intelGeoInspectorStatus.classList.add("warn");
      els.intelGeoInspectorStatus.textContent = `Selected GEO ${geoid} not found in current evidence rows.`;
    } else {
      els.intelGeoInspectorStatus.classList.add("ok");
      els.intelGeoInspectorStatus.textContent = `Selected ${geoid} · precinct links ${fmtInt(row?.sourcePrecincts)} · votes ${fmtInt(totalVotes)}.`;
    }
  }
  if (els.intelGeoInspectorRace){
    els.intelGeoInspectorRace.textContent = leader
      ? `${leader.candidateId} ${fmtInt(leaderVotes)} (${fmtPct(leaderSharePct, 1)}) · margin ${fmtInt(marginVotes)} (${Number.isFinite(marginPct) ? fmtPct(marginPct, 1) : "—"})`
      : "No election votes for selected GEO.";
  }
  if (els.intelGeoInspectorHouseholds){
    els.intelGeoInspectorHouseholds.textContent = Number.isFinite(housing)
      ? fmtInt(housing)
      : "—";
  }
  if (els.intelGeoInspectorPopulation){
    els.intelGeoInspectorPopulation.textContent = Number.isFinite(pop)
      ? fmtInt(pop)
      : "—";
  }
  fillGeoInspectorCensusTable(els.intelGeoInspectorCensusTbody, census);
  const summary = row
    ? buildGeoInspectorSummaryText({
      geoid,
      totalVotes,
      leaderId: leader?.candidateId || "",
      leaderVotes,
      leaderSharePct,
      marginVotes,
      marginPct,
      sourcePrecincts: Number(row?.sourcePrecincts) || 0,
      population: pop,
      housingUnits: housing,
      census,
    })
    : "";
  if (els.intelGeoInspectorSummary){
    els.intelGeoInspectorSummary.value = summary || "No selected GEO summary available.";
  }
  if (els.btnIntelGeoInspectorCopy){
    els.btnIntelGeoInspectorCopy.disabled = !summary;
  }
  if (els.intelGeoInspectorCopyStatus && !summary){
    els.intelGeoInspectorCopyStatus.classList.remove("ok", "warn", "bad");
    els.intelGeoInspectorCopyStatus.classList.add("muted");
    els.intelGeoInspectorCopyStatus.textContent = "No summary copied yet.";
  }
}

function fillDistrictEvidenceDatasetRankTable(tbody, rows, selectedElectionId){
  if (!tbody) return;
  tbody.innerHTML = "";
  const selectedId = String(selectedElectionId || "").trim();
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="8" class="muted">No compatible election datasets available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const top = rows.slice(0, 8);
  for (let i = 0; i < top.length; i++){
    const row = top[i] || {};
    const dataset = row.dataset || {};
    const id = String(dataset.id || "");
    const rank = i + 1;
    const selectedTag = selectedId && id === selectedId ? "Selected" : "";
    const score = Number(row.score);
    const yearGap = Number(row?.yearGap);
    const coverage = Number(row?.coveragePct);
    const reasons = Array.isArray(row.reasons) ? row.reasons.slice(0, 3).join(", ") : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${rank}</td>
      <td>${id || "—"}</td>
      <td>${String(dataset.officeType || "—")}</td>
      <td>${String(dataset.vintage || dataset.cycleYear || "—")}</td>
      <td class="num">${Number.isFinite(yearGap) ? String(Math.max(0, Math.round(yearGap))) : "—"}</td>
      <td class="num">${Number.isFinite(coverage) ? `${coverage.toFixed(1)}%` : "—"}</td>
      <td class="num">${Number.isFinite(score) ? score.toFixed(2) : "—"}</td>
      <td>${selectedTag || reasons || "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fillDataRefSelect(selectEl, rows, selectedId, labelFn, emptyLabel = "None selected"){
  if (!selectEl) return;
  const keep = String(selectedId || "").trim();
  const list = Array.isArray(rows) ? rows : [];
  selectEl.innerHTML = "";
  selectEl.appendChild(makeOption("", emptyLabel));
  let hasSelected = false;
  for (const row of list){
    const id = String(row?.id || "").trim();
    if (!id) continue;
    if (id === keep) hasSelected = true;
    const label = String(typeof labelFn === "function" ? labelFn(row) : id).trim() || id;
    selectEl.appendChild(makeOption(id, label));
  }
  if (keep && !hasSelected){
    selectEl.appendChild(makeOption(keep, `${keep} (missing from catalog)`));
  }
  selectEl.value = keep;
  if (selectEl.value !== keep) selectEl.value = "";
}

function dataRefItemLabel(row, kind){
  const id = String(row?.id || "").trim();
  if (!id) return "—";
  const tags = [];
  if (row?.isVerified) tags.push("verified");
  if (row?.isLatest) tags.push("latest");
  if (kind === "boundary"){
    const label = String(row?.label || "").trim();
    const vintage = String(row?.vintage || "").trim();
    return `${id}${label ? ` · ${label}` : ""}${vintage ? ` · ${vintage}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
  }
  if (kind === "crosswalk"){
    const fromId = String(row?.fromBoundarySetId || "").trim();
    const toId = String(row?.toBoundarySetId || "").trim();
    const method = String(row?.method || "").trim();
    const unit = String(row?.unit || "").trim();
    return `${id}${fromId && toId ? ` · ${fromId}→${toId}` : ""}${unit || method ? ` · ${unit}${method ? `/${method}` : ""}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
  }
  if (kind === "election"){
    const office = String(row?.officeType || "").trim();
    const cycle = String(row?.cycleYear || row?.vintage || "").trim();
    return `${id}${office ? ` · ${office}` : ""}${cycle ? ` · ${cycle}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
  }
  const vintage = String(row?.vintage || "").trim();
  return `${id}${vintage ? ` · ${vintage}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
}

function areaIdentityLabel(area){
  const a = area && typeof area === "object" ? area : {};
  const type = String(a.type || "").toUpperCase();
  const stateFips = String(a.stateFips || "").trim();
  const district = String(a.district || "").trim();
  const countyFips = String(a.countyFips || "").trim();
  const placeFips = String(a.placeFips || "").trim();
  if (type === "CD" || type === "SLDU" || type === "SLDL"){
    return `${type} ${stateFips || "--"}:${district || "---"}`;
  }
  if (type === "COUNTY"){
    return `${type} ${stateFips || "--"}:${countyFips || "---"}`;
  }
  if (type === "PLACE"){
    return `${type} ${stateFips || "--"}:${placeFips || "-----"}`;
  }
  if (type === "CUSTOM"){
    const bits = [stateFips, district, countyFips, placeFips].filter(Boolean);
    return bits.length ? `${type} ${bits.join(":")}` : "CUSTOM";
  }
  return "Not set";
}

function areaReadyForFlow(area){
  const type = String(area?.type || "").trim().toUpperCase();
  const stateFips = String(area?.stateFips || "").trim();
  const district = String(area?.district || "").trim();
  const countyFips = String(area?.countyFips || "").trim();
  const placeFips = String(area?.placeFips || "").trim();
  if (!type) return false;
  if (type === "CD" || type === "SLDU" || type === "SLDL"){
    return stateFips.length === 2 && district.length > 0;
  }
  if (type === "COUNTY"){
    return stateFips.length === 2 && countyFips.length >= 3;
  }
  if (type === "PLACE"){
    return stateFips.length === 2 && placeFips.length === 5;
  }
  if (type === "CUSTOM"){
    return !!(stateFips || district || countyFips || placeFips || String(area?.label || "").trim());
  }
  return false;
}

function digitsOnly(v){
  return String(v == null ? "" : v).replace(/\D+/g, "");
}

function normalizedStateForLinks(v){
  const d = digitsOnly(v);
  if (!d) return "";
  return d.slice(0, 2).padStart(2, "0");
}

function normalizedCountyForLinks(stateFips, countyFips){
  const c = digitsOnly(countyFips);
  if (!c) return "";
  if (c.length >= 5){
    const state = normalizedStateForLinks(stateFips);
    if (state && c.slice(0, 2) === state) return c.slice(2, 5);
    return c.slice(-3);
  }
  if (c.length >= 3) return c.slice(0, 3);
  return "";
}

function buildAreaCodeLinksHtml(area){
  const baseStateList = "https://www2.census.gov/geo/docs/reference/codes2020/national_state2020.txt";
  const baseCountyList = "https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt";
  const basePlaceList = "https://www2.census.gov/geo/docs/reference/codes2020/national_place2020.txt";
  const state = normalizedStateForLinks(area?.stateFips);
  const county3 = normalizedCountyForLinks(state, area?.countyFips);
  const links = [
    `<a href="${baseStateList}" target="_blank" rel="noopener noreferrer">State FIPS list</a>`,
    `<a href="${baseCountyList}" target="_blank" rel="noopener noreferrer">County FIPS file</a>`,
    `<a href="${basePlaceList}" target="_blank" rel="noopener noreferrer">Place FIPS file</a>`,
  ];
  if (!state){
    return `Code lookup: ${links.join(" · ")} · Enter State FIPS for scoped Census API lookups.`;
  }
  const countyApi = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${state}`;
  const placeApi = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=place:*&in=state:${state}`;
  const tractApi = county3
    ? `https://api.census.gov/data/2020/dec/pl?get=NAME&for=tract:*&in=state:${state}%20county:${county3}`
    : `https://api.census.gov/data/2020/dec/pl?get=NAME&for=tract:*&in=state:${state}`;
  links.push(`<a href="${countyApi}" target="_blank" rel="noopener noreferrer">Counties in state ${state}</a>`);
  links.push(`<a href="${placeApi}" target="_blank" rel="noopener noreferrer">Places in state ${state}</a>`);
  links.push(`<a href="${tractApi}" target="_blank" rel="noopener noreferrer">Tracts${county3 ? ` in county ${county3}` : " in state"}</a>`);
  if (county3){
    const bgApi = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=block%20group:*&in=state:${state}%20county:${county3}`;
    links.push(`<a href="${bgApi}" target="_blank" rel="noopener noreferrer">Block groups in county ${county3}</a>`);
  }
  return `Code lookup: ${links.join(" · ")}`;
}

function normalizedGeoIdForAssist(geoidRaw, resolution){
  const g = digitsOnly(geoidRaw);
  if (!g) return "";
  if (String(resolution || "").toLowerCase() === "block_group"){
    return g.length >= 12 ? g.slice(0, 12) : "";
  }
  return g.length >= 11 ? g.slice(0, 11) : "";
}

function extractPlaceCodeForAssist(row){
  if (!row || typeof row !== "object") return "";
  const keys = ["placeFips", "place_fips", "place", "placeCode", "PLACEFP", "PLACEFP20"];
  for (const key of keys){
    const d = digitsOnly(row[key]);
    if (d.length === 5) return d;
  }
  const values = row.values && typeof row.values === "object" ? row.values : null;
  if (values){
    for (const key of keys){
      const d = digitsOnly(values[key]);
      if (d.length === 5) return d;
    }
  }
  return "";
}

function buildAreaAssistModel(censusGeoRows, area){
  const rows = Array.isArray(censusGeoRows) ? censusGeoRows : [];
  const stateRequested = normalizedStateForLinks(area?.stateFips);
  const countyFilter = normalizedCountyForLinks(stateRequested, area?.countyFips);
  const placeFilter = digitsOnly(area?.placeFips).slice(0, 5);
  const resolution = String(area?.resolution || "tract").toLowerCase();
  const stateCounts = new Map();
  const countyCounts = new Map();
  const placeCounts = new Map();
  const geoSet = new Set();
  const geos = [];
  for (const row of rows){
    const geoid = digitsOnly(row?.geoid);
    if (geoid.length < 11) continue;
    const rowState = geoid.slice(0, 2);
    const rowCounty = geoid.slice(2, 5);
    stateCounts.set(rowState, (stateCounts.get(rowState) || 0) + 1);
    if (stateRequested && rowState !== stateRequested) continue;
    const county5 = `${rowState}${rowCounty}`;
    countyCounts.set(county5, (countyCounts.get(county5) || 0) + 1);
    const placeCode = extractPlaceCodeForAssist(row);
    if (placeCode){
      const placeKey = `${rowState}${placeCode}`;
      placeCounts.set(placeKey, (placeCounts.get(placeKey) || 0) + 1);
    }
    if (countyFilter && rowCounty !== countyFilter) continue;
    if (placeFilter && placeCode !== placeFilter) continue;
    const normalizedGeo = normalizedGeoIdForAssist(geoid, resolution);
    if (!normalizedGeo || geoSet.has(normalizedGeo)) continue;
    geoSet.add(normalizedGeo);
    geos.push(normalizedGeo);
  }
  const states = Array.from(stateCounts.entries())
    .map(([stateFips, count]) => ({ stateFips, count }))
    .sort((a, b) => a.stateFips.localeCompare(b.stateFips));
  const counties = Array.from(countyCounts.entries())
    .map(([county5, count]) => ({ county5, count }))
    .sort((a, b) => a.county5.localeCompare(b.county5));
  const places = Array.from(placeCounts.entries())
    .map(([key, count]) => ({ stateFips: key.slice(0, 2), placeFips: key.slice(2, 7), count }))
    .sort((a, b) => {
      const p = a.placeFips.localeCompare(b.placeFips);
      return p !== 0 ? p : a.stateFips.localeCompare(b.stateFips);
    });
  geos.sort((a, b) => a.localeCompare(b));
  return { states, counties, places, geos, state: stateRequested, countyFilter, placeFilter, resolution };
}

function fillAreaAssistStateSelect(selectEl, states, area){
  if (!selectEl) return;
  const state = normalizedStateForLinks(area?.stateFips);
  const rows = Array.isArray(states) ? states : [];
  selectEl.innerHTML = "";
  if (!rows.length){
    selectEl.appendChild(makeOption("", "No state suggestions"));
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  selectEl.appendChild(makeOption("", "Select state"));
  let hasSelected = false;
  for (const row of rows){
    const stateFips = String(row?.stateFips || "");
    if (!stateFips) continue;
    if (state && state === stateFips) hasSelected = true;
    const stateLabel = STATE_LABEL_BY_FIPS[stateFips] ? `${STATE_LABEL_BY_FIPS[stateFips]} (${stateFips})` : stateFips;
    const label = `${stateLabel} · ${fmtInt(row?.count)} GEO rows`;
    selectEl.appendChild(makeOption(stateFips, label));
  }
  selectEl.value = hasSelected ? state : "";
}

function fillAreaAssistCountySelect(selectEl, counties, area){
  if (!selectEl) return;
  const state = normalizedStateForLinks(area?.stateFips);
  const countyFilter = normalizedCountyForLinks(state, area?.countyFips);
  const preferredCounty5 = countyFilter && state ? `${state}${countyFilter}` : "";
  const rows = Array.isArray(counties) ? counties : [];
  selectEl.innerHTML = "";
  if (!state){
    selectEl.appendChild(makeOption("", "Set state first"));
    selectEl.disabled = true;
    return;
  }
  if (!rows.length){
    selectEl.appendChild(makeOption("", "No county suggestions"));
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  selectEl.appendChild(makeOption("", "Select county"));
  let hasSelected = false;
  for (const row of rows){
    const county5 = String(row?.county5 || "");
    if (!county5) continue;
    if (preferredCounty5 && preferredCounty5 === county5) hasSelected = true;
    const label = `${county5} · ${fmtInt(row?.count)} GEO rows`;
    selectEl.appendChild(makeOption(county5, label));
  }
  if (hasSelected){
    selectEl.value = preferredCounty5;
  } else {
    selectEl.value = "";
  }
}

function fillAreaAssistPlaceSelect(selectEl, places, area){
  if (!selectEl) return;
  const state = normalizedStateForLinks(area?.stateFips);
  const placeFilter = digitsOnly(area?.placeFips).slice(0, 5);
  const rows = Array.isArray(places) ? places : [];
  selectEl.innerHTML = "";
  if (!state){
    selectEl.appendChild(makeOption("", "Set state first"));
    selectEl.disabled = true;
    return;
  }
  if (!rows.length){
    selectEl.appendChild(makeOption("", "No place suggestions"));
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  selectEl.appendChild(makeOption("", "Select place"));
  let hasSelected = false;
  let added = 0;
  for (const row of rows){
    const stateFips = String(row?.stateFips || "");
    const placeFips = String(row?.placeFips || "");
    if (!stateFips || !placeFips) continue;
    const value = `${stateFips}${placeFips}`;
    if (state && stateFips !== state) continue;
    if (placeFilter && placeFips === placeFilter) hasSelected = true;
    const label = `${value} · ${fmtInt(row?.count)} GEO rows`;
    selectEl.appendChild(makeOption(value, label));
    added++;
  }
  if (!added){
    selectEl.innerHTML = "";
    selectEl.appendChild(makeOption("", "No place suggestions"));
    selectEl.disabled = true;
    return;
  }
  if (hasSelected && state){
    selectEl.value = `${state}${placeFilter}`;
  } else {
    selectEl.value = "";
  }
}

function fillAreaAssistGeoSelect(selectEl, geos, selectedGeoId, area){
  if (!selectEl) return;
  const state = normalizedStateForLinks(area?.stateFips);
  const rows = Array.isArray(geos) ? geos : [];
  const keep = normalizedGeoIdForAssist(selectedGeoId, String(rows?.[0]?.length === 12 ? "block_group" : "tract"));
  selectEl.innerHTML = "";
  if (!state){
    selectEl.appendChild(makeOption("", "Set state first"));
    selectEl.disabled = true;
    return;
  }
  if (!rows.length){
    selectEl.appendChild(makeOption("", "No GEO suggestions"));
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  selectEl.appendChild(makeOption("", "Select tract/block"));
  let hasSelected = false;
  for (const geoid of rows){
    const id = String(geoid || "");
    if (!id) continue;
    if (keep && keep === id) hasSelected = true;
    const label = id.length === 12
      ? `${id} · block group ${id.slice(11, 12)}`
      : `${id} · tract ${id.slice(5, 11)}`;
    selectEl.appendChild(makeOption(id, label));
  }
  if (hasSelected){
    selectEl.value = keep;
  } else {
    selectEl.value = "";
  }
}

function renderDataRefStatus(el, text, kind = "muted"){
  if (!el) return;
  el.classList.remove("ok", "warn", "bad", "muted");
  el.classList.add(kind);
  el.textContent = String(text || "Data refs ready.");
}

function toFinite(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toPct(v, digits = 1){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(Math.max(0, digits | 0))}%`;
}

function toRate(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return null;
}

function fmtWhatIfTarget(row){
  const op = String(row?.op || "").trim();
  const label = String(row?.label || row?.key || "assumption");
  if (op === "delta"){
    const n = Number(row?.delta ?? row?.value);
    const signed = Number.isFinite(n)
      ? `${n >= 0 ? "+" : ""}${Number.isInteger(n) ? String(n) : n.toFixed(2)}`
      : "—";
    return `${label}: ${signed}`;
  }
  const n = Number(row?.suggestedValue ?? row?.value);
  const value = Number.isFinite(n)
    ? (Number.isInteger(n) ? String(n) : n.toFixed(2))
    : "—";
  return `${label}: ${value}`;
}

export function renderIntelChecksModule({
  els,
  state,
  engine,
  benchmarkWarnings = [],
  driftSummary = null,
} = {}){
  if (!els || !state) return;
  ensureIntelCollections(state);

  const benchmarks = listIntelBenchmarks(state).sort((a, b) => {
    const ar = String(a?.ref || "");
    const br = String(b?.ref || "");
    return ar.localeCompare(br);
  });

  const missingAudit = listMissingEvidenceAudit(state, { limit: 200 });
  const missingNoteAudit = listMissingNoteAudit(state, { limit: 200 });
  const evidenceRows = listIntelEvidence(state, { limit: 8 });
  const workflow = getIntelWorkflow(state) || {};
  const integrity = computeIntelIntegrityScore(state, {
    benchmarkWarnings,
    driftFlags: Array.isArray(driftSummary?.flags) ? driftSummary.flags : [],
    staleDays: 30,
  });

  if (els.intelBenchmarkCount){
    els.intelBenchmarkCount.textContent = `${benchmarks.length} benchmark entr${benchmarks.length === 1 ? "y" : "ies"} configured.`;
  }
  if (els.intelBenchmarkStatus && !String(els.intelBenchmarkStatus.textContent || "").trim()){
    els.intelBenchmarkStatus.classList.remove("ok", "warn", "bad");
    els.intelBenchmarkStatus.classList.add("muted");
    els.intelBenchmarkStatus.textContent = "Ready.";
  }
  if (els.intelMissingEvidenceCount){
    els.intelMissingEvidenceCount.textContent = missingAudit.length
      ? `${missingAudit.length} critical assumption edit(s) missing evidence. Select one below and attach supporting evidence.`
      : "No critical assumption edits are missing evidence.";
  }
  if (els.intelMissingNoteCount){
    els.intelMissingNoteCount.textContent = missingNoteAudit.length
      ? `${missingNoteAudit.length} critical assumption edit(s) missing note. Add a short note in Evidence notes to resolve.`
      : "No critical assumption edits are missing notes.";
  }
  if (els.intelEvidenceStatus && !String(els.intelEvidenceStatus.textContent || "").trim()){
    els.intelEvidenceStatus.classList.remove("ok", "warn", "bad");
    els.intelEvidenceStatus.classList.add("muted");
    els.intelEvidenceStatus.textContent = "Select an audit item, then attach evidence. Add a note when required.";
  }

  fillBenchmarkTable(els.intelBenchmarkTbody, benchmarks);
  fillAuditSelect(els.intelAuditSelect, missingAudit);
  fillEvidenceTable(els.intelEvidenceTbody, evidenceRows);

  if (els.intelScenarioLocked){
    els.intelScenarioLocked.checked = !!workflow.scenarioLocked;
  }
  if (els.intelRequireCriticalNote){
    els.intelRequireCriticalNote.checked = workflow.requireCriticalNote !== false;
  }
  if (els.intelRequireCriticalEvidence){
    els.intelRequireCriticalEvidence.checked = workflow.requireCriticalEvidence !== false;
  }
  if (els.intelScenarioLockReason && document.activeElement !== els.intelScenarioLockReason){
    els.intelScenarioLockReason.value = String(workflow.lockReason || "");
  }
  if (els.intelCriticalChangeNote && document.activeElement !== els.intelCriticalChangeNote){
    const pendingNote = String(state?.ui?.pendingCriticalNote || "");
    if (els.intelCriticalChangeNote.value !== pendingNote) els.intelCriticalChangeNote.value = pendingNote;
  }
  if (els.intelScenarioLockStatus){
    els.intelScenarioLockStatus.classList.remove("ok", "warn", "bad", "muted");
    if (workflow.scenarioLocked){
      els.intelScenarioLockStatus.classList.add("warn");
      const reason = String(workflow.lockReason || "").trim();
      els.intelScenarioLockStatus.textContent = reason
        ? `Scenario lock ON. Reason: ${reason}`
        : "Scenario lock ON. Inputs are read-only until unlocked.";
    } else {
      els.intelScenarioLockStatus.classList.add("muted");
      els.intelScenarioLockStatus.textContent = "Scenario lock OFF.";
    }
  }
  if (els.intelWorkflowStatus){
    els.intelWorkflowStatus.classList.remove("ok", "warn", "bad", "muted");
    const integrityText = `Integrity score: ${integrity.score} (${integrity.grade}).`;
    if (missingAudit.length || missingNoteAudit.length){
      els.intelWorkflowStatus.classList.add(integrity.score < 70 ? "bad" : "warn");
      const parts = [];
      if (missingAudit.length) parts.push(`${missingAudit.length} missing evidence`);
      if (missingNoteAudit.length) parts.push(`${missingNoteAudit.length} missing note`);
      els.intelWorkflowStatus.textContent = `Open governance items: ${parts.join(", ")}. ${integrityText}`;
    } else {
      if (integrity.score >= 85){
        els.intelWorkflowStatus.classList.add("ok");
        els.intelWorkflowStatus.textContent = `Governance controls healthy. ${integrityText}`;
      } else if (integrity.score >= 70){
        els.intelWorkflowStatus.classList.add("warn");
        els.intelWorkflowStatus.textContent = `Governance controls mostly healthy. ${integrityText}`;
      } else {
        els.intelWorkflowStatus.classList.add("bad");
        els.intelWorkflowStatus.textContent = `Governance attention needed. ${integrityText}`;
      }
    }
  }

  if (els.intelEvidenceCapturedAt && !els.intelEvidenceCapturedAt.value){
    els.intelEvidenceCapturedAt.value = new Date().toISOString().slice(0, 10);
  }

  const knownBriefKinds = new Set(listIntelBriefKinds());
  const selectedBriefKind = (() => {
    const raw = String(state?.ui?.intelBriefKind || els.intelBriefKind?.value || "calibrationSources").trim();
    return knownBriefKinds.has(raw) ? raw : "calibrationSources";
  })();
  if (state?.ui){
    state.ui.intelBriefKind = selectedBriefKind;
  }
  if (els.intelBriefKind && document.activeElement !== els.intelBriefKind){
    els.intelBriefKind.value = selectedBriefKind;
  }

  const calibrationBrief = getLatestBriefByKind(state, selectedBriefKind);
  const mcDist = String(state?.intelState?.simToggles?.mcDistribution || "triangular");
  const correlatedShocks = !!state?.intelState?.simToggles?.correlatedShocks;
  const corrMatrixId = String(state?.intelState?.simToggles?.correlationMatrixId || "");
  const corrModels = Array.isArray(state?.intelState?.correlationModels)
    ? state.intelState.correlationModels
    : [];
  const shockEnabled = !!state?.intelState?.simToggles?.shockScenariosEnabled;
  const shockRows = listShockScenarios(state);
  const decayEnabled = !!state?.intelState?.expertToggles?.capacityDecayEnabled;
  const decayModelType = String(state?.intelState?.expertToggles?.decayModel?.type || "linear");
  const decayWeeklyPct = Number(state?.intelState?.expertToggles?.decayModel?.weeklyDecayPct);
  const decayFloorPct = Number(state?.intelState?.expertToggles?.decayModel?.floorPctOfBaseline);
  const observedRows = Array.isArray(state?.intelState?.observedMetrics) ? state.intelState.observedMetrics : [];
  const recommendationRows = Array.isArray(state?.intelState?.recommendations) ? state.intelState.recommendations : [];
  const whatIfRows = listIntelRequests(state, { limit: 25 });
  const autoDriftRecs = recommendationRows
    .filter((x) => String(x?.source || "").trim() === "auto.realityDrift.v1")
    .sort((a, b) => Number(a?.priority || 99) - Number(b?.priority || 99));
  if (els.intelMcDistribution){
    els.intelMcDistribution.value = mcDist;
  }
  if (els.intelCorrelatedShocks){
    els.intelCorrelatedShocks.checked = correlatedShocks;
  }
  fillCorrelationSelect(els.intelCorrelationMatrixId, corrModels, corrMatrixId);
  if (els.intelCorrelationMatrixId){
    els.intelCorrelationMatrixId.disabled = !corrModels.length;
  }
  const selectedCorr = corrModels.find((row) => String(row?.id || "").trim() === corrMatrixId) || null;
  const selectedCorrLabel = String(selectedCorr?.label || selectedCorr?.id || "").trim();
  if (els.intelCorrelationStatus){
    els.intelCorrelationStatus.classList.remove("ok", "warn", "bad", "muted");
    if (!corrModels.length){
      els.intelCorrelationStatus.classList.add("warn");
      els.intelCorrelationStatus.textContent = "No correlation models configured. Add default model or import JSON first.";
    } else if (!corrMatrixId){
      els.intelCorrelationStatus.classList.add(correlatedShocks ? "warn" : "muted");
      els.intelCorrelationStatus.textContent = correlatedShocks
        ? `Correlated shocks is ON, but no model is selected. Choose one of ${corrModels.length} configured models.`
        : `${corrModels.length} correlation model${corrModels.length === 1 ? "" : "s"} configured. Select one to prepare correlated shocks.`;
    } else {
      els.intelCorrelationStatus.classList.add(correlatedShocks ? "ok" : "muted");
      els.intelCorrelationStatus.textContent = correlatedShocks
        ? `Using "${selectedCorrLabel || corrMatrixId}" for correlated shocks. Re-run Monte Carlo to apply.`
        : `Selected "${selectedCorrLabel || corrMatrixId}". Enable Correlated shocks to apply in Monte Carlo.`;
    }
  }
  if (els.intelCorrelationDisabledHint){
    els.intelCorrelationDisabledHint.classList.remove("ok", "warn", "bad", "muted");
    if (!corrModels.length){
      els.intelCorrelationDisabledHint.classList.add("warn");
      els.intelCorrelationDisabledHint.textContent = "Selector disabled: no models configured. Click Add default model or paste JSON and click Import model JSON.";
    } else if (!correlatedShocks){
      els.intelCorrelationDisabledHint.classList.add("muted");
      els.intelCorrelationDisabledHint.textContent = "Correlation model is selectable now. Enable Correlated shocks to use it in Monte Carlo.";
    } else if (!corrMatrixId){
      els.intelCorrelationDisabledHint.classList.add("warn");
      els.intelCorrelationDisabledHint.textContent = "Correlated shocks is ON, but no model is selected yet.";
    } else {
      els.intelCorrelationDisabledHint.classList.add("ok");
      els.intelCorrelationDisabledHint.textContent = "Correlation model is active for the next Monte Carlo run.";
    }
  }
  if (els.intelShockScenariosEnabled){
    els.intelShockScenariosEnabled.checked = shockEnabled;
  }
  if (els.intelCapacityDecayEnabled){
    els.intelCapacityDecayEnabled.checked = decayEnabled;
  }
  if (els.intelDecayModelType){
    els.intelDecayModelType.value = decayModelType;
  }
  if (els.intelDecayWeeklyPct){
    els.intelDecayWeeklyPct.value = pctInputValue(decayWeeklyPct, 1);
  }
  if (els.intelDecayFloorPct){
    els.intelDecayFloorPct.value = pctInputValue(decayFloorPct, 1);
  }
  if (els.intelDecayStatus){
    els.intelDecayStatus.classList.remove("ok", "warn", "bad");
    if (!decayEnabled){
      els.intelDecayStatus.classList.add("muted");
      els.intelDecayStatus.textContent = "Capacity decay OFF (steady capacity assumption).";
    } else {
      const weeklyText = pctInputValue(decayWeeklyPct, 1) || "0";
      const floorText = pctInputValue(decayFloorPct, 1) || "0";
      els.intelDecayStatus.classList.add("ok");
      els.intelDecayStatus.textContent = `Capacity decay ON (${decayModelType}, ${weeklyText}% weekly, floor ${floorText}% baseline). Re-run Monte Carlo to apply.`;
    }
  }
  if (els.intelShockScenarioCount){
    els.intelShockScenarioCount.textContent = `${shockRows.length} scenario${shockRows.length === 1 ? "" : "s"} configured.`;
  }
  if (els.intelShockStatus){
    els.intelShockStatus.classList.remove("ok", "warn", "bad");
    if (!shockRows.length){
      els.intelShockStatus.classList.add("warn");
      els.intelShockStatus.textContent = "No shock scenarios configured. Add or import one before enabling.";
    } else if (shockEnabled){
      els.intelShockStatus.classList.add("ok");
      els.intelShockStatus.textContent = `Shock sampling ON (${shockRows.length} scenario${shockRows.length === 1 ? "" : "s"}). Re-run Monte Carlo to apply.`;
    } else {
      els.intelShockStatus.classList.add("muted");
      els.intelShockStatus.textContent = `Shock sampling OFF (${shockRows.length} scenario${shockRows.length === 1 ? "" : "s"} configured).`;
    }
  }
  if (els.intelCalibrationBriefContent){
    els.intelCalibrationBriefContent.value = calibrationBrief?.content || "";
  }
  if (els.intelCalibrationStatus){
    els.intelCalibrationStatus.classList.remove("ok", "warn", "bad");
    if (calibrationBrief){
      els.intelCalibrationStatus.classList.add("muted");
      const ts = fmtDate(calibrationBrief?.createdAt);
      els.intelCalibrationStatus.textContent = `${intelBriefKindLabel(selectedBriefKind)} brief · last generated ${ts}.`;
    } else {
      els.intelCalibrationStatus.classList.add("muted");
      els.intelCalibrationStatus.textContent = `No ${intelBriefKindLabel(selectedBriefKind).toLowerCase()} brief generated yet.`;
    }
  }
  if (els.intelObservedCount){
    els.intelObservedCount.textContent = `${observedRows.length} observed metric entr${observedRows.length === 1 ? "y" : "ies"} captured.`;
  }
  if (els.intelObservedStatus){
    els.intelObservedStatus.classList.remove("ok", "warn", "bad");
    els.intelObservedStatus.classList.add(observedRows.length ? "muted" : "warn");
    els.intelObservedStatus.textContent = observedRows.length
      ? "Observed metrics are available for drift tracking."
      : "No observed metrics captured yet. Use Capture observed metrics.";
  }
  if (els.intelRecommendationCount){
    els.intelRecommendationCount.textContent = `${autoDriftRecs.length} active drift recommendation${autoDriftRecs.length === 1 ? "" : "s"}.`;
  }
  if (els.intelRecommendationStatus){
    els.intelRecommendationStatus.classList.remove("ok", "warn", "bad");
    if (!observedRows.length){
      els.intelRecommendationStatus.classList.add("warn");
      els.intelRecommendationStatus.textContent = "Capture observed metrics first, then generate drift recommendations.";
    } else if (autoDriftRecs.length){
      els.intelRecommendationStatus.classList.add("ok");
      els.intelRecommendationStatus.textContent = "Drift recommendations are active. Review before applying any assumptions.";
    } else {
      els.intelRecommendationStatus.classList.add("muted");
      els.intelRecommendationStatus.textContent = "No active drift recommendations (within tolerance).";
    }
  }
  if (els.btnIntelApplyTopRecommendation){
    const top = autoDriftRecs[0] || null;
    els.btnIntelApplyTopRecommendation.disabled = !top;
    const p = Number(top?.priority);
    const pText = Number.isFinite(p) ? `P${p}` : "top";
    els.btnIntelApplyTopRecommendation.textContent = top ? `Apply ${pText} recommendation` : "Apply top recommendation";
  }
  if (els.intelRecommendationPreview){
    if (!autoDriftRecs.length){
      els.intelRecommendationPreview.value = "";
    } else {
      const lines = autoDriftRecs.slice(0, 5).map((row, idx) => {
        const p = Number(row?.priority);
        const pText = Number.isFinite(p) ? `P${p}` : "P—";
        const title = String(row?.title || "Recommendation");
        const detail = String(row?.detail || "").trim();
        return `${idx + 1}. [${pText}] ${title}${detail ? `\n   ${detail}` : ""}`;
      });
      els.intelRecommendationPreview.value = lines.join("\n");
    }
  }
  if (els.intelWhatIfCount){
    els.intelWhatIfCount.textContent = `${whatIfRows.length} what-if request${whatIfRows.length === 1 ? "" : "s"} parsed.`;
  }
  if (els.intelWhatIfStatus){
    els.intelWhatIfStatus.classList.remove("ok", "warn", "bad", "muted");
    const latest = whatIfRows[0] || null;
    if (!latest){
      els.intelWhatIfStatus.classList.add("muted");
      els.intelWhatIfStatus.textContent = "No what-if requests parsed yet.";
    } else if (String(latest?.status || "") === "partial"){
      const unresolved = Number(latest?.parsed?.unresolvedCount || 0);
      els.intelWhatIfStatus.classList.add("warn");
      els.intelWhatIfStatus.textContent = unresolved
        ? `Latest request parsed with ${unresolved} unresolved segment${unresolved === 1 ? "" : "s"}.`
        : "Latest request parsed with unresolved segments.";
    } else {
      els.intelWhatIfStatus.classList.add("ok");
      els.intelWhatIfStatus.textContent = "Latest request parsed successfully.";
    }
  }
  if (els.intelWhatIfPreview){
    const latest = whatIfRows[0] || null;
    if (!latest){
      els.intelWhatIfPreview.value = "";
    } else {
      const targets = Array.isArray(latest?.parsed?.targets) ? latest.parsed.targets : [];
      const unresolved = Array.isArray(latest?.parsed?.unresolvedSegments) ? latest.parsed.unresolvedSegments : [];
      const lines = [
        `Prompt: ${String(latest?.prompt || "")}`,
        `Status: ${String(latest?.status || "parsed")}`,
        `Parsed targets: ${targets.length}`,
      ];
      if (targets.length){
        for (const row of targets.slice(0, 8)){
          lines.push(`- ${fmtWhatIfTarget(row)}`);
        }
      }
      if (unresolved.length){
        lines.push(`Unresolved: ${unresolved.length}`);
        for (const row of unresolved.slice(0, 5)){
          lines.push(`- ${String(row?.segment || "segment")} (${String(row?.reason || "unresolved")})`);
        }
      }
      els.intelWhatIfPreview.value = lines.join("\n");
    }
  }

  const useDistrictIntel = !!state?.useDistrictIntel;
  const districtIntelPack = (state?.districtIntelPack && typeof state.districtIntelPack === "object")
    ? state.districtIntelPack
    : {};
  const packReady = !!districtIntelPack?.ready;
  const idxFieldSpeed = toFinite(districtIntelPack?.indices?.fieldSpeed);
  const idxPersuasion = toFinite(districtIntelPack?.indices?.persuasionEnv);
  const idxTurnout = toFinite(districtIntelPack?.indices?.turnoutElasticity);
  const idxDifficulty = toFinite(districtIntelPack?.indices?.fieldDifficulty);
  const dphBase = toFinite(districtIntelPack?.derivedAssumptions?.doorsPerHour?.base);
  const dphAdj = toFinite(districtIntelPack?.derivedAssumptions?.doorsPerHour?.adjusted);
  const srBase = toRate(districtIntelPack?.derivedAssumptions?.persuasionRate?.base);
  const srAdj = toRate(districtIntelPack?.derivedAssumptions?.persuasionRate?.adjusted);
  const orgBase = toFinite(districtIntelPack?.derivedAssumptions?.organizerCapacity?.base);
  const orgAdj = toFinite(districtIntelPack?.derivedAssumptions?.organizerCapacity?.adjusted);
  const turnoutLiftBase = toFinite(districtIntelPack?.derivedAssumptions?.turnoutLift?.base);
  const turnoutLiftAdj = toFinite(districtIntelPack?.derivedAssumptions?.turnoutLift?.adjusted);
  const generatedAtText = String(districtIntelPack?.generatedAt || "").trim();
  const generatedAt = generatedAtText ? generatedAtText.slice(0, 10) : "—";
  const validateDistrictDataContract = engine?.snapshot?.validateDistrictDataContract;
  let districtContract = null;
  if (typeof validateDistrictDataContract === "function"){
    try{
      districtContract = validateDistrictDataContract(state);
    } catch {
      districtContract = null;
    }
  }
  const contractWarnings = Array.isArray(districtContract?.warnings)
    ? districtContract.warnings.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const intelAlignmentWarnings = contractWarnings.filter((x) => {
    const t = String(x || "").toLowerCase();
    return t.includes("provenance") || t.includes("usedistrictintel is on but districtintelpack.ready is false");
  });

  if (els.intelUseDistrictToggle){
    els.intelUseDistrictToggle.checked = useDistrictIntel;
    els.intelUseDistrictToggle.disabled = !packReady;
  }
  if (els.intelDistrictIntelStatus){
    els.intelDistrictIntelStatus.classList.remove("ok", "warn", "bad", "muted");
    if (useDistrictIntel && packReady && intelAlignmentWarnings.length){
      els.intelDistrictIntelStatus.classList.add("warn");
      els.intelDistrictIntelStatus.textContent = `District-intel assumptions are ON, but alignment warnings exist: ${intelAlignmentWarnings[0]}`;
    } else if (useDistrictIntel && packReady){
      els.intelDistrictIntelStatus.classList.add("ok");
      els.intelDistrictIntelStatus.textContent = `District-intel assumptions are ON (generated ${generatedAt}).`;
    } else if (useDistrictIntel && !packReady){
      els.intelDistrictIntelStatus.classList.add("muted");
      els.intelDistrictIntelStatus.textContent = "District-intel requires a ready pack. Generate assumptions to enable it.";
    } else if (!useDistrictIntel && packReady){
      els.intelDistrictIntelStatus.classList.add("muted");
      els.intelDistrictIntelStatus.textContent = `District-intel pack ready (generated ${generatedAt}) but toggle is OFF.`;
    } else {
      els.intelDistrictIntelStatus.classList.add("muted");
      els.intelDistrictIntelStatus.textContent = "District-intel assumptions are OFF.";
    }
  }
  if (els.intelDistrictIntelSummary){
    if (!packReady){
      els.intelDistrictIntelSummary.textContent = "No district-intel pack generated yet.";
    } else {
      const bits = [
        Number.isFinite(idxFieldSpeed) ? `Field speed ${idxFieldSpeed.toFixed(2)}` : null,
        Number.isFinite(idxPersuasion) ? `Persuasion ${idxPersuasion.toFixed(2)}` : null,
        Number.isFinite(idxTurnout) ? `Turnout elasticity ${idxTurnout.toFixed(2)}` : null,
        Number.isFinite(idxDifficulty) ? `Difficulty ${idxDifficulty.toFixed(2)}` : null,
        Number.isFinite(dphBase) && Number.isFinite(dphAdj) ? `Doors/hr ${dphBase.toFixed(1)}→${dphAdj.toFixed(1)}` : null,
        Number.isFinite(srBase) && Number.isFinite(srAdj) ? `Support rate ${toPct(srBase)}→${toPct(srAdj)}` : null,
        Number.isFinite(orgBase) && Number.isFinite(orgAdj) ? `Organizer cap ${orgBase.toFixed(2)}→${orgAdj.toFixed(2)}` : null,
        Number.isFinite(turnoutLiftBase) && Number.isFinite(turnoutLiftAdj) ? `Turnout lift ${turnoutLiftBase.toFixed(2)}→${turnoutLiftAdj.toFixed(2)}` : null,
      ].filter(Boolean);
      els.intelDistrictIntelSummary.textContent = bits.length
        ? bits.join(" · ")
        : "District-intel pack ready (no derived assumption rows available).";
    }
  }
  if (els.intelDistrictIntelAlignment){
    els.intelDistrictIntelAlignment.classList.remove("ok", "warn", "muted");
    if (!packReady){
      els.intelDistrictIntelAlignment.classList.add("muted");
      els.intelDistrictIntelAlignment.textContent = "Alignment: no district-intel pack generated.";
    } else if (intelAlignmentWarnings.length){
      els.intelDistrictIntelAlignment.classList.add("warn");
      const extra = intelAlignmentWarnings.length > 1 ? ` (+${intelAlignmentWarnings.length - 1} more)` : "";
      els.intelDistrictIntelAlignment.textContent = `Alignment warning: ${intelAlignmentWarnings[0]}${extra}`;
    } else if (typeof validateDistrictDataContract !== "function"){
      els.intelDistrictIntelAlignment.classList.add("muted");
      els.intelDistrictIntelAlignment.textContent = "Alignment: validator unavailable in engine snapshot.";
    } else {
      els.intelDistrictIntelAlignment.classList.add("ok");
      els.intelDistrictIntelAlignment.textContent = "Alignment: pack provenance matches active data refs.";
    }
  }
  fillDistrictAssumptionTable(els.intelDistrictAssumptionTbody, districtIntelPack, useDistrictIntel, "pack");

  const compileDistrictEvidence = engine?.snapshot?.compileDistrictEvidence;
  const buildDistrictIntelPackFromEvidence = engine?.snapshot?.buildDistrictIntelPackFromEvidence;
  const summarizeGeoEvidenceLayers = engine?.snapshot?.summarizeGeoEvidenceLayers;
  const summarizeGeoOpportunityLayers = engine?.snapshot?.summarizeGeoOpportunityLayers;
  const buildGeoEvidenceMapLayer = engine?.snapshot?.buildGeoEvidenceMapLayer;
  const summarizePrecinctEvidenceLayers = engine?.snapshot?.summarizePrecinctEvidenceLayers;
  const normalizeCensusManifest = engine?.snapshot?.normalizeCensusManifest;
  const validateCensusManifest = engine?.snapshot?.validateCensusManifest;
  const censusManifestToCatalogEntry = engine?.snapshot?.censusManifestToCatalogEntry;
  const normalizeElectionManifest = engine?.snapshot?.normalizeElectionManifest;
  const validateElectionManifest = engine?.snapshot?.validateElectionManifest;
  const electionManifestToCatalogEntry = engine?.snapshot?.electionManifestToCatalogEntry;
  const resolveDistrictEvidenceInputs = engine?.snapshot?.resolveDistrictEvidenceInputs;
  const summarizeDistrictEvidenceInputs = engine?.snapshot?.summarizeDistrictEvidenceInputs;
  const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;
  const diagnoseDataRefAlignment = engine?.snapshot?.diagnoseDataRefAlignment;
  const buildDataSourceRegistry = engine?.snapshot?.buildDataSourceRegistry;
  const normalizeAreaSelection = engine?.snapshot?.normalizeAreaSelection;
  const deriveAreaResolverContext = engine?.snapshot?.deriveAreaResolverContext;
  const buildAreaResolverCacheKey = engine?.snapshot?.buildAreaResolverCacheKey;
  const rankElectionDatasetsForScenario = engine?.snapshot?.rankElectionDatasetsForScenario;
  let resolvedInputs = null;
  if (typeof resolveDistrictEvidenceInputs === "function"){
    try{
      resolvedInputs = resolveDistrictEvidenceInputs(state);
    } catch {
      resolvedInputs = null;
    }
  }

  const districtBlob = (state?.geoPack && typeof state.geoPack === "object" && state.geoPack.district && typeof state.geoPack.district === "object")
    ? state.geoPack.district
    : {};
  const evidenceInputs = (districtBlob.evidenceInputs && typeof districtBlob.evidenceInputs === "object")
    ? districtBlob.evidenceInputs
    : {};
  const precinctResults = Array.isArray(resolvedInputs?.precinctResults)
    ? resolvedInputs.precinctResults
    : Array.isArray(evidenceInputs.precinctResults)
    ? evidenceInputs.precinctResults
    : (Array.isArray(districtBlob.precinctResults) ? districtBlob.precinctResults : []);
  const crosswalkRows = Array.isArray(resolvedInputs?.crosswalkRows)
    ? resolvedInputs.crosswalkRows
    : Array.isArray(evidenceInputs.crosswalkRows)
    ? evidenceInputs.crosswalkRows
    : (Array.isArray(districtBlob.crosswalkRows) ? districtBlob.crosswalkRows : (Array.isArray(districtBlob.precinctToGeo) ? districtBlob.precinctToGeo : []));
  const censusGeoRows = Array.isArray(resolvedInputs?.censusGeoRows)
    ? resolvedInputs.censusGeoRows
    : Array.isArray(evidenceInputs.censusGeoRows)
    ? evidenceInputs.censusGeoRows
    : (Array.isArray(districtBlob.censusGeoRows) ? districtBlob.censusGeoRows : (Array.isArray(districtBlob.censusRows) ? districtBlob.censusRows : []));
  const fallbackDemographicsEvidence = {
    censusTotals: (districtBlob && typeof districtBlob.censusTotals === "object") ? districtBlob.censusTotals : {},
    geoRows: Array.isArray(censusGeoRows)
      ? censusGeoRows.map((row) => ({
        census: (row && typeof row.values === "object") ? row.values : {},
      }))
      : [],
    summary: {},
    persuasionSignal: {},
  };
  const resolverMode = String(resolvedInputs?.sourceMode || "");
  const resolverNotes = Array.isArray(resolvedInputs?.notes)
    ? resolvedInputs.notes.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const inputSummary = (typeof summarizeDistrictEvidenceInputs === "function")
    ? (() => {
      try{
        return summarizeDistrictEvidenceInputs(state);
      } catch {
        return null;
      }
    })()
    : null;
  if (els.intelDistrictEvidenceInputsSummary){
    const fallbackLine = [
      `Input mode: ${resolverMode || "none"}`,
      `Election rows: ${precinctResults.length}`,
      `Crosswalk rows: ${crosswalkRows.length}`,
      `Census rows: ${censusGeoRows.length}`,
    ].join(" · ");
    const line = String(inputSummary?.summaryLine || fallbackLine);
    els.intelDistrictEvidenceInputsSummary.classList.remove("ok", "warn", "muted");
    if (inputSummary && inputSummary.ready){
      els.intelDistrictEvidenceInputsSummary.classList.add("ok");
    } else if ((resolverMode === "inline" || resolverMode === "refs") && (precinctResults.length || crosswalkRows.length || censusGeoRows.length)){
      els.intelDistrictEvidenceInputsSummary.classList.add("warn");
    } else {
      els.intelDistrictEvidenceInputsSummary.classList.add("muted");
    }
    els.intelDistrictEvidenceInputsSummary.textContent = line;
  }

  let registry = null;
  if (typeof buildDataSourceRegistry === "function"){
    try{
      registry = buildDataSourceRegistry(state?.dataCatalog);
    } catch {
      registry = null;
    }
  }

  const geoPack = (state?.geoPack && typeof state.geoPack === "object") ? state.geoPack : {};
  const areaRaw = (geoPack?.area && typeof geoPack.area === "object") ? geoPack.area : {};
  const normalizedArea = typeof normalizeAreaSelection === "function"
    ? normalizeAreaSelection({
      ...areaRaw,
      resolution: geoPack?.resolution,
      boundarySetId: geoPack?.boundarySetId,
      boundaryVintage: geoPack?.area?.boundaryVintage || geoPack?.area?.vintage || geoPack?.source?.vintage || null,
    })
    : {
      type: String(areaRaw?.type || "").toUpperCase(),
      stateFips: String(areaRaw?.stateFips || "").trim(),
      district: String(areaRaw?.district || "").trim(),
      countyFips: String(areaRaw?.countyFips || "").trim(),
      placeFips: String(areaRaw?.placeFips || "").trim(),
      label: String(areaRaw?.label || "").trim(),
      boundarySetId: String(geoPack?.boundarySetId || "").trim() || null,
      boundaryVintage: String(geoPack?.source?.vintage || "").trim() || null,
      resolution: String(geoPack?.resolution || "tract").trim().toLowerCase() === "block_group" ? "block_group" : "tract",
    };
  if (els.intelAreaType){
    const t = String(normalizedArea?.type || "").toUpperCase();
    els.intelAreaType.value = t;
    if (els.intelAreaType.value !== t) els.intelAreaType.value = "";
  }
  if (els.intelAreaResolution){
    const r = String(normalizedArea?.resolution || "tract").toLowerCase() === "block_group" ? "block_group" : "tract";
    els.intelAreaResolution.value = r;
    if (els.intelAreaResolution.value !== r) els.intelAreaResolution.value = "tract";
  }
  if (els.intelAreaLabel) els.intelAreaLabel.value = String(normalizedArea?.label || "");
  if (els.intelAreaStateFips) els.intelAreaStateFips.value = String(normalizedArea?.stateFips || "");
  if (els.intelAreaDistrict) els.intelAreaDistrict.value = String(normalizedArea?.district || "");
  if (els.intelAreaCountyFips) els.intelAreaCountyFips.value = String(normalizedArea?.countyFips || "");
  if (els.intelAreaPlaceFips) els.intelAreaPlaceFips.value = String(normalizedArea?.placeFips || "");

  let areaCtx = null;
  if (typeof deriveAreaResolverContext === "function"){
    try{
      areaCtx = deriveAreaResolverContext({ scenario: state, registry });
    } catch {
      areaCtx = null;
    }
  }
  const areaForDisplay = (areaCtx && areaCtx.area) ? areaCtx.area : normalizedArea;
  let areaCacheKey = String(areaCtx?.cacheKey || "").trim();
  if (!areaCacheKey && typeof buildAreaResolverCacheKey === "function"){
    try{
      areaCacheKey = String(buildAreaResolverCacheKey({ area: areaForDisplay }) || "").trim();
    } catch {
      areaCacheKey = "";
    }
  }
  const areaNotes = Array.isArray(areaCtx?.notes)
    ? areaCtx.notes.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const areaConfigured = !!(
    String(areaForDisplay?.type || "").trim() ||
    String(areaForDisplay?.label || "").trim() ||
    String(areaForDisplay?.stateFips || "").trim() ||
    String(areaForDisplay?.district || "").trim() ||
    String(areaForDisplay?.countyFips || "").trim() ||
    String(areaForDisplay?.placeFips || "").trim()
  );
  if (els.intelAreaResolverSummary){
    if (!areaConfigured){
      els.intelAreaResolverSummary.textContent = "Area resolver: not configured.";
    } else {
      const bits = [
        `Area ${areaIdentityLabel(areaForDisplay)}`,
        `Resolution ${String(areaForDisplay?.resolution || "tract") === "block_group" ? "block_group" : "tract"}`,
      ];
      if (areaForDisplay?.boundarySetId) bits.push(`Boundary ${String(areaForDisplay.boundarySetId)}`);
      if (areaForDisplay?.boundaryVintage) bits.push(`Vintage ${String(areaForDisplay.boundaryVintage)}`);
      if (areaForDisplay?.label) bits.push(`Label ${String(areaForDisplay.label)}`);
      els.intelAreaResolverSummary.textContent = `Area resolver: ${bits.join(" · ")}`;
    }
  }
  if (els.intelAreaResolverDetail){
    const bits = [];
    if (areaCacheKey) bits.push(`Cache key: ${areaCacheKey}`);
    if (areaNotes.length) bits.push(`Note: ${areaNotes[0]}`);
    if (!bits.length) bits.push("Flow: select state, area type, and IDs, then generate assumptions.");
    els.intelAreaResolverDetail.textContent = bits.length
      ? bits.join(" · ")
      : "Set area + resolution to generate a deterministic cache key.";
  }
  if (els.intelAreaCodeLinks){
    els.intelAreaCodeLinks.innerHTML = buildAreaCodeLinksHtml(areaForDisplay);
  }
  const districtStateForAssist = (state?.geoPack && typeof state.geoPack === "object" && state.geoPack.district && typeof state.geoPack.district === "object")
    ? state.geoPack.district
    : null;
  const assistModel = buildAreaAssistModel(censusGeoRows, areaForDisplay);
  fillAreaAssistStateSelect(els.intelAreaAssistState, assistModel.states, areaForDisplay);
  fillAreaAssistCountySelect(els.intelAreaAssistCounty, assistModel.counties, areaForDisplay);
  fillAreaAssistPlaceSelect(els.intelAreaAssistPlace, assistModel.places, areaForDisplay);
  fillAreaAssistGeoSelect(els.intelAreaAssistGeo, assistModel.geos, districtStateForAssist?.selectedGeoId, areaForDisplay);
  if (els.intelAreaAssistStatus){
    const bits = [];
    if (assistModel.state) bits.push(`State ${assistModel.state}`);
    if (!assistModel.state) bits.push("Set state to enable county/place/GEO assists");
    if (assistModel.countyFilter) bits.push(`County ${assistModel.countyFilter}`);
    if (assistModel.placeFilter) bits.push(`Place ${assistModel.placeFilter}`);
    bits.push(`${fmtInt(assistModel.states.length)} state options`);
    bits.push(`${fmtInt(assistModel.counties.length)} county options`);
    bits.push(`${fmtInt(assistModel.places.length)} place options`);
    bits.push(`${fmtInt(assistModel.geos.length)} GEO options`);
    els.intelAreaAssistStatus.textContent = bits.join(" · ");
  }

  const flowAreaReady = areaReadyForFlow(areaForDisplay);
  const flowDataReady = precinctResults.length > 0 && crosswalkRows.length > 0 && censusGeoRows.length > 0;
  const setFlowStepStatus = (compiledReady) => {
    if (!els.intelFlowStepStatus) return;
    els.intelFlowStepStatus.classList.remove("ok", "warn", "bad", "muted");
    if (!flowAreaReady){
      els.intelFlowStepStatus.classList.add("warn");
      els.intelFlowStepStatus.textContent = "Flow: Step 1 select area (state + type + ID) before loading data.";
      return;
    }
    if (!flowDataReady){
      els.intelFlowStepStatus.classList.add("warn");
      els.intelFlowStepStatus.textContent = "Flow: Step 2 load data (election rows + crosswalk rows + census rows).";
      return;
    }
    if (!compiledReady){
      els.intelFlowStepStatus.classList.add("warn");
      els.intelFlowStepStatus.textContent = "Flow: Step 3 compile evidence (fix warnings if compile is incomplete).";
      return;
    }
    if (!packReady){
      els.intelFlowStepStatus.classList.add("warn");
      els.intelFlowStepStatus.textContent = "Flow: Step 4 click Generate district-intel assumptions.";
      return;
    }
    if (!useDistrictIntel){
      els.intelFlowStepStatus.classList.add("ok");
      els.intelFlowStepStatus.textContent = "Flow: Step 5 toggle Use district-intel assumptions ON to apply.";
      return;
    }
    els.intelFlowStepStatus.classList.add("ok");
    els.intelFlowStepStatus.textContent = "Flow: Active. Area, data, evidence, and district-intel assumptions are applied.";
  };

  const refsIn = (state?.dataRefs && typeof state.dataRefs === "object") ? state.dataRefs : {};
  const dataRefMode = String(refsIn.mode || "pinned_verified").trim() || "pinned_verified";
  const boundaryId = String(refsIn.boundarySetId || "").trim();
  const censusId = String(refsIn.censusDatasetId || "").trim();
  const electionId = String(refsIn.electionDatasetId || "").trim();
  const crosswalkId = String(refsIn.crosswalkVersionId || "").trim();
  const strictSimilarity = !!refsIn.electionStrictSimilarity;
  const maxYearDelta = toFinite(refsIn.electionMaxYearDelta);
  const minCoveragePct = toFinite(refsIn.electionMinCoveragePct);

  if (els.intelDataRefMode){
    els.intelDataRefMode.value = dataRefMode;
    if (els.intelDataRefMode.value !== dataRefMode) els.intelDataRefMode.value = "pinned_verified";
  }
  if (els.intelDataRefStrictSimilarity){
    els.intelDataRefStrictSimilarity.checked = strictSimilarity;
  }
  if (els.intelDataRefMaxYearDelta){
    els.intelDataRefMaxYearDelta.value = Number.isFinite(maxYearDelta)
      ? String(Math.max(0, Math.round(maxYearDelta)))
      : "";
  }
  if (els.intelDataRefMinCoveragePct){
    els.intelDataRefMinCoveragePct.value = Number.isFinite(minCoveragePct)
      ? String(minCoveragePct)
      : "";
  }
  fillDataRefSelect(
    els.intelDataRefBoundarySet,
    registry?.boundarySets || [],
    boundaryId,
    (row) => dataRefItemLabel(row, "boundary")
  );
  fillDataRefSelect(
    els.intelDataRefCrosswalkVersion,
    registry?.crosswalks || [],
    crosswalkId,
    (row) => dataRefItemLabel(row, "crosswalk")
  );
  fillDataRefSelect(
    els.intelDataRefCensusDataset,
    registry?.censusDatasets || [],
    censusId,
    (row) => dataRefItemLabel(row, "census")
  );
  fillDataRefSelect(
    els.intelDataRefElectionDataset,
    registry?.electionDatasets || [],
    electionId,
    (row) => dataRefItemLabel(row, "election")
  );

  let policyResolution = null;
  if (typeof resolveDataRefsByPolicy === "function"){
    try{
      policyResolution = resolveDataRefsByPolicy({
        dataRefs: state?.dataRefs,
        dataCatalog: state?.dataCatalog,
        scenario: state,
      });
    } catch {
      policyResolution = null;
    }
  }
  const sourceParts = [];
  if (dataRefMode) sourceParts.push(`Mode: ${dataRefMode}`);
  if (censusId) sourceParts.push(`Census: ${censusId}`);
  if (electionId) sourceParts.push(`Election: ${electionId}`);
  if (crosswalkId) sourceParts.push(`Crosswalk: ${crosswalkId}`);
  if (resolverMode) sourceParts.push(`Input mode: ${resolverMode}`);
  if (strictSimilarity) sourceParts.push("Strict: office+race");
  if (Number.isFinite(maxYearDelta)) sourceParts.push(`Year gap<=${Math.max(0, Math.round(maxYearDelta))}`);
  if (Number.isFinite(minCoveragePct)) sourceParts.push(`Coverage>=${Math.max(0, Math.min(100, minCoveragePct)).toFixed(1)}%`);
  if (els.intelDistrictEvidenceSource){
    els.intelDistrictEvidenceSource.textContent = sourceParts.length
      ? sourceParts.join(" · ")
      : "No pinned datasets selected yet.";
  }

  const resolutionNotes = Array.isArray(policyResolution?.notes)
    ? policyResolution.notes.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const selectedByPolicy = policyResolution?.selected || {};
  const effectiveIds = {
    boundarySetId: String(selectedByPolicy.boundarySetId || boundaryId || "").trim(),
    crosswalkVersionId: String(selectedByPolicy.crosswalkVersionId || crosswalkId || "").trim(),
    censusDatasetId: String(selectedByPolicy.censusDatasetId || censusId || "").trim(),
    electionDatasetId: String(selectedByPolicy.electionDatasetId || electionId || "").trim(),
  };
  const censusChoicesCount = Array.isArray(registry?.censusDatasets) ? registry.censusDatasets.length : 0;
  const electionChoicesCount = Array.isArray(registry?.electionDatasets) ? registry.electionDatasets.length : 0;
  if (els.intelDataRefStatus){
    if (policyResolution?.usedFallbacks && resolutionNotes.length){
      renderDataRefStatus(
        els.intelDataRefStatus,
        `Policy fallback active: ${resolutionNotes[0]}`,
        "warn"
      );
    } else if (resolutionNotes.length){
      renderDataRefStatus(els.intelDataRefStatus, resolutionNotes[0], "warn");
    } else if (!censusChoicesCount && !effectiveIds.censusDatasetId){
      renderDataRefStatus(
        els.intelDataRefStatus,
        "No census datasets loaded yet. Import a census manifest.",
        "muted"
      );
    } else if (!electionChoicesCount && !effectiveIds.electionDatasetId){
      renderDataRefStatus(
        els.intelDataRefStatus,
        "No election datasets loaded yet. Import an election manifest/results or run auto-pull.",
        "muted"
      );
    } else if (
      !effectiveIds.boundarySetId &&
      !effectiveIds.crosswalkVersionId &&
      !effectiveIds.censusDatasetId &&
      !effectiveIds.electionDatasetId
    ){
      renderDataRefStatus(els.intelDataRefStatus, "Data refs not configured yet.", "muted");
    } else {
      renderDataRefStatus(els.intelDataRefStatus, "Data refs ready.", "ok");
    }
  }
  if (els.intelDataRefAlignmentSummary || els.intelDataRefAlignmentDetail){
    let diag = null;
    if (typeof diagnoseDataRefAlignment === "function"){
      try{
        diag = diagnoseDataRefAlignment({
          dataRefs: state?.dataRefs,
          dataCatalog: state?.dataCatalog,
          scenario: state,
        });
      } catch {
        diag = null;
      }
    }
    const statusKind = String(diag?.status || "").trim();
    const summary = String(diag?.summary || "").trim();
    const warnings = Array.isArray(diag?.warnings) ? diag.warnings.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const details = diag && typeof diag === "object" ? diag.details || {} : {};
    const selectionFingerprint = String(details?.selectionFingerprint || "").trim();
    const usedFallbacks = !!details?.usedFallbacks;
    const resolutionNotes = Array.isArray(details?.resolutionNotes)
      ? details.resolutionNotes.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const coverageBits = [
      Number.isFinite(Number(details?.crosswalkCoveragePct)) ? `XW ${Number(details.crosswalkCoveragePct).toFixed(1)}%` : null,
      Number.isFinite(Number(details?.censusCoveragePct)) ? `Census ${Number(details.censusCoveragePct).toFixed(1)}%` : null,
      Number.isFinite(Number(details?.electionCoveragePct)) ? `Election ${Number(details.electionCoveragePct).toFixed(1)}%` : null,
    ].filter(Boolean);
    const selectedMeta = (details && typeof details.selectedMeta === "object") ? details.selectedMeta : {};
    const freshnessBits = [
      ["Boundary", selectedMeta?.boundary],
      ["Crosswalk", selectedMeta?.crosswalk],
      ["Census", selectedMeta?.census],
      ["Election", selectedMeta?.election],
    ].map(([label, meta]) => {
      const ageDays = Number(meta?.ageDays);
      if (!Number.isFinite(ageDays)) return null;
      return `${label} ${Math.max(0, Math.round(ageDays))}d`;
    }).filter(Boolean);
    const yearGap = Number(details?.electionYearGap);
    if (els.intelDataRefAlignmentSummary){
      els.intelDataRefAlignmentSummary.classList.remove("ok", "warn", "bad", "muted");
      if (statusKind === "bad"){
        els.intelDataRefAlignmentSummary.classList.add("bad");
      } else if (statusKind === "warn"){
        els.intelDataRefAlignmentSummary.classList.add("warn");
      } else if (statusKind === "ok"){
        els.intelDataRefAlignmentSummary.classList.add("ok");
      } else {
        els.intelDataRefAlignmentSummary.classList.add("muted");
      }
      els.intelDataRefAlignmentSummary.textContent = summary || "Alignment: not evaluated yet.";
    }
    if (els.intelDataRefAlignmentDetail){
      const bits = [];
      if (coverageBits.length) bits.push(coverageBits.join(" · "));
      if (Number.isFinite(yearGap)) bits.push(`Year gap ${Math.max(0, Math.round(yearGap))}`);
      if (freshnessBits.length) bits.push(freshnessBits.join(" · "));
      if (warnings.length) bits.push(`Note: ${warnings[0]}`);
      if (!warnings.length && resolutionNotes.length) bits.push(`Resolver: ${resolutionNotes[0]}`);
      if (usedFallbacks) bits.push("Fallbacks used");
      els.intelDataRefAlignmentDetail.textContent = bits.length
        ? bits.join(" · ")
        : "Coverage/year-gap checks will appear after refs resolve.";
    }
    if (els.intelDataRefFingerprint){
      els.intelDataRefFingerprint.textContent = selectionFingerprint
        ? `Selection fingerprint: ${selectionFingerprint}`
        : "Selection fingerprint: —";
    }
  }

  const selectedElectionId = String(
    effectiveIds.electionDatasetId ||
    ""
  ).trim();
  const selectedBoundaryId = String(
    effectiveIds.boundarySetId ||
    ""
  ).trim();
  let rankedElectionDatasets = [];
  if (typeof rankElectionDatasetsForScenario === "function"){
    try{
      rankedElectionDatasets = rankElectionDatasetsForScenario({
        registry,
        dataCatalog: state?.dataCatalog,
        scenario: state,
        boundarySetId: selectedBoundaryId,
        requireVerified: true,
        filters: {
          strictSimilarity,
          maxYearDelta: Number.isFinite(maxYearDelta) ? Math.max(0, Math.round(maxYearDelta)) : null,
          minCoveragePct: Number.isFinite(minCoveragePct) ? Math.max(0, Math.min(100, minCoveragePct)) : null,
        },
      });
    } catch {
      rankedElectionDatasets = [];
    }
  }
  fillDistrictEvidenceDatasetRankTable(
    els.intelDistrictEvidenceDatasetRankTbody,
    Array.isArray(rankedElectionDatasets) ? rankedElectionDatasets : [],
    selectedElectionId
  );
  if (els.btnIntelDataRefSelectTopElection){
    els.btnIntelDataRefSelectTopElection.disabled =
      !flowAreaReady ||
      !Array.isArray(rankedElectionDatasets) ||
      rankedElectionDatasets.length === 0;
  }
  if (els.btnIntelDataRefsPin){
    els.btnIntelDataRefsPin.disabled =
      !flowAreaReady ||
      typeof engine?.snapshot?.materializePinnedDataRefs !== "function";
  }
  if (els.intelDataRefMode) els.intelDataRefMode.disabled = !flowAreaReady;
  if (els.intelDataRefBoundarySet) els.intelDataRefBoundarySet.disabled = !flowAreaReady;
  if (els.intelDataRefCrosswalkVersion) els.intelDataRefCrosswalkVersion.disabled = !flowAreaReady;
  if (els.intelDataRefCensusDataset) els.intelDataRefCensusDataset.disabled = !flowAreaReady;
  if (els.intelDataRefElectionDataset) els.intelDataRefElectionDataset.disabled = !flowAreaReady;
  if (els.intelDataRefStrictSimilarity) els.intelDataRefStrictSimilarity.disabled = !flowAreaReady;
  if (els.intelDataRefMaxYearDelta) els.intelDataRefMaxYearDelta.disabled = !flowAreaReady;
  if (els.intelDataRefMinCoveragePct) els.intelDataRefMinCoveragePct.disabled = !flowAreaReady;
  if (els.btnIntelImportCensusManifest){
    els.btnIntelImportCensusManifest.disabled = !(
      flowAreaReady &&
      typeof normalizeCensusManifest === "function" &&
      typeof validateCensusManifest === "function" &&
      typeof censusManifestToCatalogEntry === "function"
    );
  }
  if (els.btnIntelImportElectionManifest){
    els.btnIntelImportElectionManifest.disabled = !(
      flowAreaReady &&
      typeof normalizeElectionManifest === "function" &&
      typeof validateElectionManifest === "function" &&
      typeof electionManifestToCatalogEntry === "function"
    );
  }
  if (els.btnIntelImportCrosswalkRows) els.btnIntelImportCrosswalkRows.disabled = !flowAreaReady;
  if (els.btnIntelImportPrecinctResults) els.btnIntelImportPrecinctResults.disabled = !flowAreaReady;
  if (els.btnIntelImportCensusGeoRows) els.btnIntelImportCensusGeoRows.disabled = !flowAreaReady;
  if (els.intelPrecinctResultsFormat) els.intelPrecinctResultsFormat.disabled = !flowAreaReady;
  if (els.intelDataCatalogUrl) els.intelDataCatalogUrl.disabled = !flowAreaReady;
  if (els.intelCensusManifestUrl) els.intelCensusManifestUrl.disabled = !flowAreaReady;
  if (els.intelElectionManifestUrl) els.intelElectionManifestUrl.disabled = !flowAreaReady;
  if (els.intelCrosswalkRowsUrl) els.intelCrosswalkRowsUrl.disabled = !flowAreaReady;
  if (els.intelPrecinctResultsUrl) els.intelPrecinctResultsUrl.disabled = !flowAreaReady;
  if (els.intelCensusGeoRowsUrl) els.intelCensusGeoRowsUrl.disabled = !flowAreaReady;
  if (els.intelCensusManifestJson) els.intelCensusManifestJson.disabled = !flowAreaReady;
  if (els.intelElectionManifestJson) els.intelElectionManifestJson.disabled = !flowAreaReady;
  if (els.intelCrosswalkRowsJson) els.intelCrosswalkRowsJson.disabled = !flowAreaReady;
  if (els.intelPrecinctResultsJson) els.intelPrecinctResultsJson.disabled = !flowAreaReady;
  if (els.intelCensusGeoRowsJson) els.intelCensusGeoRowsJson.disabled = !flowAreaReady;
  if (els.btnIntelAutoPullAll){
    const hasFetch = typeof globalThis.fetch === "function";
    els.btnIntelAutoPullAll.disabled = !flowAreaReady || !hasFetch;
  }
  if (els.btnIntelFetchDataCatalog){
    const hasFetch = typeof globalThis.fetch === "function";
    const canNormalize = typeof engine?.snapshot?.normalizeDataCatalog === "function";
    els.btnIntelFetchDataCatalog.disabled = !(flowAreaReady && hasFetch && canNormalize);
  }
  if (els.btnIntelCatalogAutoPull){
    const hasFetch = typeof globalThis.fetch === "function";
    const canNormalize = typeof engine?.snapshot?.normalizeDataCatalog === "function";
    const canPlan = typeof engine?.snapshot?.buildAutoPullUrlPlan === "function";
    els.btnIntelCatalogAutoPull.disabled = !(flowAreaReady && hasFetch && canNormalize && canPlan);
  }
  if (els.btnIntelAutoFillUrls){
    els.btnIntelAutoFillUrls.disabled =
      !flowAreaReady ||
      typeof engine?.snapshot?.buildAutoPullUrlPlan !== "function";
  }
  if (els.btnIntelGenerateDistrictIntel){
    els.btnIntelGenerateDistrictIntel.disabled = !(
      flowAreaReady &&
      flowDataReady &&
      typeof engine?.snapshot?.buildDistrictIntelPackFromEvidence === "function" &&
      typeof engine?.snapshot?.compileDistrictEvidence === "function"
    );
  }
  /** @type {any} */
  let autoPullPlanForRender = null;
  /** @type {any} */
  let autoPullMergedForRender = null;
  if (els.intelAutoPullPlanSummary){
    const buildAutoPullUrlPlan = engine?.snapshot?.buildAutoPullUrlPlan;
    const evaluateAutoPullPlan = engine?.snapshot?.evaluateAutoPullPlan;
    const resolveAutoPullUrls = engine?.snapshot?.resolveAutoPullUrls;
    const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;
    const savedCatalogUrl = String(state?.geoPack?.district?.autoPullCatalogUrl || "").trim();
    if (els.intelDataCatalogUrl && !String(els.intelDataCatalogUrl.value || "").trim() && savedCatalogUrl){
      els.intelDataCatalogUrl.value = savedCatalogUrl;
    }
    const manualUrls = {
      censusManifestUrl: String(els.intelCensusManifestUrl?.value || "").trim() || null,
      electionManifestUrl: String(els.intelElectionManifestUrl?.value || "").trim() || null,
      crosswalkRowsUrl: String(els.intelCrosswalkRowsUrl?.value || "").trim() || null,
      precinctResultsUrl: String(els.intelPrecinctResultsUrl?.value || "").trim() || null,
      censusGeoRowsUrl: String(els.intelCensusGeoRowsUrl?.value || "").trim() || null,
    };
    const manualAny = Object.values(manualUrls).some(Boolean);
    els.intelAutoPullPlanSummary.classList.remove("ok", "warn", "bad", "muted");
    if (
      typeof buildAutoPullUrlPlan === "function" &&
      typeof evaluateAutoPullPlan === "function" &&
      typeof resolveAutoPullUrls === "function"
    ){
      const plan = buildAutoPullUrlPlan({
        dataRefs: state?.dataRefs,
        dataCatalog: state?.dataCatalog,
        scenario: state,
        resolveDataRefsByPolicy,
      });
      autoPullPlanForRender = plan;
      const merged = resolveAutoPullUrls({ plan, overrides: manualUrls });
      autoPullMergedForRender = merged;
      const evalPlan = evaluateAutoPullPlan({ mode: plan?.mode, urls: merged?.urls });
      els.intelAutoPullPlanSummary.textContent = String(evalPlan?.summaryLine || "Auto-pull plan: unavailable.");
      if (evalPlan?.status === "ok"){
        els.intelAutoPullPlanSummary.classList.add("ok");
      } else if (evalPlan?.status === "warn"){
        els.intelAutoPullPlanSummary.classList.add("warn");
      } else if (evalPlan?.status === "bad"){
        els.intelAutoPullPlanSummary.classList.add("bad");
      } else {
        els.intelAutoPullPlanSummary.classList.add("muted");
      }
      if (els.btnIntelAutoPullAll){
        const hasFetch = typeof globalThis.fetch === "function";
        els.btnIntelAutoPullAll.disabled = !hasFetch || (!evalPlan?.ready && !manualAny);
      }
    } else {
      els.intelAutoPullPlanSummary.classList.add("muted");
      els.intelAutoPullPlanSummary.textContent = "Auto-pull plan unavailable (missing snapshot helpers).";
    }
  }
  if (els.intelAutoPullReceiptSummary){
    const summarizeAutoPullReceipt = engine?.snapshot?.summarizeAutoPullReceipt;
    const receipt = state?.geoPack?.district?.autoPullReceipt;
    els.intelAutoPullReceiptSummary.classList.remove("ok", "warn", "bad", "muted");
    if (typeof summarizeAutoPullReceipt === "function"){
      els.intelAutoPullReceiptSummary.textContent = summarizeAutoPullReceipt(receipt);
      const status = String(receipt?.status || "").trim().toLowerCase();
      if (status === "ok"){
        els.intelAutoPullReceiptSummary.classList.add("ok");
      } else if (status === "warn"){
        els.intelAutoPullReceiptSummary.classList.add("warn");
      } else if (status === "bad"){
        els.intelAutoPullReceiptSummary.classList.add("bad");
      } else {
        els.intelAutoPullReceiptSummary.classList.add("muted");
      }
    } else {
      els.intelAutoPullReceiptSummary.classList.add("muted");
      els.intelAutoPullReceiptSummary.textContent = "Auto-pull run: unavailable (missing summary helper).";
    }
  }
  if (els.intelAutoPullReceiptAlignment){
    const assessAutoPullReceiptAlignment = engine?.snapshot?.assessAutoPullReceiptAlignment;
    const receipt = state?.geoPack?.district?.autoPullReceipt;
    els.intelAutoPullReceiptAlignment.classList.remove("ok", "warn", "bad", "muted");
    if (
      typeof assessAutoPullReceiptAlignment === "function" &&
      autoPullPlanForRender &&
      autoPullMergedForRender
    ){
      const alignment = assessAutoPullReceiptAlignment({
        receipt,
        mode: autoPullMergedForRender?.mode || autoPullPlanForRender?.mode,
        selected: autoPullPlanForRender?.selected,
        urls: autoPullMergedForRender?.urls,
      });
      els.intelAutoPullReceiptAlignment.textContent = String(alignment?.summaryLine || "Auto-pull receipt alignment: unavailable.");
      const status = String(alignment?.status || "muted");
      if (status === "ok"){
        els.intelAutoPullReceiptAlignment.classList.add("ok");
      } else if (status === "warn"){
        els.intelAutoPullReceiptAlignment.classList.add("warn");
      } else if (status === "bad"){
        els.intelAutoPullReceiptAlignment.classList.add("bad");
      } else {
        els.intelAutoPullReceiptAlignment.classList.add("muted");
      }
    } else {
      els.intelAutoPullReceiptAlignment.classList.add("muted");
      els.intelAutoPullReceiptAlignment.textContent = "Auto-pull receipt alignment: unavailable (missing helpers).";
    }
  }
  if (els.intelAutoPullRunNeed){
    const evaluateAutoPullRunNeed = engine?.snapshot?.evaluateAutoPullRunNeed;
    const receipt = state?.geoPack?.district?.autoPullReceipt;
    els.intelAutoPullRunNeed.classList.remove("ok", "warn", "bad", "muted");
    if (
      typeof evaluateAutoPullRunNeed === "function" &&
      autoPullPlanForRender &&
      autoPullMergedForRender
    ){
      const runNeed = evaluateAutoPullRunNeed({
        receipt,
        mode: autoPullMergedForRender?.mode || autoPullPlanForRender?.mode,
        selected: autoPullPlanForRender?.selected,
        urls: autoPullMergedForRender?.urls,
      });
      els.intelAutoPullRunNeed.textContent = String(runNeed?.summaryLine || "Auto-pull run need: unavailable.");
      const status = String(runNeed?.status || "muted");
      if (status === "ok"){
        els.intelAutoPullRunNeed.classList.add("ok");
      } else if (status === "warn"){
        els.intelAutoPullRunNeed.classList.add("warn");
      } else if (status === "bad"){
        els.intelAutoPullRunNeed.classList.add("bad");
      } else {
        els.intelAutoPullRunNeed.classList.add("muted");
      }
    } else {
      els.intelAutoPullRunNeed.classList.add("muted");
      els.intelAutoPullRunNeed.textContent = "Auto-pull run need: unavailable (missing helpers).";
    }
  }
  if (els.intelDistrictEvidenceSelectedElection){
    const topId = String(rankedElectionDatasets?.[0]?.dataset?.id || "").trim();
    const rankIndex = Array.isArray(rankedElectionDatasets)
      ? rankedElectionDatasets.findIndex((x) => String(x?.dataset?.id || "") === selectedElectionId)
      : -1;
    if (!selectedElectionId){
      els.intelDistrictEvidenceSelectedElection.textContent = "Election dataset: none selected";
    } else if (rankIndex === 0){
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId} (top compatible)`;
    } else if (rankIndex > 0){
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId} (rank #${rankIndex + 1}; top is ${topId || "—"})`;
    } else if (topId){
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId} (not in compatible set; top is ${topId})`;
    } else {
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId}`;
    }
  }

  if (typeof compileDistrictEvidence !== "function"){
    if (els.intelDistrictEvidenceStatus){
      els.intelDistrictEvidenceStatus.classList.remove("ok", "warn", "bad");
      els.intelDistrictEvidenceStatus.classList.add("warn");
      els.intelDistrictEvidenceStatus.textContent = "District evidence compiler unavailable in engine snapshot.";
    }
    if (els.intelDistrictEvidenceCoverage) els.intelDistrictEvidenceCoverage.textContent = "Coverage: —";
    if (els.intelDistrictEvidenceVotes) els.intelDistrictEvidenceVotes.textContent = "Votes: —";
    if (els.intelDistrictEvidenceSignal) els.intelDistrictEvidenceSignal.textContent = "Persuasion signal: —";
    fillDistrictEvidenceCandidateTable(els.intelDistrictEvidenceCandidateTbody, []);
    fillDistrictEvidencePrecinctTable(els.intelDistrictEvidencePrecinctTbody, []);
    fillDistrictEvidenceLinkTable(els.intelDistrictEvidenceLinkTbody, []);
    fillDistrictEvidenceGeoTable(els.intelDistrictEvidenceGeoTbody, []);
    fillDistrictEvidenceOpportunityTable(els.intelDistrictEvidenceOpportunityTbody, []);
    fillDistrictDemographicsTable(els.intelDistrictDemographicsTbody, fallbackDemographicsEvidence);
    renderGeoInspector(els, [], "");
    renderDistrictEvidenceMap(
      els.intelDistrictEvidenceMapSvg,
      els.intelDistrictEvidenceMapStatus,
      { available: false, reason: "Map unavailable: district evidence compiler unavailable.", bounds: null, points: [] },
      {
        yourCandidateId: state?.yourCandidateId,
        area: areaForDisplay,
        areaBoundary: districtBlob?.areaBoundary || state?.geoPack?.areaBoundary || null,
        selectedGeoId: "",
      }
    );
    setFlowStepStatus(false);
    fillDistrictEvidenceDatasetRankTable(els.intelDistrictEvidenceDatasetRankTbody, rankedElectionDatasets, selectedElectionId);
    return;
  }

  let evidence = null;
  try{
    evidence = compileDistrictEvidence({
      geoUnits: state?.geoPack?.units || [],
      precinctResults,
      crosswalkRows,
      censusGeoRows,
    });
  } catch (err){
    if (els.intelDistrictEvidenceStatus){
      const msg = String(err?.message || "compile failed");
      els.intelDistrictEvidenceStatus.classList.remove("ok", "warn", "bad");
      els.intelDistrictEvidenceStatus.classList.add("bad");
      els.intelDistrictEvidenceStatus.textContent = `District evidence compile failed: ${msg}`;
    }
    if (els.intelDistrictEvidenceCoverage) els.intelDistrictEvidenceCoverage.textContent = "Coverage: —";
    if (els.intelDistrictEvidenceVotes) els.intelDistrictEvidenceVotes.textContent = "Votes: —";
    if (els.intelDistrictEvidenceSignal) els.intelDistrictEvidenceSignal.textContent = "Persuasion signal: —";
    fillDistrictEvidenceCandidateTable(els.intelDistrictEvidenceCandidateTbody, []);
    fillDistrictEvidencePrecinctTable(els.intelDistrictEvidencePrecinctTbody, []);
    fillDistrictEvidenceLinkTable(els.intelDistrictEvidenceLinkTbody, []);
    fillDistrictEvidenceGeoTable(els.intelDistrictEvidenceGeoTbody, []);
    fillDistrictEvidenceOpportunityTable(els.intelDistrictEvidenceOpportunityTbody, []);
    fillDistrictDemographicsTable(els.intelDistrictDemographicsTbody, fallbackDemographicsEvidence);
    renderGeoInspector(els, [], "");
    renderDistrictEvidenceMap(
      els.intelDistrictEvidenceMapSvg,
      els.intelDistrictEvidenceMapStatus,
      { available: false, reason: "Map unavailable: district evidence compile failed.", bounds: null, points: [] },
      {
        yourCandidateId: state?.yourCandidateId,
        area: areaForDisplay,
        areaBoundary: districtBlob?.areaBoundary || state?.geoPack?.areaBoundary || null,
        selectedGeoId: "",
      }
    );
    setFlowStepStatus(false);
    fillDistrictEvidenceDatasetRankTable(els.intelDistrictEvidenceDatasetRankTbody, rankedElectionDatasets, selectedElectionId);
    return;
  }

  const candidateTotals = Array.isArray(evidence?.candidateTotals) ? evidence.candidateTotals : [];
  const links = Array.isArray(evidence?.precinctToGeo) ? evidence.precinctToGeo : [];
  const geoRows = Array.isArray(evidence?.geoRows) ? evidence.geoRows : [];
  let precinctLayers = [];
  if (typeof summarizePrecinctEvidenceLayers === "function"){
    try{
      precinctLayers = summarizePrecinctEvidenceLayers({
        precinctResults,
        crosswalkRows,
        geoUnits: state?.geoPack?.units || [],
        maxRows: 30,
      });
    } catch {
      precinctLayers = [];
    }
  }
  let geoLayers = [];
  if (typeof summarizeGeoEvidenceLayers === "function"){
    try{
      geoLayers = summarizeGeoEvidenceLayers({ geoRows, maxRows: 20 });
    } catch {
      geoLayers = summarizeEvidenceGeoRows(geoRows, 20);
    }
  } else {
    geoLayers = summarizeEvidenceGeoRows(geoRows, 20);
  }
  let opportunityLayers = [];
  if (typeof summarizeGeoOpportunityLayers === "function"){
    try{
      opportunityLayers = summarizeGeoOpportunityLayers({ geoRows, maxRows: 20 });
    } catch {
      opportunityLayers = [];
    }
  }
  let geoMapLayer = {
    available: false,
    reason: "Map unavailable: no centroid coordinates found in census GEO rows.",
    bounds: null,
    points: [],
  };
  if (typeof buildGeoEvidenceMapLayer === "function"){
    try{
      geoMapLayer = buildGeoEvidenceMapLayer({ geoRows, maxPoints: 500 });
    } catch {
      geoMapLayer = {
        available: false,
        reason: "Map unavailable: failed to build centroid layer.",
        bounds: null,
        points: [],
      };
    }
    if (
      (!geoMapLayer || !geoMapLayer.available || !Array.isArray(geoMapLayer.points) || geoMapLayer.points.length === 0)
      && Array.isArray(censusGeoRows)
      && censusGeoRows.length > 0
    ){
      try{
        const censusOnlyRows = censusGeoRows.map((row) => ({
          geoid: String(row?.geoid || ""),
          totalVotes: 0,
          candidateVotes: {},
          sourcePrecincts: 0,
          hasElection: false,
          hasCensus: true,
          census: row?.values && typeof row.values === "object" ? row.values : {},
        }));
        const fallbackLayer = buildGeoEvidenceMapLayer({ geoRows: censusOnlyRows, maxPoints: 500 });
        if (fallbackLayer?.available && Array.isArray(fallbackLayer.points) && fallbackLayer.points.length > 0){
          geoMapLayer = fallbackLayer;
        }
      } catch {}
    }
  }
  const coveragePct = Number(evidence?.reconciliation?.coveragePct);
  const unmatchedVotes = Number(evidence?.reconciliation?.unmatchedVotes);
  const totalVotes = Number(evidence?.summary?.totalVotes);
  const signal = Number(evidence?.persuasionSignal?.index);
  const signalNote = String(evidence?.persuasionSignal?.note || "").trim();
  const warnings = Array.isArray(evidence?.warnings) ? evidence.warnings : [];
  const mergedNotes = resolverNotes.concat(
    warnings.map((x) => String(x || "").trim()).filter(Boolean)
  );
  let assumptionPackForDisplay = districtIntelPack;
  let assumptionSourceKind = "pack";
  if (!districtIntelPack?.ready && typeof buildDistrictIntelPackFromEvidence === "function"){
    try{
      const preview = buildDistrictIntelPackFromEvidence({
        scenario: state,
        evidence,
        refs: effectiveIds,
        nowIso: String(districtIntelPack?.generatedAt || "1970-01-01T00:00:00.000Z"),
      });
      if (preview?.pack && typeof preview.pack === "object"){
        assumptionPackForDisplay = preview.pack;
        assumptionSourceKind = "preview";
      }
    } catch {}
  }
  fillDistrictAssumptionTable(
    els.intelDistrictAssumptionTbody,
    assumptionPackForDisplay,
    useDistrictIntel,
    assumptionSourceKind
  );
  if (!packReady && assumptionSourceKind === "preview"){
    const p = assumptionPackForDisplay;
    const bits = [
      Number.isFinite(Number(p?.indices?.fieldSpeed)) ? `Field speed ${Number(p.indices.fieldSpeed).toFixed(2)}` : null,
      Number.isFinite(Number(p?.indices?.persuasionEnv)) ? `Persuasion ${Number(p.indices.persuasionEnv).toFixed(2)}` : null,
      Number.isFinite(Number(p?.indices?.turnoutElasticity)) ? `Turnout elasticity ${Number(p.indices.turnoutElasticity).toFixed(2)}` : null,
      Number.isFinite(Number(p?.indices?.fieldDifficulty)) ? `Difficulty ${Number(p.indices.fieldDifficulty).toFixed(2)}` : null,
    ].filter(Boolean);
    if (els.intelDistrictIntelSummary){
      els.intelDistrictIntelSummary.textContent = bits.length
        ? `Preview: ${bits.join(" · ")}. Click Generate assumptions to persist.`
        : "Preview available from current district evidence. Click Generate assumptions to persist.";
    }
    if (els.intelDistrictIntelStatus){
      els.intelDistrictIntelStatus.classList.remove("ok", "warn", "bad", "muted");
      els.intelDistrictIntelStatus.classList.add("muted");
      els.intelDistrictIntelStatus.textContent = "District-intel assumptions previewed from current evidence. Generate assumptions to enable toggle.";
    }
  }

  if (els.intelDistrictEvidenceStatus){
    els.intelDistrictEvidenceStatus.classList.remove("ok", "warn", "bad", "muted");
    if (!precinctResults.length || !crosswalkRows.length || !censusGeoRows.length){
      els.intelDistrictEvidenceStatus.classList.add("warn");
      const note = mergedNotes[0] || "Load precinct results, crosswalk rows, and census geo rows into geoPack.district.evidenceInputs or geoPack.district.evidenceStore to activate full district evidence.";
      els.intelDistrictEvidenceStatus.textContent = note;
    } else if (mergedNotes.length){
      els.intelDistrictEvidenceStatus.classList.add("warn");
      els.intelDistrictEvidenceStatus.textContent = `Evidence compiled with warnings: ${mergedNotes[0]}`;
    } else {
      els.intelDistrictEvidenceStatus.classList.add("ok");
      els.intelDistrictEvidenceStatus.textContent =
        `Evidence ready: ${candidateTotals.length} candidates, ${links.length} precinct links, ${Number(evidence?.summary?.geoRowsCount || 0)} geo rows.`;
    }
  }
  if (els.intelDistrictEvidenceCoverage){
    els.intelDistrictEvidenceCoverage.textContent = Number.isFinite(coveragePct)
      ? `Coverage: ${fmtPct(coveragePct, 2)} · Unmatched votes: ${fmtInt(unmatchedVotes)}`
      : "Coverage: —";
  }
  if (els.intelDistrictEvidenceVotes){
    els.intelDistrictEvidenceVotes.textContent = Number.isFinite(totalVotes)
      ? `Weighted total votes: ${fmtInt(totalVotes)}`
      : "Weighted total votes: —";
  }
  if (els.intelDistrictEvidenceSignal){
    els.intelDistrictEvidenceSignal.textContent = Number.isFinite(signal)
      ? `Persuasion signal index: ${signal.toFixed(3)}${signalNote ? ` · ${signalNote}` : ""}`
      : "Persuasion signal index: —";
  }
  fillDistrictDemographicsTable(els.intelDistrictDemographicsTbody, evidence);

  fillDistrictEvidenceCandidateTable(els.intelDistrictEvidenceCandidateTbody, candidateTotals);
  fillDistrictEvidencePrecinctTable(els.intelDistrictEvidencePrecinctTbody, precinctLayers);
  fillDistrictEvidenceLinkTable(els.intelDistrictEvidenceLinkTbody, links);
  fillDistrictEvidenceGeoTable(els.intelDistrictEvidenceGeoTbody, geoLayers);
  fillDistrictEvidenceOpportunityTable(els.intelDistrictEvidenceOpportunityTbody, opportunityLayers);
  const districtState = (state?.geoPack && typeof state.geoPack === "object" && state.geoPack.district && typeof state.geoPack.district === "object")
    ? state.geoPack.district
    : null;
  const geoIdSet = new Set(geoRows.map((x) => String(x?.geoid || "").trim()).filter(Boolean));
  const firstGeoId = String(geoLayers?.[0]?.geoid || geoRows?.[0]?.geoid || "").trim();
  let selectedGeoId = String(districtState?.selectedGeoId || "").trim();
  if (!selectedGeoId || !geoIdSet.has(selectedGeoId)){
    selectedGeoId = firstGeoId;
    if (districtState) districtState.selectedGeoId = selectedGeoId || null;
  }
  renderGeoInspector(els, geoRows, selectedGeoId);
  const areaBoundary = (districtBlob && typeof districtBlob === "object" && districtBlob.areaBoundary && typeof districtBlob.areaBoundary === "object")
    ? districtBlob.areaBoundary
    : ((state?.geoPack && typeof state.geoPack === "object" && state.geoPack.areaBoundary && typeof state.geoPack.areaBoundary === "object")
      ? state.geoPack.areaBoundary
      : null);
  const onSelectGeo = (geoid) => {
    const nextGeoId = String(geoid || "").trim();
    if (!nextGeoId) return;
    if (els.intelGeoInspectorSelect){
      if (els.intelGeoInspectorSelect.value !== nextGeoId){
        els.intelGeoInspectorSelect.value = nextGeoId;
      }
      els.intelGeoInspectorSelect.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (districtState) districtState.selectedGeoId = nextGeoId;
  };
  renderDistrictEvidenceMap(
    els.intelDistrictEvidenceMapSvg,
    els.intelDistrictEvidenceMapStatus,
    geoMapLayer,
    {
      yourCandidateId: state?.yourCandidateId,
      area: areaForDisplay,
      areaBoundary,
      selectedGeoId,
      onSelectGeo,
    }
  );
  const compileReady = flowDataReady && Array.isArray(geoRows) && geoRows.length > 0;
  setFlowStepStatus(compileReady);
}
