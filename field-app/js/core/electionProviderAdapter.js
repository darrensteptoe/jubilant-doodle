function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function text(v){
  return String(v == null ? "" : v).trim();
}

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pos(v){
  const n = num(v);
  return n != null && n > 0 ? n : 0;
}

function arrayFromPayload(payload){
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return [];
  const keys = ["precinctResults", "rows", "results", "data"];
  for (const key of keys){
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function pickFirstText(row, keys){
  for (const key of keys){
    const value = text(row?.[key]);
    if (value) return value;
  }
  return "";
}

function pickFirstNum(row, keys){
  for (const key of keys){
    const value = num(row?.[key]);
    if (value != null) return value;
  }
  return null;
}

function normalizeCandidateMap(candidateVotesIn){
  if (!isObject(candidateVotesIn)) return {};
  const out = {};
  for (const key of Object.keys(candidateVotesIn)){
    const candidateId = text(key);
    if (!candidateId) continue;
    const votes = pos(candidateVotesIn[key]);
    if (votes <= 0) continue;
    out[candidateId] = (out[candidateId] || 0) + votes;
  }
  return out;
}

function addCandidateVotes(target, source){
  for (const key of Object.keys(source)){
    const votes = pos(source[key]);
    if (votes <= 0) continue;
    target[key] = (target[key] || 0) + votes;
  }
}

function finalizeRows(byPrecinct){
  return Object.keys(byPrecinct)
    .sort((a, b) => a.localeCompare(b))
    .map((precinctId) => {
      const row = byPrecinct[precinctId];
      const candidateVotes = {};
      const candidateIds = Object.keys(row.candidateVotes).sort((a, b) => a.localeCompare(b));
      let sum = 0;
      for (const candidateId of candidateIds){
        const v = pos(row.candidateVotes[candidateId]);
        if (v <= 0) continue;
        candidateVotes[candidateId] = v;
        sum += v;
      }
      const totalVotes = Math.max(pos(row.totalVotes), sum);
      return { precinctId, totalVotes, candidateVotes };
    })
    .filter((row) => row.totalVotes > 0 && Object.keys(row.candidateVotes).length > 0);
}

function normalizeCanonicalRows(rows){
  const precinctKeys = ["precinctId", "precinct_id", "precinct", "vtd", "vtdkey", "precinct_code", "name"];
  const totalKeys = ["totalVotes", "totalvotes", "votes_total", "total", "ballots"];
  const candidateMapKeys = ["candidateVotes", "candidate_votes", "votesByCandidate", "results", "candidate_totals"];
  const byPrecinct = {};
  let rejected = 0;
  for (const raw of rows){
    const row = isObject(raw) ? raw : null;
    if (!row){
      rejected += 1;
      continue;
    }
    const precinctId = pickFirstText(row, precinctKeys);
    if (!precinctId){
      rejected += 1;
      continue;
    }
    let candidateVotes = {};
    for (const key of candidateMapKeys){
      const next = normalizeCandidateMap(row[key]);
      if (Object.keys(next).length){
        candidateVotes = next;
        break;
      }
    }
    if (!Object.keys(candidateVotes).length){
      rejected += 1;
      continue;
    }
    if (!byPrecinct[precinctId]){
      byPrecinct[precinctId] = { totalVotes: 0, candidateVotes: {} };
    }
    const totalVotes = pickFirstNum(row, totalKeys);
    if (totalVotes != null){
      byPrecinct[precinctId].totalVotes += Math.max(0, totalVotes);
    }
    addCandidateVotes(byPrecinct[precinctId].candidateVotes, candidateVotes);
  }
  const normalizedRows = finalizeRows(byPrecinct);
  return { rows: normalizedRows, rejectedCount: rejected };
}

function normalizeLongRows(rows){
  const precinctKeys = ["precinctId", "precinct_id", "precinct", "vtd", "vtdkey", "precinct_code", "name"];
  const candidateKeys = ["candidateId", "candidate_id", "candidate", "candidate_name", "choice", "option", "party_detailed", "party"];
  const votesKeys = ["candidatevotes", "candidate_votes", "votes", "vote_count", "votes_candidate"];
  const totalKeys = ["totalVotes", "totalvotes", "votes_total", "total", "ballots"];
  const byPrecinct = {};
  let rejected = 0;
  for (const raw of rows){
    const row = isObject(raw) ? raw : null;
    if (!row){
      rejected += 1;
      continue;
    }
    const precinctId = pickFirstText(row, precinctKeys);
    const candidateId = pickFirstText(row, candidateKeys);
    const candidateVotes = pickFirstNum(row, votesKeys);
    if (!precinctId || !candidateId || candidateVotes == null || candidateVotes <= 0){
      rejected += 1;
      continue;
    }
    if (!byPrecinct[precinctId]){
      byPrecinct[precinctId] = { totalVotes: 0, candidateVotes: {} };
    }
    byPrecinct[precinctId].candidateVotes[candidateId] = (byPrecinct[precinctId].candidateVotes[candidateId] || 0) + candidateVotes;
    const totalVotes = pickFirstNum(row, totalKeys);
    if (totalVotes != null){
      byPrecinct[precinctId].totalVotes = Math.max(byPrecinct[precinctId].totalVotes, Math.max(0, totalVotes));
    }
  }
  const normalizedRows = finalizeRows(byPrecinct);
  return { rows: normalizedRows, rejectedCount: rejected };
}

function detectFormat(rows){
  let canonicalHits = 0;
  let longHits = 0;
  for (const raw of rows){
    const row = isObject(raw) ? raw : null;
    if (!row) continue;
    if (isObject(row.candidateVotes) || isObject(row.candidate_votes) || isObject(row.votesByCandidate)){
      canonicalHits += 1;
    }
    const hasCandidateField = !!pickFirstText(row, ["candidateId", "candidate_id", "candidate", "candidate_name", "choice", "option", "party_detailed", "party"]);
    const hasVoteField = pickFirstNum(row, ["candidatevotes", "candidate_votes", "votes", "vote_count", "votes_candidate"]) != null;
    if (hasCandidateField && hasVoteField){
      longHits += 1;
    }
  }
  if (canonicalHits > 0 && canonicalHits >= longHits) return "canonical";
  if (longHits > 0) return "long";
  return "unknown";
}

export function normalizeElectionPrecinctPayload(payload, options = {}){
  const rowsIn = arrayFromPayload(payload);
  const requested = text(options.format || "auto").toLowerCase();
  const detected = detectFormat(rowsIn);
  const effective = requested === "canonical" || requested === "long"
    ? requested
    : (detected === "unknown" ? "canonical" : detected);
  const normalized = effective === "long"
    ? normalizeLongRows(rowsIn)
    : normalizeCanonicalRows(rowsIn);
  return {
    rows: normalized.rows,
    inputCount: rowsIn.length,
    outputCount: normalized.rows.length,
    rejectedCount: normalized.rejectedCount,
    requestedFormat: requested || "auto",
    detectedFormat: detected,
    effectiveFormat: effective,
  };
}
