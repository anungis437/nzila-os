import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  chainQueue: [] as unknown[],
  notifySend: vi.fn(),
  q: {
    profilesFindFirst: vi.fn(),
    threadsFindMany: vi.fn(),
    messagesFindMany: vi.fn(),
    receiptsFindMany: vi.fn(),
    claimsFindMany: vi.fn(),
    claimUpdatesFindMany: vi.fn(),
    sessionsFindMany: vi.fn(),
    votesFindMany: vi.fn(),
  },
}));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'set', 'values', 'returning', 'limit', 'orderBy']) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: (r: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(h.chainQueue.shift() ?? []);
  };
  return c;
}

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => chain()),
    update: vi.fn(() => chain()),
    delete: vi.fn(() => chain()),
    select: vi.fn(() => chain()),
    query: {
      profiles: { findFirst: h.q.profilesFindFirst },
      messageThreads: { findMany: h.q.threadsFindMany },
      messages: { findMany: h.q.messagesFindMany },
      messageReadReceipts: { findMany: h.q.receiptsFindMany },
      claims: { findMany: h.q.claimsFindMany },
      claimUpdates: { findMany: h.q.claimUpdatesFindMany },
      votingSessions: { findMany: h.q.sessionsFindMany },
      votes: { findMany: h.q.votesFindMany },
    },
  },
}));

vi.mock('@/db/schema', () => {
  const table = (name: string) => new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    userConsents: table('userConsents'),
    cookieConsents: table('cookieConsents'),
    gdprDataRequests: table('gdprDataRequests'),
    dataAnonymizationLog: table('dataAnonymizationLog'),
    messages: table('messages'),
    messageThreads: table('messageThreads'),
    messageReadReceipts: table('messageReadReceipts'),
    claims: table('claims'),
    claimUpdates: table('claimUpdates'),
    votes: table('votes'),
    votingSessions: table('votingSessions'),
    profiles: table('profiles'),
    smsMessages: table('smsMessages'),
    smsCampaignRecipients: table('smsCampaignRecipients'),
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
  desc: vi.fn(() => 'desc'),
  or: vi.fn(() => 'or'),
  sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn(() => 'sql') }),
}));

vi.mock('@/lib/services/notification-service', () => ({
  NotificationService: class {
    send = h.notifySend;
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  ConsentManager,
  CookieConsentManager,
  DataErasureService,
  DataExportService,
  GdprRequestManager,
} from '../consent-manager';

beforeEach(() => {
  h.chainQueue = [];
  h.notifySend.mockReset().mockResolvedValue(undefined);
  for (const fn of Object.values(h.q)) fn.mockReset().mockResolvedValue([]);
});

describe('ConsentManager', () => {
  it('recordConsent inserts and returns', async () => {
    h.chainQueue = [[{ id: 'c1' }]];
    expect(await ConsentManager.recordConsent({
      userId: 'u', organizationId: 'o', consentType: 'analytics', legalBasis: 'consent',
      processingPurpose: 'p', consentVersion: '1', consentText: 't',
    })).toEqual({ id: 'c1' });
  });

  it('withdrawConsent returns true/false', async () => {
    h.chainQueue = [[{ id: 'c1' }]];
    expect(await ConsentManager.withdrawConsent('u', 'c1')).toBe(true);
    h.chainQueue = [[]];
    expect(await ConsentManager.withdrawConsent('u', 'c1')).toBe(false);
  });

  it('getUserConsents queries active consents', async () => {
    h.chainQueue = [[{ id: 'c1' }]];
    expect(await ConsentManager.getUserConsents('u', 'o')).toEqual([{ id: 'c1' }]);
  });

  it('hasConsent returns boolean', async () => {
    h.chainQueue = [[{ id: 'c1' }]];
    expect(await ConsentManager.hasConsent('u', 'o', 'analytics')).toBe(true);
    h.chainQueue = [[]];
    expect(await ConsentManager.hasConsent('u', 'o', 'analytics')).toBe(false);
  });
});

describe('CookieConsentManager', () => {
  const data = {
    organizationId: 'o', consentId: 'cid', essential: true, functional: false,
    analytics: true, marketing: false,
  };

  it('updates when consent exists', async () => {
    h.chainQueue = [[{ id: 'existing' }], [{ id: 'updated' }]];
    expect(await CookieConsentManager.saveCookieConsent(data)).toEqual({ id: 'updated' });
  });

  it('inserts when consent is new', async () => {
    h.chainQueue = [[], [{ id: 'new' }]];
    expect(await CookieConsentManager.saveCookieConsent(data)).toEqual({ id: 'new' });
  });

  it('getCookieConsent returns first or null', async () => {
    h.chainQueue = [[{ id: 'x' }]];
    expect(await CookieConsentManager.getCookieConsent('cid')).toEqual({ id: 'x' });
    h.chainQueue = [[]];
    expect(await CookieConsentManager.getCookieConsent('cid')).toBeNull();
  });

  it('isConsentValid checks expiry', async () => {
    h.chainQueue = [[{ expiresAt: new Date(Date.now() + 1000) }]];
    expect(await CookieConsentManager.isConsentValid('cid')).toBe(true);
    h.chainQueue = [[]];
    expect(await CookieConsentManager.isConsentValid('cid')).toBe(false);
  });
});

describe('GdprRequestManager', () => {
  it('requestDataAccess inserts and notifies', async () => {
    h.chainQueue = [[{ id: 'r1' }]];
    expect(await GdprRequestManager.requestDataAccess({ userId: 'u', organizationId: 'o' })).toEqual({ id: 'r1' });
    expect(h.notifySend).toHaveBeenCalled();
  });

  it('requestDataAccess tolerates notification failure', async () => {
    h.notifySend.mockRejectedValue(new Error('notify fail'));
    h.chainQueue = [[{ id: 'r2' }]];
    expect(await GdprRequestManager.requestDataAccess({ userId: 'u', organizationId: 'o' })).toEqual({ id: 'r2' });
  });

  it('requestDataErasure and requestDataPortability insert', async () => {
    h.chainQueue = [[{ id: 'e1' }]];
    expect(await GdprRequestManager.requestDataErasure({ userId: 'u', organizationId: 'o' })).toEqual({ id: 'e1' });
    h.chainQueue = [[{ id: 'p1' }]];
    expect(await GdprRequestManager.requestDataPortability({ userId: 'u', organizationId: 'o', preferredFormat: 'csv' })).toEqual({ id: 'p1' });
  });

  it('getUserRequests and getPendingRequests query', async () => {
    h.chainQueue = [[{ id: 'r' }]];
    expect(await GdprRequestManager.getUserRequests('u', 'o')).toEqual([{ id: 'r' }]);
    h.chainQueue = [[{ id: 'p' }]];
    expect(await GdprRequestManager.getPendingRequests('o')).toEqual([{ id: 'p' }]);
  });

  it('updateRequestStatus handles each status', async () => {
    h.chainQueue = [[{ id: 'a' }]];
    expect(await GdprRequestManager.updateRequestStatus('r', 'in_progress')).toEqual({ id: 'a' });
    h.chainQueue = [[{ id: 'b' }]];
    expect(await GdprRequestManager.updateRequestStatus('r', 'completed', { processedBy: 'admin' })).toEqual({ id: 'b' });
    h.chainQueue = [[{ id: 'c' }]];
    expect(await GdprRequestManager.updateRequestStatus('r', 'rejected', { rejectionReason: 'x' })).toEqual({ id: 'c' });
  });
});

describe('DataExportService', () => {
  it('exportUserData aggregates all categories', async () => {
    h.q.profilesFindFirst.mockResolvedValue({ userId: 'u' });
    h.q.threadsFindMany.mockResolvedValue([{ id: 't1', subject: 's', status: 'open', priority: 'high', category: 'c', createdAt: new Date(), lastMessageAt: new Date() }]);
    h.q.messagesFindMany.mockResolvedValue([{ id: 'm1', threadId: 't1', messageType: 'text', content: 'hi', fileName: null, status: 'sent', createdAt: new Date(), readAt: null }]);
    h.q.receiptsFindMany.mockResolvedValue([{ messageId: 'm1', readAt: new Date() }]);
    h.q.claimsFindMany.mockResolvedValue([{ claimId: 'cl1', claimNumber: 'CN', claimType: 'grievance', status: 'open', priority: 'high', incidentDate: new Date(), location: 'L', description: 'd', desiredOutcome: 'o', isAnonymous: false, progress: 50, createdAt: new Date(), resolvedAt: null }]);
    h.q.claimUpdatesFindMany.mockResolvedValue([{ updateId: 'up1', claimId: 'cl1', updateType: 'note', content: 'c', createdAt: new Date() }]);
    h.q.sessionsFindMany.mockResolvedValue([{ id: 'sess1', title: 'V', type: 'motion', meetingType: 'agm', startTime: new Date(), endTime: new Date() }]);
    h.q.votesFindMany.mockResolvedValue([{ sessionId: 'sess1', castAt: new Date(), receiptId: 'r', verificationCode: 'v', isAnonymous: false, voterType: 'member' }]);
    h.chainQueue = [[{ id: 'consent1' }]]; // getConsentData select

    const result = await DataExportService.exportUserData('u', 'o', 'json');
    expect(result.data.profile).toEqual({ userId: 'u' });
    expect(result.data.communications[0].count).toBe(1);
    expect(result.data.claims[0].count).toBe(1);
    expect(result.data.votes[0].count).toBe(1);
  });
});

describe('DataErasureService', () => {
  it('eraseUserData runs full anonymization pipeline', async () => {
    h.chainQueue = [
      [], // anonymizeProfile update.where
      [{ id: 'th' }], // delete threads returning
      [{ id: 'msg' }], // delete messages returning
      [{ id: 'sms' }], // delete sms returning
      [{ id: 'camp' }], // delete campaign recipients returning
      [{ id: 'cl' }], // update claims returning
      [{ id: 'up' }], // update claimUpdates returning
      [], // eraseConsents delete.where
      [], // insert dataAnonymizationLog values
      [{ id: 'req' }], // updateRequestStatus returning
    ];
    await expect(DataErasureService.eraseUserData('u', 'o', 'req1', 'admin')).resolves.toBeUndefined();
  });

  it('eraseUserData throws on failure', async () => {
    const { db } = await import('@/db');
    (db.update as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error('db fail'); });
    await expect(DataErasureService.eraseUserData('u', 'o', 'req1', 'admin')).rejects.toThrow(/Failed to complete data erasure/);
  });

  it('canEraseData returns erasable', async () => {
    expect(await DataErasureService.canEraseData('u', 'o')).toEqual({ canErase: true, reasons: [] });
  });
});
