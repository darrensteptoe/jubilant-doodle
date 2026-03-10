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
