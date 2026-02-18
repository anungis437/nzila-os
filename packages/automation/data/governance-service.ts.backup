// Governance Service
// Golden share management, Reserved Matter voting, mission audits, sunset clause tracking

import { db } from '@/db';
import {
  goldenShares,
  reservedMatterVotes,
  missionAudits,
  governanceEvents,
  councilElections,
  type NewGoldenShare,
  type NewReservedMatterVote,
  type NewMissionAudit,
  type NewGovernanceEvent,
  type NewCouncilElection,
} from '@/db/schema/domains/governance';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

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
    const [share] = await db.insert(goldenShares).values({
      certificateNumber: data.certificateNumber,
      issueDate: data.issueDate.toISOString().split('T')[0] as any,
      councilMembers: data.councilMembers,
      status: 'active',
      sunsetClauseActive: true,
      consecutiveComplianceYears: 0,
    }).returning();
    
    // Log governance event
    await db.insert(governanceEvents).values({
      eventType: 'golden_share_issued',
      eventDate: new Date(),
      goldenShareId: share.id,
      title: 'Class B Special Voting Share Issued',
      description: `Golden share certificate ${data.certificateNumber} issued to Union Member Representative Council with 51% voting power on Reserved Matters.`,
      impact: 'high',
      impactDescription: 'Governance structure now protects mission from investor interference. 5-year sunset clause begins.',
      stakeholders: ['board', 'council', 'investors', 'public'],
    });
    
    return share;
  }

  /**
   * Check Golden Share Status
   * Get current golden share details and sunset clause progress
   */
  async checkGoldenShareStatus() {
    const share = await db
      .select()
      .from(goldenShares)
      .where(eq(goldenShares.status, 'active'))
      .limit(1);
    
    if (!share[0]) {
      return null;
    }
    
    const currentShare = share[0];
    
    // Calculate years remaining until sunset (if on track)
    const yearsRemaining = currentShare.sunsetClauseDuration - currentShare.consecutiveComplianceYears;
    
    // Get most recent mission audit
    const recentAudit = await db
      .select()
      .from(missionAudits)
      .orderBy(desc(missionAudits.auditYear))
      .limit(1);
    
    return {
      share: currentShare,
      sunsetProgress: {
        consecutiveYears: currentShare.consecutiveComplianceYears,
        requiredYears: currentShare.sunsetClauseDuration,
        yearsRemaining,
        percentComplete: (currentShare.consecutiveComplianceYears / currentShare.sunsetClauseDuration) * 100,
        sunsetTriggered: currentShare.sunsetTriggeredDate !== null,
      },
      lastAudit: recentAudit[0] || null,
    };
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
    const [vote] = await db.insert(reservedMatterVotes).values({
      ...data,
      proposedDate: new Date(),
      status: 'pending',
    }).returning();
    
    // Log governance event
    await db.insert(governanceEvents).values({
      eventType: 'reserved_matter_vote',
      eventDate: new Date(),
      reservedMatterVoteId: vote.id,
      title: `Reserved Matter: ${data.title}`,
      description: `${data.matterType} proposal requires Union Council approval. Voting deadline: ${data.votingDeadline.toISOString().split('T')[0]}`,
      impact: 'high',
      impactDescription: 'Reserved Matter requires Class B (golden share) approval before proceeding.',
      stakeholders: ['board', 'council', 'investors'],
    });
    
    return vote;
  }

  /**
   * Record Class A Vote
   * Ordinary shareholders vote on Reserved Matter
   */
  async recordClassAVote(
    voteId: string,
    votesFor: number,
    votesAgainst: number,
    abstain: number
  ) {
    const totalVotes = votesFor + votesAgainst + abstain;
    const percentFor = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;
    
    await db
      .update(reservedMatterVotes)
      .set({
        classAVotesFor: votesFor,
        classAVotesAgainst: votesAgainst,
        classAAbstain: abstain,
        classAPercentFor: percentFor,
      })
      .where(eq(reservedMatterVotes.id, voteId));
    
    return { percentFor, passed: percentFor >= 50 };
  }

  /**
   * Record Class B Vote (Golden Share)
   * Union Member Representative Council votes on Reserved Matter
   */
  async recordClassBVote(data: {
    voteId: string;
    vote: 'approve' | 'veto';
    voteRationale: string;
    councilMembersVoting: Array<{
      member: string;
      vote: 'approve' | 'veto';
      rationale: string;
    }>;
  }) {
    await db
      .update(reservedMatterVotes)
      .set({
        classBVote: data.vote,
        classBVoteDate: new Date(),
        classBVoteRationale: data.voteRationale,
        classBCouncilMembersVoting: data.councilMembersVoting,
      })
      .where(eq(reservedMatterVotes.id, data.voteId));
    
    // Determine final decision
    const voteRecord = await db
      .select()
      .from(reservedMatterVotes)
      .where(eq(reservedMatterVotes.id, data.voteId))
      .limit(1);
    
    if (!voteRecord[0]) {
      throw new Error('Vote not found');
    }
    
    let finalDecision: string;
    let status: string;
    
    if (data.vote === 'veto') {
      finalDecision = 'vetoed_class_b';
      status = 'vetoed';
    } else if (voteRecord[0].classAPercentFor && voteRecord[0].classAPercentFor >= 50) {
      finalDecision = 'approved';
      status = 'approved';
    } else {
      finalDecision = 'rejected_class_a';
      status = 'rejected';
    }
    
    await db
      .update(reservedMatterVotes)
      .set({
        finalDecision,
        status: status as any,
        decisionDate: new Date(),
      })
      .where(eq(reservedMatterVotes.id, data.voteId));
    
    // Log governance event
    await db.insert(governanceEvents).values({
      eventType: 'reserved_matter_vote',
      eventDate: new Date(),
      reservedMatterVoteId: data.voteId,
      title: `Reserved Matter ${data.vote === 'veto' ? 'Vetoed' : 'Approved'}`,
      description: `Union Member Representative Council ${data.vote === 'veto' ? 'vetoed' : 'approved'} Reserved Matter: ${voteRecord[0].title}. Rationale: ${data.voteRationale}`,
      impact: 'high',
      impactDescription: data.vote === 'veto' 
        ? 'Proposal rejected by Class B golden share veto. Cannot proceed.'
        : 'Proposal approved by both Class A and Class B. May proceed to implementation.',
      stakeholders: ['board', 'council', 'investors', 'public'],
    });
    
    return { finalDecision, status };
  }

  /**
   * Conduct Mission Audit
   * Annual independent audit to verify mission compliance (for sunset clause)
   */
  async conductMissionAudit(data: NewMissionAudit) {
    // Use default thresholds from schema if not provided
    const unionRevenueThreshold = data.unionRevenueThreshold ?? 90;
    const memberSatisfactionThreshold = data.memberSatisfactionThreshold ?? 80;
    const dataViolationsThreshold = data.dataViolationsThreshold ?? 0;
    
    // Determine pass/fail for each criterion
    const unionRevenuePass = data.unionRevenuePercent >= unionRevenueThreshold;
    const memberSatisfactionPass = data.memberSatisfactionPercent >= memberSatisfactionThreshold;
    const dataViolationsPass = (data.dataViolations ?? 0) <= dataViolationsThreshold;
    const overallPass = unionRevenuePass && memberSatisfactionPass && dataViolationsPass;
    
    const [audit] = await db.insert(missionAudits).values({
      ...data,
      unionRevenueThreshold,
      memberSatisfactionThreshold,
      dataViolationsThreshold,
      unionRevenuePass,
      memberSatisfactionPass,
      dataViolationsPass,
      overallPass,
      impactsConsecutiveCompliance: overallPass, // Only passing audits count toward sunset
    }).returning();
    
    // Update golden share consecutive compliance years
    const currentShare = await db
      .select()
      .from(goldenShares)
      .where(eq(goldenShares.status, 'active'))
      .limit(1);
    
    if (currentShare[0]) {
      if (overallPass) {
        // Increment consecutive compliance years
        const newConsecutiveYears = currentShare[0].consecutiveComplianceYears + 1;
        
        await db
          .update(goldenShares)
          .set({
            consecutiveComplianceYears: newConsecutiveYears,
          })
          .where(eq(goldenShares.id, currentShare[0].id));
        
        // Check if sunset triggered (5 consecutive years)
        if (newConsecutiveYears >= currentShare[0].sunsetClauseDuration) {
          await this.triggerSunsetClause(currentShare[0].id);
        }
        
        // Update audit with new consecutive count
        await db
          .update(missionAudits)
          .set({
            consecutiveYearsAfterAudit: newConsecutiveYears,
          })
          .where(eq(missionAudits.id, audit.id));
      } else {
        // Reset consecutive compliance years to zero
        await db
          .update(goldenShares)
          .set({
            consecutiveComplianceYears: 0,
          })
          .where(eq(goldenShares.id, currentShare[0].id));
        
        await db
          .update(missionAudits)
          .set({
            consecutiveYearsAfterAudit: 0,
          })
          .where(eq(missionAudits.id, audit.id));
      }
    }
    
    // Log governance event
    await db.insert(governanceEvents).values({
      eventType: 'mission_audit',
      eventDate: new Date(),
      missionAuditId: audit.id,
      title: `${data.auditYear} Mission Audit ${overallPass ? 'Passed' : 'Failed'}`,
      description: `Annual mission audit by ${data.auditorFirm}. Union revenue: ${data.unionRevenuePercent}% (${unionRevenuePass ? 'pass' : 'fail'}), Member satisfaction: ${data.memberSatisfactionPercent}% (${memberSatisfactionPass ? 'pass' : 'fail'}), Data violations: ${data.dataViolations} (${dataViolationsPass ? 'pass' : 'fail'})`,
      impact: overallPass ? 'medium' : 'high',
      impactDescription: overallPass 
        ? `Mission compliance achieved. Consecutive years: ${currentShare[0] ? currentShare[0].consecutiveComplianceYears + 1 : 0}/${currentShare[0]?.sunsetClauseDuration || 5}`
        : 'Mission violation detected. Consecutive compliance years reset to 0. Sunset clause countdown restarted.',
      stakeholders: ['board', 'council', 'investors', 'public'],
    });
    
    return audit;
  }

  /**
   * Trigger Sunset Clause
   * Golden share auto-converts to ordinary share after 5 consecutive years of mission compliance
   */
  async triggerSunsetClause(goldenShareId: string) {
    const sunsetDate = new Date();
    
    await db
      .update(goldenShares)
      .set({
        status: 'sunset_triggered',
        sunsetTriggeredDate: sunsetDate.toISOString().split('T')[0] as any,
      })
      .where(eq(goldenShares.id, goldenShareId));
    
    // Log governance event
    await db.insert(governanceEvents).values({
      eventType: 'sunset_triggered',
      eventDate: sunsetDate,
      goldenShareId,
      title: 'Golden Share Sunset Clause Triggered',
      description: '5 consecutive years of mission compliance achieved. Class B Special Voting Share will convert to ordinary Class A share. Reserved Matter veto rights will cease. Union Eyes has proven long-term commitment to union-serving mission.',
      impact: 'high',
      impactDescription: 'Golden share governance protections no longer needed. Company has demonstrated 5 years of mission fidelity. Will operate as standard corporation going forward.',
      stakeholders: ['board', 'council', 'investors', 'public'],
    });
    
    return { sunsetTriggeredDate: sunsetDate };
  }

  /**
   * Convert Golden Share to Ordinary
   * Final step after sunset clause triggered (administrative conversion)
   */
  async convertGoldenShare(goldenShareId: string) {
    const conversionDate = new Date();
    
    await db
      .update(goldenShares)
      .set({
        status: 'converted',
        conversionDate: conversionDate.toISOString().split('T')[0] as any,
      })
      .where(eq(goldenShares.id, goldenShareId));
    
    // Log governance event
    await db.insert(governanceEvents).values({
      eventType: 'share_converted',
      eventDate: conversionDate,
      goldenShareId,
      title: 'Class B Share Converted to Class A',
      description: 'Class B Special Voting Share has been converted to ordinary Class A share. Union Member Representative Council voting power now 1% (matching economic interest). Reserved Matter veto rights terminated.',
      impact: 'high',
      impactDescription: 'Golden share governance structure complete. Company demonstrated 5 years of mission compliance. Normal governance applies going forward.',
      stakeholders: ['board', 'council', 'investors', 'public'],
    });
    
    return { conversionDate };
  }

  /**
   * Get Mission Compliance Years
   * Calculate consecutive years of mission compliance (for sunset tracking)
   */
  async getMissionComplianceYears() {
    const currentShare = await db
      .select()
      .from(goldenShares)
      .where(eq(goldenShares.status, 'active'))
      .limit(1);
    
    if (!currentShare[0]) {
      return {
        consecutiveYears: 0,
        requiredYears: 5,
        percentComplete: 0,
        sunsetTriggered: false,
      };
    }
    
    const audits = await db
      .select()
      .from(missionAudits)
      .orderBy(desc(missionAudits.auditYear))
      .limit(10);
    
    return {
      consecutiveYears: currentShare[0].consecutiveComplianceYears,
      requiredYears: currentShare[0].sunsetClauseDuration,
      percentComplete: (currentShare[0].consecutiveComplianceYears / currentShare[0].sunsetClauseDuration) * 100,
      sunsetTriggered: currentShare[0].sunsetTriggeredDate !== null,
      recentAudits: audits,
    };
  }

  /**
   * Conduct Council Election
   * Elect Union Member Representative Council (golden share holders)
   */
  async conductCouncilElection(data: NewCouncilElection) {
    const [election] = await db.insert(councilElections).values(data).returning();
    
    // Update golden share with new council members
    const currentShare = await db
      .select()
      .from(goldenShares)
      .where(eq(goldenShares.status, 'active'))
      .limit(1);
    
    if (currentShare[0]) {
      await db
        .update(goldenShares)
        .set({
          councilMembers: data.winners,
        })
        .where(eq(goldenShares.id, currentShare[0].id));
    }
    
    // Log governance event
    await db.insert(governanceEvents).values({
      eventType: 'golden_share_issued', // Reuse event type (council refresh)
      eventDate: new Date(),
      goldenShareId: currentShare[0]?.id,
      title: `${data.electionYear} Council Election Complete`,
      description: `Union Member Representative Council election concluded. ${data.positionsAvailable} positions filled. Total votes: ${data.totalVotes}. Participation: ${data.participationRate}%`,
      impact: 'medium',
      impactDescription: 'New Council members elected. Golden share voting authority refreshed with member mandate.',
      stakeholders: ['board', 'council', 'public'],
    });
    
    return election;
  }

  /**
   * Get Governance Dashboard
   * Overview of golden share status, recent votes, audits
   */
  async getGovernanceDashboard() {
    const shareStatus = await this.checkGoldenShareStatus();
    
    const recentVotes = await db
      .select()
      .from(reservedMatterVotes)
      .orderBy(desc(reservedMatterVotes.proposedDate))
      .limit(5);
    
    const recentAudits = await db
      .select()
      .from(missionAudits)
      .orderBy(desc(missionAudits.auditYear))
      .limit(3);
    
    const recentEvents = await db
      .select()
      .from(governanceEvents)
      .orderBy(desc(governanceEvents.eventDate))
      .limit(10);
    
    const pendingVotes = await db
      .select()
      .from(reservedMatterVotes)
      .where(eq(reservedMatterVotes.status, 'pending'));
    
    return {
      goldenShare: shareStatus,
      recentVotes,
      pendingVotes,
      recentAudits,
      recentEvents,
      stats: {
        totalVotes: recentVotes.length,
        votesApproved: recentVotes.filter(v => v.status === 'approved').length,
        votesVetoed: recentVotes.filter(v => v.status === 'vetoed').length,
        auditsPassed: recentAudits.filter(a => a.overallPass).length,
        auditsFailed: recentAudits.filter(a => !a.overallPass).length,
      },
    };
  }

  /**
   * Check if Reserved Matter
   * Determine if a proposal requires Reserved Matter vote
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
}

// Export singleton instance
export const governanceService = new GovernanceService();
