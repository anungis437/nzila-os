import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { createPrivacyRequestThread, findReadableThread, isOpenThread, postThreadMessage } from '@/lib/messaging/thread-access'
import { changeThreadLifecycle } from '@/lib/messaging/thread-lifecycle'
import { lockPrivacyThread } from '@/lib/messaging/thread-lock'
import { inAppNoticeAllowed } from '@/lib/notifications/in-app-preferences'
import {
  PRIVACY_REQUEST_CONTRACT, PRIVACY_THREAD_CATEGORY, readPrivacyThreadBinding, readPrivacyResponse, privacyMessageNonce,
  responseCoversRequestedScope, supportsAccountExport,
  privacyRequestSummarySchema,
  type PrivacyIdentity, type PrivacyResponseRecord, type PrivacyThreadBinding,
  type privacyRequestInput, type privacyResponseInput, type privacyAcknowledgementInput,
} from './request-contract'

type Failure = 'not_found' | 'forbidden' | 'stale' | 'closed' | 'verification_required' | 'scope_incomplete' |
  'reused_nonce' | 'export_not_available' | 'export_expired' | 'export_required' | 'too_many_requests'
export class PrivacyRequestError extends Error {
  constructor(readonly kind: Failure) { super('Privacy request operation refused: ' + kind) }
}

interface RequestRow {
  id: string; user_id: string; organization_id: string; request_type: string; status: string;
  request_details: Record<string, unknown> | null; requested_at: Date | string; deadline: Date | string;
  completed_at: Date | string | null; response_data: Record<string, unknown> | null;
}
interface RecordedResponse {
  id: string; senderId: string; createdAt: string; body: string; clientRequestId: string | null; record: PrivacyResponseRecord
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const rows = <T,>(result: unknown): T[] => (Array.isArray(result) ? result : (result as { rows?: T[] }).rows ?? []) as T[]
const iso = (value: Date | string) => new Date(value).toISOString()
const fail = (kind: Failure): never => { throw new PrivacyRequestError(kind) }

async function lockThread(tx: RLSTx, actor: PrivacyIdentity, threadId: string) {
  await lockPrivacyThread(tx, actor.organizationId, threadId)
}

async function ownedRequest(tx: RLSTx, actor: PrivacyIdentity, id: string): Promise<RequestRow | null> {
  if (!uuid.test(id)) return null
  return rows<RequestRow>(await tx.execute(sql`SELECT id::text,user_id,organization_id::text,request_type,status,
      request_details,requested_at,deadline,completed_at,response_data
    FROM public.gdpr_data_requests
    WHERE id=${id}::uuid AND organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
    LIMIT 1`))[0] ?? null
}

/** The first immutable message binds the subject and request. A legacy arbitrary JSON field is insufficient. */
async function boundConversation(tx: RLSTx, actor: PrivacyIdentity, threadId: string) {
  const thread = await findReadableThread(tx, actor, threadId)
  if (!thread || thread.category !== PRIVACY_THREAD_CATEGORY) return null
  const messages = rows<{ id: string; sender_id: string; created_at: Date | string; content: string; metadata: unknown }>(await tx.execute(sql`
    SELECT id::text,sender_id,created_at,content,metadata FROM public.messages
    WHERE thread_id=${thread.id}::uuid ORDER BY created_at,id LIMIT 501`))
  // Never silently qualify a truncated response history.
  if (messages.length > 500) return fail('scope_incomplete')
  const bindings = messages.filter(message => message.sender_id === thread.memberId && readPrivacyThreadBinding(message.metadata))
  if (bindings.length !== 1) return null
  const binding = readPrivacyThreadBinding(bindings[0].metadata)!
  const responses: RecordedResponse[] = []
  for (const message of messages) {
    const record = readPrivacyResponse(message.metadata)
    if (record?.requestId === binding.requestId && message.sender_id !== thread.memberId) {
      responses.push({ id: message.id, senderId: message.sender_id, createdAt: iso(message.created_at), body: message.content,
        clientRequestId: privacyMessageNonce(message.metadata), record })
    }
  }
  // Transaction start timestamps can run in the opposite order to lock acquisition.
  // The sequence is installed only by the server while holding this request's lock.
  responses.sort((a,b) => a.record.sequence - b.record.sequence)
  if (responses.some((response,index) => response.record.sequence !== index + 1)) return fail('scope_incomplete')
  return { thread, binding, responses, messages: messages.map(message => ({
    id: message.id, fromMe: message.sender_id === actor.userId, createdAt: iso(message.created_at), body: message.content,
  })) }
}

async function ownedConversation(tx: RLSTx, actor: PrivacyIdentity, request: RequestRow) {
  const threadId = request.request_details?.threadId
  if (request.request_details?.contract !== PRIVACY_REQUEST_CONTRACT || typeof threadId !== 'string') return null
  const context = await boundConversation(tx, actor, threadId)
  if (!context || context.thread.memberId !== actor.userId || context.binding.requestId !== request.id) return null
  return context
}

function responseView(response: RecordedResponse) {
  // Assignee identifiers and internal request fields are not part of the subject's response projection.
  return { id: response.id, createdAt: response.createdAt, body: response.body, action: response.record.action,
    coveredScopes: response.record.coveredScopes, exemptions: response.record.exemptions }
}

function requestView(request: RequestRow, context: NonNullable<Awaited<ReturnType<typeof ownedConversation>>>) {
  const last = context.responses.at(-1)
  const verified = context.responses.some(response => response.record.action === 'verify_identity')
  const terminal = ['completed', 'rejected', 'cancelled'].includes(request.status)
  const requiresExportReceipt = !terminal && verified && last?.record.action === 'respond' && supportsAccountExport(context.binding.requestType, context.binding.scopes)
  const exportAge = last ? Date.now() - new Date(last.createdAt).getTime() : NaN
  return {
    id: request.id, requestType: context.binding.requestType, scopes: context.binding.scopes,
    description: typeof request.request_details?.description === 'string' ? request.request_details.description : '',
    status: request.status, stage: terminal ? request.status : last?.record.action ?? 'received',
    requestedAt: iso(request.requested_at), responseTargetAt: iso(request.deadline),
    completedAt: request.completed_at ? iso(request.completed_at) : null,
    threadId: context.thread.id, handlerAssigned: context.thread.staffId !== null,
    identityReviewed: verified, responses: context.responses.map(responseView), messages: context.messages,
    latestResponseId: last?.id ?? null,
    canExport: requiresExportReceipt && Number.isFinite(exportAge) && exportAge >= 0 && exportAge <= 7 * 24 * 60 * 60 * 1000,
    requiresExportReceipt,
    canAcknowledge: !terminal && Boolean(last && ['respond', 'refuse'].includes(last.record.action)),
    canCancel: !terminal,
  }
}

export async function listPrivacyRequests(tx: RLSTx, actor: PrivacyIdentity) {
  const found = rows<RequestRow>(await tx.execute(sql`SELECT id::text,user_id,organization_id::text,request_type,status,
      request_details,requested_at,deadline,completed_at,response_data
    FROM public.gdpr_data_requests WHERE organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
      AND request_details->>'contract'=${PRIVACY_REQUEST_CONTRACT}
    ORDER BY requested_at DESC,id DESC LIMIT 100`))
  // A list never expands 100 private conversations. The selected request's
  // separate detail read verifies its immutable subject/thread binding.
  return found.map(request => privacyRequestSummarySchema.parse({
    id: request.id, requestType: request.request_type, scopes: request.request_details?.scopes,
    description: request.request_details?.description, status: request.status,
    requestedAt: iso(request.requested_at), responseTargetAt: iso(request.deadline),
    completedAt: request.completed_at ? iso(request.completed_at) : null, threadId: request.request_details?.threadId,
  }))
}

export async function getPrivacyRequest(tx: RLSTx, actor: PrivacyIdentity, id: string) {
  const request = await ownedRequest(tx, actor, id)
  if (!request) return null
  const context = await ownedConversation(tx, actor, request)
  return context ? requestView(request, context) : null
}

export async function createPrivacyRequest(tx: RLSTx, actor: PrivacyIdentity, input: z.infer<typeof privacyRequestInput>) {
  const normalized = { requestType: input.requestType, scopes: [...input.scopes].sort(), description: input.description }
  const payloadHash = hash(JSON.stringify(normalized))
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy:create:${actor.organizationId}:${actor.userId}`},0))`)
  const previous = rows<RequestRow>(await tx.execute(sql`SELECT id::text,user_id,organization_id::text,request_type,status,
      request_details,requested_at,deadline,completed_at,response_data
    FROM public.gdpr_data_requests WHERE organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
      AND request_details->>'contract'=${PRIVACY_REQUEST_CONTRACT}
      AND request_details->>'clientRequestId'=${input.clientRequestId} LIMIT 1`))[0]
  if (previous) {
    if (previous.request_details?.payloadHash !== payloadHash) return fail('reused_nonce')
    const context = await ownedConversation(tx, actor, previous)
    if (!context) return fail('not_found')
    return { request: requestView(previous, context), duplicate: true }
  }
  const [{ count }] = rows<{ count: number }>(await tx.execute(sql`SELECT count(*)::int AS count
    FROM public.gdpr_data_requests WHERE organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
      AND request_details->>'contract'=${PRIVACY_REQUEST_CONTRACT} AND status IN ('pending','in_progress')`))
  if (count >= 20) return fail('too_many_requests')
  const id = randomUUID()
  const binding: PrivacyThreadBinding = { contract: PRIVACY_REQUEST_CONTRACT, requestId: id,
    requestType: input.requestType, scopes: normalized.scopes }
  const thread = await createPrivacyRequestThread(tx, actor, {
    subject: `Privacy request · ${input.requestType} · ${id.slice(0,8)}`,
    body: input.description, clientRequestId: input.clientRequestId,
  }, binding)
  const details = JSON.stringify({ ...normalized, contract: PRIVACY_REQUEST_CONTRACT,
    clientRequestId: input.clientRequestId, payloadHash, threadId: thread.id })
  const [created] = rows<RequestRow>(await tx.execute(sql`INSERT INTO public.gdpr_data_requests
    (id,user_id,organization_id,request_type,status,request_details,requested_at,deadline,verification_method,created_at,updated_at)
    VALUES (${id}::uuid,${actor.userId},${actor.organizationId}::uuid,${input.requestType},'pending',${details}::jsonb,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days','authenticated_session_receipt',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    RETURNING id::text,user_id,organization_id::text,request_type,status,request_details,requested_at,deadline,completed_at,response_data`))
  await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId,
    action: 'privacy.request.received', resourceType: 'gdpr_data_requests', resourceId: id,
    details: { requestType: input.requestType, threadId: thread.id, contract: PRIVACY_REQUEST_CONTRACT } })
  const context = await ownedConversation(tx, actor, created)
  if (!context) return fail('not_found')
  return { request: requestView(created, context), duplicate: false }
}

/** A handler sees the assigned conversation, never an administrator-wide GDPR request table. */
export async function getPrivacyConversation(tx: RLSTx, actor: PrivacyIdentity, threadId: string) {
  const context = await boundConversation(tx, actor, threadId)
  if (!context) return null
  return { requestId: context.binding.requestId, requestType: context.binding.requestType, scopes: context.binding.scopes,
    threadId: context.thread.id, open: isOpenThread(context.thread),
    canRespond: context.thread.staffId === actor.userId && context.thread.memberId !== actor.userId && isOpenThread(context.thread),
    identityReviewed: context.responses.some(response => response.record.action === 'verify_identity'),
    responses: context.responses.map(responseView), messages: context.messages, latestResponseId: context.responses.at(-1)?.id ?? null }
}

export async function respondToPrivacyRequest(tx: RLSTx, actor: PrivacyIdentity, threadId: string, input: z.infer<typeof privacyResponseInput>) {
  await lockThread(tx, actor, threadId)
  const context = await boundConversation(tx, actor, threadId)
  if (!context) return fail('not_found')
  if (context.thread.memberId === actor.userId || context.thread.staffId !== actor.userId) return fail('forbidden')
  if (!isOpenThread(context.thread)) return fail('closed')
  const payloadHash = hash(JSON.stringify({ ...input, coveredScopes: [...input.coveredScopes].sort(),
    exemptions: [...input.exemptions].sort((a,b) => a.scope.localeCompare(b.scope)) }))
  const duplicate = context.responses.find(response => response.senderId === actor.userId && response.clientRequestId === input.clientRequestId)
  if (duplicate) {
    if (duplicate.record.payloadHash !== payloadHash) return fail('reused_nonce')
    return { id: duplicate.id, duplicate: true }
  }
  if ((context.responses.at(-1)?.id ?? null) !== input.expectedResponseId) return fail('stale')
  if (input.action === 'verify_identity' && !input.verificationBasis) return fail('verification_required')
  if (input.action === 'respond') {
    if (!context.responses.some(response => response.record.action === 'verify_identity')) return fail('verification_required')
    if (!responseCoversRequestedScope(context.binding.scopes, input)) return fail('scope_incomplete')
  }
  if (input.coveredScopes.some(scope => !context.binding.scopes.includes(scope)) ||
      input.exemptions.some(item => !context.binding.scopes.includes(item.scope))) return fail('scope_incomplete')
  const record: PrivacyResponseRecord = { contract: PRIVACY_REQUEST_CONTRACT, requestId: context.binding.requestId,
    action: input.action, coveredScopes: input.coveredScopes, exemptions: input.exemptions, payloadHash,
    sequence: context.responses.length + 1,
    ...(input.verificationBasis ? { verificationBasis: input.verificationBasis } : {}) }
  const posted = await postThreadMessage(tx, actor, threadId, { body: input.body, clientRequestId: input.clientRequestId },
    recipientId => inAppNoticeAllowed(recipientId, actor.organizationId, 'message'), record)
  if (posted.kind !== 'ok') return fail(posted.kind === 'closed' ? 'closed' : 'not_found')
  await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId,
    action: 'privacy.response.' + input.action, resourceType: 'gdpr_data_requests', resourceId: context.binding.requestId,
    details: { threadId, responseMessageId: posted.message.id } })
  return { id: posted.message.id, duplicate: posted.duplicate }
}

export async function acknowledgePrivacyRequest(tx: RLSTx, actor: PrivacyIdentity, id: string, input: z.infer<typeof privacyAcknowledgementInput>) {
  const request = await ownedRequest(tx, actor, id)
  if (!request || typeof request.request_details?.threadId !== 'string') return fail('not_found')
  await lockThread(tx, actor, request.request_details.threadId)
  const fresh = await ownedRequest(tx, actor, id)
  if (!fresh) return fail('not_found')
  const context = await ownedConversation(tx, actor, fresh)
  if (!context) return fail('not_found')
  if (['completed','rejected','cancelled'].includes(fresh.status)) return fail('closed')
  const last = context.responses.at(-1)
  if ((last?.id ?? null) !== input.expectedResponseId) return fail('stale')
  if (input.action === 'acknowledge' && (!last || !['respond','refuse'].includes(last.record.action))) return fail('scope_incomplete')
  if (input.action === 'acknowledge' && last?.record.action === 'respond' && supportsAccountExport(context.binding.requestType,context.binding.scopes)) {
    if (!input.exportSha256 || fresh.response_data?.sha256 !== input.exportSha256 || fresh.response_data?.responseId !== last.id) return fail('export_required')
  }
  const outcome = await changeThreadLifecycle(tx, actor, context.thread.id, 'close', id)
  if (outcome.kind !== 'ok') return fail('closed')
  const status = input.action === 'cancel' ? 'cancelled' : last?.record.action === 'refuse' ? 'rejected' : 'completed'
  const verification = context.responses.findLast(response => response.record.action === 'verify_identity')
  await tx.execute(sql`UPDATE public.gdpr_data_requests SET status=${status},completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,
      processed_at=${last?.createdAt ?? null}::timestamptz,processed_by=${last?.senderId ?? null},
      verified_at=${verification?.createdAt ?? null}::timestamptz,verified_by=${verification?.senderId ?? null},
      verification_method=${verification?.record.verificationBasis ?? 'authenticated_session_receipt'}
    WHERE id=${id}::uuid AND organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}`)
  await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId,
    action: input.action === 'cancel' ? 'privacy.request.cancelled' : 'privacy.response.acknowledged',
    resourceType: 'gdpr_data_requests', resourceId: id,
    details: { threadId: context.thread.id, responseMessageId: last?.id ?? null, resultingStatus: status } })
  return { id, status }
}

export async function replyToPrivacyConversation(tx: RLSTx, actor: PrivacyIdentity, threadId: string, input: { body: string; clientRequestId: string }) {
  await lockThread(tx, actor, threadId)
  const context = await boundConversation(tx, actor, threadId)
  if (!context) return fail('not_found')
  if (context.thread.memberId !== actor.userId) return fail('forbidden')
  const result = await postThreadMessage(tx, actor, threadId, input,
    recipientId => inAppNoticeAllowed(recipientId, actor.organizationId, 'message'))
  if (result.kind !== 'ok') return fail(result.kind === 'closed' ? 'closed' : 'not_found')
  return { id: result.message.id, duplicate: result.duplicate }
}

export interface PrivacyAccountProfile { userId: string; organizationId: string; email: string | null; firstName: string | null; lastName: string | null }

/** A fresh authenticated account export. It never traverses cases or other people's conversations. */
export async function preparePrivacyAccountExport(tx: RLSTx, actor: PrivacyIdentity, id: string, profile: PrivacyAccountProfile, expectedResponseId: string) {
  if (profile.userId !== actor.userId || profile.organizationId !== actor.organizationId) return fail('forbidden')
  const request = await ownedRequest(tx, actor, id)
  if (!request || typeof request.request_details?.threadId !== 'string') return fail('not_found')
  await lockThread(tx, actor, request.request_details.threadId)
  const fresh = await ownedRequest(tx, actor, id)
  if (!fresh) return fail('not_found')
  const context = await ownedConversation(tx, actor, fresh)
  if (!context) return fail('not_found')
  const last = context.responses.at(-1)
  if (last?.id !== expectedResponseId) return fail('stale')
  if (fresh.status !== 'pending' || last?.record.action !== 'respond' ||
      !context.responses.some(response => response.record.action === 'verify_identity') ||
      !supportsAccountExport(context.binding.requestType, context.binding.scopes)) return fail('export_not_available')
  const responseAge = Date.now() - new Date(last.createdAt).getTime()
  if (!Number.isFinite(responseAge) || responseAge < 0 || responseAge > 7 * 24 * 60 * 60 * 1000) return fail('export_expired')
  const data: Record<string, unknown> = {}
  if (last.record.coveredScopes.includes('account_profile')) data.accountProfile = profile
  if (last.record.coveredScopes.includes('consents')) data.consents = rows(await tx.execute(sql`
    SELECT consent_type,status,legal_basis,processing_purpose,consent_version,consent_text,granted_at,expires_at,withdrawn_at
    FROM public.user_consents WHERE organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
    ORDER BY created_at,id LIMIT 501`))
  if (Array.isArray(data.consents) && data.consents.length > 500) return fail('scope_incomplete')
  if (last.record.coveredScopes.includes('privacy_requests')) {
    const [{ count }] = rows<{ count: number }>(await tx.execute(sql`SELECT count(*)::int AS count
      FROM public.gdpr_data_requests WHERE organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
        AND request_details->>'contract'=${PRIVACY_REQUEST_CONTRACT}`))
    if (count > 100) return fail('scope_incomplete')
    data.privacyRequests = await listPrivacyRequests(tx, actor)
  }
  const generatedAt = new Date().toISOString()
  const bytes = JSON.stringify({ schema: 'ue_privacy_account_export_v1', requestId: id, generatedAt,
    scopes: context.binding.scopes, coveredScopes: last.record.coveredScopes, data, exemptions: last.record.exemptions,
    coverage: 'Only the account categories requested here; case files and third-party records require a separately reviewed response.' }, null, 2) + '\n'
  if (Buffer.byteLength(bytes) > 1024 * 1024) return fail('scope_incomplete')
  const sha256 = hash(bytes)
  const receipt = JSON.stringify({ contract: PRIVACY_REQUEST_CONTRACT, responseId: last.id, sha256, generatedAt })
  await tx.execute(sql`UPDATE public.gdpr_data_requests SET response_data=${receipt}::jsonb,updated_at=CURRENT_TIMESTAMP
    WHERE id=${id}::uuid AND organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}`)
  await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId,
    action: 'privacy.account_export.generated', resourceType: 'gdpr_data_requests', resourceId: id,
    details: { responseMessageId: last.id, sha256, bytes: Buffer.byteLength(bytes) } })
  return { bytes, sha256, filename: `union-eyes-account-data-${id}.json` }
}
