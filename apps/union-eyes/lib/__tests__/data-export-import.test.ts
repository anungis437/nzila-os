import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG = 'org-a'
const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  inserts: [] as unknown[],
  audits: [] as unknown[],
  contexts: [] as string[],
  existingClaims: [] as Array<{ idempotencyHash?: string }>,
  entitlementCalls: [] as unknown[][],
  auditFails: false,
  entitled: true,
  role: 'admin' as string | null,
  grant: {
    ok: true,
    userId: 'user-admin',
    organizationId: 'org-a',
    capability: 'administer' as const,
    message: 'Forbidden' as 'Forbidden' | 'Unauthorized',
  },
  memberImport: vi.fn(),
}))

function query(selectRows: (clause: unknown) => unknown[]) {
  let clause: unknown
  const chain = {
    from: () => chain,
    where: (next: unknown) => {
      clause = next
      return chain
    },
    limit: () => Promise.resolve(selectRows(clause)),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(selectRows(clause)).then(resolve, reject),
  }
  return chain
}

function rowsForClause(clause: unknown): unknown[] {
  const parts = Array.isArray(clause) ? clause : []
  const hash = parts.find((part) => (
    part !== null &&
    typeof part === 'object' &&
    (part as { column?: string }).column === 'idempotencyHash'
  )) as { value?: string } | undefined
  if (!hash) return state.rows
  return state.existingClaims.filter((claim) => claim.idempotencyHash === hash.value)
}

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/lib/member-integrity/authorize-member-access', () => {
  class MemberBoundaryError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'MemberBoundaryError'
    }
  }
  return {
    MemberBoundaryError,
    authorizeMemberAccess: async (organizationId: string) => {
      if (!state.grant.ok) return state.grant
      if (organizationId !== state.grant.organizationId) return { ok: false, message: 'Forbidden' }
      return { ...state.grant, organizationId }
    },
  }
})
vi.mock('@/lib/services/member-service', () => ({
  importOrganizationMembers: (...args: unknown[]) => state.memberImport(...args),
  MEMBER_IMPORT_KEYS: new Set([
    'id', 'userId', 'organizationId', 'email', 'name', 'phone', 'department',
    'location', 'position', 'status', 'role', 'exemptFromPerCapita',
    'exemptionReason', 'exemptionApprovedBy',
  ]),
}))
vi.mock('@/lib/api-auth-guard', () => ({
  PLATFORM_ELEVATED_ROLES: ['system_admin', 'app_owner', 'national_officer'],
  normalizeRole: (role: string) => role,
  getUserRole: async () => state.role,
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  PLATFORM_MODULES: { GRIEVANCE_CASE_SUITE: 'grievance_case_suite' },
  requireEntitlement: async (...args: unknown[]) => {
    state.entitlementCalls.push(args)
    if (!state.entitled) {
      const error = new Error('No active entitlement')
      error.name = 'EntitlementError'
      throw error
    }
    return { allowed: true, featureKey: 'grievance_case_suite' }
  },
}))
vi.mock('@/lib/claims/claim-number', () => ({
  allocateClaimNumber: async () => 'CLM-20261019-0001',
}))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({
  currentStateContextEnabled: () => false,
}))
vi.mock('@/lib/audit/mandatory-audit', () => ({
  appendMandatoryAudit: async () => true,
}))
vi.mock('@/db/schema', () => ({
  organizationMembers: {
    id: 'id',
    name: 'name',
    email: 'email',
    role: 'role',
    status: 'status',
    department: 'department',
    membershipNumber: 'membershipNumber',
    organizationId: 'organizationId',
    createdAt: 'createdAt',
    deletedAt: 'deletedAt',
  },
  claims: {
    claimId: 'claimId',
    claimNumber: 'claimNumber',
    memberId: 'memberId',
    isAnonymous: 'isAnonymous',
    claimType: 'claimType',
    status: 'status',
    priority: 'priority',
    incidentDate: 'incidentDate',
    createdAt: 'createdAt',
    organizationId: 'organizationId',
    idempotencyHash: 'idempotencyHash',
  },
  grievanceDocuments: {
    id: 'id',
    documentName: 'documentName',
    documentType: 'documentType',
    mimeType: 'mimeType',
    version: 'version',
    uploadedAt: 'uploadedAt',
    organizationId: 'organizationId',
    isConfidential: 'isConfidential',
  },
}))
vi.mock('@/db/schema/domains/infrastructure/audit', () => ({
  auditLogs: { action: 'action' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column: string, value: unknown) => ({ column, value })),
  and: vi.fn((...parts: unknown[]) => parts),
  or: vi.fn((...parts: unknown[]) => parts),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: { organizationId: string }, operation: (tx: unknown) => Promise<unknown>) => {
    state.contexts.push(context.organizationId)
    const tx = {
      select: (shape?: Record<string, unknown>) => {
        state.inserts.push({ select: shape ? Object.keys(shape) : [] })
        return query(rowsForClause)
      },
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          if (state.auditFails && row.action === 'claim_import') {
            return Promise.reject(new Error('Claim import audit was not persisted'))
          }
          const result = Promise.resolve([{ claimId: 'created-claim' }])
          if (row.action === 'claim_import') state.audits.push(row)
          else {
            state.inserts.push(row)
            if (typeof row.idempotencyHash === 'string') state.existingClaims.push(row)
          }
          return Object.assign(result, {
            returning: async () => [{ claimId: 'created-claim' }],
          })
        },
      }),
    }
    try {
      return await operation(tx)
    } catch (error) {
      state.inserts.splice(0)
      state.audits.splice(0)
      throw error
    }
  },
}))

import {
  CLAIM_EXPORT_FIELDS,
  DataExportService,
  DataImportService,
  DOCUMENT_EXPORT_FIELDS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  MEMBER_EXPORT_FIELDS,
  projectClaimExport,
  projectDocumentExport,
  projectMemberExport,
} from '../data-export-import'

beforeEach(() => {
  state.rows.splice(0)
  state.inserts.splice(0)
  state.audits.splice(0)
  state.contexts.splice(0)
  state.existingClaims.splice(0)
  state.entitlementCalls.splice(0)
  state.auditFails = false
  state.entitled = true
  state.role = 'admin'
  state.grant = { ok: true, userId: 'user-admin', organizationId: ORG, capability: 'administer' }
  state.memberImport.mockReset()
  state.memberImport.mockResolvedValue({ imported: 0, errors: [] })
})

const CLAIM_ROW = {
  memberId: 'm1',
  claimType: 'other',
  title: 'Schedule change',
  incidentDate: '2026-01-15',
}

function claimWrites(): unknown[] {
  return state.inserts.filter((row) => (row as { idempotencyHash?: string }).idempotencyHash)
}

describe('organization data portability', () => {
  it('refuses an export that has no organization', async () => {
    const result = await new DataExportService().export('members', '')
    expect(result.status).toBe('failed')
    expect(result.error).toBe('Forbidden')
    expect(result.delivery).toBe('not_implemented')
    expect(result).not.toHaveProperty('fileUrl')
    expect(state.contexts).toEqual([])
  })

  it('refuses a forged organization and does not read another tenant', async () => {
    state.grant = { ok: false, userId: 'intruder', organizationId: 'org-b', capability: 'administer', message: 'Forbidden' }
    const forged = await new DataExportService().export('members', 'org-b')
    expect(forged.status).toBe('failed')
    const crossTenant = await new DataExportService().export('claims', 'org-b')
    expect(crossTenant.status).toBe('failed')
    const documents = await new DataExportService().export('documents', 'org-b')
    expect(documents.status).toBe('failed')
    expect(state.contexts).toEqual([])
  })

  it('prepares an authorized export without a downloadable file', async () => {
    state.rows.push({
      id: 'm1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'member',
      status: 'active',
      department: 'Field',
      membershipNumber: 'M-1',
      organizationId: ORG,
      createdAt: new Date('2026-01-01'),
      phone: '555-0100',
      exemptFromPerCapita: true,
    })
    const result = await new DataExportService().export('members', ORG, { format: 'csv' })
    expect(result).toMatchObject({
      status: 'delivery_unavailable',
      delivery: 'not_implemented',
      userId: 'user-admin',
      organizationId: ORG,
      recordCount: 1,
      format: 'csv',
    })
    expect(result).not.toHaveProperty('fileUrl')
    expect(state.contexts).toEqual([ORG])
    expect(state.inserts[0]).toEqual({ select: [...MEMBER_EXPORT_FIELDS] })
  })

  it('keeps sensitive member, claim, and document values out of the export projection', () => {
    expect(MEMBER_EXPORT_FIELDS).not.toContain('phone')
    expect(MEMBER_EXPORT_FIELDS).not.toContain('exemptFromPerCapita')
    expect(MEMBER_EXPORT_FIELDS).not.toContain('exemptionApprovedBy')
    expect(projectMemberExport({
      id: 'm1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'member',
      status: 'active',
      department: null,
      membershipNumber: null,
      organizationId: ORG,
      createdAt: null,
    })).not.toHaveProperty('phone')
    expect(projectClaimExport({
      claimId: 'c1',
      claimNumber: 'C-1',
      memberId: 'secret-member',
      isAnonymous: true,
      claimType: 'other',
      status: 'submitted',
      priority: 'medium',
      incidentDate: null,
      createdAt: null,
      organizationId: ORG,
    }).memberId).toBeNull()
    expect(CLAIM_EXPORT_FIELDS).not.toContain('description')
    expect(CLAIM_EXPORT_FIELDS).not.toContain('claimAmount')
    expect(projectDocumentExport({
      id: 'd1',
      documentName: 'note.pdf',
      documentType: 'pdf',
      mimeType: 'application/pdf',
      version: 1,
      uploadedAt: null,
      organizationId: ORG,
    })).not.toHaveProperty('filePath')
    expect(DOCUMENT_EXPORT_FIELDS).not.toContain('filePath')
  })

  it('rejects unsupported export scopes and excel delivery', async () => {
    const unknown = await new DataExportService().export('payroll', ORG)
    expect(unknown.status).toBe('failed')
    expect(unknown.error).toMatch(/Unsupported export scope/)
    expect(state.contexts).toEqual([])
    const excel = await new DataExportService().export('members', ORG, { format: 'excel' })
    expect(excel.status).toBe('failed')
    expect(excel.error).toMatch(/xlsx/i)
    expect(excel).not.toHaveProperty('fileUrl')
    expect(await new DataExportService().getExportStatus('missing')).toBeNull()
  })

  it('delegates member import and performs no write during validation', async () => {
    state.memberImport.mockResolvedValue({ imported: 0, errors: [] })
    const result = await new DataImportService().import(
      'members',
      ORG,
      JSON.stringify([{ email: 'ada@example.com', userId: 'ada' }]),
      'json',
      { updateExisting: false, validateOnly: true },
    )
    expect(result).toEqual({ success: true, imported: 0, errors: [] })
    expect(state.memberImport).toHaveBeenCalledWith(
      ORG,
      [{ email: 'ada@example.com', userId: 'ada' }],
      { updateExisting: false, validateOnly: true },
    )
    expect(state.inserts).toEqual([])
  })

  it('rejects claim rows from another organization, unknown members, and financial fields', async () => {
    state.rows = []
    const foreign = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([{ memberId: 'm1', organizationId: 'org-b' }]),
      'json',
      { updateExisting: false, validateOnly: false },
    )
    expect(foreign.success).toBe(false)
    expect(foreign.imported).toBe(0)
    expect(state.inserts.filter((row) => !(row as { select?: unknown }).select)).toEqual([])

    state.rows = []
    const missing = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([{ memberId: 'missing' }]),
      'json',
      { updateExisting: false, validateOnly: false },
    )
    expect(missing.imported).toBe(0)

    const financial = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([{ memberId: 'm1', claimAmount: '5000' }]),
      'json',
      { updateExisting: false, validateOnly: false },
    )
    expect(financial.success).toBe(false)
    expect(financial.imported).toBe(0)
  })

  it('imports a claim only for a member in the authorized organization and rolls the audit back', async () => {
    state.rows = [{ id: 'm1' }]
    const imported = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([CLAIM_ROW]),
      'json',
      { updateExisting: false, validateOnly: false },
    )
    expect(imported).toMatchObject({ success: true, imported: 1, errors: [] })
    expect(state.entitlementCalls[0]).toEqual([ORG, 'grievance_case_suite', 'user-admin'])
    expect(state.audits[0]).toMatchObject({ action: 'claim_import', organizationId: ORG })
    const created = state.inserts.find((row) => (row as { idempotencyHash?: string }).idempotencyHash) as {
      claimNumber?: string
      organizationId?: string
    }
    expect(created).toMatchObject({ organizationId: ORG, claimNumber: 'CLM-20261019-0001' })
    expect(created.claimNumber).not.toMatch(/^IMP-/)

    state.rows = [{ id: 'm1' }]
    state.auditFails = true
    const failed = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([{ ...CLAIM_ROW, title: 'A different incident' }]),
      'json',
      { updateExisting: false, validateOnly: false },
    )
    expect(failed.success).toBe(false)
    expect(failed.imported).toBe(0)
    expect(state.audits).toEqual([])
    expect(state.inserts.filter((row) => (row as { organizationId?: string }).organizationId)).toEqual([])
  })

  it('refuses claim import without the case entitlement or claim-import authority', async () => {
    state.rows = [{ id: 'm1' }]
    state.entitled = false
    const denied = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([CLAIM_ROW]),
      'json',
    )
    expect(denied).toMatchObject({ success: false, imported: 0 })
    expect(state.contexts).toEqual([])
    expect(claimWrites()).toEqual([])

    state.entitled = true
    state.role = 'officer'
    const officer = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([CLAIM_ROW]),
      'json',
    )
    expect(officer).toMatchObject({ success: false, imported: 0 })
    expect(officer.errors[0]).toBe('Forbidden')
    expect(claimWrites()).toEqual([])

    state.role = 'clerk'
    const clerk = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([CLAIM_ROW]),
      'json',
    )
    expect(clerk.success).toBe(false)
    expect(clerk.imported).toBe(0)
    expect(claimWrites()).toEqual([])
  })

  it('does not insert a duplicate claim or accept a client claim number', async () => {
    state.rows = [{ id: 'm1' }]
    const service = new DataImportService()
    const first = await service.import('claims', ORG, JSON.stringify([CLAIM_ROW, CLAIM_ROW]), 'json')
    expect(first).toMatchObject({ success: true, imported: 1, errors: [] })
    expect(claimWrites()).toHaveLength(1)

    const repeat = await service.import('claims', ORG, JSON.stringify([CLAIM_ROW]), 'json')
    expect(repeat).toMatchObject({ success: true, imported: 0, errors: [] })
    expect(claimWrites()).toHaveLength(1)

    const forged = await service.import(
      'claims',
      ORG,
      JSON.stringify([{ ...CLAIM_ROW, title: 'Forged number', claimNumber: 'CASE-CLIENT-1' }]),
      'json',
    )
    expect(forged).toMatchObject({ success: false, imported: 0 })
    expect(claimWrites()).toHaveLength(1)
  })

  it('rejects an oversized claim import before inserting', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => CLAIM_ROW)
    const result = await new DataImportService().import('claims', ORG, JSON.stringify(rows), 'json')
    expect(result).toEqual({ success: false, imported: 0, errors: ['Import exceeds the supported size'] })
    expect(state.contexts).toEqual([])
    expect(claimWrites()).toEqual([])
  })

  it('parses quoted CSV fields and rejects a malformed file before membership writes', async () => {
    const quoted = await new DataImportService().import(
      'members',
      ORG,
      'name,email,role\r\n"Ada, Admin","ada ""A""@example.com",member\r\n',
      'csv',
      { updateExisting: false, validateOnly: true },
    )
    expect(quoted.success).toBe(true)
    expect(state.memberImport).toHaveBeenCalledWith(
      ORG,
      [{ name: 'Ada, Admin', email: 'ada "A"@example.com', role: 'member' }],
      { updateExisting: false, validateOnly: true },
    )

    state.memberImport.mockClear()
    const malformed = await new DataImportService().import(
      'members',
      ORG,
      'name,email,role\n"Ada,ada@example.com,admin\n',
      'csv',
    )
    expect(malformed).toMatchObject({ success: false, imported: 0, errors: ['Malformed import'] })
    expect(state.memberImport).not.toHaveBeenCalled()

    const duplicateHeader = await new DataImportService().import(
      'members',
      ORG,
      'role,role\nadmin,member\n',
      'csv',
    )
    expect(duplicateHeader.success).toBe(false)
    expect(state.memberImport).not.toHaveBeenCalled()

    const unknownHeader = await new DataImportService().import(
      'members',
      ORG,
      'email,userId,systemRole\nada@example.com,ada,admin\n',
      'csv',
    )
    expect(unknownHeader.success).toBe(false)
    expect(state.memberImport).not.toHaveBeenCalled()

    const extraColumn = await new DataImportService().import(
      'members',
      ORG,
      'email,userId\nada@example.com,ada,admin\n',
      'csv',
    )
    expect(extraColumn.success).toBe(false)
    expect(state.memberImport).not.toHaveBeenCalled()

    const oversized = await new DataImportService().import(
      'members',
      ORG,
      `email\n${'a'.repeat(MAX_IMPORT_BYTES)}`,
      'csv',
    )
    expect(oversized.errors).toEqual(['Import exceeds the supported size'])
    expect(state.memberImport).not.toHaveBeenCalled()
  })

  it('rejects unsupported import entities and formats', async () => {
    const documents = await new DataImportService().import('documents', ORG, '[]', 'json')
    expect(documents.success).toBe(false)
    const excel = await new DataImportService().import('members', ORG, 'x', 'excel')
    expect(excel.success).toBe(false)
    expect(state.memberImport).not.toHaveBeenCalled()
  })
})
