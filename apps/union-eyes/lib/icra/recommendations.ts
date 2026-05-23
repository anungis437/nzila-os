/**
 * ICRA — Recommendations
 *
 * Calm, non-coercive next steps. Mapping is deterministic by maturity band.
 * No hard-sell language. No urgency tactics. Sovereignty intact.
 */
import type { FollowupRecommendation, MaturityBandId } from './types';

const STARTER_KIT: FollowupRecommendation = {
  id: 'rec.starter_kit',
  kind: 'starter_kit',
  title: 'Continuity Starter Kit',
  description:
    'A short, plain-language reference on continuity-aware governance practice. Designed for institutions beginning to formalize operational memory.',
  ctaLabel: 'Read the starter kit',
  ctaHref: '/institutional-continuity',
};

const ASSESSMENT_WALKTHROUGH: FollowupRecommendation = {
  id: 'rec.assessment_walkthrough',
  kind: 'assessment_walkthrough',
  title: 'Assessment Walkthrough',
  description:
    'An optional conversation with our team to walk through this profile and what it means for your institution. No commitment, no sales pressure.',
  ctaLabel: 'Request a walkthrough',
  ctaHref: '/contact?topic=continuity-assessment',
};

const GOVERNANCE_WORKSHOP: FollowupRecommendation = {
  id: 'rec.governance_workshop',
  kind: 'governance_workshop',
  title: 'Governance Workshop',
  description:
    'A facilitated session for governance bodies to align on continuity priorities. Suitable for boards beginning to treat continuity as a governance discipline.',
  ctaLabel: 'Discuss a workshop',
  ctaHref: '/contact?topic=governance-workshop',
};

const CONTINUITY_REVIEW: FollowupRecommendation = {
  id: 'rec.continuity_review',
  kind: 'continuity_review',
  title: 'Organizational Continuity Review',
  description:
    'A structured review of organizational memory, governance visibility, and transition posture, producing a calm, evidenced briefing for leadership.',
  ctaLabel: 'Request a review',
  ctaHref: '/contact?topic=continuity-review',
};

const PILOT_CONVERSATION: FollowupRecommendation = {
  id: 'rec.pilot_conversation',
  kind: 'pilot_conversation',
  title: 'Pilot Conversation',
  description:
    'Explore an operational pilot of continuity infrastructure with your institution. Pilots are governance-led, scoped to your sovereignty constraints.',
  ctaLabel: 'Open a pilot conversation',
  ctaHref: '/pilot-request',
};

export function recommendationsForBand(band: MaturityBandId): FollowupRecommendation[] {
  switch (band) {
    case 'personality_dependent':
      return [STARTER_KIT, ASSESSMENT_WALKTHROUGH];
    case 'fragmented_coordination':
      return [STARTER_KIT, GOVERNANCE_WORKSHOP, ASSESSMENT_WALKTHROUGH];
    case 'structured_governance':
      return [GOVERNANCE_WORKSHOP, CONTINUITY_REVIEW];
    case 'continuity_aware':
      return [CONTINUITY_REVIEW, PILOT_CONVERSATION];
    case 'continuity_intelligence':
      return [PILOT_CONVERSATION];
    default:
      return [STARTER_KIT];
  }
}
