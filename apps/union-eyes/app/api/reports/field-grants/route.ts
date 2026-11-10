import { and, desc, eq, isNull } from 'drizzle-orm'
import { withApi, ApiError, z, zUUID } from '@/lib/api/framework'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { reportFieldGrants } from '@/db/schema'
import { DATA_SOURCES } from '@/lib/report-executor'
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate'

export const dynamic = 'force-dynamic'
const CLASSES = ['identifier', 'financial', 'matter', 'member_attribute', 'operational'] as const
const knownFields = new Set(DATA_SOURCES.flatMap((source) => source.fields.map((field) => `${source.table}.${field.column}`)))

const createSchema = z.object({
  principalUserId: z.string().trim().min(1).max(255),
  dataSourceId: z.string().trim().min(1).max(100),
  purpose: z.string().trim().min(3).max(100),
  allowedFields: z.array(z.string().trim().min(3).max(200)).min(1).max(100),
  allowedClasses: z.array(z.enum(CLASSES)).min(1).max(CLASSES.length),
  approvalReference: z.string().trim().min(3).max(255),
  expiresAt: z.string().datetime({ offset: true }),
}).strict()
const revokeSchema = z.object({ grantId: zUUID, reason: z.string().trim().min(10).max(500) }).strict()

export const GET = withApi({
  auth: { required: true, minRole: 'admin' }, requireOrg: true,
  openapi: { tags: ['Reports'], summary: 'List active institution-approved report field grants' },
}, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required')
  return withRLSContext({ organizationId, userId }, async (tx) => {
    await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view', requiresLedger: true })
    return tx.select().from(reportFieldGrants).where(and(
      eq(reportFieldGrants.organizationId, organizationId), isNull(reportFieldGrants.revokedAt),
    )).orderBy(desc(reportFieldGrants.createdAt)).limit(200)
  })
})

export const POST = withApi({
  auth: { required: true, minRole: 'admin' }, requireOrg: true, body: createSchema,
  openapi: { tags: ['Reports'], summary: 'Issue a purpose-bound report field grant under a live financial approval mandate' },
}, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required')
  if (body.principalUserId === userId) throw ApiError.forbidden('A report grant requires a different approver and recipient')
  if (!DATA_SOURCES.some((source) => source.id === body.dataSourceId)) throw ApiError.badRequest('Unknown report data source')
  const fields = [...new Set(body.allowedFields)].sort()
  if (fields.some((field) => !knownFields.has(field))) throw ApiError.badRequest('A granted report field is not in the qualified registry')
  // Member contact disclosure remains fail-closed until per-subject consent is represented and checked.
  if (fields.includes('organization_members.email')) throw ApiError.forbidden('Member e-mail cannot be granted without per-subject disclosure consent')
  const classes = [...new Set(body.allowedClasses)].sort()
  const expiresAt = new Date(body.expiresAt)
  const now = new Date()
  if (expiresAt <= now || expiresAt.getTime() > now.getTime() + 366 * 86_400_000) throw ApiError.badRequest('Grant expiry must be within the next year')
  return withRLSContext({ organizationId, userId }, async (tx) => {
    await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:approve', requiresLedger: true })
    const [grant] = await tx.insert(reportFieldGrants).values({
      organizationId, principalUserId: body.principalUserId, dataSourceId: body.dataSourceId,
      purpose: body.purpose, allowedFields: fields, allowedClasses: classes,
      approvalReference: body.approvalReference, approvedBy: userId, expiresAt,
    }).returning()
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'report.field_grant.issue', resourceType: 'report_field_grants', resourceId: grant.id,
      details: { principalUserId: body.principalUserId, dataSourceId: body.dataSourceId, purpose: body.purpose, fields, classes, expiresAt: expiresAt.toISOString(), approvalReference: body.approvalReference },
    })
    return { data: grant }
  })
})

export const DELETE = withApi({
  auth: { required: true, minRole: 'admin' }, requireOrg: true, body: revokeSchema,
  openapi: { tags: ['Reports'], summary: 'Revoke a report field grant' },
}, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required')
  return withRLSContext({ organizationId, userId }, async (tx) => {
    await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:approve', requiresLedger: true })
    const [grant] = await tx.update(reportFieldGrants).set({ revokedAt: new Date(), revokedBy: userId }).where(and(
      eq(reportFieldGrants.id, body.grantId), eq(reportFieldGrants.organizationId, organizationId), isNull(reportFieldGrants.revokedAt),
    )).returning()
    if (!grant) throw ApiError.notFound('Active report field grant')
    await persistAtomicAudit(tx, { organizationId, userId, action: 'report.field_grant.revoke', resourceType: 'report_field_grants', resourceId: grant.id, details: { reason: body.reason } })
    return { data: { id: grant.id, revoked: true } }
  })
})
