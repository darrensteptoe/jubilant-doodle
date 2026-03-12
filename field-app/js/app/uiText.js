// @ts-check
/**
 * @param {HTMLElement | null | undefined} el
 * @param {unknown} text
 * @returns {void}
 */
export function setText(el, text){
  if (el) el.textContent = String(text ?? "");
}

/**
 * @param {HTMLElement | null | undefined} el
 * @param {boolean} hidden
 * @returns {void}
 */
export function setHidden(el, hidden){
  if (el) el.hidden = !!hidden;
}

/**
 * @param {HTMLElement | null | undefined} a
 * @param {HTMLElement | null | undefined} b
 * @param {unknown} text
 * @returns {void}
 */
export function setTextPair(a, b, text){
  setText(a, text);
  setText(b, text);
}
