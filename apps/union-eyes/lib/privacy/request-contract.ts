import { z } from 'zod'

/** Receipt, a handler's response and the requester's acknowledgement are distinct events. */
export const PRIVACY_REQUEST_CONTRACT = 'ue_privacy_request_v1' as const
export const PRIVACY_THREAD_CATEGORY = 'privacy_request' as const
export const privacyRequestTypes = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'] as const
export const privacyScopes = ['account_profile', 'consents', 'privacy_requests', 'case_records', 'communications', 'other'] as const
export const accountExportScopes = ['account_profile', 'consents', 'privacy_requests'] as const
export type PrivacyRequestType = typeof privacyRequestTypes[number]
export type PrivacyScope = typeof privacyScopes[number]

export const privacyRequestInput = z.object({
  requestType: z.enum(privacyRequestTypes),
  scopes: z.array(z.enum(privacyScopes)).min(1).max(privacyScopes.length),
  description: z.string().trim().min(5).max(3000),
  clientRequestId: z.guid(),
}).strict().refine(value => new Set(value.scopes).size === value.scopes.length, {
  message: 'Each scope may be selected once', path: ['scopes'],
})

export const privacyResponseInput = z.object({
  action: z.enum(['verify_identity', 'clarify', 'respond', 'refuse']),
  body: z.string().trim().min(3).max(4000),
  coveredScopes: z.array(z.enum(privacyScopes)).max(privacyScopes.length).default([]),
  exemptions: z.array(z.object({ scope: z.enum(privacyScopes), reason: z.string().trim().min(3).max(500) }).strict()).max(privacyScopes.length).default([]),
  verificationBasis: z.enum(['authenticated_account_reviewed', 'additional_verification_in_conversation']).optional(),
  expectedResponseId: z.guid().nullable(),
  clientRequestId: z.guid(),
}).strict()

export const privacyAcknowledgementInput = z.object({
  action: z.enum(['acknowledge', 'cancel']),
  expectedResponseId: z.guid().nullable(),
  exportSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict()

export interface PrivacyIdentity { userId: string; organizationId: string }

export interface PrivacyThreadBinding {
  contract: typeof PRIVACY_REQUEST_CONTRACT
  requestId: string
  requestType: PrivacyRequestType
  scopes: PrivacyScope[]
}

export interface PrivacyResponseRecord {
  contract: typeof PRIVACY_REQUEST_CONTRACT
  requestId: string
  action: 'verify_identity' | 'clarify' | 'respond' | 'refuse'
  coveredScopes: PrivacyScope[]
  exemptions: Array<{ scope: PrivacyScope; reason: string }>
  payloadHash: string
  sequence: number
  verificationBasis?: 'authenticated_account_reviewed' | 'additional_verification_in_conversation'
}

const bindingSchema = z.object({
  contract: z.literal(PRIVACY_REQUEST_CONTRACT), requestId: z.guid(),
  requestType: z.enum(privacyRequestTypes), scopes: z.array(z.enum(privacyScopes)).min(1).max(privacyScopes.length),
}).strict()

const responseSchema = z.object({
  contract: z.literal(PRIVACY_REQUEST_CONTRACT), requestId: z.guid(),
  action: z.enum(['verify_identity', 'clarify', 'respond', 'refuse']),
  coveredScopes: z.array(z.enum(privacyScopes)).max(privacyScopes.length),
  exemptions: z.array(z.object({ scope: z.enum(privacyScopes), reason: z.string().trim().min(3).max(500) }).strict()).max(privacyScopes.length),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  sequence: z.number().int().min(1).max(500),
  verificationBasis: z.enum(['authenticated_account_reviewed', 'additional_verification_in_conversation']).optional(),
}).strict()

function objectMetadata(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return null }
  }
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
}

/** Metadata is accepted only after the service also verifies its immutable thread/subject binding. */
export function readPrivacyThreadBinding(raw: unknown): PrivacyThreadBinding | null {
  const parsed = bindingSchema.safeParse(objectMetadata(raw)?.privacyRequest)
  return parsed.success ? parsed.data : null
}

export function readPrivacyResponse(raw: unknown): PrivacyResponseRecord | null {
  const parsed = responseSchema.safeParse(objectMetadata(raw)?.privacyResponse)
  return parsed.success ? parsed.data : null
}

export function privacyMessageNonce(raw: unknown): string | null {
  const nonce = objectMetadata(raw)?.clientRequestId
  return typeof nonce === 'string' && z.guid().safeParse(nonce).success ? nonce : null
}

export function responseCoversRequestedScope(requested: readonly PrivacyScope[], response: Pick<PrivacyResponseRecord, 'coveredScopes' | 'exemptions'>): boolean {
  const covered = [...response.coveredScopes, ...response.exemptions.map(item => item.scope)]
  return new Set(covered).size === covered.length && covered.length === requested.length && covered.every(scope => requested.includes(scope))
}

export function supportsAccountExport(requestType: PrivacyRequestType, scopes: readonly PrivacyScope[]): boolean {
  return (requestType === 'access' || requestType === 'portability') && scopes.length > 0 &&
    scopes.every(scope => (accountExportScopes as readonly PrivacyScope[]).includes(scope))
}

const responseViewSchema = z.object({
  id: z.guid(), createdAt: z.string().datetime(), body: z.string(),
  action: z.enum(['verify_identity', 'clarify', 'respond', 'refuse']),
  coveredScopes: z.array(z.enum(privacyScopes)),
  exemptions: z.array(z.object({ scope: z.enum(privacyScopes), reason: z.string() })),
})

const conversationMessageSchema = z.object({
  id: z.guid(), fromMe: z.boolean(), createdAt: z.string().datetime(), body: z.string(),
})

export const privacyRequestViewSchema = z.object({
  id: z.guid(), requestType: z.enum(privacyRequestTypes), scopes: z.array(z.enum(privacyScopes)),
  description: z.string(), status: z.enum(['pending','in_progress','completed','rejected','cancelled']),
  stage: z.enum(['received','verify_identity','clarify','respond','refuse','completed','rejected','cancelled']),
  requestedAt: z.string().datetime(), responseTargetAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
  threadId: z.guid(), handlerAssigned: z.boolean(), identityReviewed: z.boolean(), responses: z.array(responseViewSchema),
  messages: z.array(conversationMessageSchema).max(500),
  latestResponseId: z.guid().nullable(), canExport: z.boolean(), requiresExportReceipt: z.boolean(), canAcknowledge: z.boolean(), canCancel: z.boolean(),
})

export const privacyRequestSummarySchema = privacyRequestViewSchema.pick({
  id: true, requestType: true, scopes: true, description: true, status: true,
  requestedAt: true, responseTargetAt: true, completedAt: true, threadId: true,
})

export const privacyConversationViewSchema = z.object({
  requestId: z.guid(), requestType: z.enum(privacyRequestTypes), scopes: z.array(z.enum(privacyScopes)),
  threadId: z.guid(), open: z.boolean(), canRespond: z.boolean(), identityReviewed: z.boolean(),
  messages: z.array(conversationMessageSchema).max(500),
  responses: z.array(responseViewSchema), latestResponseId: z.guid().nullable(),
})

export type PrivacyRequestView = z.infer<typeof privacyRequestViewSchema>
export type PrivacyRequestSummary = z.infer<typeof privacyRequestSummarySchema>
export type PrivacyConversationView = z.infer<typeof privacyConversationViewSchema>
