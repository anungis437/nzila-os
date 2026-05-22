# OCRA Adaptive Live Flow — Manual QA Script

**Doctrine version:** 1.0.0
**Routing engine version:** 1.0.0
**Status:** Manual sign-off required before staging promotion.

This script complements the automated suite. It walks an operator through the live respondent flow under representative organizational profiles and the failure modes that the automated tests cannot fully reproduce (UX feel, focus order, visual rendering of explanations, PDF download).

The emotional bar for sign-off: **"This feels calm, trustworthy, and impossible to break casually."**

---

## Setup

1. `pnpm dev:union-eyes` (or visit staging URL).
2. Open `http://localhost:3002/en-CA/continuity-assessment` (or `/fr-CA/...`).
3. Open the browser devtools Network tab and filter to `/api/icra/telemetry`.
4. Have a second tab on `/api/icra/results/:id` ready for verifying persisted shape.

---

## Scenarios

| # | Scenario | Steps | Expected | Pass/Fail | Notes |
|---|----------|-------|----------|-----------|-------|
| 1 | **Small local union** | Consent → org context with `org_type=local_union`, `sector=public_sector`, `membership_size=under_100` | Adaptive explanation card appears with `institutionalScale` ≈ micro/small. `assessment_routed` telemetry event fires. Question count visible in card. |  |  |
| 2 | **Large federated national union** | Consent → `org_type=national_union`, `sector=federal`, `membership_size=50000_plus` | Card shows larger scale band (national / federation_layered / enterprise). Different included/deferred counts than scenario 1. |  |  |
| 3 | **Healthcare authority** | Consent → `org_type=health_authority`, `sector=healthcare`, `membership_size=10000_49999` | Card shows institutional band. `continuityExposure` reflects healthcare context. |  |  |
| 4 | **fr-CA parity** | Re-run scenario 1 in French | Explanation card renders in French. Same band wording structure (translated). No untranslated keys (no `[adaptive…]` placeholders). |  |  |
| 5 | **Resume mid-flow** | Start scenario 2, answer 3 questions, refresh the page | Persisted state restored. Adaptive context preserved. `assessment_resumed` telemetry fires. No re-prompt for org context. |  |  |
| 6 | **Resume with version mismatch** | Manually edit localStorage `routedBankVersion` to `0.9.0`, refresh | App re-routes silently (calls `routeQuestionBank` again). No user-visible error. Telemetry `assessment_routed` fires on rehydrate. |  |  |
| 7 | **Corrupted persisted state** | Replace localStorage payload with `{ "garbage": true }`, refresh | App falls back to consent step gracefully. No console error visible to user. |  |  |
| 8 | **Telemetry privacy** | Throughout scenario 1, watch `/api/icra/telemetry` POST bodies | No body contains org name, free text, email, IP, or per-question IDs. All metadata values ≤ 64 chars. ≤ 8 metadata keys. |  |  |
| 9 | **Accessibility — keyboard only** | Complete scenario 1 using only Tab/Shift+Tab/Enter/Space/Arrow keys | Every interactive element reachable. Adaptive card heading receives focus when shown. Radio groups have visible focus rings. |  |  |
| 10 | **Accessibility — screen reader (NVDA or VoiceOver)** | Complete scenario 1 with a screen reader | Adaptive card announces as a heading. Bands read clearly. Continue button announces label + state. Section progress announced via `aria-live`. |  |  |
| 11 | **PDF report** | After scenario 2 submit, visit `/api/icra/report/:id` (with a paid tier set) | PDF downloads. "Adaptive Interpretation Context" section appears (if Part 5 wiring is enabled). Bands match scenario profile. |  |  |

---

## Sign-off

- [ ] All 11 scenarios pass.
- [ ] No console errors visible to the respondent in any scenario.
- [ ] Network tab shows no fourth-party trackers added by the adaptive surface.
- [ ] Tested on Chrome (latest), Firefox (latest), and Safari (latest).

**Tester:** ________________________  **Date:** _____________

**Status:** ☐ GO  ☐ NO-GO  ☐ GO-WITH-NOTES (notes below)

---

## Recovery / Escape Hatches

If a respondent reports a stuck flow:

1. Ask them to refresh — persisted state will reload.
2. If still stuck, ask them to clear `localStorage` for `union-eyes-icra-*` keys.
3. As an absolute last resort, the assessment can be resumed via the assessment ID printed in the URL once submitted.

The adaptive routing layer does NOT block submission on its own — every fallback path defers to the full question bank. Routing failures are visible in `assessment_routed` telemetry with `safeDefaultUsed=true`.
