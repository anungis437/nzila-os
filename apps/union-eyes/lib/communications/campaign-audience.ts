/**
 * Campaign audience evaluation (DEF-0B5-COMMS-CAMPAIGN-DETACHED-FROM-CONSENT-AND-DELIVERY).
 *
 * A campaign row stores a segment id and a free-form segment query, but no member_segments table
 * or query interpreter exists yet to resolve either one (campaigns.ts's own comment: "future:
 * member_segments table"). Inventing a resolver for an undefined query shape would be fabricated
 * targeting logic, not a mechanism, so this deliberately does not attempt it: the only candidate
 * pool this evaluates is every active member of the organization (an inert, rule-free default - no
 * invented segmentation narrows or widens it).
 *
 * What this DOES check for real, against the platform's existing consent/preference tables: for a
 * given channel, a candidate is eligible only if their communication_preferences row enables that
 * channel and the 'campaign' category and they are not globally unsubscribed, AND their most recent
 * consent_records row for that channel (if any exists) is not denied, revoked or expired. A member
 * with no communication_preferences row at all defaults closed for sms (CASL requires express
 * opt-in) and open for email (matching communication_preferences' own column defaults).
 */
import { and, desc, eq } from 'drizzle-orm';
import {
  campaigns,
  communicationPreferences,
  consentChannelEnum,
  consentRecords,
  organizationMembers,
} from '@/db/schema';
import type { RLSTx } from '@/lib/db/with-rls-context';

export type CampaignChannel = (typeof campaigns.channel.enumValues)[number];
export type ConsentChannel = (typeof consentChannelEnum.enumValues)[number];

export interface AudienceCandidate {
  userId: string;
  email: string;
  phone: string | null;
}

export interface ExcludedCandidate {
  userId: string;
  reason: string;
}

export interface CampaignAudienceEvaluation {
  totalCandidates: number;
  eligible: AudienceCandidate[];
  excluded: ExcludedCandidate[];
}

/** Maps a campaign's channel to the consent/preference channel it gates on. 'multi_channel' and 'push' have no settled per-recipient channel choice yet, so every candidate is excluded rather than guessed at. */
function consentChannelFor(channel: CampaignChannel): ConsentChannel | null {
  if (channel === 'email' || channel === 'sms') return channel;
  return null;
}

/**
 * Every active member of the organization. Segment-based narrowing (campaigns.segmentId /
 * segmentQuery) is not implemented - see this module's header comment.
 */
export async function resolveCampaignCandidates(tx: RLSTx, organizationId: string): Promise<AudienceCandidate[]> {
  const rows = await tx
    .select({ userId: organizationMembers.userId, email: organizationMembers.email, phone: organizationMembers.phone })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.status, 'active')));
  return rows;
}

async function isConsentDenied(tx: RLSTx, organizationId: string, userId: string, channel: ConsentChannel): Promise<boolean> {
  const [latest] = await tx
    .select({ status: consentRecords.status })
    .from(consentRecords)
    .where(and(
      eq(consentRecords.organizationId, organizationId),
      eq(consentRecords.userId, userId),
      eq(consentRecords.channel, channel),
    ))
    .orderBy(desc(consentRecords.createdAt))
    .limit(1);
  if (!latest) return false;
  return latest.status === 'denied' || latest.status === 'revoked' || latest.status === 'expired';
}

/** Null when the candidate is eligible; otherwise the reason they are excluded. */
export async function evaluateRecipientEligibility(
  tx: RLSTx,
  organizationId: string,
  userId: string,
  campaignChannel: CampaignChannel,
): Promise<string | null> {
  const consentChannel = consentChannelFor(campaignChannel);
  if (!consentChannel) return `Campaign channel ${campaignChannel} has no settled per-recipient delivery channel`;

  const [preference] = await tx
    .select({
      emailEnabled: communicationPreferences.emailEnabled,
      smsEnabled: communicationPreferences.smsEnabled,
      globallyUnsubscribed: communicationPreferences.globallyUnsubscribed,
      categories: communicationPreferences.categories,
    })
    .from(communicationPreferences)
    .where(and(eq(communicationPreferences.organizationId, organizationId), eq(communicationPreferences.userId, userId)))
    .limit(1);

  if (preference?.globallyUnsubscribed) return 'Globally unsubscribed';

  // No preferences row: default matches the column defaults (email open, sms closed per CASL).
  const channelEnabled = preference
    ? (consentChannel === 'email' ? preference.emailEnabled : preference.smsEnabled)
    : consentChannel === 'email';
  if (!channelEnabled) return `${consentChannel} channel disabled in communication preferences`;

  const categories = preference?.categories as Record<string, boolean> | null | undefined;
  if (categories && categories.campaign === false) return 'Campaign category disabled in communication preferences';

  if (await isConsentDenied(tx, organizationId, userId, consentChannel)) return `${consentChannel} consent denied, revoked or expired`;

  return null;
}

/** Resolves candidates and evaluates every one; never sends anything itself. */
export async function evaluateCampaignAudience(
  tx: RLSTx,
  organizationId: string,
  campaignChannel: CampaignChannel,
): Promise<CampaignAudienceEvaluation> {
  const candidates = await resolveCampaignCandidates(tx, organizationId);
  const eligible: AudienceCandidate[] = [];
  const excluded: ExcludedCandidate[] = [];
  for (const candidate of candidates) {
    const reason = await evaluateRecipientEligibility(tx, organizationId, candidate.userId, campaignChannel);
    if (reason) excluded.push({ userId: candidate.userId, reason });
    else eligible.push(candidate);
  }
  return { totalCandidates: candidates.length, eligible, excluded };
}
