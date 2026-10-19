/**
 * Organization data export and import.
 *
 * This is not the GDPR Article 15 exporter in `lib/gdpr/consent-manager.ts`.
 * That class serves a data-subject request for one user. This service is a
 * latent organization bulk path with no production importer. It stays unwired.
 *
 * Authorization comes from the signed-in session and `authorizeMemberAccess`.
 * A caller-supplied user id or an omitted organization filter is not a tenant.
 * Queries run inside that organization's database context and select an
 * explicit column list. Durable file delivery is not implemented, so a job
 * never reports a download URL or a completed file.
 *
 * Member import delegates to `importOrganizationMembers`. Claim import inserts
 * only inside the authorized organization and audits that transaction.
 */

import { and, eq, or, sql } from 'drizzle-orm'
import { claims, grievanceDocuments, organizationMembers } from '@/db/schema'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import { auditLogs } from '@/db/schema/domains/infrastructure/audit'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import {
  authorizeMemberAccess,
  MemberBoundaryError,
} from '@/lib/member-integrity/authorize-member-access'
import { importOrganizationMembers } from '@/lib/services/member-service'
import { logger } from '@/lib/logger'

export interface ExportConfig {
  format: 'json' | 'csv' | 'excel'
  includeRelations: boolean
  dateFormat: string
  compression: boolean
}

export type ExportDelivery = 'not_implemented'

export interface ExportJob {
  id: string
  userId: string
  organizationId: string
  entityType: string
  status: 'pending' | 'processing' | 'delivery_unavailable' | 'failed'
  format: string
  recordCount: number
  delivery: ExportDelivery
  error?: string
  createdAt: Date
  completedAt?: Date
}

export const MEMBER_EXPORT_FIELDS = [
  'id',
  'name',
  'email',
  'role',
  'status',
  'department',
  'membershipNumber',
  'organizationId',
  'createdAt',
] as const

export const CLAIM_EXPORT_FIELDS = [
  'id',
  'claimNumber',
  'memberId',
  'type',
  'status',
  'priority',
  'incidentDate',
  'submittedAt',
  'organizationId',
] as const

export const DOCUMENT_EXPORT_FIELDS = [
  'id',
  'name',
  'type',
  'mimeType',
  'version',
  'uploadedAt',
  'organizationId',
] as const

const EXPORT_ENTITIES = new Set(['members', 'claims', 'documents'])
const IMPORT_ENTITIES = new Set(['members', 'claims'])
const CLAIM_TYPES = new Set([
  'grievance_discipline',
  'grievance_schedule',
  'grievance_pay',
  'workplace_safety',
  'discrimination_age',
  'discrimination_gender',
  'discrimination_race',
  'discrimination_disability',
  'discrimination_other',
  'harassment_sexual',
  'harassment_workplace',
  'harassment_verbal',
  'harassment_physical',
  'wage_dispute',
  'contract_dispute',
  'retaliation',
  'wrongful_termination',
  'other',
])
const CLAIM_PRIORITIES = new Set(['low', 'medium', 'high', 'critical'])
const CLAIM_IMPORT_KEYS = new Set([
  'memberId',
  'organizationId',
  'claimNumber',
  'claimType',
  'type',
  'priority',
  'incidentDate',
  'description',
  'location',
  'desiredOutcome',
])

type ExportRow = Record<string, unknown>

function organizationOrThrow(organizationId: string): string {
  if (typeof organizationId !== 'string' || organizationId.trim() === '') {
    throw new MemberBoundaryError('Forbidden')
  }
  return organizationId.trim()
}

async function requireExportGrant(organizationId: string) {
  const grant = await authorizeMemberAccess(organizationOrThrow(organizationId), 'administer')
  if (!grant.ok) throw new MemberBoundaryError(grant.message)
  return grant
}

export function projectMemberExport(row: {
  id: string
  name: string
  email: string
  role: string
  status: string
  department?: string | null
  membershipNumber?: string | null
  organizationId: string
  createdAt?: Date | null
}): ExportRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    department: row.department ?? null,
    membershipNumber: row.membershipNumber ?? null,
    organizationId: row.organizationId,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  }
}

export function projectClaimExport(row: {
  claimId: string
  claimNumber?: string | null
  memberId?: string | null
  isAnonymous?: boolean | null
  claimType?: string | null
  status: string
  priority: string
  incidentDate?: Date | null
  createdAt?: Date | null
  organizationId: string
}): ExportRow {
  return {
    id: row.claimId,
    claimNumber: row.claimNumber ?? null,
    memberId: row.isAnonymous ? null : (row.memberId ?? null),
    type: row.claimType ?? null,
    status: row.status,
    priority: row.priority,
    incidentDate: row.incidentDate ? new Date(row.incidentDate).toISOString() : null,
    submittedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    organizationId: row.organizationId,
  }
}

export function projectDocumentExport(row: {
  id: string
  documentName: string
  documentType: string
  mimeType?: string | null
  version?: number | null
  uploadedAt?: Date | null
  organizationId: string
}): ExportRow {
  return {
    id: row.id,
    name: row.documentName,
    type: row.documentType,
    mimeType: row.mimeType ?? null,
    version: row.version ?? null,
    uploadedAt: row.uploadedAt ? new Date(row.uploadedAt).toISOString() : null,
    organizationId: row.organizationId,
  }
}

async function fetchExportRows(
  tx: RLSTx,
  entityType: string,
  organizationId: string,
): Promise<ExportRow[]> {
  if (entityType === 'members') {
    const rows = await tx
      .select({
        id: organizationMembers.id,
        name: organizationMembers.name,
        email: organizationMembers.email,
        role: organizationMembers.role,
        status: organizationMembers.status,
        department: organizationMembers.department,
        membershipNumber: organizationMembers.membershipNumber,
        organizationId: organizationMembers.organizationId,
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        sql`${organizationMembers.deletedAt} IS NULL`,
      ))
    return rows.map(projectMemberExport)
  }
  if (entityType === 'claims') {
    const rows = await tx
      .select({
        claimId: claims.claimId,
        claimNumber: claims.claimNumber,
        memberId: claims.memberId,
        isAnonymous: claims.isAnonymous,
        claimType: claims.claimType,
        status: claims.status,
        priority: claims.priority,
        incidentDate: claims.incidentDate,
        createdAt: claims.createdAt,
        organizationId: claims.organizationId,
      })
      .from(claims)
      .where(eq(claims.organizationId, organizationId))
    return rows.map(projectClaimExport)
  }
  const rows = await tx
    .select({
      id: grievanceDocuments.id,
      documentName: grievanceDocuments.documentName,
      documentType: grievanceDocuments.documentType,
      mimeType: grievanceDocuments.mimeType,
      version: grievanceDocuments.version,
      uploadedAt: grievanceDocuments.uploadedAt,
      organizationId: grievanceDocuments.organizationId,
    })
    .from(grievanceDocuments)
    .where(and(
      eq(grievanceDocuments.organizationId, organizationId),
      or(
        eq(grievanceDocuments.isConfidential, false),
        sql`${grievanceDocuments.isConfidential} IS NULL`,
      ),
    ))
  return rows.map(projectDocumentExport)
}

function formatData(data: ExportRow[], format: string): string {
  if (format === 'json') return JSON.stringify(data, null, 2)
  if (format === 'csv') return jsonToCsv(data)
  if (format === 'excel') {
    throw new MemberBoundaryError('Excel (xlsx) export is not yet implemented. Use CSV or JSON instead.')
  }
  throw new MemberBoundaryError('Forbidden')
}

function jsonToCsv(data: ExportRow[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const csvRows = [headers.join(',')]
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    })
    csvRows.push(values.join(','))
  }
  return csvRows.join('\n')
}

function generateId(): string {
  return `export_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Reads one authorized organization export.
 * `organizationId` is the requested tenant. It is admitted only when the
 * session holds member administration for that organization.
 */
export class DataExportService {
  async export(
    entityType: string,
    organizationId: string,
    config: Partial<ExportConfig> = {},
  ): Promise<ExportJob> {
    const format = config.format || 'json'
    const job: ExportJob = {
      id: generateId(),
      userId: '',
      organizationId: typeof organizationId === 'string' ? organizationId : '',
      entityType,
      status: 'processing',
      format,
      recordCount: 0,
      delivery: 'not_implemented',
      createdAt: new Date(),
    }

    try {
      if (!EXPORT_ENTITIES.has(entityType)) throw new MemberBoundaryError('Unsupported export scope')
      const grant = await requireExportGrant(organizationId)
      job.userId = grant.userId
      job.organizationId = grant.organizationId
      const data = await withRLSContext({ organizationId: grant.organizationId }, (tx) =>
        fetchExportRows(tx, entityType, grant.organizationId))
      formatData(data, format)
      job.recordCount = data.length
      job.status = 'delivery_unavailable'
      job.completedAt = new Date()
      logger.info('Export prepared without a durable file', {
        jobId: job.id,
        entityType,
        recordCount: job.recordCount,
      })
      return job
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Forbidden'
      job.completedAt = new Date()
      job.recordCount = 0
      logger.error('Export job failed', { jobId: job.id, errorName: error instanceof Error ? error.name : 'error' })
      return job
    }
  }

  async getExportStatus(_jobId: string): Promise<ExportJob | null> {
    return null
  }
}

function parseFile(content: string, format: string): Record<string, unknown>[] {
  if (format === 'json') {
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) throw new MemberBoundaryError('Data must be an array')
    return parsed as Record<string, unknown>[]
  }
  if (format === 'csv') return csvToJson(content)
  throw new MemberBoundaryError(`Unsupported format: ${format}`)
}

function csvToJson(csv: string): Record<string, unknown>[] {
  const lines = csv.split('\n').filter((line) => line.trim())
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map((header) => header.trim())
  const records: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i])
    const record: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      record[header] = values[index] || ''
    })
    records.push(record)
  }
  return records
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes
    else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else current += char
  }
  values.push(current.trim())
  return values
}

async function persistClaimImportAudit(
  tx: RLSTx,
  input: { actorUserId: string; organizationId: string; count: number },
): Promise<void> {
  const metadata = { operation: 'claim_import', outcome: 'success', count: input.count }
  if (currentStateContextEnabled()) {
    const written = await appendMandatoryAudit(tx, {
      organizationId: input.organizationId,
      action: 'claim_import',
      resourceType: 'claim',
      resourceId: null,
      userId: input.actorUserId,
      details: { eventType: 'data.create', severity: 'error', outcome: 'success', metadata },
    })
    if (!written) throw new Error('Claim import audit was not persisted')
    return
  }
  await tx.insert(auditLogs).values({
    action: 'claim_import',
    resourceType: 'claim',
    resourceId: null,
    userId: input.actorUserId,
    organizationId: input.organizationId,
    severity: 'error',
    outcome: 'success',
    metadata,
  })
}

async function importClaims(
  organizationId: string,
  records: readonly Record<string, unknown>[],
  validateOnly: boolean,
): Promise<{ imported: number; errors: string[] }> {
  const grant = await requireExportGrant(organizationId)
  if (records.length === 0) return { imported: 0, errors: [] }
  return withRLSContext({ organizationId: grant.organizationId }, async (tx) => {
    const errors: string[] = []
    const accepted: Array<typeof claims.$inferInsert> = []
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index] ?? {}
      const rowLabel = `Row ${index + 1}`
      try {
        for (const key of Object.keys(record)) {
          if (!CLAIM_IMPORT_KEYS.has(key)) throw new MemberBoundaryError('Forbidden')
        }
        if (
          record.organizationId !== undefined &&
          record.organizationId !== grant.organizationId
        ) {
          throw new MemberBoundaryError('Forbidden')
        }
        if (typeof record.memberId !== 'string' || record.memberId.trim() === '') {
          throw new MemberBoundaryError('Forbidden')
        }
        const claimType = String(record.claimType ?? record.type ?? 'other')
        if (!CLAIM_TYPES.has(claimType)) throw new MemberBoundaryError('Forbidden')
        const priority = String(record.priority ?? 'medium')
        if (!CLAIM_PRIORITIES.has(priority)) throw new MemberBoundaryError('Forbidden')
        const member = await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(and(
            eq(organizationMembers.id, record.memberId),
            eq(organizationMembers.organizationId, grant.organizationId),
            sql`${organizationMembers.deletedAt} IS NULL`,
          ))
          .limit(1)
        if (!member[0]) throw new MemberBoundaryError('Forbidden')
        const incidentDate = record.incidentDate ? new Date(String(record.incidentDate)) : new Date()
        if (Number.isNaN(incidentDate.getTime())) throw new MemberBoundaryError('Forbidden')
        accepted.push({
          claimNumber: typeof record.claimNumber === 'string' && record.claimNumber.trim() !== ''
            ? record.claimNumber
            : `IMP-${Date.now()}-${index + 1}`,
          organizationId: grant.organizationId,
          memberId: record.memberId,
          claimType: claimType as typeof claims.$inferInsert.claimType,
          status: 'submitted',
          priority: priority as typeof claims.$inferInsert.priority,
          incidentDate,
          location: typeof record.location === 'string' ? record.location : 'Imported',
          description: typeof record.description === 'string' ? record.description : 'Imported claim',
          desiredOutcome: typeof record.desiredOutcome === 'string' ? record.desiredOutcome : 'Imported',
        })
      } catch (error) {
        errors.push(`${rowLabel}: ${error instanceof MemberBoundaryError ? error.message : 'Forbidden'}`)
      }
    }
    if (errors.length > 0 || validateOnly) return { imported: 0, errors }
    for (const values of accepted) {
      const [created] = await tx.insert(claims).values(values).returning({ claimId: claims.claimId })
      if (!created) throw new MemberBoundaryError('Forbidden')
    }
    await persistClaimImportAudit(tx, {
      actorUserId: grant.userId,
      organizationId: grant.organizationId,
      count: accepted.length,
    })
    return { imported: accepted.length, errors: [] }
  })
}

/**
 * Imports members or claims for the authorized organization.
 * Member rows are applied by `importOrganizationMembers`. There is no direct
 * membership update in this module.
 */
export class DataImportService {
  async import(
    entityType: string,
    organizationId: string,
    fileContent: string,
    format: 'json' | 'csv' | 'excel',
    options: { updateExisting: boolean; validateOnly: boolean } = {
      updateExisting: true,
      validateOnly: false,
    },
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      if (!IMPORT_ENTITIES.has(entityType)) {
        return { success: false, imported: 0, errors: [`Import not supported for entity type: ${entityType}`] }
      }
      const data = parseFile(fileContent, format)
      if (entityType === 'members') {
        const result = await importOrganizationMembers(organizationId, data, options)
        return { success: result.errors.length === 0, imported: result.imported, errors: result.errors }
      }
      const result = await importClaims(organizationId, data, options.validateOnly)
      return { success: result.errors.length === 0, imported: result.imported, errors: result.errors }
    } catch (error) {
      logger.error('Import failed', { errorName: error instanceof Error ? error.name : 'error' })
      return {
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : 'Import failed'],
      }
    }
  }
}

export const dataExportService = new DataExportService()
export const dataImportService = new DataImportService()
