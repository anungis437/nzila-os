/**
 * Auth Webhook Handler — Agrimo
 *
 * Receives auth provider webhook events and syncs user/org/membership data
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
import { orgs, orgMembers } from '@nzila/db'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('agrimo:auth-webhook')

/* ── Svix signature verification ─────────────────────────────────────────── */

function verifyWebhookSignature(
  payload: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string },
  secret: string,
): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')

  const toSign = `${headers.svixId}.${headers.svixTimestamp}.${payload}`
  const expectedSignature = createHmac('sha256', secretBytes)
    .update(toSign, 'utf8')
    .digest('base64')

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

/* ── Auth → DB role mapping ──────────────────────────────────────────── */

function mapAuthRole(authRole: string): 'org_admin' | 'org_secretary' | 'org_viewer' {
  switch (authRole) {
    case 'org:admin': return 'org_admin'
    case 'org:secretary': return 'org_secretary'
    default: return 'org_viewer'
  }
}

/* ── Event handlers ──────────────────────────────────────────────────────── */

async function handleOrganizationCreated(data: Record<string, unknown>) {
  const clerkOrgId = data.id as string
  const name = (data.name as string) ?? 'Unnamed Organization'

  const existing = await platformDb
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.clerkOrgId, clerkOrgId))
    .limit(1)

  if (existing.length === 0) {
    await platformDb.insert(orgs).values({
      clerkOrgId,
      legalName: name,
      jurisdiction: 'CA-ON',
      status: 'active',
    })
    logger.info('[auth-webhook] Organization created', { detail: clerkOrgId })
  }
}

async function handleOrganizationUpdated(data: Record<string, unknown>) {
  const clerkOrgId = data.id as string
  const name = (data.name as string) ?? undefined

  if (name) {
    await platformDb
      .update(orgs)
      .set({ legalName: name, updatedAt: new Date() })
      .where(eq(orgs.clerkOrgId, clerkOrgId))
    logger.info('[auth-webhook] Organization updated', { detail: clerkOrgId })
  }
}

async function handleMembershipCreated(data: Record<string, unknown>) {
  const orgData = data.organization as Record<string, unknown> | undefined
  const userData = data.public_user_data as Record<string, unknown> | undefined
  const clerkOrgId = orgData?.id as string | undefined
  const clerkUserId = userData?.user_id as string | undefined
  const role = (data.role as string) ?? 'org:member'

  if (!clerkOrgId || !clerkUserId) {
    logger.warn('[auth-webhook] Membership created missing org/user data')
    return
  }

  const org = await platformDb
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.clerkOrgId, clerkOrgId))
    .limit(1)

  if (org.length === 0) {
    logger.warn('[auth-webhook] Membership created for unknown org', { detail: clerkOrgId })
    return
  }

  const orgId = org[0].id
  const mappedRole = mapAuthRole(role)

  const existing = await platformDb
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, clerkUserId)))
    .limit(1)

  if (existing.length === 0) {
    await platformDb.insert(orgMembers).values({
      orgId,
      userId: clerkUserId,
      role: mappedRole,
      status: 'active',
    })
  } else {
    await platformDb
      .update(orgMembers)
      .set({ role: mappedRole, status: 'active', updatedAt: new Date() })
      .where(eq(orgMembers.id, existing[0].id))
  }

  logger.info('[auth-webhook] Membership created/updated', { detail: `${clerkUserId} → ${clerkOrgId}` })
}

async function handleMembershipDeleted(data: Record<string, unknown>) {
  const orgData = data.organization as Record<string, unknown> | undefined
  const userData = data.public_user_data as Record<string, unknown> | undefined
  const clerkOrgId = orgData?.id as string | undefined
  const clerkUserId = userData?.user_id as string | undefined

  if (!clerkOrgId || !clerkUserId) return

  const org = await platformDb
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.clerkOrgId, clerkOrgId))
    .limit(1)

  if (org.length === 0) return

  await platformDb
    .update(orgMembers)
    .set({ status: 'removed', updatedAt: new Date() })
    .where(and(eq(orgMembers.orgId, org[0].id), eq(orgMembers.userId, clerkUserId)))

  logger.info('[auth-webhook] Membership removed', { detail: `${clerkUserId} from ${clerkOrgId}` })
}

async function handleUserDeleted(data: Record<string, unknown>) {
  const clerkUserId = data.id as string
  if (!clerkUserId) return

  await platformDb
    .update(orgMembers)
    .set({ status: 'removed', updatedAt: new Date() })
    .where(eq(orgMembers.userId, clerkUserId))

  logger.info('[auth-webhook] User deleted — memberships removed', { detail: clerkUserId })
}

/* ── POST handler ────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  const secret = process.env.AUTH_WEBHOOK_SECRET ?? process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    logger.error('[auth-webhook] AUTH_WEBHOOK_SECRET not configured')
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
    logger.warn('[auth-webhook] Invalid signature')
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
        logger.info(`[auth-webhook] ${event.type}`, { detail: event.data.id })
        break
      default:
        logger.info(`[auth-webhook] Unhandled event: ${event.type}`)
    }
  } catch (err) {
    logger.error('[auth-webhook] Handler error', { detail: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'Internal handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
