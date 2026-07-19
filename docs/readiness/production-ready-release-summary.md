# Production-Ready Release Summary

**Production readiness baseline for `nzila-os`.** This file records the certified
state at the moment the production-readiness commit package was created. New
features/changes should be gated against this baseline rather than continuing to
harden indefinitely.

- **Canonical verdict authority:** [production-certification.md](production-certification.md)

---

## Final verdict

```
FINAL VERDICT: PRODUCTION READY
```

## Date / time

- **As of:** 2026-07-03
- **Branch:** `main`
- **Commit hash before this commit:** `0e95c11438b21fe801e624256b01930921c065a6`

## Apps certified (production scope)

| App | Runtime | Identity |
| --- | --- | --- |
| `union-eyes` | `nzila-os-union-eyes-prod` (isolated `nzila-canada-prod-env`) | digest-pinned |
| `web` | `nzila-os-web-prod` (isolated `nzila-canada-prod-env`) | digest-pinned |
| `partners` | `nzila-os-partners-prod` (isolated `nzila-canada-prod-env`) | digest-pinned |

All backed by a dedicated production Postgres (30d retention, geo-redundant,
Zone-redundant HA) and deployed via env-scoped OIDC.

## Domains certified (live)

| Domain | Health | TLS |
| --- | --- | --- |
| `app.unioneyes.app/api/health` | HTTP 200 | valid (verified) |
| `www.nzilaventures.com` | HTTP 200 | valid (verified) |
| `partners.nzilaventures.com` | HTTP 200 | valid (verified) |
| `nzilaventures.com` (apex) | cert `Pending` | LOW / non-blocking — `www` is canonical |

## Gates passed

| Gate | Command | Result |
| --- | --- | --- |
| Production surface | `pnpm validate:production-surface` | PASS (0) |
| Deploy authority | `pnpm validate:production-deploy-authority` | PASS (0) |
| BR-6 org context | `pnpm validate:br6-org-context` | PASS (0) |
| Org resolver guardrail | `pnpm validate:org-resolver-guardrail` | PASS (0) |
| Live readiness | `pnpm validate:live-readiness` | PASS (0) |
| Infra convergence | `pnpm validate:infra-convergence` | PASS (0) |
| Docs consistency | `pnpm validate:docs` | PASS (0) |
| Gate authority | `pnpm gate-authority:validate` | PASS (0) |
| Gate authority selftest | `pnpm gate-authority:selftest` | PASS (0) |
| Final GO | `pnpm final:go` | PASS (0) — DEV/STAGING/DEMO/PILOT/PROD GO |

## Security exceptions closed

1. **Storage key (`nzilacanadastore`)** — CLOSED (2026-07-03). Key rotated by owner;
   `partners-prod` secret refreshed + restarted (healthy 200); staging partners
   plaintext env moved to a secret reference. No plaintext key on either app.
2. **Cloudflare API token (DNS cutover)** — CLOSED (2026-07-03). Token rotated/revoked
   by owner. Repo scan confirms no token value in tracked files (only env-var
   names/placeholders and unrelated `CLOUDFLARE_R2_*` storage vars; `cfut_` literal = 0 hits).

## Remaining LOW / non-blocking items

| Item | Severity | Blocking |
| --- | --- | --- |
| Apex `nzilaventures.com` managed cert `Pending` (`www` is canonical) | LOW | No |
| Production metric alert rules for web/partners (action group `ue-prod-ops-alerts` exists) | LOW | No |
| Broader automated cross-app E2E | DEFERRED | No |

## Files changed summary (this commit package)

**Modified (tracked):**

- `.github/workflows/` — `canary-deploy`, `deploy-console`, `deploy-partners`, `deploy-web`, `retire-legacy-union-eyes-ca` (removed long-lived credential fallbacks; fail-closed OIDC; console de-scoped from canary/prod)
- `apps/union-eyes/lib/organization-utils.ts` (+ test) — BR-6 fail-closed org resolver
- `apps/union-eyes/services/{clc/remittance-notifications,financial-service/.../payment-collection-workflow,twilio-sms-service}.ts` — removed default-org fallbacks
- `governance/gates/gate-authority-registry.json` — registered 3 new production validators
- `governance/release/deployment-inventory.json` — corrected production topology / isolation
- `scripts/release/resolve-deploy-apps.ts` — bounded production eligibility
- `package.json` — new validator scripts
- `reports/doc-consistency.{json,md}` — regenerated

**Added (tracked):**

- `docs/readiness/` — production certification corpus (this file + isolation/OIDC/backup/DNS-TLS/config/graduation/runtime-artifact certs, delta, runtime inventory)
- `docs/nzila-finalization/` — finalization corpus (index + per-area reviews + GO program)
- `docs/nzila-infrastructure-convergence/` — live infrastructure certification
- `docs/nzila-live-audit/` — live audit corpus
- `docs/runbooks/production-{rollback,incident-response}.md`
- `governance/readiness/production-surface.json`
- `governance/release/production-exceptions.json`
- `tooling/scripts/validate-{production-surface,production-deploy-authority,br6-org-context}.mjs`

**Not committed (repo convention):** `proof-artifacts/*` is gitignored (only its
`README.md` is tracked). The live-evidence artifacts (finalization manifest,
sanitized command log, certifications, attestations) remain local by design; the
tracked certification corpus under `docs/` is authoritative in-repo.
