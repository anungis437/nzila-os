import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('F06 batch 2 (A2): mutation and audit in one database transaction', () => {
  it('records the invoice replay access with the read, before release, on the same tenant transaction', () => {
    const route = src('app/api/billing/replay-invoice/route.ts')
    expect(route).toContain('withRLSContext({ organizationId, userId }')
    expect(route.indexOf('replayInvoiceDeterministically(body.invoiceId, organizationId, tx)')).toBeLessThan(route.indexOf('persistAtomicAudit(tx'))
    expect(route).not.toContain('auditLog(')
  })

  it('writes the reconciliation run, exception resolution and their audit records in one transaction each', () => {
    const service = src('services/platform-economics/reconciliation-service.ts')
    expect(service).not.toContain('auditLog(')
    expect(service).toContain('reconciliation.run.completed')
    expect(service).toContain('reconciliation.run.critical_variance')
    const resolve = service.slice(service.indexOf('export async function resolveException'))
    expect(resolve.indexOf('db.transaction(')).toBeGreaterThan(-1)
    expect(resolve.indexOf('db.transaction(')).toBeLessThan(resolve.indexOf('persistAtomicAudit('))
  })

  it('audits every ICRA review decision, claimed or not, in the decision\'s transaction', () => {
    const route = src('app/api/icra/report/[assessmentId]/review/route.ts')
    // The acting organization is resolved from the identity scope before the decision's transaction opens; it keys the audit of an unclaimed assessment.
    expect(route).toContain('const actingOrganizationId = await getOrganizationIdForUser(userId).catch(() => null)')
    expect(route.indexOf('const actingOrganizationId = await getOrganizationIdForUser(userId)')).toBeLessThan(route.indexOf('withSystemContext(async (tx)'))
    expect(route).toContain('const auditOrganizationId = assessment.claimedOrgId ?? actingOrganizationId')
    expect(route).not.toMatch(/if \(assessment\.claimedOrgId\) \{\s*await persistAtomicAudit/)
    // A decision with no organization to be recorded against is refused before it is made, and the audit follows the update in the same transaction.
    expect(route.indexOf('status: 409')).toBeLessThan(route.indexOf('.update(icraAssessments)'))
    expect(route.indexOf('.update(icraAssessments)')).toBeLessThan(route.indexOf('await persistAtomicAudit(tx'))
  })

  it('keeps the text a shared clause had before each change, and its final text on delete, in the same transaction', () => {
    const route = src('app/api/clause-library/[id]/route.ts')
    expect(route.indexOf("recordClauseVersion(tx, { organizationId, recordedBy: userId, kind: 'replaced'")).toBeLessThan(route.indexOf('.update(sharedClauseLibrary)'))
    expect(route.indexOf("kind: 'deleted'")).toBeLessThan(route.indexOf('.delete(sharedClauseLibrary)'))
    const migration = src('db/migrations-platform/0052_shared_clause_versions.sql')
    expect(migration).toContain('shared_clause_versions_unique UNIQUE (clause_id, version, change_kind)')
    expect(migration).not.toMatch(/clause_id uuid NOT NULL REFERENCES/)
  })

  it('suppresses a complaint platform-wide, as a hash, and makes the sending function honour it, failing closed', () => {
    const webhook = src('app/api/communications/webhooks/resend/route.ts')
    expect(webhook).toContain('suppressAddress(tx')
    expect(webhook).toContain('newsletterListSubscribers')
    const mail = src('lib/email-service.ts')
    expect(mail).toContain("code: 'ADDRESS_SUPPRESSED'")
    expect(mail).toContain("code: 'SUPPRESSION_CHECK_UNAVAILABLE'")
    expect(src('db/migrations-platform/0053_email_address_suppressions.sql')).toContain('address_sha256 varchar(64) NOT NULL')
    expect(src('db/migrations-cache/0043_email_address_suppressions_rls_closure.sql')).toContain('FOR ALL TO union_eyes_system')
  })
})