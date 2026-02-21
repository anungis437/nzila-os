# App Adoption Templates

This folder contains ready-to-copy templates for adopting NzilaOS governance
in any app repository (monorepo vertical or standalone).

## Contents

| Path | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI workflow using `workflow_call` governance templates |
| `scripts/evidence/collect.ts` | Evidence collection script (draft → artifacts → pack) |
| `scripts/evidence/seal.ts` | Evidence sealing script (pack → seal → verify) |
| `lib/db-adapter.ts` | Org-scoped DB adapter (`getReadDb` / `getWriteDb`) |
| `CODEOWNERS` | Governance path protection |
| `docs/platform/NZILAOS_ADOPTION.md` | Adoption tracking document |
| `docs/platform/CI_REQUIRED_CHECKS.md` | Required CI checks reference |
| `docs/platform/EVIDENCE_PACKS.md` | Evidence pack documentation |

## Usage

1. Copy the files you need into your repo
2. Adjust paths and package names as needed
3. Run `pnpm contract-tests` to verify setup
4. See [APP_ADOPTION_GUIDE.md](../../docs/platform/APP_ADOPTION_GUIDE.md) for full guide
