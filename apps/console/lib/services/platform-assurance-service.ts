import { platformDb } from '@nzila/db/platform'
import { evidencePacks, closePeriods, platformIsolationAudits } from '@nzila/db/schema'
import { desc } from 'drizzle-orm'
import { gradeFromScore } from '@nzila/platform-assurance'

export async function readExecutiveAssurance() {
  // ── Compliance: evidence pack verification rate ──────────────────
  const packs = await platformDb.select().from(evidencePacks)
  const verifiedPacks = packs.filter((p) => p.status === 'verified').length
  const complianceValue = packs.length > 0 ? Math.round((verifiedPacks / packs.length) * 100) : 0

  // ── Security: chain integrity + isolation score ─────────────────
  const integrityPacks = packs.filter((p) => p.chainIntegrity === 'VERIFIED').length
  const [latestIsolation] = await platformDb
    .select()
    .from(platformIsolationAudits)
    .orderBy(desc(platformIsolationAudits.auditedAt))
    .limit(1)
  const isolationScore = latestIsolation?.isolationScore ?? 0
  const securityValue =
    packs.length > 0
      ? Math.round((integrityPacks / packs.length) * 50 + Number(isolationScore) * 0.5)
      : Math.round(Number(isolationScore))

  // ── Operations: close period completion rate ────────────────────
  const periods = await platformDb.select().from(closePeriods)
  const closedPeriods = periods.filter((p) => p.status === 'closed').length
  const opsValue = periods.length > 0 ? Math.round((closedPeriods / periods.length) * 100) : 0

  // ── Cost: budget utilization from completed periods ─────────────
  const costValue =
    periods.length > 0 ? Math.min(100, Math.round((closedPeriods / periods.length) * 80 + 20)) : 0

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
    Object.values(kpis).reduce((sum, kpi) => sum + kpi.value * (kpi.weight / 100), 0),
  )

  const grade = gradeFromScore(overall)
  const generatedAt = new Date().toISOString()

  const result = {
    orgId: 'platform',
    generatedAt,
    kpis,
    overall: { value: overall, grade },
  }

  return result
}

export async function listPlatformEvidencePacks() {
  const packs = await platformDb.select().from(evidencePacks).orderBy(desc(evidencePacks.createdAt))

  return packs
}
