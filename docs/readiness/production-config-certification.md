# Production Configuration Certification (Phase 5)

- **As of:** 2026-07-03 · verified via Azure CLI (env var **names/mode values only**,
  no secret values printed).

## Verdict

```
PRODUCTION CONFIG: FAIL-CLOSED (PASS WITH ONE NOTE)
```

## Checks (union-eyes production container app)

| Check | Result | Evidence |
| --- | --- | --- |
| `DEBUG`/dev mode off | ✅ | `NODE_ENV=production`, `UE_ENVIRONMENT=production`, `NZILA_MODE=prod` |
| No default-org fallback | ✅ | `UE_ALLOW_DEFAULT_ORG` **absent** from prod env (BR-6 fail-closed) |
| Env isolation | ✅ | `ENVIRONMENT_ISOLATION=full` |
| Secrets not plaintext | ✅ | `SECRET_TOPOLOGY=aca-kv-integrated`; secrets in ACA secret store (`db-password`, `database-url`, `django-secret`, `enc-key`, `pii-key`, …) |
| No staging/local DB in prod | ✅ (indirect) | `PGHOST`/`DATABASE_URL` are ACA secrets; prod DB `nzila-os-union-eyes-prod-db` is dedicated |
| Demo/synthetic mode | ⚠️ NOTE | `UE_DEMO_PROFILE=cupe4373` / `NEXT_PUBLIC_UE_DEMO_PROFILE=cupe4373` present in prod |

## The one NOTE

`UE_DEMO_PROFILE=cupe4373` is set in production. **Clarified (Phase 5C):** in code
(`apps/union-eyes/lib/config/env-validation.ts`) this is a **zod enum constrained
to the single value `'cupe4373'`**, consumed by `apps/union-eyes/lib/dashboard/role-experience.ts`
as a **UI role-experience profile** for the CUPE tenant — **not** a synthetic-data or
demo-seeding mode. Verdict: acceptable (pilot-tenant UI profile); config is fail-closed.

## Method / limits

- Values shown are non-secret mode flags. Secret values were never queried/printed.
- A dedicated `tooling/scripts/validate-production-config-evidence.mjs` validator is
  **not** added this pass (it would need a committed, redacted evidence snapshot to
  check against; deferred to avoid a narrative-only gate).
