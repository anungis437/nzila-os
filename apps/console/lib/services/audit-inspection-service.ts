import { platformDb } from '@nzila/db/platform'
import { auditEvents, shareLedgerEntries, orgs } from '@nzila/db/schema'
import { asc, eq, count, desc, sql } from 'drizzle-orm'
import { verifyChain } from '@nzila/os-core/hash'
import { createLogger } from '@nzila/os-core'
const logger = createLogger('audit-insights-export')

export async function readTamperStatus() {
  const verifiedAt = new Date().toISOString()
  try {
    // Verify audit chain integrity (sample first org with events)
    const [sampleRow] = await platformDb
      .select({ orgId: auditEvents.orgId })
      .from(auditEvents)
      .groupBy(auditEvents.orgId)
      .limit(1)
    let chainValid = true
    let entryCount = 0
    if (sampleRow) {
      const entries = await platformDb
        .select()
        .from(auditEvents)
        .where(sql`${auditEvents.orgId} = ${sampleRow.orgId}`)
        .orderBy(asc(auditEvents.createdAt))
        .limit(500)
      entryCount = entries.length
      if (entries.length > 1) {
        const hashable = entries.filter(
          (
            e,
          ): e is typeof e & {
            hash: string
          } => typeof e.hash === 'string',
        )
        if (hashable.length > 1) {
          const result = verifyChain(hashable, (e) => ({
            orgId: e.orgId,
            action: e.action,
            targetType: e.targetType,
            targetId: e.targetId,
            actorClerkUserId: e.actorClerkUserId,
            beforeJson: e.beforeJson,
            afterJson: e.afterJson,
          }))
          chainValid = result.valid
        }
      }
    }
    return {
      status: 200,
      body: {
        status: chainValid ? 'pass' : 'fail',
        verifiedAt,
        entryCount,
        chainValid,
      },
    }
  } catch (_error) {
    return {
      status: 200,
      body: {
        status: 'fail',
        verifiedAt,
        entryCount: 0,
        chainValid: false,
        error: 'Verification failed',
      },
    }
  }
}

export async function verifyOrganizationChain(orgId: string, chainType: 'audit' | 'ledger') {
  if (chainType === 'audit') {
    const entries = await platformDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, orgId))
      .orderBy(asc(auditEvents.createdAt))
    if (entries.length === 0) {
      return {
        status: 200,
        body: {
          chainType: 'audit',
          orgId,
          entryCount: 0,
          valid: true,
          message: 'No audit entries to verify.',
        },
      }
    }
    const result = verifyChain(entries, (e) => ({
      orgId: e.orgId,
      actorClerkUserId: e.actorClerkUserId,
      actorRole: e.actorRole,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      beforeJson: e.beforeJson,
      afterJson: e.afterJson,
    }))
    return {
      status: 200,
      body: {
        chainType: 'audit',
        orgId,
        entryCount: entries.length,
        ...result,
      },
    }
  }
  if (chainType === 'ledger') {
    const entries = await platformDb
      .select()
      .from(shareLedgerEntries)
      .where(eq(shareLedgerEntries.orgId, orgId))
      .orderBy(asc(shareLedgerEntries.createdAt))
    if (entries.length === 0) {
      return {
        status: 200,
        body: {
          chainType: 'ledger',
          orgId,
          entryCount: 0,
          valid: true,
          message: 'No ledger entries to verify.',
        },
      }
    }
    const result = verifyChain(entries, (e) => ({
      orgId: e.orgId,
      entryType: e.entryType,
      classId: e.classId,
      fromShareholderId: e.fromShareholderId,
      toShareholderId: e.toShareholderId,
      quantity: e.quantity.toString(),
      pricePerShare: e.pricePerShare,
      currency: e.currency,
      effectiveDate: e.effectiveDate,
      notes: e.notes,
    }))
    return {
      status: 200,
      body: {
        chainType: 'ledger',
        orgId,
        entryCount: entries.length,
        ...result,
      },
    }
  }
  return {
    status: 400,
    body: { error: 'Invalid chain type' },
  }
}

export async function buildAuditInsightsCsv(orgId: string | null) {
  const baseQuery = platformDb
    .select({
      targetType: auditEvents.targetType,
      action: auditEvents.action,
      orgId: auditEvents.orgId,
      entityName: orgs.legalName,
      total: count().as('total'),
    })
    .from(auditEvents)
    .leftJoin(orgs, eq(auditEvents.orgId, orgs.id))

  const query = orgId ? baseQuery.where(eq(auditEvents.orgId, orgId)) : baseQuery

  const rows = await query
    .groupBy(auditEvents.targetType, auditEvents.action, auditEvents.orgId, orgs.legalName)
    .orderBy(desc(sql`count(*)`))
    .limit(10000)

  const header = 'target_type,action,org_id,entity_name,total'
  const lines = rows.map(
    (r) =>
      `${r.targetType},${r.action},${r.orgId},"${(r.entityName ?? '').replace(/"/g, '""')}",${r.total}`,
  )
  const csv = [header, ...lines].join('\n')
  logger.info('Audit insights export', { orgId, rowCount: rows.length })

  return csv
}
