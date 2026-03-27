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
- if you use a custom domain route, add routes so `/api/*` is handled by this Worker

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
- If not same origin, expose `window.__FPE_API_PROXY_BASE__` to the Worker origin path before app boot.

## 6) Verify after deploy

From app host:

```bash
curl -i "https://<app-host>/api/weather?zip=60614"
curl -i "https://<app-host>/api/census/geo?year=2020&get=NAME&for=state:*"
curl -i "https://<app-host>/api/census/variables?year=2024"
```
