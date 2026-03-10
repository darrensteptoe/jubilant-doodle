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
