
# Architecture

This app is intentionally structured so the **math core** can remain stable, testable, and portable.

## High-level layers

1. **UI / DOM layer**
   - `index.html`, `styles.css`
   - DOM is treated as a "view": it displays state and emits user input events.

2. **Orchestration / State**
   - `js/app.js`
   - Owns:
     - the in-memory `state`
     - reading/writing local storage
     - calling compute modules
     - rendering outputs
     - wiring event handlers
     - self-test gating visibility and confidence signals

3. **Pure compute modules** (should remain side-effect free)
   - `js/winMath.js` — win math + persuasion shifts
   - `js/turnout.js` — turnout and GOTV lift calculations
   - `js/budget.js` — cost + ROI computations, tactic definitions
   - `js/optimize.js` — budget/capacity optimization
   - `js/timeline.js`, `js/timelineOptimizer.js` — feasibility + timeline constrained optimization
   - `js/marginalValue.js` — marginal leverage and bottleneck diagnostics
   - `js/decisionIntelligence.js` — structured diagnosis, “what matters most” ranking
   - (Others provide helpers, formatting, or scenario comparison)

4. **Integrity + persistence**
   - `js/export.js` — deterministic export / import shapes
   - `js/hash.js` — snapshot hash computation
   - `js/migrate.js` — schema versioning + migration rules
   - `js/importPolicy.js` — strict import policy (fail closed)
   - `js/storage.js` — localStorage save/load + backup ring

5. **Self-test / golden fixtures**
   - `js/selfTest.js` — invariant tests + regression protection
   - Goal: detect drift early, before a user trusts bad numbers.

## “System-only” theme design

Theme follows the OS setting:
- No UI toggle
- No persistence (avoids a hidden state the user can't change)

Implementation:
- `app.js` reads `prefers-color-scheme` and toggles `body.dark`
- `storage.js` strips `state.ui.dark` on save/load (ephemeral only)

## How to add future capabilities safely (principles)

- Add new math in a new module or an existing compute module.
- Keep compute modules pure:
  - no DOM access
  - no localStorage
  - no random without a seeded RNG passed in
- Add new UI fields in `index.html`, wire in `app.js`.
- Add tests in `selfTest.js` for each new invariant.

## SaaS readiness (without rewriting the math core)

To ship as SaaS later:
- Replace `storage.js` with a persistence adapter (API calls)
- Add auth + tenancy at the persistence layer
- Keep compute modules unchanged
- Keep export/import format stable (versioned)
