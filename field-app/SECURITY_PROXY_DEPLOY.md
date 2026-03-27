# Security Proxy Deploy Steps

## 1) Install/authorize Wrangler

```bash
npm i -g wrangler
wrangler login
```

## 2) Configure Worker name/domain

Edit [`wrangler.toml`](/Users/anakinskywalker/Downloads/field-app-40/wrangler.toml):

- keep `main = "worker/fpe-api-proxy.js"`
- set `name` for your account
- if you use a Cloudflare-managed custom domain, add routes so `/api/*` is handled by this Worker
- if app and Worker are cross-origin, set `CORS_ALLOWED_ORIGINS` to a comma-separated allowlist

Exact same-origin route format:

```toml
routes = [
  { pattern = "app.example.com/api/*", zone_name = "example.com" }
]
```

Important:

- `github.io` hosting is not in your Cloudflare zone, so you cannot attach a same-origin Worker route to `https://darrensteptoe.github.io/api/*`.
- For GitHub Pages, use cross-origin Worker calls and set the app API base to your Worker origin.

## 3) Set secrets (server-side only)

```bash
wrangler secret put OPENWEATHER_API_KEY
wrangler secret put CENSUS_API_KEY
```

Notes:

- `OPENWEATHER_API_KEY` is required for `/api/weather`
- `CENSUS_API_KEY` is optional (Worker will call Census without a key if omitted)

## 4) Deploy Worker

```bash
wrangler deploy
```

## 5) Ensure app and Worker share origin for `/api/*`

- Preferred: serve static app and Worker on the same hostname, with Worker bound to `/api/*`.
- If not same origin, set one runtime config value before app boot:
  - `window.__VICE_CONFIG__.API_PROXY_BASE = "https://<worker-host>/api"`
  - (legacy compatible) `window.__FPE_API_PROXY_BASE__ = "https://<worker-host>/api"`
- If you provide origin-only (for example `https://<worker-host>`), client routing now defaults to `https://<worker-host>/api/*`.
- You can also set `<meta name="vice-api-proxy-base" content="https://<worker-host>/api">` in [`index.html`](/Users/anakinskywalker/Downloads/field-app-40/index.html).

## 5a) GitHub Pages production wiring (recommended)

1. Keep Worker on `workers.dev` (or another non-github origin you control).
2. Set Worker CORS allowlist:

```toml
[vars]
CORS_ALLOWED_ORIGINS = "http://localhost:5173,https://darrensteptoe.github.io"
```

3. Set API base in app boot config:
   - `window.__VICE_CONFIG__.API_PROXY_BASE = "https://<your-worker>.workers.dev/api"`
   - or meta tag `vice-api-proxy-base` with that same value.

## 6) Verify after deploy

If same-origin routes are attached:

```bash
curl -i "https://<app-host>/api/weather?zip=60614"
curl -i "https://<app-host>/api/census/geo?year=2020&get=NAME&for=state:*"
curl -i "https://<app-host>/api/census/variables?year=2024"
```

If using cross-origin Worker (GitHub Pages pattern):

```bash
curl -i -H "Origin: https://darrensteptoe.github.io" "https://<worker-host>/api/weather?zip=60614"
curl -i -H "Origin: https://darrensteptoe.github.io" "https://<worker-host>/api/census/geo?year=2020&get=NAME&for=state:*"
curl -i -H "Origin: https://darrensteptoe.github.io" "https://<worker-host>/api/census/variables?year=2024"
```
