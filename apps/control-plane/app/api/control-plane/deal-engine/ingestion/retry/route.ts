import { retryIngestion } from '@/lib/services/deal-engine-mutations'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const retryMutationSchema = z.object({
  runId: z.string().min(1),
  actor: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    await requireApiAuth(request)
    const body = await request.json()
    const parsed = retryMutationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const result = await retryIngestion(parsed.data, {})
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return handleAuthError(error)
  }
}
