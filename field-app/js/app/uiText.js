export function setText(el, text){
  if (el) el.textContent = String(text ?? "");
}

export function setHidden(el, hidden){
  if (el) el.hidden = !!hidden;
}

export function setTextPair(a, b, text){
  setText(a, text);
  setText(b, text);
}

