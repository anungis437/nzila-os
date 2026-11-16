import { withApi } from '@/lib/api/framework'
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses'
import { withPrivacyDatabase } from '@/lib/privacy/api'
import { privacyResponseInput } from '@/lib/privacy/request-contract'
import { getPrivacyConversation, respondToPrivacyRequest, replyToPrivacyConversation } from '@/lib/privacy/requests'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false,
    openapi: { tags: ['Privacy'], summary: 'Read the privacy context of my owned or assigned conversation' } },
  async context => withPrivacyDatabase(context, async (tx, actor) => {
    const conversation = await getPrivacyConversation(tx, actor, context.params.threadId)
    return conversation ? standardSuccessResponse({ conversation }) : standardErrorResponse(ErrorCode.NOT_FOUND, 'Privacy conversation not found')
  }),
)

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false, body: privacyResponseInput,
    openapi: { tags: ['Privacy'], summary: 'Record an assigned handler privacy response with scope and audit' } },
  async context => withPrivacyDatabase(context, async (tx, actor) =>
    standardSuccessResponse(await respondToPrivacyRequest(tx, actor, context.params.threadId, context.body))),
)

export const PATCH = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false,
    body: z.object({ body: z.string().trim().min(1).max(4000), clientRequestId: z.guid() }).strict(),
    openapi: { tags: ['Privacy'], summary: 'Add my clarification to my open privacy request' } },
  async context => withPrivacyDatabase(context, async (tx, actor) =>
    standardSuccessResponse(await replyToPrivacyConversation(tx, actor, context.params.threadId, context.body))),
)
