import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'

const VerifySchema = z.object({
  exportedAt: z.string(),
  seal: z.string().min(16),
  json: z.unknown(),
})

function safeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'hex')
    const bBuf = Buffer.from(b, 'hex')
    if (aBuf.length !== bBuf.length) return false
    return timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const payload = VerifySchema.parse(await request.json())

    const sealSecret = process.env.OPERATING_EVIDENCE_SEAL_KEY ?? 'nzila-dev-seal-key'
    const computed = createHmac('sha256', sealSecret)
      .update(JSON.stringify({ exportedAt: payload.exportedAt, json: payload.json }))
      .digest('hex')

    const verified = safeEqualHex(payload.seal, computed)

    return NextResponse.json({
      ok: true,
      data: {
        status: verified ? 'VERIFIED' : 'TAMPERED',
        verified,
        computedSeal: computed,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
