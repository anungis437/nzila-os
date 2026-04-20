import { NextResponse } from 'next/server'

const APP = 'web'

export async function GET() {
  const checks = {
    process: { status: 'ok' },
    database: { status: 'not-applicable' },
    queue: { status: 'not-applicable' },
    storage: { status: 'not-applicable' },
    thirdParty: { status: 'unknown' },
  }

  return NextResponse.json({ ready: true, status: 'ready', app: APP, checks, timestamp: new Date().toISOString() }, { status: 200 })
}