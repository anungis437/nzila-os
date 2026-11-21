/**
 * Runtime acceptance helper for the external representative read path (spec e2e/runtime/09).
 *
 * Under V2 a representative reads a matter only through ue_external_resource_read_v1, which requires the legacy authority and
 * matter grant AND the represented member's own recorded consent AND an institutional qualification of that exact payload,
 * approved by three office holders who hold the external-read power. There is NO HTTP surface for any of this (finding R-41),
 * so this script performs the real chain directly, every step through the shipped kernel or database function in the canonical
 * session of the person who performs it:
 *
 *   seed            adopt the office rule, issue three external-read offices, scope the matter to a chief steward who assigns
 *                   a steward, record a view-only authority and grant, open and approve the institutional authorization, then
 *                   the member consents and the steward qualifies the exact payload (owner role, as the reader contract requires)
 *   revoke          the union's assigned steward revokes the live qualification
 *   expire          a fresh read whose matter grant term ends within seconds; the script waits for it to end
 *   authority-lapse a fresh read whose authority term ends within seconds while the grant's runs on; the script waits
 *
 * A qualified legacy authority or grant is immutable under V2, so access ends through the reader's own revocation and terms.
 *
 * The represented member, the office holders and the stewards are SYNTHETIC people with fixed UUID principals created here
 * (the reader binds the represented member to the matter's grievant UUID, which the text-id QA people cannot satisfy). The
 * representative is the ordinary QA external counsel who signs in over HTTP. Nothing here is a counsel/WorkAid assertion or
 * evidence that access can be granted through the product.
 *
 * Dev tooling only. It refuses to run outside the owned canonical QA runtime (ownedRuntimeOperatorUrl: QA_TEST_ENV=true).
 */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import pg from 'pg'
import { ownedRuntimeOperatorUrl } from './fixture-auth'
import { setNativeBusinessContext } from './native-canonical-fixture'
import { UE_TEST_ORGS } from '@/tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'
import { DEFAULT_ISSUANCE_TEMPLATES, type IssuanceDomain } from '@/lib/authority/issuance'
import { activeMembershipSource } from '@/lib/authority/store/active-membership-source'
import { ensureCaseAuthorityScope } from '@/lib/authority/store/case-scope'
import type { SqlExecutor } from '@/lib/authority/store/executor'
import {
  acceptInstrument,
  activateIssuanceRule,
  assignCase,
  draftIssuanceRule,
  issueMandate,
  requestIssuanceApproval,
  requestRuleAdoption,
} from '@/lib/authority/store/lifecycle'
import { openApprovalRequest, recordApprovalDecision } from '@/lib/authority/store/mutations'
import {
  EXTERNAL_READ_AUTHORIZATION,
  EXTERNAL_READ_POWER,
  EXTERNAL_READ_QUALIFICATION,
  externalReadQualificationHash,
  parseExternalReadQualification,
} from '@/lib/external-resource-read/qualification'

export const EXTERNAL_MATTER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'
const MATTER_TITLE = 'Synthetic external-collaboration matter'
const fixtureMarker = 'owned synthetic external representative READ only; issuance is not qualified'
const SOURCE = `SYNTHETIC runtime external-read fixture: ${fixtureMarker}`
const OFFICE_POWERS = ['approve', `${EXTERNAL_READ_POWER}:high:3`]
const person = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const who = {
  member: person(1),
  steward: person(2),
  chief: person(3),
  drafter: person(4),
  adopterOne: person(5),
  adopterTwo: person(6),
  issuer: person(7),
  authorizers: [person(8), person(9), person(10)],
} as const
const roles: Array<[string, string]> = [
  [who.member, 'member'],
  [who.steward, 'steward'],
  [who.chief, 'chief_steward'],
  ...[who.drafter, who.adopterOne, who.adopterTwo, who.issuer, ...who.authorizers].map((id): [string, string] => [id, 'president']),
]
const deps = { memberships: activeMembershipSource }
const port = (client: pg.PoolClient): SqlExecutor => ({
  query: async <T>(text: string, params?: unknown[]) => ({ rows: (await client.query(text, params)).rows as T[] }),
})

async function main(): Promise<void> {
  const url = ownedRuntimeOperatorUrl()
  const runtimeUrl = process.env.UE_RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL
  assert.ok(runtimeUrl && new URL(runtimeUrl).username === 'ue_runtime_web', 'Restricted fixture runtime credential required')
  assert.ok(process.env.AUTH_DATABASE_URL, 'The owned auth gateway is required to issue the fixture sessions')
  const command = process.argv[2]
  if (!['seed', 'revoke', 'expire', 'authority-lapse'].includes(command))
    throw new Error('usage: seed | revoke | expire | authority-lapse')
  const org = UE_TEST_ORGS.primary.id
  const representative = UE_TEST_USERS.externalCounsel
  const operator = new pg.Client({ connectionString: url })
  const runtimePool = new pg.Pool({ connectionString: runtimeUrl, max: 2 })
  const ownerPool = new pg.Pool({ connectionString: url, max: 1 })
  const { withAuthContext } = await import('../../../../packages/platform-auth/src/auth-db')
  const { createSession, revokeSession } = await import('../../../../packages/platform-auth/src/password/session')
  const { withBearerOrgBinding } = await import('../../../../packages/platform-auth/src/org-binding')
  const issued: Array<{ userId: string; sessionId: string }> = []
  const tokens = new Map<string, string>()
  /** One canonical session per synthetic person, the work bound to it on the restricted runtime (or owner) role. */
  const as = async <T>(userId: string, work: (exec: SqlExecutor) => Promise<T>, owner = false): Promise<T> => {
    let token = tokens.get(userId)
    if (!token) {
      const session = await withAuthContext({ phase: 'identity', userId }, () => createSession({ userId, organizationId: org }))
      issued.push({ userId, sessionId: session.session.sessionId })
      token = session.token
      tokens.set(userId, token)
    }
    return withBearerOrgBinding(token, { organizationId: org, expectedActorUserId: userId }, async (binding) => {
      const client = await (owner ? ownerPool : runtimePool).connect()
      try {
        await client.query('BEGIN')
        await client.query("SET LOCAL statement_timeout='30s'")
        await client.query(owner ? 'SET LOCAL ROLE ue_v2_owner' : 'SET LOCAL ROLE union_eyes_runtime')
        await setNativeBusinessContext(port(client), binding)
        const result = await work(port(client))
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      } finally {
        client.release()
      }
    })
  }
  const one = async (text: string, params: unknown[]) => (await operator.query(text, params)).rows
  /**
   * Under V2 a qualified legacy authority or grant cannot be rewritten (the reader's immutability guard, and no V2 role may update
   * those owner-held, row-secured tables). Access ends through the reader itself: the union's assigned steward revokes the live
   * qualification, or a source's own term runs out, which ends the qualification bound to it.
   */
  const revokeLive = async () => {
    const live = await one(
      `SELECT id::text FROM public.ue_external_read_qualifications WHERE organization_id=$1 AND matter_id=$2 AND recipient_user_id=$3
         AND revoked_at IS NULL AND expires_at>clock_timestamp()`,
      [org, EXTERNAL_MATTER_ID, representative.userId],
    )
    for (const row of live)
      await as(who.steward, (exec) => exec.query("SELECT public.ue_external_revoke_read_v1('qualification',$1)", [row.id]))
  }
  try {
    await operator.connect()
    if (command === 'revoke') {
      await revokeLive()
    } else {
      // People and matter: business facts only, owned by the operator.
      for (const [userId, role] of roles) {
        await operator.query(
          `INSERT INTO user_management.users (user_id,email,is_active,lifecycle_state,is_system_admin,email_verified)
           VALUES ($1,$2,true,'active',false,true) ON CONFLICT (user_id) DO NOTHING`,
          [userId, `external-fixture-${userId}@example.invalid`],
        )
        await operator.query(
          `INSERT INTO user_management.organization_users (organization_id,user_id,role,is_active) VALUES ($1,$2,$3,true)
           ON CONFLICT (user_id,organization_id) DO UPDATE SET role=EXCLUDED.role,is_active=true`,
          [org, userId, role],
        )
      }
      const prior = await one(
        'SELECT organization_id,grievant_id::text AS grievant,represented_member_user_id,title FROM public.grievances WHERE id=$1',
        [EXTERNAL_MATTER_ID],
      )
      if (prior.some((row) => row.organization_id !== org || row.grievant !== who.member || row.represented_member_user_id !== who.member || row.title !== MATTER_TITLE))
        throw new Error('Existing external fixture matter provenance differs')
      if (!prior.length)
        await operator.query(
          `INSERT INTO public.grievances (id,organization_id,grievance_number,type,title,description,status,priority,filed_date,created_at,updated_at,
             grievant_id,represented_member_user_id,created_by,has_legal_implications,is_arbitration_eligible,is_confidential,is_group_grievance)
           VALUES ($1,$2,'QA-EXT-0001','individual',$3,'PRIVATE internal description that must not reach representative','filed','medium',
             now(),now(),now(),$4::uuid,$4,$4,false,false,false,false)`,
          [EXTERNAL_MATTER_ID, org, MATTER_TITLE, who.member],
        )

      // Institution: the rules this chain needs, adopted by a drafter and two independent adopters, reused once active.
      const adopt = async (domain: IssuanceDomain, powers?: string[]) => {
        const live = await one(
          `SELECT id::text,allowed_powers FROM public.ue_authority_issuance_rules WHERE organization_id=$1 AND domain=$2 AND operation='issue' AND status='active'`,
          [org, domain],
        )
        if (live.length) {
          if (powers && !powers.every((power) => live[0].allowed_powers.includes(power)))
            throw new Error(`An active ${domain} rule without the external-read power already exists`)
          return
        }
        const template = DEFAULT_ISSUANCE_TEMPLATES.find((entry) => entry.domain === domain && entry.operation === 'issue')
        assert.ok(template, 'Current source issuance template required')
        const { rationale: _rationale, ...rule } = template
        const ruleId = await as(who.drafter, (exec) =>
          draftIssuanceRule(exec, deps, { ...rule, organizationId: org, draftedBy: who.drafter, ...(powers ? { allowedPowers: powers, maxTermDays: 1 } : {}) }),
        )
        const request = await as(who.drafter, (exec) =>
          requestRuleAdoption(exec, deps, {
            organizationId: org, ruleId, actorUserId: who.drafter,
            sourceInstrument: `${SOURCE}: ${domain}/issue`, namedApproverIds: [who.adopterOne, who.adopterTwo],
          }),
        )
        for (const adopter of [who.adopterOne, who.adopterTwo])
          await as(adopter, (exec) => recordApprovalDecision(exec, deps, { organizationId: org, approvalRequestId: request, approverUserId: adopter, decision: 'approved' }))
        await as(who.drafter, (exec) => activateIssuanceRule(exec, deps, { organizationId: org, ruleId, actorUserId: who.drafter, approvalRequestId: request }))
      }
      await adopt('executive_office', OFFICE_POWERS)
      await adopt('supervisory')
      await adopt('case_assignment')

      // Mandates: issued, independently approved and accepted; reused while comfortably live.
      const issue = async (holder: string, kind: 'executive_office' | 'supervisory', powers: string[], scope: Record<string, unknown>) => {
        const live = await one(
          `SELECT 1 FROM public.ue_authority_mandates m WHERE m.organization_id=$1 AND m.principal_user_id=$2 AND m.kind=$3 AND m.status='active'
             AND m.revoked_at IS NULL AND m.expires_at>now()+interval '15 minutes' AND m.powers @> $4::text[] AND m.scope @> $5::jsonb
             AND EXISTS (SELECT 1 FROM public.ue_authority_acceptances a WHERE a.instrument_id=m.id AND a.accepted_by=m.principal_user_id)`,
          [org, holder, kind, powers, JSON.stringify(scope)],
        )
        if (live.length) return
        const id = randomUUID()
        const grant = {
          organizationId: org, issuerUserId: who.issuer, holderUserId: holder, kind, powers, scope,
          sourceInstrument: `${SOURCE}: ${kind} ${id}`,
          effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
        }
        const approval = await as(who.issuer, (exec) =>
          requestIssuanceApproval(exec, deps, { ...grant, instrumentId: id, namedApproverIds: [who.adopterTwo] }),
        )
        await as(who.adopterTwo, (exec) =>
          recordApprovalDecision(exec, deps, { organizationId: org, approvalRequestId: approval, approverUserId: who.adopterTwo, decision: 'approved' }),
        )
        await as(who.issuer, (exec) => issueMandate(exec, deps, { ...grant, id, approvalRequestId: approval }))
        await as(holder, (exec) => acceptInstrument(exec, { organizationId: org, instrumentType: 'mandate', instrumentId: id, holderUserId: holder }))
      }
      // The office-validity check requires each office to cover this exact matter.
      for (const authorizer of who.authorizers) await issue(authorizer, 'executive_office', OFFICE_POWERS, { resourceIds: [EXTERNAL_MATTER_ID] })
      await issue(who.chief, 'supervisory', ['read', 'assign', 'monitor'], { resourceIds: [EXTERNAL_MATTER_ID] })
      await as(who.chief, (exec) => ensureCaseAuthorityScope(exec, deps, { organizationId: org, caseId: EXTERNAL_MATTER_ID, actorUserId: who.chief }))
      const assigned = await one(
        `SELECT 1 FROM public.ue_authority_resource_relationships WHERE organization_id=$1 AND resource_type='case' AND resource_id=$2
           AND principal_user_id=$3 AND relation='assignee' AND status='active' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()+interval '15 minutes')`,
        [org, EXTERNAL_MATTER_ID, who.steward],
      )
      if (!assigned.length)
        await as(who.chief, (exec) =>
          assignCase(exec, deps, {
            organizationId: org, issuerUserId: who.chief, caseId: EXTERNAL_MATTER_ID, assigneeUserId: who.steward,
            permissions: ['read', 'read_internal'],
            effectiveAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
          }),
        )

      // A fresh read lifecycle: the live qualification is revoked, then new sources are recorded. 'expire' and 'authority-lapse'
      // record a matter grant or an authority whose own term ends within seconds, and wait for it to end.
      await revokeLive()
      const SHORT_MS = 4_000, HOUR_MS = 60 * 60_000
      const authorityTtl = command === 'authority-lapse' ? SHORT_MS : HOUR_MS
      const grantTtl = command === 'expire' ? SHORT_MS : HOUR_MS
      const authorityId = randomUUID(), grantId = randomUUID()
      // One clock reading for every term: separate Date.now() calls let an equal-TTL grant end a millisecond after its
      // authority, and the qualification (bounded by both) is then refused as exceeding its source term.
      const now = Date.now()
      const effectiveAt = new Date(now - 60_000).toISOString()
      const authorityExpires = new Date(now + authorityTtl).toISOString()
      const grantExpires = new Date(now + grantTtl).toISOString()
      const expiresAt = new Date(now + Math.min(authorityTtl, grantTtl)).toISOString()
      await operator.query(
        `INSERT INTO public.representation_authorities (id,organization_id,matter_type,matter_id,represented_person_id,representative_user_id,
           representative_organization_id,scope,source,status,effective_at,expires_at,created_by,created_at,updated_at)
         VALUES ($1,$2,'grievance',$3,$4::uuid,$5,$6,ARRAY['view'],$7,'active',$8,$9,$10,now(),now())`,
        [authorityId, org, EXTERNAL_MATTER_ID, who.member, representative.userId, representative.orgId, SOURCE, effectiveAt, authorityExpires, who.steward],
      )
      await operator.query(
        `INSERT INTO public.external_matter_access_grants (id,authority_id,organization_id,matter_type,matter_id,user_id,representative_organization_id,
           status,can_view,can_comment,can_upload_documents,can_view_documents,can_download_documents,granted_by,granted_at,expires_at,updated_at)
         VALUES ($1,$2,$3,'grievance',$4,$5,$6,'active',true,false,false,false,false,$7,$8,$9,now())`,
        [grantId, authorityId, org, EXTERNAL_MATTER_ID, representative.userId, representative.orgId, who.steward, effectiveAt, grantExpires],
      )

      // The exact payload, its institutional authorization, the member's consent, then the steward's qualification.
      const binding = parseExternalReadQualification({
        operation: EXTERNAL_READ_QUALIFICATION, qualificationId: randomUUID(), institutionalApprovalId: randomUUID(), organizationId: org,
        representativeUserId: representative.userId, representativeOrganizationId: representative.orgId,
        representedMemberUserId: who.member, issuerUserId: who.steward,
        authority: { id: authorityId, representedPersonId: who.member, createdBy: who.steward, source: SOURCE, scope: ['view'],
          evidenceDocumentId: null, effectiveAt, expiresAt: authorityExpires },
        matter: { type: 'grievance', id: EXTERNAL_MATTER_ID, grantId, grantedBy: who.steward, grantedAt: effectiveAt, expiresAt: grantExpires,
          permissions: { view: true, viewDocuments: false, downloadDocuments: false } },
        document: null,
        sourceInstrument: { reference: `${SOURCE}: member review`, sha256: createHash('sha256').update(SOURCE).digest('hex') },
        effectiveAt, expiresAt,
      })
      const request = await as(who.steward, (exec) =>
        openApprovalRequest(exec, {
          id: binding.institutionalApprovalId, organizationId: org,
          subjectType: `${EXTERNAL_READ_AUTHORIZATION}:${externalReadQualificationHash(binding)}`, subjectId: EXTERNAL_MATTER_ID,
          proposedBy: who.steward, subjectAuthorId: who.member, requiredApprovals: 3, riskClass: 'high',
          namedApproverIds: [...who.authorizers], adverseUserIds: [who.member, representative.userId],
        }),
      )
      for (const authorizer of who.authorizers)
        await as(authorizer, (exec) =>
          recordApprovalDecision(exec, deps, { organizationId: org, approvalRequestId: request, approverUserId: authorizer, decision: 'approved' }),
        )
      const consent = await as(who.member, async (exec) =>
        (await exec.query<{ id: string }>('SELECT public.ue_external_member_consent_v1($1,$2) AS id', [
          JSON.stringify(binding), 'SYNTHETIC informed exact-recipient, matter, payload and term consent',
        ])).rows[0].id,
      )
      await as(who.steward, (exec) =>
        exec.query('SELECT public.ue_external_qualify_read_v1($1,$2) AS id', [JSON.stringify(binding), consent]), true)
      if (command !== 'seed') await new Promise((resolve) => setTimeout(resolve, Math.max(0, Date.parse(expiresAt) - Date.now()) + 1_500))
    }
    console.log('Committed owned synthetic external representative fixture operation:', command)
  } finally {
    for (const { userId, sessionId } of issued)
      await withAuthContext({ phase: 'identity', userId }, () => revokeSession(sessionId)).catch(() => undefined)
    await Promise.allSettled([runtimePool.end(), ownerPool.end(), operator.end()])
    const { closeAuthClients } = await import('../../../../packages/db/src/auth-client')
    await closeAuthClients().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('Owned external fixture operation failed', { name: error?.name, code: error?.code })
  process.exit(1)
})
