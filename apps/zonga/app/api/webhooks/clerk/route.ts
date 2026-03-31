/**
 * Clerk Webhook Handler — Zonga
 *
 * Receives Clerk webhook events and syncs user/org/membership data
 * to the platform database. Uses Svix HMAC-SHA256 signature verification.
 *
 * Events handled:
 *   - user.created / user.updated / user.deleted
 *   - organization.created / organization.updated
 *   - organizationMembership.created / organizationMembership.updated / organizationMembership.deleted
 */
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('zonga:clerk-webhook')

/* ── Svix signature verification ─────────────────────────────────────────── */

function verifyWebhookSignature(
  payload: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string },
  secret: string,
): boolean {
  // Decode secret (strip whsec_ prefix, base64 decode)
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')

  const toSign = `${headers.svixId}.${headers.svixTimestamp}.${payload}`
  const expectedSignature = createHmac('sha256', secretBytes)
    .update(toSign, 'utf8')
    .digest('base64')

  // Svix may send multiple signatures separated by spaces
  const signatures = headers.svixSignature.split(' ')
  for (const versionedSig of signatures) {
    const [, sig] = versionedSig.split(',')
    if (!sig) continue
    try {
      const sigBuffer = Buffer.from(sig, 'base64')
      const expectedBuffer = Buffer.from(expectedSignature, 'base64')
      if (sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer)) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

/* ── Timestamp tolerance (5 minutes) ─────────────────────────────────────── */

function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  return Math.abs(now - ts) < 300
}

/* ── Clerk → DB role mapping ──────────────────────────────────────────────── */

function mapClerkRole(clerkRole: string): 'admin' | 'manager' | 'member' {
  switch (clerkRole) {
    case 'org:admin': return 'admin'
    case 'org:manager':
    case 'org:secretary': return 'manager'
    default: return 'member'
  }
}

/* ── Event handlers ──────────────────────────────────────────────────────── */

async function handleOrganizationCreated(data: Record<string, unknown>) {
  const clerkOrgId = data.id as string
  const name = (data.name as string) ?? 'Unnamed Organization'

  // Upsert org — link Clerk org ID to platform org
  const existing = await platformDb.execute(
    sql`SELECT id FROM organizations WHERE clerk_org_id = ${clerkOrgId} LIMIT 1`,
  )

  if ((existing as unknown[]).length === 0) {
    await platformDb.execute(
      sql`INSERT INTO organizations (name, clerk_org_id, organization_type, status, created_at, updated_at)
          VALUES (${name}, ${clerkOrgId}, 'local', 'active', NOW(), NOW())`,
    )
    logger.info('[clerk-webhook] Organization created', { detail: clerkOrgId })
  }
}

async function handleOrganizationUpdated(data: Record<string, unknown>) {
  const clerkOrgId = data.id as string
  const name = (data.name as string) ?? undefined

  if (name) {
    await platformDb.execute(
      sql`UPDATE organizations SET name = ${name}, updated_at = NOW() WHERE clerk_org_id = ${clerkOrgId}`,
    )
    logger.info('[clerk-webhook] Organization updated', { detail: clerkOrgId })
  }
}

async function handleMembershipCreated(data: Record<string, unknown>) {
  const orgData = data.organization as Record<string, unknown> | undefined
  const userData = data.public_user_data as Record<string, unknown> | undefined
  const clerkOrgId = orgData?.id as string | undefined
  const clerkUserId = userData?.user_id as string | undefined
  const role = (data.role as string) ?? 'org:member'

  if (!clerkOrgId || !clerkUserId) {
    logger.warn('[clerk-webhook] Membership created missing org/user data')
    return
  }

  // Resolve org UUID from Clerk org ID
  const org = await platformDb.execute(
    sql`SELECT id FROM organizations WHERE clerk_org_id = ${clerkOrgId} LIMIT 1`,
  )
  const orgRow = (org as unknown as { id: string }[])[0]

  if (!orgRow) {
    logger.warn('[clerk-webhook] Membership created for unknown org', { detail: clerkOrgId })
    return
  }

  const orgId = orgRow.id
  const mappedRole = mapClerkRole(role)

  // Upsert member
  const existing = await platformDb.execute(
    sql`SELECT id FROM organization_members WHERE organization_id = ${orgId}::text AND user_id = ${clerkUserId} LIMIT 1`,
  )
  const existingRow = (existing as unknown as { id: string }[])[0]

  if (!existingRow) {
    await platformDb.execute(
      sql`INSERT INTO organization_members (user_id, organization_id, role, status, created_at, updated_at)
          VALUES (${clerkUserId}, ${orgId}::text, ${mappedRole}, 'active', NOW(), NOW())`,
    )
  } else {
    await platformDb.execute(
      sql`UPDATE organization_members SET role = ${mappedRole}, status = 'active', updated_at = NOW() WHERE id = ${existingRow.id}`,
    )
  }

  logger.info('[clerk-webhook] Membership created/updated', { detail: `${clerkUserId} → ${clerkOrgId}` })
}

async function handleMembershipDeleted(data: Record<string, unknown>) {
  const orgData = data.organization as Record<string, unknown> | undefined
  const userData = data.public_user_data as Record<string, unknown> | undefined
  const clerkOrgId = orgData?.id as string | undefined
  const clerkUserId = userData?.user_id as string | undefined

  if (!clerkOrgId || !clerkUserId) return

  const org = await platformDb.execute(
    sql`SELECT id FROM organizations WHERE clerk_org_id = ${clerkOrgId} LIMIT 1`,
  )
  const orgRow = (org as unknown as { id: string }[])[0]

  if (!orgRow) return

  await platformDb.execute(
    sql`UPDATE organization_members SET status = 'removed', updated_at = NOW()
        WHERE organization_id = ${orgRow.id}::text AND user_id = ${clerkUserId}`,
  )

  logger.info('[clerk-webhook] Membership removed', { detail: `${clerkUserId} from ${clerkOrgId}` })
}

async function handleUserDeleted(data: Record<string, unknown>) {
  const clerkUserId = data.id as string
  if (!clerkUserId) return

  // Mark all memberships as removed
  await platformDb.execute(
    sql`UPDATE organization_members SET status = 'removed', updated_at = NOW() WHERE user_id = ${clerkUserId}`,
  )

  logger.info('[clerk-webhook] User deleted — memberships removed', { detail: clerkUserId })
}

/* ── POST handler ────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    logger.error('[clerk-webhook] CLERK_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 })
  }

  if (!isTimestampValid(svixTimestamp)) {
    return NextResponse.json({ error: 'Timestamp outside tolerance' }, { status: 400 })
  }

  const body = await request.text()

  if (!verifyWebhookSignature(body, { svixId, svixTimestamp, svixSignature }, secret)) {
    logger.warn('[clerk-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body) as { type: string; data: Record<string, unknown> }

  try {
    switch (event.type) {
      case 'organization.created':
        await handleOrganizationCreated(event.data)
        break
      case 'organization.updated':
        await handleOrganizationUpdated(event.data)
        break
      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await handleMembershipCreated(event.data)
        break
      case 'organizationMembership.deleted':
        await handleMembershipDeleted(event.data)
        break
      case 'user.deleted':
        await handleUserDeleted(event.data)
        break
      case 'user.created':
      case 'user.updated':
        // Logged for audit trail — no DB action needed until user joins an org
        logger.info(`[clerk-webhook] ${event.type}`, { detail: event.data.id })
        break
      default:
        logger.info(`[clerk-webhook] Unhandled event: ${event.type}`)
    }
  } catch (err) {
    logger.error('[clerk-webhook] Handler error', { detail: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'Internal handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
