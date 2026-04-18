import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { buildPipelineSnapshot } from '@/server/revenue-snapshots'

export async function GET(request: Request) {
  try {
    await requireApiAuth(request)
    const data = await buildPipelineSnapshot()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
