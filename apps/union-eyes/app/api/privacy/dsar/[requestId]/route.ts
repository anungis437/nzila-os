import { withApi } from '@/lib/api/framework'
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses'
import { withPrivacyDatabase } from '@/lib/privacy/api'
import { privacyAcknowledgementInput } from '@/lib/privacy/request-contract'
import { acknowledgePrivacyRequest, getPrivacyRequest } from '@/lib/privacy/requests'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false,
    openapi: { tags: ['Privacy'], summary: 'Read my privacy request and its authorized responses' } },
  async context => withPrivacyDatabase(context, async (tx, actor) => {
    const request = await getPrivacyRequest(tx, actor, context.params.requestId)
    return request ? standardSuccessResponse({ request }) : standardErrorResponse(ErrorCode.NOT_FOUND, 'Privacy request not found')
  }),
)

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false, body: privacyAcknowledgementInput,
    openapi: { tags: ['Privacy'], summary: 'Acknowledge an exact privacy response or cancel my request' } },
  async context => withPrivacyDatabase(context, async (tx, actor) =>
    standardSuccessResponse(await acknowledgePrivacyRequest(tx, actor, context.params.requestId, context.body))),
)
