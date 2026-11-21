import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/lib/api/with-api'
import { ApiError } from '@/lib/api/errors'
import { settleCorrespondenceEmail } from '@/lib/correspondence/email-delivery'

// Explicit POST: receipt settlement can write the final audited transition.
export const POST = withApi({ rlsOrgContext:true,auth:{required:true,minRole:'steward'},
  openapi:{tags:['Correspondence'],summary:'Reconcile queued letter email with durable provider receipts'},
},async ({params,organizationId,userId}) => {
  const id = z.string().uuid().safeParse(params?.id)
  if (!id.success) throw ApiError.badRequest('Invalid correspondence ID')
  const state = await settleCorrespondenceEmail(id.data,organizationId!,userId!)
  return NextResponse.json({success:true,data:state},{status:state.state === 'queued'?202:200})
})
