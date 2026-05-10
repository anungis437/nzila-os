# Union Eyes — Runtime Authority Audit

Living audit of the Union Eyes runtime: every page route, every dashboard module,
every legacy surface, and the gating posture that protects them.

All numbers in this folder are derived from a real repository scan
(see `scan-snapshot.md`). They are not aspirational.

## Wave 1 deliverables (this revision)

| # | Document | Purpose |
| - | -------- | ------- |
| 1 | [`scan-snapshot.md`](./scan-snapshot.md) | Raw counts and command provenance |
| 2 | [`full-page-route-authority-audit.md`](./full-page-route-authority-audit.md) | Every `page.tsx` enumerated with status |
| 3 | [`full-canonical-module-inventory.md`](./full-canonical-module-inventory.md) | 89 dashboard sections × verdict |
| 4 | [`full-legacy-surface-elimination.md`](./full-legacy-surface-elimination.md) | 17 verified retire candidates |
| 5 | [`full-feature-gating-hardening.md`](./full-feature-gating-hardening.md) | Current gating posture + gaps |

## Outstanding waves

| Wave | Doc | State |
| ---- | --- | ----- |
| 2 | `full-stakeholder-visibility-matrix.md` | Pending — requires module-to-stakeholder mapping work |
| 3 | Real deletions (portal/*, 6 soft-redirects) | Pending — flagged as confirmation-required (see legacy doc) |
| 4 | `full-doctrine-alignment-sweep.md` | Pending |
| 4 | `full-monetization-runtime-alignment.md` | Pending |
| 4 | `full-executive-procurement-experience-audit.md` | Pending |
| 5 | `full-live-runtime-traversal-audit.md` | Pending — requires live `pnpm dev` traversal |
| 5 | `final-union-eyes-runtime-authority-review.md` | Pending — depends on all above |

## Validator

Run `pnpm validate:runtime-authority` to assert the Wave 1 docs exist and contain
their mandatory sections. The validator returns a non-zero exit code if any
required document or section is missing.
