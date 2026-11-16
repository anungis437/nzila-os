import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/lib/api/framework'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'
import { withPrivacyDatabase } from '@/lib/privacy/api'
import { preparePrivacyAccountExport } from '@/lib/privacy/requests'

export const dynamic = 'force-dynamic'

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, rlsOrgContext: false,
    body: z.object({ expectedResponseId: z.guid() }).strict(),
    openapi: { tags: ['Privacy'], summary: 'Download the account categories of my exact reviewed privacy response' } },
  async context => withPrivacyDatabase(context, async (tx, actor) => {
    if (!context.user || context.user.id !== actor.userId) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Authenticated profile required')
    const result = await preparePrivacyAccountExport(tx, actor, context.params.requestId, {
      userId: actor.userId, organizationId: actor.organizationId,
      email: context.user.email, firstName: context.user.firstName, lastName: context.user.lastName,
    }, context.body.expectedResponseId)
    return new NextResponse(result.bytes, { status: 200, headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Privacy-Export-Sha256': result.sha256,
    } })
  }),
)
