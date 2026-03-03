export function renderDecisionOptionsPanelCore({
  els,
  session,
  ensureDecisionSessionShape,
  listDecisionOptions,
  getActiveDecisionOption,
  decisionScenarioLabel,
}){
  if (!els.decisionOptionSelect) return;
  if (!session) return;

  ensureDecisionSessionShape(session);

  const options = listDecisionOptions(session);
  const active = getActiveDecisionOption(session);

  els.decisionOptionSelect.innerHTML = "";
  if (!options.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No options yet";
    els.decisionOptionSelect.appendChild(opt);
    els.decisionOptionSelect.value = "";
  } else {
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label || o.id;
      els.decisionOptionSelect.appendChild(opt);
    }
    els.decisionOptionSelect.value = session.activeOptionId || options[0].id;
    if (!session.activeOptionId) session.activeOptionId = els.decisionOptionSelect.value;
  }

  const has = !!active;

  if (els.decisionOptionRename){
    els.decisionOptionRename.value = has ? String(active.label || "") : "";
    els.decisionOptionRename.disabled = !has;
  }

  if (els.btnDecisionOptionRenameSave) els.btnDecisionOptionRenameSave.disabled = !has;
  if (els.btnDecisionOptionDelete) els.btnDecisionOptionDelete.disabled = options.length <= 1;
  if (els.btnDecisionOptionLinkScenario) els.btnDecisionOptionLinkScenario.disabled = !has;

  if (els.decisionOptionScenarioLabel){
    els.decisionOptionScenarioLabel.textContent = has ? decisionScenarioLabel(active.scenarioId || null) : "—";
  }

  const t = has ? (active.tactics || {}) : {};
  if (els.decisionOptionTacticDoors){
    els.decisionOptionTacticDoors.checked = !!t.doors;
    els.decisionOptionTacticDoors.disabled = !has;
  }
  if (els.decisionOptionTacticPhones){
    els.decisionOptionTacticPhones.checked = !!t.phones;
    els.decisionOptionTacticPhones.disabled = !has;
  }
  if (els.decisionOptionTacticDigital){
    els.decisionOptionTacticDigital.checked = !!t.digital;
    els.decisionOptionTacticDigital.disabled = !has;
  }
}

export function renderDecisionSessionPanelCore({
  els,
  state,
  ensureDecisionScaffold,
  listDecisionSessions,
  getActiveDecisionSession,
  ensureDecisionSessionShape,
  objectiveTemplates,
  riskPostures,
  decisionScenarioLabel,
  renderDecisionOptions,
  renderDecisionSummary,
}){
  if (!els.decisionSessionSelect && !els.decisionActiveLabel) return;
  ensureDecisionScaffold();
  const sessions = listDecisionSessions();
  const activeId = state.ui.decision.activeSessionId;
  const active = getActiveDecisionSession();
  ensureDecisionSessionShape(active);

  if (els.decisionSessionSelect){
    els.decisionSessionSelect.innerHTML = "";
    for (const s of sessions){
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      els.decisionSessionSelect.appendChild(opt);
    }
    els.decisionSessionSelect.value = activeId;
  }

  if (els.decisionActiveLabel){
    els.decisionActiveLabel.textContent = active ? `Active session: ${active.name || active.id}` : "Active session: —";
  }

  if (els.decisionRename){
    els.decisionRename.value = active?.name || "";
  }

  if (els.decisionObjective){
    els.decisionObjective.innerHTML = "";
    for (const o of objectiveTemplates){
      const opt = document.createElement("option");
      opt.value = o.key;
      opt.textContent = o.label;
      els.decisionObjective.appendChild(opt);
    }
    els.decisionObjective.value = active?.objectiveKey || objectiveTemplates[0].key;
  }

  if (els.decisionNotes){
    els.decisionNotes.value = active?.notes || "";
  }

  if (els.decisionBudget){
    const v = active?.constraints?.budget;
    els.decisionBudget.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionVolunteerHrs){
    const v = active?.constraints?.volunteerHrs;
    els.decisionVolunteerHrs.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionTurfAccess){
    els.decisionTurfAccess.value = String(active?.constraints?.turfAccess || "");
  }

  if (els.decisionBlackoutDates){
    els.decisionBlackoutDates.value = String(active?.constraints?.blackoutDates || "");
  }

  if (els.decisionRiskPosture){
    if (!els.decisionRiskPosture.options.length){
      for (const rp of riskPostures){
        const opt = document.createElement("option");
        opt.value = rp.key;
        opt.textContent = rp.label;
        els.decisionRiskPosture.appendChild(opt);
      }
    }
    els.decisionRiskPosture.value = String(active?.riskPosture || "balanced");
  }

  if (els.decisionNonNegotiables){
    const lines = Array.isArray(active?.nonNegotiables) ? active.nonNegotiables : [];
    els.decisionNonNegotiables.value = lines.join("\n");
  }

  if (els.decisionScenarioLabel){
    els.decisionScenarioLabel.textContent = decisionScenarioLabel(active?.scenarioId || null);
  }

  if (els.btnDecisionDelete){
    els.btnDecisionDelete.disabled = sessions.length <= 1;
  }

  renderDecisionOptions(active);
  renderDecisionSummary(active);
}
