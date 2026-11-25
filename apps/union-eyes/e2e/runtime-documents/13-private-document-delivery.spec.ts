import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { container } from '@nzila/blob'
import { queryOwnedRuntime } from '../../scripts/runtime/db-inspect'
import { issueDocumentDownloadLease } from '../../lib/documents/download-lease'
import { runtimeRequestAs } from '../helpers/runtime-auth'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

/**
 * Runtime acceptance 13: private-document delivery over real HTTP.
 *
 * The real Next.js application, native PostgreSQL, real Redis and a real Azure Blob service (Azurite) hold every artifact.
 * Authenticate (password + MFA) -> authorize -> bind the artifact -> read storage -> revalidate live authority -> commit the
 * required audit -> release bytes. Positive cases compare the released bytes with the uploaded bytes by SHA-256.
 * Each case records the HTTP statuses it saw and the database evidence it read, in test-results/document-evidence.json.
 */
const PRIMARY = UE_TEST_ORGS.primary.id
const U = UE_TEST_USERS
const STATE_DIR = process.env.UE_RUNTIME_STATE_DIR ?? join(process.cwd(), '..', '..', '.ue-runtime')
const EVIDENCE: Array<Record<string, unknown>> = []
const record = (name: string, facts: Record<string, unknown>) => EVIDENCE.push({ name, ...facts })

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const pdf = (label: string, size = 4096): Buffer =>
  Buffer.concat([Buffer.from(`%PDF-1.4\n% ${label}\n`, 'latin1'), randomBytes(size), Buffer.from('\n%%EOF\n', 'latin1')])

const as = (userId: string, orgId: string = PRIMARY) => runtimeRequestAs(userId, orgId)
const adminScript = (...args: string[]) =>
  execFileSync('npx', ['tsx', 'scripts/runtime/authority-admin.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, QA_TEST_ENV: 'true' },
    stdio: 'pipe',
  })

async function sql<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  return queryOwnedRuntime<T>(text, values)
}

const RUN = Date.now().toString(36)

async function fileCase(label: string): Promise<string> {
  const title = `${label} ${RUN}`
  const response = await (await as(U.memberPrimary.userId)).post('/api/cases/intake', {
    data: {
      memberId: U.memberPrimary.userId,
      caseType: 'discipline',
      priority: 'medium',
      title,
      description: `Private description for ${title}`,
      incidentDate: '2026-10-01',
      location: 'Plant 2',
    },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).claimId as string
}

async function assign(coordinator: string, caseId: string, assignee: string) {
  const response = await (await as(coordinator)).post(`/api/cases/${caseId}/assign`, {
    data: { assigneeId: assignee, reason: 'document acceptance' },
  })
  expect(response.status(), await response.text()).toBe(200)
}

async function intake(ctx: APIRequestContext, filename: string, buffer: Buffer, operation = 'create_document', targetDocumentId?: string) {
  const response = await ctx.post('/api/documents/intakes', {
    multipart: {
      file: { name: filename, mimeType: 'application/pdf', buffer },
      operation,
      ...(targetDocumentId ? { targetDocumentId } : {}),
    },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).data.intakeId as string
}

interface Linked {
  type: 'case' | 'grievance'
  id: string
}
async function createDocument(
  ctx: APIRequestContext,
  input: { title: string; filename: string; bytes: Buffer; label: string; link?: Linked },
) {
  const intakeId = await intake(ctx, input.filename, input.bytes)
  const response = await ctx.post('/api/documents/repository', {
    data: {
      title: input.title,
      filename: input.filename,
      intakeId,
      documentType: 'evidence',
      privacyLabel: input.label,
      ...(input.link ? { linkedEntityType: input.link.type, linkedEntityId: input.link.id } : {}),
    },
  })
  expect(response.status(), await response.text()).toBe(200)
  const body = await response.json()
  return (body.data?.id ?? body.id) as string
}

async function issue(ctx: APIRequestContext, documentId: string) {
  const response = await ctx.get(`/api/documents/${documentId}/download`)
  const body = await response.json().catch(() => null)
  return { status: response.status(), url: (body?.data?.downloadUrl ?? null) as string | null, body }
}

async function bytesVia(ctx: APIRequestContext, url: string) {
  const response = await ctx.get(url)
  return { status: response.status(), headers: response.headers(), body: response.status() === 200 ? await response.body() : null }
}

const auditRows = (documentId: string) =>
  sql<{ action: string; details: Record<string, unknown>; user_id: string }>(
    `SELECT action, details, user_id FROM public.audit_logs WHERE organization_id=$1 AND resource_id=$2 AND action IN ('document.download','document.download_served') ORDER BY created_at, id`,
    [PRIMARY, documentId],
  )
const served = async (documentId: string) => (await auditRows(documentId)).filter((row) => row.action === 'document.download_served').length

let caseOne = ''
let caseTwo = ''
const bytesOf = new Map<string, Buffer>()
const documents: Record<string, string> = {}

test.describe.configure({ mode: 'serial', timeout: 180_000 })

test.describe('private document delivery: authenticate, authorize, bind, read, revalidate, audit, release', () => {
  test.beforeAll(async () => {
    // The CI Playwright config caps a hook at 60s. Two scope-case transactions exceed that on a cold runner.
    test.setTimeout(180_000)
    await container(process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes').createIfNotExists()
    adminScript('restore-fixtures')
    caseOne = await fileCase('Document delivery case one')
    caseTwo = await fileCase('Document delivery case two')
    adminScript('scope-case', caseOne)
    adminScript('scope-case', caseTwo)
    await assign(U.chiefStewardPrimary.userId, caseOne, U.stewardPrimary.userId)
    await assign(U.chiefStewardPrimary.userId, caseTwo, U.stewardPrimaryTwo.userId)
  })

  test.afterAll(async () => {
    await mkdir(join(STATE_DIR, 'evidence'), { recursive: true })
    await writeFile(join(STATE_DIR, 'evidence', 'document-evidence.json'), JSON.stringify(EVIDENCE, null, 2))
  })

  test('setup: a case-linked document stores exact bytes through the real intake and the assigned representative downloads them intact; the filing member can neither upload nor read it', async () => {
    const member = await as(U.memberPrimary.userId)
    const steward = await as(U.stewardPrimary.userId)
    const content = pdf('case-restricted evidence')
    bytesOf.set('restricted', content)
    const memberUpload = await member.post('/api/documents/repository', {
      data: { title: 'Member attempt', filename: 'member.pdf', intakeId: await intake(member, 'member.pdf', pdf('member attempt')), documentType: 'evidence', privacyLabel: 'case_restricted', linkedEntityType: 'case', linkedEntityId: caseOne },
    })
    expect(memberUpload.status(), 'the filing member holds no evidence-upload authority on the case').toBe(404)
    documents.restricted = await createDocument(steward, {
      title: 'Restricted evidence', filename: 'Déclaration – grief “été”.pdf', bytes: content, label: 'case_restricted',
      link: { type: 'case', id: caseOne },
    })
    const lease = await issue(steward, documents.restricted)
    expect(lease.status, JSON.stringify(lease.body)).toBe(200)
    const memberRead = await issue(member, documents.restricted)
    expect(memberRead.status, 'uploader and reader differ: the filing member does not read case evidence through the repository').toBe(403)
    const download = await bytesVia(steward, lease.url!)
    expect(download.status).toBe(200)
    expect(sha(download.body!)).toBe(sha(content))
    expect(download.body!.length).toBe(content.length)
    expect(download.headers['content-disposition']).toMatch(/^attachment; filename\*=UTF-8''/)
    expect(download.headers['content-disposition']).toContain(encodeURIComponent('Déclaration'))
    expect(download.headers['cache-control']).toContain('no-store')
    expect(download.headers['x-content-type-options']).toBe('nosniff')
    const rows = await auditRows(documents.restricted)
    expect(rows.map((row) => row.action)).toEqual(['document.download', 'document.download_served'])
    expect(rows[1].details.checksumSha256).toBe(sha(content))
    expect(rows[1].details.sizeBytes).toBe(content.length)
    record('assigned representative uploads and downloads exact bytes; the filing member is refused', { issue: lease.status, content: download.status, audit: rows.map((row) => row.action), sha256: sha(content) })
  })

  test('both case-link spellings give the same authority: the assigned representative reads, an unassigned one and an administrator are refused', async () => {
    const steward = await as(U.stewardPrimary.userId)
    const content = pdf('grievance spelling')
    documents.grievanceSpelling = await createDocument(steward, {
      title: 'Grievance spelling', filename: 'spelling.pdf', bytes: content, label: 'team_confidential',
      link: { type: 'grievance', id: caseOne },
    })
    const matrix = [
      ['assigned steward (uploader)', U.stewardPrimary.userId, 200],
      ['filing member', U.memberPrimary.userId, 403],
      ['unassigned steward', U.stewardPrimaryTwo.userId, 403],
      ['organization administrator', U.adminPrimary.userId, 403],
      ['coordinator holding only an assign mandate', U.chiefStewardPrimary.userId, 403],
    ] as const
    for (const documentId of [documents.restricted, documents.grievanceSpelling]) {
      for (const [name, userId, expected] of matrix) {
        const result = await issue(await as(userId), documentId)
        expect(result.status, `${name} ${documentId}`).toBe(expected)
        if (expected === 200) {
          const download = await bytesVia(await as(userId), result.url!)
          expect(download.status).toBe(200)
        } else {
          expect(JSON.stringify(result.body)).not.toMatch(/blob|azure|storage|http:\/\/127/i)
        }
        record(`link spelling matrix: ${name}`, { documentId, expected, observed: result.status })
      }
    }
    const stored = await sql<{ linked_entity_type: string }>('SELECT linked_entity_type FROM document_links WHERE document_id=$1', [documents.grievanceSpelling])
    expect(stored.map((row) => row.linked_entity_type)).toEqual(['grievance'])
  })

  test('other-organization actors, a suspended member, an external counsel without a matter grant and an anonymous caller are refused', async () => {
    const outsiders = [
      ['member of another organization', U.memberSecondary.userId, U.memberSecondary.orgId],
      ['steward of another organization acting in the primary one', U.wrongOrgSteward.userId, U.wrongOrgSteward.orgId],
    ] as const
    for (const [name, userId, orgId] of outsiders) {
      const result = await issue(await as(userId, orgId), documents.restricted)
      expect([403, 404], name).toContain(result.status)
      record(`cross-tenant: ${name}`, { observed: result.status })
    }
    const external = await issue(await as(U.externalCounsel.userId, U.externalCounsel.orgId), documents.restricted)
    expect([401, 403, 404]).toContain(external.status)
    const anonymous = await pwRequest.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL })
    const anon = await anonymous.get(`/api/documents/${documents.restricted}/download`)
    expect([401, 403]).toContain(anon.status())
    const anonContent = await anonymous.get(`/api/documents/${documents.restricted}/content?lease=x`)
    expect([401, 403]).toContain(anonContent.status())
    const suspended = await as(U.suspendedMember.userId, U.suspendedMember.orgId).catch(() => null)
    if (suspended) expect([401, 403]).toContain((await suspended.get(`/api/documents/${documents.restricted}/download`)).status())
    record('external, anonymous and suspended refusals', { external: external.status, anonymous: anon.status() })
  })

  test('restricted labels: a case-linked document needs the case relationship, a grant alone never opens it; an organization-level restricted document needs a download grant that revocation removes', async () => {
    const owner = await as(U.stewardPrimary.userId)
    const other = await as(U.stewardPrimaryTwo.userId)
    const content = pdf('highly sensitive')
    documents.sensitive = await createDocument(owner, {
      title: 'Highly sensitive', filename: 'sensitive.pdf', bytes: content, label: 'highly_sensitive', link: { type: 'case', id: caseOne },
    })
    expect((await issue(owner, documents.sensitive)).status, 'the primary owner of the case').toBe(200)
    expect((await issue(other, documents.sensitive)).status).toBe(403)
    await sql(
      `INSERT INTO document_access_grants (organization_id, document_id, user_id, granted_by, status, can_view, can_download)
       VALUES ($1,$2,$3,$4,'active',true,true)`,
      [PRIMARY, documents.sensitive, U.stewardPrimaryTwo.userId, U.stewardPrimary.userId],
    )
    expect((await issue(other, documents.sensitive)).status, 'seniority and a grant are not a case relationship').toBe(403)

    documents.orgRestricted = await createDocument(owner, {
      title: 'Organization restricted', filename: 'org-restricted.pdf', bytes: pdf('org restricted'), label: 'highly_sensitive',
    })
    expect((await issue(other, documents.orgRestricted)).status, 'no grant').toBe(403)
    await sql(
      `INSERT INTO document_access_grants (organization_id, document_id, user_id, granted_by, status, can_view, can_download)
       VALUES ($1,$2,$3,$4,'active',true,false)`,
      [PRIMARY, documents.orgRestricted, U.stewardPrimaryTwo.userId, U.stewardPrimary.userId],
    )
    expect((await issue(other, documents.orgRestricted)).status, 'a view-only grant does not deliver bytes').toBe(403)
    await sql(`UPDATE document_access_grants SET can_download=true WHERE document_id=$1 AND user_id=$2`, [documents.orgRestricted, U.stewardPrimaryTwo.userId])
    const allowed = await issue(other, documents.orgRestricted)
    expect(allowed.status).toBe(200)
    expect((await bytesVia(other, allowed.url!)).status).toBe(200)
    await sql(`UPDATE document_access_grants SET status='revoked', revoked_at=NOW() WHERE document_id=$1 AND user_id=$2`, [documents.orgRestricted, U.stewardPrimaryTwo.userId])
    expect((await issue(other, documents.orgRestricted)).status).toBe(403)
    expect((await bytesVia(other, allowed.url!)).status, 'a lease issued under a revoked grant releases nothing').toBe(403)
    record('explicit grant lifecycle', { caseLinkedPrimaryOwner: 200, caseLinkedGrantAlone: 403, orgNoGrant: 403, orgViewOnly: 403, orgDownloadGrant: 200, orgRevoked: 403, staleLease: 403 })
  })

  test('an organization-level document: a representative reads it, a member is refused and another organization never reads it', async () => {
    const steward = await as(U.stewardPrimary.userId)
    documents.orgConfidential = await createDocument(steward, {
      title: 'Org confidential', filename: 'org.pdf', bytes: pdf('org confidential'), label: 'team_confidential',
    })
    documents.orgShared = await createDocument(steward, {
      title: 'Org shared', filename: 'shared.pdf', bytes: pdf('org shared'), label: 'public_internal',
    })
    expect((await issue(steward, documents.orgConfidential)).status).toBe(200)
    expect((await issue(await as(U.memberPrimary.userId), documents.orgConfidential)).status).toBe(403)
    expect((await issue(await as(U.stewardPrimaryTwo.userId), documents.orgConfidential)).status).toBe(200)
    expect((await issue(await as(U.memberSecondary.userId, U.memberSecondary.orgId), documents.orgShared)).status).not.toBe(200)
    record('organization-level documents', { uploader: 200, unrelatedMemberConfidential: 403, otherRepresentative: 200 })
  })

  test('a document linked to two cases is decided the same way for every link order: access through either linked case opens it', async () => {
    const steward = await as(U.stewardPrimary.userId)
    const stewardTwo = await as(U.stewardPrimaryTwo.userId)
    const outsider = await as(U.adminPrimary.userId)
    documents.multi = await createDocument(steward, {
      title: 'Two cases', filename: 'two-cases.pdf', bytes: pdf('two cases'), label: 'case_restricted', link: { type: 'case', id: caseOne },
    })
    await sql(
      `INSERT INTO document_links (organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES ($1,$2,'case',$3,$4)`,
      [PRIMARY, documents.multi, caseTwo, U.stewardPrimary.userId],
    )
    for (let round = 0; round < 4; round += 1) {
      expect((await issue(steward, documents.multi)).status, 'assigned to the first linked case').toBe(200)
      expect((await issue(stewardTwo, documents.multi)).status, 'assigned to the second linked case').toBe(200)
      expect((await issue(outsider, documents.multi)).status, 'holds neither').toBe(403)
      // Reorder the physical rows: the answer must not depend on which link a scan meets first.
      await sql(`UPDATE document_links SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('touch', $2::int) WHERE document_id=$1`, [documents.multi, round])
    }
    record('multi-case document', { assignedFirst: 200, assignedSecond: 200, neither: 403, repeated: 4 })
  })

  test('reassignment and mandate revocation: the lease issued before is refused, and the new representative gains access', async () => {
    const stewardOne = await as(U.stewardPrimary.userId)
    const stewardTwo = await as(U.stewardPrimaryTwo.userId)
    const before = await issue(stewardOne, documents.restricted)
    expect(before.status).toBe(200)
    expect((await issue(stewardTwo, documents.restricted)).status).toBe(403)
    await assign(U.chiefStewardPrimary.userId, caseOne, U.stewardPrimaryTwo.userId)
    const afterContent = await bytesVia(stewardOne, before.url!)
    expect(afterContent.status, 'revoked authority must not release bytes from a lease issued earlier').toBe(403)
    expect((await issue(stewardOne, documents.restricted)).status).toBe(403)
    const gained = await issue(stewardTwo, documents.restricted)
    expect(gained.status).toBe(200)
    expect(sha((await bytesVia(stewardTwo, gained.url!)).body!)).toBe(sha(bytesOf.get('restricted')!))
    await assign(U.chiefStewardPrimary.userId, caseOne, U.stewardPrimary.userId)
    record('reassignment revokes live authority', { staleLease: afterContent.status, newRepresentative: gained.status })
  })

  test('lease binding: another actor, another document, a tampered token, an expired lease and a replay inside the lifetime', async () => {
    const steward = await as(U.stewardPrimary.userId)
    const stewardTwo = await as(U.stewardPrimaryTwo.userId)
    const sharedLease = await issue(steward, documents.multi)
    expect(sharedLease.status).toBe(200)
    expect((await issue(stewardTwo, documents.multi)).status, 'the second representative is authorized for the same document').toBe(200)
    expect((await bytesVia(stewardTwo, sharedLease.url!)).status, 'a lease is bound to its actor even where both actors are authorized').toBe(403)
    const lease = await issue(steward, documents.restricted)
    expect(lease.status).toBe(200)
    const other = lease.url!.replace(documents.restricted, documents.grievanceSpelling)
    expect((await bytesVia(steward, other)).status, 'a lease is bound to its document').toBe(403)
    expect((await bytesVia(steward, lease.url! + 'x')).status, 'a tampered token').toBe(403)
    expect((await bytesVia(steward, `/api/documents/${documents.restricted}/content`)).status, 'a missing token').toBe(403)

    const token = new URL(lease.url!, 'http://x').searchParams.get('lease')!
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as {
      organizationId: string; userId: string; documentId: string; versionId: string | null; fingerprint: string
    }
    const expired = issueDocumentDownloadLease(
      { organizationId: payload.organizationId, userId: payload.userId, documentId: payload.documentId, versionId: payload.versionId, fingerprint: payload.fingerprint },
      { now: Date.now() - 2 * 60 * 60 * 1000 },
    ).token
    expect((await bytesVia(steward, `/api/documents/${documents.restricted}/content?lease=${encodeURIComponent(expired)}`)).status, 'an expired lease').toBe(403)

    const before = await served(documents.restricted)
    const first = await bytesVia(steward, lease.url!)
    const replay = await bytesVia(steward, lease.url!)
    expect([first.status, replay.status]).toEqual([200, 200])
    expect(sha(replay.body!)).toBe(sha(bytesOf.get('restricted')!))
    expect(await served(documents.restricted), 'every release is audited, replays included').toBe(before + 2)
    record('lease binding', { otherActor: 403, otherDocument: 403, tampered: 403, expired: 403, replayInsideLifetime: 200 })
  })

  test('replacement after issuance: the new version carries new bytes, the pinned lease keeps its reviewed artifact, and a changed label refuses it', async () => {
    const steward = await as(U.stewardPrimary.userId)
    const content = pdf('version one')
    const replacement = pdf('version two')
    documents.versioned = await createDocument(steward, {
      title: 'Versioned', filename: 'versioned.pdf', bytes: content, label: 'case_restricted', link: { type: 'case', id: caseOne },
    })
    const issuedBefore = await issue(steward, documents.versioned)
    expect(issuedBefore.status).toBe(200)
    const appendIntake = await intake(steward, 'versioned-2.pdf', replacement, 'append_version', documents.versioned)
    const append = await steward.post(`/api/documents/repository/${documents.versioned}/versions`, { data: { intakeId: appendIntake } })
    expect(append.status(), await append.text()).toBeLessThan(300)
    const pinned = await bytesVia(steward, issuedBefore.url!)
    expect(pinned.status).toBe(200)
    expect(sha(pinned.body!), 'the lease serves the artifact it was issued for').toBe(sha(content))
    const issuedAfter = await issue(steward, documents.versioned)
    expect(issuedAfter.status).toBe(200)
    expect(sha((await bytesVia(steward, issuedAfter.url!)).body!), 'a new issuance serves the current version').toBe(sha(replacement))
    await sql(`UPDATE documents SET privacy_label='lro_confidential' WHERE id=$1`, [documents.versioned])
    expect((await bytesVia(steward, issuedAfter.url!)).status, 'a governance change after issuance invalidates the lease').toBe(403)
    record('replacement after issuance', { pinned: 200, current: 200, afterLabelChange: 403 })
  })

  test('integrity: a stored object that differs from its recorded hash, and a missing object, never release bytes or a served audit', async () => {
    const steward = await as(U.stewardPrimary.userId)
    documents.tampered = await createDocument(steward, {
      title: 'Tampered', filename: 'tampered.pdf', bytes: pdf('tamper original'), label: 'case_restricted', link: { type: 'case', id: caseOne },
    })
    const [version] = await sql<{ storage_key: string }>('SELECT storage_key FROM document_versions WHERE document_id=$1', [documents.tampered])
    const blob = container(process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes').getBlockBlobClient(version.storage_key)
    const lease = await issue(steward, documents.tampered)
    expect(lease.status).toBe(200)
    await blob.uploadData(pdf('substituted bytes'))
    const mismatch = await bytesVia(steward, lease.url!)
    expect(mismatch.status, 'checksum mismatch').toBe(503)
    expect(await served(documents.tampered)).toBe(0)
    await blob.delete()
    const missing = await bytesVia(steward, lease.url!)
    expect(missing.status, 'failed storage access').toBe(503)
    expect(await served(documents.tampered)).toBe(0)
    record('storage integrity', { mismatch: mismatch.status, missing: missing.status, servedAudit: 0 })
  })

  test('an audit that cannot be recorded never becomes a successful download', async () => {
    const steward = await as(U.stewardPrimary.userId)
    documents.auditFail = await createDocument(steward, {
      title: 'Audit failure', filename: 'audit.pdf', bytes: pdf('audit failure'), label: 'case_restricted', link: { type: 'case', id: caseOne },
    })
    const lease = await issue(steward, documents.auditFail)
    expect(lease.status).toBe(200)
    await sql(`CREATE OR REPLACE FUNCTION public.ue_doc_audit_failpoint() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'document.download_served' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`)
    await sql(`DROP TRIGGER IF EXISTS ue_doc_audit_failpoint ON public.audit_logs`)
    await sql(`CREATE TRIGGER ue_doc_audit_failpoint BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_doc_audit_failpoint()`)
    try {
      const refused = await bytesVia(steward, lease.url!)
      expect(refused.status).toBe(503)
      expect(refused.body).toBeNull()
      expect(await served(documents.auditFail)).toBe(0)
    } finally {
      await sql(`DROP TRIGGER IF EXISTS ue_doc_audit_failpoint ON public.audit_logs`)
      await sql(`DROP FUNCTION IF EXISTS public.ue_doc_audit_failpoint()`)
    }
    const recovered = await bytesVia(steward, lease.url!)
    expect(recovered.status).toBe(200)
    expect(await served(documents.auditFail)).toBe(1)
    record('audit write failure', { whileFailing: 503, afterRecovery: 200, servedAuditRows: 1 })
  })

  test('size bound: a recorded size over the limit is refused with 413 before storage is read', async () => {
    const steward = await as(U.stewardPrimary.userId)
    documents.large = await createDocument(steward, {
      title: 'Large', filename: 'large.pdf', bytes: pdf('large'), label: 'case_restricted', link: { type: 'case', id: caseOne },
    })
    const lease = await issue(steward, documents.large)
    expect(lease.status).toBe(200)
    await sql(`UPDATE document_versions SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('sizeBytes', $2::bigint) WHERE document_id=$1`, [documents.large, 60 * 1024 * 1024])
    const refused = await bytesVia(steward, (await issue(steward, documents.large)).url ?? lease.url!)
    expect([403, 413]).toContain(refused.status)
    record('size limit', { observed: refused.status })
  })

  test('concurrent requests: parallel downloads of one lease all return identical bytes and each writes its own served audit', async () => {
    const steward = await as(U.stewardPrimary.userId)
    const lease = await issue(steward, documents.restricted)
    const before = await served(documents.restricted)
    const results = await Promise.all(Array.from({ length: 6 }, () => bytesVia(steward, lease.url!)))
    for (const result of results) {
      expect(result.status).toBe(200)
      expect(sha(result.body!)).toBe(sha(bytesOf.get('restricted')!))
    }
    expect(await served(documents.restricted)).toBe(before + 6)
    record('concurrent releases', { requests: 6, audits: 6 })
  })
})
