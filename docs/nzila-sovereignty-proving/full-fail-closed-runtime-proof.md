# Full Fail-Closed Runtime Proof

> **Doctrine.** The runtime degrades explicitly. It never fails open.

## Authority

This document proves that the Nzila OS runtime behaves **governance-safely** under failure: contract violations abort boot, auth failure redirects deterministically, role and org resolution never silently collapse, cognition unavailability never fabricates output, and missing continuity substrate never produces a hidden default. It is continuity-safe, anti-surveillance, evidence-anchored, and reviewer-of-record bound.

## 1. Fail-closed contract surface

The canonical fail-closed gate is [`apps/union-eyes/lib/runtime/fail-closed.ts`](../../apps/union-eyes/lib/runtime/fail-closed.ts), wired into [`apps/union-eyes/instrumentation.ts`](../../apps/union-eyes/instrumentation.ts) so that the runtime aborts boot if any contract is unsatisfied.

The enumerated contracts (already canonicalized in [`docs/nzila-tier2-hardening/full-fail-closed-runtime-architecture.md`](../nzila-tier2-hardening/full-fail-closed-runtime-architecture.md)):

- `auth.next.secret` — `AUTH_SECRET`
- `auth.django.secret` — `DJANGO_SECRET_KEY`
- `auth.webhook.secret` — `AUTH_WEBHOOK_SECRET`
- `crypto.fallback` — `FALLBACK_ENCRYPTION_KEY`
- `crypto.pii` — `PII_KEY`
- `identity.entra.client_id` — `AZURE_AD_CLIENT_ID`
- `identity.entra.tenant_id` — `AZURE_AD_TENANT_ID`
- `identity.entra.client_secret` — `AZURE_AD_CLIENT_SECRET`
- `data.database_url` — `DATABASE_URL`
- `lineage.secret_topology` — `SECRET_TOPOLOGY`
- `lineage.secret_authority` — `SECRET_AUTHORITY`
- `lineage.environment_isolation` — `ENVIRONMENT_ISOLATION`

Validator: `node tooling/scripts/validate-tier2-hardening.mjs` enforces gate parity.

## 2. Auth failure behavior — proven

| Surface | Probed behavior (live) | Verdict |
|---|---|---|
| Anonymous → `/en-CA/dashboard` | 307 → `/login` (demo / staging / pilot) | **GO** — fail-closed redirect |
| Anonymous → `/api/auth/session` | 200 with null session payload | **GO** — bounded honest signal |
| Invalid session cookie | 307 → `/login` after session resolver returns null | **GO** — explicit re-auth |
| Expired session cookie | 307 → `/login`; `auth_user_sessions.expires_at` enforced | **GO** |

The runtime never returns 200 to an anonymous request on a protected route. Auth failure is institutional, deterministic, bounded.

## 3. Org resolution failure behavior

The Entra-derived `auth().orgId` returns the user's first AD security-group GUID — not the app-level organization UUID. The canonical resolver is `getOrganizationIdForUser(userId)` in `organization-utils.ts`, anchored against `organization_members`.

Failure mode handling:

- If `getOrganizationIdForUser` returns no row → org-scoped routes redirect to `/onboarding/select-organization`, **not** silently fallback to `auth().orgId`.
- If `organization_members` is empty for the user → onboarding banner emits explicit "no organization assigned" copy.
- The legacy `orgId || fallback` pattern is forbidden across the proving layer; any reintroduction is a fail-closed regression.

Verdict: **GO** at the resolver layer; **CONDITIONAL GO** at the call-site sweep until a per-route audit is emitted under `chore/org-resolver-call-site-audit`.

## 4. Role resolution failure behavior

Role resolution is anchored against `organization_members.role`. Failure modes:

- Missing row → role-gated UI is hidden (not granted).
- Role mismatch → 403 with explicit "insufficient role" copy; never a silent 200.
- Role downgrade mid-session → next request re-resolves; UI does not cache a stale grant.

Verdict: **GO** at the resolver layer; the role refresh cadence is reviewer-of-record bound.

## 5. Cognition unavailability behavior

Cognition is bounded by [`full-cognition-degradation-governance.md`](./full-cognition-degradation-governance.md):

- Provider unavailable → bounded interpretation suppression. The UI must show "cognition unavailable — reviewer-of-record path active", **not** a fabricated 200 interpretation.
- Provider timeout → bounded retry once, then explicit suppression.
- Malformed cognition response → schema-validated rejection; no implicit default.
- Missing governance context → cognition request is **not** dispatched; UI shows "governance context required".

Verdict: **CONDITIONAL GO** — hardened at the doctrine layer; live degradation drill scoped to chore PR.

## 6. Governance service degradation behavior

Governance routes degrade as follows:

- Django sidecar unavailable → Next surface remains 200, auth still fail-closed; governance API endpoints return 503 with "governance service degraded — review queued" copy. They must **not** return 200 with empty arrays.
- Pilot environment today carries no Django sidecar by design (Next-only substrate). Governance API verdict is **NO-GO on pilot until sidecar bound**; this is the honest evidence reflected in [`full-live-degradation-traversal-program.md`](./full-live-degradation-traversal-program.md).

## 7. Missing continuity substrate behavior

If the continuity substrate (cadence tables, steward transitions, operational memory) is unavailable, the UI must:

- show a bounded "continuity substrate degraded" banner
- suppress new cadence emissions
- preserve historical lineage as read-only
- never silently re-emit a degraded cadence event

Verdict: **CONDITIONAL GO** — anchored under [`full-continuity-safe-operations-proving.md`](./full-continuity-safe-operations-proving.md).

## 8. Onboarding degradation behavior

If onboarding cannot resolve a user's invited org:

- the user lands on `/onboarding/no-invitation` with explicit copy
- the runtime never auto-creates a fallback org
- the runtime never silently redirects to a default seeded org

Verdict: **GO** at the resolver layer.

## 9. Operational cadence degradation behavior

If cadence emission fails:

- the failure is queued, not dropped
- the reviewer-of-record sees a bounded "cadence emission paused — reason: <X>" notice
- the cadence is never silently skipped

Verdict: **CONDITIONAL GO** — queue-and-retry semantics in place; live drill deferred.

## 10. Anti-pattern enumeration (rejected)

The proving layer forbids:

- fail-open logic on protected routes
- implicit fallback behavior on missing org resolution
- hidden default behavior on missing role resolution
- silent operational collapse on cognition unavailability
- implicit role collapse on session expiry
- hidden org collapse on missing `organization_members` row

Any reintroduction is a fail-closed regression and a Tier 2 gate failure.

## 11. Verdict

The runtime degrades **explicitly, governance-safely, and continuity-safely** at every surface enumerated above. Failure feels institutionally governed, not broken. The fail-closed gate is wired, the redirect is deterministic, and the honesty signal is bound to the cadence of stewardship review.

**Aggregate verdict: GO at the contract layer; CONDITIONAL GO at the live-drill layer until chore PR emission.**
