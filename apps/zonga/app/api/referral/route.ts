/**
 * API — /api/referral
 *
 * GET    → Get referral stats for the current user
 * POST   → Create a referral code or redeem one
 *
 * Uses zonga-growth referral system: tiered rewards, code generation,
 * validation, and redemption tracking.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import {
  createReferralService,
  type ReferralPort,
} from '@nzila/zonga-growth'

function buildReferralPort(): ReferralPort {
  return {
    findCodeByValue: async (code: string) => {
      const [row] = (await platformDb.execute(sql`
        SELECT id, code, owner_id as "ownerId", status,
               max_uses as "maxUses", current_uses as "currentUses",
               expires_at as "expiresAt", created_at as "createdAt"
        FROM zonga_referral_codes
        WHERE code = ${code}
        LIMIT 1
      `)) as unknown as [{ id: string; code: string; ownerId: string; status: string; maxUses: number; currentUses: number; expiresAt: string | null; createdAt: string } | undefined]
      if (!row) return null
      return {
        id: row.id,
        code: row.code,
        ownerId: row.ownerId,
        status: row.status as 'active' | 'inactive' | 'expired',
        maxUses: row.maxUses,
        currentUses: row.currentUses,
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
        createdAt: new Date(row.createdAt),
      }
    },

    findCodesByOwner: async (ownerId: string) => {
      const rows = (await platformDb.execute(sql`
        SELECT id, code, owner_id as "ownerId", status,
               max_uses as "maxUses", current_uses as "currentUses",
               expires_at as "expiresAt", created_at as "createdAt"
        FROM zonga_referral_codes
        WHERE owner_id = ${ownerId}
        ORDER BY created_at DESC
      `)) as Array<{ id: string; code: string; ownerId: string; status: string; maxUses: number; currentUses: number; expiresAt: string | null; createdAt: string }>
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        ownerId: r.ownerId,
        status: r.status as 'active' | 'inactive' | 'expired',
        maxUses: r.maxUses,
        currentUses: r.currentUses,
        expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined,
        createdAt: new Date(r.createdAt),
      }))
    },

    saveCode: async (code) => {
      await platformDb.execute(sql`
        INSERT INTO zonga_referral_codes (id, code, owner_id, status, max_uses, current_uses, expires_at)
        VALUES (${code.id}, ${code.code}, ${code.ownerId}, ${code.status},
                ${code.maxUses}, ${code.currentUses},
                ${code.expiresAt ? code.expiresAt.toISOString() : null}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          current_uses = EXCLUDED.current_uses,
          expires_at = EXCLUDED.expires_at
      `)
    },

    hasRedeemed: async (userId: string, code: string) => {
      const [row] = (await platformDb.execute(sql`
        SELECT id FROM zonga_referral_redemptions
        WHERE user_id = ${userId} AND code = ${code}
        LIMIT 1
      `)) as unknown as [{ id: string } | undefined]
      return !!row
    },

    saveRedemption: async (redemption) => {
      await platformDb.execute(sql`
        INSERT INTO zonga_referral_redemptions (id, code, user_id, referrer_id, event_type, reward_amount, created_at)
        VALUES (${redemption.id}, ${redemption.code}, ${redemption.userId},
                ${redemption.referrerId}, ${redemption.eventType},
                ${redemption.rewardAmount}, ${redemption.createdAt.toISOString()}::timestamptz)
      `)
    },

    getRedemptionCount: async (code: string) => {
      const [row] = (await platformDb.execute(sql`
        SELECT COUNT(*) as count FROM zonga_referral_redemptions WHERE code = ${code}
      `)) as unknown as [{ count: number }]
      return Number(row?.count ?? 0)
    },
  }
}

const RedeemSchema = z.object({
  action: z.literal('redeem'),
  code: z.string().min(1),
  eventType: z.enum(['signup', 'first_stream', 'first_purchase', 'subscription']).default('signup'),
})

const CreateSchema = z.object({
  action: z.literal('create'),
  maxUses: z.number().int().positive().default(50),
  expiresInDays: z.number().int().positive().default(90),
})

const ActionSchema = z.discriminatedUnion('action', [RedeemSchema, CreateSchema])

export async function GET(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.referral.stats', { 'http.method': 'GET' }, async () => {
      const port = buildReferralPort()

      const codes = await port.findCodesByOwner(ctx.userId)
      const stats = await Promise.all(
        codes.map(async (c) => {
          const redemptions = await port.getRedemptionCount(c.code)
          return { ...c, redemptions }
        }),
      )

      return NextResponse.json({
        ok: true,
        data: {
          codes: stats,
          totalCodes: stats.length,
          totalRedemptions: stats.reduce((sum, c) => sum + c.redemptions, 0),
        },
      })
    }),
  )
}

export async function POST(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.referral.action', { 'http.method': 'POST' }, async () => {
      const body = await request.json()
      const parsed = ActionSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
      }

      const port = buildReferralPort()
      const service = createReferralService(port)

      if (parsed.data.action === 'create') {
        const result = await service.createCode({
          ownerId: ctx.userId,
          maxUses: parsed.data.maxUses,
          expiresInDays: parsed.data.expiresInDays,
        })

        logger.info('Referral code created', { userId: ctx.userId, code: result.code })
        return NextResponse.json({ ok: true, data: result }, { status: 201 })
      }

      // Redeem
      const result = await service.redeem({
        code: parsed.data.code,
        userId: ctx.userId,
        eventType: parsed.data.eventType,
      })

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
      }

      logger.info('Referral code redeemed', { userId: ctx.userId, code: parsed.data.code })
      return NextResponse.json({ ok: true, data: result })
    }),
  )
}
