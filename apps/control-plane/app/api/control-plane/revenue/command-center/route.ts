import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { buildCommandCenterSnapshot } from '@/server/revenue-snapshots'
export type { AlertSeverity, CommandAlert, CommandCenterSnapshot } from '@/server/revenue-snapshots'

export async function GET(request: Request) {
  try {
    await requireApiAuth(request)
    const data = await buildCommandCenterSnapshot()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
