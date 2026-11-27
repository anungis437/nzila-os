/**
 * Contract Test — Audit Taxonomy Completeness (REM-04)
 *
 * Verifies the audit event taxonomy covers all regulated operations:
 *   1. DATA_EXPORT action is defined in AUDIT_ACTIONS
 *   2. DATA_EXPORT_REQUEST action is defined
 *   3. AUTH_CONFIG_CHANGE action is defined (for auth policy mutations)
 *   4. AUTHORIZATION_DENIED action is defined (for deny-path observability)
 *   5. Hash-chain verifier route exists (audit integrity)
 *   6. Export routes call recordAuditEvent / appendAiAuditEvent (data export auditing)
 *   7. auditEvent hash chain is wired in os-core
 *   8. Finance audit wraps recordAuditEvent (not raw DB inserts)
 *
 * These are static analysis tests — no runtime or network calls.
 *
 * Closes the FAIL gap: DATA_EXPORT was missing from the taxonomy, meaning
 * regulated data exports would be untracked in the audit log.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(rel: string): string {
  const abs = resolve(ROOT, rel)
  try { return readFileSync(abs, 'utf-8') } catch { return '' }
}

/** Source of one exported (async) function, from its declaration to the next top-level export. */
function exportedFunctionBody(src: string, name: string): string {
  const start = src.search(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`))
  if (start < 0) return ''
  const rest = src.slice(start + 1)
  const next = rest.search(/\nexport\s/)
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next)
}

/**
 * A route that delegated its mutation to a service: the route imports `fn` from
 * `servicePath`, calls it inside `method`, and carries no DB client of its own,
 * so the service function is the route's only path to the write it audits.
 * Returns the service function's source for the audit assertions.
 */
function delegatedAuditSource(
  routePath: string,
  method: string,
  servicePath: string,
  fn: string,
): string {
  const route = read(routePath)
  expect(route, `${routePath} must exist`).not.toBe('')
  const importPath = '@/' + servicePath.replace(/^apps\/[^/]+\//, '').replace(/\.ts$/, '')
  expect(route).toMatch(new RegExp(`import\\s*\\{[^}]*\\b${fn}\\b[^}]*\\}\\s*from\\s*['"]${importPath}['"]`))
  expect(exportedFunctionBody(route, method), `${routePath} ${method} must call ${fn}()`).toContain(`${fn}(`)
  expect(route, `${routePath} must not hold its own DB client`).not.toMatch(/from\s+['"]@nzila\/db(?:\/[^'"]*)?['"]/)
  const body = exportedFunctionBody(read(servicePath), fn)
  expect(body, `${servicePath} must export ${fn}`).not.toBe('')
  return body
}

// ── Subject files ─────────────────────────────────────────────────────────────

const AUDIT_DB = 'apps/console/lib/audit-db.ts'
const HASH_MODULE = 'packages/os-core/src/hash.ts'
const VERIFY_CHAIN_ROUTE = 'apps/console/app/api/audit/verify-chain/route.ts'
const STRIPE_REPORT_ROUTE = 'apps/console/app/api/stripe/reports/generate/route.ts'
const YEAR_END_PACK = 'apps/console/app/api/finance/year-end-pack/route.ts'
const AI_STRIPE_ROUTE = 'apps/console/app/api/ai/actions/finance/stripe-monthly-reports/route.ts'
// Raw DB access moved out of these routes into service functions (governance
// exceptions removed); the audit emission moved with the write.
const YEAR_END_PACK_SERVICE = 'apps/console/lib/services/year-end-pack-service.ts'
const AI_PROPOSAL_SERVICE = 'apps/console/lib/services/ai-proposal-service.ts'
const ORG_ADMIN_SERVICE = 'apps/console/lib/services/organization-admin-service.ts'
const FINANCE_AUDIT = 'apps/console/lib/finance-audit.ts'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Audit Taxonomy — REM-04 contract', () => {
  // ── AUDIT_ACTIONS completeness ──────────────────────────────────────────────

  it('AUDIT_ACTIONS constant is defined in lib/audit-db.ts', () => {
    const content = read(AUDIT_DB)
    expect(content).not.toBe('')
    expect(content).toContain('AUDIT_ACTIONS')
  })

  it('AUDIT_ACTIONS.DATA_EXPORT is defined (critical: regulated data export)', () => {
    const content = read(AUDIT_DB)
    expect(content).toContain('DATA_EXPORT')
    // Must map to a string value with 'export' semantics
    expect(content).toMatch(/DATA_EXPORT[^:]*:\s*['"]data\.export/)
  })

  it('AUDIT_ACTIONS.DATA_EXPORT_REQUEST is defined', () => {
    const content = read(AUDIT_DB)
    expect(content).toContain('DATA_EXPORT_REQUEST')
  })

  it('AUDIT_ACTIONS.AUTH_CONFIG_CHANGE is defined', () => {
    const content = read(AUDIT_DB)
    expect(content).toContain('AUTH_CONFIG_CHANGE')
  })

  it('AUDIT_ACTIONS.AUTHORIZATION_DENIED is defined', () => {
    const content = read(AUDIT_DB)
    expect(content).toContain('AUTHORIZATION_DENIED')
  })

  it('AUDIT_ACTIONS has at least 30 defined actions (taxonomy breadth)', () => {
    const content = read(AUDIT_DB)
    // Count key: value pairs inside AUDIT_ACTIONS object
    const matches = content.match(/:\s*['"][a-z_.]+['"]/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(30)
  })

  // ── export routes emit audit events ────────────────────────────────────────

  it('stripe/reports/generate route imports recordAuditEvent', () => {
    const content = read(STRIPE_REPORT_ROUTE)
    expect(content).not.toBe('')
    expect(content).toContain('recordAuditEvent')
  })

  it('stripe/reports/generate route imports AUDIT_ACTIONS', () => {
    const content = read(STRIPE_REPORT_ROUTE)
    expect(content).toContain('AUDIT_ACTIONS')
  })

  it('stripe/reports/generate route uses AUDIT_ACTIONS.DATA_EXPORT', () => {
    const content = read(STRIPE_REPORT_ROUTE)
    expect(content).toContain('AUDIT_ACTIONS.DATA_EXPORT')
  })

  it('finance/year-end-pack route calls a finance audit function on export', () => {
    // POST builds the pack only through buildAndAuditYearEndPack, which records
    // EVIDENCE_PACK_GENERATED via the finance audit wrapper.
    const content = delegatedAuditSource(YEAR_END_PACK, 'POST', YEAR_END_PACK_SERVICE, 'buildAndAuditYearEndPack')
    expect(content).toContain('recordFinanceAuditEvent(')
    expect(content).toContain('EVIDENCE_PACK_GENERATED')
  })

  it('AI stripe monthly reports route emits an audit event', () => {
    // POST proposes/executes only through generateStripeMonthlyReportsAction,
    // which appends ai.action_proposed right after creating the action row.
    const content = delegatedAuditSource(AI_STRIPE_ROUTE, 'POST', AI_PROPOSAL_SERVICE, 'generateStripeMonthlyReportsAction')
    expect(content).toContain('appendAiAuditEvent(')
    expect(content).toContain('ai.action_proposed')
    expect(content.indexOf('.insert(aiActions)')).toBeGreaterThan(-1)
    expect(content.indexOf('appendAiAuditEvent(')).toBeGreaterThan(content.indexOf('.insert(aiActions)'))
  })

  // ── Hash chain integrity ────────────────────────────────────────────────────

  it('os-core hash module exists with computeEntryHash', () => {
    const content = read(HASH_MODULE)
    expect(content).toContain('computeEntryHash')
  })

  it('os-core hash module exports verifyChain', () => {
    const content = read(HASH_MODULE)
    expect(content).toContain('verifyChain')
  })

  it('/api/audit/verify-chain route exists (tamper detection)', () => {
    expect(existsSync(resolve(ROOT, VERIFY_CHAIN_ROUTE))).toBe(true)
  })

  it('/api/audit/verify-chain supports both audit and ledger chain types', () => {
    const content = read(VERIFY_CHAIN_ROUTE)
    expect(content.includes("'audit'") || content.includes('"audit"')).toBe(true)
    expect(content.includes("'ledger'") || content.includes('"ledger"')).toBe(true)
  })

  // ── Finance audit abstraction ───────────────────────────────────────────────

  it('finance-audit.ts wraps recordAuditEvent (prevents raw DB access)', () => {
    const content = read(FINANCE_AUDIT)
    if (!content) return // Some apps may not have finance-audit
    expect(content).toContain('recordAuditEvent')
    // Must NOT directly write to audit_events table — must go through wrapper
    expect(content).not.toMatch(/db\.insert.*audit_events/)
  })

  it('audit-db.ts exports recordAuditEvent function', () => {
    const content = read(AUDIT_DB)
    expect(content).toMatch(/export\s+(async\s+)?function\s+recordAuditEvent/)
  })

  it('audit-db.ts computes a hash (chain integrity)', () => {
    const content = read(AUDIT_DB)
    expect(
      content.includes('computeEntryHash') ||
      content.includes('hash') ||
      content.includes('sha256') ||
      content.includes('SHA256')
    ).toBe(true)
  })
})

// ── REM-09: Member management call-site audit coverage ────────────────────────

describe('Audit Call-site — REM-09 member management', () => {
  const PEOPLE_ROUTE = 'apps/console/app/api/orgs/[orgId]/people/route.ts'

  it('people route exists (member management endpoint)', () => {
    expect(existsSync(resolve(ROOT, PEOPLE_ROUTE))).toBe(true)
  })

  // The member insert moved from the route into organization-admin-service
  // (governance exceptions removed); the route reaches it only through
  // addOrganizationMember, which carries the audit emission.

  it('people route imports recordAuditEvent', () => {
    delegatedAuditSource(PEOPLE_ROUTE, 'POST', ORG_ADMIN_SERVICE, 'addOrganizationMember')
    expect(read(ORG_ADMIN_SERVICE)).toMatch(
      /import\s*\{[^}]*\brecordAuditEvent\b[^}]*\}\s*from\s*['"]@\/lib\/audit-db['"]/,
    )
  })

  it('people route imports AUDIT_ACTIONS', () => {
    expect(read(ORG_ADMIN_SERVICE)).toMatch(
      /import\s*\{[^}]*\bAUDIT_ACTIONS\b[^}]*\}\s*from\s*['"]@\/lib\/audit-db['"]/,
    )
  })

  it('people route POST emits AUDIT_ACTIONS.MEMBER_ADD on person creation', () => {
    const content = delegatedAuditSource(PEOPLE_ROUTE, 'POST', ORG_ADMIN_SERVICE, 'addOrganizationMember')
    const insert = content.indexOf('.insert(orgMembers)')
    const audit = content.indexOf('AUDIT_ACTIONS.MEMBER_ADD')
    expect(insert).toBeGreaterThan(-1)
    expect(content).toContain('recordAuditEvent(')
    expect(audit).toBeGreaterThan(insert)
  })

  it('AUDIT_ACTIONS.MEMBER_ADD is defined in taxonomy', () => {
    const content = read(AUDIT_DB)
    expect(content).toContain('MEMBER_ADD')
  })

  it('AUDIT_ACTIONS.MEMBER_ROLE_CHANGE is defined in taxonomy', () => {
    const content = read(AUDIT_DB)
    expect(content).toContain('MEMBER_ROLE_CHANGE')
  })

  it('AUDIT_ACTIONS.MEMBER_REMOVE is defined in taxonomy', () => {
    const content = read(AUDIT_DB)
    expect(content).toContain('MEMBER_REMOVE')
  })
})
