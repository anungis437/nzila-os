/**
 * Smart Onboarding & Hierarchy Discovery Utilities
 * 
 * Provides intelligent features for organization onboarding:
 * - Auto-discover parent federation from CLC directory
 * - Suggest relevant clauses based on hierarchy
 * - Peer benchmarking
 * - Smart defaults based on sector/province
 * 
 * Implements recommendations from Hierarchy Engine Assessment (Feb 2026)
 */

import { db } from '@/db/db';
import { organizations, sharedClauseLibrary } from '@/db/schema';
import { eq, ne, and, desc, inArray, or, gte, sql, type SQL } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { cacheGet, cacheSet } from '@/lib/services/cache-service';
import { buildClauseVisibilityCondition, isUuid, sourceNamesFor } from '@/lib/clause-library/sharing-authority';
import { clauseSourceProjection } from '@/lib/clause-library/source-projection';

// =============================================================================
// TYPES
// =============================================================================

type _Organization = InferSelectModel<typeof organizations>;

export interface FederationSuggestion {
  id: string;
  name: string;
  organizationType: string;
  province: string | null;
  jurisdiction: string | null;
  /** A band, never the exact member count: a prospective affiliate learns the scale of a federation, not its roll. */
  sizeBand: string;
  matchScore: number;
  matchReasons: string[];
}

export interface ClauseSuggestion {
  clauseId: string;
  clauseTitle: string;
  clauseType: string;
  sourceOrgName: string;
  sharingLevel: string;
  relevanceScore: number;
  relevanceReasons: string[];
}

export interface PeerBenchmark {
  metricName: string;
  yourValue: number;
  peerAverage: number;
  nationalAverage: number | null;
  percentile: number;
  category: string;
}

export interface SmartDefaults {
  suggestedRateLimits: {
    apiCallsPerDay: number;
    documentsPerMonth: number;
    storageGb: number;
  };
  recommendedFeatures: string[];
  suggestedIntegrations: string[];
}

// =============================================================================
// AUTO-DISCOVER PARENT FEDERATION
// =============================================================================

/** The smaller of two member counts must be at least this share of the larger for the sizes to be called similar. */
const SIMILAR_SIZE_RATIO = 0.5;

/**
 * What a prospective affiliate may see of a federation or congress. The directory is not a property of the asker's organization or
 * role: an officer of any organization asks, and a federation decides whether it is offered. A federation or congress is listed only
 * when its own administrators turned listing on (`settings.affiliation.discoverable`, set through the organization settings patch they
 * already hold), and what is shown is the minimum needed to recognise it: its name, type, province and a size band. `approvedBy` stays
 * null until the institution decides what the directory may disclose; until then no federation is listed by default.
 */
export const FEDERATION_DIRECTORY_POLICY = Object.freeze({
  listing: 'opt_in' as const,
  settingsKey: 'affiliation.discoverable',
  disclosedFields: Object.freeze(['id', 'name', 'organizationType', 'province', 'sizeBand'] as const),
  approvedBy: null as string | null,
});

/** Whether the organization's own settings turn listing on. Anything but an explicit true is off. */
export function isFederationListed(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const affiliation = (settings as { affiliation?: unknown }).affiliation;
  return Boolean(affiliation && typeof affiliation === 'object' && (affiliation as { discoverable?: unknown }).discoverable === true);
}

const SIZE_BANDS: ReadonlyArray<readonly [number, string]> = [
  [100, 'under 100'],
  [500, '100 to 499'],
  [1_000, '500 to 999'],
  [5_000, '1,000 to 4,999'],
  [20_000, '5,000 to 19,999'],
];

export function sizeBand(count: number | null | undefined): string {
  if (!count || count <= 0) return 'not stated';
  for (const [limit, label] of SIZE_BANDS) if (count < limit) return label;
  return '20,000 or more';
}

/**
 * Auto-detect potential parent federation based on province, sector, and size
 * 
 * The read is an explicit cross-organization read as the system role, limited by the directory policy above: only federations and
 * congresses that opted in, only the columns the suggestion needs. It does not depend on what the connection's database role happens
 * to let a tenant see.
 * 
 * @param province - Province code (e.g., 'ON', 'BC')
 * @param sector - Industry sector
 * @param estimatedMemberCount - Approximate member count
 * @returns Array of federation suggestions sorted by relevance
 */
export async function autoDetectParentFederation(
  province: string | null,
  sector: string | null,
  estimatedMemberCount?: number
): Promise<FederationSuggestion[]> {
  try {
    // Query for federations in the same province/sector
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [
      or(
        eq(organizations.organizationType, 'federation'),
        eq(organizations.organizationType, 'congress')
      ),
      eq(organizations.status, 'active'),
      // Containment, not a text comparison: only a JSON boolean true lists a federation, never the string "true" or the number 1.
      sql`${organizations.settings} @> '{"affiliation":{"discoverable":true}}'::jsonb`,
    ];

    if (province) {
      filters.push(eq(organizations.provinceTerritory, province.toUpperCase()));
    }

    const potentialParents = await withSystemContext((tx) =>
      tx.query.organizations.findMany({
        columns: { id: true, name: true, organizationType: true, provinceTerritory: true, clcAffiliated: true, sectors: true, memberCount: true },
        where: and(...filters),
        orderBy: (org, { desc }) => [desc(org.memberCount)],
        limit: 10,
      }),
    );

    // Score and rank suggestions
    const suggestions: FederationSuggestion[] = potentialParents.map((org) => {
      const matchReasons: string[] = [];
      let matchScore = 0;

      // Province match (high weight)
      if (province && org.provinceTerritory?.toUpperCase() === province.toUpperCase()) {
        matchScore += 40;
        matchReasons.push(`Same province (${province})`);
      }

      // CLC affiliation (important for congress-level access)
      if (org.clcAffiliated) {
        matchScore += 30;
        matchReasons.push('CLC affiliated');
      }

      // Sector (the federation's sectors name the trades it represents)
      if (sector && (org.sectors ?? []).some((s) => s.toLowerCase() === sector.toLowerCase())) {
        matchScore += 25;
        matchReasons.push(`Represents the ${sector} sector`);
      }

      // Size proximity: the score follows the ratio, and the reason is stated only when the sizes really are close.
      if (estimatedMemberCount && org.memberCount) {
        const sizeRatio = Math.min(estimatedMemberCount, org.memberCount) /
                         Math.max(estimatedMemberCount, org.memberCount);
        matchScore += sizeRatio * 20;
        if (sizeRatio >= SIMILAR_SIZE_RATIO) matchReasons.push('Similar size');
      }

      // Organization type bonus
      if (org.organizationType === 'federation') {
        matchScore += 10;
        matchReasons.push('Provincial federation');
      }

      return {
        id: org.id,
        name: org.name,
        organizationType: org.organizationType,
        province: org.provinceTerritory,
        jurisdiction: org.provinceTerritory,
        sizeBand: sizeBand(org.memberCount),
        matchScore,
        matchReasons,
      };
    });

    // Sort by match score
    return suggestions.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    logger.error('Failed to auto-detect parent federation', { error });
    throw error;
  }
}

// =============================================================================
// SMART CLAUSE DISCOVERY
// =============================================================================

/** What each reason adds to a clause's score. Only reasons that tell clauses apart carry a weight. */
const SUGGESTION_WEIGHTS = {
  public: 20,
  sharedWithOrganization: 40,
  // Per step towards the organization along its hierarchy path; the parent is the nearest ancestor and scores most.
  proximityStep: 15,
} as const;

const UNDISCLOSED_SOURCE = 'Another organization (source not disclosed)';
const UNKNOWN_SOURCE = 'Unknown organization';

/**
 * Suggest relevant clauses from parent federation and peer organizations: the clauses of other organizations that this organization may
 * already read (public ones, and private ones that name it), in its own sector and province, ranked by how they reached it and how close
 * their owner is in its hierarchy. The federation and congress sharing levels carry no weight and no reason, because no other organization
 * can read a clause at those levels (lib/clause-library/sharing-authority.ts). The sector and province are filters, so they add nothing to
 * the ranking and are not listed as reasons. An organization that has parents is offered its parents' clauses; one that has none is offered
 * every clause it may read. A clause that is anonymized or unclassified never names its source.
 * 
 * @param organizationId - Current organization ID
 * @returns Array of clause suggestions with relevance scoring
 */
export async function suggestRelevantClauses(
  organizationId: string
): Promise<ClauseSuggestion[]> {
  try {
    // As the caller's tenant: the row policy decides which clauses this organization may read (its own, public ones, and private ones that name
    // it), the same rule the clause library routes apply. Nothing here widens that, so no clause is scored that the organization could not open.
    const { ancestors, rows } = await withRLSContext({ organizationId }, async (tx) => {
      const [org] = await tx
        .select({ sectors: organizations.sectors, provinceTerritory: organizations.provinceTerritory, hierarchyPath: organizations.hierarchyPath })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        throw new Error('Organization not found');
      }

      // The path runs from the root to the organization itself, so the ancestors are every entry but the last.
      const ancestors = (org.hierarchyPath ?? []).filter((id) => id !== organizationId && isUuid(id));
      const orgSector = org.sectors && org.sectors.length > 0 ? org.sectors[0] : null;

      // Clauses of other organizations only: suggesting an organization its own clause is no suggestion.
      const filters: SQL[] = [await buildClauseVisibilityCondition(organizationId), ne(sharedClauseLibrary.sourceOrganizationId, organizationId)];
      if (orgSector) filters.push(eq(sharedClauseLibrary.sector, orgSector));
      if (org.provinceTerritory) filters.push(eq(sharedClauseLibrary.province, org.provinceTerritory.toUpperCase()));
      if (ancestors.length > 0) {
        filters.push(inArray(sharedClauseLibrary.sourceOrganizationId, ancestors));
        // Being drawn from the parents is itself a statement about the source, which an anonymized or unclassified clause does not make.
        filters.push(eq(sharedClauseLibrary.isAnonymized, false));
      }

      const rows = await tx
        .select({
          id: sharedClauseLibrary.id,
          clauseTitle: sharedClauseLibrary.clauseTitle,
          clauseType: sharedClauseLibrary.clauseType,
          sharingLevel: sharedClauseLibrary.sharingLevel,
          sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
          isAnonymized: sharedClauseLibrary.isAnonymized,
        })
        .from(sharedClauseLibrary)
        .where(and(...filters))
        .orderBy(desc(sharedClauseLibrary.createdAt))
        .limit(50);

      return { ancestors, rows };
    });

    // The policy admits only these two levels for another organization. A row at any other level is not a suggestion, whatever reached this point.
    const readable = rows.filter((clause) => clause.sharingLevel === 'public' || clause.sharingLevel === 'private');

    // Names are read only for clauses whose source the projection may disclose; the others are labelled, never guessed.
    const names = await sourceNamesFor(readable, organizationId);

    const suggestions: ClauseSuggestion[] = readable.map((clause) => {
      const relevanceReasons: string[] = [];
      let relevanceScore = 0;
      const sourceDisclosed = clauseSourceProjection(clause, organizationId) !== undefined;

      // A private clause of another organization is readable here only because it names this organization in its grant list.
      if (clause.sharingLevel === 'public') {
        relevanceScore += SUGGESTION_WEIGHTS.public;
        relevanceReasons.push('Publicly available');
      } else {
        relevanceScore += SUGGESTION_WEIGHTS.sharedWithOrganization;
        relevanceReasons.push('Shared with your organization');
      }

      // A closer ancestor is worth more: the path is ordered root first, so the last ancestor is the parent. Said only for a source that may be named.
      const ancestorIndex = sourceDisclosed ? ancestors.indexOf(clause.sourceOrganizationId) : -1;
      if (ancestorIndex >= 0) {
        relevanceScore += (ancestorIndex + 1) * SUGGESTION_WEIGHTS.proximityStep;
        relevanceReasons.push('From parent organization');
      }

      return {
        clauseId: clause.id,
        clauseTitle: clause.clauseTitle,
        clauseType: clause.clauseType,
        sourceOrgName: sourceDisclosed ? names.get(clause.sourceOrganizationId) ?? UNKNOWN_SOURCE : UNDISCLOSED_SOURCE,
        sharingLevel: clause.sharingLevel,
        relevanceScore,
        relevanceReasons,
      };
    });

    // The sort is stable, so equally scored clauses keep their newest-first order.
    return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 20);
  } catch (error) {
    logger.error('Failed to suggest relevant clauses', { error });
    throw error;
  }
}

// =============================================================================
// PEER BENCHMARKING
// =============================================================================

/**
 * Find peer organizations based on size, sector, and province
 * 
 * @param organizationId - Current organization ID
 * @returns Array of peer organization IDs
 */
export async function findPeerOrganizations(
  organizationId: string
): Promise<string[]> {
  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [
      eq(organizations.status, 'active'),
    ];

    // Same organization type
    if (org.organizationType) {
      filters.push(eq(organizations.organizationType, org.organizationType));
    }

    const hasSectorFilter = Array.isArray(org.sectors) && org.sectors.length > 0;

    // Same province
    if (org.provinceTerritory) {
      filters.push(eq(organizations.provinceTerritory, org.provinceTerritory));
    }

    // Similar size (within 3x range)
    if (org.memberCount) {
      const lowerBound = Math.floor(org.memberCount / 3);
      const upperBound = org.memberCount * 3;
      filters.push(
        and(
          gte(organizations.memberCount, lowerBound),
          sql`${organizations.memberCount} <= ${upperBound}`
        )
      );
    }

    const peers = await db.query.organizations.findMany({
      where: and(...filters),
      columns: { id: true, sectors: true },
      limit: 20,
    });

    const sectorFilteredPeers = hasSectorFilter
      ? peers.filter((peer) =>
          Array.isArray(peer.sectors) &&
          peer.sectors.some((sector) => org.sectors?.includes(sector))
        )
      : peers;

    return sectorFilteredPeers.map(p => p.id).filter(id => id !== organizationId);
  } catch (error) {
    logger.error('Failed to find peer organizations', { error });
    throw error;
  }
}

// =============================================================================
// CLC API INTEGRATION
// =============================================================================

/**
 * Fetch national average metrics from CLC API
 * Results are cached for 24 hours to minimize API calls
 * 
 * @param metric - The metric to fetch (e.g., 'memberCount', 'perCapitaRate')
 * @param sector - Optional sector filter (e.g., 'public', 'private')
 * @returns National average value or null if unavailable
 */
async function fetchNationalAverage(
  metric: string,
  sector?: string
): Promise<number | null> {
  const cacheKey = `clc:national-avg:${metric}${sector ? `:${sector}` : ''}`;
  
  try {
    // Check cache first (24 hour TTL)
    const cached = await cacheGet<number>(cacheKey, { namespace: 'clc-api' });
    if (typeof cached === 'number' && Number.isFinite(cached) && cached >= 0) {
      logger.info('[CLC API] Using cached national average', { metric, sector, value: cached });
      return cached;
    }
    if (cached != null) logger.warn('[CLC API] Ignoring invalid cached national average', { metric, sector });

    const CLC_API_URL = process.env.CLC_API_URL;
    const CLC_API_KEY = process.env.CLC_API_KEY;

    // Never assume an external benchmark endpoint exists. An explicit, HTTPS-only
    // institutional configuration is required before transmitting a request.
    if (!CLC_API_KEY || !CLC_API_URL) {
      logger.warn('[CLC API] Explicit endpoint and API key required; national average unavailable');
      return null;
    }
    const endpoint = new URL(CLC_API_URL);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      logger.warn('[CLC API] Invalid benchmark endpoint configuration');
      return null;
    }

    // Make API call to CLC
    const params = new URLSearchParams({
      metric,
      ...(sector && { sector }),
      aggregation: 'average',
    });

    const response = await fetch(
      `${endpoint.origin}${endpoint.pathname.replace(/\/$/, '')}/v1/benchmarks/national?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CLC_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'UnionEyes/1.0',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        logger.warn('[CLC API] Metric not found', { metric, sector });
        return null;
      }
      throw new Error(`CLC API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const average = data?.data?.average ?? data?.average;

    if (typeof average !== 'number' || !Number.isFinite(average) || average < 0) {
      logger.warn('[CLC API] Invalid response format', { metric, sector });
      return null;
    }

    // Cache result for 24 hours
    await cacheSet(cacheKey, average, { 
      namespace: 'clc-api', 
      ttl: 86400 // 24 hours
    });

    logger.info('[CLC API] Fetched national average', { metric, sector, value: average });
    return average;

  } catch (error) {
    logger.error('[CLC API] Failed to fetch national average', { 
      error, 
      metric, 
      sector,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

// =============================================================================
// PEER BENCHMARKING
// =============================================================================

/**
 * Get benchmarks comparing organization to peers and national averages
 * 
 * @param organizationId - Current organization ID
 * @returns Array of benchmark comparisons
 */
export async function getPeerBenchmarks(
  organizationId: string
): Promise<PeerBenchmark[]> {
  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const peerIds = await findPeerOrganizations(organizationId);
    const benchmarks: PeerBenchmark[] = [];

    // Member count benchmark
    if (org.memberCount && peerIds.length > 0) {
      const peers = await db.query.organizations.findMany({
        where: inArray(organizations.id, peerIds),
        columns: { memberCount: true },
      });

      const peerCounts = peers.map(p => p.memberCount || 0).filter(c => c > 0);
      // A roster with no measured member counts cannot yield a meaningful average or percentile.
      if (peerCounts.length === 0) return benchmarks;
      const peerAverage = peerCounts.reduce((a, b) => a + b, 0) / peerCounts.length;

      // Calculate percentile (simplified)
      const sortedCounts = peerCounts.sort((a, b) => a - b);
      const percentile = (sortedCounts.filter(c => c <= (org.memberCount || 0)).length / sortedCounts.length) * 100;

      // Fetch national average from CLC API
      const sector = org.sectors?.[0];
      const nationalAverage = await fetchNationalAverage(
        'memberCount',
        sector
      );

      benchmarks.push({
        metricName: 'Member Count',
        yourValue: org.memberCount,
        peerAverage: Math.round(peerAverage),
        // A peer sample is not a national measurement; unavailable data stays unknown.
        nationalAverage,
        percentile: Math.round(percentile),
        category: 'Membership',
      });
    }

    // Add more benchmarks as data becomes available:
    // - Per-capita rates
    // - Staff count
    // - Budget size
    // - Grievance resolution time
    // - Member satisfaction scores

    return benchmarks;
  } catch (error) {
    logger.error('Failed to get peer benchmarks', { error });
    throw error;
  }
}

// =============================================================================
// SMART DEFAULTS
// =============================================================================

/**
 * Generate smart defaults for rate limits and features based on org size/type
 * 
 * @param organizationType - Type of organization
 * @param estimatedMemberCount - Estimated member count
 * @returns Smart default configuration
 */
export function getSmartDefaults(
  organizationType: string,
  estimatedMemberCount?: number
): SmartDefaults {
  const memberCount = estimatedMemberCount || 100;

  // Size category determination
  let sizeCategory: 'small' | 'medium' | 'large' | 'enterprise';
  if (memberCount < 500) sizeCategory = 'small';
  else if (memberCount < 2000) sizeCategory = 'medium';
  else if (memberCount < 10000) sizeCategory = 'large';
  else sizeCategory = 'enterprise';

  // Rate limits based on size
  const rateLimits = {
    small: { apiCallsPerDay: 1000, documentsPerMonth: 100, storageGb: 5 },
    medium: { apiCallsPerDay: 5000, documentsPerMonth: 500, storageGb: 25 },
    large: { apiCallsPerDay: 20000, documentsPerMonth: 2000, storageGb: 100 },
    enterprise: { apiCallsPerDay: 100000, documentsPerMonth: 10000, storageGb: 500 },
  };

  // Features based on org type
  const featuresByType: Record<string, string[]> = {
    congress: [
      'federation-management',
      'aggregate-reporting',
      'benchmark-suite',
      'clc-integration',
      'cross-federation-collaboration',
    ],
    federation: [
      'local-management',
      'federation-reporting',
      'shared-clause-library',
      'inter-union-messaging',
    ],
    union: [
      'grievance-management',
      'member-portal',
      'contract-management',
      'dues-tracking',
    ],
    local: [
      'basic-grievance-tracking',
      'member-communication',
      'meeting-schedules',
      'document-storage',
    ],
  };

  // Integrations based on type
  const integrationsByType: Record<string, string[]> = {
    congress: ['clc-api', 'statistics-canada', 'provincial-lrb'],
    federation: ['clc-api', 'provincial-lrb', 'wage-data'],
    union: ['accounting-software', 'email-platforms', 'video-conferencing'],
    local: ['google-workspace', 'microsoft-365', 'zoom'],
  };

  return {
    suggestedRateLimits: rateLimits[sizeCategory],
    recommendedFeatures: featuresByType[organizationType] || featuresByType.local,
    suggestedIntegrations: integrationsByType[organizationType] || integrationsByType.local,
  };
}

// =============================================================================
// ONBOARDING WORKFLOW
// =============================================================================

/**
 * Complete smart onboarding flow for new organization
 * 
 * @param organizationId - Newly created organization ID
 * @returns Onboarding recommendations and setup data
 */
export async function runSmartOnboarding(organizationId: string) {
  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Step 1: Suggest parent federation
    const orgSector = org.sectors && org.sectors.length > 0 ? org.sectors[0] : null;
    const federationSuggestions = await autoDetectParentFederation(
      org.provinceTerritory || null,
      orgSector,
      org.memberCount || undefined
    );

    // Step 2: Get smart defaults
    const smartDefaults = getSmartDefaults(
      org.organizationType,
      org.memberCount || undefined
    );

    // Step 3: Suggest relevant clauses (if parent federation selected)
    let clauseSuggestions: ClauseSuggestion[] = [];
    if (org.parentId) {
      clauseSuggestions = await suggestRelevantClauses(organizationId);
    }

    // Step 4: Find peer benchmarks
    const benchmarks = await getPeerBenchmarks(organizationId);

    return {
      organization: org,
      federationSuggestions,
      smartDefaults,
      clauseSuggestions,
      benchmarks,
      onboardingComplete: {
        federationSelected: !!org.parentId,
        clausesImported: clauseSuggestions.length > 0,
        benchmarksAvailable: benchmarks.length > 0,
      },
    };
  } catch (error) {
    logger.error('Smart onboarding failed', { error, organizationId });
    throw error;
  }
}

