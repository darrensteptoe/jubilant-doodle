// @ts-check

import { clone, makeActionResult, mutateDomain, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function makeCandidateId(name = "", orderIndex = 1, existingIds = new Set()) {
  const token = cleanText(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "candidate";
  let id = `cand_${token}`;
  if (!existingIds.has(id)) return id;
  let i = Math.max(2, orderIndex);
  while (existingIds.has(`${id}_${i}`)) i += 1;
  return `${id}_${i}`;
}

function ensureBallotRefs(draft) {
  if (!draft.candidateRefs || typeof draft.candidateRefs !== "object") {
    draft.candidateRefs = { byId: {}, order: [] };
  }
  if (!draft.candidateRefs.byId || typeof draft.candidateRefs.byId !== "object") {
    draft.candidateRefs.byId = {};
  }
  if (!Array.isArray(draft.candidateRefs.order)) {
    draft.candidateRefs.order = [];
  }
  if (!draft.userSplitByCandidateId || typeof draft.userSplitByCandidateId !== "object") {
    draft.userSplitByCandidateId = {};
  }
}

export function addBallotCandidate(state, payload, options = {}) {
  const name = cleanText(payload?.name) || "Candidate";
  const supportPct = toFinite(payload?.supportPct, null);
  const candidateIdInput = cleanText(payload?.candidateId);

  const result = mutateDomain(
    state,
    "ballot",
    (draft) => {
      ensureBallotRefs(draft);
      const existingIds = new Set(draft.candidateRefs.order);
      const candidateId = candidateIdInput || makeCandidateId(name, draft.candidateRefs.order.length + 1, existingIds);
      if (existingIds.has(candidateId)) return false;

      draft.candidateRefs.byId[candidateId] = {
        id: candidateId,
        name,
        supportPct,
      };
      draft.candidateRefs.order.push(candidateId);
      if (!Object.prototype.hasOwnProperty.call(draft.userSplitByCandidateId, candidateId)) {
        draft.userSplitByCandidateId[candidateId] = null;
      }
      if (!cleanText(draft.yourCandidateId)) {
        draft.yourCandidateId = candidateId;
      }
      return true;
    },
    { ...options, revisionReason: "ballot.addCandidate" },
  );
  return makeActionResult(result);
}

export function updateBallotCandidate(state, payload, options = {}) {
  const candidateId = cleanText(payload?.candidateId);
  const field = cleanText(payload?.field);
  if (!candidateId || !field) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_payload" });
  }
  const allowed = new Set(["name", "supportPct"]);
  if (!allowed.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "ballot",
    (draft) => {
      ensureBallotRefs(draft);
      if (!draft.candidateRefs.byId[candidateId]) return false;
      const nextValue = field === "supportPct"
        ? toFinite(payload?.value, null)
        : cleanText(payload?.value);
      if (draft.candidateRefs.byId[candidateId][field] === nextValue) return false;
      draft.candidateRefs.byId[candidateId][field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `ballot.candidate.${field}` },
  );
  return makeActionResult(result, { candidateId, field });
}

export function removeBallotCandidate(state, payload, options = {}) {
  const candidateId = cleanText(payload?.candidateId);
  if (!candidateId) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_payload" });
  }

  const result = mutateDomain(
    state,
    "ballot",
    (draft) => {
      ensureBallotRefs(draft);
      if (!draft.candidateRefs.byId[candidateId]) return false;
      delete draft.candidateRefs.byId[candidateId];
      draft.candidateRefs.order = draft.candidateRefs.order.filter((id) => id !== candidateId);
      delete draft.userSplitByCandidateId[candidateId];
      if (draft.yourCandidateId === candidateId) {
        draft.yourCandidateId = draft.candidateRefs.order[0] || "";
      }
      return true;
    },
    { ...options, revisionReason: "ballot.removeCandidate" },
  );
  return makeActionResult(result, { candidateId });
}

export function updateBallotUserSplit(state, payload, options = {}) {
  const candidateId = cleanText(payload?.candidateId);
  if (!candidateId) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_payload" });
  }

  const result = mutateDomain(
    state,
    "ballot",
    (draft) => {
      ensureBallotRefs(draft);
      if (!draft.candidateRefs.byId[candidateId]) return false;
      const nextValue = toFinite(payload?.value, null);
      if (draft.userSplitByCandidateId[candidateId] === nextValue) return false;
      draft.userSplitByCandidateId[candidateId] = nextValue;
      return true;
    },
    { ...options, revisionReason: "ballot.userSplit" },
  );
  return makeActionResult(result, { candidateId });
}

export function setBallotUndecided(state, payload, options = {}) {
  const result = mutateDomain(
    state,
    "ballot",
    (draft) => {
      const nextUndecided = toFinite(payload?.undecidedPct, null);
      const nextMode = cleanText(payload?.undecidedMode) || "proportional";
      let changed = false;
      if (draft.undecidedPct !== nextUndecided) {
        draft.undecidedPct = nextUndecided;
        changed = true;
      }
      if (draft.undecidedMode !== nextMode) {
        draft.undecidedMode = nextMode;
        changed = true;
      }
      return changed;
    },
    { ...options, revisionReason: "ballot.undecided" },
  );
  return makeActionResult(result);
}

export function replaceBallotCandidates(state, payload, options = {}) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const result = mutateDomain(
    state,
    "ballot",
    (draft) => {
      ensureBallotRefs(draft);
      const byId = {};
      const order = [];
      const split = {};
      const used = new Set();
      rows.forEach((row, idx) => {
        const candidateId = cleanText(row?.id) || makeCandidateId(cleanText(row?.name), idx + 1, used);
        if (used.has(candidateId)) return;
        used.add(candidateId);
        byId[candidateId] = {
          id: candidateId,
          name: cleanText(row?.name) || `Candidate ${idx + 1}`,
          supportPct: toFinite(row?.supportPct, null),
        };
        order.push(candidateId);
        split[candidateId] = toFinite(row?.userSplitPct, null);
      });
      if (!order.length) return false;
      draft.candidateRefs = { byId: clone(byId), order: order.slice() };
      draft.userSplitByCandidateId = clone(split);
      if (!order.includes(draft.yourCandidateId)) {
        draft.yourCandidateId = order[0];
      }
      return true;
    },
    { ...options, revisionReason: "ballot.replaceCandidates" },
  );
  return makeActionResult(result);
}

