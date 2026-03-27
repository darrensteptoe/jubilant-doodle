const DEFAULT_PROXY_BASE = "/api";
const DEFAULT_PROXY_ORIGIN = "https://proxy.invalid";
const PROXY_BASE_GLOBAL_KEY = "__FPE_API_PROXY_BASE__";
const VICE_CONFIG_KEY = "__VICE_CONFIG__";
const VICE_PROXY_BASE_KEY = "API_PROXY_BASE";
const PROXY_BASE_META_NAMES = ["fpe-api-proxy-base", "vice-api-proxy-base"];

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function cleanBasePath(raw){
  const text = cleanText(raw);
  if (!text) return "";
  if (/^https?:\/\//i.test(text)){
    return text.replace(/\/+$/, "");
  }
  const prefixed = text.startsWith("/") ? text : `/${text}`;
  return prefixed.replace(/\/+$/, "");
}

function readMetaProxyBase(){
  if (typeof document === "undefined" || typeof document.querySelector !== "function"){
    return "";
  }
  for (const name of PROXY_BASE_META_NAMES){
    const tag = document.querySelector(`meta[name="${name}"]`);
    const content = cleanText(tag?.getAttribute?.("content"));
    const base = cleanBasePath(content);
    if (base) return base;
  }
  return "";
}

function readViceConfigProxyBase(){
  const config = globalThis?.[VICE_CONFIG_KEY];
  if (!config || typeof config !== "object") return "";
  return cleanBasePath(config[VICE_PROXY_BASE_KEY]);
}

export function resolveApiProxyBase(){
  const runtimeBase = cleanBasePath(globalThis?.[PROXY_BASE_GLOBAL_KEY]);
  if (runtimeBase) return runtimeBase;
  const viceConfigBase = readViceConfigProxyBase();
  if (viceConfigBase) return viceConfigBase;
  const metaBase = readMetaProxyBase();
  if (metaBase) return metaBase;
  return DEFAULT_PROXY_BASE;
}

function joinProxyPath(base, path){
  const normalizedPath = `/${cleanText(path).replace(/^\/+/, "")}`;
  if (/^https?:\/\//i.test(base)){
    const originUrl = new URL(base);
    const pathText = cleanText(originUrl.pathname).replace(/^\/+/, "").replace(/\/+$/, "");
    const basePath = pathText ? `/${pathText}` : DEFAULT_PROXY_BASE;
    const joinedPath = `${basePath === "/" ? "" : basePath}${normalizedPath}`.replace(/\/{2,}/g, "/");
    return `${originUrl.origin}${joinedPath || "/"}`;
  }
  return `${base}${normalizedPath}`.replace(/\/{2,}/g, "/");
}

export function buildApiProxyUrl(path, paramEntries = []){
  const base = resolveApiProxyBase();
  const route = joinProxyPath(base, path);
  const params = new URLSearchParams();
  for (const entry of Array.isArray(paramEntries) ? paramEntries : []){
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const key = cleanText(entry[0]);
    const value = cleanText(entry[1]);
    if (!key || value === "") continue;
    params.append(key, value);
  }
  const query = params.toString();
  if (!query) return route;
  if (/^https?:\/\//i.test(route)){
    const url = new URL(route);
    url.search = query;
    return url.toString();
  }
  return `${route}?${query}`;
}

export function resolveApiProxyRoute(path){
  const base = resolveApiProxyBase();
  const route = joinProxyPath(base, path);
  if (/^https?:\/\//i.test(route)){
    const url = new URL(route);
    return `${url.origin}${url.pathname}`;
  }
  const root = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : DEFAULT_PROXY_ORIGIN;
  const resolved = new URL(route, root);
  return resolved.pathname;
}
