export function createFieldGrid(variant) {
  const el = document.createElement("div");
  el.className = `fpe-field-grid ${variant}`;
  return el;
}

export function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = value || "-";
}

export function readText(selector) {
  const el = document.querySelector(selector);
  return el ? (el.textContent || "").trim() : "";
}

export function readSelectedLabel(selector) {
  const select = document.querySelector(selector);
  if (!select || typeof select.selectedIndex !== "number" || !select.options) {
    return "";
  }

  const option = select.options[select.selectedIndex];
  return option ? option.textContent || "" : "";
}

export function getLegacyEl(id) {
  return document.getElementById(id);
}

export function bindClickProxy(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!v3) {
    return;
  }
  markBridgeTarget(v3, "click", legacyId);

  v3.addEventListener("click", () => {
    const legacy = getLegacyEl(legacyId);
    if (legacy && typeof legacy.click === "function") {
      legacy.click();
    }
  });
}

export function syncButtonDisabled(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = getLegacyEl(legacyId);
  if (!(v3 instanceof HTMLButtonElement) || !(legacy instanceof HTMLElement)) {
    return;
  }

  const supportsDisabled =
    legacy instanceof HTMLButtonElement ||
    legacy instanceof HTMLInputElement ||
    legacy instanceof HTMLSelectElement ||
    legacy instanceof HTMLTextAreaElement;
  const legacyDisabled = supportsDisabled ? legacy.disabled : legacy.getAttribute("disabled") !== null;
  v3.disabled = Boolean(legacyDisabled);
}

export function syncSelectOptions(target, source) {
  const sourceValues = Array.from(source.options).map((opt) => `${opt.value}::${opt.text}`);
  const targetValues = Array.from(target.options).map((opt) => `${opt.value}::${opt.text}`);
  if (sourceValues.length === targetValues.length && sourceValues.every((v, i) => v === targetValues[i])) {
    return;
  }

  target.innerHTML = "";
  Array.from(source.options).forEach((opt) => {
    const next = document.createElement("option");
    next.value = opt.value;
    next.textContent = opt.textContent || "";
    target.appendChild(next);
  });
}

export function bindSelectProxy(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLSelectElement)) {
    return;
  }
  markBridgeTarget(v3, "select", legacyId);

  v3.addEventListener("change", () => {
    const legacy = getLegacyEl(legacyId);
    if (!(legacy instanceof HTMLSelectElement)) {
      return;
    }
    legacy.value = v3.value;
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function bindFieldProxy(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement || v3 instanceof HTMLTextAreaElement)) {
    return;
  }
  markBridgeTarget(v3, "field", legacyId);

  v3.addEventListener("input", () => {
    const legacy = getLegacyEl(legacyId);
    if (!(legacy instanceof HTMLInputElement || legacy instanceof HTMLTextAreaElement)) {
      return;
    }
    legacy.value = v3.value;
    legacy.dispatchEvent(new Event("input", { bubbles: true }));
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function bindCheckboxProxy(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  if (!(v3 instanceof HTMLInputElement)) {
    return;
  }
  markBridgeTarget(v3, "checkbox", legacyId);

  v3.addEventListener("change", () => {
    const legacy = getLegacyEl(legacyId);
    if (!(legacy instanceof HTMLInputElement)) {
      return;
    }
    legacy.checked = v3.checked;
    legacy.dispatchEvent(new Event("input", { bubbles: true }));
    legacy.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function syncSelectValue(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = getLegacyEl(legacyId);
  if (!(v3 instanceof HTMLSelectElement) || !(legacy instanceof HTMLSelectElement)) {
    return;
  }
  if (document.activeElement === v3) {
    return;
  }

  syncSelectOptions(v3, legacy);
  v3.value = legacy.value;
}

export function syncFieldValue(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = getLegacyEl(legacyId);
  if (
    !(v3 instanceof HTMLInputElement || v3 instanceof HTMLTextAreaElement) ||
    !(legacy instanceof HTMLInputElement || legacy instanceof HTMLTextAreaElement)
  ) {
    return;
  }
  if (document.activeElement === v3) {
    return;
  }

  v3.value = legacy.value;
}

export function syncCheckboxValue(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = getLegacyEl(legacyId);
  if (!(v3 instanceof HTMLInputElement) || !(legacy instanceof HTMLInputElement)) {
    return;
  }
  if (document.activeElement === v3) {
    return;
  }

  v3.checked = legacy.checked;
}

export function syncControlDisabled(v3Id, legacyId) {
  const v3 = document.getElementById(v3Id);
  const legacy = getLegacyEl(legacyId);

  const v3Control =
    v3 instanceof HTMLInputElement ||
    v3 instanceof HTMLSelectElement ||
    v3 instanceof HTMLTextAreaElement ||
    v3 instanceof HTMLButtonElement;
  const legacyControl =
    legacy instanceof HTMLInputElement ||
    legacy instanceof HTMLSelectElement ||
    legacy instanceof HTMLTextAreaElement ||
    legacy instanceof HTMLButtonElement;

  if (!v3Control || !legacyControl) {
    return;
  }

  v3.disabled = legacy.disabled;
}

export function syncLegacyListItems({
  sourceSelector,
  targetId,
  emptyItem = "No items.",
  itemSelector = ":scope > li"
}) {
  const source = document.querySelector(sourceSelector);
  const target = document.getElementById(targetId);
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    return 0;
  }

  target.innerHTML = "";
  let count = 0;
  const items = Array.from(source.querySelectorAll(itemSelector));
  items.forEach((sourceItem) => {
    if (!(sourceItem instanceof HTMLElement)) {
      return;
    }
    const li = document.createElement("li");
    li.innerHTML = sourceItem.innerHTML;
    target.appendChild(li);
    count += 1;
  });

  if (!count) {
    const li = document.createElement("li");
    li.textContent = emptyItem;
    li.classList.add("fpe-empty-state");
    target.appendChild(li);
  }

  return count;
}

export function syncLegacyTableRows({
  sourceSelector,
  targetBodyId,
  expectedCols = 1,
  emptyLabel = "No rows.",
  numericColumns = null
}) {
  const source = document.querySelector(sourceSelector);
  const target = document.getElementById(targetBodyId);
  if (!(target instanceof HTMLElement)) {
    return 0;
  }

  target.innerHTML = "";
  const sourceRows = source ? Array.from(source.querySelectorAll(":scope > tr")) : [];
  const expected = Math.max(1, Number(expectedCols) || 1);
  const numericSet = Array.isArray(numericColumns)
    ? new Set(numericColumns.map((idx) => Number(idx)).filter((idx) => Number.isFinite(idx)))
    : null;

  let appended = 0;
  sourceRows.forEach((sourceRow) => {
    if (!(sourceRow instanceof HTMLTableRowElement)) {
      return;
    }
    const sourceCells = Array.from(sourceRow.children).filter((cell) => cell instanceof HTMLTableCellElement);
    if (!sourceCells.length) {
      return;
    }

    const tr = document.createElement("tr");
    sourceCells.forEach((cell, index) => {
      const td = document.createElement("td");
      td.innerHTML = cell.innerHTML || "—";
      if (cell.classList.contains("num")) {
        td.classList.add("num");
      }
      const shouldBeNumeric = numericSet
        ? numericSet.has(index)
        : index > 0 && index < expected - 1;
      if (shouldBeNumeric) {
        td.classList.add("num");
      }

      td.querySelectorAll("button").forEach((btn) => {
        btn.className = "fpe-btn fpe-btn--ghost";
      });
      tr.appendChild(td);
    });

    while (tr.children.length < expected) {
      const td = document.createElement("td");
      td.textContent = "—";
      td.className = "muted";
      tr.appendChild(td);
    }

    target.appendChild(tr);
    appended += 1;
  });

  if (!appended) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = expected;
    td.textContent = emptyLabel;
    td.className = "fpe-empty-state";
    tr.classList.add("fpe-empty-row");
    tr.appendChild(td);
    target.appendChild(tr);
  }

  return appended;
}

export function normalizeSurfaceActionRows(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const candidates = root.querySelectorAll(
    ".note, .help-text, .muted, .rowline, .card-actions, .wkActionBar, .integrity-actions, .scm-actions"
  );

  candidates.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.dataset.v3ActionNormalized === "1") {
      return;
    }
    if (node.closest(".fpe-action-row")) {
      return;
    }

    const hasFormControls = node.querySelector(
      "input:not([type='button']):not([type='submit']), select, textarea"
    );
    const childNodes = Array.from(node.childNodes).filter((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return Boolean((child.textContent || "").trim());
      }
      return true;
    });

    const actionNodes = [];
    const contentNodes = [];

    childNodes.forEach((child) => {
      if (isActionNode(child)) {
        actionNodes.push(child);
        return;
      }
      contentNodes.push(child);
    });

    if (!actionNodes.length) {
      return;
    }

    node.dataset.v3ActionNormalized = "1";

    if (hasFormControls) {
      node.classList.add("fpe-action-row");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "fpe-action-group";

    if (contentNodes.length) {
      const content = document.createElement("div");
      content.className = "fpe-contained-block";
      contentNodes.forEach((item) => content.appendChild(item));
      wrapper.appendChild(content);
    }

    const actionRow = document.createElement("div");
    actionRow.className = "fpe-action-row";
    actionNodes.forEach((item) => actionRow.appendChild(item));
    wrapper.appendChild(actionRow);

    node.replaceWith(wrapper);
  });

  root.querySelectorAll(".fpe-action-row").forEach((row) => {
    if (!(row instanceof HTMLElement)) {
      return;
    }
    applyActionStripClass(row);
  });
}

function markBridgeTarget(el, kind, legacyId) {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  if (!legacyId) {
    return;
  }
  el.dataset.v3LegacyId = legacyId;
  el.dataset.v3BridgeKind = kind;
}

export function normalizeSurfaceMessages(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const candidates = root.querySelectorAll(
    [
      ".fpe-card__body > .muted",
      ".fpe-card__body > .note",
      ".fpe-card__body > .banner",
      ".fpe-census-section__body > .muted",
      ".fpe-census-section__body > .note",
      ".fpe-census-subsection__body > .muted",
      ".fpe-census-subsection__body > .note",
      ".fpe-census-subsection__body > .banner"
    ].join(",")
  );

  candidates.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.dataset.v3MessageNormalized === "1") {
      return;
    }
    if (node.closest(".fpe-message-window")) {
      return;
    }
    if (
      node.closest(
        ".field, .table-wrap, .fpe-action-row, .fpe-contained-block, .fpe-summary-grid, .fpe-census-status-chip"
      )
    ) {
      return;
    }

    const text = (node.textContent || "").trim();
    if (!text) {
      return;
    }

    // Do not wrap form/control groups as message windows.
    // Those should remain in regular card layout blocks.
    const hasControls = node.querySelector(
      "input, select, textarea, button, .btn, .fpe-btn, .switch"
    );
    if (hasControls) {
      return;
    }

    const tone = classifyMessageTone(text, node);
    const label = labelForTone(tone);
    const window = createMessageWindow(label, tone);
    const body = window.querySelector(".fpe-message-window__body");
    if (!(body instanceof HTMLElement) || !(node.parentElement instanceof HTMLElement)) {
      return;
    }

    node.dataset.v3MessageNormalized = "1";
    node.classList.add("fpe-message-window__text");
    node.parentElement.insertBefore(window, node);
    body.appendChild(node);
  });

  normalizeMessageWindowLists(root);
}

export function normalizeSurfaceBlocks(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  root.querySelectorAll(".fpe-contained-block").forEach((block) => {
    if (!(block instanceof HTMLElement)) {
      return;
    }
    if (block.dataset.v3BlockNormalized === "1") {
      return;
    }
    block.dataset.v3BlockNormalized = "1";

    if (block.querySelector("ul.bullets, ol.bullets")) {
      block.classList.add("fpe-contained-block--instruction");
      return;
    }

    const hasStatusShape =
      Boolean(block.querySelector(".fpe-control-label")) &&
      Boolean(block.querySelector(".fpe-help, .muted, .note")) &&
      !block.querySelector("input, select, textarea, button, .btn, .fpe-btn, .switch");

    if (hasStatusShape) {
      block.classList.add("fpe-contained-block--status");
    }
  });
}

export function normalizeSurfaceStatusPills(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const nodes = root.querySelectorAll(".tag, .badge, .fpe-card__status");
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.dataset.v3StatusPill === "1") {
      return;
    }
    node.dataset.v3StatusPill = "1";
    node.classList.add("fpe-status-pill");
    node.classList.remove(
      "fpe-status-pill--ok",
      "fpe-status-pill--warn",
      "fpe-status-pill--bad",
      "fpe-status-pill--neutral"
    );

    const tone = classifyStatusTone(node);
    node.classList.add(`fpe-status-pill--${tone}`);
  });
}

export function normalizeSurfaceEmptyStates(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  root.querySelectorAll("tbody tr").forEach((row) => {
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    if (row.children.length !== 1) {
      return;
    }
    const cell = row.children[0];
    if (!(cell instanceof HTMLTableCellElement)) {
      return;
    }
    if (cell.colSpan < 2) {
      return;
    }

    const text = (cell.textContent || "").trim();
    if (isEmptyStateText(text)) {
      row.classList.add("fpe-empty-row");
      cell.classList.add("fpe-empty-state");
    }
  });
}

export function normalizeSurfaceInstructionPanels(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const panels = root.querySelectorAll("details");
  panels.forEach((panel) => {
    if (!(panel instanceof HTMLDetailsElement)) {
      return;
    }

    const summary = panel.querySelector(":scope > summary");
    if (!(summary instanceof HTMLElement)) {
      return;
    }

    const summaryText = (summary.textContent || "").trim().toLowerCase();
    if (!/instruction|workflow|guide/.test(summaryText)) {
      return;
    }

    if (panel.dataset.v3InstructionNormalized === "1") {
      return;
    }
    panel.dataset.v3InstructionNormalized = "1";

    panel.classList.add("fpe-instructions");
    summary.classList.add("fpe-instructions__summary");

    const labelText = (summary.textContent || "").trim() || "Instructions";
    summary.textContent = "";
    const label = document.createElement("span");
    label.className = "fpe-instructions__label";
    label.textContent = labelText;
    summary.appendChild(label);

    let body = panel.querySelector(":scope > .fpe-instructions__body");
    if (!(body instanceof HTMLElement)) {
      body = document.createElement("div");
      body.className = "fpe-instructions__body";
      const children = Array.from(panel.children).filter((child) => child !== summary);
      children.forEach((child) => body.appendChild(child));
      panel.appendChild(body);
    }
  });
}

function createMessageWindow(label, tone) {
  const root = document.createElement("div");
  root.className = `fpe-message-window fpe-message-window--${tone}`;

  const head = document.createElement("div");
  head.className = "fpe-message-window__head";

  const tag = document.createElement("span");
  tag.className = "fpe-message-window__tag";
  tag.textContent = label;

  head.appendChild(tag);

  const body = document.createElement("div");
  body.className = "fpe-message-window__body";

  root.append(head, body);
  return root;
}

function labelForTone(tone) {
  if (tone === "warn") {
    return "Warning";
  }
  if (tone === "tip") {
    return "Tip";
  }
  if (tone === "status") {
    return "Status";
  }
  return "Info";
}

function classifyMessageTone(text, node) {
  const source = `${node.id || ""} ${node.className || ""} ${text}`.toLowerCase();

  if (
    /warn|warning|invalid|missing|error|fail|incomplete|not set|stale|risk|shortfall|required|pending/.test(source)
  ) {
    return "warn";
  }
  if (/tip|guide|how to|best practice|workflow|instructions|recommended/.test(source)) {
    return "tip";
  }
  if (/status|ready|loaded|selected|last fetch|active|enabled|disabled|coverage|delta|using/.test(source)) {
    return "status";
  }
  return "info";
}

function classifyStatusTone(node) {
  const source = `${node.className || ""} ${(node.textContent || "").trim()}`.toLowerCase();

  if (/(^|\s)(bad|error|critical|high-risk|red)(\s|$)/.test(source)) {
    return "bad";
  }
  if (/(^|\s)(warn|warning|yellow|caution|pending|binding|risk)(\s|$)/.test(source)) {
    return "warn";
  }
  if (/(^|\s)(ok|green|clear|ready|healthy|balanced|low)(\s|$)/.test(source)) {
    return "ok";
  }
  return "neutral";
}

function isEmptyStateText(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized === "-" || normalized === "—") {
    return true;
  }
  return (
    normalized.startsWith("no ") ||
    normalized.startsWith("not ") ||
    normalized.includes("no rows") ||
    normalized.includes("no records") ||
    normalized.includes("not loaded") ||
    normalized.includes("run snapshot")
  );
}

function normalizeMessageWindowLists(root) {
  const bodies = root.querySelectorAll(".fpe-message-window__body");
  bodies.forEach((body) => {
    if (!(body instanceof HTMLElement)) {
      return;
    }
    if (body.dataset.v3ListNormalized === "1") {
      return;
    }

    const hasStructuredContent = body.querySelector(
      "ul, ol, table, .table-wrap, .fpe-field-grid, .grid2, .grid3, .grid4, .subgrid, .field"
    );
    if (hasStructuredContent) {
      body.dataset.v3ListNormalized = "1";
      return;
    }

    const candidates = Array.from(body.children).filter(
      (child) =>
        child instanceof HTMLElement &&
        child.matches(
          ".fpe-message-window__text, .note, .muted, .banner, p, div, span"
        )
    );

    let converted = false;
    candidates.forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) {
        return;
      }
      if (candidate.querySelector("ul, ol, table, .table-wrap")) {
        return;
      }

      const lines = (candidate.textContent || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        return;
      }

      const list = document.createElement("ul");
      list.className = "fpe-status-list";
      lines.forEach((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        list.appendChild(item);
      });

      candidate.replaceWith(list);
      converted = true;
    });

    if (!converted) {
      const lines = (body.textContent || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length > 1) {
        body.textContent = "";
        const list = document.createElement("ul");
        list.className = "fpe-status-list";
        lines.forEach((line) => {
          const item = document.createElement("li");
          item.textContent = line;
          list.appendChild(item);
        });
        body.appendChild(list);
      }
    }

    body.dataset.v3ListNormalized = "1";
  });
}

function applyActionStripClass(row) {
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const hasAction = Boolean(
    row.querySelector("button, .btn, .fpe-btn, a.btn, input[type='button'], input[type='submit']")
  );
  if (!hasAction) {
    return;
  }

  const hasStatusText = Boolean(row.querySelector(".help, .help-text, .muted, .note, .mini-s"));
  if (!hasStatusText) {
    return;
  }

  row.classList.add("fpe-action-strip");
}

function isActionNode(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  return node.matches(
    "button, .btn, .fpe-btn, a.btn, input[type='button'], input[type='submit']"
  );
}
