# 06 — Accessibility and Bilingual Parity (G11)

## Correction

A first draft concluded no SAGE UI existed, so accessibility was untestable. That
was wrong (see 01). SAGE operator UI exists in the merged repository, so
automated accessibility **can** be — and now is — tested against those surfaces.

## Automated accessibility (repository surfaces) — PASS

A new test, `apps/platform-admin/lib/sage/__tests__/accessibility.test.tsx`, runs
`axe-core` (added as a platform-admin devDependency) against existing SAGE
operator components under jsdom, and asserts **no serious/critical** WCAG
violations on control-level rules:

- `CreateExportRequestForm`
- `ExportRequestList` (independent approval controls)
- `ExportPackageList` (hashes + internal download)
- `RecordsLifecyclePanel` (retention / hold / destruction)

Rules asserted include: `button-name`, `link-name`, `label`,
`aria-required-attr`, `aria-valid-attr(-value)`, `aria-roles`,
`aria-allowed-attr`, `aria-command-name`, `aria-input-field-name`,
`aria-toggle-field-name`, `duplicate-id-active`, `form-field-multiple-labels`,
`select-name`.

The same test file asserts **SAGE locale-key parity** for the `sage`,
`sageDelivery` and `sageRecords` namespaces across `en`, `en-CA`, `fr` and
`fr-CA` (identical key sets).

Result: **13/13 assertions pass** (4 axe component checks + 9 locale-parity
checks), clean exit.

### Scope and limits of the automated evidence

- This is **repository-level** accessibility of existing operator surfaces only.
- jsdom cannot evaluate colour-contrast; that rule is reported by axe as
  *incomplete*, not a violation, and is out of scope here.
- It covers implemented operator surfaces; it does **not** fabricate missing
  screens, and it does **not** cover a full page shell (landmark/region rules).

## Not proven

```
Deployed accessibility:            NOT_PROVEN (no deployed SAGE surface)
Manual keyboard pass:              NOT_PROVEN (requires a named human)
Manual screen-reader pass:         NOT_PROVEN (requires a named human)
Colour-contrast (rendered):        NOT_PROVEN via jsdom (needs browser/Playwright)
```

## Status

**G11 — NOT_PROVEN.** Bilingual parity is proven and automated component
accessibility now passes for existing surfaces, but deployed accessibility and
the manual keyboard + screen-reader pass by a named human are outstanding.

```
B-004 — Accessibility (deployed + manual pass)
Severity: HIGH
Status: open
```

A named human must still complete the manual keyboard and screen-reader pass;
self-certification is not permitted.
