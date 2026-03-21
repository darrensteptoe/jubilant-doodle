export function renderDistrictCensusCard({ censusCard, getCardBody, renderDistrictCensusProxyShell }) {
  const censusBody = getCardBody(censusCard);
  renderDistrictCensusProxyShell({ target: censusBody });
}
