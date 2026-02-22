export function wireInput(el, { event = "input", get, parse, set, after } = {}){
  if (!el) return;
  const getter = typeof get === "function" ? get : (x) => x.value;
  const parser = typeof parse === "function" ? parse : (v) => v;
  el.addEventListener(event, () => {
    const raw = getter(el);
    const val = parser(raw, el);
    if (typeof set === "function") set(val, el);
    if (typeof after === "function") after(val, el);
  });
}

export function wireSelect(el, opts = {}){
  wireInput(el, {
    event: opts.event || "change",
    get: (x) => String(x.value || ""),
    parse: opts.parse,
    set: opts.set,
    after: opts.after
  });
}

export function wireCheckbox(el, opts = {}){
  wireInput(el, {
    event: opts.event || "change",
    get: (x) => !!x.checked,
    parse: (v) => !!v,
    set: opts.set,
    after: opts.after
  });
}
