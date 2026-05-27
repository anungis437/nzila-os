# Union Eyes — Runtime Authority Audit

Living audit of the Union Eyes runtime: every page route, every dashboard module,
every legacy surface, and the gating posture that protects them.

All numbers in this folder are derived from a real repository scan
(see `scan-snapshot.md`). They are not aspirational.

## Wave 1 deliverables

| # | Document | Purpose |
| - | -------- | ------- |
| 1 | [`scan-snapshot.md`](./scan-snapshot.md) | Raw counts and command provenance |
| 2 | [`full-page-route-authority-audit.md`](./full-page-route-authority-audit.md) | Every `page.tsx` enumerated with status |
| 3 | [`full-canonical-module-inventory.md`](./full-canonical-module-inventory.md) | 89 dashboard sections × verdict |
| 4 | [`full-legacy-surface-elimination.md`](./full-legacy-surface-elimination.md) | 17 verified retire candidates |
| 5 | [`full-feature-gating-hardening.md`](./full-feature-gating-hardening.md) | Current gating posture + gaps |

## Wave 2 deliverables (this revision)

| # | Document | Purpose |
| - | -------- | ------- |
| 6 | [`full-stakeholder-visibility-matrix.md`](./full-stakeholder-visibility-matrix.md) | Stakeholder × surface visibility |
| 7 | [`full-monetization-runtime-alignment.md`](./full-monetization-runtime-alignment.md) | Four-tier model × runtime gates |
| 8 | [`full-doctrine-alignment-sweep.md`](./full-doctrine-alignment-sweep.md) | Doctrine vs SaaS-framing inventory |

Real code in this revision: 12 new `layout.tsx` server-side gates across the
highest-risk dashboard surfaces (analytics-admin, billing-admin,
compliance-admin, debug, cross-union-analytics, sector-analytics,
executive-operating-intelligence, clc, pension/admin, pension/trustee,
strike-fund, employer-execution). E2E deny coverage extended in
`apps/union-eyes/e2e/authenticated-role-navigation.spec.ts`.

## Outstanding waves

| Wave | Doc | State |
| ---- | --- | ----- |
| 3 | Real deletions (portal/*, 6 soft-redirects) | Pending — flagged as confirmation-required (see legacy doc) |
| 4 | `full-executive-procurement-experience-audit.md` | Pending |
| 4 | Doctrine copy normalisation (sweep queue from doctrine doc) | Pending |
| 5 | `full-live-runtime-traversal-audit.md` | Pending — requires live `pnpm dev` traversal |
| 5 | `final-union-eyes-runtime-authority-review.md` | Pending — depends on all above |
| 10 | `wave10-platform-ontology-stabilization-review.md` | Complete — canonical continuity architecture convergence review |

## Validator

Run `node tooling/scripts/validate-runtime-authority-audit.mjs` to assert the Wave 1 docs exist and contain
their mandatory sections. The validator returns a non-zero exit code if any
required document or section is missing.
