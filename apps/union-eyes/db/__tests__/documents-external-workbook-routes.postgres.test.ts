/**
 * The document, external-party and workbook routes on real PostgreSQL, as the real roles (UE-CONV-H-019).
 *
 * These routes were plain handlers or sat behind wrappers the tenant-context census does not know (withOrganizationAuth, withExternalMatterResourceAuth,
 * withClaimedWorkbookAccess), and several read and wrote tenant tables through the ambient handle: on the runtime role, with no organization set,
 * row-level security shows every one of those tables as empty. The unit tests replace the database, so they could not tell. This runs the unmodified routes
 * and services against the combined Django + Drizzle schema, with only the request boundary replaced (see native-route-harness.ts), the decisions that are
 * not the database's mocked at their own boundary (the case kernel, the session, storage, text extraction) and nothing in the data path. It proves that
 *   - a handle with no organization sees no document, grant or workbook row, so each route has to open the transaction it reads and writes on;
 *   - the repository returns an organization's documents to its members and none of another organization's, and a label change, a version, a download
 *     record and an upload are stored in the caller's organization, audited with it, and cannot be made on another organization's document;
 *   - a bulk download is a batch of independent transactions: a refused audit on one document does not undo or poison the links of the others;
 *   - text extraction and the external download read storage with no database transaction open, and write what they found in a second one;
 *   - an external representative reads, downloads and uploads only through their own authority and grant in the organization they name, the read is recorded
 *     with its decision on the same transaction, and a stranger or another organization's grant gets nothing;
 *   - the workbook routes run every protected statement, and the audit record written for it, on the transaction the access boundary opened for the
 *     resolved authority (the claimant's own user context, or the bounded system context), never on the ambient handle.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { createHash, randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const ORIGINAL_DOCUMENT_SEAL_KEY = process.env.EVIDENCE_SEAL_KEY

const state = vi.hoisted(() => ({
  // Who the route's caller is, for the role lookups the routes make themselves.
  caller: { userId: '', organizationId: '' },
  // The authenticated session an external or workbook route reads (requireUser / auth()).
  session: { userId: '' as string | null, organizationId: '' as string | undefined },
  // `${userId}|${grievanceId}` -> the case-relationship decision the authority kernel would give; absent means none.
  caseAccess: new Map<string, Record<string, unknown>>(),
  // The organization the caller of a workbook route belongs to (getOrganizationIdForUser).
  userOrganization: new Map<string, string>(),
  // The number of organization/system transactions open right now, and what it was when storage was read.
  openTransactions: 0,
  transactionsDuringStorageRead: [] as number[],
  storage: new Map<string, Buffer>(),
  sasIssued: [] as string[],
  publicIntakeAudits: [] as Array<{ identity: Record<string, string>; entry: Record<string, unknown> }>,
  generatedFor: [] as Array<{ identity: Record<string, string>; input: unknown }>,
}))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db/tenant-context-storage', async (importOriginal) => {
  const { ambientDb } = await import('./native-route-harness')
  return { ...(await importOriginal<typeof import('@/db/tenant-context-storage')>()), getActiveTenantDb: () => ambientDb }
})
vi.mock('@/lib/db/with-rls-context', async () => {
  const { rlsContextModule, harness, RUNTIME_ROLE } = await import('./native-route-harness')
  const counted = async <T,>(work: () => Promise<T>) => {
    state.openTransactions += 1
    try {
      return await work()
    } finally {
      state.openTransactions -= 1
    }
  }
  // As in production, the user a tenant transaction is bound to is the authenticated session's, not something the caller passes.
  const sessionUser = () => state.session.userId || state.caller.userId
  return {
    // Production's single-argument form binds the transaction to the authenticated session's own organization and principal
    // (lib/db/with-rls-context.ts); the canonical external reader uses it (lib/external-resource-read/reader.ts).
    withRLSContext: (context: { organizationId: string; userId?: string } | ((tx: never) => Promise<unknown>), work?: never) =>
      typeof context === 'function'
        ? (state.session.userId
          ? counted(() => rlsContextModule.withRLSContext({ organizationId: state.session.organizationId ?? '', userId: state.session.userId! } as never, context as never))
          // No authenticated session: the production binder refuses before any statement (AuthOrgBindingError UNAUTHENTICATED).
          : import('../../../../packages/platform-auth/src/org-binding').then(({ AuthOrgBindingError }) => { throw new AuthOrgBindingError('UNAUTHENTICATED') }))
        : counted(() => rlsContextModule.withRLSContext({ ...context, userId: context.userId ?? sessionUser() }, work as never)),
    withSystemContext: (work: never) => counted(() => rlsContextModule.withSystemContext(work)),
    withExplicitUserContext: (userId: string, work: () => Promise<unknown>, organizationId?: string) =>
      counted(() => harness.tenant(RUNTIME_ROLE, organizationId ?? null, userId, () => work())),
    // As in production (lib/db/with-rls-context.ts): no organization, the authenticated session's own principal only.
    withPrincipalOnlyContext: (work: (tx: unknown) => Promise<unknown>) =>
      counted(() => harness.tenant(RUNTIME_ROLE, null, sessionUser(), work)),
  }
})
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))
vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>()
  const { roleInOrganization } = await import('./native-route-harness')
  const level = (role: string | null) => (role ? (actual.ROLE_HIERARCHY as Record<string, number>)[role] ?? 0 : 0)
  return {
    ...actual,
    hasMinRole: async (minimum: string) => level(await roleInOrganization(state.caller.userId, state.caller.organizationId)) >= level(minimum),
    hasRoleInOrganization: async (organizationId: string, minimum: string, userId: string) => level(await roleInOrganization(userId, organizationId)) >= level(minimum),
    requireUser: async () => {
      if (!state.session.userId) throw new Error('Unauthorized')
      return { userId: state.session.userId, organizationId: state.session.organizationId }
    },
  }
})
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: state.session.userId }) }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: async (userId: string) => state.userOrganization.get(userId) ?? null }))
vi.mock('@/lib/services/case-access-service', () => {
  const none = { isPrimaryOwner: false, isSecondaryCollaborator: false, accessRole: null, canViewCase: false, canUploadDocuments: false, canModifyDocuments: false, canProcessOcr: false, canViewPrivateDocuments: false }
  return {
    getEffectiveCaseAccess: async ({ userId, grievanceId }: { userId: string; grievanceId: string }) => ({ ...none, ...(state.caseAccess.get(`${userId}|${grievanceId}`) ?? {}) }),
  }
})
vi.mock('@/lib/services/document-blob-integrity-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/document-blob-integrity-service')>()
  return {
    ...actual,
    resolveStoredBlob: async ({ organizationId, blobPath }: { organizationId: string; blobPath?: string }) => {
      if (!blobPath || !state.storage.has(blobPath)) throw Object.assign(new Error('The stored file does not exist'), { code: 'BLOB_NOT_FOUND' })
      return { blobPath, fileUrl: `https://storage.test/${organizationId}/${blobPath}`, contentHash: createHash('sha256').update(state.storage.get(blobPath)!).digest('hex') }
    },
  }
})
vi.mock('@/lib/blob-client', () => {
  class BlobTooLargeError extends Error {}
  return {
    BlobTooLargeError,
    generateSasUrl: async (container: string, path: string) => {
      state.sasIssued.push(path)
      return `https://storage.test/${container}/${path}?sig=test`
    },
    computeSha256: (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex'),
    downloadBuffer: async (_container: string, path: string) => {
      state.transactionsDuringStorageRead.push(state.openTransactions)
      const blob = state.storage.get(path)
      if (!blob) throw new Error('BlobNotFound')
      return blob
    },
    readBlobBounded: async (path: string) => {
      state.transactionsDuringStorageRead.push(state.openTransactions)
      const blob = state.storage.get(path)
      if (!blob) throw new Error('BlobNotFound')
      return blob
    },
  }
})
vi.mock('@/lib/documents/intake-storage', () => ({ blobIntakeStorage: {} }))
vi.mock('@/lib/documents/ocr-extract', () => ({
  extractTextFromBytes: async (bytes: Buffer) => ({ text: `text of ${bytes.toString()}`, confidence: 0.9, language: 'en', engine: 'test-engine', engineVersion: '1', metadata: {} }),
}))
vi.mock('@/lib/public-intake/guard', () => ({
  guardPublicIntake: async (request: Request, options: { readBody?: boolean }) => ({ ok: true, json: options?.readBody === false ? undefined : await request.json() }),
}))
vi.mock('@/lib/public-intake/intake-audit', async (importOriginal) => {
  const { sql } = await import('drizzle-orm')
  return {
    ...(await importOriginal<typeof import('@/lib/public-intake/intake-audit')>()),
    appendPublicIntakeAudit: async (tx: { execute: (query: unknown) => Promise<{ rows: Array<Record<string, string>> }> }, entry: Record<string, unknown>) => {
      // What the transaction is, read while it is open: a committed one reports the pool's own role.
      const identity = (await tx.execute(sql`SELECT current_user AS u, current_setting('app.current_org_id', true) AS org, current_setting('app.current_user_id', true) AS usr`)).rows[0]
      state.publicIntakeAudits.push({ identity, entry })
      return { subjectRef: 'ref', contentHash: 'hash' }
    },
  }
})
vi.mock('@/lib/workbook-pdf/generateWorkbookPdf', async () => {
  const { sql } = await import('drizzle-orm')
  return {
    generateWorkbookPdf: async (tx: { execute: (query: unknown) => Promise<{ rows: Array<Record<string, string>> }> }, input: unknown) => {
      const identity = (await tx.execute(sql`SELECT current_user AS u, current_setting('app.current_org_id', true) AS org, current_setting('app.current_user_id', true) AS usr`)).rows[0]
      state.generatedFor.push({ identity, input })
      return Buffer.from('%PDF-test')
    },
  }
})

const { harness, RUNTIME_ROLE, SYSTEM_ROLE, ambientDb } = await import('./native-route-harness')
const repositoryList = URL ? await import('@/app/api/documents/repository/route') : null
const repositoryOne = URL ? await import('@/app/api/documents/repository/[id]/route') : null
const versions = URL ? await import('@/app/api/documents/repository/[id]/versions/route') : null
const downloadOne = URL ? await import('@/app/api/documents/[id]/download/route') : null
const contentDownload = URL ? await import('@/app/api/documents/[id]/content/route') : null
const downloadMany = URL ? await import('@/app/api/documents/repository/downloads/route') : null
const ocr = URL ? await import('@/app/api/documents/[id]/ocr/route') : null
const externalMatter = URL ? await import('@/app/api/external/grievances/[id]/route') : null
const externalDocuments = URL ? await import('@/app/api/external/grievances/[id]/documents/route') : null
const externalDocument = URL ? await import('@/app/api/external/documents/[id]/route') : null
const externalDownload = URL ? await import('@/app/api/external/documents/[id]/download/route') : null
const externalUpload = URL ? await import('@/app/api/external/grievances/[id]/documents/upload/route') : null
const holders = URL ? await import('@/app/api/workbook/[id]/memory-holders/route') : null
const holderOne = URL ? await import('@/app/api/workbook/[id]/memory-holders/[holderId]/route') : null
const workbookExport = URL ? await import('@/app/api/workbook/[id]/export/route') : null
const capability = URL ? await import('@/lib/workbook/workbook-capability') : null
const workbookConsent = URL ? await import('@/lib/workbook/consent') : null

type Row = Record<string, unknown>
type Who = { organizationId: string; userId: string; role?: string }
type Handler = (ctx: unknown) => Promise<Response>

describe.skipIf(!URL)('the document, external and workbook routes on the combined schema, as the real roles', () => {
  const tag = `dx${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const memberA = `member-a-${tag}`
  const stewardA = `steward-a-${tag}`
  const memberB = `member-b-${tag}`
  const stewardB = `steward-b-${tag}`
  const staffA = `staff-a-${tag}`
  const repOrganization = randomUUID()
  const representative = `rep-${tag}`
  const stranger = `stranger-${tag}`
  const claimant = `claimant-${tag}`
  const peerA = `peer-a-${tag}`
  const peerB = `peer-b-${tag}`
  const asMemberA: Who = { organizationId: ORG_A, userId: memberA }
  const asStewardA: Who = { organizationId: ORG_A, userId: stewardA }
  const asMemberB: Who = { organizationId: ORG_B, userId: memberB }
  const asStewardB: Who = { organizationId: ORG_B, userId: stewardB }
  let admin: pg.Client

  const run = (handler: unknown, who: Who, extra: Record<string, unknown> = {}) => {
    state.caller = who
    return (handler as Handler)({ ...who, ...extra })
  }
  const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as { code?: string; message?: string })
  const json = async (response: Response) => (await response.json()) as { success?: boolean; data?: unknown; code?: string; error?: unknown }
  const request = (url: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
    new Request(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const routeParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) })

  const newOrganization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${id}`],
    )
  const newGrievance = async (organizationId: string, createdBy: string) => {
    const { rows } = await admin.query(
      `INSERT INTO grievances (grievance_number, description, organization_id, title, type, status, priority, created_by)
       VALUES ($1,'Overtime was not paid',$2,$3,'individual','filed','medium',$4) RETURNING id::text AS id`,
      [`GRV-${tag}-${randomUUID().slice(0, 6)}`, organizationId, `Unpaid overtime ${tag}`, createdBy],
    )
    return rows[0].id as string
  }
  const newDocument = async (organizationId: string, title: string, options: { uploadedBy?: string; label?: string; grievanceId?: string; versions?: number } = {}) => {
    const { rows } = await admin.query(
      `INSERT INTO documents (organization_id, name, title, filename, file_url, file_type, document_type, mime_type, uploaded_by, privacy_label, status)
       VALUES ($1,$2,$2,$2,$3,'evidence','evidence','application/pdf',$4,$5,'active') RETURNING id::text AS id`,
      [organizationId, title, `https://storage.test/${organizationId}/${title}`, options.uploadedBy ?? memberA, options.label ?? 'public_internal'],
    )
    const id = rows[0].id as string
    for (let versionNo = 1; versionNo <= (options.versions ?? 1); versionNo += 1) {
      const key = `documents/${organizationId}/${id}-v${versionNo}.pdf`
      state.storage.set(key, Buffer.from(`${title} v${versionNo}`))
      await admin.query(
        `INSERT INTO document_versions (organization_id, document_id, version_no, storage_key, content_hash, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)`,
        [organizationId, id, versionNo, key, createHash('sha256').update(state.storage.get(key)!).digest('hex'), options.uploadedBy ?? memberA],
      )
    }
    if (options.grievanceId) {
      await admin.query(
        `INSERT INTO document_links (organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES ($1,$2,'grievance',$3,$4)`,
        [organizationId, id, options.grievanceId, options.uploadedBy ?? memberA],
      )
    }
    return id
  }
  const documentRow = async (id: string) => (await admin.query(`SELECT * FROM documents WHERE id = $1`, [id])).rows[0] as Row | undefined
  const auditsFor = (action: string, organizationId?: string) => harness.audits.filter((entry) => entry.action === action && (!organizationId || entry.organizationId === organizationId))

  beforeAll(async () => {
    process.env.EVIDENCE_SEAL_KEY = 'synthetic-native-document-download-key-only-20261123'
    admin = await harness.start(URL!)
    await newOrganization(ORG_A, `Documents A ${tag}`)
    await newOrganization(ORG_B, `Documents B ${tag}`)
    // The representative signs in to their own organization: canonical external reads start from that own-organization session.
    await newOrganization(repOrganization, `Representative firm ${tag}`)
    harness.setRole(representative, repOrganization, 'member')
    for (const [user, org, role] of [[memberA, ORG_A, 'member'], [stewardA, ORG_A, 'steward'], [memberB, ORG_B, 'member'], [stewardB, ORG_B, 'steward'], [peerA, ORG_A, 'steward'], [peerB, ORG_B, 'steward']] as const) harness.setRole(user, org, role)
    // The workbook claimant is a member of the claiming organization: their own user context is a real canonical session.
    harness.setRole(claimant, ORG_A, 'member')
    state.userOrganization.set(claimant, ORG_A)
    state.userOrganization.set(peerA, ORG_A)
    state.userOrganization.set(peerB, ORG_B)
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
    if (ORIGINAL_DOCUMENT_SEAL_KEY === undefined) delete process.env.EVIDENCE_SEAL_KEY
    else process.env.EVIDENCE_SEAL_KEY = ORIGINAL_DOCUMENT_SEAL_KEY
  })

  beforeEach(() => {
    state.session = { userId: null, organizationId: undefined }
    state.transactionsDuringStorageRead.length = 0
    state.sasIssued.length = 0
    state.publicIntakeAudits.length = 0
    state.generatedFor.length = 0
  })

  describe('what the routes ask of the wrapper', () => {
    it('declares the role floor each document route enforces, and opens its own transactions around the database work', () => {
      const declared: Array<[string, string | undefined, false?]> = [
        ['List the documents of the organization repository the caller may see', 'member'],
        ['Record an uploaded file as a governed document', 'member', false],
        ['Read one document of the repository with its versions', 'member'],
        ['Change the privacy label of a document', 'steward'],
        ['Append a version to a document', undefined, false],
        ['Issue audited download links for a batch of documents (independent, not atomic)', 'member', false],
        ['Issue a time-limited, audited download link for a document', 'member', false],
        ['Download the exact authorized document through private storage', 'member', false],
        ['Extract text from the latest version of a document (machine OCR, human review required)', 'member', false],
      ]
      for (const [summary, floor, wrapperContext] of declared) {
        const config = harness.configs.find((entry) => entry.openapi?.summary === summary)
        expect(config?.auth?.required, summary).toBe(true)
        expect(config?.auth?.minRole, summary).toBe(floor)
        // Storage-facing routes explicitly opt out of the V2 wrapper transaction:
        // external work runs between their guarded operations, and batch downloads stay independent.
        expect(config?.rlsOrgContext, summary).toBe(wrapperContext)
      }
    })

    it('shows a handle with no organization no document, version, grant or workbook row (why every route opens a transaction)', async () => {
      const { documents, documentVersions } = await import('@/db/schema/documents-schema')
      const { externalMatterAccessGrants, representationAuthorities } = await import('@/db/schema/representation-authority-schema')
      const { workbooks } = await import('@/db/schema/workbook-schema')
      const id = await newDocument(ORG_A, `Probe ${tag}`)
      await admin.query(`INSERT INTO workbooks (claimed_by_user_id, claimed_org_id) VALUES ($1,$2)`, [claimant, ORG_A])
      const seen = await harness.tenant(RUNTIME_ROLE, null, memberA, async (tx) => ({
        documents: await tx.select().from(documents),
        versions: await tx.select().from(documentVersions),
        workbooks: await tx.select().from(workbooks),
      }))
      expect(Object.values(seen).map((rows) => rows.length)).toEqual([0, 0, 0])
      // The external authority and grant relations are contained in canonical V2 (CONTAINED_NO_AUTHORITY: only the qualified external
      // reader functions reach them), so the runtime role is refused them outright, in no organization and in its own alike.
      for (const organization of [null, ORG_A])
        for (const table of [representationAuthorities, externalMatterAccessGrants])
          await expect(harness.tenant(RUNTIME_ROLE, organization, memberA, (tx) => tx.select().from(table))).rejects.toMatchObject({ cause: { code: '42501' } })
      const seenByOwner = await harness.tenant(RUNTIME_ROLE, ORG_A, memberA, (tx) => tx.select().from(documents))
      expect(seenByOwner.map((row) => row.id)).toContain(id)
      // The ambient handle outside any scope is the runtime role with no organization: the same empty answer.
      expect(await ambientDb.select().from(documents)).toEqual([])
    })
  })

  describe('the repository: GET /api/documents/repository and /[id]', () => {
    it('lists an organization\'s documents to its members, and none of another organization\'s', async () => {
      const mineOne = await newDocument(ORG_A, `Handbook ${tag}`)
      const mineTwo = await newDocument(ORG_A, `Policy ${tag}`)
      const theirs = await newDocument(ORG_B, `Foreign ${tag}`, { uploadedBy: memberB })

      const forA = await json(await run(repositoryList!.GET, asMemberA, { request: request('/api/documents/repository?limit=100', 'GET') }))
      const idsA = (forA.data as Row[]).map((row) => row.id)
      expect(idsA).toEqual(expect.arrayContaining([mineOne, mineTwo]))
      expect(idsA).not.toContain(theirs)

      const forB = await json(await run(repositoryList!.GET, asMemberB, { request: request('/api/documents/repository?limit=100', 'GET') }))
      const idsB = (forB.data as Row[]).map((row) => row.id)
      expect(idsB).toContain(theirs)
      expect(idsB).not.toEqual(expect.arrayContaining([mineOne]))
      expect(JSON.stringify(forB)).not.toContain(`Handbook ${tag}`)
    })

    it('filters by keyword in SQL, answers an unknown label as a bad request and refuses a member below the floor', async () => {
      await newDocument(ORG_A, `Seniority ${tag}`)
      const found = await json(await run(repositoryList!.GET, asMemberA, { request: request(`/api/documents/repository?keyword=Seniority%20${tag}`, 'GET') }))
      expect((found.data as Row[]).map((row) => row.title)).toEqual([`Seniority ${tag}`])
      expect((await run(repositoryList!.GET, asMemberA, { request: request('/api/documents/repository?label=not_a_label', 'GET') })).status).toBe(400)
      const outsider: Who = { organizationId: ORG_A, userId: `outsider-${tag}` }
      expect((await rejection(run(repositoryList!.GET, outsider, { request: request('/api/documents/repository', 'GET') })))?.code).toBeDefined()
    })

    it('reads one document with its versions in its own organization, and answers 404 / 400 elsewhere', async () => {
      const id = await newDocument(ORG_A, `Two versions ${tag}`, { versions: 2 })
      const response = await run(repositoryOne!.GET, asMemberA, { request: request(`/api/documents/repository/${id}`, 'GET'), params: { id } })
      expect(response.status).toBe(200)
      const body = await json(response)
      expect((body.data as { versions: Row[] }).versions.map((version) => version.versionNo)).toEqual([2, 1])
      expect((await run(repositoryOne!.GET, asMemberB, { request: request(`/api/documents/repository/${id}`, 'GET'), params: { id } })).status).toBe(404)
      expect((await run(repositoryOne!.GET, asMemberA, { request: request('/api/documents/repository/not-a-uuid', 'GET'), params: { id: 'not-a-uuid' } })).status).toBe(400)
    })
  })

  describe('writes: POST /api/documents/repository, PATCH /[id], POST /[id]/versions', () => {
    it('records an uploaded file as a document of the caller\'s organization, with its first version, audited with it', async () => {
      const blobPath = `documents/${ORG_A}/upload-${randomUUID()}.pdf`
      state.storage.set(blobPath, Buffer.from('uploaded'))
      const response = await run(repositoryList!.POST, asMemberA, {
        request: request('/api/documents/repository', 'POST', { title: `Uploaded ${tag}`, filename: 'u.pdf', blobPath, documentType: 'evidence', mimeType: 'application/pdf', privacyLabel: 'team_confidential' }),
      })
      expect(response.status).toBe(200)
      const created = (await json(response)).data as { id: string; organizationId: string }
      expect(created.organizationId).toBe(ORG_A)
      const stored = await admin.query(`SELECT d.organization_id, d.uploaded_by, v.version_no, v.storage_key FROM documents d JOIN document_versions v ON v.document_id = d.id WHERE d.id = $1`, [created.id])
      expect(stored.rows).toEqual([{ organization_id: ORG_A, uploaded_by: memberA, version_no: 1, storage_key: blobPath }])
      expect(auditsFor('document.upload', ORG_A).map((entry) => entry.resourceId)).toContain(created.id)

      // The same stored file cannot be claimed again.
      const again = await run(repositoryList!.POST, asMemberA, {
        request: request('/api/documents/repository', 'POST', { title: `Again ${tag}`, filename: 'u.pdf', blobPath, documentType: 'evidence', mimeType: 'application/pdf', privacyLabel: 'team_confidential' }),
      })
      expect(again.status).toBe(409)
    })

    it('stores nothing when the audit record cannot be written', async () => {
      const blobPath = `documents/${ORG_A}/refused-${randomUUID()}.pdf`
      state.storage.set(blobPath, Buffer.from('refused'))
      harness.failNextAudit()
      const failure = await rejection(run(repositoryList!.POST, asMemberA, {
        request: request('/api/documents/repository', 'POST', { title: `Refused ${tag}`, filename: 'r.pdf', blobPath, documentType: 'evidence', mimeType: 'application/pdf', privacyLabel: 'team_confidential' }),
      }))
      expect(failure?.message).toMatch(/audit/)
      expect((await admin.query(`SELECT 1 FROM documents WHERE title = $1`, [`Refused ${tag}`])).rows).toEqual([])
      expect((await admin.query(`SELECT 1 FROM document_versions WHERE storage_key = $1`, [blobPath])).rows).toEqual([])
    })

    it('changes a privacy label for a steward of the owning organization only, audited, and answers 404 for another organization\'s document', async () => {
      const id = await newDocument(ORG_A, `Labelled ${tag}`)
      const patch = (who: Who) => run(repositoryOne!.PATCH, who, { request: request(`/api/documents/repository/${id}`, 'PATCH', { privacyLabel: 'lro_confidential' }), params: { id } })

      expect((await rejection(patch(asMemberA)))?.code).toBeDefined()
      expect((await patch(asStewardB)).status).toBe(404)
      expect((await documentRow(id))?.privacy_label).toBe('public_internal')

      const response = await patch(asStewardA)
      expect(response.status).toBe(200)
      expect((await json(response)).data).toMatchObject({ id, privacyLabel: 'lro_confidential' })
      expect((await documentRow(id))?.privacy_label).toBe('lro_confidential')
      expect(auditsFor('document.label_change', ORG_A).map((entry) => entry.resourceId)).toEqual([id])
    })

    it('appends a version for the document\'s uploader, refuses a stale base, and answers 404 for another organization', async () => {
      const id = await newDocument(ORG_A, `Versioned ${tag}`, { uploadedBy: memberA })
      const blobPath = `documents/${ORG_A}/next-${randomUUID()}.pdf`
      state.storage.set(blobPath, Buffer.from('second'))
      const append = (who: Who, body: Record<string, unknown>) => run(versions!.POST, who, { request: request(`/api/documents/repository/${id}/versions`, 'POST', body), params: { id } })

      expect((await append(asMemberB, { blobPath })).status).toBe(404)
      expect((await append(asMemberA, { blobPath, expectedVersionNo: 7 })).status).toBe(409)
      const response = await append(asMemberA, { blobPath, expectedVersionNo: 1 })
      expect(response.status).toBe(200)
      const stored = await admin.query(`SELECT organization_id, version_no, storage_key FROM document_versions WHERE document_id = $1 ORDER BY version_no`, [id])
      expect(stored.rows.map((row) => row.version_no)).toEqual([1, 2])
      expect(stored.rows[1]).toMatchObject({ organization_id: ORG_A, storage_key: blobPath })
      expect(auditsFor('document.version_append', ORG_A).map((entry) => entry.resourceId)).toEqual([id])
    })
  })

  describe('downloads: GET /api/documents/[id]/download and POST /api/documents/repository/downloads', () => {
    it('keeps child tables append-only/read-only: former child row locks fail42501, but the mutable document parent can be locked', async () => {
      const { sql } = await import('drizzle-orm')
      const id = await newDocument(ORG_A, `Native lock privilege ${tag}`)
      const grants = (await admin.query(`SELECT name,
        has_table_privilege('union_eyes_runtime','public.'||name,'UPDATE') AS table_update,
        has_any_column_privilege('union_eyes_runtime','public.'||name,'UPDATE') AS column_update
        FROM unnest(ARRAY['document_links','document_versions','document_access_grants']) AS t(name) ORDER BY name`)).rows
      expect(grants).toEqual([
        { name: 'document_access_grants', table_update: false, column_update: false },
        { name: 'document_links', table_update: false, column_update: false },
        { name: 'document_versions', table_update: false, column_update: false },
      ])
      for (const table of ['document_links', 'document_versions', 'document_access_grants']) {
        const failure = await rejection(harness.tenant(RUNTIME_ROLE, ORG_A, memberA, tx =>
          tx.execute(sql`SELECT id FROM ${sql.identifier(table)}
            WHERE organization_id=${ORG_A}::uuid AND document_id=${id}::uuid FOR SHARE`))) as {
              code?: string; cause?: { code?: string }
            } | null
        expect(failure?.code ?? failure?.cause?.code, table).toBe('42501')
      }
      const locked = await harness.tenant(RUNTIME_ROLE, ORG_A, memberA, tx =>
        tx.execute(sql`SELECT id::text FROM public.documents
          WHERE organization_id=${ORG_A}::uuid AND id=${id}::uuid FOR SHARE`))
      expect(locked.rows).toEqual([{ id }])
    })

    it('serves the exact application-link bytes and commits their canonical audit as the restricted runtime role without child UPDATE grants', async () => {
      const title = `Native byte delivery ${tag}`
      const id = await newDocument(ORG_A, title)
      const issued = await run(downloadOne!.GET, asMemberA, {
        request: request(`/api/documents/${id}/download`, 'GET'), params: { id },
      })
      expect(issued.status).toBe(200)
      const url = ((await json(issued)).data as { downloadUrl: string }).downloadUrl
      expect(state.transactionsDuringStorageRead).toEqual([])
      const served = await run(contentDownload!.GET, asMemberA, {
        request: new Request(new globalThis.URL(url, 'http://localhost')), params: { id },
      })
      expect(served.status).toBe(200)
      const expected = Buffer.from(`${title} v1`)
      expect(Buffer.from(await served.arrayBuffer())).toEqual(expected)
      expect(served.headers.get('content-length')).toBe(String(expected.length))
      expect(served.headers.get('cache-control')).toBe('private, no-store')
      expect(state.transactionsDuringStorageRead).toEqual([0])
      const records = (await admin.query(`SELECT user_id,resource_id,details,content_hash FROM public.audit_logs
        WHERE organization_id=$1 AND action='document.download_served' AND resource_id=$2`, [ORG_A, id])).rows
      expect(records).toHaveLength(1)
      expect(records[0]).toMatchObject({ user_id: memberA, resource_id: id, details: {
        delivery: 'application_response_authorized', checksumSha256: createHash('sha256').update(expected).digest('hex'),
        sizeBytes: expected.length, versionNo: 1, integrityBasis: 'stored_version_hash',
      } })
      expect(records[0].content_hash).toMatch(/^[a-f0-9]{64}$/)
      expect((await admin.query(`SELECT bool_or(has_any_column_privilege('union_eyes_runtime','public.'||name,'UPDATE')) AS widened
        FROM unnest(ARRAY['document_links','document_versions','document_access_grants']) AS t(name)`)).rows[0].widened).toBe(false)
    })

    it('issues a link for a document of the caller\'s organization, records the access in it, and answers 404 for another organization', async () => {
      const id = await newDocument(ORG_A, `Download ${tag}`)
      const response = await run(downloadOne!.GET, asMemberA, { request: request(`/api/documents/${id}/download`, 'GET'), params: { id } })
      expect(response.status).toBe(200)
      const url = ((await json(response)).data as { downloadUrl: string }).downloadUrl
      expect(new globalThis.URL(url, 'http://localhost').pathname).toBe(`/api/documents/${id}/content`)
      expect(new globalThis.URL(url, 'http://localhost').searchParams.get('lease')).toBeTruthy()
      expect(url).not.toMatch(/sig=|storage\.test|blob\.core\.windows\.net/)
      expect(auditsFor('document.download', ORG_A).map((entry) => entry.resourceId)).toContain(id)
      expect((await run(downloadOne!.GET, asMemberB, { request: request(`/api/documents/${id}/download`, 'GET'), params: { id } })).status).toBe(404)
      expect(auditsFor('document.download', ORG_B)).toEqual([])
    })

    it('is a batch of independent transactions: a refused access record on one document does not undo or poison the others', async () => {
      const first = await newDocument(ORG_A, `Bulk one ${tag}`)
      const second = await newDocument(ORG_A, `Bulk two ${tag}`)
      const third = await newDocument(ORG_B, `Bulk foreign ${tag}`, { uploadedBy: memberB })
      const before = harness.audits.length
      harness.failNextAudit()

      const response = await run(downloadMany!.POST, asMemberA, { request: request('/api/documents/repository/downloads', 'POST', { documentIds: [first, second, third] }) })
      expect(response.status).toBe(200)
      const data = (await json(response)).data as { atomic: boolean; status: string; items: Array<{ documentId: string; outcome: string; downloadUrl?: string }> }
      expect(data.atomic).toBe(false)
      expect(data.items.map((item) => [item.documentId, item.outcome])).toEqual([[first, 'audit_failed'], [second, 'issued'], [third, 'not_found']])
      expect(data.items[0].downloadUrl).toBeUndefined()
      // Only the document whose access was recorded has a record, and the link that was issued is the one with the record.
      expect(harness.audits.slice(before).map((entry) => [entry.action, entry.resourceId])).toEqual([['document.download', second]])
    })
  })

  describe('text extraction: POST /api/documents/[id]/ocr', () => {
    it('reads storage with no transaction open, stores the machine revision in the owning organization, and answers 404 elsewhere', async () => {
      const id = await newDocument(ORG_A, `Scan ${tag}`, { uploadedBy: staffA })
      await admin.query(
        `INSERT INTO document_access_grants (organization_id, document_id, user_id, status, can_view, can_download, can_process_ocr, granted_by) VALUES ($1,$2,$3,'active',true,true,true,$4)`,
        [ORG_A, id, memberA, staffA],
      )
      const call = (who: Who) => run(ocr!.POST, who, { request: request(`/api/documents/${id}/ocr`, 'POST'), params: { id } })

      const response = await call(asMemberA)
      expect(response.status).toBe(200)
      const body = (await json(response)).data as { documentId: string; revisionNo: number; authoritative: boolean; reviewRequired: boolean }
      expect(body).toMatchObject({ documentId: id, revisionNo: 1, authoritative: false, reviewRequired: true })
      expect(state.transactionsDuringStorageRead).toEqual([0])
      const revisions = await admin.query(`SELECT organization_id, document_id FROM document_transcript_revisions WHERE document_id = $1`, [id])
      expect(revisions.rows).toEqual([{ organization_id: ORG_A, document_id: id }])
      expect(auditsFor('document.ocr.extract', ORG_A).map((entry) => entry.resourceId)).toContain(id)

      // Another organization's member neither sees the document nor reads its storage.
      state.transactionsDuringStorageRead.length = 0
      expect((await call(asMemberB)).status).toBe(404)
      expect(state.transactionsDuringStorageRead).toEqual([])
    })
  })

  describe('external parties: /api/external/grievances/[id], /documents, /api/external/documents/[id], /download, /documents/upload', () => {
    let grievance: string
    let document: string
    let staffGrantedBy: string
    let authorityId: string
    let matterGrantId: string
    const external = () => ({ userId: representative, organizationId: repOrganization })
    const getMatter = (organization: string, id: string) =>
      (externalMatter!.GET as (request: Request, context: unknown) => Promise<Response>)(request(`/api/external/grievances/${id}?organizationId=${organization}`, 'GET'), routeParams({ id }))

    beforeAll(async () => {
      staffGrantedBy = staffA
      grievance = await newGrievance(ORG_A, memberA)
      document = await newDocument(ORG_A, `Counsel copy ${tag}`, { grievanceId: grievance, versions: 2 })
      const authority = await admin.query(
        `INSERT INTO representation_authorities (organization_id, matter_type, matter_id, represented_person_id, representative_user_id, representative_organization_id, status, created_by)
         VALUES ($1,'grievance',$2,$3,$4,$5,'active',$6) RETURNING id::text AS id`,
        [ORG_A, grievance, randomUUID(), representative, repOrganization, staffGrantedBy],
      )
      authorityId = authority.rows[0].id as string
      const grant = await admin.query(
        `INSERT INTO external_matter_access_grants (authority_id, organization_id, matter_type, matter_id, user_id, representative_organization_id, status, can_view, can_upload_documents, can_view_documents, can_download_documents, granted_by)
         VALUES ($1,$2,'grievance',$3,$4,$5,'active',true,true,true,true,$6) RETURNING id::text AS id`,
        [authorityId, ORG_A, grievance, representative, repOrganization, staffGrantedBy],
      )
      matterGrantId = grant.rows[0].id as string
      await admin.query(
        `INSERT INTO external_document_access_grants (authority_id, matter_grant_id, organization_id, matter_type, matter_id, document_id, user_id, representative_organization_id, status, can_view, can_download, document_version_no, granted_by)
         VALUES ($1,$2,$3,'grievance',$4,$5,$6,$7,'active',true,true,1,$8)`,
        [authorityId, matterGrantId, ORG_A, grievance, document, representative, repOrganization, staffGrantedBy],
      )
    })

    // Canonical V2 reads an external matter only through a separately qualified institutional authority (ue_external_resource_read_v1:
    // independent approval, member consent and an exact qualification, proven positively in external-resource-read.postgres.test.ts).
    // The rows this fixture writes are the legacy grant model, which canonical V2 does not qualify ("does not qualify legacy active grants or
    // member consent without exact institutional approval"). So through every route the representative, a stranger and another organization
    // alike are refused with 403 (never 503), no projection, document or byte leaves, storage is never read, and no release is recorded.
    const releaseActions = ['external.resource.read', 'document.external_download']
    const released = (before: number) => harness.audits.slice(before).filter((entry) => releaseActions.includes(entry.action))
    const refusedBody = async (response: Response) => {
      expect(response.status).toBe(403)
      const text = await response.text()
      for (const secret of [`Counsel copy ${tag}`, grievance, document]) expect(text).not.toContain(secret)
    }

    it('refuses the matter to its legacy-granted representative in the organization they name, and records no read', async () => {
      state.session = external()
      const before = harness.audits.length
      await refusedBody(await getMatter(ORG_A, grievance))
      expect(released(before)).toEqual([])
    })

    it('gives a stranger, another organization and a malformed identifier nothing', async () => {
      state.session = { userId: stranger, organizationId: randomUUID() }
      const before = harness.audits.length
      expect((await getMatter(ORG_A, grievance)).status).toBe(403)
      state.session = external()
      // The representative names the other organization: they hold no authority there.
      expect((await getMatter(ORG_B, grievance)).status).toBe(403)
      // The canonical reader answers a malformed identifier as it answers every refusal (no oracle): 403.
      expect((await getMatter('not-a-uuid', grievance)).status).toBe(403)
      state.session = { userId: null, organizationId: undefined }
      expect((await getMatter(ORG_A, grievance)).status).toBe(401)
      // A refusal for someone with no authority is not a row in the named organization's audit trail.
      expect(harness.audits.slice(before).filter((entry) => entry.organizationId === ORG_B)).toEqual([])
      expect(released(before)).toEqual([])
    })

    it('lists no document to a representative who holds only legacy grants', async () => {
      await newDocument(ORG_A, `Not granted ${tag}`, { grievanceId: grievance })
      state.session = external()
      const before = harness.audits.length
      const response = await (externalDocuments!.GET as (request: Request, context: unknown) => Promise<Response>)(
        request(`/api/external/grievances/${grievance}/documents?organizationId=${ORG_A}`, 'GET'),
        routeParams({ id: grievance }),
      )
      await refusedBody(response)
      expect(released(before)).toEqual([])
    })

    it('reads no document, granted or not, and refuses a malformed identifier', async () => {
      state.session = external()
      const get = (id: string) =>
        (externalDocument!.GET as (request: Request, context: unknown) => Promise<Response>)(
          request(`/api/external/documents/${id}?organizationId=${ORG_A}&matterId=${grievance}`, 'GET'),
          routeParams({ id }),
        )
      await refusedBody(await get(document))
      expect([403, 404]).toContain((await get('not-a-uuid')).status)
      const ungranted = await newDocument(ORG_A, `Ungranted ${tag}`, { grievanceId: grievance })
      expect((await get(ungranted)).status).toBe(403)
    })

    it('serves no bytes: storage is never read and no delivery is recorded', async () => {
      state.session = external()
      const before = harness.audits.length
      const storageReads = state.transactionsDuringStorageRead.length
      const response = await (externalDownload!.GET as (request: Request, context: unknown) => Promise<Response>)(
        request(`/api/external/documents/${document}/download?organizationId=${ORG_A}&matterId=${grievance}`, 'GET'),
        routeParams({ id: document }),
      )
      await refusedBody(response)
      expect(state.transactionsDuringStorageRead.length).toBe(storageReads)
      expect(released(before)).toEqual([])
    })

    it('stays refused before and after the legacy grant is revoked, releasing nothing', async () => {
      state.session = external()
      const download = () =>
        (externalDownload!.GET as (request: Request, context: unknown) => Promise<Response>)(
          request(`/api/external/documents/${document}/download?organizationId=${ORG_A}&matterId=${grievance}`, 'GET'),
          routeParams({ id: document }),
        )
      // A refusal writes no release record, so there is no audit to make fail here (an armed fault would outlive this test).
      const armed = harness.audits.length
      expect((await download()).status).toBe(403)
      expect(released(armed)).toEqual([])
      await admin.query(`UPDATE external_document_access_grants SET status = 'revoked', revoked_at = now() WHERE document_id = $1`, [document])
      expect((await download()).status).toBe(403)
      await admin.query(`UPDATE external_document_access_grants SET status = 'active', revoked_at = NULL WHERE document_id = $1`, [document])
      expect(released(armed)).toEqual([])
    })

    const uploadAs = (blobPath: string) =>
      (externalUpload!.POST as (request: Request, context: unknown) => Promise<Response>)(
        request(`/api/external/grievances/${grievance}/documents/upload?organizationId=${ORG_A}`, 'POST', { title: `Counsel upload ${tag}`, filename: 'c.pdf', blobPath, documentType: 'evidence', mimeType: 'application/pdf' }),
        routeParams({ id: grievance }),
      )

    it('refuses an external upload before the write and leaves no document or release audit', async () => {
      state.session = external()
      const blobPath = `documents/${ORG_A}/external-${randomUUID()}.pdf`
      state.storage.set(blobPath, Buffer.from('from counsel'))
      const before = harness.audits.length

      const response = await uploadAs(blobPath)

      // Canonical V2 admits no external write at all: the canonical external boundary answers every non-read request 403 before the
      // route runs (lib/external-resource-middleware.ts). The fixture still proves the write is refused and nothing is left behind.
      expect(response.status).toBe(403)
      expect((await admin.query(`SELECT 1 FROM documents WHERE blob_path = $1`, [blobPath])).rows).toEqual([])
      expect((await admin.query(`SELECT 1 FROM document_versions WHERE storage_key = $1`, [blobPath])).rows).toEqual([])
      expect(harness.audits.slice(before).filter((entry) => entry.action === 'document.external_upload')).toEqual([])
    })

    it('refuses repeated external uploads and a foreign blob without writing any part of the document graph', async () => {
      state.session = external()
      const counts = async () => {
        const { rows } = await admin.query(`SELECT
          (SELECT count(*)::int FROM documents) AS documents,
          (SELECT count(*)::int FROM document_versions) AS versions,
          (SELECT count(*)::int FROM document_links) AS links,
          (SELECT count(*)::int FROM external_document_access_grants) AS grants`)
        return rows[0]
      }
      const before = await counts()
      const auditStart = harness.audits.length
      const ownBlob = `documents/${ORG_A}/external-${randomUUID()}.pdf`
      const foreignBlob = `documents/${ORG_B}/external-${randomUUID()}.pdf`
      for (const blobPath of [ownBlob, ownBlob, foreignBlob]) {
        state.storage.set(blobPath, Buffer.from('from counsel'))
        expect((await uploadAs(blobPath)).status).toBe(403)
        expect(await counts()).toEqual(before)
      }
      expect(harness.audits.slice(auditStart).filter(entry => entry.action === 'document.external_upload')).toEqual([])
    })
  })

  describe('workbooks: /api/workbook/[id]/memory-holders, /[holderId], /export', () => {
    const asClaimant = () => { state.session = { userId: claimant, organizationId: ORG_A } }
    const newWorkbook = async (options: { claimed?: boolean; tier?: string } = {}) => {
      const issued = capability!.issueWorkbookCapability()
      const { rows } = await admin.query(
        `INSERT INTO workbooks (claimed_by_user_id, claimed_org_id, capability_token_hash, capability_token_expires_at, report_tier_id, consent) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id::text AS id`,
        [options.claimed ? claimant : null, options.claimed ? ORG_A : null, options.claimed ? null : issued.tokenHash, options.claimed ? null : issued.expiresAt, options.tier ?? null, JSON.stringify(workbookConsent!.issueWorkbookConsent())],
      )
      return { id: rows[0].id as string, token: issued.token }
    }
    const newHolder = async (workbookId: string, role: string) => {
      const { rows } = await admin.query(`INSERT INTO workbook_memory_holders (workbook_id, role, responsibility) VALUES ($1,$2,'Payroll') RETURNING id::text AS id`, [workbookId, role])
      return rows[0].id as string
    }
    const list = (workbookId: string, headers: Record<string, string> = {}) =>
      (holders!.GET as (request: Request, context: unknown) => Promise<Response>)(
        new (globalThis.Request as typeof Request)(`http://localhost/api/workbook/${workbookId}/memory-holders`, { headers }) as never,
        routeParams({ id: workbookId }),
      )

    it('serves an unclaimed workbook to the holder of its capability on the bounded system transaction, and to nobody else', async () => {
      const workbook = await newWorkbook()
      await newHolder(workbook.id, `Treasurer ${tag}`)
      const response = await list(workbook.id, { authorization: `Bearer ${workbook.token}` })
      expect(response.status).toBe(200)
      expect(((await json(response)) as unknown as { holders: Row[] }).holders.map((holder) => holder.role)).toEqual([`Treasurer ${tag}`])
      // The access record was written on the transaction the boundary opened: the system role, with no organization.
      expect(state.publicIntakeAudits).toHaveLength(1)
      expect(state.publicIntakeAudits[0].identity).toMatchObject({ u: SYSTEM_ROLE })

      expect((await list(workbook.id)).status).toBe(404)
      expect((await list(workbook.id, { authorization: `Bearer ${capability!.issueWorkbookCapability().token}` })).status).toBe(404)
      expect((await list('not-a-uuid')).status).toBe(404)
    })

    it('serves a claimed workbook to its claimant on their own user context, and a same-organization steward on the system context, and refuses others', async () => {
      const workbook = await newWorkbook({ claimed: true })
      await newHolder(workbook.id, `Secretary ${tag}`)
      const before = harness.audits.length

      asClaimant()
      const own = await list(workbook.id)
      expect(own.status).toBe(200)
      expect(((await json(own)) as unknown as { holders: Row[] }).holders.map((holder) => holder.role)).toEqual([`Secretary ${tag}`])

      state.session = { userId: peerA, organizationId: ORG_A }
      expect((await list(workbook.id)).status).toBe(200)

      state.session = { userId: peerB, organizationId: ORG_B }
      expect((await list(workbook.id)).status).toBe(403)
      state.session = { userId: null, organizationId: undefined }
      expect((await list(workbook.id)).status).toBe(401)

      // Both reads were recorded under the claiming organization, for the person who acted.
      expect(harness.audits.slice(before).filter((entry) => entry.action === 'workbook.memory_holder.read').map((entry) => [entry.organizationId, entry.userId])).toEqual([[ORG_A, claimant], [ORG_A, peerA]])
    })

    it('creates, updates and deletes a holder on the claimant\'s transaction, each audited with it, and stores nothing when the audit is refused', async () => {
      const workbook = await newWorkbook({ claimed: true })
      asClaimant()
      const post = (body: unknown) =>
        (holders!.POST as (request: Request, context: unknown) => Promise<Response>)(request(`/api/workbook/${workbook.id}/memory-holders`, 'POST', body), routeParams({ id: workbook.id }))

      harness.failNextAudit()
      expect((await post({ role: `Refused ${tag}`, responsibility: 'Payroll' })).status).toBe(503)
      expect((await admin.query(`SELECT 1 FROM workbook_memory_holders WHERE role = $1`, [`Refused ${tag}`])).rows).toEqual([])

      const created = await post({ role: `Chair ${tag}`, responsibility: 'Agenda' })
      expect(created.status).toBe(201)
      const holderId = ((await json(created)) as unknown as { id: string }).id
      expect(auditsFor('workbook.memory_holder.create', ORG_A).map((entry) => entry.resourceId)).toContain(holderId)

      const patch = (headersOrId: string, body: unknown) =>
        (holderOne!.PATCH as (request: Request, context: unknown) => Promise<Response>)(request(`/api/workbook/${workbook.id}/memory-holders/${headersOrId}`, 'PATCH', body), routeParams({ id: workbook.id, holderId: headersOrId }))
      expect((await patch(holderId, { role: `Vice chair ${tag}` })).status).toBe(200)
      expect((await admin.query(`SELECT role FROM workbook_memory_holders WHERE id = $1`, [holderId])).rows).toEqual([{ role: `Vice chair ${tag}` }])
      expect((await patch(randomUUID(), { role: 'x' })).status).toBe(404)
      expect((await patch('not-a-uuid', { role: 'x' })).status).toBe(404)

      // A stranger neither updates nor deletes it.
      state.session = { userId: peerB, organizationId: ORG_B }
      expect((await patch(holderId, { role: 'Taken over' })).status).toBe(403)
      const remove = (id: string) =>
        (holderOne!.DELETE as (request: Request, context: unknown) => Promise<Response>)(request(`/api/workbook/${workbook.id}/memory-holders/${id}`, 'DELETE'), routeParams({ id: workbook.id, holderId: id }))
      expect((await remove(holderId)).status).toBe(403)
      expect((await admin.query(`SELECT 1 FROM workbook_memory_holders WHERE id = $1`, [holderId])).rows).toHaveLength(1)

      asClaimant()
      expect((await remove(holderId)).status).toBe(200)
      expect((await admin.query(`SELECT 1 FROM workbook_memory_holders WHERE id = $1`, [holderId])).rows).toEqual([])
      expect(auditsFor('workbook.memory_holder.delete', ORG_A).map((entry) => entry.resourceId)).toContain(holderId)
    })

    it('exports a claimed workbook of an eligible tier, rendering on the claimant\'s transaction, and refuses an unclaimed one', async () => {
      const claimed = await newWorkbook({ claimed: true, tier: 'workbook_self_guided' })
      asClaimant()
      const exportOf = (id: string, headers: Record<string, string> = {}) =>
        (workbookExport!.GET as (request: Request, context: unknown) => Promise<Response>)(new (globalThis.Request as typeof Request)(`http://localhost/api/workbook/${id}/export`, { headers }) as never, routeParams({ id }))

      const response = await exportOf(claimed.id)
      expect(response.status).toBe(200)
      expect(state.generatedFor).toHaveLength(1)
      expect(state.generatedFor[0].identity).toMatchObject({ u: RUNTIME_ROLE, usr: claimant, org: ORG_A })
      expect(auditsFor('workbook.export', ORG_A).map((entry) => entry.resourceId)).toContain(claimed.id)

      const lowTier = await newWorkbook({ claimed: true, tier: 'basic_preview' })
      expect((await exportOf(lowTier.id)).status).toBe(402)
      const unclaimed = await newWorkbook({ tier: 'workbook_self_guided' })
      expect((await exportOf(unclaimed.id, { authorization: `Bearer ${unclaimed.token}` })).status).toBe(403)
      state.session = { userId: peerB, organizationId: ORG_B }
      expect((await exportOf(claimed.id)).status).toBe(403)
    })
  })
})
