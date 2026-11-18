/** Actual native PostgreSQL15/16 qualification. Existing native setup must
 * create a disposable clone with four distinct restricted LOGIN credentials.
 * Only request binding and the synthetic blob port are adapted; production
 * reader, canonical session factory/binder, SQL, guards and audit really run.
 * No Next server/browser, live institution/provider or deployment claim. */
import { createHash, randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeReaderHooks, NativeReaderPort } from '@/lib/external-resource-read/__tests__/fixtures/native-reader-store'
import { nativeExternalReaderFixture } from '@/lib/external-resource-read/__tests__/fixtures/native-reader-store'
import { awaitNativePhase, deferred, observeNativeAdvisoryWait } from '@/lib/external-resource-read/__tests__/fixtures/native-read-coordination'
import { reconcileAuthorityAudit } from '@/lib/authority/store/audit'

const state = vi.hoisted(() => ({
  context: null as null | ((work: (tx: NativeReaderPort) => Promise<unknown>) => Promise<unknown>),
  blob: vi.fn(),
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (work: (tx: NativeReaderPort) => Promise<unknown>) => {
  if (!state.context) throw new Error('Original native request identity is not installed')
  return state.context(work)
} }))
vi.mock('@/lib/blob-client', () => ({ readBlobBounded: state.blob, BlobTooLargeError: class extends Error {} }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
import { readCanonicalExternalResource } from '@/lib/external-resource-read/reader'

let active: Awaited<ReturnType<typeof nativeExternalReaderFixture>> | undefined
let hooks: NativeReaderHooks = {}, readerUser: string | undefined, duringBlob: (() => Promise<void>) | undefined
beforeEach(() => { hooks = {}; readerUser = undefined; duringBlob = undefined; vi.clearAllMocks() })
afterEach(async () => { state.context = null; await active?.close(); active = undefined })
async function start(options: Parameters<typeof nativeExternalReaderFixture>[0] = {}) {
  const f = active = await nativeExternalReaderFixture(options)
  state.context = work => f.readerContext(work, hooks, readerUser ?? f.recipient)
  state.blob.mockImplementation(async (key: string, maximum: number) => {
    expect(key).toBe(f.storageKey); expect(maximum).toBe(50 * 1024 * 1024)
    await duringBlob?.(); return f.bytes
  })
  return f
}
const download = () => {
  if (!active) throw new Error('Owned native fixture required')
  return readCanonicalExternalResource('download', active.resource)
}

describe('protected external read on the actual current combined native source', () => {
  // Intentionally no skipIf: explicitly selecting this native cohort without
  // an owned clone must fail, never emit an empty successful qualification.
  it('uses genuine restricted LOGIN + original own-org session, actual independent adoption/issuance/consent, exact projection and terminal revocation', async () => {
    const f = await start()
    const principal = await f.as(f.recipient, tx => tx.query(`SELECT current_user AS role,session_user<>current_user AS separate_login,
      (SELECT rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole) FROM pg_roles WHERE rolname=session_user) AS restricted_login,
      current_setting('app.current_user_id')=$1 AS original_actor,current_setting('app.current_org_id')=$2 AS original_org,
      user_management.auth_business_org_authorized($2::uuid,NULL::text[]) AS own_session,
      user_management.auth_business_org_authorized($3::uuid,NULL::text[]) AS target_membership`, [f.recipient, f.representativeOrg, f.org]))
    expect(principal.rows).toEqual([{ role: 'union_eyes_runtime', separate_login: true, restricted_login: true,
      original_actor: true, original_org: true, own_session: true, target_membership: false }])
    const auditBefore = await f.count('document.external_download')
    expect((await download()).status).toBe(403)
    expect(state.blob).not.toHaveBeenCalled()
    const consent = await f.consent(); await f.qualify(consent)
    expect(await (await readCanonicalExternalResource('matter', f.resource)).json()).toMatchObject({ data: { id: f.caseId, summary: null } })
    expect(await (await readCanonicalExternalResource('documents', f.resource)).json()).toMatchObject({ data: [{ id: f.documentId, canDownload: true }] })
    const response = await download(); expect(response.status).toBe(200)
    const actual = Buffer.from(await response.arrayBuffer())
    expect(actual.equals(f.bytes)).toBe(true); expect(createHash('sha256').update(actual).digest('hex')).toBe(f.checksum)
    expect(await f.count('document.external_download')).toBe(auditBefore + 1)
    expect(await reconcileAuthorityAudit(f.operator, f.org)).toEqual({ eventsWithoutAudit: [], auditRowsWithUnknownEvents: [], chainBreaks: [] })
    for (const table of ['representation_authorities', 'external_matter_access_grants', 'external_document_access_grants', 'ue_external_read_qualifications'])
      await expect(f.as(f.recipient, tx => tx.query(`SELECT id FROM public.${table}`))).rejects.toMatchObject({ code: '42501' })
    await f.revokeConsent(consent); expect((await download()).status).toBe(403)
    expect(await f.count('document.external_download')).toBe(auditBefore + 1)
    process.stdout.write(JSON.stringify({ proof: 'NATIVE_EXTERNAL_READER', postgresVersion: f.server, originalOwnOrgContext: true,
      actualIndependentSyntheticLifecycle: true, exactBytesAndAudit: true, terminalConsentRevocation: true,
      nextBrowser: 'UNEXECUTED', customerAdoption: 'NOT_PERFORMED' }) + '\n')
  })

  it('does not qualify legacy active grants or member consent without exact institutional approval, and the primary cannot manufacture member consent', async () => {
    const f = await start({ authorize: false }), consent = await f.consent()
    const before = (await f.operator.query('SELECT id FROM public.audit_logs WHERE organization_id=$1 ORDER BY id', [f.org])).rows
    await expect(f.qualify(consent)).rejects.toMatchObject({ code: '42501' })
    expect((await download()).status).toBe(403)
    await expect(f.as(f.actor, tx => tx.query('SELECT public.ue_external_member_consent_v1($1,$2)', [JSON.stringify(f.binding), 'SYNTHETIC forged member consent'])))
      .rejects.toMatchObject({ code: '42501' })
    expect(await f.count('document.external_download')).toBe(0)
    expect((await f.operator.query('SELECT id FROM public.audit_logs WHERE organization_id=$1 ORDER BY id', [f.org])).rows).toEqual(before)
  })

  it('denies wrong original recipient, organization, matter and document alongside a positive exact qualification', async () => {
    const f = await start(); await f.qualify(await f.consent()); expect((await download()).status).toBe(200)
    const before = await f.count('document.external_download')
    const audits = (await f.operator.query('SELECT organization_id,id FROM public.audit_logs WHERE organization_id=ANY($1::uuid[]) ORDER BY organization_id,id', [[f.org, f.representativeOrg]])).rows
    for (const resource of [{ ...f.resource, matterId: randomUUID() }, { ...f.resource, documentId: randomUUID() },
      { ...f.resource, organizationId: f.representativeOrg }]) expect((await readCanonicalExternalResource('document', resource)).status).toBe(403)
    readerUser = f.stranger; expect((await download()).status).toBe(403)
    expect(await f.count('document.external_download')).toBe(before)
    expect((await f.operator.query('SELECT organization_id,id FROM public.audit_logs WHERE organization_id=ANY($1::uuid[]) ORDER BY organization_id,id', [[f.org, f.representativeOrg]])).rows).toEqual(audits)
  })

  it('requires a selected own organization and rejects forged private scopes as a generic foreign membership read', async () => {
    const f = await start(); await f.qualify(await f.consent())
    hooks.omitSelectedOrganization = true
    expect((await download()).status).toBe(403); expect(state.blob).not.toHaveBeenCalled()
    hooks.omitSelectedOrganization = false
    const foreign = await f.as(f.recipient, async tx => {
      await tx.query("SELECT set_config('ue.case_domain_org',$1,true),set_config('ue.case_domain_people',$2,true)", [f.org, '{' + f.authorizers.join(',') + '}'])
      return tx.query('SELECT * FROM user_management.ue_authority_membership_rows($1,$2)', [f.org, f.authorizers])
    })
    expect(foreign.rows).toEqual([])
    expect((await download()).status).toBe(200)
  })

  it.each(['membership', 'role', 'user'] as const)('revalidates current canonical authorizer %s after actual approval/qualification while the office stays active', async loss => {
    const f = await start(); await f.qualify(await f.consent())
    expect((await download()).status).toBe(200)
    if (loss === 'membership') await f.mutateMembership(false)
    if (loss === 'role') await f.changeRole('admin')
    if (loss === 'user') await f.changeUserActive(false)
    expect((await f.operator.query('SELECT status,revoked_at FROM public.ue_authority_mandates WHERE id=$1', [f.offices[0]])).rows)
      .toEqual([{ status: 'active', revoked_at: null }])
    const before = await f.count('document.external_download')
    expect((await download()).status).toBe(403); expect(await f.count('document.external_download')).toBe(before)
  })

  it.each(['consent', 'office', 'session'] as const)('independently revalidates actual %s revocation during the blob gap', async revoked => {
    const f = await start(), consent = await f.consent(); await f.qualify(consent)
    expect((await download()).status).toBe(200)
    const before = await f.count('document.external_download')
    duringBlob = async () => {
      if (revoked === 'consent') await f.revokeConsent(consent)
      if (revoked === 'office') await f.revokeOffice()
      if (revoked === 'session') await (await f.session(f.recipient)).revoke()
    }
    expect((await download()).status).toBe(403)
    expect(await f.count('document.external_download')).toBe(before)
  })

  it('observes real finite-term expiry on the server clock without changing stored terms or clocks', async () => {
    const f = await start({ qualificationLifetimeMs: 20_000 }); await f.qualify(await f.consent())
    expect((await download()).status).toBe(200)
    const deadline = Date.now() + 25_000
    while (!(await f.operator.query('SELECT clock_timestamp()>$1::timestamptz AS expired', [f.binding.expiresAt])).rows[0].expired) {
      if (Date.now() >= deadline) throw new Error('Native server did not reach the source-recorded finite expiry')
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    const before = await f.count('document.external_download')
    expect((await download()).status).toBe(403); expect(await f.count('document.external_download')).toBe(before)
  })

  it('keeps qualified version/permission identities immutable and rejects wrong actual blob bytes before any download success audit', async () => {
    const f = await start(); await f.qualify(await f.consent())
    duringBlob = async () => {
      await expect(f.operator.query('UPDATE public.document_versions SET storage_key=$2 WHERE id=$1', [f.versionId, 'synthetic/substitution']))
        .rejects.toMatchObject({ code: '42501' })
      await expect(f.operator.query('UPDATE public.external_document_access_grants SET document_version_no=3 WHERE id=$1', [f.documentGrantId]))
        .rejects.toMatchObject({ code: '42501' })
    }
    expect((await download()).status).toBe(200)
    duringBlob = undefined; state.blob.mockResolvedValueOnce(Buffer.from('SYNTHETIC altered bytes'))
    const before = await f.count('document.external_download')
    expect((await download()).status).toBe(503); expect(await f.count('document.external_download')).toBe(before)
  })

  it('rolls consent/qualification back on mandatory audit failure and releases no bytes when download audit fails only at COMMIT', async () => {
    const f = await start()
    await f.withAuditFailure('external.consent.grant', async () => {
      await expect(f.consent()).rejects.toThrow('SYNTHETIC_NATIVE_AUDIT_FAILURE')
      expect((await f.operator.query('SELECT id FROM public.ue_external_read_consents WHERE organization_id=$1', [f.org])).rows).toEqual([])
    })
    const consent = await f.consent()
    await f.withAuditFailure('external.qualification.bind', async () => {
      await expect(f.qualify(consent)).rejects.toThrow('SYNTHETIC_NATIVE_AUDIT_FAILURE')
      expect((await f.operator.query('SELECT id FROM public.ue_external_read_qualifications WHERE organization_id=$1', [f.org])).rows).toEqual([])
    })
    await f.qualify(consent)
    await f.withAuditFailure('document.external_download', async () => {
      const response = await download(); expect(response.status).toBe(503)
      expect(await response.text()).not.toContain(f.bytes.toString())
      expect(state.blob).toHaveBeenCalledTimes(1); expect(await f.count('document.external_download')).toBe(0)
    }, true)
  })

  it('serializes read-first download commit before a real restricted auth-system offboard and denies every subsequent read', async () => {
    const f = await start(); await f.qualify(await f.consent())
    const readerReady = deferred<number>(), releaseReader = deferred(), writerBackend = deferred<number>()
    let writerSettled = false, responseSettled = false
    hooks.beforeCommit = async (operation, pid) => { if (operation === 'finalize_download') { readerReady.resolve(pid); await releaseReader.promise } }
    const pendingRead = download().finally(() => { responseSettled = true })
    let pendingWriter: Promise<unknown> | undefined
    try {
      const readerPid = await awaitNativePhase(readerReady.promise, pendingRead, 'download transaction before commit')
      expect(responseSettled).toBe(false)
      pendingWriter = f.mutateMembership(false, { onBackend: pid => writerBackend.resolve(pid) }).finally(() => { writerSettled = true })
      const writerPid = await awaitNativePhase(writerBackend.promise, pendingWriter, 'auth-system writer backend')
      const observed = await observeNativeAdvisoryWait(f.operator, writerPid, readerPid, { settled: () => writerSettled })
      expect(responseSettled).toBe(false); releaseReader.resolve()
      const response = await pendingRead; expect(response.status).toBe(200)
      expect(Buffer.from(await response.arrayBuffer()).equals(f.bytes)).toBe(true)
      await pendingWriter; hooks = {}
      expect((await download()).status).toBe(403)
      process.stdout.write(JSON.stringify({ proof: 'NATIVE_EXTERNAL_READ_FIRST', postgresVersion: f.server, ...observed,
        responseHeldUntilCommit: true, subsequentOffboardDenial: true }) + '\n')
    } finally { releaseReader.resolve(); await Promise.allSettled([pendingRead, ...(pendingWriter ? [pendingWriter] : [])]) }
  })

  it('serializes mutation-first offboard during the blob gap, rechecks after the real database wait and releases no bytes', async () => {
    const f = await start(); await f.qualify(await f.consent())
    const writerHeld = deferred<number>(), releaseWriter = deferred(), finalReader = deferred<number>()
    let writerPid = 0, readerSettled = false, pendingWriter: Promise<unknown> | undefined
    duringBlob = async () => {
      pendingWriter = f.mutateMembership(false, { onBackend: pid => { writerPid = pid }, beforeCommit: async () => {
        writerHeld.resolve(writerPid); await releaseWriter.promise
      } })
      await awaitNativePhase(writerHeld.promise, pendingWriter, 'auth-system membership mutation before commit')
    }
    hooks.beforeQuery = async (operation, pid) => { if (operation === 'finalize_download') finalReader.resolve(pid) }
    const pendingRead = download().finally(() => { readerSettled = true })
    try {
      const readerPid = await awaitNativePhase(finalReader.promise, pendingRead, 'post-blob final reader query')
      if (!pendingWriter) throw new Error('The real auth-system writer was not started')
      const observed = await observeNativeAdvisoryWait(f.operator, readerPid, await writerHeld.promise, { settled: () => readerSettled })
      releaseWriter.resolve(); await pendingWriter
      const response = await pendingRead; expect(response.status).toBe(403)
      expect(await response.text()).not.toContain(f.bytes.toString()); expect(await f.count('document.external_download')).toBe(0)
      process.stdout.write(JSON.stringify({ proof: 'NATIVE_EXTERNAL_MUTATION_FIRST', postgresVersion: f.server, ...observed,
        revalidatedAfterWait: true, successAuditAbsent: true, bytesNotReleased: true }) + '\n')
    } finally { releaseWriter.resolve(); await Promise.allSettled([pendingRead, ...(pendingWriter ? [pendingWriter] : [])]) }
  })

  it('rechecks the genuine parent session expiry after an observed authorizer lock wait before locating or releasing any bytes', async () => {
    const f = await start(); await f.qualify(await f.consent()); expect((await download()).status).toBe(200)
    state.blob.mockClear()
    const parentExpires = await f.shortenRecipientSession(5000), holderReady = deferred<number>(), releaseHolder = deferred(), readerStarted = deferred<number>()
    let readerSettled = false
    const holder = f.as(f.authorizers[0], async tx => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||$1,0))", [f.authorizers[0]])
      holderReady.resolve(tx.backendPid); await releaseHolder.promise
    })
    hooks.beforeQuery = async (operation, pid) => { if (operation === 'locate_download') readerStarted.resolve(pid) }
    let pendingRead: Promise<Response> | undefined
    try {
      const holderPid = await awaitNativePhase(holderReady.promise, holder, 'authorizer lock holder')
      pendingRead = download().finally(() => { readerSettled = true })
      const readerPid = await awaitNativePhase(readerStarted.promise, pendingRead, 'reader with original live parent session')
      const observed = await observeNativeAdvisoryWait(f.operator, readerPid, holderPid, { settled: () => readerSettled })
      const deadline = Date.now() + 8000
      while (!(await f.operator.query('SELECT clock_timestamp()>$1::timestamptz AS expired', [parentExpires])).rows[0].expired) {
        if (Date.now() >= deadline) throw new Error('Genuine native parent session did not reach its recorded expiry')
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      const before = await f.count('document.external_download')
      releaseHolder.resolve(); await holder
      const response = await pendingRead; expect(response.status).toBe(403)
      expect(state.blob).not.toHaveBeenCalled(); expect(await f.count('document.external_download')).toBe(before)
      process.stdout.write(JSON.stringify({ proof: 'NATIVE_EXTERNAL_SESSION_EXPIRES_WHILE_WAITING', postgresVersion: f.server, ...observed,
        realFactoryIssuedParent: true, serverClockExpiryObserved: true, blobNotFetched: true }) + '\n')
    } finally { releaseHolder.resolve(); await Promise.allSettled([holder, ...(pendingRead ? [pendingRead] : [])]) }
  })
})
