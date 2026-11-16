import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { privacyTestDatabase } from './__tests__/privacy-test-database'
import { privacyRequestViewSchema, privacyConversationViewSchema, type PrivacyIdentity } from './request-contract'
import {
  createPrivacyRequest, listPrivacyRequests, getPrivacyRequest, getPrivacyConversation, respondToPrivacyRequest,
  acknowledgePrivacyRequest, preparePrivacyAccountExport, replyToPrivacyConversation,
} from './requests'
import { assignThread } from '@/lib/messaging/thread-assignment'
import { changeThreadLifecycle } from '@/lib/messaging/thread-lifecycle'

const noticeAllowed = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@/lib/notifications/in-app-preferences', () => ({ inAppNoticeAllowed: noticeAllowed }))
beforeEach(() => { noticeAllowed.mockReset(); noticeAllowed.mockResolvedValue(true) })

const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const staff: PrivacyIdentity = { userId: 'privacy-handler', organizationId: org }
const otherStaff: PrivacyIdentity = { userId: 'other-handler', organizationId: org }
const subject = (): PrivacyIdentity => ({ userId: 'subject-' + randomUUID(), organizationId: org })
let fixture: Awaited<ReturnType<typeof privacyTestDatabase>>
beforeAll(async () => {
  fixture = await privacyTestDatabase()
  await fixture.owner(async () => {
    for (const user of [staff.userId, otherStaff.userId]) await fixture.pg.query(
      "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'steward')", [org, user])
    await fixture.pg.query(`INSERT INTO triage_designations(organization_id,scope,user_id,granted_by,granted_at,expires_at)
      VALUES($1,'messages',$2,'test-fixture',now()-interval '1 day',now()+interval '10 days')`, [org, staff.userId])
  })
})
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs() })

const create = (actor = subject(), options: Partial<Parameters<typeof createPrivacyRequest>[2]> = {}) => {
  const input = { requestType: 'access' as const, scopes: ['account_profile' as const], description: 'Please provide my account information.', clientRequestId: randomUUID(), ...options }
  return fixture.as(actor, async tx => ({ actor, input, ...(await createPrivacyRequest(tx, actor, input)) }))
}
async function assigned() {
  const made = await create()
  const outcome = await fixture.as(staff, tx => assignThread(tx, staff, { threadId: made.request.threadId, action: 'assign', toStaffId: staff.userId }, { assigneeEligible: async () => true }))
  expect(outcome.kind).toBe('ok')
  return made
}
async function response(threadId: string, action: 'verify_identity' | 'respond' | 'refuse' | 'clarify', expectedResponseId: string | null, actor = staff) {
  return fixture.as(actor, tx => respondToPrivacyRequest(tx, actor, threadId, {
    action, body: 'Reviewed and recorded response for this request.', expectedResponseId, clientRequestId: randomUUID(),
    coveredScopes: action === 'respond' ? ['account_profile'] : [], exemptions: [],
    ...(action === 'verify_identity' ? { verificationBasis: 'authenticated_account_reviewed' as const } : {}),
  }))
}
async function reviewed() {
  const made = await assigned()
  const verification = await response(made.request.threadId, 'verify_identity', null)
  const reply = await response(made.request.threadId, 'respond', verification.id)
  return { ...made, responseId: reply.id }
}

describe('in-app privacy requests against PostgreSQL with restricted runtime privileges', () => {
  it('persists a receipt and private conversation without claiming verification, response or completion', async () => {
    const made = await create()
    expect(privacyRequestViewSchema.parse(made.request)).toMatchObject({ status: 'pending', stage: 'received', identityReviewed: false, canExport: false, canAcknowledge: false, canCancel: true })
    const reread = await fixture.as(made.actor, tx => getPrivacyRequest(tx, made.actor, made.request.id))
    expect(reread).toMatchObject({ id: made.request.id, description: made.input.description, latestResponseId: null })
    expect(reread?.messages).toHaveLength(1)
  })

  it('deduplicates an identical create retry and rejects changed payload reuse of the nonce', async () => {
    const made = await create()
    const repeated = await fixture.as(made.actor, tx => createPrivacyRequest(tx, made.actor, made.input))
    expect(repeated).toMatchObject({ duplicate: true, request: { id: made.request.id } })
    await expect(fixture.as(made.actor, tx => createPrivacyRequest(tx, made.actor, { ...made.input, description: 'Different requested information' }))).rejects.toMatchObject({ kind: 'reused_nonce' })
    expect(await fixture.as(made.actor, tx => listPrivacyRequests(tx, made.actor))).toHaveLength(1)
  })

  it('hides another subject and another organization, including the same user in a foreign organization', async () => {
    const made = await create()
    for (const stranger of [subject(), staff, { ...made.actor, organizationId: foreign }]) {
      expect(await fixture.as(stranger, tx => getPrivacyRequest(tx, stranger, made.request.id))).toBeNull()
      expect(await fixture.as(stranger, tx => getPrivacyConversation(tx, stranger, made.request.threadId))).toBeNull()
      expect(await fixture.as(stranger, tx => listPrivacyRequests(tx, stranger))).toEqual([])
    }
    expect((await fixture.as(staff, async tx => {
      const { sql } = await import('drizzle-orm')
      return tx.execute(sql`SELECT id FROM gdpr_data_requests WHERE id=${made.request.id}::uuid`)
    })).rows).toHaveLength(0)
  })

  it('gives an assigned handler only the conversation projection, never the subject GDPR row', async () => {
    const made = await assigned()
    const view = await fixture.as(staff, tx => getPrivacyConversation(tx, staff, made.request.threadId))
    expect(privacyConversationViewSchema.parse(view)).toMatchObject({ canRespond: true, identityReviewed: false })
    expect(await fixture.as(staff, tx => getPrivacyRequest(tx, staff, made.request.id))).toBeNull()
    expect(JSON.stringify(view)).not.toContain(made.actor.userId)
    await expect(response(made.request.threadId, 'verify_identity', null, made.actor)).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('requires identity review and full requested scope before a response can be offered', async () => {
    const made = await assigned()
    await expect(response(made.request.threadId, 'respond', null)).rejects.toMatchObject({ kind: 'verification_required' })
    const verification = await response(made.request.threadId, 'verify_identity', null)
    await expect(fixture.as(staff, tx => respondToPrivacyRequest(tx, staff, made.request.threadId, {
      action: 'respond', body: 'Incomplete scope must not qualify.', coveredScopes: [], exemptions: [], expectedResponseId: verification.id, clientRequestId: randomUUID(),
    }))).rejects.toMatchObject({ kind: 'scope_incomplete' })
    const view = await fixture.as(made.actor, tx => getPrivacyRequest(tx, made.actor, made.request.id))
    expect(view).toMatchObject({ stage: 'verify_identity', canAcknowledge: false, canExport: false })
  })

  it('requires the exact latest response and checksum receipt before acknowledging an account export', async () => {
    const made = await reviewed()
    await expect(fixture.as(made.actor, tx => acknowledgePrivacyRequest(tx, made.actor, made.request.id, {
      action: 'acknowledge', expectedResponseId: randomUUID(),
    }))).rejects.toMatchObject({ kind: 'stale' })
    await expect(fixture.as(made.actor, tx => acknowledgePrivacyRequest(tx, made.actor, made.request.id, {
      action: 'acknowledge', expectedResponseId: made.responseId,
    }))).rejects.toMatchObject({ kind: 'export_required' })
    const profile = { ...made.actor, email: 'subject@example.test', firstName: 'Test', lastName: 'Subject' }
    const exported = await fixture.as(made.actor, tx => preparePrivacyAccountExport(tx, made.actor, made.request.id, profile, made.responseId))
    expect(createHash('sha256').update(exported.bytes).digest('hex')).toBe(exported.sha256)
    expect(JSON.parse(exported.bytes).data).toEqual({ accountProfile: profile })
    const done = await fixture.as(made.actor, tx => acknowledgePrivacyRequest(tx, made.actor, made.request.id, {
      action: 'acknowledge', expectedResponseId: made.responseId, exportSha256: exported.sha256,
    }))
    expect(done.status).toBe('completed')
    expect(await fixture.as(made.actor, tx => getPrivacyRequest(tx, made.actor, made.request.id))).toMatchObject({ stage: 'completed', canCancel: false, canExport: false })
    await expect(response(made.request.threadId, 'respond', made.responseId)).rejects.toMatchObject({ kind: 'closed' })
  })

  it('rejects a caller-supplied foreign profile and stale response export', async () => {
    const made = await reviewed()
    const profile = { ...made.actor, email: null, firstName: null, lastName: null }
    await expect(fixture.as(made.actor, tx => preparePrivacyAccountExport(tx, made.actor, made.request.id, { ...profile, userId: 'stranger' }, made.responseId))).rejects.toMatchObject({ kind: 'forbidden' })
    await response(made.request.threadId, 'clarify', made.responseId)
    await expect(fixture.as(made.actor, tx => preparePrivacyAccountExport(tx, made.actor, made.request.id, profile, made.responseId))).rejects.toMatchObject({ kind: 'stale' })
  })

  it('records a reasoned refusal as offered, and as rejected only after requester acknowledgement', async () => {
    const made = await assigned()
    const refused = await response(made.request.threadId, 'refuse', null)
    expect(await fixture.as(made.actor, tx => getPrivacyRequest(tx, made.actor, made.request.id))).toMatchObject({ status: 'pending', stage: 'refuse', canAcknowledge: true })
    expect(await fixture.as(made.actor, tx => acknowledgePrivacyRequest(tx, made.actor, made.request.id, { action: 'acknowledge', expectedResponseId: refused.id }))).toMatchObject({ status: 'rejected' })
  })

  it('refuses generic conversation closure, and withdrawal closes the request and conversation together', async () => {
    const made = await assigned()
    expect(await fixture.as(made.actor, tx => changeThreadLifecycle(tx, made.actor, made.request.threadId, 'close'))).toMatchObject({ kind: 'conflict', code: 'PRIVACY_WORKFLOW_REQUIRED' })
    expect(await fixture.as(made.actor, tx => acknowledgePrivacyRequest(tx, made.actor, made.request.id, { action: 'cancel', expectedResponseId: null }))).toMatchObject({ status: 'cancelled' })
    expect(await fixture.as(staff, tx => getPrivacyConversation(tx, staff, made.request.threadId))).toMatchObject({ open: false, canRespond: false })
    await expect(fixture.as(made.actor, tx => replyToPrivacyConversation(tx, made.actor, made.request.threadId, { body: 'Late clarification', clientRequestId: randomUUID() }))).rejects.toMatchObject({ kind: 'closed' })
  })

  it('removes the old handler immediately after reassignment and preserves response history', async () => {
    const made = await assigned()
    const verification = await response(made.request.threadId, 'verify_identity', null)
    const moved = await fixture.as(staff, tx => assignThread(tx, staff, { threadId: made.request.threadId, action: 'reassign', toStaffId: otherStaff.userId, reason: 'Controlled handler change' }, { assigneeEligible: async () => true }))
    expect(moved.kind).toBe('ok')
    expect(await fixture.as(staff, tx => getPrivacyConversation(tx, staff, made.request.threadId))).toBeNull()
    await expect(response(made.request.threadId, 'respond', verification.id, staff)).rejects.toMatchObject({ kind: 'not_found' })
    expect(await response(made.request.threadId, 'respond', verification.id, otherStaff)).toMatchObject({ duplicate: false })
  })

  it('rolls back the request, conversation, notification and messages when mandatory audit fails', async () => {
    const actor = subject()
    await fixture.owner(() => fixture.pg.exec(`CREATE FUNCTION reject_privacy_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='privacy.request.received' THEN RAISE EXCEPTION 'test audit refused'; END IF; RETURN NEW; END;$$;
      CREATE TRIGGER reject_privacy_audit BEFORE INSERT ON audit_security.audit_logs FOR EACH ROW EXECUTE FUNCTION reject_privacy_audit();`))
    try {
      await expect(create(actor)).rejects.toThrow()
      expect(await fixture.as(actor, tx => listPrivacyRequests(tx, actor))).toEqual([])
      expect((await fixture.pg.query('SELECT id FROM message_threads WHERE member_id=$1', [actor.userId])).rows).toHaveLength(0)
      expect((await fixture.pg.query('SELECT id FROM messages WHERE sender_id=$1', [actor.userId])).rows).toHaveLength(0)
    } finally {
      await fixture.owner(() => fixture.pg.exec('DROP TRIGGER reject_privacy_audit ON audit_security.audit_logs; DROP FUNCTION reject_privacy_audit();'))
    }
  })

  it('replays an identical handler response once and rejects a changed response with the same nonce', async () => {
    const made = await assigned()
    const input = { action: 'verify_identity' as const, body: 'Account reviewed.', coveredScopes: [], exemptions: [],
      verificationBasis: 'authenticated_account_reviewed' as const, expectedResponseId: null, clientRequestId: randomUUID() }
    const first = await fixture.as(staff, tx => respondToPrivacyRequest(tx, staff, made.request.threadId, input))
    expect(await fixture.as(staff, tx => respondToPrivacyRequest(tx, staff, made.request.threadId, input))).toEqual({ id: first.id, duplicate: true })
    await expect(fixture.as(staff, tx => respondToPrivacyRequest(tx, staff, made.request.threadId, { ...input, body: 'Different explanation.' }))).rejects.toMatchObject({ kind: 'reused_nonce' })
    expect((await fixture.as(made.actor, tx => getPrivacyRequest(tx, made.actor, made.request.id)))?.responses).toHaveLength(1)
  })

  it('exports only covered categories and carries a reasoned exemption without the withheld data', async () => {
    const made = await assigned()
    const verified = await response(made.request.threadId, 'verify_identity', null)
    const result = await fixture.as(staff, tx => respondToPrivacyRequest(tx, staff, made.request.threadId, {
      action: 'respond', body: 'The account data is withheld for the reason stated.', coveredScopes: [],
      exemptions: [{ scope: 'account_profile', reason: 'Controlled test exemption for the requested category.' }],
      expectedResponseId: verified.id, clientRequestId: randomUUID(),
    }))
    const profile = { ...made.actor, email: 'WITHHELD@example.test', firstName: 'Withheld', lastName: null }
    const exported = await fixture.as(made.actor, tx => preparePrivacyAccountExport(tx, made.actor, made.request.id, profile, result.id))
    expect(JSON.parse(exported.bytes).data).toEqual({})
    expect(JSON.parse(exported.bytes).exemptions).toHaveLength(1)
    expect(exported.bytes).not.toContain('WITHHELD@example.test')
  })

  it('expires an account export independently of the response being available', async () => {
    const made = await reviewed()
    await fixture.owner(() => fixture.pg.query("UPDATE messages SET created_at=now()-interval '8 days' WHERE id=$1", [made.responseId]))
    const profile = { ...made.actor, email: null, firstName: null, lastName: null }
    await expect(fixture.as(made.actor, tx => preparePrivacyAccountExport(tx, made.actor, made.request.id, profile, made.responseId))).rejects.toMatchObject({ kind: 'export_expired' })
    expect(await fixture.as(made.actor, tx => getPrivacyRequest(tx, made.actor, made.request.id))).toMatchObject({ stage: 'respond', status: 'pending' })
  })

  it('bounds open submissions without claiming a receipt for the rejected twenty-first request', async () => {
    const actor = subject()
    for (let index = 0; index < 20; index++) await create(actor)
    await expect(create(actor)).rejects.toMatchObject({ kind: 'too_many_requests' })
    expect(await fixture.as(actor, tx => listPrivacyRequests(tx, actor))).toHaveLength(20)
  })

  it('lists bounded subject metadata without expanding or requiring access to message bodies', async () => {
    const made = await assigned()
    await response(made.request.threadId, 'verify_identity', null)
    await fixture.owner(() => fixture.pg.exec('REVOKE SELECT ON messages FROM rt'))
    try {
      const summaries = await fixture.as(made.actor, tx => listPrivacyRequests(tx, made.actor))
      expect(summaries).toHaveLength(1)
      expect(summaries[0]).toMatchObject({ id: made.request.id, status: 'pending' })
      expect(summaries[0]).not.toHaveProperty('messages')
      expect(summaries[0]).not.toHaveProperty('responses')
    } finally { await fixture.owner(() => fixture.pg.exec('GRANT SELECT ON messages TO rt')) }
  })

  it('honors the recipient notification preference for responses and clarifications without withholding their messages', async () => {
    const made = await assigned()
    noticeAllowed.mockResolvedValue(false)
    const count = async (userId: string) => (await fixture.pg.query<{ count: number }>('SELECT count(*)::int AS count FROM in_app_notifications WHERE user_id=$1', [userId])).rows[0].count
    const memberBefore = await count(made.actor.userId)
    const staffBefore = await count(staff.userId)
    await response(made.request.threadId, 'verify_identity', null)
    expect(noticeAllowed).toHaveBeenCalledWith(made.actor.userId, org, 'message')
    expect(await count(made.actor.userId)).toBe(memberBefore)
    await fixture.as(made.actor, tx => replyToPrivacyConversation(tx, made.actor, made.request.threadId, { body: 'A private clarification without an extra notice.', clientRequestId: randomUUID() }))
    expect(noticeAllowed).toHaveBeenCalledWith(staff.userId, org, 'message')
    expect(await count(staff.userId)).toBe(staffBefore)
    const view = await fixture.as(made.actor, tx => getPrivacyRequest(tx, made.actor, made.request.id))
    expect(view?.responses).toHaveLength(1)
    expect(view?.messages).toHaveLength(3)
  })
})
