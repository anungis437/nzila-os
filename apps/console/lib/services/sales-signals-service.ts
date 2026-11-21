import { platformDb } from '@nzila/db/platform'
import { commerceQuotes, pilotAlerts, pilotDefinitions, pilotHealthScores } from '@nzila/db/schema'
import { and, count, eq, gte, sql } from 'drizzle-orm'
export async function collectSalesSignals() {
  const now = new Date()
  const plus30 = new Date(now)
  plus30.setDate(plus30.getDate() + 30)

  const [activePilotsRes, pilotsEndingRes, highRiskRes, openSlaRes, draftQuotesRes, sentQuotesRes] =
    await Promise.all([
      platformDb
        .select({ cnt: count() })
        .from(pilotDefinitions)
        .where(eq(pilotDefinitions.status, 'active')),
      platformDb
        .select({ cnt: count() })
        .from(pilotDefinitions)
        .where(
          and(
            eq(pilotDefinitions.status, 'active'),
            gte(pilotDefinitions.targetEndAt, now),
            sql`${pilotDefinitions.targetEndAt} <= ${plus30}`,
          ),
        ),
      platformDb
        .select({ cnt: count() })
        .from(pilotHealthScores)
        .where(sql`${pilotHealthScores.riskLevel} in ('high', 'critical')`),
      platformDb
        .select({ cnt: count() })
        .from(pilotAlerts)
        .where(sql`${pilotAlerts.resolvedAt} is null and ${pilotAlerts.alertType} ilike '%sla%'`),
      platformDb
        .select({ cnt: count() })
        .from(commerceQuotes)
        .where(eq(commerceQuotes.status, 'draft')),
      platformDb
        .select({ cnt: count() })
        .from(commerceQuotes)
        .where(eq(commerceQuotes.status, 'sent')),
    ])
  return {
    status: 200,
    body: {
      ok: true,
      exportedAt: new Date().toISOString(),
      signals: {
        activePilots: Number(activePilotsRes[0]?.cnt ?? 0),
        pilotsEndingIn30d: Number(pilotsEndingRes[0]?.cnt ?? 0),
        highRiskPilots: Number(highRiskRes[0]?.cnt ?? 0),
        unresolvedSlaAlerts: Number(openSlaRes[0]?.cnt ?? 0),
        draftQuotes: Number(draftQuotesRes[0]?.cnt ?? 0),
        sentQuotes: Number(sentQuotesRes[0]?.cnt ?? 0),
      },
    },
  }
}
