/**
 * CLC Labour Intelligence — Data Product Services
 *
 * Governed data queries for CLC intelligence tabs:
 * - Sector signals (cross-sector clause/precedent trends)
 * - Affiliate trends (sharing adoption, activity by affiliate)
 * - Shared knowledge index (clause library + precedent metrics)
 * - Governance overview (consent, cohort health)
 *
 * Each function is designed to be called from API routes via
 * `runGovernedCrossUnionAggregation()`.
 *
 * @module lib/clc/data-products
 */

import { db } from '@/db/db';
import {
  sharedClauseLibrary,
  arbitrationPrecedents,
  crossOrgAccessLog,
  organizations,
  organizationSharingSettings,
} from '@/db/schema';
import { sql, desc, and, inArray, ne, gte, lte } from 'drizzle-orm';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SectorSignal {
  sector: string;
  clauseCount: number;
  precedentCount: number;
  totalCitations: number;
  totalViews: number;
  uniqueOrgs: number;
  /** Emerging clause types in this sector */
  topClauseTypes: { clauseType: string; count: number }[];
}

export interface AffiliateTrend {
  /** Aggregated at org-type level to prevent re-identification */
  organizationType: string;
  /** Number of affiliates in this category */
  affiliateCount: number;
  clausesShared: number;
  precedentsShared: number;
  accessesInitiated: number;
  resourcesAccessed: number;
  clauseSharingEnabledCount: number;
  precedentSharingEnabledCount: number;
}

export interface SharedKnowledgeIndex {
  totalClauses: number;
  totalPrecedents: number;
  totalCitations: number;
  totalViews: number;
  uniqueOrgs: number;
  topCited: {
    id: string;
    title: string;
    type: 'clause' | 'precedent';
    citationCount: number;
    sector: string | null;
  }[];
  clauseTypeDistribution: { name: string; value: number }[];
  outcomeDistribution: { name: string; value: number }[];
}

export interface GovernanceSummary {
  totalAffiliates: number;
  consentedCrossUnion: number;
  consentedSectorBenchmarks: number;
  consentedNationalSignals: number;
  sharingAdoption: {
    clauseSharingEnabled: number;
    precedentSharingEnabled: number;
    federationSharingEnabled: number;
  };
  cohortHealth: 'healthy' | 'marginal' | 'insufficient';
}

export interface DateFilter {
  fromDate?: string;
  toDate?: string;
}

// ── Strategic Signals ───────────────────────────────────────────────────────

export interface StrategicSignal {
  /** Type of strategic signal */
  signalType: 'emerging-trend' | 'anomaly' | 'concentration' | 'gap';
  /** Affected sector or dimension */
  dimension: string;
  /** Short headline */
  title: string;
  /** Data-backed explanation */
  detail: string;
  /** Confidence (0–1) */
  confidence: number;
}

/**
 * Derive strategic signals from sector data — trend analysis, anomaly
 * detection, and gap identification without per-org identifiers.
 */
export function deriveStrategicSignals(sectors: SectorSignal[]): StrategicSignal[] {
  if (sectors.length === 0) return [];
  const signals: StrategicSignal[] = [];

  const totalClauses = sectors.reduce((s, x) => s + x.clauseCount, 0);
  const totalPrec = sectors.reduce((s, x) => s + x.precedentCount, 0);

  // Detect concentration — any sector holding >50% of all clauses
  for (const s of sectors) {
    if (totalClauses > 0 && s.clauseCount / totalClauses > 0.5) {
      signals.push({
        signalType: 'concentration',
        dimension: s.sector,
        title: `${s.sector} dominates clause library`,
        detail: `${s.sector} holds ${((s.clauseCount / totalClauses) * 100).toFixed(0)}% of all shared clauses (${s.clauseCount}/${totalClauses}). Knowledge base may be skewed toward this sector.`,
        confidence: 0.85,
      });
    }
  }

  // Detect anomaly — unusually high precedent-to-clause ratio (>3x average)
  const avgRatio = totalClauses > 0 ? totalPrec / totalClauses : 0;
  for (const s of sectors) {
    if (s.clauseCount > 0) {
      const ratio = s.precedentCount / s.clauseCount;
      if (ratio > Math.max(avgRatio * 3, 2)) {
        signals.push({
          signalType: 'anomaly',
          dimension: s.sector,
          title: `${s.sector}: high dispute density`,
          detail: `${s.sector} has ${s.precedentCount} precedents vs. ${s.clauseCount} clauses (${ratio.toFixed(1)}x ratio, avg ${avgRatio.toFixed(1)}x). May indicate systemic bargaining challenges.`,
          confidence: 0.7,
        });
      }
    }
  }

  // Detect gaps — sectors with views but very few clauses (demand ≫ supply)
  for (const s of sectors) {
    if (s.totalViews > 0 && s.clauseCount > 0) {
      const viewsPerClause = s.totalViews / s.clauseCount;
      if (viewsPerClause > 10 && s.clauseCount < 5) {
        signals.push({
          signalType: 'gap',
          dimension: s.sector,
          title: `${s.sector}: high demand, low supply`,
          detail: `${s.totalViews} views on just ${s.clauseCount} clauses (${viewsPerClause.toFixed(0)} views/clause). More clause contributions needed for this sector.`,
          confidence: 0.75,
        });
      }
    }
  }

  // Emerging trends — sectors where top clause type represents >60% of clauses
  for (const s of sectors) {
    if (s.topClauseTypes.length > 0 && s.clauseCount > 0) {
      const topType = s.topClauseTypes[0];
      if (topType.count / s.clauseCount > 0.6 && topType.count >= 3) {
        signals.push({
          signalType: 'emerging-trend',
          dimension: s.sector,
          title: `${s.sector}: "${topType.clauseType}" clause surge`,
          detail: `"${topType.clauseType}" accounts for ${((topType.count / s.clauseCount) * 100).toFixed(0)}% of ${s.sector} clauses (${topType.count}/${s.clauseCount}). Indicates concentrated bargaining interest.`,
          confidence: 0.65,
        });
      }
    }
  }

  return signals;
}

// ── Sector Signals ──────────────────────────────────────────────────────────

export async function querySectorSignals(
  consentedOrgIds: string[],
  _filters?: DateFilter,
): Promise<SectorSignal[]> {
  if (consentedOrgIds.length === 0) return [];

  const orgFilter = inArray(sharedClauseLibrary.sourceOrganizationId, consentedOrgIds);
  const notPrivate = ne(sharedClauseLibrary.sharingLevel, 'private');

  // Get sector-level aggregates from clauses
  const clausesBySector = await db
    .select({
      sector: sharedClauseLibrary.sector,
      clauseCount: sql<number>`count(*)::int`,
      totalCitations: sql<number>`coalesce(sum(${sharedClauseLibrary.citationCount}), 0)::int`,
      totalViews: sql<number>`coalesce(sum(${sharedClauseLibrary.viewCount}), 0)::int`,
      uniqueOrgs: sql<number>`count(distinct ${sharedClauseLibrary.sourceOrganizationId})::int`,
    })
    .from(sharedClauseLibrary)
    .where(and(orgFilter, notPrivate))
    .groupBy(sharedClauseLibrary.sector)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  // Get precedent counts by sector (for consented orgs)
  const precOrgFilter = inArray(arbitrationPrecedents.sourceOrganizationId, consentedOrgIds);
  const precNotPrivate = ne(arbitrationPrecedents.sharingLevel, 'private');

  const precedentsBySector = await db
    .select({
      sector: arbitrationPrecedents.sector,
      precedentCount: sql<number>`count(*)::int`,
    })
    .from(arbitrationPrecedents)
    .where(and(precOrgFilter, precNotPrivate))
    .groupBy(arbitrationPrecedents.sector);

  const precedentMap = new Map(precedentsBySector.map((p) => [p.sector, p.precedentCount]));

  // Get top clause types per sector
  const clauseTypesBySector = await db
    .select({
      sector: sharedClauseLibrary.sector,
      clauseType: sharedClauseLibrary.clauseType,
      count: sql<number>`count(*)::int`,
    })
    .from(sharedClauseLibrary)
    .where(and(orgFilter, notPrivate))
    .groupBy(sharedClauseLibrary.sector, sharedClauseLibrary.clauseType)
    .orderBy(sharedClauseLibrary.sector, desc(sql`count(*)`));

  // Group clause types by sector
  const clauseTypeMap = new Map<string, { clauseType: string; count: number }[]>();
  for (const row of clauseTypesBySector) {
    const sector = row.sector ?? 'unknown';
    const existing = clauseTypeMap.get(sector) ?? [];
    if (existing.length < 5) {
      existing.push({ clauseType: row.clauseType ?? 'unknown', count: row.count });
    }
    clauseTypeMap.set(sector, existing);
  }

  return clausesBySector.map((row) => ({
    sector: row.sector ?? 'unknown',
    clauseCount: row.clauseCount,
    precedentCount: precedentMap.get(row.sector) ?? 0,
    totalCitations: row.totalCitations,
    totalViews: row.totalViews,
    uniqueOrgs: row.uniqueOrgs,
    topClauseTypes: clauseTypeMap.get(row.sector ?? 'unknown') ?? [],
  }));
}

// ── Affiliate Trends ────────────────────────────────────────────────────────

export async function queryAffiliateTrends(
  consentedOrgIds: string[],
  filters?: DateFilter,
): Promise<AffiliateTrend[]> {
  if (consentedOrgIds.length === 0) return [];

  const orgFilter = inArray(organizations.id, consentedOrgIds);

  // Count affiliates per org type
  const orgTypeCounts = await db
    .select({
      organizationType: organizations.organizationType,
      affiliateCount: sql<number>`count(*)::int`,
    })
    .from(organizations)
    .where(orgFilter)
    .groupBy(organizations.organizationType);

  // Clause counts aggregated by org type
  const clauseByType = await db
    .select({
      organizationType: organizations.organizationType,
      total: sql<number>`count(*)::int`,
    })
    .from(sharedClauseLibrary)
    .innerJoin(organizations, sql`${organizations.id} = ${sharedClauseLibrary.sourceOrganizationId}`)
    .where(
      and(
        inArray(sharedClauseLibrary.sourceOrganizationId, consentedOrgIds),
        ne(sharedClauseLibrary.sharingLevel, 'private'),
      ),
    )
    .groupBy(organizations.organizationType);

  // Precedent counts aggregated by org type
  const precByType = await db
    .select({
      organizationType: organizations.organizationType,
      total: sql<number>`count(*)::int`,
    })
    .from(arbitrationPrecedents)
    .innerJoin(organizations, sql`${organizations.id} = ${arbitrationPrecedents.sourceOrganizationId}`)
    .where(
      and(
        inArray(arbitrationPrecedents.sourceOrganizationId, consentedOrgIds),
        ne(arbitrationPrecedents.sharingLevel, 'private'),
      ),
    )
    .groupBy(organizations.organizationType);

  // Access activity aggregated by org type
  const dateConditions = [];
  if (filters?.fromDate) dateConditions.push(gte(crossOrgAccessLog.createdAt, new Date(filters.fromDate)));
  if (filters?.toDate) dateConditions.push(lte(crossOrgAccessLog.createdAt, new Date(filters.toDate)));

  const accessByType = await db
    .select({
      organizationType: organizations.organizationType,
      initiated: sql<number>`count(*)::int`,
      accessed: sql<number>`count(distinct ${crossOrgAccessLog.resourceId})::int`,
    })
    .from(crossOrgAccessLog)
    .innerJoin(organizations, sql`${organizations.id} = ${crossOrgAccessLog.userOrganizationId}`)
    .where(
      and(
        inArray(crossOrgAccessLog.userOrganizationId, consentedOrgIds),
        ...dateConditions,
      ),
    )
    .groupBy(organizations.organizationType);

  // Sharing settings aggregated by org type
  const sharingByType = await db
    .select({
      organizationType: organizations.organizationType,
      clauseEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoShareClauses} = true)::int`,
      precedentEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoSharePrecedents} = true)::int`,
    })
    .from(organizationSharingSettings)
    .innerJoin(organizations, sql`${organizations.id} = ${organizationSharingSettings.organizationId}`)
    .where(inArray(organizationSharingSettings.organizationId, consentedOrgIds))
    .groupBy(organizations.organizationType);

  // Merge by org type
  const clauseMap = new Map(clauseByType.map((c) => [c.organizationType, c.total]));
  const precMap = new Map(precByType.map((p) => [p.organizationType, p.total]));
  const accessMap = new Map(accessByType.map((a) => [a.organizationType, { initiated: a.initiated, accessed: a.accessed }]));
  const sharingMap = new Map(sharingByType.map((s) => [s.organizationType, s]));

  return orgTypeCounts.map((ot) => ({
    organizationType: ot.organizationType ?? 'local',
    affiliateCount: ot.affiliateCount,
    clausesShared: clauseMap.get(ot.organizationType) ?? 0,
    precedentsShared: precMap.get(ot.organizationType) ?? 0,
    accessesInitiated: accessMap.get(ot.organizationType)?.initiated ?? 0,
    resourcesAccessed: accessMap.get(ot.organizationType)?.accessed ?? 0,
    clauseSharingEnabledCount: sharingMap.get(ot.organizationType)?.clauseEnabled ?? 0,
    precedentSharingEnabledCount: sharingMap.get(ot.organizationType)?.precedentEnabled ?? 0,
  }));
}

// ── Shared Knowledge Index ──────────────────────────────────────────────────

export async function querySharedKnowledgeIndex(
  consentedOrgIds: string[],
): Promise<SharedKnowledgeIndex> {
  if (consentedOrgIds.length === 0) {
    return {
      totalClauses: 0,
      totalPrecedents: 0,
      totalCitations: 0,
      totalViews: 0,
      uniqueOrgs: 0,
      topCited: [],
      clauseTypeDistribution: [],
      outcomeDistribution: [],
    };
  }

  const clauseFilter = and(
    inArray(sharedClauseLibrary.sourceOrganizationId, consentedOrgIds),
    ne(sharedClauseLibrary.sharingLevel, 'private'),
  );
  const precFilter = and(
    inArray(arbitrationPrecedents.sourceOrganizationId, consentedOrgIds),
    ne(arbitrationPrecedents.sharingLevel, 'private'),
  );

  const [clauseStats, precStats, topClauses, topPrecedents, clauseTypeDist, outcomeDist] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          citations: sql<number>`coalesce(sum(${sharedClauseLibrary.citationCount}), 0)::int`,
          views: sql<number>`coalesce(sum(${sharedClauseLibrary.viewCount}), 0)::int`,
          orgs: sql<number>`count(distinct ${sharedClauseLibrary.sourceOrganizationId})::int`,
        })
        .from(sharedClauseLibrary)
        .where(clauseFilter)
        .then((r) => r[0]),

      db
        .select({
          total: sql<number>`count(*)::int`,
          citations: sql<number>`coalesce(sum(${arbitrationPrecedents.citationCount}), 0)::int`,
          views: sql<number>`coalesce(sum(${arbitrationPrecedents.viewCount}), 0)::int`,
        })
        .from(arbitrationPrecedents)
        .where(precFilter)
        .then((r) => r[0]),

      db
        .select({
          id: sharedClauseLibrary.id,
          title: sharedClauseLibrary.clauseTitle,
          citationCount: sharedClauseLibrary.citationCount,
          sector: sharedClauseLibrary.sector,
        })
        .from(sharedClauseLibrary)
        .where(clauseFilter)
        .orderBy(desc(sharedClauseLibrary.citationCount))
        .limit(5),

      db
        .select({
          id: arbitrationPrecedents.id,
          title: arbitrationPrecedents.caseTitle,
          citationCount: arbitrationPrecedents.citationCount,
          sector: arbitrationPrecedents.sector,
        })
        .from(arbitrationPrecedents)
        .where(precFilter)
        .orderBy(desc(arbitrationPrecedents.citationCount))
        .limit(5),

      db
        .select({
          name: sharedClauseLibrary.clauseType,
          value: sql<number>`count(*)::int`,
        })
        .from(sharedClauseLibrary)
        .where(clauseFilter)
        .groupBy(sharedClauseLibrary.clauseType)
        .orderBy(desc(sql`count(*)`))
        .limit(10),

      db
        .select({
          name: arbitrationPrecedents.outcome,
          value: sql<number>`count(*)::int`,
        })
        .from(arbitrationPrecedents)
        .where(precFilter)
        .groupBy(arbitrationPrecedents.outcome)
        .orderBy(desc(sql`count(*)`)),
    ]);

  const topCited = [
    ...topClauses.map((c) => ({
      id: c.id,
      title: c.title ?? 'Untitled',
      type: 'clause' as const,
      citationCount: c.citationCount ?? 0,
      sector: c.sector,
    })),
    ...topPrecedents.map((p) => ({
      id: p.id,
      title: p.title ?? 'Untitled',
      type: 'precedent' as const,
      citationCount: p.citationCount ?? 0,
      sector: p.sector,
    })),
  ]
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, 10);

  return {
    totalClauses: clauseStats?.total ?? 0,
    totalPrecedents: precStats?.total ?? 0,
    totalCitations: (clauseStats?.citations ?? 0) + (precStats?.citations ?? 0),
    totalViews: (clauseStats?.views ?? 0) + (precStats?.views ?? 0),
    uniqueOrgs: clauseStats?.orgs ?? 0,
    topCited,
    clauseTypeDistribution: clauseTypeDist.map((d) => ({
      name: d.name ?? 'unknown',
      value: d.value,
    })),
    outcomeDistribution: outcomeDist.map((d) => ({
      name: d.name ?? 'unknown',
      value: d.value,
    })),
  };
}

// ── Governance Summary ──────────────────────────────────────────────────────

export async function queryGovernanceSummary(
  consentedCrossUnion: string[],
  consentedSectorBenchmarks: string[],
  consentedNationalSignals: string[],
): Promise<GovernanceSummary> {
  const [sharingResult] = await db
    .select({
      totalOrgs: sql<number>`count(*)::int`,
      clauseSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoShareClauses} = true)::int`,
      precedentSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoSharePrecedents} = true)::int`,
      federationSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.allowFederationSharing} = true)::int`,
    })
    .from(organizationSharingSettings);

  const totalAffiliates = sharingResult?.totalOrgs ?? 0;
  const minCohort = 5;
  const cohortHealth =
    consentedCrossUnion.length >= minCohort * 2
      ? 'healthy'
      : consentedCrossUnion.length >= minCohort
        ? 'marginal'
        : 'insufficient';

  return {
    totalAffiliates,
    consentedCrossUnion: consentedCrossUnion.length,
    consentedSectorBenchmarks: consentedSectorBenchmarks.length,
    consentedNationalSignals: consentedNationalSignals.length,
    sharingAdoption: {
      clauseSharingEnabled: sharingResult?.clauseSharingEnabled ?? 0,
      precedentSharingEnabled: sharingResult?.precedentSharingEnabled ?? 0,
      federationSharingEnabled: sharingResult?.federationSharingEnabled ?? 0,
    },
    cohortHealth,
  };
}
