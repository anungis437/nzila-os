import { NextRequest, NextResponse } from 'next/server'
import { resolveActor, hasPermission } from '@/lib/access-control'
import { getMaestriaDb } from '@/lib/maestria-persistence'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams)
  const actor = resolveActor(searchParams)
  if (!hasPermission(actor, 'user.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const db = getMaestriaDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      invited_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  const user = db
    .prepare('SELECT id, email, role, status FROM pending_users WHERE id = ?')
    .get(id) as { id: string; email: string; role: string; status: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.status === 'active') {
    return NextResponse.json({ error: 'User is already active' }, { status: 409 })
  }

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE pending_users SET status = 'active', updated_at = ? WHERE id = ?`,
  ).run(now, id)

  return NextResponse.json({ id, email: user.email, role: user.role, status: 'active' })
}
