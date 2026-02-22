
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

## What this app does (and does not) do

### It *does*
- Translate vote shares + universe size into **vote counts**
- Compute **votes needed** to win and how far you are from that threshold
- Model **persuasion conversion** and **turnout lift** as levers
- Compare tactics via **ROI** (cost per net vote) and optimize mixes
- Stress-test outcomes via **Monte Carlo** (seeded)
- Enforce **schema versioning** + deterministic export/import
- Verify exports via **snapshot hash** (integrity verification)

### It does *not*
- Automatically know district-level voter file characteristics
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
- `TROUBLESHOOTING.md`
