export function renderValidationModule(args){
  const {
    els,
    state,
    res,
    weeks,
  } = args || {};

  const list = els?.validationList || els?.validationListSidebar;
  if (!list) return;
  const items = [];

  const uOk = res.validation.universeOk;
  items.push({
    kind: uOk ? "ok" : "bad",
    text: uOk ? "Universe size set." : "Universe size missing or invalid."
  });

  const turnoutOk = res.validation.turnoutOk;
  items.push({
    kind: turnoutOk ? "ok" : "warn",
    text: turnoutOk ? "Turnout baseline set (2 cycles + band)." : "Turnout baseline incomplete. Add Cycle A and Cycle B turnout %."
  });

  const candOk = res.validation.candidateTableOk;
  items.push({
    kind: candOk ? "ok" : "bad",
    text: candOk ? "Candidate + undecided totals = 100%." : "Candidate + undecided totals must equal 100%."
  });

  const splitOk = res.validation.userSplitOk;
  if (state.undecidedMode === "user_defined"){
    items.push({
      kind: splitOk ? "ok" : "bad",
      text: splitOk ? "User-defined undecided split totals = 100%." : "User-defined undecided split must total 100% across candidates."
    });
  }

  const persOk = res.validation.persuasionOk;
  items.push({
    kind: persOk ? "ok" : "warn",
    text: persOk ? "Persuasion % set." : "Persuasion % missing."
  });

  if (weeks != null){
    items.push({
      kind: "ok",
      text: `Weeks remaining: ${weeks} (reference for later phases).`
    });
  }

  const seen = new Set();
  const deduped = [];
  for (const it of items){
    const key = `${it.kind}::${it.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  list.innerHTML = "";
  for (const it of deduped){
    const li = document.createElement("li");
    li.className = it.kind;
    li.textContent = it.text;
    list.appendChild(li);
  }
}
