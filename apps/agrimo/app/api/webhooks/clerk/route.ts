/**
 * Auth webhook — verifies the Svix envelope before dispatching identity sync.
 */
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createLogger } from '@nzila/os-core'
import {
  handleOrganizationCreated,
  handleOrganizationUpdated,
  handleMembershipCreated,
  handleMembershipDeleted,
  handleUserDeleted,
} from '@/lib/services/identity-sync-service'

const logger = createLogger('agrimo:auth-webhook')

function verifyWebhookSignature(
  payload: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string },
  secret: string,
): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const toSign = `${headers.svixId}.${headers.svixTimestamp}.${payload}`
  const expectedSignature = createHmac('sha256', secretBytes)
    .update(toSign, 'utf8').digest('base64')
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

function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  return Math.abs(now - ts) < 300
}

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
        logger.info('[auth-webhook] User event received')
        break
      default:
        logger.info('[auth-webhook] Unhandled event')
    }
  } catch {
    logger.error('[auth-webhook] Handler error')
    return NextResponse.json({ error: 'Internal handler error' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
