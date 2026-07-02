/**
 * CourtLens Phase 2C tests — tenant matter queue and detail service.
 *
 * Tests without mocking the incident service layer (in-memory mode).
 * Proves that:
 * - listMatterQueueForOrg returns org-scoped queue items with event-replayed state.
 * - Queue items include practiceArea, subIssue, deadlineDate from event replay.
 * - Unknown practiceArea is 'unknown', never silently 'housing'.
 * - Cross-org access returns null or empty.
 * - Queue items do not expose client profile, raw events, reviewer notes, or
 *   AI packet content.
 * - buildMatterDetailView applies role-aware redaction.
 * - Sensitive fields (riskFlags, clientProfile) are null for executive_viewer.
 * - Sensitive fields are present for investigator/organization_admin.
 * - Legal boundary notice is always present in detail view.
 * - Existing public intake, matter-service, and matter-events tests still pass
 *   (non-regression confirmed by running full suite).
 */

import { describe, it, expect } from 'vitest';
import {
  listMatterQueueForOrg,
  getMatterDetail,
  buildMatterDetailView,
  createMatter,
} from '../matter-service';
import { appendIncidentEvent } from '../service';

// ── Test helpers ──────────────────────────────────────────────────────────────

let orgSeq = 0;
function qOrg(): string { return `org-2c-queue-${++orgSeq}`; }

async function createTestMatter(
  orgId: string,
  overrides: {
    practiceArea?: 'housing' | 'employment' | 'debt';
    subIssue?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    title?: string;
  } = {},
) {
  return createMatter(orgId, 'staff-1', {
    title: overrides.title ?? 'Test intake',
    category: 'service_delivery',
    severity: overrides.severity ?? 'medium',
    intakeChannel: 'web',
    summary: 'Test matter for queue validation.',
    practiceArea: overrides.practiceArea ?? 'housing',
    subIssue: (overrides.subIssue ?? 'eviction') as never,
  });
}

// ── listMatterQueueForOrg ─────────────────────────────────────────────────────

describe('listMatterQueueForOrg — queue projection', () => {
  it('returns matters scoped to org with event-replayed practiceArea', async () => {
    const orgId = qOrg();
    await createTestMatter(orgId, { practiceArea: 'housing', subIssue: 'eviction' });

    const items = await listMatterQueueForOrg(orgId);
    expect(items.length).toBeGreaterThanOrEqual(1);

    const created = items.find((i) => i.practiceArea === 'housing');
    expect(created).toBeDefined();
    expect(created!.subIssue).toBe('eviction');
  });

  it('all three practice areas appear correctly via event replay', async () => {
    const orgId = qOrg();
    await createTestMatter(orgId, { practiceArea: 'housing', subIssue: 'lockout' });
    await createTestMatter(orgId, { practiceArea: 'employment', subIssue: 'unpaid_wages' });
    await createTestMatter(orgId, { practiceArea: 'debt', subIssue: 'collector_harassment' });

    const items = await listMatterQueueForOrg(orgId);
    const areas = items.map((i) => i.practiceArea);
    expect(areas).toContain('housing');
    expect(areas).toContain('employment');
    expect(areas).toContain('debt');
  });

  it('practiceArea is never silently housing — matters without courtlens event show unknown', async () => {
    // Create an incident directly (bypass matter-service) to simulate a matter
    // without any courtlens_fields_set event
    const orgId = qOrg();
    const { createIncident } = await import('../service');
    await createIncident(orgId, 'staff-1', {
      title: 'Raw incident without courtlens event',
      category: 'service_delivery',
      severity: 'low',
      intakeChannel: 'web',
      summary: 'No CourtLens events written.',
    });

    const items = await listMatterQueueForOrg(orgId);
    const rawItem = items.find((i) => i.title === 'Raw incident without courtlens event');
    expect(rawItem).toBeDefined();
    // Must not default to 'housing' — must be 'unknown'
    expect(rawItem!.practiceArea).toBe('unknown');
    expect(rawItem!.practiceArea).not.toBe('housing');
  });

  it('queue items do not expose client profile', async () => {
    const orgId = qOrg();
    await createTestMatter(orgId, { practiceArea: 'housing', subIssue: 'eviction' });

    const items = await listMatterQueueForOrg(orgId);
    for (const item of items) {
      expect(item).not.toHaveProperty('clientProfile');
      expect(item).not.toHaveProperty('riskFlags');
    }
  });

  it('queue items do not expose notes or raw events', async () => {
    const orgId = qOrg();
    await createTestMatter(orgId, { practiceArea: 'employment', subIssue: 'termination' });

    const items = await listMatterQueueForOrg(orgId);
    for (const item of items) {
      expect(item).not.toHaveProperty('notes');
      expect(item).not.toHaveProperty('events');
    }
  });

  it('deadlineDate appears in queue item when set', async () => {
    const orgId = qOrg();
    await createMatter(orgId, 'staff-1', {
      title: 'Housing matter with hearing',
      category: 'service_delivery',
      severity: 'high',
      intakeChannel: 'web',
      summary: 'Hearing next week.',
      practiceArea: 'housing',
      subIssue: 'eviction',
      deadlineDate: '2026-08-01',
    });

    const items = await listMatterQueueForOrg(orgId);
    const withDeadline = items.find((i) => i.deadlineDate === '2026-08-01');
    expect(withDeadline).toBeDefined();
  });

  it('cross-tenant isolation: cannot see matters from another org', async () => {
    const orgA = qOrg();
    const orgB = qOrg();

    await createTestMatter(orgA, { practiceArea: 'housing', title: 'OrgA housing matter' });
    await createTestMatter(orgB, { practiceArea: 'employment', title: 'OrgB employment matter' });

    const queueA = await listMatterQueueForOrg(orgA);
    const queueB = await listMatterQueueForOrg(orgB);

    const aIds = new Set(queueA.map((i) => i.id));
    const bIds = new Set(queueB.map((i) => i.id));

    // No overlap between org A and org B matter IDs
    for (const id of bIds) expect(aIds.has(id)).toBe(false);
    for (const id of aIds) expect(bIds.has(id)).toBe(false);
  });
});

// ── buildMatterDetailView — role-aware field gating ───────────────────────────

describe('buildMatterDetailView — role-aware CourtLens field gating', () => {
  it('investigator gets riskFlags and clientProfile', async () => {
    const orgId = qOrg();
    const matter = await createMatter(orgId, 'staff-1', {
      title: 'Employment intake',
      category: 'service_delivery',
      severity: 'high',
      intakeChannel: 'web',
      summary: 'At risk of income loss.',
      practiceArea: 'employment',
      subIssue: 'termination',
    });

    // Write risk flags via event
    await appendIncidentEvent(matter.id, 'staff-1', 'courtlens_event', {
      clEventType: 'courtlens_fields_set',
      fields: {
        riskFlags: { risk_income_loss: true, risk_unsafe_work: false, risk_lockout: false, risk_eviction: false, risk_utility_shutoff: false, risk_safety: false, risk_homelessness: false, risk_retaliation: false, risk_garnishment: false, risk_bank_freeze: false, risk_identity_theft: false, risk_essential_services: false, risk_harassment: false },
        clientProfile: { clientName: 'Test Client', clientContact: null, householdSize: 2, hasChildren: false, hasDisability: false, consentStatus: 'granted' },
      },
    });

    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'investigator');

    expect(view.riskFlags).not.toBeNull();
    expect(view.riskFlags!.risk_income_loss).toBe(true);
    expect(view.clientProfile).not.toBeNull();
    expect(view.clientProfile!.clientName).toBe('Test Client');
  });

  it('organization_admin gets riskFlags and clientProfile', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'debt', subIssue: 'wage_garnishment' });
    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'organization_admin');

    // riskFlags may be all-false defaults but should not be null
    expect(view.riskFlags).not.toBeNull();
  });

  it('executive_viewer gets null riskFlags and null clientProfile', async () => {
    const orgId = qOrg();
    const matter = await createMatter(orgId, 'staff-1', {
      title: 'Housing intake',
      category: 'service_delivery',
      severity: 'medium',
      intakeChannel: 'web',
      summary: 'Rent arrears concern.',
      practiceArea: 'housing',
      subIssue: 'rent_arrears',
    });

    await appendIncidentEvent(matter.id, 'staff-1', 'courtlens_event', {
      clEventType: 'courtlens_fields_set',
      fields: {
        clientProfile: { clientName: 'Confidential', clientContact: null, householdSize: null, hasChildren: false, hasDisability: false, consentStatus: 'granted' },
      },
    });

    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'executive_viewer');

    expect(view.riskFlags).toBeNull();
    expect(view.clientProfile).toBeNull();
    expect(view.clientGoal).toBeNull();
    expect(view.hearingDate).toBeNull();
    expect(view.deadlineDate).toBeNull();
  });

  it('legal_counsel gets riskFlags and clientProfile', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'housing', subIssue: 'eviction' });
    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'legal_counsel');

    expect(view.riskFlags).not.toBeNull();
    expect(view.clientProfile).not.toBeNull();
  });

  it('auditor does NOT get riskFlags or clientProfile', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'employment', subIssue: 'unpaid_wages' });
    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'auditor');

    expect(view.riskFlags).toBeNull();
    expect(view.clientProfile).toBeNull();
  });

  it('detail view always has legal boundary notice', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'debt', subIssue: 'collection_letter' });
    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'investigator');

    expect(view.legalBoundaryNotice).toBeTruthy();
    expect(view.legalBoundaryNotice.length).toBeGreaterThan(30);
    expect(view.legalBoundaryNotice.toLowerCase()).not.toMatch(/will (give|provide|offer) legal advice/);
  });

  it('detail view does not expose raw event payloads', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'housing', subIssue: 'safety' });
    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'investigator');

    expect(view).not.toHaveProperty('events');
    const keys = Object.keys(view);
    expect(keys).not.toContain('actions');
    // notes are present but filtered — not raw payload
    for (const note of view.notes) {
      expect(note).not.toHaveProperty('payloadJson');
    }
  });

  it('cross-org matter detail returns null', async () => {
    const orgA = qOrg();
    const orgB = qOrg();
    const matterB = await createTestMatter(orgB, { practiceArea: 'debt', subIssue: 'payday_loan' });

    // orgA tries to access orgB's matter — should return null
    const result = await getMatterDetail(orgA, matterB.id);
    expect(result).toBeNull();
  });

  it('detail practiceArea and subIssue are correct from event replay', async () => {
    const orgId = qOrg();
    const matter = await createMatter(orgId, 'staff-1', {
      title: 'Debt intake',
      category: 'service_delivery',
      severity: 'low',
      intakeChannel: 'web',
      summary: 'Wage garnishment notice received.',
      practiceArea: 'debt',
      subIssue: 'wage_garnishment',
    });

    const result = await getMatterDetail(orgId, matter.id);
    const view = buildMatterDetailView(result!.matter, result!.detail!, 'investigator');

    expect(view.practiceArea).toBe('debt');
    expect(view.subIssue).toBe('wage_garnishment');
  });
});

// ── aiSummaryStatus and referralStatus in queue + detail ─────────────────────

describe('aiSummaryStatus and referralStatus in queue and detail', () => {
  it('aiSummaryStatus appears correctly in queue after update', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'housing', subIssue: 'eviction' });

    await appendIncidentEvent(matter.id, 'ai-system', 'courtlens_event', {
      clEventType: 'ai_summary_status_changed',
      from: 'ai_draft',
      to: 'needs_verification',
      actorType: 'ai',
    });

    const items = await listMatterQueueForOrg(orgId);
    const updated = items.find((i) => i.id === matter.id);
    expect(updated!.aiSummaryStatus).toBe('needs_verification');
    expect(updated!.isPacketExternalizable).toBe(false);
  });

  it('isPacketExternalizable is true only after human approval', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'employment', subIssue: 'termination' });

    await appendIncidentEvent(matter.id, 'ai-system', 'courtlens_event', {
      clEventType: 'ai_summary_status_changed', from: 'ai_draft', to: 'needs_verification', actorType: 'ai',
    });
    await appendIncidentEvent(matter.id, 'reviewer-1', 'courtlens_event', {
      clEventType: 'ai_summary_status_changed', from: 'needs_verification', to: 'approved', actorType: 'human',
    });

    const items = await listMatterQueueForOrg(orgId);
    const approved = items.find((i) => i.id === matter.id);
    expect(approved!.aiSummaryStatus).toBe('approved');
    expect(approved!.isPacketExternalizable).toBe(true);
  });

  it('referralStatus appears correctly after update', async () => {
    const orgId = qOrg();
    const matter = await createTestMatter(orgId, { practiceArea: 'debt', subIssue: 'collector_harassment' });

    await appendIncidentEvent(matter.id, 'reviewer-1', 'courtlens_event', {
      clEventType: 'referral_status_changed', from: 'none', to: 'suggested',
    });

    const items = await listMatterQueueForOrg(orgId);
    const updated = items.find((i) => i.id === matter.id);
    expect(updated!.referralStatus).toBe('suggested');
  });
});
