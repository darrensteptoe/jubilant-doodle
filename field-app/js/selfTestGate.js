// js/selfTestGate.js
// Phase 11 — Self-test gate badge state (session-only, pure helper)
export const SELFTEST_GATE = Object.freeze({
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
});

export function gateFromSelfTestResult(result){
  if (!result || typeof result !== "object") return SELFTEST_GATE.UNVERIFIED;
  const failed = Number(result.failed || 0);
  const passed = Number(result.passed || 0);
  const total = Number(result.total || (passed + failed) || 0);
  if (total <= 0) return SELFTEST_GATE.UNVERIFIED;
  if (failed === 0 && passed === total) return SELFTEST_GATE.VERIFIED;
  if (failed > 0) return SELFTEST_GATE.FAILED;
  return SELFTEST_GATE.UNVERIFIED;
}
