# Auth Migration — Final Status

> **Status**: Migration complete. Clerk is fully replaced by `@nzila/platform-auth`.
> **Date**: April 2026
> **Owner**: platform-team

---

## Summary

All 17 Nzila OS applications have been migrated from Clerk to the in-house
`@nzila/platform-auth` package, which provides:

- **Email / password** authentication (Argon2id, PG sessions)
- **Microsoft Entra ID** SSO (optional, for enterprise tenants)
- **Org-scoped multi-tenancy** via `getOrganizationIdForUser()`

Clerk API keys, webhooks, and SDK imports are no longer used at runtime.

---

## What Remains

### A) Legacy Database Fields (DO NOT REMOVE)

These columns exist in production databases and historical audit records.
Removing them would destroy audit trail integrity.

| Location | Field | Reason |
|----------|-------|--------|
| `apps/union-eyes/services/financial-service/src/db/schema.ts` | `clerkUserId` in `user_uuid_mapping` | Maps legacy Clerk user IDs to platform UUIDs |
| `apps/zonga/backend/auth_core/models.py` | `clerk_org_id`, `clerk_user_id` | Legacy sync fields from Clerk webhook era |
| `apps/console/lib/audit-db.ts` | `actorClerkUserId` | Historical audit events reference Clerk actor IDs |
| `apps/console/lib/governance/state-machine.ts` | `actorClerkUserId` | Passes legacy actor ID to audit log |
| `apps/control-plane/server/db-bridge.ts` | `actorClerkUserId` | Control plane audit bridge |
| Drizzle migration files | Various | Immutable migration history |
| Django migration files | Various | Immutable migration history |

**Service-layer aliases** exist so application code uses `userId`/`orgId`:
- `getOrganizationIdForUser()` — resolves app-level org from platform auth
- `auth().userId` — returns platform user ID (not Clerk ID)

### B) Backward-Compatibility Aliases (Remove post-GA+6mo)

| Location | Alias | Target |
|----------|-------|--------|
| `packages/platform-auth/src/entra/server.ts` | `clerkMiddleware` | → `authMiddleware` |
| `apps/union-eyes/backend/auth_core/authentication.py` | `ClerkAPIKeyAuthentication` | → `APIKeyAuthentication` |
| `apps/union-eyes/backend/auth_core/urls.py` | Route name `clerk-webhook` | Backward-compat webhook route |

**Removal timeline**: After GA + 6 months, once all external consumers have updated.

### C) Django Webhook Handlers (Decommission Q3 2026)

Four Django backends still contain Clerk webhook handlers that were used for
user/org sync. These are **NOT called at runtime** — the Clerk webhook secret
is no longer configured in production.

| App | File | Status |
|-----|------|--------|
| union-eyes | `backend/auth_core/views.py` | Webhook handler present, not invoked |
| agrimo | `backend/auth_core/views.py` | Webhook handler present, not invoked |
| abr | `backend/auth_core/views.py` | Webhook handler present, not invoked |
| zonga | `backend/auth_core/views.py` | Webhook handler present, not invoked |

**Removal plan**: Delete webhook views and URL routes in Q3 2026 cleanup sprint.

### D) Stale Documentation (Marked ARCHIVAL)

The following documents reference Clerk for historical context.
They are marked `<!-- ARCHIVAL — non-authoritative -->` where appropriate:

- `docs/platform/AUTH_MIGRATION_STATUS.md` — Migration journal
- `docs/platform/MIGRATION_NOTES.md` — Code migration notes
- `docs/migration/` — Various legacy migration docs
- `governance/docs/LEGACY_README.md` — Pre-platform-auth documentation
- `docs/archive/` — Archived build logs

### E) Provisioning Scripts (Archive)

Legacy Clerk provisioning scripts — no longer functional:

- `scripts/zonga-clerk-seed.sql`
- `scripts/zonga-clerk-provision.mjs`
- `scripts/provision-all-test-users.mjs`
- `scripts/clerk-provision-pilot-orgs.mjs`
- `tooling/staging-certification/clerk-pilot-orgs.cert.ts`

---

## Future Removal Path

| Phase | Timeline | Action |
|-------|----------|--------|
| GA | April 2026 | Ship with current state — aliases active, webhooks dormant |
| GA + 3mo | July 2026 | Remove staging Clerk env vars from Container Apps |
| GA + 6mo | Oct 2026 | Remove backward-compat aliases (`clerkMiddleware`, etc.) |
| GA + 9mo | Jan 2027 | Delete Clerk webhook handlers from Django backends |
| GA + 12mo | Apr 2027 | Drop `clerk_*` columns via migration (after audit archive) |

---

## Verification

```bash
# Confirm no Clerk runtime imports in TypeScript apps
grep -r "from '@clerk" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __mocks__

# Confirm no Clerk env vars in production
az containerapp show -n nzila-os-web -g nzila-canada-staging-rg --query "properties.template.containers[0].env[?starts_with(name, 'CLERK')]"
```
