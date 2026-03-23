export function syncWarRoomEventCalendar(view, helpers = {}) {
  const {
    syncInput,
    syncSelect,
    setChecked,
    setDisabled,
    setText,
  } = helpers;

  if (
    typeof syncInput !== "function"
    || typeof syncSelect !== "function"
    || typeof setChecked !== "function"
    || typeof setDisabled !== "function"
    || typeof setText !== "function"
  ) {
    return;
  }

  const warRoom = view.warRoom || {};
  const eventCalendar = warRoom.eventCalendar || {};
  const eventFilters = eventCalendar.filters || {};
  const eventDraft = eventCalendar.draft || {};
  const eventOptions = eventCalendar.options || {};
  const hasSession = !!view.session;

  syncInput("v3DecisionEventFilterDate", eventFilters.date || "");
  syncSelect("v3DecisionEventCategoryFilter", eventOptions.categoryFilterOptions || [], eventFilters.category || "all", "value", "label");
  syncSelect("v3DecisionEventCategory", eventOptions.categoryOptions || [], eventDraft.category || "campaign", "value", "label");
  syncSelect("v3DecisionEventType", eventOptions.eventTypeOptions || [], eventDraft.eventType || "", "value", "label");
  syncSelect("v3DecisionEventStatus", eventOptions.statusOptions || [], eventDraft.status || "scheduled", "value", "label");

  syncInput("v3DecisionEventTitle", eventDraft.title || "");
  syncInput("v3DecisionEventDate", eventDraft.date || "");
  syncInput("v3DecisionEventStartTime", eventDraft.startTime || "");
  syncInput("v3DecisionEventEndTime", eventDraft.endTime || "");
  syncInput("v3DecisionEventCreatedBy", eventDraft.createdBy || "");
  syncInput("v3DecisionEventExpectedVolunteers", eventDraft.expectedVolunteers == null ? "" : String(eventDraft.expectedVolunteers));
  syncInput("v3DecisionEventExpectedPaid", eventDraft.expectedPaidCanvassers == null ? "" : String(eventDraft.expectedPaidCanvassers));
  syncInput("v3DecisionEventExpectedShiftHours", eventDraft.expectedShiftHours == null ? "" : String(eventDraft.expectedShiftHours));
  syncInput("v3DecisionEventMeetingType", eventDraft.meetingType || "");
  syncInput("v3DecisionEventAttendees", eventDraft.attendees || "");
  syncInput("v3DecisionEventFollowUpOwner", eventDraft.followUpOwner || "");
  syncInput("v3DecisionEventFollowUpDate", eventDraft.followUpDate || "");
  syncInput("v3DecisionEventOfficeLocation", eventDraft.officeLocation || "");
  syncInput("v3DecisionEventChannelFocus", eventDraft.channelFocus || "");
  syncInput("v3DecisionEventFieldGoalNotes", eventDraft.fieldGoalNotes || "");
  syncInput("v3DecisionEventNotes", eventDraft.notes || "");

  setChecked("v3DecisionEventAppliedOnly", !!eventFilters.appliedOnly);
  setChecked("v3DecisionEventIncludeInactive", !!eventFilters.includeInactive);
  setChecked("v3DecisionEventApplyToModel", !!eventDraft.applyToModel);

  setDisabled("v3DecisionEventFilterDate", !hasSession);
  setDisabled("v3DecisionEventCategoryFilter", !hasSession);
  setDisabled("v3DecisionEventAppliedOnly", !hasSession);
  setDisabled("v3DecisionEventIncludeInactive", !hasSession);
  setDisabled("v3DecisionEventCategory", !hasSession);
  setDisabled("v3DecisionEventType", !hasSession);
  setDisabled("v3DecisionEventStatus", !hasSession);
  setDisabled("v3DecisionEventTitle", !hasSession);
  setDisabled("v3DecisionEventDate", !hasSession);
  setDisabled("v3DecisionEventStartTime", !hasSession);
  setDisabled("v3DecisionEventEndTime", !hasSession);
  setDisabled("v3DecisionEventCreatedBy", !hasSession);
  setDisabled("v3DecisionEventExpectedVolunteers", !hasSession);
  setDisabled("v3DecisionEventExpectedPaid", !hasSession);
  setDisabled("v3DecisionEventExpectedShiftHours", !hasSession);
  setDisabled("v3DecisionEventMeetingType", !hasSession);
  setDisabled("v3DecisionEventAttendees", !hasSession);
  setDisabled("v3DecisionEventFollowUpOwner", !hasSession);
  setDisabled("v3DecisionEventFollowUpDate", !hasSession);
  setDisabled("v3DecisionEventOfficeLocation", !hasSession);
  setDisabled("v3DecisionEventChannelFocus", !hasSession);
  setDisabled("v3DecisionEventFieldGoalNotes", !hasSession);
  setDisabled("v3DecisionEventNotes", !hasSession);
  setDisabled("v3DecisionEventApplyToModel", !hasSession || String(eventDraft.category || "").toLowerCase() !== "campaign");
  setDisabled("v3BtnDecisionEventSave", !hasSession);
  setDisabled("v3BtnDecisionEventClear", !hasSession);

  setText("v3DecisionEventSummary", eventCalendar.summaryText || "No events for selected date.");
  setText("v3DecisionEventImpact", eventCalendar.impactText || "No active campaign events are applying capacity modifiers for the selected date.");
  renderWarRoomEventRows(eventCalendar.rows || []);
}

export function bindWarRoomEventCalendarEvents(context = {}) {
  const {
    run,
    on,
    valueOf,
    checkedOf,
    confirmThenRun,
  } = context;

  if (
    typeof run !== "function"
    || typeof on !== "function"
    || typeof valueOf !== "function"
    || typeof checkedOf !== "function"
    || typeof confirmThenRun !== "function"
  ) {
    return;
  }

  on("v3DecisionEventFilterDate", "change", () => run((api) => api.setEventFilter?.("date", valueOf("v3DecisionEventFilterDate"))));
  on("v3DecisionEventCategoryFilter", "change", () => run((api) => api.setEventFilter?.("category", valueOf("v3DecisionEventCategoryFilter"))));
  on("v3DecisionEventAppliedOnly", "change", () => run((api) => api.setEventFilter?.("appliedOnly", checkedOf("v3DecisionEventAppliedOnly"))));
  on("v3DecisionEventIncludeInactive", "change", () => run((api) => api.setEventFilter?.("includeInactive", checkedOf("v3DecisionEventIncludeInactive"))));
  on("v3DecisionEventCategory", "change", () => run((api) => api.setEventDraftField?.("category", valueOf("v3DecisionEventCategory"))));
  on("v3DecisionEventType", "change", () => run((api) => api.setEventDraftField?.("eventType", valueOf("v3DecisionEventType"))));
  on("v3DecisionEventStatus", "change", () => run((api) => api.setEventDraftField?.("status", valueOf("v3DecisionEventStatus"))));
  on("v3DecisionEventTitle", "input", () => run((api) => api.setEventDraftField?.("title", valueOf("v3DecisionEventTitle"))));
  on("v3DecisionEventDate", "change", () => run((api) => api.setEventDraftField?.("date", valueOf("v3DecisionEventDate"))));
  on("v3DecisionEventStartTime", "change", () => run((api) => api.setEventDraftField?.("startTime", valueOf("v3DecisionEventStartTime"))));
  on("v3DecisionEventEndTime", "change", () => run((api) => api.setEventDraftField?.("endTime", valueOf("v3DecisionEventEndTime"))));
  on("v3DecisionEventCreatedBy", "input", () => run((api) => api.setEventDraftField?.("createdBy", valueOf("v3DecisionEventCreatedBy"))));
  on("v3DecisionEventApplyToModel", "change", () => run((api) => api.setEventDraftField?.("applyToModel", checkedOf("v3DecisionEventApplyToModel"))));
  on("v3DecisionEventExpectedVolunteers", "input", () => run((api) => api.setEventDraftField?.("expectedVolunteers", valueOf("v3DecisionEventExpectedVolunteers"))));
  on("v3DecisionEventExpectedPaid", "input", () => run((api) => api.setEventDraftField?.("expectedPaidCanvassers", valueOf("v3DecisionEventExpectedPaid"))));
  on("v3DecisionEventExpectedShiftHours", "input", () => run((api) => api.setEventDraftField?.("expectedShiftHours", valueOf("v3DecisionEventExpectedShiftHours"))));
  on("v3DecisionEventMeetingType", "input", () => run((api) => api.setEventDraftField?.("meetingType", valueOf("v3DecisionEventMeetingType"))));
  on("v3DecisionEventAttendees", "input", () => run((api) => api.setEventDraftField?.("attendees", valueOf("v3DecisionEventAttendees"))));
  on("v3DecisionEventFollowUpOwner", "input", () => run((api) => api.setEventDraftField?.("followUpOwner", valueOf("v3DecisionEventFollowUpOwner"))));
  on("v3DecisionEventFollowUpDate", "change", () => run((api) => api.setEventDraftField?.("followUpDate", valueOf("v3DecisionEventFollowUpDate"))));
  on("v3DecisionEventOfficeLocation", "input", () => run((api) => api.setEventDraftField?.("officeLocation", valueOf("v3DecisionEventOfficeLocation"))));
  on("v3DecisionEventChannelFocus", "input", () => run((api) => api.setEventDraftField?.("channelFocus", valueOf("v3DecisionEventChannelFocus"))));
  on("v3DecisionEventFieldGoalNotes", "input", () => run((api) => api.setEventDraftField?.("fieldGoalNotes", valueOf("v3DecisionEventFieldGoalNotes"))));
  on("v3DecisionEventNotes", "input", () => run((api) => api.setEventDraftField?.("notes", valueOf("v3DecisionEventNotes"))));
  on("v3BtnDecisionEventSave", "click", () => run((api) => api.saveEventDraft?.()));
  on("v3BtnDecisionEventClear", "click", () => run((api) => api.clearEventDraft?.()));

  const eventBody = document.getElementById("v3DecisionEventTbody");
  if (eventBody instanceof HTMLElement && eventBody.dataset.v3EventBound !== "1"){
    eventBody.dataset.v3EventBound = "1";

    eventBody.addEventListener("change", (event) => {
      const target = event?.target;
      if (target instanceof HTMLInputElement && target.type === "checkbox"){
        const rowId = String(target.dataset.eventId || "").trim();
        if (!rowId) return;
        run((api) => api.setEventApplyToModel?.(rowId, !!target.checked));
        return;
      }
      if (target instanceof HTMLSelectElement){
        const rowId = String(target.dataset.eventStatusId || "").trim();
        if (!rowId) return;
        run((api) => api.setEventStatus?.(rowId, target.value));
      }
    });

    eventBody.addEventListener("click", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLElement)) return;
      const rowId = String(target.dataset.eventActionId || "").trim();
      if (!rowId) return;
      const action = String(target.dataset.eventAction || "").trim();
      if (!action) return;
      if (action === "edit"){
        run((api) => api.loadEventDraft?.(rowId));
      } else if (action === "delete"){
        confirmThenRun("Delete selected event?", (api) => api.deleteEvent?.(rowId));
      }
    });
  }
}

export function renderWarRoomEventRows(rows) {
  const body = document.getElementById("v3DecisionEventTbody");
  if (!(body instanceof HTMLElement)) {
    return;
  }
  body.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    body.innerHTML = '<tr><td class="muted" colspan="7">No events on selected date.</td></tr>';
    return;
  }
  list.forEach((row) => {
    const tr = document.createElement("tr");
    const eventId = String(row?.eventId || "").trim();

    const cDate = document.createElement("td");
    cDate.textContent = `${String(row?.dateLabel || "—")} / ${String(row?.timeLabel || "—")}`;

    const cType = document.createElement("td");
    cType.textContent = `${String(row?.categoryLabel || "—")} / ${String(row?.eventType || "—")}`;

    const cTitle = document.createElement("td");
    const title = String(row?.title || "Untitled");
    const notes = String(row?.notes || "").trim();
    cTitle.textContent = notes ? `${title} — ${notes}` : title;

    const cCapacity = document.createElement("td");
    cCapacity.textContent = `V ${String(row?.expectedVolunteers ?? 0)} / P ${String(row?.expectedPaidCanvassers ?? 0)} / H ${String(row?.expectedShiftHours ?? 0)}`;

    const cApply = document.createElement("td");
    const applyToggle = document.createElement("input");
    applyToggle.type = "checkbox";
    applyToggle.checked = !!row?.applyToModel;
    applyToggle.disabled = !row?.canApplyToModel;
    applyToggle.dataset.eventId = eventId;
    cApply.appendChild(applyToggle);

    const cStatus = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = "fpe-input";
    statusSelect.dataset.eventStatusId = eventId;
    const statuses = [
      { value: "scheduled", label: "scheduled" },
      { value: "active", label: "active" },
      { value: "completed", label: "completed" },
      { value: "cancelled", label: "cancelled" },
    ];
    statuses.forEach((statusRow) => {
      const opt = document.createElement("option");
      opt.value = statusRow.value;
      opt.textContent = statusRow.label;
      statusSelect.appendChild(opt);
    });
    const statusValue = String(row?.status || "scheduled").toLowerCase();
    if ([...statusSelect.options].some((opt) => opt.value === statusValue)) {
      statusSelect.value = statusValue;
    }
    cStatus.appendChild(statusSelect);

    const cActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "fpe-btn fpe-btn--ghost";
    editBtn.textContent = "Edit";
    editBtn.dataset.eventAction = "edit";
    editBtn.dataset.eventActionId = eventId;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "fpe-btn fpe-btn--ghost";
    deleteBtn.textContent = "Delete";
    deleteBtn.dataset.eventAction = "delete";
    deleteBtn.dataset.eventActionId = eventId;

    cActions.append(editBtn, deleteBtn);

    tr.append(cDate, cType, cTitle, cCapacity, cApply, cStatus, cActions);
    body.appendChild(tr);
  });
}
