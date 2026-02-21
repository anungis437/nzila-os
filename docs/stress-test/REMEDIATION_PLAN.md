# Remediation Plan — Enterprise Stress Test

<!-- markdownlint-disable MD024 -->

**Date:** 2026-02-20  
**Branch:** `main` @ `a505446`  
**Terminology:** Org / Org isolation (no "tenant")

---

## Priority Matrix

| PR # | Title | Severity | Blocks GA? |
| ------ | ------- | --------- | ----------- |
| REM-01 | Rate limiting for Next.js apps | ✅ CLOSED | Yes (closed PR #67) |
| REM-02 | Runtime Org isolation HTTP test harness | ✅ CLOSED | Yes (closed PR #67) |
| REM-03 | Privilege escalation regression tests | ✅ CLOSED | Yes (closed PR #67) |
| REM-04 | `DATA_EXPORT` audit action + route wiring | ✅ CLOSED | Yes (closed PR #67) |
| REM-05 | Health/readiness routes in Next.js apps | ✅ CLOSED | Yes (closed PR #67) |
| REM-07 | Audit chain verification API route (`/api/audit/verify-chain`) | ✅ CLOSED | No (post-sprint) |
| REM-08 | `pnpm run secret-scan` convenience script | ✅ CLOSED | No |
| REM-09 | Member management call-site audit coverage | ✅ CLOSED | No |
| REM-10 | `AUTH_CONFIG_CHANGE` audit action | ✅ CLOSED | No |
| REM-11 | Audit DB-level write constraints (trigger/RLS) | ✅ CLOSED | No (closed `059ce73`) |
| REM-12 | GitHub branch protection on `main` | ✅ CLOSED | Yes (closed 2026-02-20) |
| REM-13 | Org ID injected into `RequestContext` + every log | ✅ CLOSED | No (closed `059ce73`) |

> **All remediation items are closed as of 2026-02-20.** Post-launch: REM-06 (CSP nonce hardening) remains a 🟡 soft-pass for future hardening sprint.

PRs 6–10 (post-launch hardening) follow below.

---

## REM-01 — Rate Limiting for Next.js Apps

**Severity:** ❌ FAIL (HIGH)  
**Closes:** `E08-c`, Phase 5 gap  
**Evidence it fixes:** `grep` for `rateLimit|arcjet|upstash` in `apps/console/`, `apps/partners/`, `apps/web/` returns 0 results.

### Scope

All API routes in:

- `apps/console/app/api/**`
- `apps/partners/app/api/**`
- `apps/web/app/api/**` (if any)

### Implementation

Use [Arcjet](https://arcjet.com/) or `@upstash/ratelimit` + Upstash Redis for edge-compatible rate limiting in Next.js middleware.

**Recommended approach — Arcjet (zero Redis dependency, works on Vercel/Azure):**

```ts
// apps/console/lib/arcjet.ts
import arcjet, { tokenBucket } from '@arcjet/next'

export const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    tokenBucket({ mode: 'LIVE', refillRate: 60, interval: 60, capacity: 100 }),
  ],
})
```

```ts
// In middleware.ts (wraps clerkMiddleware)
import { aj } from '@/lib/arcjet'
const decision = await aj.protect(request)
if (decision.isDenied()) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
```

### Files to Change

| File | Change |
| ------ | -------- |
| `apps/console/package.json` | Add `@arcjet/next` |
| `apps/partners/package.json` | Add `@arcjet/next` |
| `apps/console/lib/arcjet.ts` | New — rate limit config |
| `apps/partners/lib/arcjet.ts` | New — rate limit config |
| `apps/console/middleware.ts` | Wrap `clerkMiddleware` with Arcjet check |
| `apps/partners/middleware.ts` | Wrap `clerkMiddleware` with Arcjet check |

### Tests to Add

```ts
// tooling/contract-tests/rate-limiting.test.ts
describe('Rate limiting — Next.js apps', () => {
  it('console middleware.ts imports and invokes rate limiter', () => {
    const content = readContent('apps/console/middleware.ts')
    expect(content.includes('@arcjet/next') || content.includes('rateLimit')).toBe(true)
  })
  it('partners middleware.ts imports and invokes rate limiter', () => { ... })
})
```

Integration: add Arcjet test mode for CI (`ARCJET_ENV=test` → always allow, but import verified).

---

## REM-02 — Runtime Org Isolation HTTP Test Harness

**Severity:** 🟡 SOFT PASS (Critical)  
**Closes:** `E04-h`, Phase 1 gaps F–J  
**Evidence it fixes:** `org-isolation.test.ts` only does static analysis; no HTTP-level cross-org breach proofs.

### Scope

New test file: `tooling/contract-tests/org-isolation-runtime.test.ts`  
OR integration test suite in `apps/console/app/api/__tests__/`

### Tests to Add (Mandatory)

```ts
describe('Org isolation — runtime HTTP proofs', () => {
  let orgAHeaders: Headers  // session claims entityId = ORG_A_ID
  let orgBHeaders: Headers  // session claims entityId = ORG_B_ID
  let orgAResourceId: string  // resource seeded under ORG_A

  beforeAll(async () => {
    // seed ORG_A resource
  })

  it('A. Cross-org READ blocked — OrgB cannot GET OrgA resource', async () => {
    const res = await fetch(`/api/entities/${ORG_A_RESOURCE_ID}`, { headers: orgBHeaders })
    expect(res.status).toBe(403)
  })

  it('B. Cross-org WRITE blocked — OrgB cannot POST to OrgA entity', async () => {
    const res = await fetch(`/api/entities/${ORG_A_ID}/actions`, {
      method: 'POST', headers: orgBHeaders, body: JSON.stringify({ type: 'test' })
    })
    expect(res.status).toBe(403)
  })

  it('C. Missing org context blocked — unauthenticated request returns 401', async () => {
    const res = await fetch(`/api/entities/${ORG_A_ID}/actions`, { method: 'GET' })
    expect(res.status).toBe(401)
  })

  it('D. Forged entityId in body is ignored — auth entityId from session wins', async () => {
    const res = await fetch(`/api/some-mutation`, {
      method: 'POST', headers: orgBHeaders,
      body: JSON.stringify({ entityId: ORG_A_ID })  // forged
    })
    // Should only operate on OrgB's context or 403
    expect([200, 403]).toContain(res.status)
    // If 200, response must NOT contain OrgA data
  })

  it('E. Error messages do not leak org existence', async () => {
    const res = await fetch(`/api/entities/${ORG_A_ID}/actions`, { headers: orgBHeaders })
    const body = await res.json()
    expect(body.error).not.toContain(ORG_A_ID)  // no leak of org ID in error
  })
})
```

### Files to Change / Create

| File | Change |
| ------ | -------- |
| `tooling/contract-tests/org-isolation-runtime.test.ts` | New — 5 runtime tests |
| `tooling/contract-tests/fixtures/orgs.ts` | New — seeded OrgA + OrgB fixtures |
| `apps/console/app/api/` route handlers | Verify `authorize()` call exists; add `authorizeEntityAccess()` where missing |
| `packages/os-core/src/policy/authorize.ts` | Ensure `authorizeEntityAccess()` is called from console routes for entity-level access |

### CI Integration

Add to `ci.yml` `contract-tests` job or a new `org-isolation-integration` job with a seeded test DB.

---

## REM-03 — Privilege Escalation Regression Tests

**Severity:** 🟡 SOFT PASS (Critical)  
**Closes:** Phase 2.3 gaps  
**Evidence it fixes:** `E05-f` — no test covering org admin → super_admin route escalation.

### Scope

New tests in `tooling/contract-tests/authz-regression.test.ts` (extend existing file) or new `privilege-escalation.test.ts`.

### Tests to Add

```ts
describe('Privilege escalation regression', () => {
  it('console:admin cannot call a console:super_admin-only action', () => {
    // Static: find route that requires ConsoleRole.SUPER_ADMIN
    // Verify that roleIncludes(ConsoleRole.ADMIN, ConsoleRole.SUPER_ADMIN) === false
    expect(roleIncludes(ConsoleRole.ADMIN, ConsoleRole.SUPER_ADMIN)).toBe(false)
  })

  it('partner:channel_sales cannot perform partner:channel_admin actions', () => {
    expect(roleIncludes(PartnerRole.CHANNEL_SALES, PartnerRole.CHANNEL_ADMIN)).toBe(false)
  })

  it('no role can self-elevate via Scope.ADMIN_USER_MANAGEMENT except SUPER_ADMIN + ADMIN', () => {
    const privilegedScopes = [Scope.ADMIN_USER_MANAGEMENT, Scope.ADMIN_SYSTEM]
    const allowedRoles = [ConsoleRole.SUPER_ADMIN, ConsoleRole.ADMIN]
    for (const role of Object.values({ ...ConsoleRole, ...PartnerRole, ...UERole })) {
      if (allowedRoles.includes(role as ConsoleRole)) continue
      const scopes = ROLE_DEFAULT_SCOPES[role]
      for (const ps of privilegedScopes) {
        expect(scopes).not.toContain(ps)
      }
    }
  })

  it('attempted escalation audit event is emitted (integration)', async () => {
    // Call a route with insufficient role → 403 → audit event emitted with action='authorization.denied'
    // Requires AUDIT_ACTIONS.AUTHORIZATION_DENIED to be added to taxonomy
  })
})
```

### Files to Change / Create

| File | Change |
| ------ | -------- |
| `tooling/contract-tests/privilege-escalation.test.ts` | New — 4+ tests |
| `apps/console/lib/audit-db.ts` | Add `AUTHORIZATION_DENIED: 'authorization.denied'` to `AUDIT_ACTIONS` |
| `packages/os-core/src/policy/authorize.ts` | Optionally emit audit event on `AuthorizationError` throw |

---

## REM-04 — `DATA_EXPORT` Audit Action + Route Wiring

**Severity:** 🟡 SOFT PASS + ❌ (Critical audit gap)  
**Closes:** `E06-i`, Phase 3.2 `DATA_EXPORT` gap  
**Evidence it fixes:** `AUDIT_ACTIONS` in `audit-db.ts` has no `DATA_EXPORT` or `DATA_EXPORT_REQUEST` action.

### Scope

- `apps/console/lib/audit-db.ts` — add to `AUDIT_ACTIONS`
- Any route that generates exports (year-end, document exports, cap table exports) — wire `recordAuditEvent`
- Add contract test asserting export routes call `recordAuditEvent`

### Files to Change

| File | Change |
| ------ | -------- |
| `apps/console/lib/audit-db.ts` | Add `DATA_EXPORT: 'data.export'`, `DATA_EXPORT_REQUEST: 'data.export_request'`, `AUTH_CONFIG_CHANGE: 'auth.config_change'` to `AUDIT_ACTIONS` |
| `apps/console/app/api/**/route.ts` (year-end, export routes) | Call `recordAuditEvent({ action: AUDIT_ACTIONS.DATA_EXPORT, ... })` |
| `tooling/contract-tests/audit-taxonomy.test.ts` | New — asserts `DATA_EXPORT` exists in taxonomy + export routes wire it |

### Tests to Add

```ts
describe('Audit taxonomy completeness', () => {
  it('AUDIT_ACTIONS includes DATA_EXPORT', () => {
    expect(AUDIT_ACTIONS.DATA_EXPORT).toBeDefined()
  })
  it('export route handlers call recordAuditEvent with DATA_EXPORT action', () => {
    const exportRoutes = findRouteFiles('console').filter(f => f.includes('export'))
    for (const route of exportRoutes) {
      const content = readContent(route)
      if (!content.includes('export')) continue
      expect(content.includes('recordAuditEvent') || content.includes('auditLog')).toBe(true)
    }
  })
})
```

---

## REM-05 — Health/Readiness Routes in Next.js Apps

**Severity:** 🟡 SOFT PASS (HIGH)  
**Closes:** `E09-g`, Phase 6.2 gap  
**Evidence it fixes:** No `app/api/health/route.ts` found in console or partners.

### Scope

Add lightweight health + readiness endpoints to console and partners apps.

### Implementation

```ts
// apps/console/app/api/health/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ status: 'ok', app: 'console', timestamp: new Date().toISOString() })
}

// apps/console/app/api/ready/route.ts
import { NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { sql } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ status: 'ready', db: 'ok' })
  } catch {
    return NextResponse.json({ status: 'not ready', db: 'unreachable' }, { status: 503 })
  }
}
```

Both routes are `isPublicRoute` in middleware (already pattern `/api/health/` is allowlisted in `org-isolation.test.ts`).

### Files to Change / Create

| File | Change |
| ------ | -------- |
| `apps/console/app/api/health/route.ts` | New |
| `apps/console/app/api/ready/route.ts` | New — DB ping |
| `apps/partners/app/api/health/route.ts` | New |
| `apps/partners/app/api/ready/route.ts` | New |
| `apps/console/middleware.ts` | Confirm `/api/health` in `isPublicRoute` allowlist |
| `tooling/contract-tests/health-routes.test.ts` | New — asserts health routes exist in both apps |

### Tests to Add

```ts
describe('Health routes', () => {
  for (const app of ['console', 'partners']) {
    it(`${app}: /api/health/route.ts exists`, () => {
      expect(existsSync(resolve(ROOT, `apps/${app}/app/api/health/route.ts`))).toBe(true)
    })
    it(`${app}: /api/ready/route.ts exists`, () => {
      expect(existsSync(resolve(ROOT, `apps/${app}/app/api/ready/route.ts`))).toBe(true)
    })
  }
})
```

---

## REM-06 — CSP Nonce Hardening (Post-Launch)

**Severity:** 🟡 SOFT PASS  
**Current state:** `unsafe-inline` + `unsafe-eval` in all Next.js CSP headers (required by RSC hydration).  
**Target:** Nonce-based CSP to eliminate `unsafe-inline` where possible.  

**Files:** `apps/*/next.config.ts`, `apps/*/middleware.ts`  
**Approach:** Next.js 15 [nonce support](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)

---

## REM-07 — Audit Chain Verification API Endpoint

**Severity:** 🟡 SOFT PASS  
**Status: ✅ CLOSED — route exists at `apps/console/app/api/audit/verify-chain/route.ts`**

Supports `chainType: 'audit' | 'ledger'` — verified by `audit-taxonomy.test.ts` assertions covering `existsSync` check + chain-type support. Auth: `requireEntityAccess` with platform bypass for `platform_admin`.

---

## REM-08 — `pnpm run secret-scan` Script

**Severity:** Minor gap  
**Status: ✅ CLOSED — script added to root `package.json` + lefthook.yml gitleaks hook fixed**

Script: `"secret-scan": "gitleaks detect --source . --config .gitleaks.toml --no-banner --verbose"`

Also fixed: lefthook pre-commit hook was using `npx gitleaks@latest` (which fails on Windows — gitleaks is a Go binary, not an npm package). Changed to `gitleaks` binary invocation directly.

---

## REM-09 — Call-Site Audit Coverage Tests

**Severity:** 🟡 SOFT PASS  
**Status: ✅ CLOSED — `people/route.ts` now calls `recordAuditEvent(AUDIT_ACTIONS.MEMBER_ADD)` + 7 new tests in `audit-taxonomy.test.ts`**

- Added `import { recordAuditEvent, AUDIT_ACTIONS }` to `apps/console/app/api/entities/[entityId]/people/route.ts`
- POST handler now emits `AUDIT_ACTIONS.MEMBER_ADD` after person creation
- New `describe('Audit Call-site — REM-09 member management')` block with 7 assertions

---

## REM-10 — `AUTH_CONFIG_CHANGE` Audit Action

**Severity:** 🟡 SOFT PASS  
**Status: ✅ CLOSED — already present in `AUDIT_ACTIONS` in `apps/console/lib/audit-db.ts`**

`AUTH_CONFIG_CHANGE: 'auth.config_change'` confirmed present at line 100. Covered by `audit-taxonomy.test.ts` assertion `'AUDIT_ACTIONS.AUTH_CONFIG_CHANGE is defined'`.
(No code change required — taxonomy already complete.)

---

## REM-12 — GitHub Branch Protection on `main`

**Severity:** ❌ CRITICAL FAIL (Zero-code, 30-minute fix)  
**Status: ✅ CLOSED 2026-02-20 via `gh api` (commit `2e1c224`)**  
**Configuration applied:**

| Setting | Value |
| --------- | ------- |
| Required status checks | `lint-and-typecheck`, `test`, `build`, `contract-tests` |
| Require branches up to date | `strict: true` |
| Enforce admins | `true` |
| Dismiss stale reviews | `true` |
| Require code owner reviews | `true` |
| Required approving reviews | 1 |
| Allow force pushes | `false` |
| Allow deletions | `false` |

Verified via `gh api .../branches/main/protection` — all fields confirmed in API response.

---

## REM-13 — Org ID in `RequestContext` and Log Entries

**Severity:** 🟡 HIGH SOFT PASS (GA target)  
**Discovered by:** GA Readiness Gate §2.2 — `RequestContext` interface has `userId`, `requestId`, `traceId` but no `orgId` / `entityId`.

### Current State

`packages/os-core/src/telemetry/requestContext.ts` — `RequestContext` interface:

```ts
export interface RequestContext {
  requestId: string
  traceId?: string
  spanId?: string
  userId?: string      // ✅ present
  startedAt: number
  appName?: string
  // orgId / entityId → MISSING ❌
}
```

### Fix

**Step 1 — Add `orgId` to `RequestContext`:**

```ts
// packages/os-core/src/telemetry/requestContext.ts
export interface RequestContext {
  requestId: string
  traceId?: string
  spanId?: string
  userId?: string
  orgId?: string        // ← ADD: entityId from AuthContext
  startedAt: number
  appName?: string
}
```

**Step 2 — Populate from `AuthContext` after `authorize()` resolves:**

```ts
// In each app's request handler wrapper or middleware
import { runWithContext, createRequestContext } from '@nzila/os-core/telemetry/requestContext'

const ctx = createRequestContext(req, { userId: auth.userId, orgId: auth.orgId })
return runWithContext(ctx, () => handler(req))
```

**Step 3 — Wire in `createRequestContext`:**

```ts
export function createRequestContext(
  req: ...,
  opts: { appName?: string; userId?: string; orgId?: string } = {},
): RequestContext {
  // ... existing ...
  return {
    requestId,
    traceId,
    spanId,
    userId: opts.userId,
    orgId: opts.orgId,    // ← ADD
    startedAt: Date.now(),
    appName: opts.appName,
  }
}
```

`logger.ts` `buildEntry()` already spreads `ctx` fields — once `orgId` is in `RequestContext`, it automatically appears on every log line. No logger changes needed.

### Files to Change

| File | Change |
| ------ | -------- |
| `packages/os-core/src/telemetry/requestContext.ts` | Add `orgId?: string` to interface + `createRequestContext` opts |
| `apps/console/app/api/` handler wrapper (or middleware) | Pass `auth.orgId` when creating request context |
| `apps/partners/app/api/` handler wrapper | Same |
| `tooling/contract-tests/telemetry-coverage.test.ts` | Extend: assert `orgId` present in log output for authenticated routes |

### Why This Matters

During a cross-org incident at 3 AM, every log line must identify which Org the request belongs to without requiring a cross-join against audit records. Without `orgId` in logs, incident response requires:

1. Find `requestId` in logs
2. Cross-reference `audit_events` to find `entityId`
3. Map `entityId` → org name

With `orgId` in logs:

1. `grep orgId=<suspect-org>` in log stream — done in 30 seconds.

---

## REM-11 — Audit DB-Level Write Constraints (Post-Launch)

**Severity:** 🟡 SOFT PASS  
**Source:** External v4 stress test — "DB-level constraints preventing audit updates/deletes"  
**Current state:** Hash chain integrity is enforced at the application layer (`computeEntryHash`, `verifyEntityAuditChain`). Migration content is tested (no `DROP`/`TRUNCATE`/`CASCADE DELETE` on `audit_events`). However, no PostgreSQL-level mechanism physically blocks `UPDATE` or `DELETE` on the `audit_events` table at the DB engine layer.

### Options (choose one)

**Option A — PostgreSQL trigger (recommended for strict append-only enforcement):**

```sql
-- packages/db/migrations/XXXX_audit_events_immutable.sql
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events rows are immutable (UPDATE/DELETE not permitted)';
END;
$$;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
```

**Option B — Row Level Security (alternative for multi-role DB setups):**

```sql
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
-- Grant INSERT only to the app role; deny UPDATE/DELETE
CREATE POLICY audit_insert_only ON audit_events FOR INSERT TO app_role WITH CHECK (true);
```

### Contract Test to Add

```ts
// tooling/contract-tests/audit-immutability.test.ts (extend)
it('audit DB migration adds immutability trigger or RLS policy', () => {
  const migrations = getMigrationFiles()
  const hasTrigger = migrations.some(f => {
    const c = readContent(f)
    return c.includes('prevent_audit_mutation') || c.includes('audit_events_no_update')
  })
  const hasRLS = migrations.some(f => readContent(f).includes('ROW LEVEL SECURITY'))
  expect(hasTrigger || hasRLS).toBe(true)
})
```

### Files to Change / Create

| File | Change |
| ------ | -------- |
| `packages/db/migrations/XXXX_audit_events_immutable.sql` | New — trigger or RLS policy |
| `tooling/contract-tests/audit-immutability.test.ts` | Extend — assert trigger/RLS migration exists |
| `docs/hardening/BASELINE.md` | Note DB-level audit immutability as closed |

### Why This Matters for Enterprise

Application-layer hash chains can be bypassed by a DB admin with direct access. The trigger/RLS approach means even a compromised DB credential cannot silently alter audit records — the mutation is rejected by the DB engine and would require DDL changes to circumvent (which themselves produce audit trails at the DB level).

Enterprise compliance frameworks (SOC 2 Type II, ISO 27001) will ask:

> "Can your DBAs silently delete audit records?"

Without this, the answer is technically yes.
