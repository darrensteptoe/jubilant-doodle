export function syncWarRoomActionLog(view, helpers = {}) {
  const {
    setText,
  } = helpers;

  if (typeof setText !== "function") {
    return;
  }

  setText("v3DecisionActiveSession", view.activeSessionLabel || "—");
  setText("v3DecisionScenario", view.summary?.scenarioLabel || "—");
  setText("v3DecisionObjectiveSummary", view.summary?.objectiveLabel || "—");
  setText("v3DecisionOption", view.summary?.selectedOptionLabel || "—");
  setText("v3DecisionRecommended", view.summary?.recommendedOptionLabel || "—");
  setText("v3DecisionConfidence", view.summary?.confidenceTag || "—");
  setText("v3DecisionRisk", view.summary?.riskTag || "—");
  setText("v3DecisionBottleneck", view.summary?.bottleneckTag || "—");

  const warRoom = view.warRoom || {};
  setText("v3DecisionWarRoomClass", warRoom.classification || "—");
  setText("v3DecisionWarRoomSig", warRoom.significance || "—");
  setText("v3DecisionWarRoomAction", warRoom.actionability || "—");
  renderWarRoomDecisionLogRows(warRoom.decisionLogRows || []);
}

export function bindWarRoomActionLogEvents(context = {}) {
  const {
    run,
  } = context;

  if (typeof run !== "function") {
    return;
  }

  const logBody = document.getElementById("v3DecisionLogTbody");
  if (logBody instanceof HTMLElement && logBody.dataset.v3StatusBound !== "1"){
    logBody.dataset.v3StatusBound = "1";
    logBody.addEventListener("change", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const rowId = String(target.dataset.decisionLogId || "").trim();
      if (!rowId) return;
      run((api) => api.setDecisionLogStatus?.(rowId, target.value));
    });
  }
}

export function renderWarRoomDecisionLogRows(rows) {
  const body = document.getElementById("v3DecisionLogTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted" colspan="5">No decisions logged yet.</td></tr>';
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");

    const whenCell = document.createElement("td");
    whenCell.textContent = String(row?.recordedAtText || row?.recordedAt || "—");

    const classCell = document.createElement("td");
    classCell.textContent = `${String(row?.classification || "—")} / ${String(row?.significance || "—")}`;

    const summaryCell = document.createElement("td");
    summaryCell.textContent = String(row?.summary || "—");

    const ownerCell = document.createElement("td");
    ownerCell.textContent = `${String(row?.owner || "—")} · ${String(row?.followUpDate || "—")}`;

    const statusCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "fpe-input";
    select.dataset.decisionLogId = String(row?.id || "");
    const statuses = [
      { value: "open", label: "open" },
      { value: "in_progress", label: "in progress" },
      { value: "closed", label: "closed" },
    ];
    statuses.forEach((entry) => {
      const opt = document.createElement("option");
      opt.value = entry.value;
      opt.textContent = entry.label;
      select.appendChild(opt);
    });
    const nextStatus = String(row?.status || "open");
    if ([...select.options].some((opt) => opt.value === nextStatus)) {
      select.value = nextStatus;
    }
    statusCell.appendChild(select);

    tr.append(whenCell, classCell, summaryCell, ownerCell, statusCell);
    body.appendChild(tr);
  });
}
