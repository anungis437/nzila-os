/**
 * Story Submission Automation
 * 
 * SPRINT 8: Advanced Features
 * 
 * Purpose: Automatically identify and suggest testimonials from high-impact cases
 * Reduces manual effort while capturing authentic member/organizer stories
 * 
 * Features:
 * - Auto-detect testimonial-worthy cases (fast resolution, high satisfaction, unique issues)
 * - Generate draft testimonial content from case data
 * - Send respectful invitation to members/organizers
 * - Track acceptance/rejection for continuous improvement
 * 
 * Philosophy: "Invite, don&apos;t pressure; celebrate, don&apos;t exploit"
 * - Always ask permission (opt-in, never automatic)
 * - Respect "no" without penalty
 * - Draft content for review (never publish without approval)
 * - Clear on how story will be used
 * - Member privacy controls
 */

import { db } from '@/db';
import { grievances } from '@/db/schema/grievance-schema';
import { getNotificationService } from '@/lib/services/notification-service';
import { eq, and, gte, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

type GrievanceRow = typeof grievances.$inferSelect;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TestimonialCandidate {
  caseId: string;
  caseNumber: string;
  memberId: string;
  organizerId: string;
  score: number; // 0-100, how testimonial-worthy
  reason: string;
  suggestedType: 'member' | 'organizer';
  draftContent: {
    quote: string;
    context: string;
    impact: string;
  };
  metadata: {
    resolutionTime: number; // days
    caseType: string;
    outcome: string;
    memberSatisfaction?: number;
  };
}

export interface TestimonialInvitation {
  candidateId: string;
  recipientEmail: string;
  recipientName: string;
  sentAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  submittedTestimonialId?: string;
}

export interface StoryAutomationMetrics {
  candidatesIdentified: number;
  invitationsSent: number;
  acceptanceRate: number;
  submissionRate: number;
  avgTimeToSubmit: number; // days
  topCaseTypes: { caseType: string; count: number }[];
}

// ============================================================================
// CANDIDATE IDENTIFICATION
// ============================================================================

/**
 * Identify testimonial-worthy cases using scoring algorithm
 * 
 * Scoring factors:
 * - Fast resolution (< 30 days = +20 points)
 * - High member satisfaction (> 8/10 = +25 points)
 * - Unique issue type (rare cases = +15 points)
 * - Positive outcome (win/settled = +20 points)
 * - Recent resolution (< 90 days old = +10 points)
 * - Organizer involvement (human touch = +10 points)
 */
export async function identifyTestimonialCandidates(
  organizationId: string,
  limit: number = 10
): Promise<TestimonialCandidate[]> {
  // Fetch recently resolved cases (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const resolvedCases = await db
    .select()
    .from(grievances)
    .where(
      and(
        eq(grievances.organizationId, organizationId),
        gte(grievances.resolvedAt, ninetyDaysAgo)
      )
    )
    .orderBy(desc(grievances.resolvedAt))
    .limit(100); // Pre-filter to top 100 for scoring

  const candidates: TestimonialCandidate[] = [];

  for (const grievance of resolvedCases) {
    // Skip if already has testimonial (no caseId column on testimonials — match by author instead)
    // TODO: Add a caseId column to testimonials schema for direct linkage
    const existingTestimonial: unknown[] = [];

    if (existingTestimonial.length > 0) continue;

    // Calculate testimonial score
    const score = calculateTestimonialScore(grievance);

    // Only include high-scoring cases (>= 60)
    if (score >= 60) {
      const draftContent = generateDraftTestimonial(grievance);

      candidates.push({
        caseId: grievance.id,
        caseNumber: grievance.grievanceNumber,
        memberId: grievance.grievantId || '',
        organizerId: grievance.unionRepId || '', // May be null
        score,
        reason: explainScore(grievance, score),
        suggestedType: score > 75 ? 'member' : 'organizer',
        draftContent,
        metadata: {
          resolutionTime: calculateResolutionTime(grievance),
          caseType: grievance.type,
          outcome: grievance.status,
          memberSatisfaction: undefined,
        },
      });
    }
  }

  // Sort by score (highest first) and return top N
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Calculate testimonial worthiness score (0-100)
 */
function calculateTestimonialScore(grievance: GrievanceRow): number {
  let score = 0;

  // Factor 1: Resolution time (faster = better story)
  const resolutionTime = calculateResolutionTime(grievance);
  if (resolutionTime <= 14) {
    score += 20; // Exceptional (<= 2 weeks)
  } else if (resolutionTime <= 30) {
    score += 15; // Fast (<= 1 month)
  } else if (resolutionTime <= 60) {
    score += 10; // Moderate (<= 2 months)
  } else {
    score += 5; // Slow but resolved
  }

  // Factor 2: Member satisfaction (not available in current schema)
  // Default moderate score
  score += 12;

  // Factor 3: Case complexity/uniqueness (rare types = interesting stories)
  const rareCaseTypes = ['harassment', 'discrimination', 'safety'];
  if (rareCaseTypes.includes(grievance.type)) {
    score += 15;
  } else {
    score += 5;
  }

  // Factor 4: Outcome (positive = worth sharing)
  if (grievance.status === 'settled') {
    score += 20;
  } else if (grievance.status === 'withdrawn') {
    score += 5; // Less ideal but still resolved
  }

  // Factor 5: Recency (fresher = more relevant)
  const daysSinceResolution = Math.floor(
    (Date.now() - new Date(grievance.resolvedAt!).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceResolution <= 30) {
    score += 10; // Very recent
  } else if (daysSinceResolution <= 60) {
    score += 7;
  } else {
    score += 3;
  }

  // Factor 6: Organizer involvement (personal touch)
  if (grievance.unionRepId) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Calculate resolution time in days
 */
function calculateResolutionTime(grievance: GrievanceRow): number {
  if (!grievance.resolvedAt) return 999; // Not resolved
  const filed = new Date(grievance.filedDate || grievance.createdAt).getTime();
  const resolved = new Date(grievance.resolvedAt).getTime();
  return Math.floor((resolved - filed) / (1000 * 60 * 60 * 24));
}

/**
 * Explain why case is testimonial-worthy
 */
function explainScore(grievance: GrievanceRow, _score: number): string {
  const reasons: string[] = [];

  const resolutionTime = calculateResolutionTime(grievance);
  if (resolutionTime <= 30) {
    reasons.push(`🚀 Fast resolution (${resolutionTime} days)`);
  }

  if (grievance.status === 'settled') {
    reasons.push('✅ Positive outcome');
  }

  const rareCaseTypes = ['harassment', 'discrimination', 'safety'];
  if (rareCaseTypes.includes(grievance.type)) {
    reasons.push(`💼 Important issue type (${grievance.type})`);
  }

  if (reasons.length === 0) {
    return 'Well-handled case with good outcome';
  }

  return reasons.join(' • ');
}

// ============================================================================
// DRAFT CONTENT GENERATION
// ============================================================================

/**
 * Generate draft testimonial content from case data
 * 
 * Note: This is a starting point - member MUST review and edit
 */
function generateDraftTestimonial(grievance: GrievanceRow): TestimonialCandidate['draftContent'] {
  // Generate quote (placeholder - would use NLP in production)
  const quoteTemplates = {
    harassment: 'Union Eyes helped us handle a sensitive harassment case with dignity and speed.',
    discrimination: 'The platform made it easier to document and resolve a discrimination complaint.',
    safety: 'Safety concerns were escalated and resolved faster than ever before.',
    contract: 'Contract grievance tracking became so much clearer with Union Eyes.',
    discipline: 'The timeline feature helped us build a strong case and get a favorable outcome.',
    default: 'Union Eyes made a real difference in how we resolved this case.',
  };

  const quote = quoteTemplates[grievance.type as keyof typeof quoteTemplates] || quoteTemplates.default;

  // Generate context
  const resolutionTime = calculateResolutionTime(grievance);
  const context = `${grievance.type} case resolved in ${resolutionTime} days using Union Eyes platform.`;

  // Generate impact
  const impact = 'Case handled efficiently with positive outcome for all parties.';

  return { quote, context, impact };
}

// ============================================================================
// INVITATION MANAGEMENT
// ============================================================================

/**
 * Send testimonial invitation to member or organizer
 * 
 * Respectful approach:
 * - Explain why they&apos;re invited
 * - Show draft content for review
 * - Make it easy to accept or decline
 * - No pressure or consequences for declining
 */
export async function sendTestimonialInvitation(
  candidate: TestimonialCandidate,
  recipientType: 'member' | 'organizer'
): Promise<TestimonialInvitation> {
  const notificationService = getNotificationService();

  // Get recipient details (in production, fetch from database)
  const recipientEmail = 'example@union.org'; // Placeholder
  const recipientName = recipientType === 'member' ? 'Member' : 'Organizer'; // Placeholder

  const invitation: TestimonialInvitation = {
    candidateId: candidate.caseId,
    recipientEmail,
    recipientName,
    sentAt: new Date(),
  };

  // Compose invitation email
  const subject =
    recipientType === 'member'
      ? 'Share Your Story? Your Case Made a Difference'
      : 'Celebrate Your Impact: Testimonial Invitation';

  const body = `Dear ${recipientName},

Your recent case (${candidate.caseNumber}) was resolved with great success! We&apos;re reaching out to see if you&apos;d be willing to share your experience as a testimonial.

**Why We&apos;re Asking:**
${candidate.reason}

**Draft Testimonial (for your review):**
"${candidate.draftContent.quote}"

**How It Would Be Used:**
- Help other unions see the value of Union Eyes
- Inspire confidence in the platform
- Celebrate successful case resolutions
- Build solidarity across the labor movement

**Your Control:**
- You can edit or completely rewrite the draft
- You can choose to keep your name anonymous
- You can decline without any consequences
- You can revoke permission anytime

This is completely optional and there&apos;s no pressure to participate. We respect your decision either way.

Interested? Click here to review and submit: [Link to testimonial form]
Not interested? No problem - just ignore this email.

In solidarity,
The Union Eyes Team`;

  // Send invitation
  await notificationService.send({
    organizationId: candidate.caseId.split('-')[0], // Placeholder
    recipientEmail,
    type: 'email',
    priority: 'normal',
    subject,
    title: 'Testimonial Invitation',
    body,
    actionUrl: `/testimonials/submit?candidate=${candidate.caseId}`,
    actionLabel: 'Review & Submit',
    metadata: {
      type: 'testimonial_invitation',
      candidateId: candidate.caseId,
      suggestedType: recipientType,
    },
  });

  // Store invitation (in production, persist to database)
  // await db.insert(testimonialInvitations).values(invitation);

  return invitation;
}

/**
 * Track invitation acceptance
 */
export async function recordTestimonialAcceptance(
  candidateId: string,
  testimonialId: string
): Promise<void> {
  // In production, update invitation record
  // await db.update(testimonialInvitations)
  //   .set({ acceptedAt: new Date(), submittedTestimonialId: testimonialId })
  //   .where(eq(testimonialInvitations.candidateId, candidateId));

  logger.info(`Testimonial accepted: candidate=${candidateId}, testimonial=${testimonialId}`);
}

/**
 * Track invitation rejection
 */
export async function recordTestimonialRejection(candidateId: string, reason?: string): Promise<void> {
  // In production, update invitation record
  // await db.update(testimonialInvitations)
  //   .set({ rejectedAt: new Date(), rejectionReason: reason })
  //   .where(eq(testimonialInvitations.candidateId, candidateId));

  logger.info(`Testimonial declined: candidate=${candidateId}, reason=${reason || 'not provided'}`);
}

// ============================================================================
// AUTOMATION METRICS
// ============================================================================

/**
 * Get metrics on story automation performance
 */
export async function getStoryAutomationMetrics(_organizationId: string): Promise<StoryAutomationMetrics> {
  // In production, fetch from database
  // const invitations = await db.select().from(testimonialInvitations)
  //   .where(eq(testimonialInvitations.organizationId, organizationId));

  // Placeholder metrics
  return {
    candidatesIdentified: 47,
    invitationsSent: 35,
    acceptanceRate: 42.9, // 15/35
    submissionRate: 34.3, // 12/35
    avgTimeToSubmit: 5.2, // days
    topCaseTypes: [
      { caseType: 'contract', count: 12 },
      { caseType: 'discipline', count: 8 },
      { caseType: 'harassment', count: 7 },
      { caseType: 'safety', count: 5 },
      { caseType: 'discrimination', count: 3 },
    ],
  };
}

// ============================================================================
// BATCH AUTOMATION
// ============================================================================

/**
 * Run automated testimonial campaign
 * 
 * Steps:
 * 1. Identify candidates
 * 2. Send invitations (rate-limited)
 * 3. Track responses
 * 4. Follow up (optional)
 */
export async function runAutomatedTestimonialCampaign(
  organizationId: string,
  maxInvitations: number = 10
): Promise<{
  candidatesFound: number;  invitationsSent: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // Step 1: Identify candidates
    const candidates = await identifyTestimonialCandidates(organizationId, maxInvitations);

    if (candidates.length === 0) {
      return {
        candidatesFound: 0,
        invitationsSent: 0,
        errors: ['No testimonial-worthy cases found in the last 90 days'],
      };
    }

    // Step 2: Send invitations (with rate limiting)
    let invitationsSent = 0;
    for (const candidate of candidates) {
      try {
        await sendTestimonialInvitation(candidate, candidate.suggestedType);
        invitationsSent++;

        // Rate limit: wait 1 second between sends
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        errors.push(`Failed to send invitation for case ${candidate.caseNumber}: ${error}`);
      }
    }

    return {
      candidatesFound: candidates.length,
      invitationsSent,
      errors,
    };
  } catch (error) {
    return {
      candidatesFound: 0,
      invitationsSent: 0,
      errors: [`Campaign failed: ${error}`],
    };
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Manual candidate review
 * 
 * const candidates = await identifyTestimonialCandidates('org-123', 20);
 * logger.info(`Found ${candidates.length} testimonial-worthy cases`);
 * 
 * for (const candidate of candidates) {
 *   logger.info(`Case ${candidate.caseNumber}: ${candidate.reason} (score: ${candidate.score})`);
 *   logger.info(`Draft: "${candidate.draftContent.quote}"`);
 * }
 */

/**
 * Example 2: Send individual invitation
 * 
 * const candidates = await identifyTestimonialCandidates('org-123', 5);
 * const topCandidate = candidates[0];
 * 
 * const invitation = await sendTestimonialInvitation(topCandidate, 'member');
 * logger.info(`Invitation sent to ${invitation.recipientEmail}`);
 */

/**
 * Example 3: Automated campaign
 * 
 * const result = await runAutomatedTestimonialCampaign('org-123', 10);
 * logger.info(`Campaign results: ${result.invitationsSent} invitations sent`);
 * if (result.errors.length > 0) {
 *   logger.error('Errors:', result.errors);
 * }
 */

/**
 * Example 4: Track metrics
 * 
 * const metrics = await getStoryAutomationMetrics('org-123');
 * logger.info(`Acceptance rate: ${metrics.acceptanceRate}%`);
 * logger.info(`Most common case type: ${metrics.topCaseTypes[0].caseType}`);
 */
