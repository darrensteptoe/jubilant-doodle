import { buildModelInputFromState } from "./modelInput.js";

export function initDevToolsPanel({
  state,
  engine,
  isDevMode,
  derivedWeeksRemaining,
  safeNum,
  deriveNeedVotes,
  getSelfTestAccessors,
  updateSelfTestGateStatus,
  renderRiskSummaryIntoStress,
  fmtInt
}){
  if (!isDevMode()) return;

  const host = document.createElement("div");
  host.className = "devtools";
  host.setAttribute("data-devtools", "1");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "devtools-btn";
  btn.textContent = "Run Self-Test";

  const btnRisk = document.createElement("button");
  btnRisk.type = "button";
  btnRisk.className = "devtools-btn";
  btnRisk.textContent = "Risk Summary";

  const btnRobust = document.createElement("button");
  btnRobust.type = "button";
  btnRobust.className = "devtools-btn";
  btnRobust.textContent = "Robust (Smoke)";

  const panel = document.createElement("div");
  panel.className = "devtools-panel";
  panel.hidden = true;

  const FPE_LAST_GOOD_KEY = "fpe_lastGood";

  const safeJsonParse = (s) => {
    try{ return JSON.parse(s); } catch { return null; }
  };

  const formatWhen = (ts) => {
    try{
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return "";
    }
  };

  const diffFlat = (a, b, prefix="") => {
    const diffs = [];
    const isObj = (v) => (v && typeof v === "object" && !Array.isArray(v));
    if (Array.isArray(a) || Array.isArray(b)){
      const sa = JSON.stringify(a);
      const sb = JSON.stringify(b);
      if (sa !== sb) diffs.push({ path: prefix || "(root)", a: sa, b: sb });
      return diffs;
    }
    if (!isObj(a) || !isObj(b)){
      if (a !== b) diffs.push({ path: prefix || "(root)", a, b });
      return diffs;
    }
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    for (const k of keys){
      const p = prefix ? `${prefix}.${k}` : k;
      const va = a[k];
      const vb = b[k];
      if (isObj(va) && isObj(vb)){
        diffs.push(...diffFlat(va, vb, p));
      } else if (Array.isArray(va) || Array.isArray(vb)){
        diffs.push(...diffFlat(va, vb, p));
      } else if (va !== vb){
        diffs.push({ path: p, a: va, b: vb });
      }
      if (diffs.length >= 12) break;
    }
    return diffs;
  };

  const renderResult = (r) => {
    panel.hidden = false;
    panel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "devtools-head";
    const status = (r.failed && r.failed > 0) ? "FAIL" : "PASS";

    updateSelfTestGateStatus(r);
    head.textContent = `Self-Test: ${status} — ${r.passed}/${r.total} passed${r.durationMs != null ? ` (${r.durationMs}ms)` : ""}`;
    panel.appendChild(head);

    let lastGood = null;
    try{ lastGood = safeJsonParse(localStorage.getItem(FPE_LAST_GOOD_KEY) || ""); } catch {}

    const hasSig = !!(r && r.signature && r.signatureHash);
    if (status === "PASS" && hasSig){
      try{
        localStorage.setItem(FPE_LAST_GOOD_KEY, JSON.stringify({ ts: Date.now(), signature: r.signature, hash: r.signatureHash }));
        lastGood = { ts: Date.now(), signature: r.signature, hash: r.signatureHash };
      } catch {}
    }

    if (hasSig || lastGood){
      const meta = document.createElement("div");
      meta.className = "devtools-meta";

      const currentHash = hasSig ? r.signatureHash : null;
      const lastHash = lastGood?.hash || null;

      let line = "";
      if (lastGood?.ts){
        line += `Last good: ${formatWhen(lastGood.ts)}`;
      } else {
        line += "Last good: (none)";
      }
      if (lastHash){
        line += ` · fixture ${String(lastHash)}`;
      }
      if (currentHash){
        line += ` · current ${String(currentHash)}`;
      }
      if (lastHash && currentHash){
        line += (lastHash === currentHash) ? " · no drift" : " · DRIFT";
      }
      meta.textContent = line;

      renderRiskSummaryIntoStress(`Self-Test: ${status} — ${r.passed}/${r.total} passed${r.durationMs != null ? ` (${r.durationMs}ms)` : ""}`, line);

      panel.appendChild(meta);

      if (lastGood?.signature && hasSig && lastHash && currentHash && lastHash !== currentHash){
        const diffs = diffFlat(lastGood.signature, r.signature);
        if (diffs.length){
          const dbox = document.createElement("div");
          dbox.className = "devtools-diff";
          const title = document.createElement("div");
          title.className = "devtools-diff-title";
          title.textContent = "Top drift diffs:";
          dbox.appendChild(title);
          const ul = document.createElement("ul");
          ul.className = "devtools-diff-list";
          for (const d of diffs){
            const li = document.createElement("li");
            li.textContent = `${d.path}: was ${String(d.a)} → now ${String(d.b)}`;
            ul.appendChild(li);
          }
          dbox.appendChild(ul);
          panel.appendChild(dbox);
        }
      }
    }

    if (r.failed && r.failures && r.failures.length){
      const ul = document.createElement("ul");
      ul.className = "devtools-failures";
      for (const f of r.failures){
        const li = document.createElement("li");
        li.textContent = `${f.name}: ${f.message}`;
        ul.appendChild(li);
      }
      panel.appendChild(ul);
    }
  };

  const renderRisk = (title, lines) => {
    panel.hidden = false;
    panel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "devtools-head";
    head.textContent = title || "Risk";
    panel.appendChild(head);

    const pre = document.createElement("div");
    pre.className = "mono";
    pre.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
    panel.appendChild(pre);
  };

  const buildCurrentMcContext = () => {
    const weeks = derivedWeeksRemaining();
    const modelInput = buildModelInputFromState(state, safeNum);
    const res = engine.computeAll(modelInput);
    const w = (weeks != null && weeks >= 0) ? weeks : null;
    const needVotes = deriveNeedVotes(res);
    return { res, weeks: w, needVotes };
  };

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Running…";
    try{
      const mod = await import("./selfTest.js");
      const runSelfTests = mod?.runSelfTests;
      if (typeof runSelfTests !== "function"){
        renderResult({ total: 1, passed: 0, failed: 1, failures:[{ name:"Loader", message:"runSelfTests() not found" }] });
      } else {
        const r = runSelfTests(getSelfTestAccessors());
        renderResult(r || { total: 1, passed: 0, failed: 1, failures:[{ name:"Runner", message:"No results returned" }] });
      }
    } catch (err){
      renderResult({ total: 1, passed: 0, failed: 1, failures:[{ name:"Exception", message: err?.message ? err.message : String(err) }] });
    } finally {
      btn.disabled = false;
      btn.textContent = "Run Self-Test";
    }
  });

  btnRisk.addEventListener("click", async () => {
    btnRisk.disabled = true;
    btnRisk.textContent = "Computing…";
    try{
      const { res, weeks, needVotes } = buildCurrentMcContext();
      const seed = state.mcSeed || "";
      const sim = engine.runMonteCarlo({ scenario: state, res, weeks, needVotes, runs: 10000, seed, includeMargins: true });
      const margins = sim?.margins || [];
      const s = engine.risk.summaryFromMargins(margins);
      const cvar10 = engine.risk.conditionalValueAtRisk(margins, 0.10);
      const var10 = engine.risk.valueAtRisk(margins, 0.10);

      const fmt = (x) => (typeof x === "number" && Number.isFinite(x)) ? x.toFixed(2) : "—";
      const pct = (x) => (typeof x === "number" && Number.isFinite(x)) ? (100*x).toFixed(1) + "%" : "—";

      renderRisk("Risk: margins (MC)", [
        `runs: ${s.runs}`,
        `probWin (margin>=0): ${pct(s.probWin)}`,
        `mean: ${fmt(s.mean)} · median: ${fmt(s.median)}`,
        `p10: ${fmt(s.p10)} · p25: ${fmt(s.p25)} · p75: ${fmt(s.p75)} · p90: ${fmt(s.p90)}`,
        `min: ${fmt(s.min)} · max: ${fmt(s.max)} · stdev: ${fmt(s.stdev)}`,
        `VaR10: ${fmt(var10)} · CVaR10: ${fmt(cvar10)}`,
      ]);
    } catch (err){
      renderRisk("Risk: error", err?.message ? err.message : String(err || "Error"));
    } finally {
      btnRisk.disabled = false;
      btnRisk.textContent = "Risk Summary";
    }
  });

  btnRobust.addEventListener("click", async () => {
    btnRobust.disabled = true;
    btnRobust.textContent = "Running…";
    try{
      const seed = state.mcSeed || "";
      const candidates = [
        { id: "A", label: "Plan A" },
        { id: "B", label: "Plan B" },
        { id: "C", label: "Plan C" },
      ];
      const mkMargins = (bias) => {
        const out = [];
        for (let i=0;i<200;i++) out.push((i - 100) * 0.1 + bias);
        return out;
      };
      const evaluateFn = (plan) => {
        const bias = (plan.id === "A") ? -2 : (plan.id === "B") ? 0 : 1;
        const margins = mkMargins(bias);
        return { margins, riskSummary: engine.risk.summaryFromMargins(margins) };
      };
      const picked = engine.robust.selectPlan({ candidates, evaluateFn, objective: "max_p25_margin", seed });
      const best = picked?.best;
      renderRisk("Robust: smoke", [
        "objective: max_p25_margin",
        `best: ${best?.plan?.label || "(none)"}`,
        `score: ${best?.score != null ? String(best.score) : "—"}`,
      ]);
    } catch (err){
      renderRisk("Robust: error", err?.message ? err.message : String(err || "Error"));
    } finally {
      btnRobust.disabled = false;
      btnRobust.textContent = "Robust (Smoke)";
    }
  });

  host.appendChild(btn);
  host.appendChild(btnRisk);
  host.appendChild(btnRobust);
  host.appendChild(panel);
  document.body.appendChild(host);
}
