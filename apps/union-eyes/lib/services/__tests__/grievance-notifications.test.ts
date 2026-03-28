/**
 * Grievance Notifications — Unit Tests
 *
 * All 9 notification functions: filed, assigned, stageChange, deadline,
 * resolved, documentAdded, comment, escalation, settlementProposal.
 *
 * Tier 2 — Core Business Logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

// We need a stable reference that survives hoisting.
// vi.hoisted() returns values that ARE available inside vi.mock factories.
const { mockSend, mockQueue } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue(undefined),
  mockQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: () => ({ send: mockSend, queue: mockQueue }),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ phone: '+15551234567', name: 'Officer' }]),
        }),
      }),
    }),
  },
}));

vi.mock('@/db/schema/user-management-schema', () => ({
  users: { email: 'email', phone: 'phone', displayName: 'displayName' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ type: 'eq', args: a })),
  relations: vi.fn(() => ({})),
  sql: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  like: vi.fn(),
  ilike: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  isNotNull: vi.fn(),
  count: vi.fn(),
  not: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  sendGrievanceFiledNotification,
  sendGrievanceAssignedNotification,
  sendGrievanceStageChangeNotification,
  sendGrievanceDeadlineReminder,
  sendGrievanceResolvedNotification,
  sendGrievanceDocumentAddedNotification,
  sendGrievanceCommentNotification,
  sendGrievanceEscalationNotification,
  sendSettlementProposalNotification,
} from '../grievance-notifications';

// ── Test data ────────────────────────────────────────────────────────────────

const baseContext = {
  organizationId: 'org-1',
  grievanceId: 'GRV-001',
  grievanceNumber: 'GRV-2025-001',
  grievanceSubject: 'Unfair scheduling',
  grievantName: 'Jane Doe',
  grievantEmail: 'jane@example.com',
  assignedOfficerEmail: 'officer@example.com',
  assignedOfficerName: 'John Steward',
  currentStage: 'informal',
  userId: 'usr-1',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('grievance notification functions', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── sendGrievanceFiledNotification ─────────────────────────────────────

  it('sendGrievanceFiledNotification sends email to grievant', async () => {
    await sendGrievanceFiledNotification(baseContext);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'jane@example.com',
        type: 'email',
        priority: 'high',
      }),
    );
  });

  it('sendGrievanceFiledNotification skips if no grievant email', async () => {
    await sendGrievanceFiledNotification({ ...baseContext, grievantEmail: undefined });
    expect(mockSend).not.toHaveBeenCalled();
  });

  // ── sendGrievanceAssignedNotification ──────────────────────────────────

  it('sendGrievanceAssignedNotification sends to officer + grievant', async () => {
    await sendGrievanceAssignedNotification(baseContext);
    // 2 emails + 1 push
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockQueue).toHaveBeenCalledOnce();
    // Officer email
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'officer@example.com', priority: 'high' }),
    );
    // Grievant email about officer assignment
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'jane@example.com', priority: 'normal' }),
    );
  });

  // ── sendGrievanceStageChangeNotification ───────────────────────────────

  it('sendGrievanceStageChangeNotification notifies both parties', async () => {
    await sendGrievanceStageChangeNotification({
      ...baseContext,
      previousStage: 'informal',
      newStage: 'formal_step_1',
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'jane@example.com',
        body: expect.stringContaining('formal_step_1'),
      }),
    );
  });

  // ── sendGrievanceDeadlineReminder ──────────────────────────────────────

  it('sendGrievanceDeadlineReminder sends urgent priority if <=2 days', async () => {
    await sendGrievanceDeadlineReminder({
      ...baseContext,
      deadlineDate: new Date(2025, 5, 15),
      daysRemaining: 1,
    });
    // Email + SMS
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email', priority: 'urgent' }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sms', priority: 'urgent' }),
    );
  });

  it('sendGrievanceDeadlineReminder sends high priority if >2 days', async () => {
    await sendGrievanceDeadlineReminder({
      ...baseContext,
      deadlineDate: new Date(2025, 5, 20),
      daysRemaining: 5,
    });
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email', priority: 'high' }),
    );
  });

  // ── sendGrievanceResolvedNotification ──────────────────────────────────

  it('sendGrievanceResolvedNotification sends to both parties', async () => {
    await sendGrievanceResolvedNotification({
      ...baseContext,
      resolutionType: 'settled',
      resolutionSummary: 'Agreement reached',
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'jane@example.com',
        subject: expect.stringContaining('Grievance Settled'),
      }),
    );
  });

  // ── sendGrievanceDocumentAddedNotification ─────────────────────────────

  it('sendGrievanceDocumentAddedNotification notifies the other party', async () => {
    await sendGrievanceDocumentAddedNotification({
      ...baseContext,
      documentName: 'evidence.pdf',
      uploadedBy: 'jane@example.com', // uploaded by grievant → notify officer
    });
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'officer@example.com' }),
    );
  });

  // ── sendGrievanceCommentNotification ───────────────────────────────────

  it('sendGrievanceCommentNotification excludes comment author', async () => {
    await sendGrievanceCommentNotification({
      ...baseContext,
      commentAuthor: 'jane@example.com',
      commentPreview: 'Please review attached doc',
    });
    // Only officer should be notified, not the comment author
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'officer@example.com' }),
    );
  });

  // ── sendGrievanceEscalationNotification ────────────────────────────────

  it('sendGrievanceEscalationNotification sends urgent to all escalation targets', async () => {
    await sendGrievanceEscalationNotification({
      ...baseContext,
      escalatedTo: ['president@union.org', 'vp@union.org'],
      escalationReason: 'Unresolved past deadline',
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'president@union.org', priority: 'urgent' }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'vp@union.org', priority: 'urgent' }),
    );
  });

  // ── sendSettlementProposalNotification ─────────────────────────────────

  it('sendSettlementProposalNotification sends to grievant', async () => {
    await sendSettlementProposalNotification({
      ...baseContext,
      proposedBy: 'officer@example.com',
      settlementSummary: '2 weeks additional leave',
    });
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'jane@example.com',
        priority: 'high',
        body: expect.stringContaining('2 weeks additional leave'),
      }),
    );
  });

  // ── Error resilience ───────────────────────────────────────────────────

  it('swallows errors and logs them', async () => {
    mockSend.mockRejectedValueOnce(new Error('SMTP down'));
    const { logger } = await import('@/lib/logger');

    await sendGrievanceFiledNotification(baseContext);
    expect(vi.mocked(logger.error)).toHaveBeenCalled();
  });
});
