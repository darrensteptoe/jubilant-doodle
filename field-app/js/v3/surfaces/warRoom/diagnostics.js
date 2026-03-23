export function syncWarRoomDiagnostics(view, helpers = {}) {
  const {
    setText,
  } = helpers;

  if (typeof setText !== "function") {
    return;
  }

  const diagnostics = view.diagnostics || {};

  const drift = diagnostics.exec || {};
  setText("v3DecisionDriftTag", drift.tag || "—");
  setText("v3DecisionDriftReq", drift.reqText || "—");
  setText("v3DecisionDriftActual", drift.actualText || "—");
  setText("v3DecisionDriftDelta", drift.deltaText || "—");
  setText("v3DecisionDriftBanner", drift.banner || "—");

  const risk = diagnostics.risk || {};
  setText("v3DecisionRiskTag", risk.tag || "—");
  setText("v3DecisionRiskWinProb", risk.winProbText || "—");
  setText("v3DecisionRiskMarginBand", risk.marginBandText || "—");
  setText("v3DecisionRiskVolatility", risk.volatilityText || "—");
  setText("v3DecisionRiskBanner", risk.banner || "—");

  const bneck = diagnostics.bottleneck || {};
  setText("v3DecisionBneckTag", bneck.tag || "—");
  setText("v3DecisionBneckPrimary", bneck.primary || "—");
  setText("v3DecisionBneckSecondary", bneck.secondary || "—");
  setText("v3DecisionBneckWarn", bneck.warn || "—");
  renderWarRoomBottleneckRows(bneck.rows || []);

  const sens = diagnostics.sensitivity || {};
  setText("v3DecisionSensTag", sens.tag || "—");
  setText("v3DecisionSensBanner", sens.banner || "—");
  renderWarRoomSensitivityRows(sens.rows || []);

  const conf = diagnostics.confidence || {};
  setText("v3DecisionConfTag", conf.tag || "—");
  setText("v3DecisionConfExec", conf.exec || "—");
  setText("v3DecisionConfRisk", conf.risk || "—");
  setText("v3DecisionConfTight", conf.tight || "—");
  setText("v3DecisionConfDiv", conf.divergence || "—");
  setText("v3DecisionConfBanner", conf.banner || "—");

  const warRoom = view.warRoom || {};
  setText("v3DecisionWarRoomClassDiag", warRoom.classification || "—");
  setText("v3DecisionWarRoomSigDiag", warRoom.significance || "—");
  setText("v3DecisionWarRoomActionDiag", warRoom.actionability || "—");
  setText("v3DecisionWarRoomLastReviewDiag", warRoom.lastReviewAt || "—");
  setText("v3DecisionWarRoomSummaryDiag", warRoom.summary || "—");
  renderWarRoomDriverRows(warRoom.topDrivers || []);
}

export function bindWarRoomDiagnosticsEvents(context = {}) {
  const {
    run,
    on,
  } = context;
  if (typeof run !== "function" || typeof on !== "function") {
    return;
  }
  on("v3BtnDecisionSensRun", "click", () => run((api) => api.runSensitivitySnapshot?.()));
  on("v3BtnDecisionCaptureReview", "click", () => run((api) => api.captureReviewBaseline?.()));
}

export function renderWarRoomBottleneckRows(rows) {
  const body = document.getElementById("v3DecisionBneckTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = '<tr><td class="muted" colspan="3">No bottleneck sensitivity rows.</td></tr>';
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const c0 = document.createElement("td");
    c0.textContent = String(row?.constraint || "—");
    const c1 = document.createElement("td");
    c1.className = "num";
    c1.textContent = String(row?.delta || "—");
    const c2 = document.createElement("td");
    c2.textContent = String(row?.notes || "");
    tr.append(c0, c1, c2);
    body.appendChild(tr);
  });
}

export function renderWarRoomSensitivityRows(rows) {
  const body = document.getElementById("v3DecisionSensTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = '<tr><td class="muted" colspan="4">No sensitivity rows. Run snapshot.</td></tr>';
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const c0 = document.createElement("td");
    c0.textContent = String(row?.perturbation || "—");
    const c1 = document.createElement("td");
    c1.className = "num";
    c1.textContent = String(row?.dWin || "—");
    const c2 = document.createElement("td");
    c2.className = "num";
    c2.textContent = String(row?.dP50 || "—");
    const c3 = document.createElement("td");
    c3.textContent = String(row?.notes || "");
    tr.append(c0, c1, c2, c3);
    body.appendChild(tr);
  });
}

export function renderWarRoomDriverRows(rows) {
  const body = document.getElementById("v3DecisionWarRoomDriversDiag");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted">No material drivers yet.</td></tr>';
    return;
  }
  list.forEach((line) => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = String(line || "—");
    tr.appendChild(td);
    body.appendChild(tr);
  });
}
