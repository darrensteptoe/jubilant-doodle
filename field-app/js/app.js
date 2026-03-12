// @ts-check
// Boot loader for runtime with explicit failure capture.

const RUNTIME_URL = "./appRuntime.js?v=20260312-runtime-crashfix-5";

try {
  window.__FPE_BOOT_PHASE__ = "loading-runtime";
} catch {}

import(RUNTIME_URL)
  .then(() => {
    try {
      window.__FPE_BOOT_PHASE__ = "runtime-loaded";
      if (window.__FPE_BOOT_READY__ !== false) window.__FPE_BOOT_READY__ = true;
    } catch {}
  })
  .catch((err) => {
    const msg = err?.message ? String(err.message) : String(err || "Runtime module load failed");
    const line = `runtime-load-failure: ${msg} @ ${RUNTIME_URL}`;
    try {
      const rows = Array.isArray(window.__FPE_BOOT_ERRORS) ? window.__FPE_BOOT_ERRORS : [];
      rows.unshift(line);
      window.__FPE_BOOT_ERRORS = rows.slice(0, 40);
      window.__FPE_BOOT_READY__ = false;
      window.__FPE_BOOT_PHASE__ = "runtime-failed";
    } catch {}
    console.error("[app-loader] runtime import failed", err);
  });

export {};
