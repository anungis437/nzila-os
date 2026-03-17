/**
 * ShopMoiCa Share Link Service
 *
 * Generates, validates, and manages secure share links for customer-facing
 * quote approval. Tokens are SHA-256 hashed server-side; the raw token
 * is returned only once at creation time.
 *
 * Fully Drizzle-backed — share links persist across server restarts.
 */
import { z } from 'zod'
import {
  db,
  commerceShareLinks,
} from '@nzila/db'
import { eq, sql } from 'drizzle-orm'
import type {
  QuoteShareLink,
  CreateShareLinkInput,
} from '@/lib/schemas/workflow-schemas'
import { logger } from '@/lib/logger'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { SHOPMOICA_SETTINGS } from '@nzila/platform-commerce-org/defaults'

// ── Helpers ────────────────────────────────────────────────────────────────

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function mapShareLinkRow(row: typeof commerceShareLinks.$inferSelect): QuoteShareLink {
  return {
    id: row.id,
    quoteId: row.quoteId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    status: row.status as QuoteShareLink['status'],
    accessCount: row.accessCount,
    lastAccessedAt: row.lastAccessedAt ?? null,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface ShareLinkCreateResult {
  link: QuoteShareLink
  rawToken: string
}

/**
 * Create a secure share link for a quote.
 * Returns the link record and the raw token (shown once to the user).
 */
export async function createShareLink(
  input: CreateShareLinkInput,
  orgId: string,
): Promise<ShareLinkCreateResult> {
  const parsed = z.object({
    quoteId: z.string().uuid(),
    expiresInDays: z.number().int().min(1).max(90).default(SHOPMOICA_SETTINGS.shareLinkExpiryDays),
    createdBy: z.string().min(1),
  }).parse(input)

  const rawToken = generateSecureToken()
  const tokenHash = await hashToken(rawToken)
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + parsed.expiresInDays)

  const id = crypto.randomUUID()

  const [row] = await db
    .insert(commerceShareLinks)
    .values({
      id,
      orgId,
      quoteId: parsed.quoteId,
      tokenHash,
      status: 'ACTIVE',
      expiresAt,
      accessCount: 0,
      lastAccessedAt: null,
      createdBy: parsed.createdBy,
      createdAt: now,
    })
    .returning()

  const link = mapShareLinkRow(row)

  emitWorkflowAuditEvent({
    event: 'quote_share_link_created',
    quoteId: parsed.quoteId,
    orgId,
    userId: parsed.createdBy,
    metadata: { shareLinkId: link.id, expiresAt: expiresAt.toISOString() },
  })

  logger.info('Share link created', { quoteId: parsed.quoteId, shareLinkId: link.id })

  return { link, rawToken }
}

/**
 * Validate a raw token and return the share link if valid.
 * Updates access count and timestamp on successful validation.
 */
export async function validateShareLink(
  rawToken: string,
): Promise<{ ok: true; link: QuoteShareLink } | { ok: false; reason: string }> {
  if (!rawToken || rawToken.length < 16) {
    return { ok: false, reason: 'Invalid token format' }
  }

  const tokenHash = await hashToken(rawToken)

  const [row] = await db
    .select()
    .from(commerceShareLinks)
    .where(eq(commerceShareLinks.tokenHash, tokenHash))
    .limit(1)

  if (!row) {
    return { ok: false, reason: 'Link not found' }
  }

  if (row.status === 'REVOKED') {
    return { ok: false, reason: 'This link has been revoked' }
  }

  if (row.status === 'EXPIRED' || row.expiresAt < new Date()) {
    if (row.status !== 'EXPIRED') {
      await db
        .update(commerceShareLinks)
        .set({ status: 'EXPIRED' })
        .where(eq(commerceShareLinks.id, row.id))
    }
    return { ok: false, reason: 'This link has expired' }
  }

  // Update access tracking atomically
  const [updated] = await db
    .update(commerceShareLinks)
    .set({
      accessCount: sql`${commerceShareLinks.accessCount} + 1`,
      lastAccessedAt: new Date(),
    })
    .where(eq(commerceShareLinks.id, row.id))
    .returning()

  return { ok: true, link: mapShareLinkRow(updated) }
}

/**
 * Revoke a share link by ID.
 */
export async function revokeShareLink(linkId: string, userId: string, orgId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(commerceShareLinks)
    .where(eq(commerceShareLinks.id, linkId))
    .limit(1)

  if (!row) return false

  await db
    .update(commerceShareLinks)
    .set({ status: 'REVOKED' })
    .where(eq(commerceShareLinks.id, linkId))

  emitWorkflowAuditEvent({
    event: 'quote_share_link_created',
    quoteId: row.quoteId,
    orgId,
    userId,
    metadata: { shareLinkId: linkId, action: 'revoked' },
  })

  logger.info('Share link revoked', { shareLinkId: linkId })
  return true
}

/**
 * Mark a share link as used (after approval/revision submitted).
 */
export async function markShareLinkUsed(linkId: string): Promise<void> {
  await db
    .update(commerceShareLinks)
    .set({ status: 'USED' })
    .where(eq(commerceShareLinks.id, linkId))
}

/**
 * Find share links for a quote.
 */
export async function findShareLinksForQuote(quoteId: string): Promise<QuoteShareLink[]> {
  const rows = await db
    .select()
    .from(commerceShareLinks)
    .where(eq(commerceShareLinks.quoteId, quoteId))

  return rows
    .map(mapShareLinkRow)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * Get a share link by ID.
 */
export async function getShareLink(linkId: string): Promise<QuoteShareLink | undefined> {
  const [row] = await db
    .select()
    .from(commerceShareLinks)
    .where(eq(commerceShareLinks.id, linkId))
    .limit(1)

  return row ? mapShareLinkRow(row) : undefined
}
