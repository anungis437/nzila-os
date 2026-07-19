# Production Certification

**Canonical production verdict for `nzila-os`.** All readiness docs must defer to
this file for the current production status.

- **As of:** 2026-07-03
- **Branch:** `main`
- **Commit:** `0e95c11438b21fe801e624256b01930921c065a6`
- **Evidence source:** [full-production-readiness-delta.md](full-production-readiness-delta.md)

---

## Verdict

```
PRODUCTION VERDICT: PRODUCTION READY
```

This verdict is computed from executable gates, not narrative. It uses only the
three permitted statuses: `PRODUCTION READY`, `PRODUCTION READY WITH EXCEPTIONS`,
`NOT PRODUCTION READY`. Both security rotations (storage key + Cloudflare API
token) are **closed**; the only remaining items are LOW/DEFERRED and do not block
the live production runtime.

## Basis (executable, reproducible)

| Gate | Command | Exit | Status |
| --- | --- | --- | --- |
| Final GO | `pnpm final:go` | 0 | **CERTIFIED** — DEV/STAGING/DEMO/PILOT/PROD GO |
| Live readiness | `pnpm validate:live-readiness` | 0 | PASSED |
| Infra convergence | `pnpm validate:infra-convergence` | 0 | PASSED (GO WITH EXCEPTIONS) |
| Production surface | `pnpm validate:production-surface` | 0 | FROZEN |
| Deploy authority | `pnpm validate:production-deploy-authority` | 0 | BOUNDED |
| BR-6 org context | `pnpm validate:br6-org-context` | 0 | CLOSED |
| Docs / gate authority | `validate:docs` / `gate-authority:validate` / `selftest` | 0 | PASS |

## Production runtime (az-verified, live)

`union-eyes` (app.unioneyes.app), `web` (www.nzilaventures.com), `partners`
(partners.nzilaventures.com) — all isolated in `nzila-canada-prod-env`,
**digest-pinned**, live **200 + valid TLS**, backed by a prod DB with
30d retention / geo-redundant / Zone-redundant HA, deployed via env-scoped OIDC.

## Exceptions (owner-tracked)

1. ~~Rotate the `nzilacanadastore` storage key~~ — **CLOSED (2026-07-03):** key rotated by owner; `partners-prod` secret refreshed + restarted (healthy 200); **staging partners plaintext env moved to a secret reference** — no plaintext key remains on either app.
2. ~~Rotate the Cloudflare API token used for the DNS cutover~~ — **CLOSED (2026-07-03):** token rotated/revoked by owner. Repo scan confirms **no token value** in tracked files (only env-var names/placeholders + unrelated `CLOUDFLARE_R2_*` storage vars).
3. Apex `nzilaventures.com` managed cert finishing provisioning (`www` is canonical and live). — LOW, non-blocking.
4. Production metric alert rules for web/partners (action group `ue-prod-ops-alerts` exists). — LOW.
5. Broader automated cross-app E2E — DEFERRED/tracked.

No critical/high security exception remains.

## Definition of done

- [x] `pnpm final:go` passes (CERTIFIED)
- [x] `pnpm validate:live-readiness` passes
- [x] `pnpm validate:infra-convergence` passes
- [x] BR-6 closed
- [x] union-eyes/web/partners graduated with isolated prod runtime + prod domain + TLS
- [x] Deploy path digest-pinned, OIDC, no unmanaged long-lived credential
- [x] Production promotion governed
- [x] Docs synchronized to this file
- [x] Operational runbooks present (`docs/runbooks/production-{rollback,incident-response}.md`)
- [x] This certification internally consistent with executable gates
- [x] Security exceptions (storage key + Cloudflare API token rotation) closed — verdict is `PRODUCTION READY`

Every box is checked with real evidence. Verdict: **PRODUCTION READY**.
