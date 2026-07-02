/**
 * CourtLens Phase 1C tests — matter service adapter.
 *
 * Proves that:
 * - Matter projection does not mutate or fork IncidentRecord behavior.
 * - createMatter rejects invalid practice areas, sub-issues, and risk keys.
 * - ABR incident FSM still controls matter lifecycle.
 * - ai_summary_status cannot be marked externally usable except by a human.
 * - Referral transitions enforce the approved-before-sent rule.
 * - deriveCourtLensFields correctly reconstructs state from event history.
 * - toMatterQueueItem produces correct display projection.
 * - Existing incident service tests still pass (FSM regression guard imported).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CourtLensValidationError,
  assertValidPracticeArea,
  assertValidSubIssue,
  assertValidRiskKeys,
  deriveCourtLensFields,
  toMatterQueueItem,
  updateAiSummaryStatus,
  updateReferralStatus,
  createMatter,
} from '../matter-service';
import { defaultCourtLensFields, defaultRiskFlags, type CourtLensMatter } from '../courtlens';
import type { IncidentRecord } from '../types';
import { isValidTransition } from '../fsm';

// ── Mock ABR incident service ─────────────────────────────────────────────────
// Prevent network/DB calls; the adapter is tested in isolation.

vi.mock('../service', () => ({
  createIncident: vi.fn(async (orgId: string, actorId: string, input: Record<string, unknown>) => ({
    id: 'inc-mock-1',
    orgId,
    title: String(input.title),
    category: input.category,
    severity: input.severity,
    status: 'new',
    intakeChannel: input.intakeChannel,
    createdBy: actorId,
    assignedTo: null,
    openedAt: '2026-07-02T01:00:00Z',
    dueAt: null,
    closedAt: null,
    summary: String(input.summary),
    createdAt: '2026-07-02T01:00:00Z',
    updatedAt: '2026-07-02T01:00:00Z',
  })),
  listIncidents: vi.fn(async (orgId: string) => [
    {
      id: 'inc-list-1', orgId, title: 'Housing intake', category: 'service_delivery',
      severity: 'high', status: 'new', intakeChannel: 'web', createdBy: 'u1',
      assignedTo: null, openedAt: '2026-07-02T01:00:00Z', dueAt: null, closedAt: null,
      summary: 'Client at risk', createdAt: '2026-07-02T01:00:00Z', updatedAt: '2026-07-02T01:00:00Z',
    },
  ]),
  getIncidentDetail: vi.fn(async (orgId: string, incidentId: string) => ({
    incident: {
      id: incidentId, orgId, title: 'Housing intake', category: 'service_delivery',
      severity: 'high', status: 'investigating', intakeChannel: 'web', createdBy: 'u1',
      assignedTo: 'reviewer-1', openedAt: '2026-07-02T01:00:00Z', dueAt: null, closedAt: null,
      summary: 'Client at risk of eviction', createdAt: '2026-07-02T01:00:00Z', updatedAt: '2026-07-02T01:00:00Z',
    },
    events: [
      { id: 'e1', incidentId, actorId: 'ai-system', type: 'created', payloadJson: {}, createdAt: '2026-07-02T01:00:00Z' },
      { id: 'e2', incidentId, actorId: 'ai-system', type: 'note_added',
        payloadJson: { clEventType: 'courtlens_fields_set', fields: { practiceArea: 'housing', subIssue: 'eviction', aiSummaryStatus: 'needs_verification' } },
        createdAt: '2026-07-02T01:01:00Z' },
      { id: 'e3', incidentId, actorId: 'reviewer-1', type: 'note_added',
        payloadJson: { clEventType: 'ai_summary_status_changed', from: 'needs_verification', to: 'approved', actorType: 'human' },
        createdAt: '2026-07-02T01:02:00Z' },
    ],
    actions: [],
    notes: [],
    timeline: [],
  })),
  transitionIncident: vi.fn(async (_orgId: string, _id: string, _actorId: string, input: { to: string }) => ({
    id: 'inc-mock-1', orgId: 'org-1', title: 'test', status: input.to,
    category: 'service_delivery', severity: 'high', intakeChannel: 'web',
    createdBy: 'u1', assignedTo: null, openedAt: '', dueAt: null, closedAt: null,
    summary: '', createdAt: '', updatedAt: '',
  })),
}));

beforeEach(() => { vi.clearAllMocks(); });

// ── ABR FSM non-regression ────────────────────────────────────────────────────

describe('ABR incident FSM — not affected by matter service adapter', () => {
  it('new → triage still valid', () => expect(isValidTransition('new', 'triage')).toBe(true));
  it('new → archived still invalid', () => expect(isValidTransition('new', 'archived')).toBe(false));
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('assertValidPracticeArea', () => {
  it('accepts housing', () => expect(() => assertValidPracticeArea('housing')).not.toThrow());
  it('accepts employment', () => expect(() => assertValidPracticeArea('employment')).not.toThrow());
  it('accepts debt', () => expect(() => assertValidPracticeArea('debt')).not.toThrow());
  it('rejects unknown value', () => {
    expect(() => assertValidPracticeArea('criminal')).toThrow(CourtLensValidationError);
  });
  it('error message includes the invalid value', () => {
    expect(() => assertValidPracticeArea('criminal')).toThrow('"criminal"');
  });
});

describe('assertValidSubIssue', () => {
  it('accepts eviction', () => expect(() => assertValidSubIssue('eviction')).not.toThrow());
  it('accepts unpaid_wages', () => expect(() => assertValidSubIssue('unpaid_wages')).not.toThrow());
  it('accepts collector_harassment', () => expect(() => assertValidSubIssue('collector_harassment')).not.toThrow());
  it('rejects unknown value', () => {
    expect(() => assertValidSubIssue('parking_dispute')).toThrow(CourtLensValidationError);
  });
});

describe('assertValidRiskKeys', () => {
  it('accepts all known risk keys', () => {
    expect(() => assertValidRiskKeys(defaultRiskFlags())).not.toThrow();
  });
  it('accepts partial valid keys', () => {
    expect(() => assertValidRiskKeys({ risk_eviction: true, risk_lockout: false })).not.toThrow();
  });
  it('rejects unknown risk key', () => {
    expect(() => assertValidRiskKeys({ risk_eviction: true, risk_flying_car: true } as never)).toThrow(CourtLensValidationError);
  });
});

// ── deriveCourtLensFields ────────────────────────────────────────────────────

describe('deriveCourtLensFields', () => {
  it('returns defaults when no CourtLens events present', () => {
    const fields = deriveCourtLensFields([], 'employment');
    expect(fields.aiSummaryStatus).toBe('ai_draft');
    expect(fields.referralStatus).toBe('none');
    expect(fields.practiceArea).toBe('employment');
  });

  it('applies courtlens_fields_set event', () => {
    const fields = deriveCourtLensFields([
      { clEventType: 'courtlens_fields_set', fields: { practiceArea: 'housing', subIssue: 'lockout' } },
    ], 'employment');
    expect(fields.practiceArea).toBe('housing');
    expect(fields.subIssue).toBe('lockout');
  });

  it('applies ai_summary_status_changed event', () => {
    const fields = deriveCourtLensFields([
      { clEventType: 'ai_summary_status_changed', from: 'ai_draft', to: 'needs_verification', actorType: 'ai' },
      { clEventType: 'ai_summary_status_changed', from: 'needs_verification', to: 'approved', actorType: 'human' },
    ], 'housing');
    expect(fields.aiSummaryStatus).toBe('approved');
  });

  it('applies referral_status_changed event', () => {
    const fields = deriveCourtLensFields([
      { clEventType: 'referral_status_changed', from: 'none', to: 'suggested' },
      { clEventType: 'referral_status_changed', from: 'suggested', to: 'approved' },
    ], 'housing');
    expect(fields.referralStatus).toBe('approved');
  });

  it('ignores non-CourtLens event payloads', () => {
    const fields = deriveCourtLensFields([
      { status: 'new', title: 'some incident event' },
      { from: 'new', to: 'triage', reason: 'normal transition' },
    ], 'debt');
    // Should be defaults since no clEventType present
    expect(fields.aiSummaryStatus).toBe('ai_draft');
    expect(fields.practiceArea).toBe('debt');
  });

  it('replays events in order — later events win', () => {
    const fields = deriveCourtLensFields([
      { clEventType: 'ai_summary_status_changed', from: 'ai_draft', to: 'needs_verification', actorType: 'ai' },
      { clEventType: 'ai_summary_status_changed', from: 'needs_verification', to: 'rejected', actorType: 'human' },
      { clEventType: 'ai_summary_status_changed', from: 'rejected', to: 'needs_verification', actorType: 'human' },
    ], 'housing');
    expect(fields.aiSummaryStatus).toBe('needs_verification');
  });
});

// ── createMatter ─────────────────────────────────────────────────────────────

describe('createMatter', () => {
  it('returns a CourtLensMatter with correct practiceArea', async () => {
    const matter = await createMatter('org-1', 'staff-1', {
      title: 'Housing intake', category: 'service_delivery', severity: 'high',
      intakeChannel: 'web', summary: 'Eviction risk', practiceArea: 'housing', subIssue: 'eviction',
    });
    expect(matter.practiceArea).toBe('housing');
    expect(matter.subIssue).toBe('eviction');
    expect(matter.orgId).toBe('org-1');
  });

  it('matter starts with ai_summary_status ai_draft', async () => {
    const matter = await createMatter('org-1', 'staff-1', {
      title: 'Employment intake', category: 'service_delivery', severity: 'medium',
      intakeChannel: 'web', summary: 'Wage dispute', practiceArea: 'employment',
    });
    expect(matter.aiSummaryStatus).toBe('ai_draft');
  });

  it('matter starts with referral_status none', async () => {
    const matter = await createMatter('org-1', 'staff-1', {
      title: 'Debt intake', category: 'service_delivery', severity: 'low',
      intakeChannel: 'web', summary: 'Collection letter', practiceArea: 'debt',
    });
    expect(matter.referralStatus).toBe('none');
  });

  it('rejects invalid practice area', async () => {
    await expect(createMatter('org-1', 'staff-1', {
      title: 'test', category: 'service_delivery', severity: 'low',
      intakeChannel: 'web', summary: 'test', practiceArea: 'criminal' as never,
    })).rejects.toThrow(CourtLensValidationError);
  });

  it('rejects invalid sub-issue', async () => {
    await expect(createMatter('org-1', 'staff-1', {
      title: 'test', category: 'service_delivery', severity: 'low',
      intakeChannel: 'web', summary: 'test', practiceArea: 'housing',
      subIssue: 'parking_dispute' as never,
    })).rejects.toThrow(CourtLensValidationError);
  });

  it('retains all ABR incident fields', async () => {
    const matter = await createMatter('org-clinic-1', 'staff-1', {
      title: 'Lockout case', category: 'service_delivery', severity: 'critical',
      intakeChannel: 'web', summary: 'Locked out by landlord', practiceArea: 'housing',
    });
    // ABR fields present and unmodified
    expect(matter.id).toBeTruthy();
    expect(matter.orgId).toBe('org-clinic-1');
    expect(matter.status).toBe('new');
    expect(matter.category).toBe('service_delivery');
  });
});

// ── getMatterDetail — derives CourtLens state from event history ──────────────

describe('getMatterDetail', () => {
  it('derives aiSummaryStatus from event history', async () => {
    const result = await (await import('../matter-service')).getMatterDetail('org-1', 'inc-test');
    expect(result).not.toBeNull();
    // Mock has: courtlens_fields_set (needs_verification) + ai_summary_status_changed (approved)
    expect(result!.matter.aiSummaryStatus).toBe('approved');
  });

  it('derives practiceArea from event history', async () => {
    const result = await (await import('../matter-service')).getMatterDetail('org-1', 'inc-test');
    expect(result!.matter.practiceArea).toBe('housing');
  });

  it('preserves orgId — tenant scope intact', async () => {
    const result = await (await import('../matter-service')).getMatterDetail('org-clinic-2', 'inc-test');
    expect(result!.matter.orgId).toBe('org-clinic-2');
  });

  it('returns null for unknown matter', async () => {
    const { getIncidentDetail } = await import('../service');
    vi.mocked(getIncidentDetail).mockResolvedValueOnce(null);
    const result = await (await import('../matter-service')).getMatterDetail('org-1', 'nonexistent');
    expect(result).toBeNull();
  });
});

// ── updateAiSummaryStatus ─────────────────────────────────────────────────────

describe('updateAiSummaryStatus', () => {
  it('valid transition succeeds', async () => {
    const result = await updateAiSummaryStatus('org-1', 'inc-1', 'reviewer-1', 'needs_verification', 'approved', 'human');
    expect(result.success).toBe(true);
    if (result.success) expect(result.to).toBe('approved');
  });

  it('invalid transition fails with reason', async () => {
    const result = await updateAiSummaryStatus('org-1', 'inc-1', 'reviewer-1', 'ai_draft', 'approved', 'human');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toMatch(/ai_draft.*approved/);
  });

  it('AI actor cannot approve a packet', async () => {
    const result = await updateAiSummaryStatus('org-1', 'inc-1', 'ai-system', 'needs_verification', 'approved', 'ai');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toMatch(/human actor/);
  });

  it('AI actor cannot mark revised_by_human', async () => {
    const result = await updateAiSummaryStatus('org-1', 'inc-1', 'ai-system', 'needs_verification', 'revised_by_human', 'ai');
    expect(result.success).toBe(false);
  });

  it('human actor can reject', async () => {
    const result = await updateAiSummaryStatus('org-1', 'inc-1', 'reviewer-1', 'needs_verification', 'rejected', 'human');
    expect(result.success).toBe(true);
  });

  it('returns not found for missing matter', async () => {
    const { getIncidentDetail } = await import('../service');
    vi.mocked(getIncidentDetail).mockResolvedValueOnce(null);
    const result = await updateAiSummaryStatus('org-1', 'missing', 'reviewer-1', 'ai_draft', 'needs_verification', 'human');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toMatch(/not found/);
  });
});

// ── updateReferralStatus ──────────────────────────────────────────────────────

describe('updateReferralStatus', () => {
  it('valid transition none → suggested succeeds', async () => {
    const result = await updateReferralStatus('org-1', 'inc-1', 'reviewer-1', 'none', 'suggested');
    expect(result.success).toBe(true);
  });

  it('cannot jump from suggested to sent — must go through approved', async () => {
    const result = await updateReferralStatus('org-1', 'inc-1', 'reviewer-1', 'suggested', 'sent');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toMatch(/suggested.*sent/);
  });

  it('approved → sent succeeds', async () => {
    const result = await updateReferralStatus('org-1', 'inc-1', 'reviewer-1', 'approved', 'sent');
    expect(result.success).toBe(true);
  });

  it('completed is terminal — no further transitions', async () => {
    for (const to of ['none', 'suggested', 'approved', 'sent'] as const) {
      const result = await updateReferralStatus('org-1', 'inc-1', 'reviewer-1', 'completed', to);
      expect(result.success).toBe(false);
    }
  });

  it('returns not found for missing matter', async () => {
    const { getIncidentDetail } = await import('../service');
    vi.mocked(getIncidentDetail).mockResolvedValueOnce(null);
    const result = await updateReferralStatus('org-1', 'missing', 'reviewer-1', 'none', 'suggested');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toMatch(/not found/);
  });
});

// ── toMatterQueueItem ─────────────────────────────────────────────────────────

describe('toMatterQueueItem', () => {
  const baseMatter: CourtLensMatter = {
    id: 'inc-q-1', orgId: 'org-1', title: 'Eviction risk',
    category: 'service_delivery', severity: 'high', status: 'investigating',
    intakeChannel: 'web', createdBy: 'u1', assignedTo: 'reviewer-1',
    openedAt: '2026-07-02T01:00:00Z', dueAt: null, closedAt: null,
    summary: 'At risk', createdAt: '2026-07-02T01:00:00Z', updatedAt: '2026-07-02T01:00:00Z',
    ...defaultCourtLensFields('housing'),
  };

  it('produces correct statusLabel for investigating', () => {
    expect(toMatterQueueItem(baseMatter).statusLabel).toBe('Under Review');
  });

  it('isPacketExternalizable false for ai_draft', () => {
    expect(toMatterQueueItem(baseMatter).isPacketExternalizable).toBe(false);
  });

  it('isPacketExternalizable true for approved', () => {
    const approved: CourtLensMatter = { ...baseMatter, aiSummaryStatus: 'approved' };
    expect(toMatterQueueItem(approved).isPacketExternalizable).toBe(true);
  });

  it('orgId preserved in queue item', () => {
    expect(toMatterQueueItem(baseMatter).orgId).toBe('org-1');
  });

  it('practiceArea preserved', () => {
    expect(toMatterQueueItem(baseMatter).practiceArea).toBe('housing');
  });

  it('does not expose notes, events, or evidence payloads', () => {
    const item = toMatterQueueItem(baseMatter) as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty('notes');
    expect(item).not.toHaveProperty('events');
    expect(item).not.toHaveProperty('riskFlags');
    expect(item).not.toHaveProperty('clientProfile');
  });
});
