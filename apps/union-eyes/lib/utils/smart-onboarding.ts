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
import { eq, and, inArray, or, gte, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from '@/lib/services/cache-service';

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
  memberCount: number;
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
  nationalAverage: number;
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

/**
 * Auto-detect potential parent federation based on province, sector, and size
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
    ];

    if (province) {
      filters.push(eq(organizations.provinceTerritory, province.toUpperCase()));
    }

    const potentialParents = await db.query.organizations.findMany({
      where: and(...filters),
      orderBy: (org, { desc }) => [desc(org.memberCount)],
      limit: 10,
    });

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

      // Size proximity (federations with similar-sized locals)
      if (estimatedMemberCount && org.memberCount) {
        const sizeRatio = Math.min(estimatedMemberCount, org.memberCount) / 
                         Math.max(estimatedMemberCount, org.memberCount);
        const sizeScore = sizeRatio * 20;
        matchScore += sizeScore;
        matchReasons.push(`Similar size category`);
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
        memberCount: org.memberCount || 0,
        matchScore,
        matchReasons,
      };
    });

    // Sort by match score
    return suggestions.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    logger.error('Failed to auto-detect parent federation', { error });
    return [];
  }
}

// =============================================================================
// SMART CLAUSE DISCOVERY
// =============================================================================

/**
 * Suggest relevant clauses from parent federation and peer organizations
 * 
 * @param organizationId - Current organization ID
 * @returns Array of clause suggestions with relevance scoring
 */
export async function suggestRelevantClauses(
  organizationId: string
): Promise<ClauseSuggestion[]> {
  try {
    // Fetch organization with hierarchy
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const hierarchyPath = org.hierarchyPath || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [
      // Only public/federation/congress level clauses
      inArray(sharedClauseLibrary.sharingLevel, ['public', 'federation', 'congress']),
    ];

    // Filter by sector if available (check first element of sectors array)
    const orgSector = org.sectors && org.sectors.length > 0 ? org.sectors[0] : null;
    if (orgSector) {
      filters.push(eq(sharedClauseLibrary.sector, orgSector));
    }

    // Filter by province if available
    if (org.provinceTerritory) {
      filters.push(eq(sharedClauseLibrary.province, org.provinceTerritory.toUpperCase()));
    }

    // Get clauses from parent organizations in hierarchy
    if (hierarchyPath.length > 0) {
      filters.push(
        inArray(sharedClauseLibrary.sourceOrganizationId, hierarchyPath)
      );
    }

    const relevantClauses = await db.query.sharedClauseLibrary.findMany({
      where: and(...filters),
      with: {
        sourceOrganization: {
          columns: {
            name: true,
            organizationType: true,
          },
        },
      },
      limit: 50,
      orderBy: (clause, { desc }) => [desc(clause.createdAt)],
    });

    // Score and rank suggestions
    const suggestions: ClauseSuggestion[] = relevantClauses.map((clause) => {
      const relevanceReasons: string[] = [];
      let relevanceScore = 0;

      // Sharing level scoring
      if (clause.sharingLevel === 'public') {
        relevanceScore += 20;
        relevanceReasons.push('Publicly available');
      } else if (clause.sharingLevel === 'federation') {
        relevanceScore += 40;
        relevanceReasons.push('Federation-shared');
      } else if (clause.sharingLevel === 'congress') {
        relevanceScore += 50;
        relevanceReasons.push('Congress-level template');
      }

      // Hierarchy proximity (closer in hierarchy = more relevant)
      if (hierarchyPath.includes(clause.sourceOrganizationId)) {
        const hierarchyIndex = hierarchyPath.indexOf(clause.sourceOrganizationId);
        const proximityScore = (hierarchyPath.length - hierarchyIndex) * 15;
        relevanceScore += proximityScore;
        relevanceReasons.push('From parent organization');
      }

      // Sector match
      if (orgSector && clause.sector === orgSector) {
        relevanceScore += 25;
        relevanceReasons.push(`Same sector (${orgSector})`);
      }

      // Province match
      if (org.provinceTerritory && clause.province === org.provinceTerritory.toUpperCase()) {
        relevanceScore += 15;
        relevanceReasons.push(`Same province (${org.provinceTerritory})`);
      }

      return {
        clauseId: clause.id,
        clauseTitle: clause.clauseTitle,
        clauseType: clause.clauseType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sourceOrgName: (clause.sourceOrganization as any)?.name || 'Unknown',
        sharingLevel: clause.sharingLevel,
        relevanceScore,
        relevanceReasons,
      };
    });

    // Sort by relevance score
    return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 20);
  } catch (error) {
    logger.error('Failed to suggest relevant clauses', { error });
    return [];
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
    return [];
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
    if (cached !== null) {
      logger.info('[CLC API] Using cached national average', { metric, sector, value: cached });
      return cached;
    }

    const CLC_API_URL = process.env.CLC_API_URL || 'https://api.clc-ctc.ca';
    const CLC_API_KEY = process.env.CLC_API_KEY;

    if (!CLC_API_KEY) {
      logger.warn('[CLC API] API key not configured, using fallback value');
      return getFallbackAverage(metric);
    }

    // Make API call to CLC
    const params = new URLSearchParams({
      metric,
      ...(sector && { sector }),
      aggregation: 'average',
    });

    const response = await fetch(
      `${CLC_API_URL}/v1/benchmarks/national?${params}`,
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
        return getFallbackAverage(metric);
      }
      throw new Error(`CLC API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const average = data?.data?.average || data?.average;

    if (typeof average !== 'number') {
      logger.warn('[CLC API] Invalid response format', { data });
      return getFallbackAverage(metric);
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
    return getFallbackAverage(metric);
  }
}

/**
 * Get fallback averages when CLC API is unavailable
 * Based on historical Canadian labour statistics
 */
function getFallbackAverage(metric: string): number {
  const fallbacks: Record<string, number> = {
    memberCount: 2500,
    perCapitaRate: 45.0, // CAD per member per month
    staffCount: 8,
    budgetSize: 1250000, // CAD
    grievanceResolutionDays: 45,
  };
  
  return fallbacks[metric] || 0;
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
        nationalAverage: nationalAverage ?? Math.round(peerAverage),
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
    return [];
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

