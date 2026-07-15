# 10 — Accessibility and Localization Proof

## Gate G11 status: NOT_PROVEN

Gate G11 combines **bilingual parity** (proven) and **accessibility** (not proven).
Because accessibility is not proven, the combined gate is **NOT_PROVEN**. See finding
**B-004**.

## Localization (bilingual parity) — PROVEN

The SAGE UI strings are present in all four locale bundles with equal top-level namespace
coverage:

| Locale | SAGE-namespaced top-level keys |
|---|---|
| `en.json` | 6 |
| `fr.json` | 6 |
| `en-CA.json` | 6 |
| `fr-CA.json` | 6 |

Namespaces cover workspace administration, evidence, governance, exports/delivery and
records lifecycle (retention, holds, destruction, tombstone) including error/denial
states. Canadian-French (`fr-CA`) inherits base French and overrides records-management
terminology. **Structural locale parity: PASS.** A line-by-line professional translation
review is an editorial condition, not proven here. No legal-identity overstatement:
"mailbox-verified"/"email-verified recipient" terminology is enforced (PASS).

## Accessibility — NOT_PROVEN (B-004)

| Requirement | Status |
|---|---|
| Automated accessibility tests (axe/jest-axe) | **NOT_PROVEN** — no automated a11y tooling present in `apps/platform-admin` |
| Keyboard-only operation | **NOT_PROVEN** — requires a running UI + manual pass |
| Visible focus, semantic labels, screen-reader names | **NOT_PROVEN** — requires a manual assistive-technology pass |
| Status not by colour alone | PARTIAL — records UI renders blocked reasons as text (design-proven); full audit NOT_PROVEN |
| Plain-language error messages | PARTIAL — typed errors map to localized messages; UX review NOT_PROVEN |

## Verdict

Gate **G11 = NOT_PROVEN**. Bilingual parity + no-identity-overstatement are proven, but
**accessibility (automated and manual) is not proven** — recorded as **B-004 (HIGH)**.
Closing G11 requires automated a11y coverage plus a documented keyboard/screen-reader pass
against a running UI.
