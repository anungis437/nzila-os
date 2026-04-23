/**
 * @nzila/ue-cognition/engagement — Module 3: Member disengagement risk.
 *
 * Composes cognition-core trajectory.disengagement scoring with UE-specific
 * member signals (logins, message read/ignore, event attendance, unresolved
 * cases) to produce a tier + best-channel + best-timing recommendation.
 */
import {
  COGNITION_ENGINE_VERSION,
  trajectory as cognitionTrajectory,
  type CognitionSubject,
  type MemoryEvent,
} from '@nzila/platform-cognition-core'
import { memberEngagementSnapshotSchema } from '../schemas'
import {
  type EngagementTier,
  type MemberEngagementSnapshot,
  type OutreachChannel,
  UE_COGNITION_VERSION,
} from '../types'
import {
  clamp01,
  listRecords,
  makeId,
  nowISO,
  writeRecord,
} from '../utils'

const ENTITY = 'engagement-snapshots'
export const ENGAGEMENT_MODEL_VERSION = `ue-engagement-v1+core-${COGNITION_ENGINE_VERSION}`

export interface MemberEngagementInput {
  readonly memberId: string
  readonly subject: CognitionSubject
  readonly events: readonly MemoryEvent[]
  readonly logins30d: number
  readonly messagesRead30d: number
  readonly messagesIgnored30d: number
  readonly eventsAttended30d: number
  readonly eventsNoShow30d: number
  readonly unresolvedCaseCount: number
  /** Member's preferred channel from their profile, if any. */
  readonly preferredChannel?: OutreachChannel
  readonly now?: string
}

function tierForProbability(p: number): EngagementTier {
  if (p >= 0.85) return 'lost'
  if (p >= 0.6) return 'disengaged'
  if (p >= 0.35) return 'at_risk'
  return 'engaged'
}

function pickChannel(
  input: MemberEngagementInput,
  tier: EngagementTier,
): OutreachChannel {
  if (input.preferredChannel) return input.preferredChannel
  if (tier === 'lost' || tier === 'disengaged') return 'phone'
  if (input.messagesIgnored30d > input.messagesRead30d) return 'sms'
  return 'email'
}

function pickTimingHours(tier: EngagementTier): number {
  // Worse tiers get faster outreach windows.
  if (tier === 'lost') return 24
  if (tier === 'disengaged') return 48
  if (tier === 'at_risk') return 96
  return 168
}

export function computeMemberEngagement(input: MemberEngagementInput): MemberEngagementSnapshot {
  const now = input.now ?? nowISO()

  // 1. Use cognition-core trajectory for the disengagement probability.
  // Window = last 60 days for engagement signals.
  const windowStart = new Date(Date.parse(now) - 60 * 86_400_000).toISOString()
  const features = cognitionTrajectory.extractTrajectoryFeatures({
    subject: input.subject,
    events: input.events,
    windowStart,
    windowEnd: now,
  })
  const disengagement = cognitionTrajectory.scoreTrajectoryRisk('disengagement', features, now)

  // 2. Convert to a 0..100 engagement score (inverse of disengagement, with
  //    bonus for recent positive events).
  const positiveBonus = clamp01(features.positiveSignal / 5) * 0.15
  const negativePenalty = clamp01(features.negativeSignal / 5) * 0.10
  const engagementScore01 = clamp01(1 - disengagement.probability + positiveBonus - negativePenalty)
  const engagementScore = Math.round(engagementScore01 * 100)

  const tier = tierForProbability(disengagement.probability)
  const channel = pickChannel(input, tier)
  const timingHours = pickTimingHours(tier)

  const lastEventAt = input.events.length > 0
    ? input.events[input.events.length - 1].occurredAt
    : windowStart
  const daysSinceLastActivity = (Date.parse(now) - Date.parse(lastEventAt)) / 86_400_000

  const snapshot: MemberEngagementSnapshot = {
    id: makeId('mes'),
    memberId: input.memberId,
    subject: input.subject,
    engagementScore,
    disengagementProbability: disengagement.probability,
    tier,
    daysSinceLastActivity: Math.max(0, daysSinceLastActivity),
    recentSignals: {
      logins30d: input.logins30d,
      messagesRead30d: input.messagesRead30d,
      messagesIgnored30d: input.messagesIgnored30d,
      eventsAttended30d: input.eventsAttended30d,
      eventsNoShow30d: input.eventsNoShow30d,
      unresolvedCaseCount: input.unresolvedCaseCount,
    },
    recommendedChannel: channel,
    recommendedTimingHours: timingHours,
    modelVersion: `${ENGAGEMENT_MODEL_VERSION} (ue-${UE_COGNITION_VERSION})`,
    snapshotAt: now,
  }
  return writeRecord(ENTITY, snapshot.id, snapshot, memberEngagementSnapshotSchema) as MemberEngagementSnapshot
}

export function listEngagementSnapshots(): MemberEngagementSnapshot[] {
  return listRecords(ENTITY, memberEngagementSnapshotSchema) as MemberEngagementSnapshot[]
}

export function latestEngagementByMember(memberId: string): MemberEngagementSnapshot | null {
  const all = listEngagementSnapshots().filter((s) => s.memberId === memberId)
  if (all.length === 0) return null
  return all.sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt))[0]
}

export function disengagedMembersCount(orgId: string): number {
  const byMember = new Map<string, MemberEngagementSnapshot>()
  for (const s of listEngagementSnapshots()) {
    if (s.subject.orgId !== orgId) continue
    const cur = byMember.get(s.memberId)
    if (!cur || s.snapshotAt > cur.snapshotAt) byMember.set(s.memberId, s)
  }
  let n = 0
  for (const s of byMember.values()) {
    if (s.tier === 'disengaged' || s.tier === 'lost') n += 1
  }
  return n
}
