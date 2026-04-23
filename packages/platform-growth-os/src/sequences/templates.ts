/**
 * @nzila/platform-growth-os — Canonical outreach sequences for Union Eyes
 *
 * Every sequence references assets from:
 *   - docs/commercial/sales-kit/
 *   - docs/commercial/close-package/ENTERPRISE_CLOSE_SEQUENCE.md
 *
 * Day 0→10 demo follow-up directly implements ENTERPRISE_CLOSE_SEQUENCE.md cadence.
 */
import type { OutreachSequence } from './types'

const PLATFORM_SCOPE: OutreachSequence['scope'] = {
  tenantId: 'nzila-os',
  orgId: 'platform',
  product: 'union-eyes',
}

const now = '2025-01-01T00:00:00.000Z'  // static — bootstrapped once

export const UE_SEQUENCES: Omit<OutreachSequence, 'id'>[] = [

  // ── 1. Cold outbound ──────────────────────────────────────────────────────
  {
    scope: PLATFORM_SCOPE,
    label: 'Union Eyes — Cold Outbound',
    kind: 'cold',
    description:
      'For Tier A/B targets with no prior relationship. 4-touch, 2-week cadence. ' +
      'Opens with a pain-hook specific to the sector, closes with ROI calculator share.',
    targetTiers: ['A', 'B'],
    triggerStage: 'lead',
    benchmarkReplyRate: 0.08,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        stepNumber: 1, delayHours: 0,
        channel: 'email', templateId: 'cold-email-ue-pain-hook',
        personalisationFields: ['contactFirstName', 'localName', 'sector', 'memberCount'],
        sendCondition: null,
        stopOnEvent: 'replied',
        goal: 'Open the conversation with a concrete pain point. One ask: 15-min call.',
      },
      {
        stepNumber: 2, delayHours: 72,
        channel: 'linkedin_connection',
        templateId: 'linkedin-connection-note',
        personalisationFields: ['contactFirstName', 'localName'],
        sendCondition: 'no_reply_to_step_1',
        stopOnEvent: 'replied',
        goal: 'Reinforce sender credibility via LinkedIn. Low friction secondary touch.',
      },
      {
        stepNumber: 3, delayHours: 96,
        channel: 'email', templateId: 'roi-calculator-share',
        personalisationFields: ['contactFirstName', 'localName', 'memberCount', 'estimatedHoursPerGrievance'],
        sendCondition: 'no_reply_to_step_1',
        stopOnEvent: 'replied',
        goal: 'Send ROI calculator pre-filled with their public member count. Concrete value signal.',
      },
      {
        stepNumber: 4, delayHours: 120,
        channel: 'email', templateId: 'cold-email-ue-intro',
        personalisationFields: ['contactFirstName'],
        sendCondition: 'no_reply_to_step_3',
        stopOnEvent: 'replied',
        goal: 'Final touch. Explicit break-up line. Easy opt-out.',
      },
    ],
  },

  // ── 2. Warm intro ─────────────────────────────────────────────────────────
  {
    scope: PLATFORM_SCOPE,
    label: 'Union Eyes — Warm Introduction',
    kind: 'warm_intro',
    description:
      'For targets with a mutual connection (partner, conference, CLC affiliate). ' +
      'Opens with the mutual reference. Moves faster than cold.',
    targetTiers: ['A', 'B', 'C'],
    triggerStage: 'lead',
    benchmarkReplyRate: 0.28,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        stepNumber: 1, delayHours: 0,
        channel: 'email', templateId: 'warm-intro-email',
        personalisationFields: ['contactFirstName', 'mutualConnectionName', 'mutualConnectionContext'],
        sendCondition: null,
        stopOnEvent: 'replied',
        goal: 'Lead with the warm reference. One ask: 20-min exploratory call.',
      },
      {
        stepNumber: 2, delayHours: 96,
        channel: 'linkedin_message', templateId: 'linkedin-connection-note',
        personalisationFields: ['contactFirstName', 'mutualConnectionName'],
        sendCondition: 'no_reply_to_step_1',
        stopOnEvent: 'replied',
        goal: 'Secondary touch via LinkedIn referencing the email.',
      },
      {
        stepNumber: 3, delayHours: 72,
        channel: 'email', templateId: 'case-study-share',
        personalisationFields: ['contactFirstName', 'sectorMatchedCaseStudy'],
        sendCondition: 'no_reply_to_step_2',
        stopOnEvent: 'replied',
        goal: 'Share sector-relevant case study to surface buying intent.',
      },
    ],
  },

  // ── 3. Post-event (conference lead) ──────────────────────────────────────
  {
    scope: PLATFORM_SCOPE,
    label: 'Union Eyes — Post-Conference Follow-Up',
    kind: 'post_event',
    description:
      'For leads captured at CUPE Congress, HRPA, CLC conventions, or other events. ' +
      'Day 0 = day of/after event. Aggressive first 5 days while interest is warm.',
    targetTiers: ['A', 'B', 'C'],
    triggerStage: 'lead',
    benchmarkReplyRate: 0.22,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        stepNumber: 1, delayHours: 4,
        channel: 'email', templateId: 'post-event-email-day0',
        personalisationFields: ['contactFirstName', 'eventName', 'conversationTopic'],
        sendCondition: null,
        stopOnEvent: 'replied',
        goal: 'Day 0: same-day follow-up referencing your specific conversation. Fast while memory is fresh.',
      },
      {
        stepNumber: 2, delayHours: 48,
        channel: 'linkedin_connection', templateId: 'linkedin-connection-note',
        personalisationFields: ['contactFirstName', 'eventName'],
        sendCondition: null,
        stopOnEvent: null,
        goal: 'Day 2: connect on LinkedIn. Reinforce the relationship.',
      },
      {
        stepNumber: 3, delayHours: 48,
        channel: 'email', templateId: 'post-event-email-day2',
        personalisationFields: ['contactFirstName', 'localName', 'painPointDiscussed'],
        sendCondition: 'no_reply_to_step_1',
        stopOnEvent: 'replied',
        goal: 'Day 4: value-add email referencing specific pain point from event conversation.',
      },
      {
        stepNumber: 4, delayHours: 48,
        channel: 'email', templateId: 'post-event-email-day5',
        personalisationFields: ['contactFirstName', 'memberCount'],
        sendCondition: 'no_reply_to_step_3',
        stopOnEvent: 'replied',
        goal: 'Day 6: send ROI calculator + case study bundle. Clear ask: 30-min demo.',
      },
    ],
  },

  // ── 4. Demo follow-up (Day 0→10) ─────────────────────────────────────────
  {
    scope: PLATFORM_SCOPE,
    label: 'Union Eyes — Demo Follow-Up (Day 0→10)',
    kind: 'demo_followup',
    description:
      'Post-demo close sequence implementing ENTERPRISE_CLOSE_SEQUENCE.md. ' +
      'Sends trust pack (Day 0), ROI summary (Day 2), pilot proposal (Day 5), ' +
      'procurement kit (Day 7), final ask (Day 10).',
    targetTiers: ['A', 'B'],
    triggerStage: 'demo_completed',
    benchmarkReplyRate: 0.45,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        stepNumber: 1, delayHours: 2,
        channel: 'email', templateId: 'demo-followup-email-day0',
        personalisationFields: ['contactFirstName', 'demoHighlights', 'nextStepAsk'],
        sendCondition: null,
        stopOnEvent: 'replied',
        goal: 'Day 0: send within 2 hours. Recap demo highlights. Share trust pack link. Propose pilot.',
      },
      {
        stepNumber: 2, delayHours: 48,
        channel: 'email', templateId: 'demo-followup-email-day2',
        personalisationFields: ['contactFirstName', 'estimatedAnnualSavings'],
        sendCondition: null,
        stopOnEvent: null,
        goal: 'Day 2: ROI summary specific to their member count and sector. Add case study.',
      },
      {
        stepNumber: 3, delayHours: 72,
        channel: 'email', templateId: 'demo-followup-email-day5',
        personalisationFields: ['contactFirstName', 'localName', 'pilotTerms'],
        sendCondition: null,
        stopOnEvent: 'replied',
        goal: 'Day 5: attach pilot proposal (no-risk 90-day terms). Explicit conversion ask.',
      },
      {
        stepNumber: 4, delayHours: 48,
        channel: 'email', templateId: 'demo-followup-email-day7',
        personalisationFields: ['contactFirstName', 'procurementContactName'],
        sendCondition: 'no_reply_to_step_3',
        stopOnEvent: 'replied',
        goal: 'Day 7: send procurement checklist + vendor assessment pack. Reduce IT/procurement friction.',
      },
      {
        stepNumber: 5, delayHours: 72,
        channel: 'email', templateId: 'demo-followup-email-day10',
        personalisationFields: ['contactFirstName'],
        sendCondition: 'no_reply_to_step_4',
        stopOnEvent: 'replied',
        goal: 'Day 10: final ask. Time-boxed offer. Honest break-up if no response.',
      },
    ],
  },

  // ── 5. Procurement intake ─────────────────────────────────────────────────
  {
    scope: PLATFORM_SCOPE,
    label: 'Union Eyes — Procurement Track',
    kind: 'procurement',
    description:
      'For deals that enter a formal IT procurement or vendor assessment process. ' +
      'Proactively supplies all required documentation to reduce cycle time.',
    targetTiers: ['A'],
    triggerStage: 'pilot_proposed',
    benchmarkReplyRate: null,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        stepNumber: 1, delayHours: 0,
        channel: 'email', templateId: 'procurement-intake-email',
        personalisationFields: ['contactFirstName', 'procurementContactName', 'itContactName'],
        sendCondition: null,
        stopOnEvent: null,
        goal: 'Send full vendor documentation package: security brief, SLA, pricing, SOC note.',
      },
      {
        stepNumber: 2, delayHours: 120,
        channel: 'email', templateId: 'procurement-follow-email',
        personalisationFields: ['contactFirstName', 'outstandingDocuments'],
        sendCondition: null,
        stopOnEvent: null,
        goal: 'Check on missing docs. Offer a procurement call to answer IT questions directly.',
      },
    ],
  },

  // ── 6. Re-engagement ──────────────────────────────────────────────────────
  {
    scope: PLATFORM_SCOPE,
    label: 'Union Eyes — Re-Engagement (Dormant)',
    kind: 're_engagement',
    description:
      'For deals dormant >45 days or leads that went cold. Opens with a genuine value-add ' +
      '(new feature, new case study, or relevant sector news) — never a generic "checking in."',
    targetTiers: ['A', 'B'],
    triggerStage: 'dormant',
    benchmarkReplyRate: 0.06,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        stepNumber: 1, delayHours: 0,
        channel: 'email', templateId: 're-engagement-email',
        personalisationFields: ['contactFirstName', 'newRelevantDevelopment', 'lastTouchDate'],
        sendCondition: null,
        stopOnEvent: 'replied',
        goal: 'Re-open with genuine value: a new case study, feature, or sector development relevant to them.',
      },
      {
        stepNumber: 2, delayHours: 168,
        channel: 'linkedin_message', templateId: 'linkedin-connection-note',
        personalisationFields: ['contactFirstName'],
        sendCondition: 'no_reply_to_step_1',
        stopOnEvent: 'replied',
        goal: 'LinkedIn follow-up. If no response, mark dormant and remove from active sequence.',
      },
    ],
  },
]
