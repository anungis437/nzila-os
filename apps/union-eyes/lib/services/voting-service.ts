/**
 * Voting Service - Election and Ballot Management
 * 
 * Provides comprehensive voting operations including:
 * - Voting session management
 * - Ballot creation and management
 * - Vote casting and verification
 * - Results calculation
 * - Ranked choice voting
 * - Proxy voting
 * - Audit logs
 */

import { db } from "@/db/db";
import {
  votingSessions,
  votingOptions,
  votes,
  voterEligibility,
} from "@/db/schema";
import { eq, and, desc, asc, inArray, count, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { createHash, createHmac } from "crypto";
import { env } from "@/lib/config/env-validation";
import { logger } from "@/lib/logger";
import {
  deriveVotingSessionKey,
} from "./voting-crypto-service";

// ============================================================================
// Types
// ============================================================================

export type NewVotingSession = typeof votingSessions.$inferInsert;
export type VotingSession = typeof votingSessions.$inferSelect;
export type NewVotingOption = typeof votingOptions.$inferInsert;
export type VotingOption = typeof votingOptions.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type NewVoterEligibility = typeof voterEligibility.$inferInsert;
export type VoterEligibility = typeof voterEligibility.$inferSelect;

export interface VotingSessionWithOptions extends VotingSession {
  options?: VotingOption[];
  voteCount?: number;
  turnoutPercentage?: number;
}

export interface VotingResults {
  sessionId: string;
  totalVotes: number;
  options: Array<{
    optionId: string;
    text: string;
    voteCount: number;
    percentage: number;
  }>;
  turnoutPercentage: number;
  winner?: string;
  quorumMet: boolean;
}

export interface RankedChoiceResults {
  sessionId: string;
  rounds: Array<{
    round: number;
    votes: Record<string, number>;
    eliminated?: string;
  }>;
  winner: string;
  runnerUp: string;
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Get voting session by ID
 */
export async function getVotingSessionById(
  id: string,
  includeOptions = false
): Promise<VotingSessionWithOptions | null> {
  try {
    const session = await db.query.votingSessions.findFirst({
      where: eq(votingSessions.id, id),
    });

    if (!session) return null;

    if (includeOptions) {
      const options = await db
        .select()
        .from(votingOptions)
        .where(eq(votingOptions.sessionId, id))
        .orderBy(asc(votingOptions.orderIndex));

      const voteCount = await db
        .select({ count: count() })
        .from(votes)
        .where(eq(votes.sessionId, id));

      return {
        ...session,
        options,
        voteCount: voteCount[0]?.count || 0,
      };
    }

    return session;
  } catch (error) {
    logger.error("Error fetching voting session", { error, id });
    throw new Error("Failed to fetch voting session");
  }
}

/**
 * List voting sessions
 */
export async function listVotingSessions(
  filters: {
    organizationId?: string;
    status?: string[];
    type?: string;
    startDateFrom?: Date;
    startDateTo?: Date;
  } = {},
  pagination: { page?: number; limit?: number } = {}
): Promise<{ sessions: VotingSession[]; total: number; page: number; limit: number }> {
  try {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (filters.organizationId) {
      conditions.push(eq(votingSessions.organizationId, filters.organizationId));
    }

    if (filters.status && filters.status.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(votingSessions.status, filters.status as any));
    }

    if (filters.type) {
      conditions.push(eq(votingSessions.type, filters.type));
    }

    if (filters.startDateFrom) {
      conditions.push(gte(votingSessions.startTime, filters.startDateFrom));
    }

    if (filters.startDateTo) {
      conditions.push(lte(votingSessions.startTime, filters.startDateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, sessions] = await Promise.all([
      db.select({ count: count() }).from(votingSessions).where(whereClause),
      db.select().from(votingSessions).where(whereClause)
        .orderBy(desc(votingSessions.startTime))
        .limit(limit)
        .offset(offset),
    ]);

    return {
      sessions,
      total: totalResult[0]?.count || 0,
      page,
      limit,
    };
  } catch (error) {
    logger.error("Error listing voting sessions", { error, filters, pagination });
    throw new Error("Failed to list voting sessions");
  }
}

/**
 * Create voting session
 */
export async function createVotingSession(
  data: NewVotingSession
): Promise<VotingSession> {
  try {
    const [session] = await db
      .insert(votingSessions)
      .values(data)
      .returning();

    return session;
  } catch (error) {
    logger.error("Error creating voting session", { error, data });
    throw new Error("Failed to create voting session");
  }
}

/**
 * Update voting session
 */
export async function updateVotingSession(
  id: string,
  data: Partial<NewVotingSession>
): Promise<VotingSession | null> {
  try {
    const [updated] = await db
      .update(votingSessions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(votingSessions.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating voting session", { error, id });
    throw new Error("Failed to update voting session");
  }
}

/**
 * Delete voting session
 */
export async function deleteVotingSession(id: string): Promise<boolean> {
  try {
    await db
      .delete(votingSessions)
      .where(eq(votingSessions.id, id));

    return true;
  } catch (error) {
    logger.error("Error deleting voting session", { error, id });
    throw new Error("Failed to delete voting session");
  }
}

// ============================================================================
// Voting Options
// ============================================================================

/**
 * Add voting option to session
 */
export async function addVotingOption(
  data: NewVotingOption
): Promise<VotingOption> {
  try {
    const [option] = await db
      .insert(votingOptions)
      .values(data)
      .returning();

    return option;
  } catch (error) {
    logger.error("Error adding voting option", { error, data });
    throw new Error("Failed to add voting option");
  }
}

/**
 * Update voting option
 */
export async function updateVotingOption(
  id: string,
  data: Partial<NewVotingOption>
): Promise<VotingOption | null> {
  try {
    const [updated] = await db
      .update(votingOptions)
      .set(data)
      .where(eq(votingOptions.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating voting option", { error, id });
    throw new Error("Failed to update voting option");
  }
}

/**
 * Delete voting option
 */
export async function deleteVotingOption(id: string): Promise<boolean> {
  try {
    await db
      .delete(votingOptions)
      .where(eq(votingOptions.id, id));

    return true;
  } catch (error) {
    logger.error("Error deleting voting option", { error, id });
    throw new Error("Failed to delete voting option");
  }
}

// ============================================================================
// Voter Eligibility
// ============================================================================

/**
 * Add voter eligibility
 */
export async function addVoterEligibility(
  data: NewVoterEligibility
): Promise<VoterEligibility> {
  try {
    const [eligibility] = await db
      .insert(voterEligibility)
      .values(data)
      .returning();

    return eligibility;
  } catch (error) {
    logger.error("Error adding voter eligibility", { error, data });
    throw new Error("Failed to add voter eligibility");
  }
}

/**
 * Bulk add voter eligibility
 */
export async function bulkAddVoterEligibility(
  sessionId: string,
  memberIds: string[]
): Promise<number> {
  try {
    const eligibilityRecords = memberIds.map(memberId => ({
      sessionId,
      memberId,
      isEligible: true,
      votingWeight: "1.0",
    }));

    const inserted = await db
      .insert(voterEligibility)
      .values(eligibilityRecords)
      .returning();

    return inserted.length;
  } catch (error) {
    logger.error("Error bulk adding voter eligibility", {
      error,
      sessionId,
      memberCount: memberIds.length,
    });
    throw new Error("Failed to bulk add voter eligibility");
  }
}

/**
 * Check voter eligibility
 */
export async function checkVoterEligibility(
  sessionId: string,
  memberId: string
): Promise<VoterEligibility | null> {
  try {
    const eligibility = await db.query.voterEligibility.findFirst({
      where: and(
        eq(voterEligibility.sessionId, sessionId),
        eq(voterEligibility.memberId, memberId)
      ),
    });

    return eligibility || null;
  } catch (error) {
    logger.error("Error checking voter eligibility", { error, sessionId, memberId });
    throw new Error("Failed to check voter eligibility");
  }
}

/**
 * Update voter eligibility
 */
export async function updateVoterEligibility(
  id: string,
  data: Partial<NewVoterEligibility>
): Promise<VoterEligibility | null> {
  try {
    const [updated] = await db
      .update(voterEligibility)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(voterEligibility.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating voter eligibility", { error, id });
    throw new Error("Failed to update voter eligibility");
  }
}

// ============================================================================
// Vote Casting
// ============================================================================

/**
 * Generate anonymous voter ID using cryptographically secure method
 * 
 * Uses HMAC-SHA256 with KDF to ensure:
 * - Anonymous but verifiable voter identity
 * - Prevention of double voting
 * - Proper key derivation per NIST standards
 */
function generateAnonymousVoterId(
  sessionId: string,
  memberId: string
): { voterId: string; voterHash: string } {
  try {
    // Get validated voting secret from environment
    const votingSecret = env.VOTING_SECRET;
    
    if (!votingSecret) {
      throw new Error(
        'VOTING_SECRET not configured. Set VOTING_SECRET environment variable (min 32 characters) for voting to work.'
      );
    }

    // Ensure VOTING_SECRET meets minimum security requirements (32 chars for HMAC-SHA256)
    if (votingSecret.length < 32) {
      throw new Error(
        `VOTING_SECRET too short (${votingSecret.length} chars). Minimum 32 characters required for cryptographic security.`
      );
    }

    // Derive session key using PBKDF2
    const sessionKey = deriveVotingSessionKey(
      sessionId,
      votingSecret
    );

    // Create voter hash from memberId+sessionId using HMAC
    const voterIdContent = `voter:${memberId}:${sessionId}:${Date.now()}`;
    const voterId = createHmac("sha256", sessionKey)
      .update(voterIdContent)
      .digest("hex")
      .substring(0, 16);

    // Double hash for one-way verification
    const voterHash = createHash("sha256")
      .update(voterId)
      .digest("hex");

    return { voterId, voterHash };
  } catch (error) {
    logger.error("Failed to generate anonymous voter ID", { error, sessionId, memberId });
    throw new Error("Voting system initialization failed - VOTING_SECRET not configured or invalid");
  }
}

/**
 * Cast vote
 */
export async function castVote(
  sessionId: string,
  optionId: string,
  memberId: string,
  isAnonymous = true
): Promise<Vote> {
  try {
    // Check eligibility
    const eligibility = await checkVoterEligibility(sessionId, memberId);
    if (!eligibility || !eligibility.isEligible) {
      throw new Error("Voter is not eligible");
    }

    // Check if already voted
    const { voterId } = generateAnonymousVoterId(sessionId, memberId);
    const existingVote = await db.query.votes.findFirst({
      where: and(
        eq(votes.sessionId, sessionId),
        eq(votes.voterId, voterId)
      ),
    });

    if (existingVote) {
      throw new Error("Vote already cast");
    }

    // Generate anonymous voter ID if needed
    const { voterId: finalVoterId, voterHash } = isAnonymous
      ? generateAnonymousVoterId(sessionId, memberId)
      : { voterId: memberId, voterHash: "" };

    // Cast vote
    const [vote] = await db
      .insert(votes)
      .values({
        sessionId,
        optionId,
        voterId: finalVoterId,
        voterHash,
        isAnonymous,
        castAt: new Date(),
      })
      .returning();

    return vote;
  } catch (error) {
    logger.error("Error casting vote", { error, sessionId, optionId, memberId });
    throw new Error(error instanceof Error ? error.message : "Failed to cast vote");
  }
}

/**
 * Check if member has voted
 */
export async function hasVoted(
  sessionId: string,
  memberId: string
): Promise<boolean> {
  try {
    const { voterId } = generateAnonymousVoterId(sessionId, memberId);
    const vote = await db.query.votes.findFirst({
      where: and(
        eq(votes.sessionId, sessionId),
        eq(votes.voterId, voterId)
      ),
    });

    return !!vote;
  } catch (error) {
    logger.error("Error checking if voted", { error, sessionId, memberId });
    return false;
  }
}

// ============================================================================
// Results Calculation
// ============================================================================

/**
 * Calculate voting results
 */
export async function calculateResults(sessionId: string): Promise<VotingResults> {
  try {
    const session = await getVotingSessionById(sessionId, true);
    if (!session) {
      throw new Error("Session not found");
    }

    const options = session.options || [];
    const totalEligible = session.totalEligibleVoters || 0;

    // Get vote counts per option
    const voteCounts = await db
      .select({
        optionId: votes.optionId,
        count: count(),
      })
      .from(votes)
      .where(eq(votes.sessionId, sessionId))
      .groupBy(votes.optionId);

    const voteCountMap = new Map(
      voteCounts.map(vc => [vc.optionId, vc.count])
    );

    const totalVotes = voteCounts.reduce((sum, vc) => sum + vc.count, 0);
    const turnoutPercentage = totalEligible > 0 
      ? (totalVotes / totalEligible) * 100 
      : 0;

    const results = options.map(option => ({
      optionId: option.id,
      text: option.text,
      voteCount: voteCountMap.get(option.id) || 0,
      percentage: totalVotes > 0 
        ? ((voteCountMap.get(option.id) || 0) / totalVotes) * 100 
        : 0,
    }));

    // Sort by vote count descending
    results.sort((a, b) => b.voteCount - a.voteCount);

    const winner = results[0]?.optionId;
    const quorumMet = session.requiresQuorum 
      ? turnoutPercentage >= (session.quorumThreshold || 50)
      : true;

    return {
      sessionId,
      totalVotes,
      options: results,
      turnoutPercentage,
      winner,
      quorumMet,
    };
  } catch (error) {
    logger.error("Error calculating results", { error, sessionId });
    throw new Error("Failed to calculate results");
  }
}

/**
 * Calculate ranked choice voting results using Instant Runoff Voting (IRV)
 */
export async function calculateRankedChoiceResults(
  sessionId: string
): Promise<RankedChoiceResults> {
  try {
    const session = await getVotingSessionById(sessionId, true);
    if (!session) {
      throw new Error("Session not found");
    }

    // Get all votes with ranking preferences
    const rankedVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.sessionId, sessionId));

    if (rankedVotes.length === 0) {
      throw new Error("No votes found for this session");
    }

    const options = session.options || [];
    const rounds: RankedChoiceResults['rounds'] = [];
    const activeOptions = new Set(options.map(o => o.id));
    let roundNumber = 1;

    // IRV Algorithm: Eliminate lowest vote-getter each round until winner emerges
    while (activeOptions.size > 1) {
      // Count first-choice votes among active options
      const voteCounts: Record<string, number> = {};
      activeOptions.forEach(optionId => {
        voteCounts[optionId] = 0;
      });

      rankedVotes.forEach(vote => {
        // Get voter's ranked preferences (stored in voterMetadata)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const preferences = (vote.voterMetadata as any)?.preferences as string[] || [vote.optionId];
        
        // Find first active option in their preferences
        const firstChoice = preferences.find(prefId => activeOptions.has(prefId));
        if (firstChoice) {
          voteCounts[firstChoice]++;
        }
      });

      // Check for majority winner (>50%)
      const totalVotes = rankedVotes.length;
      const majorityThreshold = totalVotes / 2;
      
      let maxVotes = 0;
      let maxOption = "";
      
      for (const [optionId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          maxOption = optionId;
        }
      }

      // Record this round
      const roundData: RankedChoiceResults['rounds'][0] = {
        round: roundNumber,
        votes: Object.fromEntries(
          Object.entries(voteCounts).map(([optId, count]) => [
            options.find(o => o.id === optId)?.text || optId,
            count
          ])
        )
      };

      // If we have a majority winner, we&apos;re done
      if (maxVotes > majorityThreshold) {
        rounds.push(roundData);
        
        // Get runner-up (second highest)
        const sortedOptions = Object.entries(voteCounts)
          .sort(([, a], [, b]) => b - a);
        
        return {
          sessionId,
          rounds,
          winner: options.find(o => o.id === maxOption)?.text || "",
          runnerUp: options.find(o => o.id === sortedOptions[1]?.[0])?.text || "",
        };
      }

      // Eliminate option with fewest votes
      let minVotes = Infinity;
      let minOption = "";
      
      for (const [optionId, count] of Object.entries(voteCounts)) {
        if (count < minVotes) {
          minVotes = count;
          minOption = optionId;
        }
      }

      roundData.eliminated = options.find(o => o.id === minOption)?.text || minOption;
      rounds.push(roundData);
      
      activeOptions.delete(minOption);
      roundNumber++;

      // Safety check: prevent infinite loops
      if (roundNumber > 50) {
        logger.error("IRV algorithm exceeded 50 rounds", { sessionId });
        break;
      }
    }

    // If we exit the loop with one option remaining, it&apos;s the winner
    const winnerOption = Array.from(activeOptions)[0];
    const lastRound = rounds[rounds.length - 1];
    
    return {
      sessionId,
      rounds,
      winner: options.find(o => o.id === winnerOption)?.text || "",
      runnerUp: lastRound?.eliminated || "",
    };
  } catch (error) {
    logger.error("Error calculating ranked choice results", { error, sessionId });
    throw new Error("Failed to calculate ranked choice results");
  }
}

// ============================================================================
// Proxy Voting
// ============================================================================

/**
 * Set proxy voter
 */
export async function setProxyVoter(
  sessionId: string,
  memberId: string,
  proxyMemberId: string
): Promise<VoterEligibility | null> {
  try {
    const eligibility = await checkVoterEligibility(sessionId, memberId);
    if (!eligibility) {
      throw new Error("Voter eligibility not found");
    }

    if (!eligibility.canDelegate) {
      throw new Error("Voter cannot delegate");
    }

    const updated = await updateVoterEligibility(eligibility.id, {
      delegatedTo: proxyMemberId,
    });

    return updated;
  } catch (error) {
    logger.error("Error setting proxy voter", { error, sessionId, memberId, proxyMemberId });
    throw new Error("Failed to set proxy voter");
  }
}

/**
 * Remove proxy voter
 */
export async function removeProxyVoter(
  sessionId: string,
  memberId: string
): Promise<VoterEligibility | null> {
  try {
    const eligibility = await checkVoterEligibility(sessionId, memberId);
    if (!eligibility) {
      throw new Error("Voter eligibility not found");
    }

    const updated = await updateVoterEligibility(eligibility.id, {
      delegatedTo: null,
    });

    return updated;
  } catch (error) {
    logger.error("Error removing proxy voter", { error, sessionId, memberId });
    throw new Error("Failed to remove proxy voter");
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get voting session statistics
 */
export async function getSessionStatistics(sessionId: string): Promise<{
  totalEligible: number;
  totalVoted: number;
  turnoutPercentage: number;
  votesByHour: Record<string, number>;
}> {
  try {
    const session = await getVotingSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const totalEligible = session.totalEligibleVoters || 0;
    const totalVoted = await db
      .select({ count: count() })
      .from(votes)
      .where(eq(votes.sessionId, sessionId));

    const voteCount = totalVoted[0]?.count || 0;
    const turnoutPercentage = totalEligible > 0 
      ? (voteCount / totalEligible) * 100 
      : 0;

    // Get votes by hour
    const votesByHour: Record<string, number> = {};
    const allVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.sessionId, sessionId));

    allVotes.forEach(vote => {
      if (vote.castAt) {
        const hour = new Date(vote.castAt).getHours();
        votesByHour[`${hour}:00`] = (votesByHour[`${hour}:00`] || 0) + 1;
      }
    });

    return {
      totalEligible,
      totalVoted: voteCount,
      turnoutPercentage,
      votesByHour,
    };
  } catch (error) {
    logger.error("Error getting session statistics", { error, sessionId });
    throw new Error("Failed to get session statistics");
  }
}

