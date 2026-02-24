export function wireDecisionSessionBindings({
  els,
  state,
  ensureDecisionScaffold,
  persist,
  renderDecisionSessionD1,
  createNewDecisionSession,
  renameActiveDecisionSession,
  deleteActiveDecisionSession,
  linkDecisionSessionToActiveScenario,
  wireInput,
  getActiveDecisionSession,
  ensureDecisionSessionShape,
  getActiveDecisionOption,
  ensureDecisionOptionShape,
  createNewDecisionOption,
  renameActiveDecisionOption,
  deleteActiveDecisionOption,
  linkDecisionOptionToActiveScenario,
  renderDecisionSummaryD4,
  buildDecisionSummaryText,
  copyTextToClipboard,
  decisionSummaryPlainText,
  decisionSessionExportObject,
  downloadJsonObject,
  runSensitivitySnapshotE4,
}){
  ensureDecisionScaffold();

  if (els.decisionSessionSelect){
    els.decisionSessionSelect.addEventListener("change", () => {
      ensureDecisionScaffold();
      const id = els.decisionSessionSelect.value;
      if (id && state.ui.decision.sessions[id]){
        state.ui.decision.activeSessionId = id;
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.btnDecisionNew) els.btnDecisionNew.addEventListener("click", () => createNewDecisionSession());
  if (els.btnDecisionRenameSave) els.btnDecisionRenameSave.addEventListener("click", () => renameActiveDecisionSession());
  if (els.btnDecisionDelete) els.btnDecisionDelete.addEventListener("click", () => deleteActiveDecisionSession());
  if (els.btnDecisionLinkScenario) els.btnDecisionLinkScenario.addEventListener("click", () => linkDecisionSessionToActiveScenario());

  wireInput(els.decisionNotes, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s) s.notes = val;
  });

  wireInput(els.decisionObjective, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s) s.objectiveKey = val;
  }, { onCommit: renderDecisionSessionD1 });

  wireInput(els.decisionBudget, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.budget = val; }
  }, { parse: raw => { const n = Number(String(raw).trim()); return (String(raw).trim() === "" || !Number.isFinite(n)) ? null : n; } });

  wireInput(els.decisionVolunteerHrs, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.volunteerHrs = val; }
  }, { parse: raw => { const n = Number(String(raw).trim()); return (String(raw).trim() === "" || !Number.isFinite(n)) ? null : n; } });

  wireInput(els.decisionTurfAccess, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.turfAccess = val; }
  });

  wireInput(els.decisionBlackoutDates, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.constraints.blackoutDates = val; }
  });

  wireInput(els.decisionRiskPosture, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){ ensureDecisionSessionShape(s); s.riskPosture = val || "balanced"; }
  }, { onCommit: renderDecisionSessionD1 });

  wireInput(els.decisionNonNegotiables, (st, val) => {
    const s = st.ui.decision.sessions[getActiveDecisionSession()?.id];
    if (s){
      ensureDecisionSessionShape(s);
      s.nonNegotiables = val.split(/\r?\n|,/).map(x => String(x || "").trim()).filter(Boolean);
    }
  });

  if (els.decisionOptionSelect){
    els.decisionOptionSelect.addEventListener("change", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const id = String(els.decisionOptionSelect.value || "");
      if (id && s.options && s.options[id]){
        s.activeOptionId = id;
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.btnDecisionOptionNew) els.btnDecisionOptionNew.addEventListener("click", () => createNewDecisionOption());
  if (els.btnDecisionOptionRenameSave) els.btnDecisionOptionRenameSave.addEventListener("click", () => renameActiveDecisionOption());
  if (els.btnDecisionOptionDelete) els.btnDecisionOptionDelete.addEventListener("click", () => deleteActiveDecisionOption());
  if (els.btnDecisionOptionLinkScenario) els.btnDecisionOptionLinkScenario.addEventListener("click", () => linkDecisionOptionToActiveScenario());

  const tacticUpdate = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) return;
    ensureDecisionOptionShape(o);
    o.tactics.doors = !!els.decisionOptionTacticDoors?.checked;
    o.tactics.phones = !!els.decisionOptionTacticPhones?.checked;
    o.tactics.digital = !!els.decisionOptionTacticDigital?.checked;
    persist();
  };

  if (els.decisionOptionTacticDoors) els.decisionOptionTacticDoors.addEventListener("change", tacticUpdate);
  if (els.decisionOptionTacticPhones) els.decisionOptionTacticPhones.addEventListener("change", tacticUpdate);
  if (els.decisionOptionTacticDigital) els.decisionOptionTacticDigital.addEventListener("change", tacticUpdate);

  if (els.decisionRecommendSelect){
    els.decisionRecommendSelect.addEventListener("change", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const id = String(els.decisionRecommendSelect.value || "").trim();
      s.recommendedOptionId = id || null;
      persist();
      renderDecisionSummaryD4(s);
    });
  }

  if (els.decisionWhatTrue){
    els.decisionWhatTrue.addEventListener("input", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const raw = String(els.decisionWhatTrue.value || "");
      const arr = raw.split(/\r?\n/).map(x => String(x || "").trim()).filter(Boolean);
      s.whatNeedsTrue = arr;
      persist();
      renderDecisionSummaryD4(s);
    });
  }

  const setCopyStatus = (msg) => {
    if (els.decisionCopyStatus) els.decisionCopyStatus.textContent = String(msg || "");
  };

  if (els.btnDecisionCopyMd){
    els.btnDecisionCopyMd.addEventListener("click", async () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const md = buildDecisionSummaryText(s);
      const ok = await copyTextToClipboard(md);
      setCopyStatus(ok ? "Copied summary (markdown)." : "Copy failed.");
    });
  }

  if (els.btnDecisionCopyText){
    els.btnDecisionCopyText.addEventListener("click", async () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const md = buildDecisionSummaryText(s);
      const plain = decisionSummaryPlainText(md);
      const ok = await copyTextToClipboard(plain);
      setCopyStatus(ok ? "Copied summary (text)." : "Copy failed.");
    });
  }

  if (els.btnDecisionDownloadJson){
    els.btnDecisionDownloadJson.addEventListener("click", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const obj = decisionSessionExportObject(s);
      if (!obj) return;
      const safe = String((s.name || s.id || "decision-session")).toLowerCase().replace(/[^a-z0-9\-\_]+/g, "-").replace(/\-+/g, "-").replace(/^\-+|\-+$/g, "");
      const fn = (safe ? safe : "decision-session") + ".json";
      downloadJsonObject(obj, fn);
      setCopyStatus("Downloaded session JSON.");
    });
  }

  if (els.btnSensRun){
    els.btnSensRun.addEventListener("click", async () => {
      await runSensitivitySnapshotE4();
    });
  }

  renderDecisionSessionD1();
}
