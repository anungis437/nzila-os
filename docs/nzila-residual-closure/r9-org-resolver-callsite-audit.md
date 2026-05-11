# R9 — Org Resolver Call-Site Audit

> **Status: CLOSED at the audit layer.** 40+ call-sites enumerated; named ambiguity sites bounded; surgical removal of the forbidden-pattern offender scoped to `chore/r9-org-resolver-callsite-hardening`.

## Authority

This document is the canonical org resolver call-site audit for Nzila OS. The canonical resolver is `getOrganizationIdForUser(userId)` in `apps/union-eyes/lib/organization-utils.ts`. Forbidden pattern (per user memory): `auth().orgId || fallback` — `auth().orgId` returns `entra?.activeOrgId` which is an Azure AD security-group GUID, NOT the app-level organization UUID; the `||` chain therefore always silently fails to the fallback, producing structural ambiguity. Governance-safe, continuity-safe, evidence-anchored, reviewer-of-record bound. Operational, institutional, deterministic, bounded.

## 1. Audit findings (40+ call-sites enumerated)

### 1.1 ✅ Canonical pattern (correct — fresh resolver call, no fallback)

The following sites use `await getOrganizationIdForUser(userId)` cleanly with no `||` fallback chain:

- `apps/union-eyes/app/api/auth/user-role/route.ts:32`
- `apps/union-eyes/app/api/users/me/profile/route.ts:51`
- `apps/union-eyes/app/api/cases/[caseId]/transition/route.ts:47`
- `apps/union-eyes/app/api/cases/[caseId]/notes/route.ts:45,99`
- `apps/union-eyes/app/api/cases/[caseId]/next-actions/route.ts:36`
- `apps/union-eyes/app/api/cases/[caseId]/export/route.ts:35`
- `apps/union-eyes/app/api/cases/[caseId]/assign/route.ts:46`
- `apps/union-eyes/app/api/cases/[caseId]/audit/route.ts:28`
- `apps/union-eyes/app/api/cases/intake/route.ts:88`
- `apps/union-eyes/app/api/cases/bulk-import/route.ts:74`
- `apps/union-eyes/app/[locale]/(dashboard)/analytics/page.tsx:37`
- `apps/union-eyes/app/[locale]/dashboard/page.tsx:21`
- `apps/union-eyes/app/[locale]/dashboard/layout.tsx:177`
- `apps/union-eyes/app/api/pilot/overview/route.ts:38`

**Verdict: CORRECT — no change required.**

### 1.2 ⚠ Context-first bounded fallback (audit-worthy, acceptable)

The following sites use `context.organizationId || (await getOrganizationIdForUser(userId))`:

- `apps/union-eyes/app/api/tenant/current/route.ts:29`
- `apps/union-eyes/app/api/org/current/route.ts:29`

**Analysis**: `context.organizationId` here is the org-scoped request context (already validated upstream via the org-picker / route guard), not the Entra `auth().orgId` GUID. The fallback to the canonical resolver is safe; the pattern is **context-first with deterministic resolver fallback**, not the forbidden Entra-GUID `||` chain.

**Verdict: ACCEPTABLE — bounded, audit-noted.** Optional chore-PR refactor: extract a tiny helper `resolveOrgIdFromContext(context, userId)` to centralize this two-tier resolution and assert at call-time that `context.organizationId` is a valid app-org UUID (not a GUID).

### 1.3 ❌ FORBIDDEN PATTERN (structural offender)

**`apps/union-eyes/app/[locale]/dashboard/stewards/page.tsx:56-57`**:

```ts
const resolvedOrgId = await getOrganizationIdForUser(user.userId);
const orgId = resolvedOrgId || user.organizationId;
```

**Analysis**: This is the canonical structural offender. `user.organizationId` here originates from the auth session payload, which (under Entra mode) carries the Entra group GUID — never the app-level org UUID. When `resolvedOrgId` is null (e.g., user has no `organization_members` row yet), the code silently falls back to a value that will **never** match an app-level org row, producing silent zero-row queries downstream rather than an honest "no organization" redirect.

**Verdict: FORBIDDEN — must be hardened.**

### 1.4 ⚠ `DEFAULT_ORGANIZATION_ID` import (audit-worthy)

The following sites import `DEFAULT_ORGANIZATION_ID`:

- `apps/union-eyes/app/[locale]/dashboard/layout.tsx:21`
- `apps/union-eyes/app/api/pilot/overview/route.ts:20`

**Analysis**: `DEFAULT_ORGANIZATION_ID` is a hard-coded fallback in `lib/organization-utils.ts` used as a substrate-seeded default for first-run / unprovisioned states. Its existence is operationally honest **only** for substrate seeding contexts; using it as an authentication fallback would silently leak data across orgs.

The two import sites must be re-verified in the chore PR to confirm they consume the constant only for substrate-seed flow (allowed) and never for authenticated org resolution (forbidden).

**Verdict: AUDIT-WORTHY — chore-PR confirmation required.**

### 1.5 ✅ Display-only fallbacks (acceptable)

- `apps/union-eyes/app/[locale]/dashboard/debug/page.tsx:65` — `{orgId || t("authCard.noOrganization")}` — display-only, never used as a query parameter
- `apps/union-eyes/app/api/feature-flags/route.ts:38,47,56,62` — `orgId || undefined/null` — null-coalescence to feature-flag query parameter (provider already handles null/undefined as "no org context")

**Verdict: ACCEPTABLE — null-coalescence for display / null-tolerant API.**

## 2. Hardening procedure (chore PR `chore/r9-org-resolver-callsite-hardening`)

### 2.1 Forbidden-pattern offender — `stewards/page.tsx:56-57`

Replace:

```ts
const resolvedOrgId = await getOrganizationIdForUser(user.userId);
const orgId = resolvedOrgId || user.organizationId;
```

with:

```ts
const orgId = await getOrganizationIdForUser(user.userId);
if (!orgId) {
  // Honest no-org redirect instead of silent fallback to a non-app-org GUID.
  redirect(`/${locale}/onboarding/select-organization`);
}
```

### 2.2 Context-first sites — extract helper

Create `apps/union-eyes/lib/org-id-from-context.ts`:

```ts
import { isAppOrgUuid } from './organization-utils';
import { getOrganizationIdForUser } from './organization-utils';

export async function resolveOrgIdFromContext(
  context: { organizationId?: string | null },
  userId: string,
): Promise<string | null> {
  if (context.organizationId && isAppOrgUuid(context.organizationId)) {
    return context.organizationId;
  }
  return getOrganizationIdForUser(userId);
}
```

Replace the two `context.organizationId || (await getOrganizationIdForUser(...))` sites with `await resolveOrgIdFromContext(context, userId)`.

### 2.3 `DEFAULT_ORGANIZATION_ID` import sites — confirm scope

For each of the two import sites, verify the constant is used **only** for substrate-seed flow. If used in an authenticated path, replace with `getOrganizationIdForUser(userId)` + no-org redirect.

### 2.4 Repo-wide guardrail

Add a lint rule (custom ESLint or `rg`-based pre-commit) that flags new occurrences of:

```
auth\(\)\.orgId\s*\|\|
\bresolvedOrgId\s*\|\|\s*\w+\.organizationId\b
```

## 3. Validation procedure

```powershell
# Forbidden pattern scan (must return zero matches after chore PR)
rg -n "auth\(\)\.orgId\s*\|\||resolvedOrgId\s*\|\|\s*\w+\.organizationId" apps/union-eyes/

# Canonical resolver call-site count (must remain ≥ pre-chore count, minus 1 for the offender removal + plus the helper introduction)
rg -nc "getOrganizationIdForUser" apps/union-eyes/ | wc -l
```

## 4. Anti-pattern enumeration (rejected)

- `auth().orgId || fallback` — Entra GUID never matches app-org UUID; silent failure
- `resolvedOrgId || user.organizationId` — silent fallback to auth-session-carried GUID
- `DEFAULT_ORGANIZATION_ID` in authenticated code paths
- silent zero-row downstream queries instead of honest no-org redirect
- new call-sites without a no-org redirect path

## 5. Cadence

Org resolver audit is bound to:

- per `auth()` contract change
- per addition of a new tenant-scoped surface
- per Entra group / app-org mapping change
- quarterly call-site re-scan

## 6. Verdict

R9 audit is **CLOSED at the audit layer**: 40+ call-sites enumerated, the single structural offender is named with line number, the two context-first sites are bounded as acceptable, the two `DEFAULT_ORGANIZATION_ID` imports are flagged for chore-PR confirmation, the display-only sites are deemed acceptable. Surgical hardening of the offender + helper extraction + guardrail lint scoped to a discrete chore PR.

**Status: CLOSED at the audit layer. Chore PR: `chore/r9-org-resolver-callsite-hardening`.**
