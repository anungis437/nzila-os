/**
 * Union-side WorkAid consent and disclosure (register UE-CONV-G-002) against the COMBINED deployed schema (Django
 * `migrate` + the approved Drizzle bootstrap), with the real store code running as the runtime role under forced
 * row-level security and the exact grants the storage-authority manifest activates. Nothing is mirrored.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a FRESH disposable database (authority
 * records are append-only). The suite installs a fault trigger on `public.audit_logs` of that database. The wording
 * used is a TEST FIXTURE, not approved legal text. No counsel-side issuer exists in the repository, so the counsel
 * read path is not exercised here; counsel-side activation and key custody (UE-CONV-G-003) remain external gates.
 */
import { createHash } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ORG, ORG_B, newUuid, seedMembership, seedUser, U, type Db } from './authority-kernel-harness'
import { daysAhead, kit, minutesAgo } from './authority-kernel-testkit'
import { insertRelationship } from '../../lib/authority/store/mutations'
import { membershipSourceVia } from '../../lib/authority/store/identity'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import {
  authoriseWorkAidDocument,
  createWorkAidShare,
  grantWorkAidConsent,
  listMemberWorkAidConsents,
  loadCurrentConsentText,
  recordConsentText,
  referMatterToWorkAid,
  revokeWorkAidConsent,
} from '../../lib/authority/store/workaid-disclosure'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const adapt = (c: pg.Client): Db => ({ exec: (sql) => c.query(sql), query: (sql, params) => c.query(sql, params as unknown[]) as never })

const BODY = 'TEST FIXTURE WORDING ONLY (not approved legal text): I consent to the union sharing the listed categories with WorkAid counsel.'
const SHA = createHash('sha256').update(BODY, 'utf8').digest('hex')

describe.skipIf(!URL)('union-side WorkAid disclosure on the combined deployed schema, as the runtime role', () => {
  let admin: pg.Client
  let runtime: pg.Client
  let identityReader: pg.Client
  let k: ReturnType<typeof kit>

  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows
  const count = async (table: string, where = 'true', params: unknown[] = []) => Number((await rows(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params))[0].n)
  const audits = (action: string) => count('public.audit_logs', 'action = $1 AND organization_id = $2', [`authority.workaid.${action}`, ORG])

  const newCase = async (creator: string = U.member) => {
    const id = newUuid()
    await admin.query(
      `INSERT INTO grievances (id, organization_id, created_by, created_at, updated_at, has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance, priority, status)
       VALUES ($1,$2,$3, now(), now(), false, false, false, false, 'medium', 'open')`,
      [id, ORG, creator],
    )
    return id
  }
  const addDoc = async (caseId: string, uploadedBy: string = U.member) => {
    const id = newUuid()
    await admin.query(
      `INSERT INTO documents (id, created_at, updated_at, organization_id, uploaded_by, access_level, contains_legal_privilege, contains_medical_sensitive, contains_pii, is_confidential, privacy_label, status)
       VALUES ($1, now(), now(), $2, $3, 'team', false, false, false, false, 'team_confidential', 'active')`,
      [id, ORG, uploadedBy],
    )
    await admin.query(`INSERT INTO document_links (organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES ($1,$2,'grievance',$3,$4)`, [ORG, id, caseId, uploadedBy])
    return id
  }
  const newRep = async (caseId: string) => {
    const user = `user_wa_rep_${newUuid().slice(0, 8)}`
    await seedMembership(adapt(admin), user, ORG, 'steward')
    await k.as(U.president)((t) =>
      insertRelationship(t, { organizationId: ORG, principalUserId: user, resourceType: 'case', resourceId: caseId, relation: 'assignee', origin: 'derived', effectiveAt: minutesAgo() }),
    )
    return user
  }
  const grant = (caseId: string, member: string = U.member, org = ORG) =>
    k.as(member, org)((t) =>
      grantWorkAidConsent(t, k.deps, {
        organizationId: org, memberUserId: member, caseId, categories: ['case_summary', 'documents'], purpose: 'WSIB representation',
        textVersion: 'v1', acknowledgedTextSha256: SHA, expiresAt: daysAhead(30),
      }),
    )
  const failAudit = (action: string) => admin.query(`INSERT INTO ue_wa_audit_faults(action) VALUES ($1) ON CONFLICT DO NOTHING`, [`authority.workaid.${action}`])
  const clearFaults = () => admin.query(`DELETE FROM ue_wa_audit_faults`)
  const snapshot = async () => ({
    consents: await count('ue_authority_disclosure_consents'),
    grants: await count('ue_authority_workaid_consent_grants'),
    matters: await count('ue_authority_workaid_matters'),
    auths: await count('ue_authority_workaid_document_auths'),
    shares: await count('ue_authority_workaid_shares'),
    events: await count('ue_authority_events'),
    audits: await count('public.audit_logs'),
  })

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    const d = adapt(admin)
    for (const [org, slug] of [[ORG, 'wa-native-a'], [ORG_B, 'wa-native-b']]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`,
        [org, slug, slug],
      )
    }
    const roles: Record<string, string> = { [U.president]: 'president', [U.vp]: 'vice_president', [U.treasurer]: 'secretary_treasurer', [U.steward]: 'steward', [U.member]: 'member', [U.member2]: 'member' }
    for (const [u, r] of Object.entries(roles)) await seedMembership(d, u, ORG, r)
    await seedUser(d, 'user_wa_other_org')
    await seedMembership(d, 'user_wa_other_org', ORG_B, 'member')
    runtime = new pg.Client({ connectionString: URL })
    await runtime.connect()
    await runtime.query('SET ROLE union_eyes_runtime')
    identityReader = new pg.Client({ connectionString: URL })
    await identityReader.connect()
    await identityReader.query('SET ROLE union_eyes_system')
    k = kit(adapt(runtime), membershipSourceVia(identityReader as unknown as SqlExecutor))
    await k.adoptDefaultRules()
    await k.grantOffice(U.vp, U.president, U.treasurer)

    await admin.query(`CREATE TABLE IF NOT EXISTS ue_wa_audit_faults (action text PRIMARY KEY)`)
    await admin.query(`GRANT SELECT ON ue_wa_audit_faults TO PUBLIC`)
    await admin.query(`CREATE OR REPLACE FUNCTION ue_wa_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS (SELECT 1 FROM ue_wa_audit_faults WHERE action = NEW.action) THEN RAISE EXCEPTION 'injected audit fault'; END IF; RETURN NEW; END $$`)
    await admin.query(`DROP TRIGGER IF EXISTS ue_wa_audit_fault_trg ON public.audit_logs`)
    await admin.query(`CREATE TRIGGER ue_wa_audit_fault_trg BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION ue_wa_audit_fault()`)
  }, 240_000)

  afterAll(async () => {
    await runtime?.end().catch(() => undefined)
    await identityReader?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('refuses consent while no institutional wording is recorded, and only an executive with a live office mandate may record it', async () => {
    const c = await newCase()
    await expect(grant(c)).rejects.toThrow(/CONSENT_TEXT_UNAVAILABLE/)
    expect(await k.as(U.member)((t) => loadCurrentConsentText(t, ORG))).toBeNull()
    const record = (user: string) => k.as(user)((t) => recordConsentText(t, k.deps, { organizationId: ORG, recorderUserId: user, version: 'v1', body: BODY, effectiveAt: minutesAgo(5) }))
    await expect(record(U.steward)).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    await expect(record(U.president)).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    await record(U.vp)
    expect(await k.as(U.member)((t) => loadCurrentConsentText(t, ORG))).toMatchObject({ version: 'v1', bodySha256: SHA })
    expect(await audits('consent_text_record')).toBe(1)
  })

  it('consent → referral → document authorisation → share, as the runtime role, each step audited', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    const doc = await addDoc(c)
    const { consentId, matterId } = await grant(c)
    expect(await audits('consent_grant')).toBeGreaterThan(0)
    expect((await rows(`SELECT member_user_id, case_id::text AS case_id FROM ue_authority_workaid_consent_grants WHERE consent_id = $1`, [consentId]))[0]).toEqual({ member_user_id: U.member, case_id: c })
    await expect(grant(c)).rejects.toThrow(/CASE_ALREADY_REFERRED/)
    await expect(grant(c, U.member2)).rejects.toThrow(/CASE_NOT_OWNED_BY_MEMBER/)

    await expect(k.as(U.steward)((t) => referMatterToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: U.steward, matterId }))).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/)
    expect(await k.as(rep)((t) => referMatterToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: rep, matterId }))).toEqual({ matterId })
    expect(await audits('refer')).toBeGreaterThan(0)

    await expect(k.as(rep)((t) => authoriseWorkAidDocument(t, k.deps, { organizationId: ORG, memberUserId: rep, matterId, documentId: doc }))).rejects.toThrow(/NOT_THE_CONSENTING_MEMBER/)
    const authId = await k.as(U.member)((t) => authoriseWorkAidDocument(t, k.deps, { organizationId: ORG, memberUserId: U.member, matterId, documentId: doc }))
    const unionFile = await addDoc(c, U.steward)
    await expect(k.as(U.member)((t) => authoriseWorkAidDocument(t, k.deps, { organizationId: ORG, memberUserId: U.member, matterId, documentId: unionFile }))).rejects.toThrow(/DOCUMENT_NOT_SHAREABLE/)

    await expect(k.as(rep)((t) => createWorkAidShare(t, k.deps, { organizationId: ORG, actorUserId: rep, matterId, categories: ['case_timeline'], confirm: true }))).rejects.toThrow(/CONSENT_SCOPE_EXCEEDED/)
    const ids = await k.as(rep)((t) => createWorkAidShare(t, k.deps, { organizationId: ORG, actorUserId: rep, matterId, categories: ['case_summary'], documentAuthorisationIds: [authId], confirm: true }))
    expect(ids).toHaveLength(2)

    // Revocation by the member cascades atomically; nobody else may revoke.
    await expect(k.as(rep)((t) => revokeWorkAidConsent(t, k.deps, { organizationId: ORG, revokerUserId: rep, consentId }))).rejects.toThrow(/NOT_THE_CONSENTING_MEMBER/)
    expect(await k.as(U.member)((t) => revokeWorkAidConsent(t, k.deps, { organizationId: ORG, revokerUserId: U.member, consentId }))).toEqual({ documentAuthorisationsRevoked: 1, sharesInvalidated: 2, referralWithdrawn: true })
    expect(await count('ue_authority_workaid_shares', 'matter_id = $1 AND invalidated_at IS NULL', [matterId])).toBe(0)
    expect(await count('ue_authority_workaid_document_auths', 'matter_id = $1 AND revoked_at IS NULL', [matterId])).toBe(0)
    await expect(k.as(U.member)((t) => revokeWorkAidConsent(t, k.deps, { organizationId: ORG, revokerUserId: U.member, consentId }))).rejects.toThrow(/already withdrawn/)
    const mine = await k.as(U.member)((t) => listMemberWorkAidConsents(t, k.deps, { organizationId: ORG, memberUserId: U.member }))
    expect(mine.find((x) => x.consentId === consentId)).toBeDefined()
  })

  it('each step rolls back with its audit record when the audit cannot be written', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    const doc = await addDoc(c)
    let s = await snapshot()
    await failAudit('consent_grant')
    await expect(grant(c)).rejects.toThrow(/injected audit fault/)
    await clearFaults()
    expect(await snapshot()).toEqual(s)
    const { consentId, matterId } = await grant(c)

    s = await snapshot()
    await failAudit('refer')
    await expect(k.as(rep)((t) => referMatterToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: rep, matterId }))).rejects.toThrow(/injected audit fault/)
    await clearFaults()
    expect(await snapshot()).toEqual(s)
    await k.as(rep)((t) => referMatterToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: rep, matterId }))

    s = await snapshot()
    await failAudit('document_authorise')
    await expect(k.as(U.member)((t) => authoriseWorkAidDocument(t, k.deps, { organizationId: ORG, memberUserId: U.member, matterId, documentId: doc }))).rejects.toThrow(/injected audit fault/)
    await clearFaults()
    expect(await snapshot()).toEqual(s)
    const authId = await k.as(U.member)((t) => authoriseWorkAidDocument(t, k.deps, { organizationId: ORG, memberUserId: U.member, matterId, documentId: doc }))

    s = await snapshot()
    await failAudit('share_create')
    await expect(k.as(rep)((t) => createWorkAidShare(t, k.deps, { organizationId: ORG, actorUserId: rep, matterId, categories: ['case_summary'], documentAuthorisationIds: [authId], confirm: true }))).rejects.toThrow(/injected audit fault/)
    await clearFaults()
    expect(await snapshot()).toEqual(s)
    await k.as(rep)((t) => createWorkAidShare(t, k.deps, { organizationId: ORG, actorUserId: rep, matterId, categories: ['case_summary'], documentAuthorisationIds: [authId], confirm: true }))

    // A half-applied revocation must not cut anything: the consent, authorisations and shares all stay live.
    s = await snapshot()
    await failAudit('consent_revoke')
    await expect(k.as(U.member)((t) => revokeWorkAidConsent(t, k.deps, { organizationId: ORG, revokerUserId: U.member, consentId }))).rejects.toThrow(/injected audit fault/)
    await clearFaults()
    expect(await snapshot()).toEqual(s)
    expect(await count('ue_authority_workaid_shares', 'matter_id = $1 AND invalidated_at IS NULL', [matterId])).toBe(2)
  })

  it('refuses raw mutation, deletion and unaudited revocation from the runtime role', async () => {
    const c = await newCase()
    const { consentId, matterId } = await grant(c)
    await expect(k.as(U.member)((t) => t.query(`DELETE FROM ue_authority_workaid_consent_grants WHERE consent_id = $1`, [consentId]))).rejects.toThrow(/permission denied|append-only/)
    await expect(k.as(U.member)((t) => t.query(`TRUNCATE ue_authority_workaid_shares`))).rejects.toThrow(/permission denied/)
    await expect(k.as(U.member)((t) => t.query(`UPDATE ue_authority_workaid_consent_grants SET text_version = 'v9' WHERE consent_id = $1`, [consentId]))).rejects.toThrow(/permission denied|append-only|not permitted/)
    await expect(
      k.as(U.member)((t) => t.query(`UPDATE ue_authority_disclosure_consents SET revoked_at = now(), revoked_by = $2 WHERE matter_id = $1`, [matterId, U.member])),
    ).rejects.toThrow(/AUDIT_LINK_MISSING/)
    expect(await count('ue_authority_disclosure_consents', 'matter_id = $1 AND revoked_at IS NULL', [matterId])).toBe(1)
  })

  it('another organization sees none of the WorkAid records and cannot act on them', async () => {
    const c = await newCase()
    const { consentId, matterId } = await grant(c)
    for (const table of ['ue_authority_workaid_consent_grants', 'ue_authority_workaid_consent_texts', 'ue_authority_workaid_document_auths', 'ue_authority_workaid_shares', 'ue_authority_workaid_counsel_access']) {
      expect(Number((await k.as('user_wa_other_org', ORG_B)((t) => t.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`))).rows[0].n), table).toBe(0)
    }
    await expect(k.as('user_wa_other_org', ORG_B)((t) => revokeWorkAidConsent(t, k.deps, { organizationId: ORG_B, revokerUserId: 'user_wa_other_org', consentId }))).rejects.toThrow()
    await expect(k.as('user_wa_other_org', ORG_B)((t) => referMatterToWorkAid(t, k.deps, { organizationId: ORG_B, referrerUserId: 'user_wa_other_org', matterId }))).rejects.toThrow()
    await expect(k.as('user_wa_other_org', ORG_B)((t) => grantWorkAidConsent(t, k.deps, { organizationId: ORG_B, memberUserId: 'user_wa_other_org', caseId: c, categories: ['case_summary'], purpose: 'x', textVersion: 'v1', acknowledgedTextSha256: SHA, expiresAt: daysAhead(5) }))).rejects.toThrow()
    expect(await count('ue_authority_disclosure_consents', 'matter_id = $1 AND revoked_at IS NULL', [matterId])).toBe(1)
  })
})
