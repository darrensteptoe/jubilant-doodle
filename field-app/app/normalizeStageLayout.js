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
    }
  }
}
