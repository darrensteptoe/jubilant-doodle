// js/features/operations/metricsCache.js
// Phase 2 — Cached Operations snapshot for planner diagnostics/render paths.

import { OPERATIONS_STORES } from "./schema.js";
import { getAll, getOperationsDataRevision } from "./store.js";
import { computeOperationalRollups } from "./rollups.js";

const SNAPSHOT_STORES = OPERATIONS_STORES.slice();

let cache = {
  revision: -1,
  snapshot: null,
  inFlight: null,
};

function buildCounts(dataByStore){
  const counts = {};
  for (const name of SNAPSHOT_STORES){
    const rows = Array.isArray(dataByStore?.[name]) ? dataByStore[name] : [];
    counts[name] = rows.length;
  }
  return counts;
}

async function loadFreshSnapshot(revision){
  const pairs = await Promise.all(
    SNAPSHOT_STORES.map(async (name) => [name, await getAll(name)])
  );
  const stores = Object.fromEntries(pairs);
  const counts = buildCounts(stores);
  const rollups = computeOperationalRollups({
    shiftRecords: stores.shiftRecords,
    turfEvents: stores.turfEvents,
    options: { allowTurfFallbackAttempts: false },
  });
  return {
    revision,
    loadedAt: new Date().toISOString(),
    stores,
    counts,
    rollups,
  };
}

export async function getOperationsMetricsSnapshot({ force = false } = {}){
  const rev = getOperationsDataRevision();
  if (!force && cache.snapshot && cache.revision === rev){
    return cache.snapshot;
  }
  if (!force && cache.inFlight && cache.revision === rev){
    return cache.inFlight;
  }

  cache.revision = rev;
  cache.inFlight = loadFreshSnapshot(rev)
    .then((snapshot) => {
      cache.snapshot = snapshot;
      return snapshot;
    })
    .finally(() => {
      cache.inFlight = null;
    });

  return cache.inFlight;
}

export function invalidateOperationsMetricsCache(){
  cache = { revision: -1, snapshot: null, inFlight: null };
}

// Legacy alias to keep naming continuity with older modules.
export const getThirdWingMetricsSnapshot = getOperationsMetricsSnapshot;
