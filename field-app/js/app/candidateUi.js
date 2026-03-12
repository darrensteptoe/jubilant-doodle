// @ts-check
/**
 * @typedef {Record<string, any>} AnyState
 * @typedef {{
 *   els: Record<string, any>,
 *   getState: () => AnyState,
 *   safeNum: (v: any) => number | null,
 *   commitUIUpdate: (opts?: Record<string, any>) => void,
 * }} CandidateUiControllerDeps
 */

/**
 * @param {CandidateUiControllerDeps=} deps
 */
export function createCandidateUiController(deps = {}){
  const {
    els,
    getState,
    safeNum,
    commitUIUpdate,
  } = deps || {};

  function rebuildYourCandidateSelect(){
    const state = getState();
    els.yourCandidate.innerHTML = "";
    for (const cand of state.candidates){
      const opt = document.createElement("option");
      opt.value = cand.id;
      opt.textContent = cand.name || "Candidate";
      els.yourCandidate.appendChild(opt);
    }
    if (!state.yourCandidateId){
      state.yourCandidateId = state.candidates[0]?.id || null;
    }
    els.yourCandidate.value = state.yourCandidateId || "";
  }

  function rebuildUserSplitInputs(){
    const state = getState();
    const isUser = state.undecidedMode === "user_defined";
    els.userSplitWrap.hidden = !isUser;
    if (!isUser) return;

    els.userSplitList.innerHTML = "";
    for (const cand of state.candidates){
      if (state.userSplit[cand.id] == null) state.userSplit[cand.id] = 0;
      const row = document.createElement("div");
      row.className = "grid2";
      row.style.gridTemplateColumns = "1fr 120px";

      const name = document.createElement("div");
      name.className = "label";
      name.style.alignSelf = "center";
      name.textContent = cand.name || "Candidate";

      const inp = document.createElement("input");
      inp.className = "input input-sm num";
      inp.type = "number";
      inp.min = "0";
      inp.max = "100";
      inp.step = "0.1";
      inp.value = state.userSplit[cand.id] ?? 0;
      inp.addEventListener("input", () => {
        const src = getState();
        src.userSplit[cand.id] = safeNum(inp.value);
        commitUIUpdate();
      });

      row.appendChild(name);
      row.appendChild(inp);
      els.userSplitList.appendChild(row);
    }
  }

  function rebuildCandidateTable(){
    const state = getState();
    els.candTbody.innerHTML = "";

    for (const cand of state.candidates){
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      const nameInput = document.createElement("input");
      nameInput.className = "input input-sm";
      nameInput.value = cand.name || "";
      nameInput.addEventListener("input", () => {
        const src = getState();
        cand.name = nameInput.value;
        if (!src.userSplit[cand.id]) src.userSplit[cand.id] = 0;
        rebuildYourCandidateSelect();
        rebuildUserSplitInputs();
        commitUIUpdate();
      });
      tdName.appendChild(nameInput);

      const tdPct = document.createElement("td");
      tdPct.className = "num";
      const pctInput = document.createElement("input");
      pctInput.className = "input input-sm num";
      pctInput.type = "number";
      pctInput.min = "0";
      pctInput.max = "100";
      pctInput.step = "0.1";
      pctInput.value = cand.supportPct ?? "";
      pctInput.addEventListener("input", () => {
        cand.supportPct = safeNum(pctInput.value);
        commitUIUpdate();
      });
      tdPct.appendChild(pctInput);

      const tdDel = document.createElement("td");
      tdDel.className = "num";
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-sm btn-ghost";
      delBtn.type = "button";
      delBtn.textContent = "Remove";
      delBtn.disabled = state.candidates.length <= 2;
      delBtn.addEventListener("click", () => {
        const src = getState();
        if (src.candidates.length <= 2) return;
        src.candidates = src.candidates.filter((c) => c.id !== cand.id);
        delete src.userSplit[cand.id];
        if (src.yourCandidateId === cand.id){
          src.yourCandidateId = src.candidates[0]?.id || null;
        }
        rebuildCandidateTable();
        rebuildYourCandidateSelect();
        rebuildUserSplitInputs();
        commitUIUpdate();
      });
      tdDel.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdPct);
      tr.appendChild(tdDel);
      els.candTbody.appendChild(tr);
    }

    rebuildYourCandidateSelect();
    rebuildUserSplitInputs();
  }

  return {
    rebuildCandidateTable,
    rebuildYourCandidateSelect,
    rebuildUserSplitInputs,
  };
}
