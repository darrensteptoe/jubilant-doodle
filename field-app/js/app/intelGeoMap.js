// @ts-check

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = "&copy; OpenStreetMap contributors";
const DEFAULT_CENTER = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

const boundaryCache = new Map();
const boundaryPending = new Map();

export function resetIntelGeoBoundaryCache(geoid = ""){
  const id = str(geoid);
  if (!id){
    boundaryCache.clear();
    return;
  }
  boundaryCache.delete(id);
}

function str(v){
  return String(v == null ? "" : v).trim();
}

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, min, max){
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function asObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeStateFips(v){
  return str(v).replace(/\D+/g, "").slice(0, 2).padStart(2, "0");
}

function normalizeDistrict(v, len){
  return str(v).replace(/\D+/g, "").slice(0, len).padStart(len, "0");
}

function normalizeCountyFips(stateFips, countyFips){
  const county = str(countyFips).replace(/\D+/g, "");
  if (!county) return "";
  if (county.length >= 5) return county.slice(0, 5);
  const state = normalizeStateFips(stateFips);
  if (!state) return "";
  return `${state}${county.slice(0, 3).padStart(3, "0")}`;
}

function normalizePlaceFips(v){
  return str(v).replace(/\D+/g, "").slice(0, 5).padStart(5, "0");
}

function areaToGeoId(area){
  const type = str(area?.type).toUpperCase();
  const state = normalizeStateFips(area?.stateFips);
  if (type === "CD"){
    const district = normalizeDistrict(area?.district, 2);
    return state && district ? `50000US${state}${district}` : "";
  }
  if (type === "SLDU"){
    const district = normalizeDistrict(area?.district, 3);
    return state && district ? `61000US${state}${district}` : "";
  }
  if (type === "SLDL"){
    const district = normalizeDistrict(area?.district, 3);
    return state && district ? `62000US${state}${district}` : "";
  }
  if (type === "COUNTY"){
    const county = normalizeCountyFips(state, area?.countyFips);
    return county ? `05000US${county}` : "";
  }
  if (type === "PLACE"){
    const place = normalizePlaceFips(area?.placeFips);
    return state && place ? `16000US${state}${place}` : "";
  }
  return "";
}

function normalizeFeatureLike(input){
  if (!input) return null;
  const arc = normalizeArcGisFeatureCollection(input);
  if (arc) return arc;
  if (asObject(input) && input.type === "FeatureCollection" && Array.isArray(input.features)){
    return input.features.length ? input : null;
  }
  if (asObject(input) && input.type === "Feature" && asObject(input.geometry)){
    return { type: "FeatureCollection", features: [input] };
  }
  if (asObject(input) && asObject(input.geometry) && input.geometry.type){
    return { type: "FeatureCollection", features: [{ type: "Feature", geometry: input.geometry, properties: input.properties || {} }] };
  }
  if (asObject(input) && input.type && input.coordinates){
    return { type: "FeatureCollection", features: [{ type: "Feature", geometry: input, properties: {} }] };
  }
  return null;
}

function normalizeArcGisRing(ring){
  if (!Array.isArray(ring) || !ring.length) return null;
  const out = [];
  for (const pt of ring){
    const x = num(pt?.[0]);
    const y = num(pt?.[1]);
    if (x == null || y == null) continue;
    out.push([x, y]);
  }
  if (out.length < 4) return null;
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]){
    out.push([first[0], first[1]]);
  }
  return out;
}

function normalizeArcGisGeometry(geometry){
  if (!asObject(geometry)) return null;
  if (Number.isFinite(Number(geometry.x)) && Number.isFinite(Number(geometry.y))){
    return { type: "Point", coordinates: [Number(geometry.x), Number(geometry.y)] };
  }
  if (Array.isArray(geometry.rings) && geometry.rings.length){
    const rings = geometry.rings.map(normalizeArcGisRing).filter(Boolean);
    if (!rings.length) return null;
    return { type: "Polygon", coordinates: rings };
  }
  if (Array.isArray(geometry.paths) && geometry.paths.length){
    const paths = geometry.paths
      .map((path) => Array.isArray(path) ? path.map((pt) => [num(pt?.[0]), num(pt?.[1])]).filter((xy) => xy[0] != null && xy[1] != null) : [])
      .filter((path) => path.length >= 2);
    if (!paths.length) return null;
    return { type: "MultiLineString", coordinates: paths };
  }
  if (Array.isArray(geometry.points) && geometry.points.length){
    const points = geometry.points
      .map((pt) => [num(pt?.[0]), num(pt?.[1])])
      .filter((xy) => xy[0] != null && xy[1] != null);
    if (!points.length) return null;
    return { type: "MultiPoint", coordinates: points };
  }
  return null;
}

function normalizeArcGisFeatureCollection(input){
  if (!asObject(input) || !Array.isArray(input.features) || !input.features.length) return null;
  const features = [];
  for (const row of input.features){
    const geometry = normalizeArcGisGeometry(row?.geometry);
    if (!geometry) continue;
    const properties = asObject(row?.attributes) ? row.attributes : {};
    features.push({ type: "Feature", geometry, properties });
  }
  if (!features.length) return null;
  return { type: "FeatureCollection", features };
}

function mapState(host){
  const L = typeof window !== "undefined" ? window.L : null;
  if (!host || !L) return null;
  if (host.__intelGeoMapState) return host.__intelGeoMapState;
  const map = L.map(host, {
    zoomControl: true,
    attributionControl: true,
  });
  map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer(TILE_URL, {
    attribution: TILE_ATTR,
    maxZoom: 19,
  }).addTo(map);
  const st = {
    map,
    areaLayer: null,
    pointLayer: null,
    outlineLayer: null,
    selectedLayer: null,
    token: 0,
    lastArgs: null,
    lastFitBounds: null,
    needsPostShowFit: false,
    resizeObserver: null,
    resizeFallbackBound: false,
  };
  attachMapResizeHooks(host, st);
  host.__intelGeoMapState = st;
  return st;
}

function hostHasRenderSize(host){
  if (!host) return false;
  const w = Number(host.clientWidth || host.offsetWidth || 0);
  const h = Number(host.clientHeight || host.offsetHeight || 0);
  return w > 4 && h > 4;
}

function invalidateAndFitIfNeeded(host, st){
  if (!host || !st || !st.map) return;
  if (!hostHasRenderSize(host)) return;
  try{
    st.map.invalidateSize({ pan: false, debounceMoveend: true });
  } catch {}
  if (
    st.needsPostShowFit &&
    st.lastFitBounds &&
    typeof st.lastFitBounds.isValid === "function" &&
    st.lastFitBounds.isValid()
  ){
    fitBoundsSmart(st.map, st.lastFitBounds);
    st.needsPostShowFit = false;
  }
}

function attachMapResizeHooks(host, st){
  if (!host || !st || !st.map) return;
  if (typeof ResizeObserver === "function" && !st.resizeObserver){
    const ro = new ResizeObserver(() => invalidateAndFitIfNeeded(host, st));
    ro.observe(host);
    st.resizeObserver = ro;
    return;
  }
  if (!st.resizeFallbackBound && typeof window !== "undefined"){
    const onResize = () => invalidateAndFitIfNeeded(host, st);
    window.addEventListener("resize", onResize);
    st.resizeFallbackBound = true;
  }
}

function cleanupLayers(st){
  if (!st) return;
  const map = st.map;
  if (st.areaLayer){
    map.removeLayer(st.areaLayer);
    st.areaLayer = null;
  }
  if (st.pointLayer){
    map.removeLayer(st.pointLayer);
    st.pointLayer = null;
  }
  if (st.outlineLayer){
    map.removeLayer(st.outlineLayer);
    st.outlineLayer = null;
  }
  if (st.selectedLayer){
    map.removeLayer(st.selectedLayer);
    st.selectedLayer = null;
  }
}

function candidateColor(candidateId){
  const id = str(candidateId);
  if (!id) return "#60a5fa";
  let h = 0;
  for (let i = 0; i < id.length; i++){
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 70% 55%)`;
}

function pointRadius(v, minV, maxV){
  const n = Number(v);
  const min = Number(minV);
  const max = Number(maxV);
  if (!Number.isFinite(n) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 7;
  const scaled = (Math.sqrt(Math.max(0, n)) - Math.sqrt(Math.max(0, min))) / (Math.sqrt(Math.max(0, max)) - Math.sqrt(Math.max(0, min)));
  return 5 + clamp(scaled, 0, 1) * 9;
}

function validPoint(p){
  const lat = num(p?.lat);
  const lon = num(p?.lon);
  if (lat == null || lon == null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function boundsFromPoints(L, pts){
  if (!pts.length) return null;
  let b = null;
  for (const p of pts){
    const ll = L.latLng(p.lat, p.lon);
    if (!b) b = L.latLngBounds(ll, ll);
    else b.extend(ll);
  }
  return b;
}

function cross(o, a, b){
  return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
}

function convexHull(points){
  const unique = [];
  const seen = new Set();
  for (const p of points){
    const key = `${p.lat.toFixed(8)}|${p.lon.toFixed(8)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ lat: p.lat, lon: p.lon });
  }
  if (unique.length < 3) return unique;
  unique.sort((a, b) => a.lon === b.lon ? a.lat - b.lat : a.lon - b.lon);
  const lower = [];
  for (const p of unique){
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0){
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = unique.length - 1; i >= 0; i--){
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0){
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function areaBoundaryFromCache(geoid){
  if (!geoid) return null;
  const row = boundaryCache.get(geoid);
  return row && row.ok ? row : null;
}

async function fetchBoundaryByGeoid(geoid){
  const years = ["2023", "2022", "2021"];
  for (const year of years){
    const url = `https://api.censusreporter.org/1.0/geo/tiger${year}/${encodeURIComponent(geoid)}.geojson`;
    let res = null;
    try{
      res = await fetch(url, { method: "GET", headers: { Accept: "application/geo+json,application/json" } });
    } catch {
      continue;
    }
    if (!res || !res.ok) continue;
    let payload = null;
    try{
      payload = await res.json();
    } catch {
      continue;
    }
    const featureCollection = normalizeFeatureLike(payload);
    if (featureCollection){
      return {
        ok: true,
        geoid,
        source: `censusreporter:tiger${year}`,
        geojson: featureCollection,
      };
    }
  }
  const tiger = await fetchBoundaryByTigerweb(geoid);
  if (tiger && tiger.ok){
    return tiger;
  }
  return {
    ok: false,
    geoid,
    source: tiger?.source || "censusreporter",
    error: "boundary_unavailable",
  };
}

function tigerwebQueryUrl(service, layer, where){
  const base = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/${service}/MapServer/${layer}/query`;
  const params = new URLSearchParams({
    where,
    outFields: "GEOID,NAME,STATE,COUNTY,PLACE,CD119,SLDU,SLDL",
    returnGeometry: "true",
    outSR: "4326",
    f: "pjson",
  });
  return `${base}?${params.toString()}`;
}

function buildTigerwebQueryPlan(geoid){
  const g = str(geoid);
  const county = g.match(/^05000US(\d{5})$/);
  if (county){
    return [
      tigerwebQueryUrl("State_County", 1, `GEOID='${county[1]}'`),
      tigerwebQueryUrl("State_County", 2, `GEOID='${county[1]}'`),
      tigerwebQueryUrl("State_County", 3, `GEOID='${county[1]}'`),
    ];
  }
  const place = g.match(/^16000US(\d{7})$/);
  if (place){
    return [
      tigerwebQueryUrl("Places_CouSub_ConCity_SubMCD", 4, `GEOID='${place[1]}'`),
      tigerwebQueryUrl("Places_CouSub_ConCity_SubMCD", 5, `GEOID='${place[1]}'`),
      tigerwebQueryUrl("Places_CouSub_ConCity_SubMCD", 6, `GEOID='${place[1]}'`),
      tigerwebQueryUrl("Places_CouSub_ConCity_SubMCD", 7, `GEOID='${place[1]}'`),
    ];
  }
  const cd = g.match(/^50000US(\d{4})$/);
  if (cd){
    const state = cd[1].slice(0, 2);
    const district = cd[1].slice(2, 4);
    return [
      tigerwebQueryUrl("Legislative", 0, `GEOID='${cd[1]}'`),
      tigerwebQueryUrl("Legislative", 0, `STATE='${state}' AND CD119='${district}'`),
    ];
  }
  const sldu = g.match(/^61000US(\d{5})$/);
  if (sldu){
    const state = sldu[1].slice(0, 2);
    const district = sldu[1].slice(2, 5);
    return [
      tigerwebQueryUrl("Legislative", 1, `GEOID='${sldu[1]}'`),
      tigerwebQueryUrl("Legislative", 1, `STATE='${state}' AND SLDU='${district}'`),
    ];
  }
  const sldl = g.match(/^62000US(\d{5})$/);
  if (sldl){
    const state = sldl[1].slice(0, 2);
    const district = sldl[1].slice(2, 5);
    return [
      tigerwebQueryUrl("Legislative", 2, `GEOID='${sldl[1]}'`),
      tigerwebQueryUrl("Legislative", 2, `STATE='${state}' AND SLDL='${district}'`),
    ];
  }
  const tract = g.match(/^(\d{11})$/);
  if (tract){
    return [tigerwebQueryUrl("Tracts_Blocks", 0, `GEOID='${tract[1]}'`)];
  }
  const blockGroup = g.match(/^(\d{12})$/);
  if (blockGroup){
    return [tigerwebQueryUrl("Tracts_Blocks", 1, `GEOID='${blockGroup[1]}'`)];
  }
  return [];
}

async function fetchBoundaryByTigerweb(geoid){
  const plan = buildTigerwebQueryPlan(geoid);
  if (!plan.length || typeof fetch !== "function"){
    return null;
  }
  for (const url of plan){
    let res = null;
    try{
      res = await fetch(url, { method: "GET", headers: { Accept: "application/geo+json,application/json" } });
    } catch {
      continue;
    }
    if (!res || !res.ok) continue;
    let payload = null;
    try{
      payload = await res.json();
    } catch {
      continue;
    }
    const featureCollection = normalizeFeatureLike(payload);
    if (featureCollection){
      return {
        ok: true,
        geoid,
        source: "tigerweb",
        geojson: featureCollection,
      };
    }
  }
  return {
    ok: false,
    geoid,
    source: "tigerweb",
    error: "boundary_unavailable",
  };
}

function deriveBoundaryGeoJson(args){
  const direct = normalizeFeatureLike(args?.areaBoundary?.geojson || args?.areaBoundary?.feature || args?.areaBoundary?.geometry || args?.areaBoundary);
  if (direct) return { geojson: direct, source: str(args?.areaBoundary?.source || "provided"), geoid: str(args?.areaBoundary?.geoid || "") };
  const geoid = areaToGeoId(args?.area);
  const cached = areaBoundaryFromCache(geoid);
  if (cached && cached.geojson){
    return { geojson: cached.geojson, source: str(cached.source), geoid };
  }
  return { geojson: null, source: "", geoid };
}

function deriveSelectedBoundaryGeoJson(args){
  const geoid = str(args?.selectedGeoId);
  if (!geoid){
    return { geojson: null, source: "", geoid: "" };
  }
  const direct = normalizeFeatureLike(
    args?.selectedGeoBoundary?.geojson ||
    args?.selectedGeoBoundary?.feature ||
    args?.selectedGeoBoundary?.geometry ||
    args?.selectedGeoBoundary
  );
  if (direct){
    return { geojson: direct, source: str(args?.selectedGeoBoundary?.source || "provided"), geoid };
  }
  const cached = areaBoundaryFromCache(geoid);
  if (cached && cached.geojson){
    return { geojson: cached.geojson, source: str(cached.source), geoid };
  }
  return { geojson: null, source: "", geoid };
}

function fitBoundsSmart(map, bounds){
  if (!map || !bounds) return;
  try{
    map.fitBounds(bounds, { padding: [16, 16], maxZoom: 14 });
  } catch {}
}

function renderMapNow(host, statusEl, args){
  const L = typeof window !== "undefined" ? window.L : null;
  if (!host || !statusEl){
    return { geoid: "", hasBoundary: false, pointCount: 0 };
  }
  statusEl.classList.remove("ok", "warn", "bad", "muted");
  if (!L){
    statusEl.classList.add("warn");
    statusEl.textContent = "Map unavailable: Leaflet failed to load.";
    return { geoid: "", hasBoundary: false, pointCount: 0 };
  }
  const st = mapState(host);
  if (!st){
    statusEl.classList.add("warn");
    statusEl.textContent = "Map unavailable: failed to initialize map.";
    return { geoid: "", hasBoundary: false, pointCount: 0 };
  }
  cleanupLayers(st);

  const mapLayer = asObject(args?.mapLayer) ? args.mapLayer : {};
  const selectedGeoId = str(args?.selectedGeoId);
  const onSelectGeo = typeof args?.onSelectGeo === "function" ? args.onSelectGeo : null;
  const rows = Array.isArray(mapLayer.points) ? mapLayer.points : [];
  const points = [];
  for (const row of rows){
    const p = validPoint(row);
    if (!p) continue;
    points.push({
      lat: p.lat,
      lon: p.lon,
      geoid: str(row?.geoid),
      totalVotes: Math.max(0, Number(row?.totalVotes) || 0),
      hasElection: !!row?.hasElection,
      marginPct: Number.isFinite(Number(row?.marginPct)) ? Number(row.marginPct) : null,
      leaderCandidateId: str(row?.leaderCandidateId),
      population: Number.isFinite(Number(row?.population)) ? Number(row.population) : null,
      housingUnits: Number.isFinite(Number(row?.housingUnits)) ? Number(row.housingUnits) : null,
    });
  }
  points.sort((a, b) => (b.totalVotes - a.totalVotes) || a.geoid.localeCompare(b.geoid));

  const boundaryPayload = deriveBoundaryGeoJson(args);
  const selectedBoundaryPayload = deriveSelectedBoundaryGeoJson(args);
  let hasBoundary = false;
  let hasSelectedBoundary = false;
  let fitBounds = null;
  if (boundaryPayload.geojson){
    st.areaLayer = L.geoJSON(boundaryPayload.geojson, {
      style: () => ({
        color: "#3b82f6",
        weight: 2,
        opacity: 0.9,
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
      }),
    }).addTo(st.map);
    try{
      fitBounds = st.areaLayer.getBounds();
      hasBoundary = fitBounds && fitBounds.isValid && fitBounds.isValid();
    } catch {
      hasBoundary = false;
    }
  }
  if (selectedBoundaryPayload.geojson){
    st.selectedLayer = L.geoJSON(selectedBoundaryPayload.geojson, {
      style: () => ({
        color: "#f59e0b",
        weight: 3,
        opacity: 0.95,
        fillColor: "#f59e0b",
        fillOpacity: 0.09,
      }),
    }).addTo(st.map);
    try{
      const selectedBounds = st.selectedLayer.getBounds();
      if (selectedBounds && selectedBounds.isValid && selectedBounds.isValid()){
        hasSelectedBoundary = true;
        if (fitBounds && fitBounds.extend){
          fitBounds.extend(selectedBounds);
        } else {
          fitBounds = selectedBounds;
        }
      }
    } catch {
      hasSelectedBoundary = false;
    }
  }

  if (points.length){
    const minVotes = Math.min(...points.map((p) => p.totalVotes));
    const maxVotes = Math.max(...points.map((p) => p.totalVotes));
    st.pointLayer = L.layerGroup();
    for (const row of points){
      const selected = !!selectedGeoId && row.geoid === selectedGeoId;
      const marker = L.circleMarker([row.lat, row.lon], {
        radius: pointRadius(row.totalVotes, minVotes, maxVotes) + (selected ? 2 : 0),
        color: selected ? "#f8fafc" : "#0f172a",
        weight: selected ? 3 : 1,
        fillColor: candidateColor(row.leaderCandidateId),
        fillOpacity: selected ? 0.95 : 0.8,
      });
      const marginText = row.marginPct == null ? "—" : `${row.marginPct.toFixed(1)}%`;
      const popText = row.population == null ? "—" : String(Math.round(row.population));
      const housingText = row.housingUnits == null ? "—" : String(Math.round(row.housingUnits));
      const volumeLabel = row.hasElection ? "votes" : "pop";
      const volumeValue = row.hasElection
        ? Math.round(row.totalVotes)
        : (row.population == null ? Math.round(row.totalVotes) : Math.round(row.population));
      marker.bindTooltip(
        `${row.geoid || "—"} | ${volumeLabel} ${volumeValue} | top ${row.leaderCandidateId || "—"} | margin ${marginText} | pop ${popText} | housing ${housingText}`,
        { direction: "top", offset: [0, -4] }
      );
      if (onSelectGeo){
        marker.on("click", () => {
          onSelectGeo(row.geoid);
        });
      }
      marker.addTo(st.pointLayer);
      if (selected && typeof marker.bringToFront === "function"){
        marker.bringToFront();
      }
    }
    st.pointLayer.addTo(st.map);
  }

  if (!hasBoundary && points.length >= 3){
    const hull = convexHull(points);
    if (hull.length >= 3){
      st.outlineLayer = L.polygon(hull.map((p) => [p.lat, p.lon]), {
        color: "#38bdf8",
        weight: 2,
        opacity: 0.85,
        fillColor: "#38bdf8",
        fillOpacity: 0.06,
        dashArray: "6 4",
      }).addTo(st.map);
      fitBounds = st.outlineLayer.getBounds();
    }
  }

  if (!fitBounds && points.length){
    fitBounds = boundsFromPoints(L, points);
  }

  if (fitBounds && fitBounds.isValid && fitBounds.isValid()){
    st.lastFitBounds = fitBounds;
    if (hostHasRenderSize(host)){
      fitBoundsSmart(st.map, fitBounds);
      st.needsPostShowFit = false;
    } else {
      st.needsPostShowFit = true;
    }
  } else {
    st.lastFitBounds = null;
    st.needsPostShowFit = false;
    st.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  if (points.length && hasBoundary && hasSelectedBoundary){
    statusEl.classList.add("ok");
    statusEl.textContent = `Interactive map: ${points.length} GEO points with area outline (${boundaryPayload.geoid || "selected area"}) and selected GEO boundary (${selectedBoundaryPayload.geoid || "selected GEO"}).`;
  } else if (points.length && hasBoundary){
    statusEl.classList.add("ok");
    statusEl.textContent = `Interactive map: ${points.length} GEO points with area outline (${boundaryPayload.geoid || "selected area"}).`;
  } else if (points.length && hasSelectedBoundary){
    statusEl.classList.add("ok");
    statusEl.textContent = `Interactive map: ${points.length} GEO points with selected GEO boundary (${selectedBoundaryPayload.geoid || "selected GEO"}).`;
  } else if (hasBoundary){
    statusEl.classList.add("ok");
    statusEl.textContent = `Interactive map: area outline loaded (${boundaryPayload.geoid || "selected area"}).`;
  } else if (points.length){
    statusEl.classList.add("warn");
    statusEl.textContent = `Interactive map: ${points.length} GEO points plotted. Area outline not available yet.`;
  } else {
    statusEl.classList.add("muted");
    statusEl.textContent = str(mapLayer.reason || "Map unavailable: no centroid coordinates found in census GEO rows.");
  }

  setTimeout(() => invalidateAndFitIfNeeded(host, st), 0);
  setTimeout(() => invalidateAndFitIfNeeded(host, st), 120);

  return {
    geoid: boundaryPayload.geoid,
    hasBoundary,
    pointCount: points.length,
    selectedGeoId: selectedBoundaryPayload.geoid,
    hasSelectedBoundary,
  };
}

function queueBoundaryFetch(host, statusEl, args, geoid){
  if (!host || !statusEl || !geoid || typeof fetch !== "function") return;
  if (boundaryPending.has(geoid)) return;
  const st = host.__intelGeoMapState;
  if (!st) return;
  const token = st.token;
  const pending = fetchBoundaryByGeoid(geoid)
    .then((result) => {
      boundaryCache.set(geoid, result);
    })
    .catch(() => {
      boundaryCache.set(geoid, { ok: false, geoid, source: "censusreporter", error: "boundary_unavailable" });
    })
    .finally(() => {
      boundaryPending.delete(geoid);
      const latest = host.__intelGeoMapState;
      if (!latest || latest.token !== token) return;
      renderIntelGeoMap(host, statusEl, latest.lastArgs || args);
    });
  boundaryPending.set(geoid, pending);
}

export function describeIntelGeoBoundaryStatus(args = {}){
  const pointCount = Math.max(0, Math.trunc(Number(args?.pointCount) || 0));
  const geoid = str(args?.geoid);
  const selectedGeoId = str(args?.selectedGeoId);
  const hasBoundary = !!args?.hasBoundary;
  const hasSelectedBoundary = !!args?.hasSelectedBoundary;
  const areaBoundaryUnavailable = !!args?.areaBoundaryUnavailable;
  const areaBoundaryLoading = !!args?.areaBoundaryLoading;
  const selectedBoundaryUnavailable = !!args?.selectedBoundaryUnavailable;
  const selectedBoundaryLoading = !!args?.selectedBoundaryLoading;

  if (areaBoundaryLoading && selectedBoundaryLoading){
    return {
      handled: true,
      kind: pointCount > 0 ? "warn" : "muted",
      text: pointCount > 0
        ? `Interactive map: ${pointCount} GEO points plotted. Loading area boundary ${geoid} and selected GEO boundary ${selectedGeoId}...`
        : `Loading area boundary ${geoid} and selected GEO boundary ${selectedGeoId}...`,
    };
  }
  if (areaBoundaryLoading){
    return {
      handled: true,
      kind: pointCount > 0 ? "warn" : "muted",
      text: pointCount > 0
        ? `Interactive map: ${pointCount} GEO points plotted. Loading boundary for ${geoid}...`
        : `Loading boundary for ${geoid}...`,
    };
  }
  if (selectedBoundaryLoading){
    return {
      handled: true,
      kind: "warn",
      text: `Interactive map: ${pointCount} GEO points plotted. Loading selected GEO boundary ${selectedGeoId}...`,
    };
  }
  if (areaBoundaryUnavailable && selectedBoundaryUnavailable && pointCount > 0){
    return {
      handled: true,
      kind: "warn",
      text: `Interactive map: ${pointCount} GEO points plotted. Area boundary unavailable for ${geoid}; selected GEO boundary unavailable for ${selectedGeoId}.`,
    };
  }
  if (selectedBoundaryUnavailable && hasBoundary){
    return {
      handled: true,
      kind: "warn",
      text: pointCount > 0
        ? `Interactive map: ${pointCount} GEO points with area outline (${geoid}). Selected GEO boundary unavailable for ${selectedGeoId}.`
        : `Interactive map: area outline loaded (${geoid}). Selected GEO boundary unavailable for ${selectedGeoId}.`,
    };
  }
  if (selectedBoundaryUnavailable && pointCount > 0){
    return {
      handled: true,
      kind: "warn",
      text: `Interactive map: ${pointCount} GEO points plotted. Selected GEO boundary unavailable for ${selectedGeoId}.`,
    };
  }
  if (areaBoundaryUnavailable && hasSelectedBoundary){
    return {
      handled: true,
      kind: "ok",
      text: pointCount > 0
        ? `Interactive map: ${pointCount} GEO points with selected GEO boundary (${selectedGeoId}). Area boundary unavailable for ${geoid}.`
        : `Interactive map: selected GEO boundary loaded (${selectedGeoId}). Area boundary unavailable for ${geoid}.`,
    };
  }
  if (areaBoundaryUnavailable && pointCount > 0){
    return {
      handled: true,
      kind: "warn",
      text: `Interactive map: ${pointCount} GEO points plotted. Area boundary unavailable for ${geoid}.`,
    };
  }
  if (areaBoundaryUnavailable){
    return {
      handled: true,
      kind: "muted",
      text: `Map unavailable: boundary fetch unavailable for ${geoid}.`,
    };
  }
  return {
    handled: false,
    kind: "muted",
    text: "",
  };
}

export function renderIntelGeoMap(host, statusEl, args = {}){
  const st = mapState(host);
  if (!host || !statusEl){
    return;
  }
  if (st){
    st.token += 1;
    st.lastArgs = args;
  }
  const out = renderMapNow(host, statusEl, args);
  let areaBoundaryUnavailable = false;
  let areaBoundaryLoading = false;
  let selectedBoundaryUnavailable = false;
  let selectedBoundaryLoading = false;
  if (!out.hasBoundary && out.geoid){
    const cached = boundaryCache.get(out.geoid);
    if (cached && !cached.ok){
      areaBoundaryUnavailable = true;
    }
    if (!cached){
      areaBoundaryLoading = true;
      queueBoundaryFetch(host, statusEl, args, out.geoid);
    }
  }
  if (!out.hasSelectedBoundary && out.selectedGeoId){
    const cached = boundaryCache.get(out.selectedGeoId);
    if (cached && !cached.ok){
      selectedBoundaryUnavailable = true;
    }
    if (!cached){
      selectedBoundaryLoading = true;
      queueBoundaryFetch(host, statusEl, args, out.selectedGeoId);
    }
  }
  const status = describeIntelGeoBoundaryStatus({
    ...out,
    areaBoundaryUnavailable,
    areaBoundaryLoading,
    selectedBoundaryUnavailable,
    selectedBoundaryLoading,
  });
  if (status.handled){
    statusEl.classList.remove("ok", "warn", "bad", "muted");
    statusEl.classList.add(status.kind || "muted");
    statusEl.textContent = status.text;
  }
}
