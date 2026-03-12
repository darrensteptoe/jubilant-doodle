export function wireV3Nav(onNavigate) {
  document.querySelectorAll(".fpe-nav__item[data-v3-stage]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const stageId = btn.dataset.v3Stage;
      if (!stageId) {
        return;
      }
      onNavigate(stageId);
    });
  });
}
