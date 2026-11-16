import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/framework'
import { standardSuccessResponse } from '@/lib/api/standardized-responses'
import { withPrivacyDatabase } from '@/lib/privacy/api'
import { privacyRequestInput } from '@/lib/privacy/request-contract'
import { createPrivacyRequest, listPrivacyRequests } from '@/lib/privacy/requests'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false,
    openapi: { tags: ['Privacy'], summary: 'List my organization-scoped privacy requests' } },
  async context => withPrivacyDatabase(context, async (tx, actor) =>
    standardSuccessResponse({ requests: await listPrivacyRequests(tx, actor) })),
)

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false, body: privacyRequestInput,
    openapi: { tags: ['Privacy'], summary: 'Receive my privacy request and its secure conversation atomically' } },
  async context => withPrivacyDatabase(context, async (tx, actor) => {
    const result = await createPrivacyRequest(tx, actor, context.body)
    return NextResponse.json({ success: true, data: result }, { status: result.duplicate ? 200 : 201 })
  }),
)
