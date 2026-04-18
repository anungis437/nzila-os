import { NextResponse } from 'next/server'
import { processCrmRetryBatch } from '@/lib/services/crm-service'
import { requireWorkerAuth } from '@/lib/internal-worker-auth'

export async function POST(request: Request) {
  const unauthorized = requireWorkerAuth(request)
  if (unauthorized) return unauthorized

  const result = await processCrmRetryBatch(25)
  return NextResponse.json({ ok: true, ...result })
}
