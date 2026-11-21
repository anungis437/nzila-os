/** Real combined-schema PostgreSQL regression. Session/HTTP validation is qualified separately. */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { RLSTx } from '@/lib/db/with-rls-context'
import type { PrivacyIdentity } from '@/lib/privacy/request-contract'

vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
// The existing notification helper reads only recipient flags through the harness's real system role.
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const { createPrivacyRequest, getPrivacyRequest, getPrivacyConversation, respondToPrivacyRequest, acknowledgePrivacyRequest, preparePrivacyAccountExport } = await import('@/lib/privacy/requests')
const { assignThread } = await import('@/lib/messaging/thread-assignment')
const URL = process.env.UE_AUTHORITY_COMBINED_URL
const org = randomUUID()
const foreign = randomUUID()
const user: PrivacyIdentity = { organizationId: org, userId: 'privacy-subject-' + randomUUID() }
const handler: PrivacyIdentity = { organizationId: org, userId: 'privacy-handler-' + randomUUID() }
const other: PrivacyIdentity = { organizationId: org, userId: 'privacy-stranger-' + randomUUID() }
const as = <T,>(actor: PrivacyIdentity, work: (tx: RLSTx) => Promise<T>) =>
  harness.tenant(RUNTIME_ROLE, actor.organizationId, actor.userId, tx => work(tx as unknown as RLSTx))
let admin: pg.Client
async function make() {
  return as(user, tx => createPrivacyRequest(tx, user, { requestType: 'access', scopes: ['account_profile'], description: 'Provide my controlled synthetic account data.', clientRequestId: randomUUID() }))
}
async function assign(threadId: string) {
  expect((await as(handler, tx => assignThread(tx, handler, { threadId, action: 'assign', toStaffId: handler.userId }, { assigneeEligible: async () => true }))).kind).toBe('ok')
}
const verify = (threadId: string) => as(handler, tx => respondToPrivacyRequest(tx, handler, threadId, {
  action: 'verify_identity', body: 'Controlled identity reviewed.', verificationBasis: 'authenticated_account_reviewed',
  coveredScopes: [], exemptions: [], expectedResponseId: null, clientRequestId: randomUUID(),
}))

describe.skipIf(!URL)('privacy requests on real PostgreSQL and installed runtime grants', () => {
  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const id of [org, foreign]) await admin.query(`INSERT INTO organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,member_count,active_member_count,settings,features_enabled,status,created_at,updated_at,remittance_day)
      VALUES($1,'Privacy regression',$2,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`, [id, 'privacy-' + id])
    await admin.query("INSERT INTO organization_members(organization_id,user_id,role,status,name,email) VALUES($1,$2,'steward','active','Synthetic privacy handler','privacy-handler@example.test')", [org, handler.userId])
    await admin.query(`INSERT INTO triage_designations(organization_id,scope,user_id,granted_by,granted_at,expires_at)
      VALUES($1,'messages',$2,'native-test',now()-interval '1 day',now()+interval '1 day')`, [org, handler.userId])
    await harness.setRole(user.userId, org, 'member')
    await harness.setRole(handler.userId, org, 'steward')
    await harness.setRole(other.userId, org, 'member')
    // The subject also belongs to the foreign organization: acting there, with a live session, still reads nothing of org's request.
    await harness.setRole(user.userId, foreign, 'member')
  }, 60_000)
  afterAll(async () => { await admin?.end(); await harness.stop() })

  it('persists a self-owned request using the installed physical columns and only the runtime role', async () => {
    const made = await make()
    expect(await as(user, tx => getPrivacyRequest(tx, user, made.request.id))).toMatchObject({ stage: 'received', status: 'pending' })
    expect(await as(other, tx => getPrivacyRequest(tx, other, made.request.id))).toBeNull()
    expect(await as({ ...user, organizationId: foreign }, tx => getPrivacyRequest(tx, { ...user, organizationId: foreign }, made.request.id))).toBeNull()
  })

  it('rolls back the request and initial private conversation if the mandatory audit boundary refuses', async () => {
    const nonce = randomUUID()
    harness.failNextAudit()
    await expect(as(user, tx => createPrivacyRequest(tx, user, { requestType: 'access', scopes: ['account_profile'], description: 'Audit refusal must not create a receipt.', clientRequestId: nonce }))).rejects.toThrow('audit sink unavailable')
    expect((await admin.query("SELECT id FROM gdpr_data_requests WHERE request_details->>'clientRequestId'=$1", [nonce])).rows).toHaveLength(0)
    expect((await admin.query("SELECT id FROM messages WHERE metadata::jsonb->>'clientRequestId'=$1", [nonce])).rows).toHaveLength(0)
  })

  it('serializes upper/lower-case identifiers on the same lock, rejecting one simultaneous stale response', async () => {
    const made = await make()
    await assign(made.request.threadId)
    const outcomes = await Promise.allSettled([verify(made.request.threadId), verify(made.request.threadId.toUpperCase())])
    expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    const rejected = outcomes.find(row => row.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ kind: 'stale' })
    expect((await as(user, tx => getPrivacyRequest(tx, user, made.request.id)))?.responses).toHaveLength(1)
    expect(await as(handler, tx => getPrivacyRequest(tx, handler, made.request.id))).toBeNull()
  })

  it('completes only after a matching export and requester acknowledgement, and retains the conversation', async () => {
    const made = await make()
    await assign(made.request.threadId)
    const checked = await verify(made.request.threadId)
    const reply = await as(handler, tx => respondToPrivacyRequest(tx, handler, made.request.threadId, {
      action: 'respond', body: 'The requested account information is available.', coveredScopes: ['account_profile'], exemptions: [],
      expectedResponseId: checked.id, clientRequestId: randomUUID(),
    }))
    const profile = { ...user, email: 'synthetic@example.test', firstName: 'Synthetic', lastName: 'Account' }
    const exported = await as(user, tx => preparePrivacyAccountExport(tx, user, made.request.id, profile, reply.id))
    expect(JSON.parse(exported.bytes).data).toEqual({ accountProfile: profile })
    expect(await as(user, tx => acknowledgePrivacyRequest(tx, user, made.request.id, {
      action: 'acknowledge', expectedResponseId: reply.id, exportSha256: exported.sha256,
    }))).toMatchObject({ status: 'completed' })
    expect(await as(handler, tx => getPrivacyConversation(tx, handler, made.request.threadId))).toMatchObject({ open: false, canRespond: false })
    expect((await admin.query('SELECT id FROM messages WHERE thread_id=$1', [made.request.threadId])).rows.length).toBe(3)
  })
})
