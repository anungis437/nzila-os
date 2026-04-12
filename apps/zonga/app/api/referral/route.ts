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
  type ReferralRepository,
  type ReferralCode,
  type ReferralConversion,
  type ConversionType,
  type RewardStatus,
} from '@nzila/zonga-growth'

function buildReferralRepo(_orgId: string): ReferralRepository {
  return {
    findCode: async (orgId: string, code: string) => {
      const [row] = (await platformDb.execute(sql`
        SELECT id, code, referrer_id as "referrerId", org_id as "orgId",
               campaign_id as "campaignId", created_at as "createdAt",
               expires_at as "expiresAt", max_uses as "maxUses",
               current_uses as "currentUses", is_active as "isActive"
        FROM zonga_referral_codes
        WHERE code = ${code} AND org_id = ${orgId}
        LIMIT 1
      `)) as unknown as [Record<string, unknown> | undefined]
      if (!row) return null
      return {
        code: String(row.code),
        referrerId: String(row.referrerId),
        orgId: String(row.orgId),
        campaignId: row.campaignId ? String(row.campaignId) : null,
        createdAt: String(row.createdAt),
        expiresAt: row.expiresAt ? String(row.expiresAt) : null,
        maxUses: row.maxUses != null ? Number(row.maxUses) : null,
        currentUses: Number(row.currentUses ?? 0),
        isActive: Boolean(row.isActive),
      } as ReferralCode
    },

    insertCode: async (code: Omit<ReferralCode, 'currentUses'>) => {
      await platformDb.execute(sql`
        INSERT INTO zonga_referral_codes (code, referrer_id, org_id, campaign_id, max_uses, expires_at, is_active)
        VALUES (${code.code}, ${code.referrerId}, ${code.orgId}, ${code.campaignId},
                ${code.maxUses}, ${code.expiresAt}::timestamptz, true)
      `)
      return { ...code, currentUses: 0 } as ReferralCode
    },

    incrementCodeUses: async (orgId: string, code: string) => {
      await platformDb.execute(sql`
        UPDATE zonga_referral_codes SET current_uses = current_uses + 1
        WHERE code = ${code} AND org_id = ${orgId}
      `)
    },

    deactivateCode: async (orgId: string, code: string) => {
      await platformDb.execute(sql`
        UPDATE zonga_referral_codes SET is_active = false
        WHERE code = ${code} AND org_id = ${orgId}
      `)
    },

    listCodesByReferrer: async (orgId: string, referrerId: string) => {
      const rows = (await platformDb.execute(sql`
        SELECT code, referrer_id as "referrerId", org_id as "orgId",
               campaign_id as "campaignId", created_at as "createdAt",
               expires_at as "expiresAt", max_uses as "maxUses",
               current_uses as "currentUses", is_active as "isActive"
        FROM zonga_referral_codes
        WHERE org_id = ${orgId} AND referrer_id = ${referrerId}
        ORDER BY created_at DESC
      `)) as Array<Record<string, unknown>>
      return rows.map((r) => ({
        code: String(r.code),
        referrerId: String(r.referrerId),
        orgId: String(r.orgId),
        campaignId: r.campaignId ? String(r.campaignId) : null,
        createdAt: String(r.createdAt),
        expiresAt: r.expiresAt ? String(r.expiresAt) : null,
        maxUses: r.maxUses != null ? Number(r.maxUses) : null,
        currentUses: Number(r.currentUses ?? 0),
        isActive: Boolean(r.isActive),
      })) as ReferralCode[]
    },

    insertConversion: async (conversion: Omit<ReferralConversion, 'id'>) => {
      const id = crypto.randomUUID()
      await platformDb.execute(sql`
        INSERT INTO zonga_referral_conversions (id, org_id, referral_code, referrer_id,
          referred_user_id, converted_at, conversion_type, reward_status, reward_amount, reward_currency)
        VALUES (${id}, ${conversion.orgId}, ${conversion.referralCode},
                ${conversion.referrerId}, ${conversion.referredUserId},
                ${conversion.convertedAt}::timestamptz, ${conversion.conversionType},
                ${conversion.rewardStatus}, ${conversion.rewardAmount}, ${conversion.rewardCurrency})
      `)
      return { id, ...conversion } as ReferralConversion
    },

    findConversion: async (orgId: string, referredUserId: string, conversionType: ConversionType) => {
      const [row] = (await platformDb.execute(sql`
        SELECT id FROM zonga_referral_conversions
        WHERE org_id = ${orgId} AND referred_user_id = ${referredUserId}
          AND conversion_type = ${conversionType}
        LIMIT 1
      `)) as unknown as [Record<string, unknown> | undefined]
      return row ? ({ id: String(row.id) } as ReferralConversion) : null
    },

    listConversions: async (orgId: string, referrerId: string) => {
      const rows = (await platformDb.execute(sql`
        SELECT id, conversion_type as "conversionType", reward_amount as "rewardAmount"
        FROM zonga_referral_conversions
        WHERE org_id = ${orgId} AND referrer_id = ${referrerId}
      `)) as Array<Record<string, unknown>>
      return rows as unknown as readonly ReferralConversion[]
    },

    updateRewardStatus: async (id: string, status: RewardStatus) => {
      await platformDb.execute(sql`
        UPDATE zonga_referral_conversions SET reward_status = ${status} WHERE id = ${id}
      `)
    },

    countConversions: async (orgId: string, referrerId: string) => {
      const [row] = (await platformDb.execute(sql`
        SELECT COUNT(*) as count FROM zonga_referral_conversions
        WHERE org_id = ${orgId} AND referrer_id = ${referrerId}
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
      const repo = buildReferralRepo(ctx.orgId)

      const codes = await repo.listCodesByReferrer(ctx.orgId, ctx.userId)
      const totalConversions = await repo.countConversions(ctx.orgId, ctx.userId)

      return NextResponse.json({
        ok: true,
        data: {
          codes,
          totalCodes: codes.length,
          totalConversions,
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

      const repo = buildReferralRepo(ctx.orgId)
      const service = createReferralService({ repo })

      if (parsed.data.action === 'create') {
        const result = await service.createCode({
          orgId: ctx.orgId,
          referrerId: ctx.userId,
          campaignId: null,
          maxUses: parsed.data.maxUses,
          expiryDays: parsed.data.expiresInDays,
        })

        logger.info('Referral code created', { userId: ctx.userId, code: result.code })
        return NextResponse.json({ ok: true, data: result }, { status: 201 })
      }

      // Redeem
      const result = await service.redeem({
        code: parsed.data.code,
        orgId: ctx.orgId,
        referredUserId: ctx.userId,
        conversionType: parsed.data.eventType,
      })

      logger.info('Referral code redeemed', { userId: ctx.userId, code: parsed.data.code })
      return NextResponse.json({ ok: true, data: result })
    }),
  )
}
