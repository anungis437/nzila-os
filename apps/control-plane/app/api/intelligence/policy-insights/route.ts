import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { requireIntelligenceTier } from '@/lib/intelligence-access'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { aggregateDecisionRecords } from '@nzila/decision-intelligence'
import { detectPolicyDrift, scorePolicy, suggestPolicyImprovements } from '@nzila/policy-intelligence'

type AggregateRecord = Parameters<typeof aggregateDecisionRecords>[0][number]

function mapAuditRow(row: typeof auditRecords.$inferSelect): AggregateRecord {
  return {
    organizationId: row.organizationId,
    decisionType: row.decisionType,
    policyVersion: row.policyVersion,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload as AggregateRecord['payload'],
  }
}

export async function GET(request: NextRequest) {
  try {
    if (request.headers.has('x-api-key')) {
      await requireApiAuth(request)
    }

    const auth = await requireAuditReadAuth(request)
    const tier = requireIntelligenceTier(request, 'pro')
    const orgId = request.nextUrl.searchParams.get('orgId')
    const decisionType = request.nextUrl.searchParams.get('decisionType')
    const oldVersion = request.nextUrl.searchParams.get('oldVersion')
    const newVersion = request.nextUrl.searchParams.get('newVersion')
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    if (!orgId || !decisionType) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'orgId and decisionType are required' } }, { status: 400 })
    }

    if (auth.role === 'auditor' && auth.organizationId !== orgId) {
      return NextResponse.json({ ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'Auditor token is scoped to another organization' } }, { status: 403 })
    }

    const filters = [eq(auditRecords.organizationId, orgId), eq(auditRecords.decisionType, decisionType)]
    if (from) filters.push(gte(auditRecords.createdAt, new Date(from)))
    if (to) filters.push(lte(auditRecords.createdAt, new Date(to)))

    const rows = await platformDb
      .select()
      .from(auditRecords)
      .where(and(...filters))
      .orderBy(asc(auditRecords.createdAt))
      .limit(5000)

    const aggregates = aggregateDecisionRecords(rows.map(mapAuditRow), {
      windowStart: from ?? rows[0]?.createdAt.toISOString(),
      windowEnd: to ?? rows.at(-1)?.createdAt.toISOString(),
    })

    const latestVersion = [...aggregates]
      .filter((aggregate) => aggregate.decisionType === decisionType)
      .sort((left, right) => right.timeWindow.end.localeCompare(left.timeWindow.end))[0]?.policy.version

    const scoredVersion = newVersion ?? latestVersion ?? oldVersion ?? 'unknown'
    const score = scorePolicy({ decisionType, policyVersion: scoredVersion, aggregates })
    const recommendations = suggestPolicyImprovements({ decisionType, aggregates })
    const drift = oldVersion && newVersion
      ? detectPolicyDrift({ decisionType, oldVersion, newVersion, aggregates })
      : undefined

    return NextResponse.json({
      ok: true,
      data: {
        orgId,
        tier,
        score,
        drift,
        recommendations,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}