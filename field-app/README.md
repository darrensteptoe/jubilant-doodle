
# Field Path Engine (Internal)

Version: 1.0  
Last updated: 2026-02-18

This is the **Field Path Engine**: an internal, browser-based planning dashboard for estimating win paths, persuasion/GOTV needs, ROI, and feasible field plans under budget, capacity, and timeline constraints.

It is designed to be:
- **Deterministic by default** (same inputs → same outputs)
- **Explainable** (it shows what assumptions drive the outcome)
- **Hardened against drift** (self-tests + snapshot hashing + schema migrations)

## Quick start (5 minutes)

1. Open `index.html` in a modern browser (or deploy as static files).
2. Fill out **Scenario setup** (race type, election date, mode).
3. In **Universe**:
   - Choose your *universe basis* (registered voters / likely voters / etc.).
   - Enter the universe size.
4. In **Candidates & vote landscape**:
   - Enter candidate baseline shares (and undecided handling).
5. Review **Win path (Expected)** and **Sensitivity**.
6. If building a plan, enter:
   - **Budget inputs**
   - **Turnout / GOTV**
   - **Optimization**
   - **Timeline / Production** if you need feasibility constraints

### Optional dev server/build pipeline (Vite)

If you want local hot-reload and static build output:

1. Install dependencies: `npm install`
2. Run dev server: `npm run dev`
3. Build static assets: `npm run build`
4. Preview built output: `npm run preview`
5. Run JS type-checking (no emit): `npm run typecheck`
6. Run full rebuild gate suite: `npm run gate:rebuild`

### Mapbox Public Token Setup

Mapbox is wired as a browser-side rendering layer through one config seam:

- runtime key: `window.__VICE_CONFIG__.MAPBOX_PUBLIC_TOKEN`
- bootstrap files:
  - `index.html` meta: `name="vice-mapbox-public-token"`
  - `js/app/runtimeConfig.js` resolver

Local dev:

1. Create `.env.local` with:
   - `VITE_MAPBOX_PUBLIC_TOKEN=pk...`
2. Run `npm run dev`.

GitHub Pages / deployed static build:

1. Set `VITE_MAPBOX_PUBLIC_TOKEN` in the build environment (for example GitHub Actions repository secret/env).
2. Build with `npm run build`.
3. Deploy the built `dist/` output.

Notes:

- Use a **public** Mapbox browser token only.
- Google Maps credentials are intentionally separate (`window.__VICE_CONFIG__.GOOGLE_MAPS_API_KEY`) and must be restricted by HTTP referrer + API restrictions in Google Cloud.

### Rebuild gates (canonical path)

- `npm run check:canonical-math` — enforces no duplicate/local formula math in non-canonical glue layers
- `npm run gate:rebuild` — strict gate: runs canonical-math check, rebuild contract suites, core self-test, and production build (fails on warning-pattern regressions)
- `npm run gate:release` — runs full rebuild gate + release hardening suite
- `npm run package:runtime` — creates a runtime-only deploy package under `release/` (excludes workspace artifacts)
- `npm run qa:new-parity-log` — creates a dated manual parity sign-off file from template
- `npm run status:rebuild` — prints current workstream completion summary from milestone checkpoint
- `npm run status:manual-parity` — prints pass/fail/pending stage status and sign-off readiness from today’s manual parity file
- `npm run gate:manual-parity` — strict manual parity gate (non-zero exit until all stages pass and QA/Product are YES)

## What this app does (and does not) do

### It *does*
- Translate vote shares + universe size into **vote counts**
- Compute **votes needed** to win and how far you are from that threshold
- Model **persuasion conversion** and **turnout lift** as levers
- Compare tactics via **ROI** (cost per net vote) and optimize mixes
- Stress-test outcomes via **Monte Carlo** (seeded)
- Enforce **schema versioning** + deterministic export/import
- Verify exports via **snapshot hash** (integrity verification)
- Normalize voter-file inputs through a canonical voter data layer (adapter-based, import broad/persist narrow)

### It does *not*
- Operate as a full voter-file warehouse with maximal field retention
- Replace real field metrics (it requires reasonable inputs)
- Provide legal/finance compliance guidance

## Repository layout

- `index.html` — UI structure
- `styles.css` — theme + layout (supports light/dark via system preference)
- `js/app.js` — UI orchestration + state + rendering + wiring
- `js/*` — compute modules, integrity, import/export, self-test infrastructure

## Safety rails (why they exist)

- **Self-test gate**: ensures core math invariants still pass after edits.
- **Deterministic export**: makes identical state serialize identically.
- **Snapshot hash**: detects accidental mutation or corrupted imports.
- **Schema migration guard**: allows future versions to read older exports safely.

For details, see:
- `BOX_BY_BOX_GUIDE.md`
- `MODEL_THEORY.md`
- `ARCHITECTURE.md`
- `CORE_SAFE_BOUNDARY.md`
- `TROUBLESHOOTING.md`
