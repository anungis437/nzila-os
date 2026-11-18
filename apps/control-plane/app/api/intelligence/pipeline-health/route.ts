import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { readIntelligencePipelineHealth } from '@/lib/services/intelligence-service'

export async function GET(request: NextRequest) {
  try {
    if (request.headers.has('x-api-key')) {
      await requireApiAuth(request)
    }

    await requireAuditReadAuth(request)

    return NextResponse.json(await readIntelligencePipelineHealth())
  } catch (error) {
    return handleAuthError(error)
  }
}
