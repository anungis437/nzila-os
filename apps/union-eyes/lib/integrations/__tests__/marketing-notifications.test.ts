/**
 * Marketing Growth Engine Notifications — Unit Tests
 *
 * Each send*Notification helper resolves the notification service, calls
 * .send(...), and returns { success: true } or { success: false, error }
 * on failure. We mock the notification service factory and assert both paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ send: vi.fn(), getService: vi.fn() }));

vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: () => h.getService(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as m from '../marketing-notifications';

beforeEach(() => {
  h.send.mockReset();
  h.send.mockResolvedValue(undefined);
  h.getService.mockReset();
  h.getService.mockReturnValue({ send: h.send });
});

describe('marketing-notifications — success paths', () => {
  it('sendPilotApprovalNotification (with approver notes)', async () => {
    expect(
      await m.sendPilotApprovalNotification('org', 'a@x.com', 'A', 'Org', 'p1', 'good fit'),
    ).toEqual({ success: true });
    expect(h.send).toHaveBeenCalledOnce();
  });
  it('sendPilotApprovalNotification (no notes branch)', async () => {
    expect(await m.sendPilotApprovalNotification('org', 'a@x.com', 'A', 'Org', 'p1')).toEqual({
      success: true,
    });
  });
  it('sendPilotRejectionNotification (with + without reason)', async () => {
    expect(
      await m.sendPilotRejectionNotification('org', 'a@x.com', 'A', 'Org', 'p1', 'no capacity'),
    ).toEqual({ success: true });
    expect(await m.sendPilotRejectionNotification('org', 'a@x.com', 'A', 'Org', 'p1')).toEqual({
      success: true,
    });
  });
  it('sendConsentGrantedNotification maps known + unknown data types', async () => {
    expect(
      await m.sendConsentGrantedNotification('org', 'u1', 'a@x.com', 'A', ['impact_metrics', 'custom']),
    ).toEqual({ success: true });
  });
  it('sendConsentRevokedNotification (with + without reason)', async () => {
    expect(
      await m.sendConsentRevokedNotification('org', 'u1', 'a@x.com', 'A', ['impact_metrics'], 'too much'),
    ).toEqual({ success: true });
    expect(
      await m.sendConsentRevokedNotification('org', 'u1', 'a@x.com', 'A', ['impact_metrics']),
    ).toEqual({ success: true });
  });
  it('sendTestimonialApprovedNotification truncates long quotes', async () => {
    const longQuote = 'x'.repeat(200);
    expect(
      await m.sendTestimonialApprovedNotification('org', 'a@x.com', 'A', 't1', longQuote),
    ).toEqual({ success: true });
    expect(
      await m.sendTestimonialApprovedNotification('org', 'a@x.com', 'A', 't1', 'short'),
    ).toEqual({ success: true });
  });
  it('sendCaseStudyPublishedNotification sends to each team member', async () => {
    expect(
      await m.sendCaseStudyPublishedNotification('org', ['a@x.com', 'b@x.com'], 'slug', 'Title', 'Org'),
    ).toEqual({ success: true });
    expect(h.send).toHaveBeenCalledTimes(2);
  });
});

describe('marketing-notifications — error paths', () => {
  beforeEach(() =>
    h.getService.mockReturnValue({
      // plain (non-spy) function so the rejected promise is not retained in a
      // mock.results array, which vitest would otherwise flag as unhandled.
      send: () => Promise.reject(new Error('smtp down')),
    }),
  );
  it('each helper returns { success:false, error } on failure', async () => {
    const calls: Array<() => Promise<{ success: boolean; error?: string }>> = [
      () => m.sendPilotApprovalNotification('org', 'a@x.com', 'A', 'Org', 'p1'),
      () => m.sendPilotRejectionNotification('org', 'a@x.com', 'A', 'Org', 'p1'),
      () => m.sendConsentGrantedNotification('org', 'u1', 'a@x.com', 'A', ['x']),
      () => m.sendConsentRevokedNotification('org', 'u1', 'a@x.com', 'A', ['x']),
      () => m.sendTestimonialApprovedNotification('org', 'a@x.com', 'A', 't1', 'q'),
      () => m.sendCaseStudyPublishedNotification('org', ['a@x.com'], 'slug', 'Title', 'Org'),
    ];
    for (const call of calls) {
      const f = await call();
      expect(f.success).toBe(false);
      expect(f.error).toBe('smtp down');
    }
  });
});
