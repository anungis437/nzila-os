import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG = 'org-a'
const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  inserts: [] as unknown[],
  audits: [] as unknown[],
  contexts: [] as string[],
  auditFails: false,
  grant: {
    ok: true,
    userId: 'user-admin',
    organizationId: 'org-a',
    capability: 'administer' as const,
    message: 'Forbidden' as 'Forbidden' | 'Unauthorized',
  },
  memberImport: vi.fn(),
}))

function query(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return chain
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
        return query(state.rows)
      },
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          if (state.auditFails && row.action === 'claim_import') {
            return Promise.reject(new Error('Claim import audit was not persisted'))
          }
          const result = Promise.resolve([{ claimId: 'created-claim' }])
          if (row.action === 'claim_import') state.audits.push(row)
          else state.inserts.push(row)
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
  state.auditFails = false
  state.grant = { ok: true, userId: 'user-admin', organizationId: ORG, capability: 'administer' }
  state.memberImport.mockReset()
  state.memberImport.mockResolvedValue({ imported: 0, errors: [] })
})

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
      JSON.stringify([{ memberId: 'm1', claimType: 'other' }]),
      'json',
      { updateExisting: false, validateOnly: false },
    )
    expect(imported).toMatchObject({ success: true, imported: 1, errors: [] })
    expect(state.audits[0]).toMatchObject({ action: 'claim_import', organizationId: ORG })
    expect(state.inserts.some((row) => (row as { organizationId?: string }).organizationId === ORG)).toBe(true)

    state.rows = [{ id: 'm1' }]
    state.auditFails = true
    const failed = await new DataImportService().import(
      'claims',
      ORG,
      JSON.stringify([{ memberId: 'm1' }]),
      'json',
      { updateExisting: false, validateOnly: false },
    )
    expect(failed.success).toBe(false)
    expect(failed.imported).toBe(0)
    expect(state.audits).toEqual([])
    expect(state.inserts.filter((row) => (row as { organizationId?: string }).organizationId)).toEqual([])
  })

  it('rejects unsupported import entities and formats', async () => {
    const documents = await new DataImportService().import('documents', ORG, '[]', 'json')
    expect(documents.success).toBe(false)
    const excel = await new DataImportService().import('members', ORG, 'x', 'excel')
    expect(excel.success).toBe(false)
    expect(state.memberImport).not.toHaveBeenCalled()
  })
})
