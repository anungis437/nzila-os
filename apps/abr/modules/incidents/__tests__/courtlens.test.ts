/**
 * CourtLens Phase 1B tests.
 *
 * Proves that:
 * - CourtLens adapter fields are purely additive and do not break ABR incidents.
 * - The ABR incident FSM is reused unchanged.
 * - The ai_summary_status gate blocks externalisation until human approval.
 * - The referral_status lifecycle enforces reviewer sign-off before dispatch.
 * - Risk flags default correctly.
 * - Tenant org scope is preserved through the CourtLensMatter type.
 */

import { describe, it, expect } from 'vitest';
import { getAllowedTransitions, isValidTransition } from '../fsm';
import type { IncidentRecord } from '../types';
import {
  AI_SUMMARY_STATUSES,
  COURTLENS_PRACTICE_AREAS,
  COURTLENS_SUB_ISSUES,
  MATTER_STATUS_LABELS,
  REFERRAL_STATUSES,
  defaultClientProfile,
  defaultCourtLensFields,
  defaultRiskFlags,
  getMatterStatusLabel,
  hasAnyRiskFlag,
  isExternalizableSummaryStatus,
  isMatterPacketExternalizable,
  isValidAiSummaryTransition,
  isValidReferralTransition,
  type CourtLensFields,
  type CourtLensMatter,
} from '../courtlens';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBaseIncident(overrides: Partial<IncidentRecord> = {}): IncidentRecord {
  return {
    id: 'inc-cl-test',
    orgId: 'org-clinic-1',
    title: 'Housing intake — eviction risk',
    category: 'service_delivery',
    severity: 'high',
    status: 'new',
    intakeChannel: 'web',
    createdBy: 'staff-1',
    assignedTo: null,
    openedAt: '2026-07-02T00:00:00Z',
    dueAt: null,
    closedAt: null,
    summary: 'Client at risk of eviction within 14 days.',
    createdAt: '2026-07-02T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

function makeMatter(
  incidentOverrides: Partial<IncidentRecord> = {},
  fieldOverrides: Partial<CourtLensFields> = {},
): CourtLensMatter {
  return {
    ...makeBaseIncident(incidentOverrides),
    ...defaultCourtLensFields('housing'),
    ...fieldOverrides,
  };
}

// ── ABR Incident FSM — must not regress ───────────────────────────────────────

describe('ABR incident FSM reuse — unchanged by CourtLens adapter', () => {
  it('new → triage is valid', () => {
    expect(isValidTransition('new', 'triage')).toBe(true);
  });

  it('new → closed is invalid', () => {
    expect(isValidTransition('new', 'closed')).toBe(false);
  });

  it('new → archived is invalid', () => {
    expect(isValidTransition('new', 'archived')).toBe(false);
  });

  it('getAllowedTransitions(investigating) includes action_planning', () => {
    expect(getAllowedTransitions('investigating')).toContain('action_planning');
  });

  it('getAllowedTransitions(archived) is empty', () => {
    expect(getAllowedTransitions('archived')).toHaveLength(0);
  });

  it('complete forward chain is valid', () => {
    const chain = [
      ['new', 'triage'],
      ['triage', 'assigned'],
      ['assigned', 'investigating'],
      ['investigating', 'action_planning'],
      ['action_planning', 'monitoring'],
      ['monitoring', 'resolved'],
      ['resolved', 'closed'],
      ['closed', 'archived'],
    ] as const;
    for (const [from, to] of chain) {
      expect(isValidTransition(from, to)).toBe(true);
    }
  });
});

// ── CourtLens fields are additive ─────────────────────────────────────────────

describe('CourtLensMatter is additive over IncidentRecord', () => {
  const base = makeBaseIncident();
  const matter = makeMatter();

  it('retains all ABR incident fields unchanged', () => {
    const incidentKeys = Object.keys(base) as (keyof IncidentRecord)[];
    for (const key of incidentKeys) {
      expect(matter[key]).toStrictEqual(base[key]);
    }
  });

  it('carries CourtLens fields', () => {
    expect(matter.practiceArea).toBe('housing');
    expect(matter.aiSummaryStatus).toBe('ai_draft');
    expect(matter.referralStatus).toBe('none');
    expect(matter.riskFlags).toBeDefined();
    expect(matter.clientProfile).toBeDefined();
  });

  it('orgId is preserved — tenant scope intact', () => {
    expect(matter.orgId).toBe('org-clinic-1');
  });

  it('different org produces different orgId', () => {
    const other = makeMatter({ orgId: 'org-clinic-2' });
    expect(other.orgId).toBe('org-clinic-2');
    expect(matter.orgId).not.toBe(other.orgId);
  });
});

// ── FSM label mapping ─────────────────────────────────────────────────────────

describe('matter status labels', () => {
  const abr = [
    'new', 'triage', 'assigned', 'investigating',
    'action_planning', 'monitoring', 'resolved', 'closed', 'archived',
  ] as const;

  it('every ABR incident status has a CourtLens label', () => {
    for (const s of abr) {
      expect(MATTER_STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it('new → New Intake', () => expect(getMatterStatusLabel('new')).toBe('New Intake'));
  it('action_planning → Review Packet Ready', () => expect(getMatterStatusLabel('action_planning')).toBe('Review Packet Ready'));
  it('resolved → Referred / Completed', () => expect(getMatterStatusLabel('resolved')).toBe('Referred / Completed'));
});

// ── AI summary status lifecycle ───────────────────────────────────────────────

describe('ai_summary_status lifecycle', () => {
  it('ai_draft → needs_verification is valid', () => {
    expect(isValidAiSummaryTransition('ai_draft', 'needs_verification')).toBe(true);
  });

  it('ai_draft cannot jump directly to approved', () => {
    expect(isValidAiSummaryTransition('ai_draft', 'approved')).toBe(false);
  });

  it('ai_draft cannot jump directly to revised_by_human', () => {
    expect(isValidAiSummaryTransition('ai_draft', 'revised_by_human')).toBe(false);
  });

  it('needs_verification → approved is valid', () => {
    expect(isValidAiSummaryTransition('needs_verification', 'approved')).toBe(true);
  });

  it('needs_verification → rejected is valid', () => {
    expect(isValidAiSummaryTransition('needs_verification', 'rejected')).toBe(true);
  });

  it('needs_verification → revised_by_human is valid', () => {
    expect(isValidAiSummaryTransition('needs_verification', 'revised_by_human')).toBe(true);
  });

  it('approved state is terminal (no outgoing transitions)', () => {
    const targets = AI_SUMMARY_STATUSES.filter((s) => isValidAiSummaryTransition('approved', s));
    expect(targets).toHaveLength(0);
  });

  it('rejected can be re-submitted to needs_verification', () => {
    expect(isValidAiSummaryTransition('rejected', 'needs_verification')).toBe(true);
  });
});

// ── Human approval gate ───────────────────────────────────────────────────────

describe('isMatterPacketExternalizable — human approval gate', () => {
  it('ai_draft is NOT externalizable', () => {
    expect(isMatterPacketExternalizable(makeMatter({}, { aiSummaryStatus: 'ai_draft' }))).toBe(false);
  });

  it('needs_verification is NOT externalizable', () => {
    expect(isMatterPacketExternalizable(makeMatter({}, { aiSummaryStatus: 'needs_verification' }))).toBe(false);
  });

  it('rejected is NOT externalizable', () => {
    expect(isMatterPacketExternalizable(makeMatter({}, { aiSummaryStatus: 'rejected' }))).toBe(false);
  });

  it('approved IS externalizable', () => {
    expect(isMatterPacketExternalizable(makeMatter({}, { aiSummaryStatus: 'approved' }))).toBe(true);
  });

  it('revised_by_human IS externalizable', () => {
    expect(isMatterPacketExternalizable(makeMatter({}, { aiSummaryStatus: 'revised_by_human' }))).toBe(true);
  });

  it('isExternalizableSummaryStatus agrees with isMatterPacketExternalizable', () => {
    for (const s of AI_SUMMARY_STATUSES) {
      const fromMatter = isMatterPacketExternalizable(makeMatter({}, { aiSummaryStatus: s }));
      const fromGuard = isExternalizableSummaryStatus(s);
      expect(fromMatter).toBe(fromGuard);
    }
  });
});

// ── Referral status lifecycle ─────────────────────────────────────────────────

describe('referral_status lifecycle — must pass through approved before sent', () => {
  it('none → suggested is valid', () => {
    expect(isValidReferralTransition('none', 'suggested')).toBe(true);
  });

  it('suggested → approved is valid', () => {
    expect(isValidReferralTransition('suggested', 'approved')).toBe(true);
  });

  it('approved → sent is valid', () => {
    expect(isValidReferralTransition('approved', 'sent')).toBe(true);
  });

  it('sent → completed is valid', () => {
    expect(isValidReferralTransition('sent', 'completed')).toBe(true);
  });

  it('suggested cannot jump directly to sent', () => {
    expect(isValidReferralTransition('suggested', 'sent')).toBe(false);
  });

  it('none cannot jump directly to sent', () => {
    expect(isValidReferralTransition('none', 'sent')).toBe(false);
  });

  it('completed is terminal', () => {
    const targets = REFERRAL_STATUSES.filter((s) => isValidReferralTransition('completed', s));
    expect(targets).toHaveLength(0);
  });

  it('suggested can be withdrawn back to none', () => {
    expect(isValidReferralTransition('suggested', 'none')).toBe(true);
  });
});

// ── Risk flags ────────────────────────────────────────────────────────────────

describe('risk flags', () => {
  it('defaultRiskFlags returns all false', () => {
    const flags = defaultRiskFlags();
    for (const val of Object.values(flags)) {
      expect(val).toBe(false);
    }
  });

  it('has all required A2J risk keys', () => {
    const flags = defaultRiskFlags();
    const required = [
      'risk_lockout', 'risk_eviction', 'risk_utility_shutoff', 'risk_safety',
      'risk_homelessness', 'risk_income_loss', 'risk_unsafe_work', 'risk_retaliation',
      'risk_garnishment', 'risk_bank_freeze', 'risk_identity_theft',
      'risk_essential_services', 'risk_harassment',
    ];
    for (const key of required) {
      expect(flags).toHaveProperty(key);
    }
  });

  it('hasAnyRiskFlag returns false for all-false flags', () => {
    expect(hasAnyRiskFlag(defaultRiskFlags())).toBe(false);
  });

  it('hasAnyRiskFlag returns true when any flag is set', () => {
    expect(hasAnyRiskFlag({ ...defaultRiskFlags(), risk_eviction: true })).toBe(true);
  });
});

// ── Practice areas and sub-issues ────────────────────────────────────────────

describe('practice areas and sub-issues', () => {
  it('COURTLENS_PRACTICE_AREAS has exactly three values', () => {
    expect(COURTLENS_PRACTICE_AREAS).toHaveLength(3);
    expect(COURTLENS_PRACTICE_AREAS).toContain('housing');
    expect(COURTLENS_PRACTICE_AREAS).toContain('employment');
    expect(COURTLENS_PRACTICE_AREAS).toContain('debt');
  });

  it('COURTLENS_SUB_ISSUES includes housing-specific values', () => {
    expect(COURTLENS_SUB_ISSUES).toContain('eviction');
    expect(COURTLENS_SUB_ISSUES).toContain('lockout');
    expect(COURTLENS_SUB_ISSUES).toContain('utility_shutoff');
  });

  it('COURTLENS_SUB_ISSUES includes employment-specific values', () => {
    expect(COURTLENS_SUB_ISSUES).toContain('unpaid_wages');
    expect(COURTLENS_SUB_ISSUES).toContain('termination');
    expect(COURTLENS_SUB_ISSUES).toContain('workplace_harassment');
  });

  it('COURTLENS_SUB_ISSUES includes debt-specific values', () => {
    expect(COURTLENS_SUB_ISSUES).toContain('wage_garnishment');
    expect(COURTLENS_SUB_ISSUES).toContain('debt_buyer_claim');
    expect(COURTLENS_SUB_ISSUES).toContain('collector_harassment');
  });
});

// ── Client profile defaults ───────────────────────────────────────────────────

describe('client profile', () => {
  it('defaultClientProfile returns consent_status pending', () => {
    expect(defaultClientProfile().consentStatus).toBe('pending');
  });

  it('defaultClientProfile returns null contact and name', () => {
    const p = defaultClientProfile();
    expect(p.clientName).toBeNull();
    expect(p.clientContact).toBeNull();
  });

  it('defaultClientProfile has no children or disability flags set', () => {
    const p = defaultClientProfile();
    expect(p.hasChildren).toBe(false);
    expect(p.hasDisability).toBe(false);
  });
});

// ── defaultCourtLensFields ────────────────────────────────────────────────────

describe('defaultCourtLensFields', () => {
  it('starts with ai_summary_status ai_draft', () => {
    expect(defaultCourtLensFields('employment').aiSummaryStatus).toBe('ai_draft');
  });

  it('starts with referral_status none', () => {
    expect(defaultCourtLensFields('debt').referralStatus).toBe('none');
  });

  it('uses provided practice area', () => {
    expect(defaultCourtLensFields('housing').practiceArea).toBe('housing');
    expect(defaultCourtLensFields('debt').practiceArea).toBe('debt');
  });
});
