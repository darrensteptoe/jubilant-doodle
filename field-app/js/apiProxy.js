const DEFAULT_PROXY_BASE = "/api";
const DEFAULT_PROXY_ORIGIN = "https://proxy.invalid";
const PROXY_BASE_GLOBAL_KEY = "__FPE_API_PROXY_BASE__";

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
  const tag = document.querySelector('meta[name="fpe-api-proxy-base"]');
  const content = cleanText(tag?.getAttribute?.("content"));
  return cleanBasePath(content);
}

export function resolveApiProxyBase(){
  const runtimeBase = cleanBasePath(globalThis?.[PROXY_BASE_GLOBAL_KEY]);
  if (runtimeBase) return runtimeBase;
  const metaBase = readMetaProxyBase();
  if (metaBase) return metaBase;
  return DEFAULT_PROXY_BASE;
}

function joinProxyPath(base, path){
  const normalizedPath = `/${cleanText(path).replace(/^\/+/, "")}`;
  if (/^https?:\/\//i.test(base)){
    const url = new URL(normalizedPath, `${base}/`);
    return `${url.origin}${url.pathname}`;
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
