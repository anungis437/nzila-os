import { NextRequest, NextResponse } from 'next/server'
import { resolveActor, hasPermission } from '@/lib/access-control'
import { getMaestriaDb } from '@/lib/maestria-persistence'

export async function POST(req: NextRequest) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams)
  const actor = resolveActor(searchParams)
  if (!hasPermission(actor, 'user.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string; role?: string }
  try {
    body = (await req.json()) as { email?: string; role?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, role } = body
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (!role || typeof role !== 'string') {
    return NextResponse.json({ error: 'role is required' }, { status: 400 })
  }

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

  const existing = db
    .prepare('SELECT id, status FROM pending_users WHERE email = ?')
    .get(email) as { id: string; status: string } | undefined

  if (existing) {
    return NextResponse.json(
      { error: 'User with this email already exists', status: existing.status },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const id = `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
  db.prepare(
    `INSERT INTO pending_users (id, email, role, status, invited_by, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(id, email, role, actor.id ?? 'system', now, now)

  return NextResponse.json({ id, email, role, status: 'pending' }, { status: 201 })
}
