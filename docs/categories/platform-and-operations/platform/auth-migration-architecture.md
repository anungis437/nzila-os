# Auth Migration Architecture

## Canonical Authority

`@nzila/platform-auth` is the only canonical authentication authority for active platform runtime surfaces.

Resolution order for request identity:

1. Platform session cookie / opaque token (`nzila_session`)
2. Entra/NextAuth JWT fallback (when SSO enabled)
3. Service-to-service auth key (explicit backend-only paths)

Any new feature must integrate through `@nzila/platform-auth` adapters and shared auth context helpers.

## Legacy Compatibility Boundary

Legacy Clerk-era compatibility is restricted to:

- Historical data fields (`clerk_*` columns, audit actor aliases)
- Backward-compatible webhook aliases on existing endpoints
- Migration docs, archived runbooks, and snapshots

Legacy compatibility does not permit:

- New direct Clerk SDK imports (`@clerk/*`) in protected runtime apps
- New mandatory runtime env requirements based on Clerk secrets
- New authentication code paths that bypass platform-auth

## Enforcement

CI gates:

- `pnpm exec tsx scripts/validate-auth-authority.ts` blocks direct Clerk SDK adoption in protected surfaces.
- `pnpm exec tsx scripts/validate-truth-authority.ts` enforces registry/document/runtime coherence.
- `pnpm exec tsx scripts/validate-ga-state.ts` enforces certification state-machine claims.

## Migration Completion Criteria

Authentication migration is complete for a surface when all of the following are true:

- Runtime auth path depends only on `@nzila/platform-auth` and optional Entra federation.
- No direct Clerk provider SDK import remains in runtime code.
- Environment contract uses `AUTH_SECRET` (+ optional Entra vars), not Clerk-only keys.
- Legacy references are documented as compatibility-only or archived.
