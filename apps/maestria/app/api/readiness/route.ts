import { NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { getMaestriaDb } from '@/lib/maestria-persistence'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const auth = requireOrgAccess(Object.fromEntries(url.searchParams), 'module.internal.view', 'readiness.read', 'maestria:readiness')
  if (auth.response) return auth.response

  let databaseReady = false

  try {
    const db = getMaestriaDb()
    // Simple ping — if the DB singleton opens without throwing, we're ready
    db.prepare('SELECT 1').get()
    databaseReady = true
  } catch {
    databaseReady = false
  }

  const ready = databaseReady
  const status = ready ? 200 : 503

  return NextResponse.json(
    {
      ready,
      checks: {
        database: databaseReady,
      },
      timestamp: new Date().toISOString(),
    },
    { status },
  )
}
