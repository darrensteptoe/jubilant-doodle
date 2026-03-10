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
}

export function normalizeSurfaceMessages(root) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const candidates = root.querySelectorAll(
    [
      ".fpe-card__body > .muted",
      ".fpe-card__body > .note",
      ".fpe-card__body > .help-text",
      ".fpe-card__body > .help",
      ".fpe-card__body > .banner",
      ".fpe-census-section__body > .muted",
      ".fpe-census-section__body > .note",
      ".fpe-census-subsection__body > .muted",
      ".fpe-census-subsection__body > .note",
      ".fpe-census-subsection__body > .help-text",
      ".fpe-census-subsection__body > .help",
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

function isActionNode(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  return node.matches(
    "button, .btn, .fpe-btn, a.btn, input[type='button'], input[type='submit']"
  );
}
