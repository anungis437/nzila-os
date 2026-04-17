import { NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { orgMembers, platformCostRollups } from '@nzila/db/schema'
import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import { authenticateUser } from '@/lib/api-guards'

function isoDayOffset(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response

    const { userId } = authResult
    const memberships = await platformDb
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, 'active')))

    const orgIds = memberships.map((m) => m.orgId)
    if (orgIds.length === 0) {
      return NextResponse.json({ rollups: [] })
    }

    const sinceDay = isoDayOffset(29)
    const rollups = await platformDb
      .select({
        orgId: platformCostRollups.orgId,
        appId: platformCostRollups.appId,
        category: platformCostRollups.category,
        day: platformCostRollups.day,
        totalUnits: platformCostRollups.totalUnits,
        totalEstCostUsd: platformCostRollups.totalEstCostUsd,
        eventCount: platformCostRollups.eventCount,
      })
      .from(platformCostRollups)
      .where(
        and(
          inArray(platformCostRollups.orgId, orgIds),
          gte(platformCostRollups.day, sinceDay),
        ),
      )
      .orderBy(asc(platformCostRollups.day))

    return NextResponse.json({ rollups })
  } catch {
    return NextResponse.json({ rollups: [] })
  }
}