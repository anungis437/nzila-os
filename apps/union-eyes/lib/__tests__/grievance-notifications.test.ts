import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockQueue: vi.fn(),
  mockSelect: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(result: any = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ['from', 'where', 'limit']) {
    c[m] = vi.fn(() => c);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c.then = (resolve: any) => resolve(result);
  return c;
}

vi.mock('@/db', () => ({
  db: { select: mocks.mockSelect },
}));

vi.mock('@/db/schema/user-management-schema', () => ({
  users: { email: 'email', phone: 'phone', displayName: 'displayName' },
}));

vi.mock('./notification-service', () => ({
  getNotificationService: () => ({
    send: mocks.mockSend,
    queue: mocks.mockQueue,
  }),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ _t: 'eq', _a: a })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
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
} from '@/lib/services/grievance-notifications';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */
const CTX = {
  organizationId: 'org-1',
  grievanceId: 'g-1',
  grievanceNumber: 'GRV-001',
  grievanceSubject: 'Overtime dispute',
  grievantName: 'Jane Doe',
  grievantEmail: 'jane@example.com',
  assignedOfficerEmail: 'officer@example.com',
  assignedOfficerName: 'John Smith',
  currentStage: 'step1',
  userId: 'u-1',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('grievance-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue(undefined);
    mocks.mockQueue.mockResolvedValue(undefined);
  });

  // ================================================================
  // sendGrievanceFiledNotification
  // ================================================================
  describe('sendGrievanceFiledNotification', () => {
    it('sends email to grievant', async () => {
      await sendGrievanceFiledNotification(CTX);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'jane@example.com',
          type: 'email',
          priority: 'high',
          subject: expect.stringContaining('GRV-001'),
        }),
      );
    });

    it('skips notification when no grievant email', async () => {
      await sendGrievanceFiledNotification({ ...CTX, grievantEmail: undefined });
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });

    it('does not throw on error', async () => {
      mocks.mockSend.mockRejectedValue(new Error('send fail'));
      await expect(sendGrievanceFiledNotification(CTX)).resolves.toBeUndefined();
    });
  });

  // ================================================================
  // sendGrievanceAssignedNotification
  // ================================================================
  describe('sendGrievanceAssignedNotification', () => {
    it('sends email and push to officer, email to grievant', async () => {
      await sendGrievanceAssignedNotification(CTX);
      // Email to officer + push to officer + email to grievant = 3 total (2 send + 1 queue)
      expect(mocks.mockSend).toHaveBeenCalledTimes(2);
      expect(mocks.mockQueue).toHaveBeenCalledTimes(1);
      // Push notification
      expect(mocks.mockQueue).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'push', priority: 'high' }),
      );
    });

    it('skips officer notification when no officer email', async () => {
      await sendGrievanceAssignedNotification({ ...CTX, assignedOfficerEmail: undefined });
      // Only grievant email
      expect(mocks.mockSend).toHaveBeenCalledTimes(1);
      expect(mocks.mockQueue).not.toHaveBeenCalled();
    });

    it('skips grievant notification when no grievant email', async () => {
      await sendGrievanceAssignedNotification({ ...CTX, grievantEmail: undefined });
      // Officer email only + push
      expect(mocks.mockSend).toHaveBeenCalledTimes(1);
      expect(mocks.mockQueue).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // sendGrievanceStageChangeNotification
  // ================================================================
  describe('sendGrievanceStageChangeNotification', () => {
    it('notifies both grievant and officer', async () => {
      await sendGrievanceStageChangeNotification({
        ...CTX,
        previousStage: 'step1',
        newStage: 'step2',
      });
      expect(mocks.mockSend).toHaveBeenCalledTimes(2);
    });

    it('includes stage info in body', async () => {
      await sendGrievanceStageChangeNotification({
        ...CTX,
        previousStage: 'step1',
        newStage: 'step2',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('step2'),
        }),
      );
    });
  });

  // ================================================================
  // sendGrievanceDeadlineReminder
  // ================================================================
  describe('sendGrievanceDeadlineReminder', () => {
    it('sends email to officer', async () => {
      await sendGrievanceDeadlineReminder({
        ...CTX,
        deadlineDate: new Date(2026, 5, 15),
        daysRemaining: 5,
      });
      expect(mocks.mockSend).toHaveBeenCalledTimes(1);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
          recipientEmail: 'officer@example.com',
        }),
      );
    });

    it('uses urgent priority when ≤ 2 days', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ phone: '+15551234567', name: 'Officer' }]));
      await sendGrievanceDeadlineReminder({
        ...CTX,
        deadlineDate: new Date(2026, 5, 15),
        daysRemaining: 2,
      });
      // First call: email (urgent), Second call: SMS
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'urgent', type: 'email' }),
      );
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sms' }),
      );
    });

    it('sends SMS when officer has phone and ≤ 2 days', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ phone: '+15551234567', name: 'Officer' }]));
      await sendGrievanceDeadlineReminder({
        ...CTX,
        deadlineDate: new Date(2026, 5, 15),
        daysRemaining: 1,
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sms', recipientPhone: '+15551234567' }),
      );
    });

    it('skips SMS when officer has no phone', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ phone: null, name: 'Officer' }]));
      await sendGrievanceDeadlineReminder({
        ...CTX,
        deadlineDate: new Date(2026, 5, 15),
        daysRemaining: 1,
      });
      // Only email, no SMS
      expect(mocks.mockSend).toHaveBeenCalledTimes(1);
    });

    it('continues on SMS failure', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ phone: '+15551234567', name: 'Officer' }]));
      mocks.mockSend
        .mockResolvedValueOnce(undefined) // email OK
        .mockRejectedValueOnce(new Error('sms fail')); // SMS fails
      await expect(
        sendGrievanceDeadlineReminder({
          ...CTX,
          deadlineDate: new Date(2026, 5, 15),
          daysRemaining: 1,
        }),
      ).resolves.toBeUndefined();
    });

    it('skips when no officer email', async () => {
      await sendGrievanceDeadlineReminder({
        ...CTX,
        assignedOfficerEmail: undefined,
        deadlineDate: new Date(2026, 5, 15),
        daysRemaining: 3,
      });
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // sendGrievanceResolvedNotification
  // ================================================================
  describe('sendGrievanceResolvedNotification', () => {
    it('notifies grievant with settled title', async () => {
      await sendGrievanceResolvedNotification({
        ...CTX,
        resolutionType: 'settled',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Grievance Settled'),
        }),
      );
    });

    it('notifies grievant with denied title', async () => {
      await sendGrievanceResolvedNotification({
        ...CTX,
        resolutionType: 'denied',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Grievance Denied'),
        }),
      );
    });

    it('notifies both grievant and officer', async () => {
      await sendGrievanceResolvedNotification({
        ...CTX,
        resolutionType: 'withdrawn',
      });
      expect(mocks.mockSend).toHaveBeenCalledTimes(2);
    });
  });

  // ================================================================
  // sendGrievanceDocumentAddedNotification
  // ================================================================
  describe('sendGrievanceDocumentAddedNotification', () => {
    it('notifies officer when grievant uploads', async () => {
      await sendGrievanceDocumentAddedNotification({
        ...CTX,
        documentName: 'evidence.pdf',
        uploadedBy: 'jane@example.com',
      });
      // Uploader is grievant → officer gets notified, grievant doesn't get own upload
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ recipientEmail: 'officer@example.com' }),
      );
    });

    it('notifies grievant when officer uploads', async () => {
      await sendGrievanceDocumentAddedNotification({
        ...CTX,
        documentName: 'response.pdf',
        uploadedBy: 'officer@example.com',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ recipientEmail: 'jane@example.com' }),
      );
    });

    it('notifies both when third party uploads', async () => {
      await sendGrievanceDocumentAddedNotification({
        ...CTX,
        documentName: 'doc.pdf',
        uploadedBy: 'other@example.com',
      });
      expect(mocks.mockSend).toHaveBeenCalledTimes(2);
    });
  });

  // ================================================================
  // sendGrievanceCommentNotification
  // ================================================================
  describe('sendGrievanceCommentNotification', () => {
    it('notifies other parties excluding comment author', async () => {
      await sendGrievanceCommentNotification({
        ...CTX,
        commentAuthor: 'jane@example.com',
        commentPreview: 'I disagree with...',
      });
      // jane is author → officer should be notified
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'officer@example.com',
          body: expect.stringContaining('I disagree with'),
        }),
      );
    });

    it('uses Promise.all for multiple recipients', async () => {
      await sendGrievanceCommentNotification({
        ...CTX,
        commentAuthor: 'someone@else.com',
        commentPreview: 'Note about...',
      });
      // Both jane and officer get notified
      expect(mocks.mockSend).toHaveBeenCalledTimes(2);
    });
  });

  // ================================================================
  // sendGrievanceEscalationNotification
  // ================================================================
  describe('sendGrievanceEscalationNotification', () => {
    it('sends urgent emails to all escalation recipients', async () => {
      await sendGrievanceEscalationNotification({
        ...CTX,
        escalatedTo: ['mgr1@example.com', 'mgr2@example.com'],
        escalationReason: 'Deadline missed',
      });
      expect(mocks.mockSend).toHaveBeenCalledTimes(2);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'urgent',
          body: expect.stringContaining('Deadline missed'),
        }),
      );
    });

    it('does not throw on error', async () => {
      mocks.mockSend.mockRejectedValue(new Error('fail'));
      await expect(
        sendGrievanceEscalationNotification({
          ...CTX,
          escalatedTo: ['mgr@example.com'],
          escalationReason: 'test',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ================================================================
  // sendSettlementProposalNotification
  // ================================================================
  describe('sendSettlementProposalNotification', () => {
    it('sends high-priority email to grievant', async () => {
      await sendSettlementProposalNotification({
        ...CTX,
        proposedBy: 'officer@example.com',
        settlementSummary: 'Back pay of $5000',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'jane@example.com',
          priority: 'high',
          body: expect.stringContaining('Back pay of $5000'),
        }),
      );
    });

    it('skips when no grievant email', async () => {
      await sendSettlementProposalNotification({
        ...CTX,
        grievantEmail: undefined,
        proposedBy: 'officer@example.com',
        settlementSummary: 'test',
      });
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });
  });
});
