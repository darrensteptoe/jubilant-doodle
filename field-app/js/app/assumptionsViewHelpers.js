// @ts-check
/**
 * @param {string} title
 * @param {HTMLElement[]} kvs
 * @returns {HTMLDivElement}
 */
export function blockModule(title, kvs){
  const div = document.createElement("div");
  div.className = "assump-block";
  const t = document.createElement("div");
  t.className = "assump-title";
  t.textContent = title;
  const body = document.createElement("div");
  body.className = "assump-body";
  for (const row of kvs) body.appendChild(row);
  div.appendChild(t);
  div.appendChild(body);
  return div;
}

/**
 * @param {string} k
 * @param {string} v
 * @returns {HTMLDivElement}
 */
export function kvModule(k, v){
  const row = document.createElement("div");
  row.className = "kv";
  const dk = document.createElement("div");
  dk.className = "k";
  dk.textContent = k;
  const dv = document.createElement("div");
  dv.className = "v";
  dv.textContent = v;
  row.appendChild(dk);
  row.appendChild(dv);
  return row;
}

/**
 * @param {string} v
 * @returns {string}
 */
export function labelTemplateModule(v){
  if (v === "federal") return "Federal (US House)";
  if (v === "municipal") return "Municipal / ward";
  if (v === "county") return "County / regional";
  return "State legislative";
}

/**
 * @param {string} v
 * @returns {string}
 */
export function labelUndecidedModeModule(v){
  if (v === "user_defined") return "User-defined split";
  if (v === "against") return "Conservative against you";
  if (v === "toward") return "Conservative toward you";
  return "Proportional";
}

/**
 * @param {Record<string, any>} state
 * @returns {string | null}
 */
export function getYourNameFromStateModule(state){
  const c = state.candidates.find(x => x.id === state.yourCandidateId);
  return c?.name || null;
}
