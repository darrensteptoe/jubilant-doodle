import { classifyUnifiedStatusTone } from "../../core/statusTone.js";

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

export function countSelectOptions(selectOrId, { excludeFirst = false } = {}) {
  const candidate = typeof selectOrId === "string"
    ? document.getElementById(selectOrId)
    : selectOrId;
  if (!(candidate instanceof HTMLSelectElement)) {
    return 0;
  }
  const offset = excludeFirst ? 1 : 0;
  return Math.max(0, candidate.options.length - offset);
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
  if (node.classList.contains("is-bad") || node.dataset.statusTone === "bad") {
    return "bad";
  }
  if (node.classList.contains("is-warn") || node.dataset.statusTone === "warn") {
    return "warn";
  }
  if (node.classList.contains("is-good") || node.dataset.statusTone === "ok") {
    return "ok";
  }
  const source = `${node.className || ""} ${(node.textContent || "").trim()}`.toLowerCase();
  return classifyUnifiedStatusTone(source);
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
