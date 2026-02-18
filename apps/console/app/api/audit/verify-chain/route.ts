/**
 * API — Chain Verification
 * POST /api/audit/verify-chain   → verify audit or ledger chain integrity
 *
 * Uses the @nzila/os-core verifyChain function to check append-only
 * hash chains for tamper detection.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { auditEvents, shareLedgerEntries } from '@nzila/db/schema'
import { eq, asc } from 'drizzle-orm'
import { verifyChain } from '@nzila/os-core/hash'
import { z } from 'zod'
import { requireEntityAccess } from '@/lib/api-guards'

const VerifyChainSchema = z.object({
  entityId: z.string().uuid(),
  chainType: z.enum(['audit', 'ledger']),
})

async function requireMembership(entityId: string, userId: string) {
  // Delegated to requireEntityAccess
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = VerifyChainSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { entityId, chainType } = parsed.data

  // Check authentication + entity membership (platform_admin bypasses)
  const guard = await requireEntityAccess(entityId, {
    platformBypass: ['platform_admin'],
  })
  if (!guard.ok) return guard.response

  if (chainType === 'audit') {
    const entries = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, entityId))
      .orderBy(asc(auditEvents.createdAt))

    if (entries.length === 0) {
      return NextResponse.json({
        chainType: 'audit',
        entityId,
        entryCount: 0,
        valid: true,
        message: 'No audit entries to verify.',
      })
    }

    const result = verifyChain(entries, (e) => ({
      entityId: e.entityId,
      actorClerkUserId: e.actorClerkUserId,
      actorRole: e.actorRole,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      beforeJson: e.beforeJson,
      afterJson: e.afterJson,
    }))

    return NextResponse.json({
      chainType: 'audit',
      entityId,
      entryCount: entries.length,
      ...result,
    })
  }

  if (chainType === 'ledger') {
    const entries = await db
      .select()
      .from(shareLedgerEntries)
      .where(eq(shareLedgerEntries.entityId, entityId))
      .orderBy(asc(shareLedgerEntries.createdAt))

    if (entries.length === 0) {
      return NextResponse.json({
        chainType: 'ledger',
        entityId,
        entryCount: 0,
        valid: true,
        message: 'No ledger entries to verify.',
      })
    }

    const result = verifyChain(entries, (e) => ({
      entityId: e.entityId,
      entryType: e.entryType,
      classId: e.classId,
      fromShareholderId: e.fromShareholderId,
      toShareholderId: e.toShareholderId,
      quantity: e.quantity.toString(),
      pricePerShare: e.pricePerShare,
      currency: e.currency,
      effectiveDate: e.effectiveDate,
      notes: e.notes,
    }))

    return NextResponse.json({
      chainType: 'ledger',
      entityId,
      entryCount: entries.length,
      ...result,
    })
  }

  return NextResponse.json({ error: 'Invalid chain type' }, { status: 400 })
}
