import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'nzila-hq',
    commit: process.env.GIT_SHA ?? null,
    timestamp: new Date().toISOString(),
  })
}
