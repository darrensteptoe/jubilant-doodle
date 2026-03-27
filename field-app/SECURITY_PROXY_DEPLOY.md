# Security Proxy Deploy Steps

This Worker now proxies weather only (`/api/weather`).

Census is browser-direct to the public Census API (`https://api.census.gov/data`) and is no longer routed through Worker endpoints.

## 1) Install/authorize Wrangler

```bash
npm i -g wrangler
wrangler login
```

## 2) Configure Worker name/domain

Edit [`wrangler.toml`](/Users/anakinskywalker/Downloads/field-app-40/wrangler.toml):

- keep `main = "worker/fpe-api-proxy.js"`
- set `name` for your account
- if app and Worker are cross-origin, set `CORS_ALLOWED_ORIGINS` to a comma-separated allowlist
- if app is on a Cloudflare-managed zone and you want same-origin `/api/*`, add routes for `/api/*`

Same-origin route format:

```toml
routes = [
  { pattern = "app.example.com/api/*", zone_name = "example.com" }
]
```

Note: `github.io` is not your Cloudflare zone, so same-origin Worker routes cannot be attached to `https://darrensteptoe.github.io/api/*`.

## 3) Set secrets (server-side only)

```bash
wrangler secret put OPENWEATHER_API_KEY
```

## 4) Deploy Worker

```bash
wrangler deploy
```

## 5) Configure app API base (for weather proxy)

Set one runtime config value before app boot:

- `window.__VICE_CONFIG__.API_PROXY_BASE = "https://<worker-host>/api"`
- (legacy) `window.__FPE_API_PROXY_BASE__ = "https://<worker-host>/api"`
- or meta tag in [`index.html`](/Users/anakinskywalker/Downloads/field-app-40/index.html):
  - `<meta name="vice-api-proxy-base" content="https://<worker-host>/api">`

If you provide origin-only (`https://<worker-host>`), client routing defaults to `/api/*` on that host.

## 6) Verify after deploy

Weather proxy:

```bash
curl -i "https://<worker-host>/api/health"
curl -i "https://<worker-host>/api/weather?zip=60614"
```

Census direct (no Worker route expected):

```bash
curl -i "https://api.census.gov/data/2024/acs/acs5/variables.json"
curl -i "https://api.census.gov/data/2020/dec/pl?get=NAME&for=state:*"
```
