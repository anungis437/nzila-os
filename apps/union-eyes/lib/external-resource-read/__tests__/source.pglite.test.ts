import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { externalReaderFixture } from './fixtures/reader-store'
import { externalReadQualificationHash } from '../qualification'
import { EXTERNAL_READ_CATALOG_QUERIES, externalReadCatalogViolations, inspectExternalRead } from '../catalog'
import { canonicalAuditContentHash } from '@/lib/audit/canonical-audit-chain'
import { compileExternalReadSql, compileExternalReadRolePreparationSql, EXTERNAL_READ_OWNER, EXTERNAL_READ_FUNCTIONS, EXTERNAL_READ_TRIGGER_TABLES } from '../source'
import { EXTERNAL_READ_AUTHORIZATION } from '../qualification'
import { openApprovalRequest } from '@/lib/authority/store/mutations'
let active: Awaited<ReturnType<typeof externalReaderFixture>> | undefined
afterEach(async () => { await active?.close(); active = undefined })

describe('protected external consent/qualification/source reader actual SQL', () => {
  it('uses node-pg-compatible text arrays for security catalog role sets', async () => {
    const f = active = await externalReaderFixture()
    for (const [query, column] of [
      [EXTERNAL_READ_CATALOG_QUERIES.functions, 'callers'],
      [EXTERNAL_READ_CATALOG_QUERIES.policies, 'roles'],
    ] as const) {
      const result = await f.db.query<Record<string, unknown>>(query)
      // node-pg leaves PostgreSQL name[] (OID1003) as a wire string. text[]
      // (OID1009) preserves the strict array contract used by catalog checks.
      expect(result.fields.find(field => field.name === column)?.dataTypeID).toBe(1009)
      expect(result.rows.length).toBeGreaterThan(0)
      for (const row of result.rows) expect(Array.isArray(row[column])).toBe(true)
    }
  }, 60000)

  it.each(['case', 'grievance'] as const)('runs the exact consent/bind/read/revoke SQL chain with the %s document-link alias', async (documentLinkType) => {
    const f = active = await externalReaderFixture({ documentLinkType })
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
    const consent = await f.consent()
    await f.qualify(consent)
    expect((await f.read()).rows[0].payload).toMatchObject({ id: f.caseId, title: 'Synthetic bounded matter', summary: null })
    expect((await f.read('document')).rows[0].payload).toMatchObject({ id: f.documentId, filename: 'fixture.bin' })
    const located = (await f.read('locate_download')).rows[0].payload as Record<string, unknown>
    expect(located).toMatchObject({ qualificationHash: externalReadQualificationHash(f.binding), versionNo: 2 })
    const receipt = { qualificationId: located.qualificationId, documentId: located.documentId, versionId: located.versionId,
      versionNo: located.versionNo, checksumSha256: located.checksumSha256, sizeBytes: located.sizeBytes }
    expect((await f.read('finalize_download', f.recipient, { expectedHash: String(located.qualificationHash), receipt })).rows[0].payload).toMatchObject({ released: true })
    await f.as(f.member, tx => tx.query("SELECT public.ue_external_revoke_read_v1('consent',$1)", [consent]))
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
    const audit = (await f.db.query<{ action: string; resource_type: string; resource_id: string; user_id: string; details: Record<string, unknown>; content_hash: string; previous_hash: string | null }>(
      "SELECT action,resource_type,resource_id,user_id,details,content_hash,previous_hash FROM public.audit_logs WHERE action LIKE 'external.%' OR action='document.external_download' ORDER BY created_at,id")).rows
    expect(audit.length).toBeGreaterThanOrEqual(6)
    for (const entry of audit) expect(entry.content_hash).toBe(canonicalAuditContentHash({ action: entry.action, resourceType: entry.resource_type,
      resourceId: entry.resource_id, userId: entry.user_id, correlationId: '', details: entry.details, previousHash: entry.previous_hash }))
  }, 60000)

  it('cannot manufacture member consent or substitute a non-primary issuer, and ordinary callers cannot invoke qualification', async () => {
    const f = active = await externalReaderFixture()
    await expect(f.consent(f.actor)).rejects.toMatchObject({ code: '42501' })
    await expect(f.consent(f.recipient)).rejects.toMatchObject({ code: '42501' })
    const consent = await f.consent()
    await expect(f.qualify(consent, f.member)).rejects.toMatchObject({ code: '42501' })
    await expect(f.qualify(consent, 'unrelated')).rejects.toMatchObject({ code: '42501' })
    await expect(f.as(f.actor, tx => tx.query('SELECT public.ue_external_qualify_read_v1($1::jsonb,$2)', [JSON.stringify(f.binding), consent])))
      .rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('admits exact private source ownership, fixed columns, RLS and trigger contracts and refuses drift', async () => {
    const f = active = await externalReaderFixture()
    const snapshot = await inspectExternalRead(async text => (await f.db.query(text)).rows)
    expect(externalReadCatalogViolations(snapshot)).toEqual([])
    for (const mutation of [
      { role: snapshot.role.map(row => ({ ...row, rolcanlogin: true })) },
      { role: snapshot.role.map(row => ({ ...row, isolated: false })) },
      { functions: snapshot.functions.map((row, i) => i ? row : { ...row, body: 'RETURN true' }) },
      { functions: snapshot.functions.map((row, i) => i ? row : { ...row, callers: ['PUBLIC'] }) },
      { tables: snapshot.tables.map((row, i) => i ? row : { ...row, table_select: true }) },
      { columns: [...snapshot.columns, { table_name: 'grievances', column_name: 'description', privilege_type: 'SELECT', is_grantable: false }] },
      { triggers: snapshot.triggers.map((row, i) => i ? row : { ...row, tgenabled: 'D' }) },
    ]) expect(externalReadCatalogViolations({ ...snapshot, ...mutation })).not.toEqual([])
    await expect(f.db.exec(compileExternalReadSql())).rejects.toThrow('EXTERNAL_SOURCE_REQUIRES_EXACT_CATALOG_ADMISSION')
    expect(externalReadCatalogViolations(await inspectExternalRead(async text => (await f.db.query(text)).rows))).toEqual([])
    for (const mutation of [
      `GRANT USAGE ON SCHEMA user_management TO ${EXTERNAL_READ_OWNER} WITH GRANT OPTION`,
      `REVOKE EXECUTE ON FUNCTION user_management.auth_business_org_authorized(uuid,text[]) FROM ${EXTERNAL_READ_OWNER}`,
      `REVOKE EXECUTE ON FUNCTION public.ue_case_domain_authorized(uuid,uuid,text) FROM ${EXTERNAL_READ_OWNER}`,
      `REVOKE EXECUTE ON FUNCTION user_management.ue_authority_membership_rows(uuid,text[]) FROM ${EXTERNAL_READ_OWNER}`,
      `REVOKE EXECUTE ON FUNCTION public.ue_external_authorizer_live_v1(uuid,uuid,text) FROM ${EXTERNAL_READ_OWNER}`,
    ]) {
      await f.db.exec('BEGIN')
      try { await f.db.exec(mutation); expect(externalReadCatalogViolations(await inspectExternalRead(async text => (await f.db.query(text)).rows))).not.toEqual([]) }
      finally { await f.db.exec('ROLLBACK') }
    }
  }, 60000)

  it.each(['representation_authorities', 'external_matter_access_grants', 'external_document_access_grants',
    'ue_external_read_consents', 'ue_external_read_qualifications'])('gives runtime no raw access to %s', async table => {
    const f = active = await externalReaderFixture()
    await expect(f.as(f.recipient, tx => tx.query(`SELECT * FROM public.${table}`))).rejects.toMatchObject({ code: '42501' })
    await expect(f.as(f.member, tx => tx.query(`DELETE FROM public.${table}`))).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('denies wrong identity, source member, organization, matter, document and forged/revoked sessions', async () => {
    const f = active = await externalReaderFixture(); const consent = await f.consent(); await f.qualify(consent)
    for (const [who, input] of [
      [f.outsider, {}], [f.recipient, { org: f.representativeOrg }], [f.recipient, { caseId: f.representativeOrg }],
      [f.recipient, { documentId: f.authorityId }], [f.recipient, { token: 'forged-not-a-live-bearer' }],
      [f.recipient, { actorOrg: f.org }],
    ] as const) await expect(f.read('document', who, input)).rejects.toMatchObject({ code: '42501' })
    await f.db.query('UPDATE public.grievances SET represented_member_user_id=$2 WHERE id=$1', [f.caseId, 'another_member'])
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
    await f.db.query('UPDATE public.grievances SET represented_member_user_id=$2 WHERE id=$1', [f.caseId, f.member])
    await f.db.query('UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1', [f.recipient])
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('preserves each exact permission and refuses unsupported upload, comment, share and matter types at the private interface', async () => {
    const f = active = await externalReaderFixture(); await f.qualify(await f.consent())
    for (const operation of ['upload', 'comment', 'share', 'wcb_claim', 'arbitrary'])
      await expect(f.read(operation)).rejects.toMatchObject({ code: '42501' })
    expect((await f.read('documents')).rows[0].payload).toEqual([expect.objectContaining({ id: f.documentId, canDownload: true })])
  }, 60000)

  it('cannot edit, delete, transfer or restore qualified authority/grant/version identities', async () => {
    const f = active = await externalReaderFixture(); await f.qualify(await f.consent())
    for (const [table, id, assignment] of [
      ['representation_authorities', f.authorityId, "source='unreviewed replacement'"],
      ['external_matter_access_grants', f.matterGrant, "user_id='other-recipient'"],
      ['external_document_access_grants', f.documentGrant, 'document_version_no=3'],
      ['document_versions', f.versionId, "storage_key='substituted/key'"],
    ]) {
      await expect(f.db.query(`UPDATE public.${table} SET ${assignment} WHERE id=$1`, [id])).rejects.toMatchObject({ code: '42501' })
      await expect(f.db.query(`DELETE FROM public.${table} WHERE id=$1`, [id])).rejects.toMatchObject({ code: '42501' })
    }
    expect((await f.read('document')).rows[0].payload).toMatchObject({ id: f.documentId })
  }, 60000)

  it('refuses expired consent and qualification without converting status labels into authority', async () => {
    const f = active = await externalReaderFixture()
    const expired = structuredClone(f.binding)
    expired.effectiveAt = '2000-01-01T00:00:00Z'; expired.expiresAt = '2001-01-01T00:00:00Z'
    await expect(f.consent(f.member, expired)).rejects.toMatchObject({ code: '42501' })
    const consent = await f.consent()
    const altered = structuredClone(f.binding); altered.representedMemberUserId = 'another_member'
    await expect(f.qualify(consent, f.actor, altered)).rejects.toMatchObject({ code: '42501' })
    const otherRecipient = structuredClone(f.binding); otherRecipient.representativeUserId = f.outsider
    await expect(f.qualify(consent, f.actor, otherRecipient)).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('revokes across the storage gap and refuses incorrect version/hash/byte receipts without any success audit', async () => {
    const f = active = await externalReaderFixture(); const consent = await f.consent(); await f.qualify(consent)
    const located = (await f.read('locate_download')).rows[0].payload as Record<string, unknown>
    const receipt = { qualificationId: located.qualificationId, documentId: located.documentId, versionId: located.versionId,
      versionNo: located.versionNo, checksumSha256: located.checksumSha256, sizeBytes: located.sizeBytes }
    for (const altered of [{ ...receipt, versionNo: 3 }, { ...receipt, sizeBytes: 0 }, { ...receipt, checksumSha256: 'a'.repeat(64) }])
      await expect(f.read('finalize_download', f.recipient, { expectedHash: String(located.qualificationHash), receipt: altered })).rejects.toMatchObject({ code: '42501' })
    await f.as(f.member, tx => tx.query("SELECT public.ue_external_revoke_read_v1('consent',$1)", [consent]))
    await expect(f.read('finalize_download', f.recipient, { expectedHash: String(located.qualificationHash), receipt })).rejects.toMatchObject({ code: '42501' })
    expect((await f.db.query("SELECT id FROM public.audit_logs WHERE action='document.external_download'")).rows).toEqual([])
  }, 60000)

  it('rolls consent and qualification creation back on canonical audit failure and releases no read without its audit', async () => {
    const f = active = await externalReaderFixture()
    await f.db.exec("CREATE FUNCTION public.reject_external_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END $$;CREATE TRIGGER reject_external_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_external_audit()")
    await expect(f.consent()).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE')
    expect((await f.db.query('SELECT id FROM public.ue_external_read_consents')).rows).toEqual([])
    await f.db.exec('ALTER TABLE public.audit_logs DISABLE TRIGGER reject_external_audit')
    const consent = await f.consent()
    await f.db.exec('ALTER TABLE public.audit_logs ENABLE TRIGGER reject_external_audit')
    await expect(f.qualify(consent)).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE')
    expect((await f.db.query('SELECT id FROM public.ue_external_read_qualifications')).rows).toEqual([])
    await f.db.exec('ALTER TABLE public.audit_logs DISABLE TRIGGER reject_external_audit')
    await f.qualify(consent)
    await f.db.exec('ALTER TABLE public.audit_logs ENABLE TRIGGER reject_external_audit')
    await expect(f.read()).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE')
  }, 60000)

  it('keeps qualification revocation terminal and cannot extend, retarget or restore member consent', async () => {
    const f = active = await externalReaderFixture(), consent = await f.consent(); await f.qualify(consent)
    await f.as(f.actor, tx => tx.query("SELECT public.ue_external_revoke_read_v1('qualification',$1)", [f.binding.qualificationId]))
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
    for (const statement of [
      "UPDATE public.ue_external_read_qualifications SET revoked_at=NULL,revoked_by=NULL WHERE id=$1",
      "UPDATE public.ue_external_read_qualifications SET expires_at=expires_at+interval '1 day' WHERE id=$1",
    ]) await expect(f.db.query(statement, [f.binding.qualificationId])).rejects.toMatchObject({ code: '42501' })
    await expect(f.db.query("UPDATE public.ue_external_read_consents SET recipient_user_id='other-recipient' WHERE id=$1", [consent])).rejects.toMatchObject({ code: '42501' })
    await expect(f.db.query("UPDATE public.ue_external_read_consents SET expires_at=expires_at+interval '1 day' WHERE id=$1", [consent])).rejects.toMatchObject({ code: '42501' })
    await f.as(f.member, tx => tx.query("SELECT public.ue_external_revoke_read_v1('consent',$1)", [consent]))
    await expect(f.db.query('UPDATE public.ue_external_read_consents SET revoked_at=NULL,revoked_by=NULL WHERE id=$1', [consent])).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('does not turn a reviewed view-only document into a download permission', async () => {
    const f = active = await externalReaderFixture(), binding = structuredClone(f.binding)
    binding.matter.permissions.downloadDocuments = false
    if (!binding.document) throw new Error('Expected exact artifact fixture')
    binding.document.canDownload = false
    await f.db.query('UPDATE public.external_matter_access_grants SET can_download_documents=false WHERE id=$1', [f.matterGrant])
    await f.db.query('UPDATE public.external_document_access_grants SET can_download=false WHERE id=$1', [f.documentGrant])
    binding.institutionalApprovalId = randomUUID()
    await f.authorize(binding)
    await f.qualify(await f.consent(f.member, binding), f.actor, binding)
    expect((await f.read('document')).rows[0].payload).toMatchObject({ id: f.documentId })
    expect((await f.read('documents')).rows[0].payload).toEqual([expect.objectContaining({ canDownload: false })])
    await expect(f.read('locate_download')).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it.each(['privileged', 'highly_sensitive'])('does not transfer %s content through a basic external read grant', async privacyLabel => {
    const f = active = await externalReaderFixture(), binding = structuredClone(f.binding)
    if (!binding.document) throw new Error('Expected exact artifact fixture')
    binding.document.privacyLabel = privacyLabel
    binding.institutionalApprovalId = randomUUID()
    await f.authorize(binding)
    await f.db.query('UPDATE public.documents SET privacy_label=$2 WHERE id=$1', [f.documentId, privacyLabel])
    await expect(f.qualify(await f.consent(f.member, binding), f.actor, binding)).rejects.toMatchObject({ code: '42501' })
    await expect(f.read('document')).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('refuses unbounded, unknown-field and self-issued payloads at the SQL constructor, independently of TypeScript parsing', async () => {
    const f = active = await externalReaderFixture()
    const bad: unknown[] = [
      { ...f.binding, unexpected: 'not source' },
      { ...f.binding, operation: 'external_override' },
      { ...f.binding, authority: { ...f.binding.authority, createdBy: f.recipient } },
      { ...f.binding, expiresAt: 'infinity' },
      { ...f.binding, sourceInstrument: { ...f.binding.sourceInstrument, sha256: null } },
      { ...f.binding, document: { ...f.binding.document, sizeBytes: -1 } },
    ]
    for (const payload of bad) await expect(f.as(f.member, tx => tx.query('SELECT public.ue_external_member_consent_v1($1::jsonb,$2)',
      [JSON.stringify(payload), 'Synthetic invalid proposal']))).rejects.toMatchObject({ code: '42501' })
    expect((await f.db.query('SELECT id FROM public.ue_external_read_consents')).rows).toEqual([])
  }, 60000)

  it.each([false, true])('constructs through the actual restricted-owner phase and removes transient owner edges and schema CREATE before commit (role preprovisioned %s)', async rolePreprovisioned => {
    const f = active = await externalReaderFixture({ installerSemantics: true, rolePreprovisioned })
    expect(f.installerProof).toMatchObject({ missingPreparationDenied: true, missingPreparationCode: '42501', mode: 'prepared-restricted-owner-same-transaction' })
    expect(f.installerProof.installerContext).toMatchObject({ execution_role: 'ue_v2_owner', login: expect.stringMatching(/^external_operator_/),
      login_superuser: false, login_createrole: false, owner_createrole: false })
    expect(externalReadCatalogViolations(await inspectExternalRead(async text => (await f.db.query(text)).rows))).toEqual([])
    const owner = (await f.db.query('SELECT rolinherit,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=$1', ['ue_v2_owner'])).rows[0]
    expect(owner).toEqual({ rolinherit: true, rolsuper: false, rolcreaterole: false, rolbypassrls: false })
    const defaultAcl=(await f.db.query<{public_execute:boolean}>(`SELECT EXISTS(SELECT FROM pg_default_acl d
      CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole='ue_v2_owner'::regrole
      AND d.defaclobjtype='f' AND d.defaclnamespace=0 AND a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute`)).rows[0]
    expect(defaultAcl.public_execute).toBe(false)
    const installed=(await f.db.query<{table:string;name:string;fn:string;owner:string;enabled:string}>(`SELECT c.relname AS table,t.tgname AS name,p.proname AS fn,pg_get_userbyid(p.proowner) AS owner,t.tgenabled AS enabled
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgname=ANY($1::text[]) ORDER BY c.relname,t.tgname`,[[...new Set(EXTERNAL_READ_TRIGGER_TABLES.map(trigger=>trigger.name))]])).rows
    expect(installed.map(({table,name,fn})=>({table,name,fn}))).toEqual(EXTERNAL_READ_TRIGGER_TABLES.map(({table,name,fn})=>({table,name,fn})).sort((a,b)=>a.table.localeCompare(b.table)||a.name.localeCompare(b.name)))
    expect(installed.every(trigger=>trigger.owner===EXTERNAL_READ_OWNER&&trigger.enabled==='O')).toBe(true)
    for(const fn of EXTERNAL_READ_FUNCTIONS) {
      const args=fn.args ? fn.args.split(',').map(arg=>arg.trim().split(/\s+/).slice(1).join(' ')).join(',') : ''
      const rights=(await f.db.query<{owner_execute:boolean;runtime_execute:boolean;system_execute:boolean}>(`SELECT
        has_function_privilege('ue_v2_owner',$1,'EXECUTE') AS owner_execute,
        has_function_privilege('union_eyes_runtime',$1,'EXECUTE') AS runtime_execute,
        has_function_privilege('union_eyes_system',$1,'EXECUTE') AS system_execute`,[`public.${fn.name}(${args})`])).rows[0]
      expect(rights).toEqual({owner_execute:fn.callers.some(caller=>caller==='ue_v2_owner'),runtime_execute:fn.callers.some(caller=>caller==='union_eyes_runtime'),system_execute:false})
    }
    await f.qualify(await f.consent())
    expect((await f.read()).rows[0].payload).toMatchObject({ id: f.caseId })
    process.stdout.write(JSON.stringify({ proof: 'EXTERNAL_READER_RESTRICTED_INSTALLER_COMPONENT', ...f.installerProof,
      native15: 'UNEXECUTED', native16: 'UNEXECUTED', finalPrivateRoleIsolated: true, finalPrivateCreate: false }) + '\n')
  }, 60000)

  it('refuses a malformed or already-linked preprovisioned private role without repairing its authority', async () => {
    const f = active = await externalReaderFixture()
    for (const mutation of [`ALTER ROLE ${EXTERNAL_READ_OWNER} LOGIN`, `GRANT ${EXTERNAL_READ_OWNER} TO ue_v2_owner`]) {
      await f.db.exec('BEGIN')
      try {
        await f.db.exec(mutation)
        await expect(f.db.exec(compileExternalReadRolePreparationSql({ rolesPreprovisioned: true }))).rejects.toMatchObject({ code: '42501' })
      } finally { await f.db.exec('ROLLBACK') }
    }
    expect(externalReadCatalogViolations(await inspectExternalRead(async text => (await f.db.query(text)).rows))).toEqual([])
  }, 60000)

  it('requires a selected canonical organization even when the actor owns a real bearer for that organization', async () => {
    const f = active = await externalReaderFixture()
    const codes: Record<string, unknown> = {}
    const core = await f.as(f.actor, tx => tx.query('SELECT user_management.auth_business_org_authorized($1,NULL::text[]) AS binding,public.ue_case_domain_authorized($1,$2,$3) AS primary_authorized',
      [f.org, f.caseId, 'case:disclose_to_member']), false, { organizationId: '' })
    try { await f.as(f.member, tx => tx.query('SELECT public.ue_external_member_consent_v1($1::jsonb,$2)',
      [JSON.stringify(f.binding), 'Synthetic exact consent']), false, { organizationId: '' }); codes.consent = null }
    catch (error) { codes.consent = error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN' }
    const consent = await f.consent()
    try { await f.as(f.actor, tx => tx.query('SELECT public.ue_external_qualify_read_v1($1::jsonb,$2)',
      [JSON.stringify(f.binding), consent]), true, { organizationId: '' }); codes.qualification = null }
    catch (error) { codes.qualification = error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN' }
    process.stdout.write(JSON.stringify({ proof: 'EXTERNAL_MISSING_SELECTED_ORG_COMPONENT', actualCoreDecision: core.rows,
      codes, boundary: 'Real own bearer and own canonical memberships, selected organization omitted; no cross-user or foreign-membership claim' }) + '\n')
    expect(codes).toEqual({ consent: '42501', qualification: '42501' })
    expect((await f.db.query('SELECT id FROM public.ue_external_read_qualifications')).rows).toEqual([])
  }, 60000)

  it('requires all three votes from the actual adopted disclosure power, independently of the office issuance quorum of one', async () => {
    const f = active = await externalReaderFixture({ institutionalApproval: false }), consent = await f.consent()
    const id = await f.openInstitutional()
    for (const who of f.authorizers.slice(0, 2)) {
      await f.approveInstitutional(id, who)
      await expect(f.qualify(consent)).rejects.toMatchObject({ code: '42501' })
    }
    await f.approveInstitutional(id, f.authorizers[2]); await f.qualify(consent)
    expect((await f.read()).rows[0].payload).toMatchObject({ id: f.caseId })
    const rule = (await f.db.query('SELECT required_independent_approvals,allowed_powers FROM public.ue_authority_issuance_rules WHERE id=$1', [f.ruleId])).rows[0]
    expect(rule).toMatchObject({ required_independent_approvals: 1, allowed_powers: ['approve', 'external_read.authorize:high:3'] })
  }, 60000)

  it.each([[1, 'low'], [2, 'high']] as const)('refuses caller-lowered external action threshold %s/%s although generic named approval is eligible', async (threshold, risk) => {
    const f = active = await externalReaderFixture({ institutionalApproval: false })
    const id = await f.openInstitutional(f.binding, threshold, risk)
    await expect(f.approveInstitutional(id)).rejects.toMatchObject({ code: '42501' })
    expect((await f.db.query('SELECT id FROM public.ue_authority_approval_decisions WHERE approval_request_id=$1', [id])).rows).toEqual([])
    await expect(f.qualify(await f.consent())).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('uses an independently adopted medium/one action policy when that exact source power exists, rather than a fixed external quorum', async () => {
    const f = active = await externalReaderFixture({ actionRisk: 'medium', actionApprovals: 1 })
    await f.qualify(await f.consent())
    expect((await f.read()).rows[0].payload).toMatchObject({ id: f.caseId })
    expect((await f.db.query('SELECT required_approvals,risk_class FROM public.ue_authority_approval_requests WHERE id=$1', [f.binding.institutionalApprovalId])).rows)
      .toEqual([{ required_approvals: 1, risk_class: 'medium' }])
  }, 60000)

  it('does not promote active legacy grants, citation hashes or member consent without a real exact-payload institutional approval', async () => {
    const f = active = await externalReaderFixture({ institutionalApproval: false }), consent = await f.consent()
    await expect(f.qualify(consent)).rejects.toMatchObject({ code: '42501' })
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
    await f.authorize(); await f.qualify(consent)
    expect((await f.read()).rows[0].payload).toMatchObject({ id: f.caseId })
  }, 60000)

  it('cannot reuse an institutional request for a different exact payload or edit its risk, threshold, member, case or hash after the vote', async () => {
    const f = active = await externalReaderFixture(), binding = structuredClone(f.binding)
    binding.sourceInstrument.sha256 = 'd'.repeat(64)
    await expect(f.qualify(await f.consent(f.member, binding), f.actor, binding)).rejects.toMatchObject({ code: '42501' })
    for (const assignment of ["risk_class='low'", 'required_approvals=1', "subject_author_id='another-member'", "subject_type='external_read_authorization_v1:" + 'd'.repeat(64) + "'", 'subject_id=gen_random_uuid()'])
      await expect(f.as(f.actor, tx => tx.query(`UPDATE public.ue_authority_approval_requests SET ${assignment} WHERE id=$1`, [f.binding.institutionalApprovalId])))
        .rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it.each(['no-issuance-events', 'no-adoption-vote', 'not-accepted', 'revoked', 'expired', 'wrong-case', 'wrong-power', 'wrong-kind', 'wrong-organization', 'unhandled-ceiling', 'accepted-after-vote'] as const)
    ('denies retained institutional records lacking actual source authority: %s', async defect => {
      const f = active = await externalReaderFixture(), office = f.officeIds[0]
      // Trusted synthetic historical counterexamples only. Production guards
      // remain installed and the attempted qualification/read uses real roles.
      await f.seed(async () => {
        if (defect === 'no-issuance-events') await f.db.query("DELETE FROM public.ue_authority_events WHERE source_table='ue_authority_mandates' AND source_id=$1", [office])
        if (defect === 'no-adoption-vote') await f.db.query('DELETE FROM public.ue_authority_approval_decisions WHERE approval_request_id=$1 AND approver_user_id=$2', [f.adoptionId, 'external-adopter-one'])
        if (defect === 'not-accepted') await f.db.query('DELETE FROM public.ue_authority_acceptances WHERE instrument_id=$1', [office])
        if (defect === 'revoked') await f.db.query("UPDATE public.ue_authority_mandates SET status='revoked',revoked_at=now(),revoked_by=granted_by WHERE id=$1", [office])
        if (defect === 'expired') await f.db.query("UPDATE public.ue_authority_mandates SET expires_at=now()-interval '1 second' WHERE id=$1", [office])
        if (defect === 'wrong-case') await f.db.query('UPDATE public.ue_authority_mandates SET scope=$2 WHERE id=$1', [office, JSON.stringify({ resourceIds: [randomUUID()] })])
        if (defect === 'wrong-power') await f.db.query("UPDATE public.ue_authority_mandates SET powers=ARRAY['approve'] WHERE id=$1", [office])
        if (defect === 'wrong-kind') await f.db.query("UPDATE public.ue_authority_mandates SET kind='platform_staff' WHERE id=$1", [office])
        if (defect === 'wrong-organization') await f.db.query('UPDATE public.ue_authority_mandates SET organization_id=$2 WHERE id=$1', [office, f.representativeOrg])
        if (defect === 'unhandled-ceiling') await f.db.query('UPDATE public.ue_authority_mandates SET scope=$2 WHERE id=$1', [office, JSON.stringify({ resourceIds: [f.caseId], classificationCeiling: 'standard' })])
        if (defect === 'accepted-after-vote') await f.db.query("UPDATE public.ue_authority_acceptances SET accepted_at=clock_timestamp() WHERE instrument_id=$1", [office])
      })
      await expect(f.qualify(await f.consent())).rejects.toMatchObject({ code: '42501' })
      await expect(f.read()).rejects.toMatchObject({ code: '42501' })
    }, 60000)

  it('denies current office holders who are recused or adverse to the represented case, even when the runtime cannot read that hidden restriction', async () => {
    const f = active = await externalReaderFixture()
    await f.seed(() => f.db.query("INSERT INTO public.ue_authority_recusals(organization_id,principal_user_id,resource_type,resource_id,reason) VALUES($1,$2,'case',$3,'SYNTHETIC conflict')", [f.org, f.authorizers[0], f.caseId]))
    await expect(f.qualify(await f.consent())).rejects.toMatchObject({ code: '42501' })
    await f.seed(() => f.db.query('DELETE FROM public.ue_authority_recusals WHERE principal_user_id=$1', [f.authorizers[0]]))
    const scope = (await f.db.query<{ id: string }>('SELECT id FROM public.case_authority_scopes WHERE case_id=$1', [f.caseId])).rows[0].id
    await f.db.query('INSERT INTO public.case_respondents(organization_id,scope_id,respondent_user_id,recorded_by) VALUES($1,$2,$3,$4)', [f.org, scope, f.authorizers[0], f.actor])
    await expect(f.qualify(await f.consent())).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('cannot use member consent or an executive title/office to bypass the separate actual primary-handler request ceiling', async () => {
    const f = active = await externalReaderFixture({ institutionalApproval: false })
    for (const who of [f.member, f.authorizers[0]]) {
      const binding = { ...f.binding, institutionalApprovalId: randomUUID() }
      await expect(f.as(who, tx => openApprovalRequest(tx, { id: binding.institutionalApprovalId, organizationId: f.org,
        subjectType: `${EXTERNAL_READ_AUTHORIZATION}:${externalReadQualificationHash(binding)}`, subjectId: f.caseId, proposedBy: who,
        subjectAuthorId: f.member, requiredApprovals: 3, riskClass: 'high', namedApproverIds: f.authorizers, adverseUserIds: [f.recipient, f.member],
      }))).rejects.toMatchObject({ code: '42501' })
    }
    await f.openInstitutional()
    await expect(f.as(f.member, tx => tx.query("INSERT INTO public.ue_authority_approval_decisions(organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$3,'approved')", [f.org, f.binding.institutionalApprovalId, f.authorizers[0]])))
      .rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('revalidates institutional revocation after blob location using the external recipient original actor, organization and bearer', async () => {
    const f = active = await externalReaderFixture(); await f.qualify(await f.consent())
    const located = (await f.read('locate_download')).rows[0].payload as Record<string, unknown>
    const members = await f.as(f.recipient, tx => tx.query('SELECT * FROM user_management.ue_authority_membership_rows($1,$2)', [f.org, f.authorizers]))
    expect(members.rows).toEqual([])
    await f.seed(() => f.db.query("UPDATE public.ue_authority_mandates SET status='revoked',revoked_at=now(),revoked_by=granted_by WHERE id=$1", [f.officeIds[0]]))
    await expect(f.read('finalize_download', f.recipient, { expectedHash: String(located.qualificationHash), receipt: {
      qualificationId: located.qualificationId, documentId: located.documentId, versionId: located.versionId,
      versionNo: located.versionNo, checksumSha256: located.checksumSha256, sizeBytes: located.sizeBytes,
    } })).rejects.toMatchObject({ code: '42501' })
    expect((await f.db.query("SELECT id FROM public.audit_logs WHERE action='document.external_download'")).rows).toEqual([])
  }, 60000)

  it('requires canonical grievance person UUID, represented member and legacy authority person to identify the same person', async () => {
    const f = active = await externalReaderFixture()
    for (const person of [null, randomUUID()]) {
      await f.db.query('UPDATE public.grievances SET grievant_id=$2 WHERE id=$1', [f.caseId, person])
      await expect(f.consent()).rejects.toMatchObject({ code: '42501' })
    }
    await f.db.query('UPDATE public.grievances SET grievant_id=$2 WHERE id=$1', [f.caseId, f.member])
    const consent = await f.consent()
    await f.db.query('UPDATE public.representation_authorities SET represented_person_id=$2 WHERE id=$1', [f.authorityId, randomUUID()])
    await expect(f.qualify(consent)).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('rolls actual institutional request and vote back when their canonical audit fails', async () => {
    const f = active = await externalReaderFixture({ institutionalApproval: false })
    await f.db.exec("CREATE FUNCTION public.reject_institution_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_INSTITUTION_AUDIT_FAILURE'; END $$;CREATE TRIGGER reject_institution_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_institution_audit()")
    await expect(f.openInstitutional()).rejects.toThrow('SYNTHETIC_INSTITUTION_AUDIT_FAILURE')
    expect((await f.db.query('SELECT id FROM public.ue_authority_approval_requests WHERE id=$1', [f.binding.institutionalApprovalId])).rows).toEqual([])
    await f.db.exec('ALTER TABLE public.audit_logs DISABLE TRIGGER reject_institution_audit'); await f.openInstitutional()
    await f.db.exec('ALTER TABLE public.audit_logs ENABLE TRIGGER reject_institution_audit')
    await expect(f.approveInstitutional()).rejects.toThrow('SYNTHETIC_INSTITUTION_AUDIT_FAILURE')
    expect((await f.db.query('SELECT id FROM public.ue_authority_approval_decisions WHERE approval_request_id=$1', [f.binding.institutionalApprovalId])).rows).toEqual([])
    expect((await f.db.query('SELECT status FROM public.ue_authority_approval_requests WHERE id=$1', [f.binding.institutionalApprovalId])).rows).toEqual([{ status: 'open' }])
  }, 60000)

  it.each(['membership-inactive', 'role-admin', 'user-inactive'] as const)('requires ongoing canonical office eligibility after approval and qualification: %s', async loss => {
    const f = active = await externalReaderFixture(), consent = await f.consent(), who = f.authorizers[0]
    const change = async (restore: boolean) => {
      if (loss === 'membership-inactive') await f.db.query('UPDATE user_management.organization_users SET is_active=$3 WHERE organization_id=$1 AND user_id=$2', [f.org, who, restore])
      if (loss === 'role-admin') await f.db.query('UPDATE user_management.organization_users SET role=$3 WHERE organization_id=$1 AND user_id=$2', [f.org, who, restore ? 'president' : 'admin'])
      if (loss === 'user-inactive') await f.db.query('UPDATE user_management.users SET is_active=$2 WHERE user_id=$1', [who, restore])
    }
    await change(false)
    await expect(f.qualify(consent)).rejects.toMatchObject({ code: '42501' })
    await change(true); await f.qualify(consent)
    expect((await f.read()).rows[0].payload).toMatchObject({ id: f.caseId })
    await change(false)
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('binds the full immutable adopted rule, including disclosure powers and distinct issuance thresholds, to its actual activation event', async () => {
    const f = active = await externalReaderFixture(), consent = await f.consent()
    const office = () => f.db.query<{ valid: boolean }>("SELECT public.ue_external_office_valid($1,$2,$3,'external_read.authorize:high:3',clock_timestamp(),$4,false) AS valid", [f.org, f.caseId, f.authorizers[0], f.binding.expiresAt])
    await f.db.exec('BEGIN')
    try { await f.db.query("SELECT set_config('ue.external_read_org',$1,true)", [f.org]); expect((await office()).rows[0].valid).toBe(true) }
    finally { await f.db.exec('ROLLBACK') }
    for (const assignment of ["allowed_powers=array_append(allowed_powers,'external_read.authorize:low:1')", 'required_independent_approvals=0', 'max_term_days=30']) {
      await f.db.exec('BEGIN;SET LOCAL session_replication_role=replica')
      try {
        await f.db.query(`UPDATE public.ue_authority_issuance_rules SET ${assignment} WHERE id=$1`, [f.ruleId])
        await f.db.exec('SET LOCAL session_replication_role=origin')
        await f.db.query("SELECT set_config('ue.external_read_org',$1,true)", [f.org])
        const valid = await office()
        expect(valid.rows[0].valid).toBe(false)
      } finally { await f.db.exec('ROLLBACK') }
    }
    await f.qualify(consent)
    expect((await f.read()).rows[0].payload).toMatchObject({ id: f.caseId })
  }, 60000)

  it('cannot turn forged private reader settings into a generic foreign membership API, and restores all original context after a qualified read', async () => {
    const f = active = await externalReaderFixture(); await f.qualify(await f.consent())
    for (const fn of ['ue_external_authorizer_live_v1', 'ue_external_authorizer_scope_v1'])
      await expect(f.as(f.recipient, tx => tx.query(`SELECT public.${fn}($1,$2,$3)`, [f.org, f.binding.institutionalApprovalId, f.authorizers[0]])))
        .rejects.toMatchObject({ code: '42501' })
    const observed = await f.as(f.recipient, async tx => {
      await tx.query("SELECT set_config('ue.case_domain_org',$1,true),set_config('ue.case_domain_people',$2,true),set_config('ue.fixture_token_hash',encode(sha256(convert_to(current_setting('app.current_session_token',true),'UTF8')),'hex'),true)", [f.org, '{' + f.authorizers.join(',') + '}'])
      expect((await tx.query('SELECT * FROM user_management.ue_authority_membership_rows($1,$2)', [f.org, f.authorizers])).rows).toEqual([])
      const rows = await tx.query<{ payload: unknown }>("SELECT payload FROM public.ue_external_resource_read_v1($1,$2,NULL,'matter',NULL,NULL)", [f.org, f.caseId])
      const stable = (await tx.query(`SELECT current_setting('app.current_user_id')=$1 AS actor,
        current_setting('app.current_org_id')=$2 AS own_org,current_setting('ue.case_domain_org')=$3 AS private_org,
        current_setting('ue.case_domain_people')=$4 AS private_people,
        encode(sha256(convert_to(current_setting('app.current_session_token'),'UTF8')),'hex')=current_setting('ue.fixture_token_hash') AS bearer`,
      [f.recipient, f.representativeOrg, f.org, '{' + f.authorizers.join(',') + '}'])).rows[0]
      return { payload: rows.rows[0].payload, stable }
    })
    expect(observed.payload).toMatchObject({ id: f.caseId })
    expect(observed.stable).toEqual({ actor: true, own_org: true, private_org: true, private_people: true, bearer: true })
  }, 60000)

  it('refuses contradictory historical extra votes even when the other three valid votes satisfy the numeric threshold', async () => {
    const f = active = await externalReaderFixture()
    await f.seed(() => f.db.query("INSERT INTO public.ue_authority_approval_decisions(organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$3,'approved')", [f.org, f.binding.institutionalApprovalId, f.recipient]))
    await expect(f.qualify(await f.consent())).rejects.toMatchObject({ code: '42501' })
  }, 60000)

  it('does not write any refusal into the query-named organization for an unqualified external recipient', async () => {
    const f = active = await externalReaderFixture(), before = (await f.db.query('SELECT id FROM public.audit_logs WHERE organization_id=$1 ORDER BY id', [f.org])).rows
    await expect(f.read()).rejects.toMatchObject({ code: '42501' })
    expect((await f.db.query('SELECT id FROM public.audit_logs WHERE organization_id=$1 ORDER BY id', [f.org])).rows).toEqual(before)
  }, 60000)
})
