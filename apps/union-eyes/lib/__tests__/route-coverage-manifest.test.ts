import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTH_MANDATORY_AUDIT_SERVICES, BALLOT_SECRECY_EXEMPT_ROUTES, COMPUTE_ONLY_ROUTES, READ_ONLY_POST_ROUTES, UNATTRIBUTABLE_WRITE_ROUTES, KERNEL_AUDITED_CALLS, auditGap, kernelPending, scanRoutes, summarize } from '../../scripts/lib/route-coverage-scan'

/**
 * Route-coverage manifest and ratchets (UE-CONV-K-008). Every app/api route is recorded with how it authenticates,
 * what bounds its data, whether its writes are audited atomically and whether the authority kernel decides it.
 * Regenerate with `npx tsx scripts/generate-route-manifest.ts` from apps/union-eyes.
 */
const ROOT = join(__dirname, '..', '..')
const REGISTER = join(ROOT, '..', '..', 'docs', 'union-eyes', 'convergence', 'register')
const manifest = JSON.parse(readFileSync(join(REGISTER, 'ue-route-coverage-manifest.json'), 'utf8')) as { routes: ReturnType<typeof scanRoutes>; summary: ReturnType<typeof summarize> }
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

  it('keeps the full 995-route summary in sync with the current scanner, not only route entries', () => {
    expect(manifest.summary).toEqual(summarize(fresh))
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

  it('treats the legacy event write alias as audited only while the canonical route remains tenant-scoped and atomically audited', () => {
    const alias = readFileSync(join(ROOT, 'app', 'api', 'events', '[id]', 'route.ts'), 'utf8')
    const canonical = readFileSync(join(ROOT, 'app', 'api', 'calendar', 'events', '[id]', 'route.ts'), 'utf8')
    expect(alias).toMatch(/canonicalPATCH\\(request/)
    expect(alias).toMatch(/canonicalDELETE\\(request/)
    expect(alias).toMatch(/from ['"]@\\/app\\/api\\/calendar\\/events\\/\\[id\\]\\/route['"]/)
    expect(canonical).toMatch(/withRLSContext\\(\\{ organizationId, userId \\}/)
    expect(canonical).toMatch(/eq\\(calendarEvents\\.organizationId, organizationId\\)/)
    expect((canonical.match(/await persistAtomicAudit\\(tx,/g) ?? []).length).toBe(2)
    expect(fresh.find((e) => e.route === 'events/[id]/route.ts')?.audit).toBe('ATOMIC_SERVICE')
  })

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
      expect(source).toMatch(/lib\/authority|case-access-service|download-issuance|ocr-authority|intake-lifecycle|route-adapter|findReadableCase\(|requireCaseFilingCapacity\(|hasCaseFilingCapacity\(|requireKernelCaseAction\(/)
    }
  })

  it('counts a platform-auth service as audited only while its audit record is mandatory, not best-effort', () => {
    const authSrc = join(__dirname, '..', '..', '..', '..', 'packages', 'platform-auth', 'src')
    for (const [name, { file, proof }] of Object.entries(AUTH_MANDATORY_AUDIT_SERVICES)) {
      expect(readFileSync(join(authSrc, file), 'utf8'), name).toMatch(proof)
    }
  })

  it('counts a case-assignment mutator as audited only while the store records its audit row on the same executor', () => {
    const store = join(__dirname, '..', 'authority', 'store')
    const mutations = readFileSync(join(store, 'mutations.ts'), 'utf8')
    expect(mutations).toMatch(/export async function insertRelationship[\s\S]*?auditAuthorityMutation\(exec[\s\S]*?export async function revokeRelationship/)
    expect(mutations).toMatch(/export async function revokeRelationship[\s\S]*?auditAuthorityMutation\(exec/)
    const lifecycle = readFileSync(join(store, 'lifecycle.ts'), 'utf8')
    expect(lifecycle).toMatch(/export async function assignCase[\s\S]*?return insertRelationship\(/)
    expect(lifecycle).toMatch(/export async function revokeCaseAssignment[\s\S]*?await revokeRelationship\(/)
    expect(KERNEL_AUDITED_CALLS.length).toBeGreaterThan(0)
  })

  it('exempts from per-ballot audit only the ballot-casting routes, and only while they cast a secret ballot', () => {
    const api = join(__dirname, '..', '..', 'app', 'api')
    expect(BALLOT_SECRECY_EXEMPT_ROUTES).toHaveLength(2)
    for (const route of BALLOT_SECRECY_EXEMPT_ROUTES) {
      const source = readFileSync(join(api, route), 'utf8')
      expect(source, route).toMatch(/castVote\(/)
      expect(source, route).not.toMatch(/persistAtomicAudit|buildUnionEvidencePack\([^)]*actorId[^)]*optionId/)
    }
  })

  it('counts performAuditedOperation as audited only while it records the intent before running the operation', () => {
    const source = readFileSync(join(__dirname, '..', 'audit', 'operation-audit.ts'), 'utf8')
    const intent = source.indexOf("entry('requested')")
    const run = source.indexOf('await operation()')
    const outcome = source.indexOf("entry('completed')")
    expect(intent).toBeGreaterThan(-1)
    expect(intent).toBeLessThan(run)
    expect(run).toBeLessThan(outcome)
    // a failure to record the intent must stop the operation
    expect(source).toMatch(/catch \(error\) \{[\s\S]*?throw new OperationAuditError[\s\S]*?\}\s*\n\s*try \{\s*\n\s*const result = await operation\(\)/)
  })

  it('keeps a route on the compute-only list only while neither it nor its calculators write or hold a database client', () => {
    const root = join(__dirname, '..', '..')
    const WRITE = /\.(insert|update|delete)\(|\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM)\b|\.transaction\(/i
    const DB_VALUE_IMPORT = /^import\s+(?!type\b)[^\n]*from\s+['"]@\/db(\/db)?['"]/m
    for (const [route, modules] of Object.entries(COMPUTE_ONLY_ROUTES)) {
      const source = readFileSync(join(root, 'app', 'api', route), 'utf8')
      expect(source, route).not.toMatch(WRITE)
      for (const mod of modules) {
        const text = readFileSync(join(root, mod), 'utf8')
        expect(text, mod).not.toMatch(WRITE)
        expect(text, mod).not.toMatch(DB_VALUE_IMPORT)
      }
    }
    expect(readFileSync(join(root, 'app', 'api', 'admin/billing-cycles/preview/route.ts'), 'utf8')).toMatch(/dryRun:\s*true/)
  })

  it('keeps a route on the read-only POST list only while it holds no write and imports nothing that changes state', () => {
    const WRITE = /\.(insert|update|delete)\(|\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|TRUNCATE)\b|putBlob\(|deleteBlob\(|\.transaction\(/i
    const MUTATING_NAME = /^(set|update|create|delete|remove|insert|upsert|enable|disable|toggle|track|save|write|revoke|grant|assign|apply|persist|store|record|send|submit|approve|import|sync)[A-Z_]/
    for (const route of READ_ONLY_POST_ROUTES) {
      const source = readFileSync(join(ROOT, 'app', 'api', route), 'utf8')
      expect(source, route).not.toMatch(WRITE)
      expect(source, route).not.toMatch(/persistAtomicAudit|performAuditedOperation/)
      const names = [...source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"](?!zod|next)/g)]
        .flatMap((m) => m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean))
        .filter((n) => !/^type\s/.test(n) && !/Headers$/.test(n))
      expect(names.filter((n) => MUTATING_NAME.test(n)), route).toEqual([])
      expect(fresh.find((e) => e.route === route)?.mutating, route + ' is not mutating; remove it from the list').toBe(true)
    }
  })

  it('keeps an unattributable write exempt only while the route carries the control that bounds it', () => {
    for (const [route, { why, control }] of Object.entries(UNATTRIBUTABLE_WRITE_ROUTES)) {
      expect(why.length, route).toBeGreaterThan(20)
      expect(readFileSync(join(ROOT, 'app', 'api', route), 'utf8'), route).toMatch(control)
      expect(fresh.find((e) => e.route === route)?.audit, route).toBe('EXEMPT_UNATTRIBUTABLE')
    }
  })

  it('counts the shared download-issuance core as kernel-decided only while it asks the kernel-backed case access service', () => {
    const core = readFileSync(join(ROOT, 'lib', 'documents', 'download-issuance.ts'), 'utf8')
    expect(core).toMatch(/from '@\/lib\/services\/case-access-service'/)
    expect(core).toMatch(/getEffectiveCaseAccess\(/)
    expect(core).toMatch(/persistAtomicAudit\(/)
    // Every route that delegates to the core must not issue a link by any other path.
    for (const route of ['documents/repository/downloads/route.ts', 'documents/[id]/download/route.ts']) {
      const source = readFileSync(join(ROOT, 'app', 'api', route), 'utf8')
      expect(source, route).toMatch(/issueDocumentDownload\(/)
      expect(source, route).not.toMatch(/generateSasUrl|fileUrl/)
    }
  })
})
