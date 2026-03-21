// @ts-check

import { ensureCanonicalStateVersion } from "./migrations.js";

function asDate(value) {
  const next = value instanceof Date ? value : new Date(value || Date.now());
  if (!Number.isFinite(next.getTime())) return new Date();
  return next;
}

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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

function normalizeMeta(meta = {}) {
  const src = meta && typeof meta === "object" ? meta : {};
  return {
    source: cleanText(src.source) || "store",
    reason: cleanText(src.reason) || "state_update",
    actionName: cleanText(src.actionName),
    changed: !!src.changed,
    blocked: !!src.blocked,
    revisionBefore: toFinite(src.revisionBefore, 0),
    revisionAfter: toFinite(src.revisionAfter, 0),
    at: new Date().toISOString(),
  };
}

export function createCanonicalStateStore({
  initialState = null,
  nowDate = new Date(),
} = {}) {
  const bootNow = asDate(nowDate);
  let state = ensureCanonicalStateVersion(initialState, { nowDate: bootNow });
  /** @type {Set<(state: any, meta: any) => void>} */
  const listeners = new Set();

  function getState() {
    return state;
  }

  function getSnapshot() {
    return clone(state);
  }

  function notify(meta) {
    listeners.forEach((listener) => {
      try {
        listener(state, meta);
      } catch {
        // Listener failures should not break state commits.
      }
    });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function replaceState(nextState, meta = {}) {
    const resolvedNow = asDate(meta?.nowDate);
    const nextCanonical = ensureCanonicalStateVersion(nextState, { nowDate: resolvedNow });
    const prev = state;
    const changed = nextCanonical !== prev;
    if (!changed) {
      return {
        state,
        changed: false,
        blocked: false,
        reason: "no_op",
      };
    }
    const beforeRevision = toFinite(prev?.revision, 0);
    const afterRevision = toFinite(nextCanonical?.revision, beforeRevision + 1);
    state = nextCanonical;
    notify(normalizeMeta({
      ...meta,
      source: meta?.source || "store.replaceState",
      reason: meta?.reason || "state_replaced",
      changed: true,
      revisionBefore: beforeRevision,
      revisionAfter: afterRevision,
    }));
    return {
      state,
      changed: true,
      blocked: false,
      reason: "ok",
    };
  }

  function setState(nextOrUpdater, meta = {}) {
    const previous = state;
    const nextRaw = typeof nextOrUpdater === "function"
      ? nextOrUpdater(previous)
      : nextOrUpdater;
    return replaceState(nextRaw, {
      ...meta,
      source: meta?.source || "store.setState",
      reason: meta?.reason || "state_set",
    });
  }

  function dispatchAction(action, payload, options = {}) {
    if (typeof action !== "function") {
      throw new Error("dispatchAction requires an action function");
    }
    const previous = state;
    const result = action(previous, payload, options);
    const nextState = result && typeof result === "object" && result.state ? result.state : previous;
    const changed = !!(result && typeof result === "object" ? result.changed : false);
    const blocked = !!(result && typeof result === "object" ? result.blocked : false);
    const reason = cleanText(result?.reason) || (changed ? "ok" : "no_op");
    if (nextState !== previous) {
      const previousRevision = toFinite(previous?.revision, 0);
      const nextRevision = toFinite(nextState?.revision, previousRevision + (changed ? 1 : 0));
      state = ensureCanonicalStateVersion(nextState, { nowDate: asDate(options?.nowDate) });
      notify(normalizeMeta({
        source: "store.dispatchAction",
        reason,
        actionName: cleanText(options?.actionName) || cleanText(action?.name) || "anonymousAction",
        changed,
        blocked,
        revisionBefore: previousRevision,
        revisionAfter: nextRevision,
      }));
    }
    return {
      ...(result && typeof result === "object" ? result : {}),
      state,
      changed,
      blocked,
      reason,
    };
  }

  function reset(meta = {}) {
    return replaceState(null, {
      ...meta,
      source: meta?.source || "store.reset",
      reason: meta?.reason || "store_reset",
      nowDate: asDate(meta?.nowDate),
    });
  }

  return {
    getState,
    getSnapshot,
    subscribe,
    setState,
    replaceState,
    dispatchAction,
    dispatch: dispatchAction,
    reset,
  };
}

