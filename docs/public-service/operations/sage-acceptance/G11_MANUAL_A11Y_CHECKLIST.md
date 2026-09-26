# G11 — Manual accessibility checklist (SAGE operator UI)

> **Automated axe (repository) ≠ manual PASS.**  
> Named human must complete this against a **deployed** SAGE surface (requires B-005).  
> Do not mark G11 PASS or close B-004 until every applicable item is checked with initials + date.

**Tester name:** ____________  
**Date (America/Toronto):** ____________  
**Environment URL:** ____________  
**Deployed commit (`/api/health.buildInfo.commit`):** ____________  
**AT used (e.g. NVDA/VoiceOver/JAWS) + browser:** ____________  

## Surfaces in scope (minimum)

- [ ] `/sage` workspace list / create
- [ ] Workspace overview
- [ ] Evidence create / classify / list
- [ ] Exports request / package list / records lifecycle panel
- [ ] Governance: boundary flags / review notes / decision records (if shown)
- [ ] Locale switch en ↔ fr (or en-CA ↔ fr-CA)

## Keyboard

- [ ] All interactive controls reachable via Tab / Shift+Tab only
- [ ] Visible focus indicator on every focusable control
- [ ] Enter/Space activates buttons and links
- [ ] Esc closes dialogs/menus without trapping focus
- [ ] No keyboard trap in forms or panels
- [ ] Skip-to-content or equivalent landmark navigation works on full page shell

## Forms & labels

- [ ] Every input has an accessible name (label / aria-labelledby)
- [ ] Errors are announced and associated with fields
- [ ] Required fields indicated programmatically, not colour alone

## Screen reader

- [ ] Page title unique and meaningful per view
- [ ] Headings hierarchical and announce section purpose
- [ ] Buttons/links announce purpose (no “click here” only)
- [ ] Live regions announce async success/failure (export request, grant revoke)
- [ ] Tables/lists (evidence, exports) make sense when linearised

## Visual

- [ ] Text/UI contrast adequate (spot-check; axe jsdom cannot prove contrast)
- [ ] Meaning not conveyed by colour alone (status chips)
- [ ] Zoom 200% usable without loss of critical actions

## Bilingual parity (manual spot-check)

- [ ] Critical strings present in FR for SAGE namespaces used on page
- [ ] No mixed-language control labels on a single locale setting

## Result

- [ ] **PASS** — all applicable items OK (close B-004 only with deploy proof)  
- [ ] **FAIL** — list defects below (keep G11 NOT_PROVEN)

### Defects

| # | Surface | Issue | Severity |
| --- | --- | --- | --- |
| 1 | | | |

**Signature:** ____________
