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
