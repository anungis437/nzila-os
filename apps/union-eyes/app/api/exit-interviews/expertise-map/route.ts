// cognition-governance-ci: allow-route-bypass — Bespoke DB aggregation with keyword classification; not a registered engine.
/**
 * GET /api/exit-interviews/expertise-map
 *
 * Returns aggregated expertise domain distribution across all published
 * exit interviews for the requesting organization.
 *
 * Shows which expertise areas have single-person coverage vs multi-person
 * redundancy — enabling organizational resilience analysis.
 *
 * This reflects ORGANIZATIONAL DEPENDENCY STRUCTURE.
 * It does NOT evaluate individual employees.
 *
 * Access: steward+
 */

import { withApi } from '@/lib/api/framework';
import { derivedAnalyticsCondition } from '@/lib/knowledge-transfer/governance/interview-access';
import { meetsMinimumCohort } from '@/lib/knowledge-transfer/governance/evidence-basis';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';

export const dynamic = 'force-dynamic';

const SYSTEM_KEYWORDS = ['system', 'software', 'platform', 'tool', 'database', 'tracker', 'portal'];
const VENDOR_KEYWORDS = ['vendor', 'provider', 'contractor', 'supplier', 'partner', 'insurer'];
const GOVERNANCE_KEYWORDS = ['committee', 'policy', 'bylaw', 'procedure', 'regulation', 'obligation'];
const COMPLIANCE_KEYWORDS = ['wsib', 'ohsa', 'esa', 'privacy', 'legal', 'arbitration', 'grievance'];

function categorizeDomain(tag: string): string {
  const lower = tag.toLowerCase();
  if (SYSTEM_KEYWORDS.some((k) => lower.includes(k))) return 'system';
  if (VENDOR_KEYWORDS.some((k) => lower.includes(k))) return 'vendor';
  if (GOVERNANCE_KEYWORDS.some((k) => lower.includes(k))) return 'governance';
  if (COMPLIANCE_KEYWORDS.some((k) => lower.includes(k))) return 'compliance';
  return 'operational';
}

/**
 * Coverage-concentration level: how many people have ever discussed this domain, not a measured risk assessment.
 * "critical"/"high" here mean "structurally single/thin-sourced", independent of whether the domain is
 * substantively important or whether any interview recorded an actual continuity risk score for it - see
 * hasRiskData/averageRiskScore on the same record for the (separate, possibly absent) measured-risk signal.
 */
function coverageConcentrationLevel(coverageCount: number, isSingleSource: boolean): 'low' | 'medium' | 'high' | 'critical' {
  if (isSingleSource) return coverageCount === 1 ? 'critical' : 'high';
  if (coverageCount <= 2) return 'medium';
  return 'low';
}

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get expertise domain map',
      description:
        'Aggregated expertise domain coverage across all published exit interviews. Shows organizational dependency concentration.',
    },
  },
  async ({ organizationId }) => {
    const published = await db
      .select({
        id: exitInterviews.id,
        roleInUnion: exitInterviews.roleInUnion,
        expertiseTags: exitInterviews.expertiseTags,
        topics: exitInterviews.topics,
        continuityRiskScore: exitInterviews.continuityRiskScore,
      })
      .from(exitInterviews)
      .where(derivedAnalyticsCondition(organizationId!));

    // Aggregate expertise tags into domain coverage map
    const domainMap = new Map<
      string,
      { coverageCount: number; roles: Set<string>; totalRisk: number; riskCount: number }
    >();

    for (const interview of published) {
      const allTags = [
        ...(interview.expertiseTags ?? []),
        ...(interview.topics ?? []),
      ].map((t) => t.toLowerCase().trim()).filter(Boolean);

      const seenInThisInterview = new Set<string>();
      for (const tag of allTags) {
        if (seenInThisInterview.has(tag)) continue;
        seenInThisInterview.add(tag);

        const existing = domainMap.get(tag);
        if (existing) {
          existing.coverageCount++;
          existing.roles.add(interview.roleInUnion);
          if (interview.continuityRiskScore != null) {
            existing.totalRisk += interview.continuityRiskScore;
            existing.riskCount++;
          }
        } else {
          domainMap.set(tag, {
            coverageCount: 1,
            roles: new Set([interview.roleInUnion]),
            totalRisk: interview.continuityRiskScore ?? 0,
            riskCount: interview.continuityRiskScore != null ? 1 : 0,
          });
        }
      }
    }

    const domains = [...domainMap.entries()].map(([domain, data]) => {
      const isSingleSource = data.coverageCount === 1;
      const category = categorizeDomain(domain);
      // Below the minimum cohort, the role list names a specific one or few departing people rather than an
      // organizational pattern - the same small-cell convention applied elsewhere (e.g. succession-analyzer.ts)
      // (DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS: "returns the roles of the one interview behind
      // a single-source tag").
      const rolesSuppressed = !meetsMinimumCohort(data.coverageCount);
      return {
        domain,
        category,
        coverageCount: data.coverageCount,
        roles: rolesSuppressed ? [] : [...data.roles],
        rolesSuppressed,
        isSingleSource,
        // 0 is a real possible average, so a reader cannot tell "no interview for this domain carried a risk score" from
        // "the recorded risk is zero" by the number alone - hasRiskData names which one this is.
        hasRiskData: data.riskCount > 0,
        averageRiskScore:
          data.riskCount > 0 ? Math.round(data.totalRisk / data.riskCount) : 0,
        coverageConcentrationLevel: coverageConcentrationLevel(data.coverageCount, isSingleSource),
      };
    });

    // Sort: critical first, then by coverage count ascending (least covered = most fragile)
    domains.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      const riskDiff = order[a.coverageConcentrationLevel] - order[b.coverageConcentrationLevel];
      if (riskDiff !== 0) return riskDiff;
      return a.coverageCount - b.coverageCount;
    });

    const categoryBreakdown: Record<string, number> = {};
    for (const d of domains) {
      categoryBreakdown[d.category] = (categoryBreakdown[d.category] ?? 0) + 1;
    }

    return {
      organizationId: organizationId!,
      generatedAt: new Date().toISOString(),
      totalPublishedInterviews: published.length,
      domains,
      singleSourceDomains: domains.filter((d) => d.isSingleSource).map((d) => d.domain),
      wellCoveredDomains: domains.filter((d) => d.coverageCount >= 3).map((d) => d.domain),
      categoryBreakdown,
    };
  },
);
