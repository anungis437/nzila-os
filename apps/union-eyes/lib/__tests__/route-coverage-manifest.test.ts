import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTH_MANDATORY_AUDIT_SERVICES, auditGap, kernelPending, scanRoutes } from '../../scripts/lib/route-coverage-scan'

/**
 * Route-coverage manifest and ratchets (UE-CONV-K-008). Every app/api route is recorded with how it authenticates,
 * what bounds its data, whether its writes are audited atomically and whether the authority kernel decides it.
 * Regenerate with `npx tsx scripts/generate-route-manifest.ts` from apps/union-eyes.
 */
const ROOT = join(__dirname, '..', '..')
const REGISTER = join(ROOT, '..', '..', 'docs', 'union-eyes', 'convergence', 'register')
const manifest = JSON.parse(readFileSync(join(REGISTER, 'ue-route-coverage-manifest.json'), 'utf8')) as { routes: ReturnType<typeof scanRoutes> }
const baselines = JSON.parse(readFileSync(join(REGISTER, 'ue-route-coverage-baselines.json'), 'utf8')) as { auditGap: string[]; kernelPending: string[] }
const fresh = scanRoutes(ROOT)

/** Mutating routes that are deliberately reachable without a session. Each is bounded by something other than identity. */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  'auth/forgot-password/route.ts': 'Anonymous by nature; returns a neutral message whether or not the account exists.',
  'auth/magic-link/request/route.ts': 'Anonymous sign-in request; returns a neutral message whether or not the account exists.',
  'contact/route.ts': 'Public contact form; forwards the enquiry to the CRM service.',
  'icra/telemetry/route.ts': 'Anonymous product telemetry for the public assessment; rate limited to 60 requests a minute.',
  'staging-proof/deadline-engine/scenario/route.ts': 'Staging proof harness. Answers only an image built for staging (build-time NEXT_PUBLIC_APP_ENV), with the runtime switches, an HMAC over a fresh timestamp and a single-use nonce; every run creates and retires its own synthetic organization.',
  'whop/unauthenticated-checkout/route.ts': 'Pre-account checkout; creates a Whop checkout session and always redirects to signup.',
  'workbook/checkout/route.ts': 'Public workbook purchase; verifies the workbook exists, then creates a Stripe checkout.',
  'workbook/start/route.ts': 'Public pseudonymous intake: creates a workbook with no tenant and no access to tenant data; the id is a bearer reference until an authenticated user claims it.',
}

describe('route coverage manifest (UE-CONV-K-008)', () => {
  it('is current: every route file is recorded exactly as the scanner sees it', () => {
    expect(manifest.routes).toEqual(fresh)
  })

  it('lists no mutating route without an authentication or authorization mechanism, except the documented public flows', () => {
    const unguarded = fresh.filter((e) => e.mutating && e.guard === 'NONE').map((e) => e.route)
    expect(unguarded.filter((r) => !(r in PUBLIC_BY_DESIGN))).toEqual([])
    expect(Object.keys(PUBLIC_BY_DESIGN).filter((r) => !unguarded.includes(r))).toEqual([])
  })

  it('bounds every public write with a control the route can be shown to carry', () => {
    const CONTROL: Record<string, RegExp> = {
      'auth/': /^$/, // limited per client IP by the proxy; asserted below
      'contact/route.ts': /guardPublicIntake/,
      'workbook/start/route.ts': /guardPublicIntake/,
      'workbook/checkout/route.ts': /guardPublicIntake/,
      'whop/unauthenticated-checkout/route.ts': /guardPublicIntake/,
      'icra/telemetry/route.ts': /rateLimit\(/,
      'staging-proof/deadline-engine/scenario/route.ts': /BUILD_APP_ENV:\s*process\.env\.NEXT_PUBLIC_APP_ENV/,
    };
    for (const route of Object.keys(PUBLIC_BY_DESIGN)) {
      const key = route.startsWith('auth/') ? 'auth/' : route;
      expect(CONTROL[key], `${route} needs a documented control`).toBeDefined();
      if (key === 'auth/') continue;
      expect(readFileSync(join(ROOT, 'app', 'api', route), 'utf8'), route).toMatch(CONTROL[key]);
    }
    expect(readFileSync(join(ROOT, 'proxy.ts'), 'utf8')).toMatch(/pathname\.startsWith\('\/api\/auth\/'\)[\s\S]*RATE_LIMITS\.AUTH_IP/);
  });

  it('puts the capability-token routes behind the capability limiter or their own limiter', () => {
    for (const e of fresh.filter((r) => r.mutating && r.guard === 'CAPABILITY_TOKEN')) {
      expect(readFileSync(join(ROOT, 'app', 'api', e.route), 'utf8'), e.route).toMatch(/guardPublicIntake|rateLimit\(|withClaimedWorkbookAccess/);
    }
  });

  it('never lets the audit gap grow: a new mutating route needs route-level atomic audit', () => {
    const current = fresh.filter(auditGap).map((e) => e.route)
    expect(current.filter((r) => !baselines.auditGap.includes(r))).toEqual([])
  })

  it('never lets the kernel-adoption backlog grow: a new case, document or message mutation is decided by the kernel', () => {
    const current = fresh.filter(kernelPending).map((e) => e.route)
    expect(current.filter((r) => !baselines.kernelPending.includes(r))).toEqual([])
  })

  it('has closed the kernel-adoption backlog: every case, claim, document and message mutation has a decision path', () => {
    expect(baselines.kernelPending).toEqual([]);
    expect(fresh.filter(kernelPending).map((e) => e.route)).toEqual([]);
  });

  it('removes a baseline entry when its route is fixed, so the ratchet only shrinks', () => {
    expect(baselines.auditGap.filter((r) => !fresh.some((e) => e.route === r && auditGap(e)))).toEqual([])
    expect(baselines.kernelPending.filter((r) => !fresh.some((e) => e.route === r && kernelPending(e)))).toEqual([])
  })

  it('treats a route as kernel-decided only when it imports the kernel or the kernel-backed case access service', () => {
    for (const e of fresh.filter((r) => r.kernel && r.guard !== 'DELEGATED')) {
      const source = readFileSync(join(ROOT, 'app', 'api', e.route), 'utf8')
      expect(source).toMatch(/lib\/authority|case-access-service|route-adapter|findReadableCase\(|requireCaseFilingCapacity\(|hasCaseFilingCapacity\(|requireKernelCaseAction\(/)
    }
  })

  it('counts a platform-auth service as audited only while its audit record is mandatory, not best-effort', () => {
    const authSrc = join(__dirname, '..', '..', '..', '..', 'packages', 'platform-auth', 'src')
    for (const [name, { file, proof }] of Object.entries(AUTH_MANDATORY_AUDIT_SERVICES)) {
      expect(readFileSync(join(authSrc, file), 'utf8'), name).toMatch(proof)
    }
  })
})
