export function normalizeStageLayoutModule(){
  const main = document.querySelector(".stage-main-new");
  if (!main) return;
  const stages = Array.from(main.querySelectorAll(".stage-new"));
  for (const stage of stages){
    const header = stage.querySelector(":scope > .stage-header-new") || stage.querySelector(".stage-header-new");
    const body = stage.querySelector(":scope > .stage-body-new") || stage.querySelector(".stage-body-new");

    if (header && stage.firstElementChild !== header){
      stage.insertBefore(header, stage.firstChild);
    }
    if (header && body){
      if (header.nextElementSibling !== body){
        stage.insertBefore(body, header.nextSibling);
      }
    }

    if (body){
      const kids = Array.from(stage.children);
      for (const kid of kids){
        if (kid === header || kid === body) continue;
        body.appendChild(kid);
      }

      // Normalize legacy "loose module" blocks:
      // If a stage body contains a top-level card header not wrapped in a card,
      // wrap that header and its following content until the next module start.
      // This keeps module width/spacing consistent across all stages.
      let cursor = body.firstElementChild;
      while (cursor){
        const nextTop = cursor.nextElementSibling;
        const isLooseHeader = cursor.matches?.(".card-head.card-header");
        if (!isLooseHeader){
          cursor = nextTop;
          continue;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "card card-section module-auto";
        body.insertBefore(wrapper, cursor);

        let node = cursor;
        while (node){
          const next = node.nextElementSibling;
          wrapper.appendChild(node);
          if (!next) break;
          const startsNextModule =
            next.matches?.(".card-head.card-header") ||
            (next.classList?.contains("card") && !next.classList?.contains("module-auto"));
          if (startsNextModule) break;
          node = next;
        }

        cursor = wrapper.nextElementSibling;
      }
    }
  }
}
