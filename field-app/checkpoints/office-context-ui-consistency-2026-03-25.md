# Office/Context UI Consistency Hardening (2026-03-25)

Status: complete (UI vocabulary normalization pass)

## Shared label utility
- Added `js/core/officeContextLabels.js` as the shared source for office/context display labels.
- Canonical labels now standardized to:
  - Municipal Executive
  - Municipal Legislative
  - Countywide
  - State House
  - State Senate
  - Congressional District
  - Statewide Executive
  - Statewide Federal
  - Judicial / Other
  - Custom Context
- Added display support for dimension values:
  - `state_legislative_lower` -> State House
  - `state_legislative_upper` -> State Senate
- Legacy display compatibility:
  - `federal` (resolved when intent is clear; otherwise Federal)
  - `state_leg` (resolved when possible; otherwise State Legislative)
  - `municipal` -> Municipal
  - `county` -> County
- Safe fallback behavior:
  - unknown canonical-ish token -> Title Case fallback
  - unresolved token -> `Unmapped Office Context`

## UI and summary surfaces standardized
- Template selector labels and office-level dimension labels now use shared office/context labels.
- Candidate-history office selector labels now use canonical modern labels from shared options.
- District V2 template metadata summary now resolves office-level text through shared label utility.
- Data archive template and office-path summaries now use human office labels.
- Intel calibration/scenario briefs now show human race/office labels instead of raw legacy tokens.
- Controls benchmark row subtext now uses human race label text.
- Manual doctrine wording updated to human office language (no internal token phrasing in teaching copy).

## Intentional legacy compatibility paths retained
- Legacy race buckets (`federal`, `state_leg`, `municipal`, `county`) remain accepted at compatibility boundaries (resolver/import/hydration paths).
- Modern selectors and display surfaces no longer expose legacy tokens as first-class options in canonical flows.

## Notes on raw token visibility
- Raw tokens remain intentionally visible only in explicit diagnostics/help where canonical storage guidance is needed (for example, warning text may still include `statewide_executive` as a storage token hint).
