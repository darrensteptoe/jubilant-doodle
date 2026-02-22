# Left Menu Update (Setup / Strategy / Execution / Analysis)

This bundle contains drop-in snippets to update the **left navigation** to the requested information architecture.

## Target IA

Top-level sections (in order):

1. **Setup**
2. **Strategy**
3. **Execution**
4. **Analysis**

### Setup (expanded order)

- **Race Setup** (single entry point)
  - Scenario
  - Universe
  - Electorate Structure
- **Ballot Test — Vote Landscape**
- **Turnout — Past Two Elections**
- **Persuadable Universe**

### Strategy

- **GOTV / Turnout**

## How to apply

1. Replace your existing left menu markup with `leftMenu.html`.
2. Wire clicks to your existing view/router IDs by editing `navConfig.json`:
   - Set each item's `target` to whatever your app already uses (hash, route name, panel id, etc.).
3. Include `leftMenu.js` after your existing app/router code so it can call your navigation function.
   - By default it calls `window.navigateTo(target)` if present; otherwise it updates `location.hash`.

If your app already has its own navigation system, keep `navConfig.json` and map `target` values to your existing IDs.
