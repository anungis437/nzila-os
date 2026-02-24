/**
 * Governance Service - Fully Transformed for Django REST API
 * All 11 methods implemented using Django backend endpoints
 * 
 * Transformation Date: 2026-02-18
 * Backend: Django REST Framework
 * Auth: Clerk
 */

import { auth } from '@clerk/nextjs/server';

// Type imports only - no runtime database access
import type {
  NewGoldenShare,
} from '@/db/schema/domains/governance';

export class GovernanceService {
  private apiBaseUrl = process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000';

  /**
   * Get auth headers for Django API requests
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const session = await auth();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (session?.sessionId) {
      headers['Authorization'] = `Bearer ${session.sessionId}`;
    }
    
    return headers;
  }

  /**
   * 1. Issue Golden Share - Create Class B Special Voting Share for Council
   */
  async issueGoldenShare(data: NewGoldenShare) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/issue_golden_share/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          certificateNumber: data.certificateNumber,
          issueDate: typeof data.issueDate === 'string' ? data.issueDate : (data.issueDate as unknown as Date).toISOString().split('T')[0],
          councilMembers: data.councilMembers,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to issue golden share: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 2. Check Golden Share Status - Get current status and sunset progress
   */
  async checkGoldenShareStatus() {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/check_status/`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 3. Request Reserved Matter Vote - Initiate Reserved Matter voting process
   */
  async requestReservedMatterVote(data: {
    matterType: string;
    title: string;
    description: string;
    proposedBy?: string;
  }) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/request_reserved_matter_vote/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          matterType: data.matterType,
          title: data.title,
          description: data.description,
          proposedBy: data.proposedBy,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to request vote: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 4. Record Class A Vote - Record regular shareholder votes
   */
  async recordClassAVote(data: {
    voteId: string;
    votesFor: number;
    votesAgainst: number;
    abstain: number;
  }) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/record_class_a_vote/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          voteId: data.voteId,
          votesFor: data.votesFor,
          votesAgainst: data.votesAgainst,
          abstain: data.abstain,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to record Class A vote: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 5. Record Class B Vote - Record golden share (council) vote
   */
  async recordClassBVote(data: {
    voteId: string;
    vote: 'approve' | 'veto';
    voteRationale: string;
    councilMembersVoting: string[];
  }) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/record_class_b_vote/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          voteId: data.voteId,
          vote: data.vote,
          voteRationale: data.voteRationale,
          councilMembersVoting: data.councilMembersVoting,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to record Class B vote: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 6. Conduct Mission Audit - Annual independent audit
   */
  async conductMissionAudit(data: {
    auditYear: number;
    auditPeriodStart: Date;
    auditPeriodEnd: Date;
    auditorFirm: string;
    auditorName: string;
    auditorCertification: string;
    unionRevenuePercent: number;
    memberSatisfactionPercent: number;
    dataViolations: number;
    unionRevenueThreshold?: number;
    memberSatisfactionThreshold?: number;
    dataViolationsThreshold?: number;
  }) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/conduct_mission_audit/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          auditYear: data.auditYear,
          auditPeriodStart: data.auditPeriodStart.toISOString().split('T')[0],
          auditPeriodEnd: data.auditPeriodEnd.toISOString().split('T')[0],
          auditorFirm: data.auditorFirm,
          auditorName: data.auditorName,
          auditorCertification: data.auditorCertification,
          unionRevenuePercent: data.unionRevenuePercent,
          memberSatisfactionPercent: data.memberSatisfactionPercent,
          dataViolations: data.dataViolations,
          unionRevenueThreshold: data.unionRevenueThreshold,
          memberSatisfactionThreshold: data.memberSatisfactionThreshold,
          dataViolationsThreshold: data.dataViolationsThreshold,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to conduct audit: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 7. Trigger Sunset Clause - Mark golden share for conversion
   */
  async triggerSunsetClause(goldenShareId: string) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/trigger_sunset_clause/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          goldenShareId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to trigger sunset: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 8. Convert Golden Share - Final conversion to ordinary share
   */
  async convertGoldenShare(goldenShareId: string) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/convert_golden_share/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          goldenShareId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to convert share: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 9. Get Mission Compliance Years - Track sunset progress
   */
  async getMissionComplianceYears() {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/mission_compliance_years/`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get compliance years: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 10. Conduct Council Election - Elect union rep council
   */
  async conductCouncilElection(data: {
    electionYear: number;
    electionDate: Date;
    positionsAvailable: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    candidates: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winners: any[];
    totalVotes?: number;
    participationRate?: number;
  }) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/conduct_council_election/`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          electionYear: data.electionYear,
          electionDate: data.electionDate.toISOString().split('T')[0],
          positionsAvailable: data.positionsAvailable,
          candidates: data.candidates,
          winners: data.winners,
          totalVotes: data.totalVotes,
          participationRate: data.participationRate,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to conduct election: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 11. Get Governance Dashboard - Aggregate governance data
   */
  async getGovernanceDashboard() {
    const response = await fetch(
      `${this.apiBaseUrl}/api/services/governance-service/dashboard/`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get dashboard: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Business Logic - Is Reserved Matter (no database access)
   * This method remains unchanged as it contains only validation logic
   */
  isReservedMatter(proposal: {
    type: string;
    financialImpact?: number;
    strategicChange?: boolean;
  }): { isReserved: boolean; reason?: string } {
    // Reserved Matters requiring Class B (golden share) approval
    const reservedMatterTypes = [
      'mission_change',
      'executive_compensation',
      'major_acquisition',
      'capital_structure',
      'member_data_policy',
    ];

    if (reservedMatterTypes.includes(proposal.type)) {
      return {
        isReserved: true,
        reason: `${proposal.type} requires Union Council approval (Reserved Matter)`,
      };
    }

    // Financial threshold check
    if (proposal.financialImpact && proposal.financialImpact > 1000000) {
      return {
        isReserved: true,
        reason: 'Financial impact exceeds $1M threshold (Reserved Matter)',
      };
    }

    // Strategic change check
    if (proposal.strategicChange) {
      return {
        isReserved: true,
        reason: 'Strategic direction change requires Council approval (Reserved Matter)',
      };
    }

    return { isReserved: false };
  }
}
