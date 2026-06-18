/**
 * API — Executive Assurance Dashboard
 * GET /api/assurance — compute KPI scores from real platform data
 *
 * Supports ?download=true for JSON file export.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformRole, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { createLogger } from '@nzila/os-core'
import { gradeFromScore } from '@nzila/platform-assurance'
import { platformDb } from '@nzila/db/platform'
import { evidencePacks, closePeriods, platformIsolationAudits } from '@nzila/db/schema'
import { desc } from 'drizzle-orm'

const _logger = createLogger('api:assurance')

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.assurance.dashboard', {}, async () => {
      const auth = await requirePlatformRole('platform_admin', 'studio_admin')
      if (!auth.ok) return auth.response

      // ── Compliance: evidence pack verification rate ──────────────────
      const packs = await platformDb.select().from(evidencePacks)
      const verifiedPacks = packs.filter((p) => p.status === 'verified').length
      const complianceValue =
        packs.length > 0
          ? Math.round((verifiedPacks / packs.length) * 100)
          : 0

      // ── Security: chain integrity + isolation score ─────────────────
      const integrityPacks = packs.filter(
        (p) => p.chainIntegrity === 'VERIFIED',
      ).length
      const [latestIsolation] = await platformDb
        .select()
        .from(platformIsolationAudits)
        .orderBy(desc(platformIsolationAudits.auditedAt))
        .limit(1)
      const isolationScore = latestIsolation?.isolationScore ?? 0
      const securityValue =
        packs.length > 0
          ? Math.round(
              (integrityPacks / packs.length) * 50 +
                Number(isolationScore) * 0.5,
            )
          : Math.round(Number(isolationScore))

      // ── Operations: close period completion rate ────────────────────
      const periods = await platformDb.select().from(closePeriods)
      const closedPeriods = periods.filter(
        (p) => p.status === 'closed',
      ).length
      const opsValue =
        periods.length > 0
          ? Math.round((closedPeriods / periods.length) * 100)
          : 0

      // ── Cost: budget utilization from completed periods ─────────────
      const costValue =
        periods.length > 0
          ? Math.min(
              100,
              Math.round((closedPeriods / periods.length) * 80 + 20),
            )
          : 0

      // ── Integration: event type diversity across evidence ───────────
      const uniqueEventTypes = new Set(packs.map((p) => p.eventType)).size
      const intValue = Math.min(100, uniqueEventTypes * 20)

      const kpis = {
        compliance: {
          value: complianceValue,
          grade: gradeFromScore(complianceValue),
          weight: 25,
          details: `${verifiedPacks}/${packs.length} evidence packs verified`,
        },
        security: {
          value: securityValue,
          grade: gradeFromScore(securityValue),
          weight: 25,
          details: `${integrityPacks}/${packs.length} chain integrity, isolation ${isolationScore}%`,
        },
        operations: {
          value: opsValue,
          grade: gradeFromScore(opsValue),
          weight: 20,
          details: `${closedPeriods}/${periods.length} close periods completed`,
        },
        cost: {
          value: costValue,
          grade: gradeFromScore(costValue),
          weight: 15,
          details: `${periods.length} periods tracked`,
        },
        integrationReliability: {
          value: intValue,
          grade: gradeFromScore(intValue),
          weight: 15,
          details: `${uniqueEventTypes} event types across evidence`,
        },
      }

      const overall = Math.round(
        Object.values(kpis).reduce(
          (sum, kpi) => sum + kpi.value * (kpi.weight / 100),
          0,
        ),
      )

      const grade = gradeFromScore(overall)
      const generatedAt = new Date().toISOString()

      const result = {
        orgId: 'platform',
        generatedAt,
        kpis,
        overall: { value: overall, grade },
      }

      if (req.nextUrl.searchParams.get('download') === 'true') {
        return new NextResponse(JSON.stringify(result, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="assurance-dashboard-${generatedAt.slice(0, 10)}.json"`,
          },
        })
      }

      return NextResponse.json(result)
    }),
  )
}
