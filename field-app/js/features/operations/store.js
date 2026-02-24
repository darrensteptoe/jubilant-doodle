// js/features/operations/store.js
// Canonical operations store API with legacy-compatible aliases.

import * as legacy from "../thirdWing/store.js";

export const openOperationsDb = legacy.openThirdWingDb;
export const closeOperationsDb = legacy.closeThirdWingDb;
export const ensureOperationsDefaults = legacy.ensureThirdWingDefaults;
export const makeOperationsId = legacy.makeThirdWingId;

export const getAll = legacy.getAll;
export const getById = legacy.getById;
export const getByIndex = legacy.getByIndex;
export const put = legacy.put;
export const putMany = legacy.putMany;
export const remove = legacy.remove;
export const clear = legacy.clear;
export const clearAllStores = legacy.clearAllStores;
export const replaceAllStores = legacy.replaceAllStores;
export const mergeAllStores = legacy.mergeAllStores;
export const getSummaryCounts = legacy.getSummaryCounts;

// Legacy aliases (backward compatibility).
export const openThirdWingDb = openOperationsDb;
export const closeThirdWingDb = closeOperationsDb;
export const ensureThirdWingDefaults = ensureOperationsDefaults;
export const makeThirdWingId = makeOperationsId;
