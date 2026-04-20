import { NextResponse } from 'next/server'

const APP = 'trade'

export async function GET() {
  const checks = {
    process: { status: 'ok' },
    database: { status: 'unknown' },
    queue: { status: 'unknown' },
    storage: { status: 'unknown' },
    thirdParty: { status: 'unknown' },
  }

  return NextResponse.json({ ready: true, status: 'ready', app: APP, checks, timestamp: new Date().toISOString() }, { status: 200 })
}