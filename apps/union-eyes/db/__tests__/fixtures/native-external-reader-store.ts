/** Native fixture ONLY. The existing native project owns its clone and four
 * restricted LOGINs. No schema/compiler replay, role, policy or grant changes.
 * Every institutional actor is synthetic, never customer/founder adoption.
 * It opens raw driver connections, so it lives with the other native harnesses
 * under db/__tests__, never under lib/ (application code). */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import pg from 'pg'
import { sql, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { authDb, withAuthContext } from '../../../../../packages/platform-auth/src/auth-db'
import { AUTH_EXECUTION_ROLES } from '../../../../../packages/db/src/auth-storage-authority/execution-boundary'
import { createNativeCanonicalSession, nativeActionUrl, setNativeBusinessContext,
  type NativeCanonicalSession } from '@/scripts/runtime/native-canonical-fixture'
import { seedMembership, type Db } from '@/db/__tests__/authority-kernel-harness'
import { ensureCaseAuthorityScope } from '@/lib/authority/store/case-scope'
import { acceptInstrument, activateIssuanceRule, assignCase, changeMandate, draftIssuanceRule,
  issueMandate, requestIssuanceApproval, requestRuleAdoption } from '@/lib/authority/store/lifecycle'
import { openApprovalRequest, recordApprovalDecision } from '@/lib/authority/store/mutations'
import { membershipSourceViaDefiner } from '@/lib/authority/store/platform-identity'
import type { SqlExecutor } from '@/lib/authority/store/executor'
import { DEFAULT_ISSUANCE_TEMPLATES, type IssuanceDomain, type IssuanceOperation } from '@/lib/authority/issuance'
import { externalReadCatalogViolations, inspectExternalRead } from '@/lib/external-resource-read/catalog'
import { EXTERNAL_READ_AUTHORIZATION, EXTERNAL_READ_POWER, EXTERNAL_READ_QUALIFICATION,
  externalReadQualificationHash, parseExternalReadQualification } from '@/lib/external-resource-read/qualification'

const identifier = (value: string) => { assert.match(value, /^[a-z][a-z0-9_]{0,62}$/); return '"' + value + '"' }
const port = (client: pg.Client | pg.PoolClient): SqlExecutor => ({ query: async <T>(text: string, params?: unknown[]) =>
  ({ rows: (await client.query(text, params)).rows as T[] }) })
const dialect = new PgDialect()
export interface NativeExternalTx extends SqlExecutor { readonly backendPid: number }
export interface NativeReaderPort { execute<T>(query: SQL): Promise<T[]> }
export interface NativeReaderHooks {
  omitSelectedOrganization?: boolean
  beforeQuery?: (operation: string, backendPid: number) => Promise<void>
  beforeCommit?: (operation: string, backendPid: number) => Promise<void>
  afterCommit?: (operation: string, backendPid: number) => void
}

function requireOwnedNativeClone() {
  const operatorUrl = process.env.UE_AUTHORITY_COMBINED_URL, templateUrl = process.env.UE_NATIVE_TEMPLATE_URL
  assert.ok(operatorUrl && templateUrl, 'An existing qualified template and its owned native clone are required')
  const operator = new URL(operatorUrl), template = new URL(templateUrl)
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(operator.hostname))
  assert.equal(operator.host, template.host)
  assert.match(operator.pathname, /^\/ue_native_[A-Za-z0-9_]+$/)
  assert.notEqual(operator.pathname, template.pathname, 'The qualification template must never receive fixture writes')
  const runtimeUrl = nativeActionUrl('union_eyes_runtime', operatorUrl)
  const restricted = ['UE_NATIVE_RUNTIME_URL', 'UE_NATIVE_SYSTEM_URL', 'AUTH_DATABASE_URL', 'AUTH_SYSTEM_DATABASE_URL'].map(key => {
    const value = process.env[key]; assert.ok(value, 'Four per-clone restricted credentials are required')
    const parsed = new URL(value); assert.equal(parsed.host, operator.host); assert.equal(parsed.pathname, operator.pathname)
    assert.notEqual(parsed.username, operator.username); assert.ok(parsed.password)
    return parsed
  })
  assert.equal(new Set(restricted.map(value => value.username)).size, 4)
  return { operatorUrl, runtimeUrl }
}

export async function nativeExternalReaderFixture(options: { qualificationLifetimeMs?: number; authorize?: boolean } = {}) {
  const urls = requireOwnedNativeClone(), operator = new pg.Client({ connectionString: urls.operatorUrl })
  const runtimePool = new pg.Pool({ connectionString: urls.runtimeUrl, max: 4 }), ownerPool = new pg.Pool({ connectionString: urls.operatorUrl, max: 2 })
  const org = randomUUID(), representativeOrg = randomUUID(), caseId = randomUUID()
  const who = { member: randomUUID(), actor: randomUUID(), chief: randomUUID(), drafter: randomUUID(), issuer: randomUUID(),
    adopterOne: randomUUID(), adopterTwo: randomUUID(), admin: randomUUID(), recipient: randomUUID(), stranger: randomUUID(),
    authorizerOne: randomUUID(), authorizerTwo: randomUUID(), authorizerThree: randomUUID() }
  const authorizers = [who.authorizerOne, who.authorizerTwo, who.authorizerThree], adopters = [who.adopterOne, who.adopterTwo]
  const sessions = new Map<string, NativeCanonicalSession>()
  const actorOrg = (user: string) => user === who.recipient || user === who.stranger ? representativeOrg : org
  const close = async () => {
    const results = await Promise.allSettled([runtimePool.end(), ownerPool.end(), operator.end()])
    const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (failures.length) throw new AggregateError(failures, 'Owned native external fixture connection cleanup failed')
  }
  try {
    await operator.connect()
    const server = (await operator.query('SHOW server_version')).rows[0].server_version as string
    const major = Number(server.split('.')[0]); assert.ok(major === 15 || major === 16, 'This native cohort qualifies PostgreSQL15/16 only')
    assert.deepEqual(externalReadCatalogViolations(await inspectExternalRead(async text => (await operator.query(text)).rows)), [],
      'Exact current reader required on template; fixture installation is forbidden')
    const db: Db = { ...port(operator), exec: text => operator.query(text) }
    for (const [id, label] of [[org, 'represented'], [representativeOrg, 'external']]) await operator.query(`INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,member_count,active_member_count,settings,features_enabled,status,created_at,updated_at,remittance_day)
      VALUES($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`, [id, 'SYNTHETIC external native ' + label, 'ext-native-' + id])
    for (const [name, user] of Object.entries(who)) {
      const role = name === 'actor' ? 'steward' : name === 'chief' ? 'chief_steward' : name === 'admin' ? 'admin'
        : ['member', 'recipient', 'stranger'].includes(name) ? 'member' : 'president'
      await seedMembership(db, user, actorOrg(user), role)
      await operator.query('UPDATE user_management.users SET email_verified=true,is_system_admin=$2 WHERE user_id=$1', [user, name === 'admin'])
    }
    // Business facts only; authority below uses the actual lifecycle, real
    // canonical source memberships and production opaque session/bearer binder.
    await operator.query(`INSERT INTO public.grievances(id,organization_id,created_by,grievant_id,represented_member_user_id,
      created_at,updated_at,has_legal_implications,is_arbitration_eligible,is_confidential,is_group_grievance,priority,status,grievance_number,title,type,description)
      VALUES($1,$2,$3::text,$3::text::uuid,$3::text,now(),now(),false,false,false,false,'medium','filed',$4,'SYNTHETIC native external matter','individual','Synthetic local qualification only')`,
    [caseId, org, who.member, 'EXT-NATIVE-' + caseId])
    const session = async (user: string) => {
      let value = sessions.get(user)
      if (!value) { value = await createNativeCanonicalSession(user, actorOrg(user)); sessions.set(user, value) }
      return value
    }
    const as = async <T>(user: string, work: (tx: NativeExternalTx) => Promise<T>, settings: { owner?: boolean; omitSelectedOrganization?: boolean;
      beforeCommit?: (pid: number) => Promise<void>; afterCommit?: (pid: number) => void } = {}) =>
      (await session(user)).withBinding(async binding => {
        const client = await (settings.owner ? ownerPool : runtimePool).connect()
        try {
          await client.query('BEGIN'); await client.query("SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='15s'")
          await client.query(settings.owner ? 'SET LOCAL ROLE ue_v2_owner' : 'SET LOCAL ROLE union_eyes_runtime')
          await setNativeBusinessContext(port(client), binding)
          if (settings.omitSelectedOrganization) await client.query("SELECT set_config('app.current_org_id','',true)")
          const backendPid = Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
          const result = await work({ ...port(client), backendPid })
          await settings.beforeCommit?.(backendPid); await client.query('COMMIT'); settings.afterCommit?.(backendPid)
          return result
        } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error }
        finally { client.release() }
      })
    const deps = { memberships: membershipSourceViaDefiner }
    const adopt = async (domain: IssuanceDomain, operation: IssuanceOperation, externalOffice = false) => {
      const found = DEFAULT_ISSUANCE_TEMPLATES.find(value => value.domain === domain && value.operation === operation)
      assert.ok(found, 'Existing source issuance template required')
      const { rationale: _rationale, ...template } = found
      const id = await as(who.drafter, tx => draftIssuanceRule(tx, deps, { ...template, organizationId: org, draftedBy: who.drafter,
        ...(externalOffice ? { allowedPowers: ['approve', `${EXTERNAL_READ_POWER}:high:3`], maxTermDays: 1 } : {}) }))
      const request = await as(who.drafter, tx => requestRuleAdoption(tx, deps, { organizationId: org, ruleId: id, actorUserId: who.drafter,
        sourceInstrument: `SYNTHETIC native institution ${domain}/${operation}; no customer activation`, namedApproverIds: adopters }))
      for (const user of adopters) await as(user, tx => recordApprovalDecision(tx, deps, { organizationId: org, approvalRequestId: request, approverUserId: user, decision: 'approved' }))
      await as(who.drafter, tx => activateIssuanceRule(tx, deps, { organizationId: org, ruleId: id, actorUserId: who.drafter, approvalRequestId: request }))
      return id
    }
    await adopt('supervisory', 'issue'); await adopt('case_assignment', 'issue')
    const officeRule = await adopt('executive_office', 'issue', true); await adopt('executive_office', 'revoke')
    const issue = async (holder: string, kind: 'supervisory' | 'executive_office', powers: string[]) => {
      const id = randomUUID(), input = { organizationId: org, issuerUserId: who.issuer, holderUserId: holder, kind, powers,
        scope: { resourceIds: [caseId] }, sourceInstrument: `SYNTHETIC native exact-case ${kind} ${id}`,
        effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 2 * 60 * 60_000) }
      const approval = await as(who.issuer, tx => requestIssuanceApproval(tx, deps, { ...input, instrumentId: id, namedApproverIds: [who.adopterTwo] }))
      await as(who.adopterTwo, tx => recordApprovalDecision(tx, deps, { organizationId: org, approvalRequestId: approval, approverUserId: who.adopterTwo, decision: 'approved' }))
      await as(who.issuer, tx => issueMandate(tx, deps, { ...input, id, approvalRequestId: approval }))
      await as(holder, tx => acceptInstrument(tx, { organizationId: org, instrumentType: 'mandate', instrumentId: id, holderUserId: holder }))
      return id
    }
    await issue(who.chief, 'supervisory', ['read', 'assign', 'monitor'])
    await as(who.chief, tx => ensureCaseAuthorityScope(tx, deps, { organizationId: org, caseId, actorUserId: who.chief }))
    await as(who.chief, tx => assignCase(tx, deps, { organizationId: org, issuerUserId: who.chief, caseId,
      assigneeUserId: who.actor, permissions: ['read', 'read_internal'], effectiveAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 60 * 60_000) }))
    const offices: string[] = []
    for (const user of authorizers) offices.push(await issue(user, 'executive_office', ['approve', `${EXTERNAL_READ_POWER}:high:3`]))

    const authorityId = randomUUID(), matterGrantId = randomUUID(), documentId = randomUUID(), documentGrantId = randomUUID(), versionId = randomUUID()
    const bytes = Buffer.from('SYNTHETIC native reviewed external document'), checksum = createHash('sha256').update(bytes).digest('hex')
    const storageKey = 'synthetic/native-external/' + documentId
    const effectiveAt = new Date(Date.now() - 60_000).toISOString(), sourceExpires = new Date(Date.now() + 60 * 60_000).toISOString()
    await operator.query(`INSERT INTO public.documents(id,organization_id,uploaded_by,created_at,updated_at,uploaded_at,access_level,
      contains_legal_privilege,contains_medical_sensitive,contains_pii,is_confidential,medical_sensitive,privacy_label,status,name,filename,file_url,file_type,mime_type)
      VALUES($1,$2,$3,now(),now(),now(),'team',false,false,false,false,false,'team_confidential','active','Synthetic native external document','native.bin','synthetic:owned-native','application/octet-stream','application/octet-stream')`, [documentId, org, who.actor])
    await operator.query(`INSERT INTO public.document_versions(id,organization_id,document_id,version_no,storage_key,content_hash,uploaded_by,uploaded_at)
      VALUES($1,$2,$3,2,$4,$5,$6,now())`, [versionId, org, documentId, storageKey, checksum, who.actor])
    await operator.query(`INSERT INTO public.document_links(id,organization_id,document_id,linked_entity_type,linked_entity_id,linked_by,linked_at)
      VALUES($1,$2,$3,'grievance',$4,$5,now())`, [randomUUID(), org, documentId, caseId, who.actor])
    await operator.query(`INSERT INTO public.representation_authorities(id,organization_id,matter_type,matter_id,represented_person_id,representative_user_id,
      representative_organization_id,scope,source,status,effective_at,expires_at,created_by,created_at,updated_at)
      VALUES($1,$2,'grievance',$3,$4,$5,$6,ARRAY['view','documents'],'SYNTHETIC existing native external appointment','active',$7,$8,$9,now(),now())`,
    [authorityId, org, caseId, who.member, who.recipient, representativeOrg, effectiveAt, sourceExpires, who.actor])
    await operator.query(`INSERT INTO public.external_matter_access_grants(id,authority_id,organization_id,matter_type,matter_id,user_id,representative_organization_id,
      status,can_view,can_comment,can_upload_documents,can_view_documents,can_download_documents,granted_by,granted_at,expires_at,updated_at)
      VALUES($1,$2,$3,'grievance',$4,$5,$6,'active',true,false,false,true,true,$7,$8,$9,now())`,
    [matterGrantId, authorityId, org, caseId, who.recipient, representativeOrg, who.actor, effectiveAt, sourceExpires])
    await operator.query(`INSERT INTO public.external_document_access_grants(id,authority_id,matter_grant_id,organization_id,matter_type,matter_id,document_id,user_id,
      representative_organization_id,status,can_view,can_download,can_share,document_version_no,granted_by,granted_at,expires_at,updated_at)
      VALUES($1,$2,$3,$4,'grievance',$5,$6,$7,$8,'active',true,true,false,2,$9,$10,$11,now())`,
    [documentGrantId, authorityId, matterGrantId, org, caseId, documentId, who.recipient, representativeOrg, who.actor, effectiveAt, sourceExpires])
    const binding = parseExternalReadQualification({ operation: EXTERNAL_READ_QUALIFICATION, qualificationId: randomUUID(), institutionalApprovalId: randomUUID(), organizationId: org,
      representativeUserId: who.recipient, representativeOrganizationId: representativeOrg, representedMemberUserId: who.member, issuerUserId: who.actor,
      authority: { id: authorityId, representedPersonId: who.member, createdBy: who.actor, source: 'SYNTHETIC existing native external appointment',
        scope: ['view', 'documents'], evidenceDocumentId: null, effectiveAt, expiresAt: sourceExpires },
      matter: { type: 'grievance', id: caseId, grantId: matterGrantId, grantedBy: who.actor, grantedAt: effectiveAt, expiresAt: sourceExpires,
        permissions: { view: true, viewDocuments: true, downloadDocuments: true } },
      document: { id: documentId, grantId: documentGrantId, grantedBy: who.actor, grantedAt: effectiveAt, expiresAt: sourceExpires,
        canView: true, canDownload: true, versionId, versionNo: 2, checksumSha256: checksum, sizeBytes: bytes.length,
        storageKeySha256: createHash('sha256').update(storageKey).digest('hex'), privacyLabel: 'team_confidential' },
      sourceInstrument: { reference: 'SYNTHETIC native exact-payload institution/member review', sha256: createHash('sha256').update('SYNTHETIC native external source').digest('hex') },
      effectiveAt, expiresAt: options.qualificationLifetimeMs ? new Date(Date.now() + options.qualificationLifetimeMs).toISOString() : sourceExpires })
    if (options.authorize !== false) {
      const request = await as(who.actor, tx => openApprovalRequest(tx, { id: binding.institutionalApprovalId, organizationId: org,
        subjectType: `${EXTERNAL_READ_AUTHORIZATION}:${externalReadQualificationHash(binding)}`, subjectId: caseId, proposedBy: who.actor,
        subjectAuthorId: who.member, requiredApprovals: 3, riskClass: 'high', namedApproverIds: authorizers, adverseUserIds: [who.member, who.recipient] }))
      for (const user of authorizers) await as(user, tx => recordApprovalDecision(tx, deps, { organizationId: org, approvalRequestId: request, approverUserId: user, decision: 'approved' }))
    }
    const consent = () => as(who.member, async tx => (await tx.query<{ id: string }>('SELECT public.ue_external_member_consent_v1($1,$2) AS id',
      [JSON.stringify(binding), 'SYNTHETIC informed exact-recipient/matter/document/payload/term consent'])).rows[0].id)
    const qualify = (consentId: string) => as(who.actor, async tx => (await tx.query<{ id: string }>('SELECT public.ue_external_qualify_read_v1($1,$2) AS id',
      [JSON.stringify(binding), consentId])).rows[0].id, { owner: true })
    const read = (operation = 'matter', user = who.recipient) => as(user, tx => tx.query<{ payload: unknown }>('SELECT payload FROM public.ue_external_resource_read_v1($1,$2,$3,$4,NULL,NULL)',
      [org, caseId, ['document', 'locate_download', 'finalize_download'].includes(operation) ? documentId : null, operation]))
    const readerContext = <T>(work: (tx: NativeReaderPort) => Promise<T>, hooks: NativeReaderHooks = {}, user: string = who.recipient) => {
      let operation = ''
      return as(user, async client => work({ execute: async <R>(statement: SQL) => {
        const query = dialect.sqlToQuery(statement); operation = String(query.params[3])
        assert.ok(['matter', 'documents', 'document', 'locate_download', 'finalize_download'].includes(operation), 'Fixed production reader operation required')
        await hooks.beforeQuery?.(operation, client.backendPid)
        return (await client.query<R>(query.sql, query.params)).rows
      } }), { omitSelectedOrganization: hooks.omitSelectedOrganization,
        beforeCommit: pid => hooks.beforeCommit?.(operation, pid) ?? Promise.resolve(), afterCommit: pid => hooks.afterCommit?.(operation, pid) })
    }
    const mutateMembership = async (active: boolean, hooks: { onBackend?: (pid: number) => void; beforeCommit?: () => Promise<void> } = {}) =>
      (await session(who.admin)).withBinding(() => withAuthContext({ phase: 'system', operation: 'membership-state', actorUserId: who.admin, targetUserId: authorizers[0], organizationId: org,
        reason: 'SYNTHETIC native controlled membership lifecycle' }, async () => {
        await authDb.execute(sql`SET LOCAL statement_timeout='20s'`)
        const [backend] = await authDb.execute(sql`SELECT pg_backend_pid() AS pid,current_user AS role,
          (SELECT rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit FROM pg_roles WHERE rolname=session_user) AS privileged_login`)
        assert.equal(backend.role, AUTH_EXECUTION_ROLES.system); assert.equal(backend.privileged_login, false)
        hooks.onBackend?.(Number(backend.pid))
        const changed = await authDb.execute(sql`UPDATE user_management.organization_users SET is_active=${active},updated_at=clock_timestamp()
          WHERE organization_id=${org}::uuid AND user_id=${authorizers[0]} RETURNING organization_user_id`)
        assert.equal(changed.length, 1, 'The scoped real auth-system operation must mutate exactly the intended membership')
        await hooks.beforeCommit?.()
      }))
    // The auth manifest deliberately gives tenant-admin no role writer. This
    // controlled operator source-state counterexample proves reader denial;
    // it does not qualify an unimplemented role-management application flow.
    const changeRole = async (role: 'admin' | 'president') => {
      const changed = await operator.query('UPDATE user_management.organization_users SET role=$3,updated_at=clock_timestamp() WHERE organization_id=$1 AND user_id=$2 RETURNING user_id', [org, authorizers[0], role])
      assert.equal(changed.rowCount, 1)
    }
    const changeUserActive = (active: boolean) => session(who.admin).then(value => value.withBinding(() =>
      withAuthContext({ phase: 'lifecycle', actorUserId: who.admin, targetUserId: authorizers[0], operation: active ? 'reactivate' : 'suspend',
        reason: 'SYNTHETIC native controlled account lifecycle' }, async () => {
        const changed = await authDb.execute(sql`UPDATE user_management.users
          SET is_active=${active},lifecycle_state=${active ? 'active' : 'suspended'},lifecycle_changed_by=${who.admin},
            lifecycle_changed_at=clock_timestamp(),lifecycle_reason='SYNTHETIC native controlled account lifecycle',updated_at=clock_timestamp()
          WHERE user_id=${authorizers[0]} RETURNING user_id`)
        assert.equal(changed.length, 1, 'The real lifecycle purpose must mutate exactly the intended canonical user')
      })))
    const revokeConsent = (id: string) => as(who.member, tx => tx.query("SELECT public.ue_external_revoke_read_v1('consent',$1)", [id]))
    const revokeOffice = () => as(who.issuer, tx => changeMandate(tx, deps, { organizationId: org, issuerUserId: who.issuer, mandateId: offices[0], change: 'revoke' }))
    const count = async (action: string) => Number((await operator.query('SELECT count(*)::integer AS count FROM public.audit_logs WHERE organization_id=$1 AND action=$2', [org, action])).rows[0].count)
    const shortenRecipientSession = async (milliseconds: number) => {
      assert.ok(Number.isInteger(milliseconds) && milliseconds > 0 && milliseconds <= 30_000)
      const original = await session(who.recipient)
      // Controlled expiry of a GENUINE factory-issued parent, never a raw
      // token/session insert or a substitute legacy credential.
      const changed = await operator.query<{ expires_at: Date }>(`UPDATE user_management.user_sessions
        SET expires_at=clock_timestamp()+$2::integer*interval '1 millisecond' WHERE session_id=$1 RETURNING expires_at`, [original.sessionId, milliseconds])
      assert.equal(changed.rowCount, 1); return changed.rows[0].expires_at
    }
    const withAuditFailure = async <T>(action: string, work: () => Promise<T>, deferred = false) => {
      assert.ok(['external.consent.grant', 'external.qualification.bind', 'document.external_download'].includes(action))
      const name = 'ue_ext_native_audit_' + randomUUID().replaceAll('-', '').slice(0, 12), quoted = identifier(name)
      await operator.query(`CREATE FUNCTION public.${quoted}() RETURNS trigger LANGUAGE plpgsql AS $native_test$
        BEGIN IF NEW.organization_id='${org}'::uuid AND NEW.action='${action}' THEN RAISE EXCEPTION 'SYNTHETIC_NATIVE_AUDIT_FAILURE'; END IF;RETURN NEW;END $native_test$`)
      await operator.query(`REVOKE ALL ON FUNCTION public.${quoted}() FROM PUBLIC`)
      try {
        await operator.query(deferred
          ? `CREATE CONSTRAINT TRIGGER ${quoted} AFTER INSERT ON public.audit_logs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.${quoted}()`
          : `CREATE TRIGGER ${quoted} BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.${quoted}()`)
        try { return await work() } finally { await operator.query(`DROP TRIGGER ${quoted} ON public.audit_logs`) }
      } finally { await operator.query(`DROP FUNCTION public.${quoted}()`) }
    }
    return { operator, ...who, org, representativeOrg, caseId, documentId, versionId, authorityId, matterGrantId, documentGrantId, binding,
      bytes, storageKey, checksum, authorizers, offices, officeRule, server, major, as, session, consent, qualify, read, readerContext,
      mutateMembership, changeRole, changeUserActive, revokeConsent, revokeOffice, shortenRecipientSession, count, withAuditFailure, close,
      resource: { organizationId: org, matterType: 'grievance', matterId: caseId, documentId } }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error, cleanup], 'Native external fixture setup and cleanup failed') }
    throw error
  }
}
