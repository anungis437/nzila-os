# NzilaOS Adoption Checklist

This document tracks the adoption status of an NzilaOS-integrated application.

## Required Integration Points

| # | Integration | Status | Notes |
|---|-------------|--------|-------|
| 1 | `@nzila/db` — Org-scoped DAL | ⬜ | Use `lib/db-adapter.ts` |
| 2 | `@nzila/os-core` — evidence sealing | ⬜ | `scripts/evidence/` |
| 3 | Governance CI (`workflow_call`) | ⬜ | `.github/workflows/ci.yml` |
| 4 | CODEOWNERS — protect governance paths | ⬜ | `/CODEOWNERS` |
| 5 | Org terminology — no "tenant" refs | ⬜ | Search: `grep -ri tenant src/` |
| 6 | Contract tests call `pnpm contract-tests` | ⬜ | Min 1 Org boundary test |
| 7 | Evidence pack emitted on main-branch CI | ⬜ | `evidence/pack.json` + `seal.json` |
| 8 | `.npmrc` points to Org registry | ⬜ | `@nzila:registry=...` |

## Verification

Run from the NzilaOS monorepo root:

```bash
pnpm ga-check
```

All category-A and category-B gates must pass before GA certification.

## Evidence Lifecycle

```
collect (draft) → seal (SHA-256 + HMAC) → verify (CI or audit)
```

See [APP_ADOPTION_GUIDE.md](../../docs/platform/APP_ADOPTION_GUIDE.md) for full details.
