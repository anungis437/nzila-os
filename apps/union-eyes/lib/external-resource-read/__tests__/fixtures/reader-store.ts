/** Disposable SQL component: existing real canonical auth/primary-handler
 * compiler and synthetic pre-existing institutional instruments. No native
 * sockets, live institution adoption or provider interaction is asserted. */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { caseDomainFixture, type CaseDomainDb } from '@/db/__tests__/case-primary-domain-testkit'
import * as external from '@/db/schema/representation-authority-schema'
import { documents, documentFolders, documentLinks, documentVersions, documentPrivacyLabelEnum, documentRecordStatusEnum, documentLinkedEntityTypeEnum } from '@/db/schema/documents-schema'
import { externalReadConsents, externalReadQualifications } from '@/db/schema/domains/documents/external-read'
import * as authoritySchema from '@/db/schema/domains/ml/authority-kernel'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { AUTHORITY_ISSUER_GUARDS } from '@/db/auth/authority-issuer-guards'
import { applyPhysicalGuards, inspectPhysicalGuards, planPhysicalGuards } from '@/db/auth/physical-guard-catalog'
import { compileAuthorityMembershipReaderSql, membershipSourceViaDefiner } from '@/lib/authority/store/platform-identity'
import { acceptInstrument, activateIssuanceRule, draftIssuanceRule, issueMandate, requestIssuanceApproval, requestRuleAdoption } from '@/lib/authority/store/lifecycle'
import { openApprovalRequest, recordApprovalDecision } from '@/lib/authority/store/mutations'
import { compileExternalReadSql, compileExternalReadRolePreparationSql, compileExternalReadRoleFinalizationSql, EXTERNAL_READ_COLUMN_GRANTS, EXTERNAL_READ_OWNER } from '../../source'
import { compileExternalAuthBridgeSql } from '../../auth-bridge'
import { EXTERNAL_READ_AUTHORIZATION, EXTERNAL_READ_POWER, EXTERNAL_READ_QUALIFICATION, externalReadQualificationHash, parseExternalReadQualification, type ExternalReadQualification } from '../../qualification'

export async function externalReaderFixture(options: { installerSemantics?: boolean; rolePreprovisioned?: boolean; institutionalApproval?: boolean;
  actionRisk?: 'low' | 'medium' | 'high' | 'critical'; actionApprovals?: number } = {}) {
  const base = await caseDomainFixture(false), { db, org, caseId, actor } = base
  const member = randomUUID()
  try {
    const representativeOrg = randomUUID(), recipient = 'external-recipient', outsider = 'other-recipient'
    const runtimeLogin = 'external_runtime_' + randomBytes(6).toString('hex'), operatorLogin = 'external_operator_' + randomBytes(6).toString('hex')
    await db.exec(`CREATE ROLE ${runtimeLogin} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;GRANT union_eyes_runtime TO ${runtimeLogin};
      CREATE ROLE ${operatorLogin} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;GRANT ue_v2_owner TO ${operatorLogin};
      CREATE TABLE public.organizations(id uuid PRIMARY KEY);
      ALTER TABLE public.grievances ADD COLUMN grievance_number text,ADD COLUMN title text,ADD COLUMN step text,ADD COLUMN filed_date timestamptz,ADD COLUMN response_deadline timestamptz;`)
    await db.query('INSERT INTO public.organizations VALUES($1),($2)', [org, representativeOrg])
    await db.query("INSERT INTO user_management.users(user_id,email,email_verified,is_active,lifecycle_state) VALUES($1,'canonical-member@example.invalid',true,true,'active')", [member])
    await db.query("INSERT INTO user_management.organization_users VALUES($1,$2,'member',true)", [member, org])
    await db.query('UPDATE public.claims SET member_id=$2 WHERE claim_id=$1', [caseId, member])
    const drafter = 'external-drafter', adopters = ['external-adopter-one', 'external-adopter-two'], issuer = 'external-office-issuer'
    const authorizers = ['external-authorizer-one', 'external-authorizer-two', 'external-authorizer-three']
    for (const who of [drafter, ...adopters, issuer, ...authorizers]) {
      await db.query("INSERT INTO user_management.users(user_id,email,email_verified,is_active,lifecycle_state) VALUES($1,$2,true,true,'active')", [who, who + '@example.invalid'])
      await db.query("INSERT INTO user_management.organization_users VALUES($1,$2,'president',true)", [who, org])
    }
    await db.exec(compileAuthorityMembershipReaderSql())
    for (const table of Object.values(authoritySchema).map(table => getTableConfig(table).name)) {
      await db.exec(`GRANT SELECT ON public.${table} TO union_eyes_runtime`)
      if (!['ue_authority_resource_relationships','ue_authority_recusals','ue_authority_events','ue_authority_requests'].includes(table))
        await db.exec(`CREATE POLICY external_fixture_tenant ON public.${table} TO union_eyes_runtime USING(organization_id::text=current_setting('app.current_org_id',true)) WITH CHECK(organization_id::text=current_setting('app.current_org_id',true))`)
    }
    await db.exec('GRANT INSERT,UPDATE ON public.ue_authority_issuance_rules,public.ue_authority_mandates,public.ue_authority_approval_requests,public.ue_authority_approval_decisions,public.ue_authority_acceptances TO union_eyes_runtime')
    const guardExecute = async (text: string) => (await db.query(text)).rows as Record<string, unknown>[]
    await db.exec('BEGIN;SET LOCAL ROLE ue_v2_owner')
    const issuerGuardPlan = planPhysicalGuards(AUTHORITY_ISSUER_GUARDS, await inspectPhysicalGuards(AUTHORITY_ISSUER_GUARDS, guardExecute))
    await applyPhysicalGuards(AUTHORITY_ISSUER_GUARDS, guardExecute, issuerGuardPlan.fingerprint)
    await db.exec('COMMIT;RESET ROLE')
    const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson({ ...external, documents, documentFolders, documentLinks,
      documentVersions, documentPrivacyLabelEnum, documentRecordStatusEnum, documentLinkedEntityTypeEnum, externalReadConsents, externalReadQualifications }))
    for (const statement of [...ddl.filter(s => !s.startsWith('ALTER TABLE')), ...ddl.filter(s => s.startsWith('ALTER TABLE'))]) await db.exec(statement)
    await db.query(`INSERT INTO public.grievances(id,organization_id,represented_member_user_id,grievant_id,grievance_number,title,status,has_legal_implications,is_confidential)
      VALUES($1,$2,$3::text,$3::text::uuid,'SYNTHETIC-EXTERNAL','Synthetic bounded matter','filed',false,false)`, [caseId, org, member])
    await db.query(`INSERT INTO public.case_authority_scopes(id,organization_id,case_id,claim_id,grievance_mirror_id,mirror_recorded_at,mirror_recorded_by)
      VALUES($1,$2,$3,$3,$3,now(),'synthetic-fixture')`, [randomUUID(), org, caseId])
    for (const who of [recipient, outsider]) {
      await db.query("INSERT INTO user_management.users(user_id,email,email_verified,is_active,lifecycle_state) VALUES($1,$2,true,true,'active')", [who, who + '@example.invalid'])
      await db.query("INSERT INTO user_management.organization_users VALUES($1,$2,'member',true)", [who, representativeOrg])
    }
    const tokens = new Map<string, string>()
    for (const who of [actor, member, 'unrelated', recipient, outsider, drafter, ...adopters, issuer, ...authorizers]) {
      const token = randomBytes(32).toString('base64url'); tokens.set(who, token)
      const hash = createHash('sha256').update(token).digest('hex')
      if (![actor, 'unrelated'].includes(who)) await db.query(`INSERT INTO user_management.user_sessions(user_id,organization_id,session_token_hash,is_active,expires_at)
        VALUES($1,$2,$3,true,now()+interval '1 hour')`, [who, [recipient, outsider].includes(who) ? representativeOrg : org, hash])
      else await db.query('UPDATE user_management.user_sessions SET session_token_hash=$2 WHERE user_id=$1', [who, hash])
    }
    const authorityId = randomUUID(), matterGrant = randomUUID(), documentId = randomUUID(), documentGrant = randomUUID(), versionId = randomUUID()
    const effective = new Date(Date.now() - 60_000).toISOString(), expires = new Date(Date.now() + 60 * 60_000).toISOString()
    const bytes = Buffer.from('Synthetic reviewed exact external content'), checksum = createHash('sha256').update(bytes).digest('hex'), storageKey = 'synthetic/external/fixture.bin'
    await db.query(`INSERT INTO public.documents(id,organization_id,name,file_url,file_type,mime_type,filename,uploaded_by,privacy_label)
      VALUES($1,$2,'Synthetic document','synthetic:fixture','application/octet-stream','application/octet-stream','fixture.bin',$3,'team_confidential')`, [documentId, org, actor])
    await db.query(`INSERT INTO public.document_versions(id,organization_id,document_id,version_no,storage_key,content_hash,uploaded_by)
      VALUES($1,$2,$3,2,$4,$5,$6)`, [versionId, org, documentId, storageKey, checksum, actor])
    await db.query(`INSERT INTO public.document_links(organization_id,document_id,linked_entity_type,linked_entity_id,linked_by) VALUES($1,$2,'grievance',$3,$4)`, [org, documentId, caseId, actor])
    const representedPerson = member
    await db.query(`INSERT INTO public.representation_authorities(id,organization_id,matter_type,matter_id,represented_person_id,representative_user_id,representative_organization_id,
      scope,source,status,effective_at,expires_at,created_by) VALUES($1,$2,'grievance',$3,$4,$5,$6,ARRAY['view','documents'],'Synthetic existing authority','active',$7,$8,$9)`,
    [authorityId, org, caseId, representedPerson, recipient, representativeOrg, effective, expires, actor])
    await db.query(`INSERT INTO public.external_matter_access_grants(id,authority_id,organization_id,matter_type,matter_id,user_id,representative_organization_id,
      can_view,can_view_documents,can_download_documents,granted_by,granted_at,expires_at) VALUES($1,$2,$3,'grievance',$4,$5,$6,true,true,true,$7,$8,$9)`,
    [matterGrant, authorityId, org, caseId, recipient, representativeOrg, actor, effective, expires])
    await db.query(`INSERT INTO public.external_document_access_grants(id,authority_id,matter_grant_id,organization_id,matter_type,matter_id,document_id,user_id,representative_organization_id,
      can_view,can_download,document_version_no,granted_by,granted_at,expires_at) VALUES($1,$2,$3,$4,'grievance',$5,$6,$7,$8,true,true,2,$9,$10,$11)`,
    [documentGrant, authorityId, matterGrant, org, caseId, documentId, recipient, representativeOrg, actor, effective, expires])
    for (const grant of EXTERNAL_READ_COLUMN_GRANTS) await db.exec(`ALTER TABLE public.${grant.table} OWNER TO ue_v2_owner;
      ALTER TABLE public.${grant.table} ENABLE ROW LEVEL SECURITY;ALTER TABLE public.${grant.table} FORCE ROW LEVEL SECURITY`)
    // Match the actual fresh installer: newly created owner functions never
    // receive ambient PUBLIC EXECUTE. Trigger attachment must use their owner,
    // before transfer to the isolated private role, rather than that default.
    await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE ue_v2_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC')
    let missingPreparationDenied = false
    let missingPreparationCode: unknown = null
    let installerContext: Record<string, unknown> | null = null
    if (options.installerSemantics) {
      // This fixture models the actual canonical owner's INHERIT attribute;
      // no production role attributes are changed by the producer.
      await db.exec('ALTER ROLE ue_v2_owner INHERIT')
      await db.exec('GRANT nzila_auth_org_authority_reader TO ue_v2_owner WITH ADMIN FALSE,INHERIT FALSE,SET TRUE')
      await db.exec(`SET SESSION AUTHORIZATION ${operatorLogin};BEGIN;SET LOCAL ROLE ue_v2_owner`)
      try { await db.exec(compileExternalReadSql({ rolesPreprovisioned: true })) }
      catch (error) { missingPreparationDenied = true; missingPreparationCode = error && typeof error === 'object' && 'code' in error ? error.code : null }
      finally { await db.exec('ROLLBACK;SET SESSION AUTHORIZATION postgres') }
      if (!missingPreparationDenied) throw new Error('Unprepared restricted installer unexpectedly succeeded')
      await db.exec('BEGIN')
      try {
        if (options.rolePreprovisioned) await db.exec(`CREATE ROLE ${EXTERNAL_READ_OWNER} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
        await db.exec(compileExternalReadRolePreparationSql({ rolesPreprovisioned: options.rolePreprovisioned }))
        await db.exec(`SET SESSION AUTHORIZATION ${operatorLogin};SET LOCAL ROLE ue_v2_owner`)
        installerContext = (await db.query(`SELECT current_user AS execution_role,session_user AS login,
          (SELECT rolsuper FROM pg_roles WHERE rolname=session_user) AS login_superuser,
          (SELECT rolcreaterole FROM pg_roles WHERE rolname=session_user) AS login_createrole,
          (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS owner_createrole`)).rows[0]
        await db.exec(compileExternalReadSql({ rolesPreprovisioned: true }))
        await db.exec(compileExternalAuthBridgeSql({ rolesPreprovisioned: true }))
        await db.exec('RESET ROLE;SET SESSION AUTHORIZATION postgres')
        await db.exec(compileExternalReadRoleFinalizationSql())
        await db.exec('COMMIT')
      } catch (error) { await db.exec('ROLLBACK;SET SESSION AUTHORIZATION postgres'); throw error }
    } else { await db.exec(compileExternalReadSql()); await db.exec(compileExternalAuthBridgeSql()) }
    const binding: ExternalReadQualification = parseExternalReadQualification({ operation: EXTERNAL_READ_QUALIFICATION, qualificationId: randomUUID(), institutionalApprovalId: randomUUID(), organizationId: org,
      representativeUserId: recipient, representativeOrganizationId: representativeOrg, representedMemberUserId: member, issuerUserId: actor,
      authority: { id: authorityId, representedPersonId: representedPerson, createdBy: actor, source: 'Synthetic existing authority', scope: ['view', 'documents'],
        evidenceDocumentId: null, effectiveAt: effective, expiresAt: expires },
      matter: { type: 'grievance', id: caseId, grantId: matterGrant, grantedBy: actor, grantedAt: effective, expiresAt: expires,
        permissions: { view: true, viewDocuments: true, downloadDocuments: true } },
      document: { id: documentId, grantId: documentGrant, grantedBy: actor, grantedAt: effective, expiresAt: expires, canView: true, canDownload: true,
        versionId, versionNo: 2, checksumSha256: checksum, sizeBytes: bytes.length,
        storageKeySha256: createHash('sha256').update(storageKey).digest('hex'), privacyLabel: 'team_confidential' },
      sourceInstrument: { reference: 'Synthetic explicit external assistance source', sha256: createHash('sha256').update('Synthetic source').digest('hex') },
      effectiveAt: effective, expiresAt: expires })
    const as = async <T>(who: string, work: (tx: CaseDomainDb) => Promise<T>, operator = false, overrides: { token?: string; organizationId?: string } = {}) => {
      const currentOrg = overrides.organizationId ?? ([recipient, outsider].includes(who) ? representativeOrg : org)
      const token = overrides.token ?? tokens.get(who)
      await db.exec(`SET SESSION AUTHORIZATION ${operator ? operatorLogin : runtimeLogin};BEGIN;SET LOCAL ROLE ${operator ? 'ue_v2_owner' : 'union_eyes_runtime'}`)
      try {
        await db.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)", [who, currentOrg, token ?? ''])
        const result = await work(db); await db.exec('COMMIT'); return result
      } catch (error) { await db.exec('ROLLBACK'); throw error }
      finally { await db.exec('SET SESSION AUTHORIZATION postgres;RESET ROLE') }
    }
    const deps = { memberships: membershipSourceViaDefiner }
    // These are independent SYNTHETIC actors exercising the real canonical
    // ceremony. They do not represent founder review or customer adoption.
    const actionRisk = options.actionRisk ?? 'high', actionApprovals = options.actionApprovals ?? 3
    const disclosurePower = `${EXTERNAL_READ_POWER}:${actionRisk}:${actionApprovals}`
    const ruleId = await as(drafter, tx => draftIssuanceRule(tx, deps, { organizationId: org, draftedBy: drafter,
      domain: 'executive_office', operation: 'issue', issuerCapacities: ['executive'], allowedPowers: ['approve', disclosurePower],
      maxTermDays: 1, requiresAcceptance: true, requiredIndependentApprovals: 1 }))
    const adoptionId = await as(drafter, tx => requestRuleAdoption(tx, deps, { organizationId: org, ruleId, actorUserId: drafter,
      sourceInstrument: `SYNTHETIC institution external disclosure action ${actionRisk}/${actionApprovals}; no customer activation`, namedApproverIds: adopters }))
    for (const who of adopters) await as(who, tx => recordApprovalDecision(tx, deps, { organizationId: org, approvalRequestId: adoptionId, approverUserId: who, decision: 'approved' }))
    await as(drafter, tx => activateIssuanceRule(tx, deps, { organizationId: org, ruleId, actorUserId: drafter, approvalRequestId: adoptionId }))
    const officeIds: string[] = []
    for (const who of authorizers) {
      const id = randomUUID(), input = { organizationId: org, issuerUserId: issuer, holderUserId: who, kind: 'executive_office' as const,
        powers: ['approve', disclosurePower], scope: { resourceIds: [caseId] }, sourceInstrument: `SYNTHETIC exact-case external office ${who}`,
        effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 2 * 60 * 60_000) }
      const approvalRequestId = await as(issuer, tx => requestIssuanceApproval(tx, deps, { ...input, instrumentId: id, namedApproverIds: [adopters[1]] }))
      await as(adopters[1], tx => recordApprovalDecision(tx, deps, { organizationId: org, approvalRequestId, approverUserId: adopters[1], decision: 'approved' }))
      await as(issuer, tx => issueMandate(tx, deps, { ...input, id, approvalRequestId }))
      await as(who, tx => acceptInstrument(tx, { organizationId: org, instrumentType: 'mandate', instrumentId: id, holderUserId: who }))
      officeIds.push(id)
    }
    const openInstitutional = (value = binding, threshold = actionApprovals, riskClass: 'low' | 'medium' | 'high' | 'critical' = actionRisk) => as(actor, tx => openApprovalRequest(tx, {
      id: value.institutionalApprovalId, organizationId: org, subjectType: `${EXTERNAL_READ_AUTHORIZATION}:${externalReadQualificationHash(value)}`,
      subjectId: caseId, proposedBy: actor, subjectAuthorId: member, requiredApprovals: threshold, riskClass,
      namedApproverIds: authorizers, adverseUserIds: [recipient, member],
    }))
    const approveInstitutional = (requestId = binding.institutionalApprovalId, who = authorizers[0]) => as(who, tx => recordApprovalDecision(tx, deps, {
      organizationId: org, approvalRequestId: requestId, approverUserId: who, decision: 'approved',
    }))
    const authorize = async (value = binding) => {
      await openInstitutional(value)
      for (const who of authorizers.slice(0, actionApprovals)) await approveInstitutional(value.institutionalApprovalId, who)
    }
    if (options.institutionalApproval !== false) await authorize()
    const consent = async (who = member, value = binding) => as(who, async tx => (await tx.query<{ id: string }>(
      'SELECT public.ue_external_member_consent_v1($1::jsonb,$2) AS id', [JSON.stringify(value), 'Synthetic informed consent for this exact recipient, matter, permissions and artifact'])).rows[0].id)
    const qualify = async (consentId: string, who = actor, value = binding) => as(who, async tx => (await tx.query<{ id: string }>(
      'SELECT public.ue_external_qualify_read_v1($1::jsonb,$2::uuid) AS id', [JSON.stringify(value), consentId])).rows[0].id, true)
    const read = (operation = 'matter', who = recipient, input: { org?: string; caseId?: string; documentId?: string | null; expectedHash?: string; receipt?: unknown; token?: string; actorOrg?: string } = {}) =>
      as(who, tx => tx.query<{ payload: unknown }>('SELECT payload FROM public.ue_external_resource_read_v1($1,$2,$3,$4,$5,$6)',
        [input.org ?? org, input.caseId ?? caseId, input.documentId ?? (['document', 'locate_download', 'finalize_download'].includes(operation) ? documentId : null),
          operation, input.expectedHash ?? null, input.receipt ? JSON.stringify(input.receipt) : null]), false, { token: input.token, organizationId: input.actorOrg })
    return { ...base, db, member, representativeOrg, recipient, outsider, binding, bytes, documentId, versionId, authorityId, matterGrant, documentGrant,
      as, consent, qualify, read, authorize, openInstitutional, approveInstitutional, authorizers, officeIds, ruleId, adoptionId, deps,
      installerProof: { missingPreparationDenied, missingPreparationCode, installerContext, actualVersion: (await db.query<{ version: string }>("SELECT current_setting('server_version') AS version")).rows[0].version,
        mode: options.installerSemantics ? 'prepared-restricted-owner-same-transaction' : 'trusted-operator-component-only' }, close: () => db.close() }
  } catch (error) { await db.close(); throw error }
}
