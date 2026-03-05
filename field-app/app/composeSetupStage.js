export function composeSetupStageModule(){
  const setupStage = document.getElementById("stage-setup");
  const setupBody = setupStage?.querySelector(":scope > .stage-body-new");
  if (!setupBody) return;

  const setupNavLabel = document.querySelector('.nav-item-new[data-stage="setup"] .nav-label-new');
  if (setupNavLabel) setupNavLabel.textContent = "Set up";
  const setupTitle = setupStage.querySelector(":scope > .stage-header-new .stage-title-new");
  if (setupTitle) setupTitle.textContent = "Set up";

  const ensureCard = (id) => {
    let card = document.getElementById(id);
    if (!card){
      card = document.createElement("div");
      card.className = "card card-section";
      card.id = id;
    }
    return card;
  };

  const moduleSourceByInput = (inputId) => {
    const input = document.getElementById(inputId);
    return input?.closest(".card") || null;
  };

  const makeHeader = (title, subtitle) => {
    const head = document.createElement("div");
    head.className = "card-head card-header";
    const h2 = document.createElement("h2");
    h2.className = "card-title";
    h2.textContent = title;
    head.appendChild(h2);
    if (subtitle){
      const text = document.createElement("div");
      text.className = "help-text";
      text.textContent = subtitle;
      head.appendChild(text);
    }
    return head;
  };

  const ensureSingleHeader = (card, sourceHeader, fallbackTitle, fallbackSubtitle) => {
    let header = sourceHeader || card.querySelector(":scope > .card-head.card-header");
    if (!header){
      header = makeHeader(fallbackTitle, fallbackSubtitle);
    }

    const existing = Array.from(card.querySelectorAll(":scope > .card-head.card-header"));
    for (const h of existing){
      if (h !== header) h.remove();
    }
    if (card.firstElementChild !== header){
      card.insertBefore(header, card.firstChild);
    }

    const inlineHelp = header.querySelector(":scope > .help-text");
    const descHtml = (inlineHelp?.innerHTML || fallbackSubtitle || "").trim();
    if (inlineHelp) inlineHelp.remove();

    if (descHtml){
      let desc = card.querySelector(":scope > .module-desc, :scope > .help-text");
      if (!desc){
        desc = document.createElement("div");
        desc.className = "module-desc";
        header.insertAdjacentElement("afterend", desc);
      } else if (desc.classList.contains("help-text")){
        desc.classList.remove("help-text");
        desc.classList.add("module-desc");
      }
      if (!desc.innerHTML || !desc.textContent?.trim()){
        desc.innerHTML = descHtml;
      }
    }
  };

  const ensureDivider = (id) => {
    let hr = document.getElementById(id);
    if (!hr){
      hr = document.createElement("hr");
      hr.id = id;
      hr.className = "setup-divider";
      hr.setAttribute("aria-hidden", "true");
    }
    return hr;
  };

  const raceCard = setupBody.querySelector(".phase-setup");
  const raceGrid = document.getElementById("raceType")?.closest(".grid2");
  if (raceCard){
    ensureSingleHeader(
      raceCard,
      raceCard.querySelector(":scope > .card-head.card-header"),
      "Race setup",
      "Set race context, timing, and operating mode. This frame drives downstream calculations."
    );
    if (raceGrid && raceGrid.parentElement !== raceCard){
      raceCard.appendChild(raceGrid);
    }
  }

  const universeSource = moduleSourceByInput("universeSize");
  const universeCard = universeSource || ensureCard("setupUniverseModule");
  const universeHeader = universeSource?.querySelector(":scope > .card-head.card-header") || universeSource?.querySelector(".card-head.card-header");
  const universeGrid = document.getElementById("universeSize")?.closest(".grid2");
  ensureSingleHeader(
    universeCard,
    universeHeader,
    "Universe",
    "Define electorate size and source basis; every vote, cost, and target scales from this."
  );
  if (universeGrid) universeCard.appendChild(universeGrid);

  const persuadableSource = moduleSourceByInput("persuasionPct");
  const persuadableCard = persuadableSource || ensureCard("setupPersuadableModule");
  const persuadableHeader = persuadableSource?.querySelector(":scope > .card-head.card-header") || persuadableSource?.querySelector(".card-head.card-header");
  const persuadableGrid = document.getElementById("persuasionPct")?.closest(".grid2");
  ensureSingleHeader(
    persuadableCard,
    persuadableHeader,
    "Persuadable universe (movable)",
    "Set the movable universe and expected early-vote share to size persuasion workload."
  );
  if (persuadableGrid) persuadableCard.appendChild(persuadableGrid);

  const electorateSource = moduleSourceByInput("universe16Enabled");
  const electorateCard = electorateSource || ensureCard("setupElectorateModule");
  const electorateHeader = electorateSource?.querySelector(":scope > .card-head.card-header") || electorateSource?.querySelector(".card-head.card-header");
  const electorateDetails = electorateSource?.querySelector(":scope > details") || electorateSource?.querySelector("details");
  const electorateNote = electorateSource?.querySelector(":scope > .note:last-of-type") || electorateSource?.querySelector(".note");
  ensureSingleHeader(
    electorateCard,
    electorateHeader,
    "Electorate Weighting",
    "Optional realism layer: apply coalition weighting and support retention. OFF = baseline."
  );
  if (electorateDetails){
    electorateDetails.open = true;
    const summary = electorateDetails.querySelector("summary");
    if (summary) summary.remove();
    electorateDetails.classList.add("no-dropdown-details");
    electorateCard.appendChild(electorateDetails);
  }
  if (electorateNote) electorateCard.appendChild(electorateNote);

  const ballotSource = moduleSourceByInput("yourCandidate");
  // Reuse the source card when available so we don't strand an empty
  // top-level wrapper in the original stage.
  const ballotCard = ballotSource || ensureCard("setupBallotModule");
  const ballotHeader = ballotSource?.querySelector(":scope > .card-head.card-header") || ballotSource?.querySelector(".card-head.card-header");
  const ballotWhoField = document.getElementById("yourCandidate")?.closest(".field");
  const ballotTable = document.getElementById("candTbody")?.closest(".table-wrap");
  const ballotModeGrid = document.getElementById("undecidedMode")?.closest(".grid2");
  const ballotWarn = document.getElementById("candWarn");
  ensureSingleHeader(
    ballotCard,
    ballotHeader,
    "Ballot & persuasion baseline",
    "Set candidate support and undecided allocation. This anchors persuasion math."
  );
  if (ballotWhoField) ballotCard.appendChild(ballotWhoField);
  if (ballotTable) ballotCard.appendChild(ballotTable);
  if (ballotModeGrid) ballotCard.appendChild(ballotModeGrid);
  if (ballotWarn) ballotCard.appendChild(ballotWarn);

  const turnoutCard = document.querySelector("#stage-ballot .phase-p3")
    || document.getElementById("setupTurnoutBaselineModule");
  if (turnoutCard){
    if (!turnoutCard.id) turnoutCard.id = "setupTurnoutBaselineModule";
    ensureSingleHeader(
      turnoutCard,
      turnoutCard.querySelector(":scope > .card-head.card-header"),
      "Turnout baseline (recent comparable cycles)",
      "Use two comparable cycles to set expected turnout and uncertainty band."
    );
  }

  const hasBodyContent = (node) => {
    if (!node) return false;
    return node.childElementCount > 0;
  };

  const order = [
    raceCard,
    ensureDivider("setup-divider-1"),
    universeCard,
    persuadableCard,
    ensureDivider("setup-divider-2"),
    electorateCard,
    ensureDivider("setup-divider-3"),
    ballotCard,
    ensureDivider("setup-divider-4"),
    turnoutCard
  ];

  for (const node of order){
    if (!node) continue;
    const isDivider = node.classList?.contains("setup-divider");
    if (!isDivider && !hasBodyContent(node)) continue;
    setupBody.appendChild(node);
  }
}
