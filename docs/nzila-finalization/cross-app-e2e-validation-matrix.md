# Cross-App E2E Validation Matrix

Authority: `master-finalization-index.md`. As of 2026-07-03.

Per-app production validation, verified live via Azure CLI + HTTPS smoke. This is a
runtime validation matrix for the production surface, not a claim of an exhaustive
automated E2E suite.

| App | Prod runtime | Digest-pinned | Prod domain | HTTP | TLS | DB check |
| --- | --- | --- | --- | --- | --- | --- |
| union-eyes | `nzila-os-union-eyes-prod` | ✅ | app.unioneyes.app | 200/307 | valid | prod DB `nzila_os_prod` |
| web | `nzila-os-web-prod` | ✅ | www.nzilaventures.com | 200 | valid | no DB (none required) |
| partners | `nzila-os-partners-prod` | ✅ | partners.nzilaventures.com | 200 | valid | `/api/ready` 200 (prod DB) |

## Repo gate matrix (all green)

`validate:production-surface` · `validate:production-deploy-authority` ·
`validate:br6-org-context` · `validate:org-resolver-guardrail` ·
`validate:docs` · `gate-authority:validate` · `gate-authority:selftest`.

## Known follow-ups

- Broader automated cross-app E2E (Playwright) is tracked separately and is not
  claimed complete here. Runtime + gate validation is what is asserted.
