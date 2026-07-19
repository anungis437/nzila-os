/**
 * CourtLens Phase 2G end-to-end smoke test.
 *
 * Automates the full Phase 2 value chain against the in-memory service layer,
 * with no service mocking:
 *
 *   1. Public intake → tenant-scoped matter created (Phase 2A/2B).
 *   2. Matter appears in the tenant queue (Phase 2C).
 *   3. Cross-tenant queue does NOT include the matter (Phase 2C).
 *   4. getMatterDetail returns the matter with reconstructed CourtLens state
 *      (Phase 1D event replay).
 *   5. Reviewer role sees riskFlags + clientProfile; executive_viewer does not
 *      (Phase 2C.6 + Phase 2D redaction).
 *   6. AI packet status advances: ai_draft → needs_verification → approved
 *      via the reviewer service (Phase 2E).
 *   7. Referral status advances: none → suggested → approved → sent → completed
 *      (Phase 2E).
 *   8. Matter FSM advances through the ABR incident FSM (Phase 2E).
 *   9. Cross-tenant matter detail returns null (never leaks existence).
 *
 * This test is the automated backbone of docs/courtlens/phase-2/demo-smoke-gate.md.
 * If it fails, the demo smoke gate flips to RED.
 */

import { describe, expect, it } from 'vitest';
import {
  createMatterFromPublicIntake,
} from '../public-intake';
import {
  listMatterQueueForOrg,
  getMatterDetail,
  buildMatterDetailView,
  updateAiSummaryStatus,
  updateReferralStatus,
  transitionMatterStatus,
} from '../matter-service';

const TENANT = 'metro-university';
const OTHER_TENANT = 'northcare-hospital';

describe('Phase 2G end-to-end smoke — public intake → queue → detail → reviewer', () => {
  it('completes the full CourtLens Phase 2 value chain without leakage', async () => {
    // Step 1: public intake
    const conf = await createMatterFromPublicIntake({
      tenantSlug: TENANT,
      practiceArea: 'housing',
      subIssue: 'eviction',
      summary: 'Landlord served eviction notice with a 14-day deadline.',
      consentAcknowledged: true,
      riskFlags: { risk_eviction: true, risk_homelessness: true },
      hearingDate: '2026-08-01',
      contactName: 'Test Person',
      hasChildren: true,
    });

    expect(conf.matterId).toBeTruthy();
    expect(conf.practiceArea).toBe('housing');
    expect(conf.statusLabel).toBe('New Intake');
    expect(conf.legalBoundaryNotice).toContain('does not provide legal advice');
    // Confirmation must NOT expose internal orgId
    expect((conf as unknown as Record<string, unknown>).orgId).toBeUndefined();

    const matterId = conf.matterId;

    // Step 2: queue includes the new matter (correct tenant)
    const queue = await listMatterQueueForOrg(TENANT);
    const row = queue.find((r) => r.id === matterId);
    expect(row).toBeDefined();
    expect(row!.practiceArea).toBe('housing');
    expect(row!.subIssue).toBe('eviction');
    expect(row!.aiSummaryStatus).toBe('ai_draft');
    expect(row!.referralStatus).toBe('none');
    expect(row!.isPacketExternalizable).toBe(false);
    // Queue must NOT expose sensitive fields
    expect((row as unknown as Record<string, unknown>).clientProfile).toBeUndefined();
    expect((row as unknown as Record<string, unknown>).riskFlags).toBeUndefined();
    expect((row as unknown as Record<string, unknown>).notes).toBeUndefined();
    expect((row as unknown as Record<string, unknown>).events).toBeUndefined();

    // Step 3: cross-tenant queue does NOT include the matter
    const crossTenantQueue = await listMatterQueueForOrg(OTHER_TENANT);
    expect(crossTenantQueue.find((r) => r.id === matterId)).toBeUndefined();

    // Step 4: getMatterDetail reconstructs full CourtLens state via event replay
    const detail = await getMatterDetail(TENANT, matterId);
    expect(detail).not.toBeNull();
    expect(detail!.matter.practiceArea).toBe('housing');
    expect(detail!.matter.subIssue).toBe('eviction');
    expect(detail!.matter.riskFlags.risk_eviction).toBe(true);
    expect(detail!.matter.riskFlags.risk_homelessness).toBe(true);
    expect(detail!.matter.clientProfile?.clientName).toBe('Test Person');
    expect(detail!.matter.clientProfile?.hasChildren).toBe(true);

    // Step 5a: investigator role sees sensitive CourtLens fields
    const invView = buildMatterDetailView(detail!.matter, detail!.detail!, 'investigator');
    expect(invView.riskFlags).not.toBeNull();
    expect(invView.riskFlags!.risk_eviction).toBe(true);
    expect(invView.clientProfile).not.toBeNull();
    expect(invView.clientProfile!.clientName).toBe('Test Person');
    expect(invView.legalBoundaryNotice).toContain('does not provide legal advice');

    // Step 5b: executive_viewer redaction — no sensitive CourtLens fields
    const execView = buildMatterDetailView(detail!.matter, detail!.detail!, 'executive_viewer');
    expect(execView.riskFlags).toBeNull();
    expect(execView.clientProfile).toBeNull();
    expect(execView.clientGoal).toBeNull();
    expect(execView.hearingDate).toBeNull();
    expect(execView.deadlineDate).toBeNull();

    // Step 6: AI packet lifecycle — ai_draft → needs_verification → approved
    const aiStep1 = await updateAiSummaryStatus(TENANT, matterId, 'ai-system', 'ai_draft', 'needs_verification', 'ai');
    expect(aiStep1.success).toBe(true);

    // Human-only approval enforcement: an AI actor cannot approve
    const forgeAttempt = await updateAiSummaryStatus(TENANT, matterId, 'ai-system', 'needs_verification', 'approved', 'ai');
    expect(forgeAttempt.success).toBe(false);
    if (!forgeAttempt.success) expect(forgeAttempt.reason).toMatch(/human actor/);

    const aiStep2 = await updateAiSummaryStatus(TENANT, matterId, 'reviewer-1', 'needs_verification', 'approved', 'human');
    expect(aiStep2.success).toBe(true);

    // Verify state via replay
    const afterApproval = await getMatterDetail(TENANT, matterId);
    expect(afterApproval!.matter.aiSummaryStatus).toBe('approved');

    // Step 7: full referral lifecycle
    for (const [from, to] of [
      ['none', 'suggested'],
      ['suggested', 'approved'],
      ['approved', 'sent'],
      ['sent', 'completed'],
    ] as const) {
      const r = await updateReferralStatus(TENANT, matterId, 'reviewer-1', from, to);
      expect(r.success).toBe(true);
    }

    const afterReferral = await getMatterDetail(TENANT, matterId);
    expect(afterReferral!.matter.referralStatus).toBe('completed');

    // Also verify the invalid-transition guard: cannot skip to sent from suggested
    // (using a fresh matter to keep this test independent)
    const freshConf = await createMatterFromPublicIntake({
      tenantSlug: TENANT,
      practiceArea: 'debt',
      subIssue: 'wage_garnishment',
      summary: 'I received papers about wage garnishment for a debt I do not recognise.',
      consentAcknowledged: true,
    });
    const skipAttempt = await updateReferralStatus(TENANT, freshConf.matterId, 'reviewer-1', 'suggested', 'sent');
    expect(skipAttempt.success).toBe(false);

    // Step 8: matter FSM advance through several states
    const fsm1 = await transitionMatterStatus(TENANT, matterId, 'reviewer-1', { to: 'triage', reason: 'Smoke advance' });
    expect(fsm1).not.toBeNull();
    expect(fsm1!.status).toBe('triage');
    const fsm2 = await transitionMatterStatus(TENANT, matterId, 'reviewer-1', { to: 'assigned', reason: 'Smoke assign' });
    expect(fsm2!.status).toBe('assigned');

    // Step 9: cross-tenant matter detail lookup MUST return null (no leak)
    const crossTenantDetail = await getMatterDetail(OTHER_TENANT, matterId);
    expect(crossTenantDetail).toBeNull();
  });
});
