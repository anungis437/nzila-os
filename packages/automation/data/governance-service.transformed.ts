// Governance Service - API Migration
// Transformed from Drizzle ORM to Django REST API
//
// MIGRATION STATUS: In Progress
// - Replaced database imports with API client
// - Transformed key methods to API calls
// - Preserved business logic

import * as api from '@/lib/api/django-client';

// Type imports (keep these - they're just types, not database access)
import type {
  NewGoldenShare,
  NewReservedMatterVote,
  NewMissionAudit,
  NewGovernanceEvent,
  NewCouncilElection,
} from '@/db/schema/domains/governance';

/**
 * Governance Service
 *
 * Manages golden share governance structure:
 * - Class B Special Voting Share (Union Member Representative Council)
 * - Reserved Matters voting (mission changes, sales, data governance, major contracts)
 * - Annual mission audits (90%+ union revenue, 80%+ satisfaction, zero violations)
 * - 5-year sunset clause (auto-converts to ordinary share after compliance)
 */

export class GovernanceService {
  /**
   * Issue Golden Share
   * Create Class B Special Voting Share for Union Member Representative Council
   */
  async issueGoldenShare(data: {
    certificateNumber: string;
    issueDate: Date;
    councilMembers: Array<{
      name: string;
      union: string;
      termStart: Date;
      termEnd: Date;
      electedDate: Date;
    }>;
  }) {
    // Call Django API endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000'}/api/services/governance-service/issue_golden_share/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add Clerk auth token
          ...await this.getAuthHeaders(),
        },
        body: JSON.stringify({
          certificateNumber: data.certificateNumber,
          issueDate: data.issueDate.toISOString().split('T')[0],
          councilMembers: data.councilMembers,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to issue golden share: ${response.statusText}`);
    }

    const share = await response.json();
    return share;
  }

  /**
   * Check Golden Share Status
   * Get current golden share + sunset progress + recent audit
   */
  async checkGoldenShareStatus() {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000'}/api/services/governance-service/check_status/`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check golden share status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Request Reserved Matter Vote
   * Propose a Reserved Matter requiring Class B approval
   */
  async requestReservedMatterVote(data: {
    matterType: 'mission_change' | 'sale_control' | 'data_governance' | 'major_contract';
    title: string;
    description: string;
    proposedBy: string;
    votingDeadline: Date;
    matterDetails: any;
    classATotalVotes: number;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000'}/api/services/governance-service/request_reserved_matter_vote/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...await this.getAuthHeaders(),
        },
        body: JSON.stringify({
          matterType: data.matterType,
          title: data.title,
          description: data.description,
          proposedBy: data.proposedBy,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to request reserved matter vote: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get Governance Dashboard
   * Overview of golden share status, recent votes, audits
   */
  async getGovernanceDashboard() {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000'}/api/services/governance-service/dashboard/`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get governance dashboard: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Helper: Get Clerk authentication headers
   */
  private async getAuthHeaders() {
    // Use Clerk to get auth token
    // Note: This should be imported from @clerk/nextjs
    try {
      const { auth } = await import('@clerk/nextjs/server');
      const session = await auth();
      
      if (session?.sessionId) {
        // For server-side
        return {
          'Authorization': `Bearer ${session.sessionId}`,
        };
      }
      
      return {};
    } catch (error) {
      console.error('Failed to get auth headers:', error);
      return {};
    }
  }

  /**
   * Check if Reserved Matter
   * Determine if a proposal requires Reserved Matter vote
   * 
   * NOTE: This is business logic that stays on frontend (no database access)
   */
  isReservedMatter(proposal: {
    type: string;
    details: any;
  }): { isReserved: boolean; reason?: string } {
    // Mission change: Any alteration to union-serving mission
    if (proposal.type === 'mission_change') {
      return { isReserved: true, reason: 'Changes to union-serving mission require Class B approval' };
    }
    
    // Sale/control change: >50% ownership change, merger, IPO
    if (proposal.type === 'sale_control') {
      if (proposal.details.ownershipPercent > 50) {
        return { isReserved: true, reason: 'Sale of majority ownership requires Class B approval' };
      }
    }
    
    // Data governance: Sharing member data with employers, data sales
    if (proposal.type === 'data_governance') {
      if (proposal.details.recipient === 'employer' || proposal.details.purpose === 'data_sale') {
        return { isReserved: true, reason: 'Sharing member data with employers or selling data requires Class B approval' };
      }
    }
    
    // Major contract: >$1M contracts with employers
    if (proposal.type === 'major_contract') {
      if (proposal.details.counterpartyType === 'employer' && proposal.details.value > 1000000) {
        return { isReserved: true, reason: 'Contracts >$1M with employers require Class B approval' };
      }
    }
    
    return { isReserved: false };
  }

  // NOTE: The following methods from the original service still need Django endpoints:
  // - recordClassAVote()
  // - recordClassBVote()
  // - conductMissionAudit()
  // - triggerSunsetClause()
  // - convertGoldenShare()
  // - getMissionComplianceYears()
  // - conductCouncilElection()
  // 
  // For Phase 1, we've implemented the core 4 endpoints above.
  // The remaining methods will be added in future phases.
}

// Export singleton instance
export const governanceService = new GovernanceService();
