// @ts-check
import { buildReachFreshnessView, buildReachLeversAndActionsView } from "../../core/reachView.js";
export function renderWeeklyOpsInsightsPanel({
  els,
  state,
  res,
  weeks,
  ctx,
  executionSnapshot,
  computeWeeklyOpsContext,
  clamp,
  computeCapacityBreakdown,
  syncWeeklyUndoUI,
  safeCall,
  applyWeeklyLeverScenario,
  computeRealityDrift
}){
  const wkLeversIntroEl = els?.wkLeversIntro;
  const wkActionsListEl = els?.wkActionsList;
  const wkBestMovesListEl = els?.wkBestMovesList;
  const wkLeversTbodyEl = els?.wkLeversTbody;
  const wkLeversFootEl = els?.wkLeversFoot;
  const wkBestMovesIntroEl = els?.wkBestMovesIntro;
  if (!wkLeversIntroEl && !wkActionsListEl && !wkBestMovesListEl && !wkLeversTbodyEl) return;

  const opsCtx = ctx || computeWeeklyOpsContext(res, weeks);

  if (wkBestMovesListEl) wkBestMovesListEl.innerHTML = "";
  if (wkActionsListEl) wkActionsListEl.innerHTML = "";
  if (wkLeversTbodyEl) wkLeversTbodyEl.innerHTML = "";

  syncWeeklyUndoUI();

  const view = buildReachLeversAndActionsView({
    weeklyContext: opsCtx,
    executionSnapshot,
    computeCapacityBreakdownFn: (payload) => computeCapacityBreakdown(payload),
    clampFn: clamp,
    computeRealityDriftFn: () => computeRealityDrift(),
  });

  if (wkLeversIntroEl) wkLeversIntroEl.textContent = view.intro;
  if (wkBestMovesIntroEl){
    wkBestMovesIntroEl.hidden = !view.showBestMoves;
    wkBestMovesIntroEl.textContent = view.bestMovesIntro;
  }
  if (wkLeversFootEl){
    wkLeversFootEl.hidden = !view.foot;
    wkLeversFootEl.textContent = view.foot;
  }

  for (const row of view.bestMoves){
    const li = document.createElement("li");
    li.className = "actionItem";
    const span = document.createElement("span");
    span.textContent = row.text;
    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.type = "button";
    btn.textContent = "Apply";
    btn.addEventListener("click", () => { safeCall(() => { applyWeeklyLeverScenario(row.lever, opsCtx); }); });
    li.appendChild(span);
    li.appendChild(btn);
    if (wkBestMovesListEl) wkBestMovesListEl.appendChild(li);
  }

  for (const row of view.rows){
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    const td3 = document.createElement("td");
    const td4 = document.createElement("td");
    const td5 = document.createElement("td");
    td2.className = "num";
    td4.className = "num";
    td1.textContent = row.label;
    td2.textContent = row.impact;
    td3.textContent = row.costUnit;
    td4.textContent = row.efficiency;

    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.type = "button";
    btn.textContent = "Apply";
    btn.addEventListener("click", () => { safeCall(() => { applyWeeklyLeverScenario(row.lever, opsCtx); }); });
    td5.appendChild(btn);

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    if (wkLeversTbodyEl) wkLeversTbodyEl.appendChild(tr);
  }

  for (const action of view.actions) addBullet(wkActionsListEl, action);
}

export function renderWeeklyOpsFreshnessPanel({
  els,
  state,
  res,
  weeks,
  ctx,
  executionSnapshot,
  safeNum,
  computeWeeklyOpsContext
}){
  const wkLastUpdateEl = els?.wkLastUpdate;
  const wkFreshStatusEl = els?.wkFreshStatus;
  if (!wkLastUpdateEl && !wkFreshStatusEl) return;
  const opsCtx = ctx || computeWeeklyOpsContext(res, weeks);
  const view = buildReachFreshnessView({
    state,
    weeklyContext: opsCtx,
    executionSnapshot,
    safeNumFn: safeNum,
  });

  if (wkLastUpdateEl) wkLastUpdateEl.textContent = view.lastUpdate;
  if (els.wkFreshNote) els.wkFreshNote.textContent = view.freshNote;
  if (els.wkRollingAttempts) els.wkRollingAttempts.textContent = view.rollingAttempts;
  if (els.wkRollingNote) els.wkRollingNote.textContent = view.rollingNote;
  if (els.wkRollingCR) els.wkRollingCR.textContent = view.rollingCR;
  if (els.wkRollingCRNote) els.wkRollingCRNote.textContent = view.rollingCRNote;
  if (els.wkRollingSR) els.wkRollingSR.textContent = view.rollingSR;
  if (els.wkRollingSRNote) els.wkRollingSRNote.textContent = view.rollingSRNote;
  if (els.wkRollingAPH) els.wkRollingAPH.textContent = view.rollingAPH;
  if (els.wkRollingAPHNote) els.wkRollingAPHNote.textContent = view.rollingAPHNote;
  if (wkFreshStatusEl) wkFreshStatusEl.textContent = view.status;
}

function addBullet(listEl, text){
  if (!listEl) return;
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}
