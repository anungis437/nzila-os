import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { withSpan } from '@nzila/os-core/telemetry'

import { processCrmRetryBatch } from '@/lib/services/crm-service'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { requireWorkerAuth } from '@/lib/internal-worker-auth'

const WorkerRetrySchema = z.object({
  batchSize: z.number().int().min(1).max(100).optional(),
})

async function parseBody(request: NextRequest): Promise<z.infer<typeof WorkerRetrySchema>> {
  try {
    const body = await request.json()
    return WorkerRetrySchema.parse(body ?? {})
  } catch {
    return WorkerRetrySchema.parse({})
  }
}

export async function POST(request: NextRequest) {
  return withRequestContext(request, () =>
    withSpan('zonga.worker.crm-retry.post', { 'http.method': 'POST' }, async () => {
      const authResult = await authenticateUser()
      if (!authResult.ok) {
        const unauthorized = requireWorkerAuth(request)
        if (unauthorized) return unauthorized
      }

      const payload = await parseBody(request)
      const result = await processCrmRetryBatch(payload.batchSize ?? 25)
      return NextResponse.json({ ok: true, ...result })
    }),
  )
}
