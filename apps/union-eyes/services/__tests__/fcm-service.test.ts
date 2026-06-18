import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const h = vi.hoisted(() => {
  const messagingMock = {
    send: vi.fn(async () => 'fcm-msg-id'),
    subscribeToTopic: vi.fn(async () => ({ successCount: 2, failureCount: 0, errors: [] })),
    unsubscribeFromTopic: vi.fn(async () => ({ successCount: 1, failureCount: 0, errors: [] })),
  };
  const admin = {
    initializeApp: vi.fn(() => ({ name: 'app' })),
    credential: { cert: vi.fn(() => ({})) },
    messaging: vi.fn(() => messagingMock),
  };
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  return { messagingMock, admin, queue, db };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

// Intercept the require('firebase-admin') call inside the service module.
const nodeRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Module: any = nodeRequire('node:module');
const originalLoad = Module._load;
Module._load = function (request: string, ...args: unknown[]) {
  if (request === 'firebase-admin') return h.admin;
  return originalLoad.call(this, request, ...args);
};
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'p', client_email: 'e@x.com', private_key: 'k' });

afterAll(() => {
  Module._load = originalLoad;
});

type FcmModule = typeof import('../fcm-service');
let fcm: FcmModule;

beforeAll(async () => {
  fcm = await import('../fcm-service');
});

const push = (...items: unknown[]) => h.queue.push(...items);

function makeNotif(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    title: 'Title',
    body: 'Body',
    imageUrl: 'https://x/img.png',
    clickAction: '/go',
    actionButtons: [{ id: 'a1', title: 'Act' }],
    priority: 'urgent',
    ttl: 3600,
    iconUrl: '/icon.png',
    sound: 'ding',
    badgeCount: 3,
    ...overrides,
  };
}
function makeDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    deviceToken: 'tok1',
    platform: 'android',
    enabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    organizationId: 'org1',
    profileId: 'p1',
    ...overrides,
  };
}

beforeEach(() => {
  h.queue.length = 0;
  h.messagingMock.send.mockReset().mockResolvedValue('fcm-msg-id');
  h.messagingMock.subscribeToTopic.mockReset().mockResolvedValue({ successCount: 2, failureCount: 0, errors: [] });
  h.messagingMock.unsubscribeFromTopic.mockReset().mockResolvedValue({ successCount: 1, failureCount: 0, errors: [] });
  h.admin.messaging.mockReset().mockReturnValue(h.messagingMock);
});

describe('initializeFirebase', () => {
  it('returns the cached app on subsequent calls', () => {
    const app = fcm.initializeFirebase();
    expect(app).toEqual({ name: 'app' });
  });
});

describe('buildFCMMessage', () => {
  it('builds an Android message with urgent priority', () => {
    const m = fcm.buildFCMMessage(makeNotif() as never, makeDevice({ platform: 'android' }) as never);
    expect(m.token).toBe('tok1');
    expect(m.android.priority).toBe('high');
    expect(m.data?.notificationId).toBe('n1');
  });

  it('builds an iOS message', () => {
    const m = fcm.buildFCMMessage(makeNotif({ priority: 'normal' }) as never, makeDevice({ platform: 'ios' }) as never);
    expect(m.apns).toBeDefined();
    expect(m.apns.headers['apns-priority']).toBe('5');
  });

  it('builds a Web message with action buttons', () => {
    const m = fcm.buildFCMMessage(makeNotif() as never, makeDevice({ platform: 'web' }) as never);
    expect(m.webpush).toBeDefined();
    expect(m.webpush.notification.actions).toHaveLength(1);
  });

  it('builds a base message for unknown platforms', () => {
    const m = fcm.buildFCMMessage(makeNotif({ actionButtons: null, imageUrl: null, clickAction: null }) as never, makeDevice({ platform: 'desktop' }) as never);
    expect(m.android).toBeUndefined();
    expect(m.apns).toBeUndefined();
    expect(m.webpush).toBeUndefined();
  });
});

describe('sendToDevice', () => {
  it('sends to an enabled device and records delivery', async () => {
    push([makeNotif()], [makeDevice()], []);
    const r = await fcm.sendToDevice('n1', 'd1');
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('fcm-msg-id');
  });

  it('returns unavailable when messaging is not initialized', async () => {
    h.admin.messaging.mockImplementationOnce(() => { throw new Error('no messaging'); });
    const r = await fcm.sendToDevice('n1', 'd1');
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('unavailable');
  });

  it('returns not-found when notification or device is missing', async () => {
    push([], [makeDevice()]);
    const r = await fcm.sendToDevice('n1', 'd1');
    expect(r.error?.code).toBe('not-found');
  });

  it('returns disabled when the device is disabled', async () => {
    push([makeNotif()], [makeDevice({ enabled: false })]);
    const r = await fcm.sendToDevice('n1', 'd1');
    expect(r.error?.code).toBe('disabled');
  });

  it('returns quiet-hours when within the quiet window', async () => {
    push([makeNotif()], [makeDevice({ quietHoursStart: '00:00', quietHoursEnd: '23:59' })]);
    const r = await fcm.sendToDevice('n1', 'd1');
    expect(r.error?.code).toBe('quiet-hours');
  });

  it('disables the device on an invalid-token error', async () => {
    push([makeNotif()], [makeDevice()], [], []);
    h.messagingMock.send.mockRejectedValueOnce({ code: 'messaging/registration-token-not-registered', message: 'bad token' });
    const r = await fcm.sendToDevice('n1', 'd1');
    expect(r.success).toBe(false);
    expect(r.error?.message).toBe('Invalid or expired device token');
  });

  it('records a failed delivery for a generic error', async () => {
    push([makeNotif()], [makeDevice()], []);
    h.messagingMock.send.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: undefined }));
    const r = await fcm.sendToDevice('n1', 'd1');
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('unknown');
  });
});

describe('sendToDevices', () => {
  it('sends to multiple devices in a batch', async () => {
    // sendToDevice runs concurrently via Promise.all: both notif selects resolve,
    // then both device selects, then the (default []) delivery inserts.
    push([makeNotif()], [makeNotif()], [makeDevice()], [makeDevice({ id: 'd2' })]);
    const r = await fcm.sendToDevices('n1', ['d1', 'd2']);
    expect(r.successCount).toBe(2);
    expect(r.failureCount).toBe(0);
  });

  it('returns all failures when messaging is unavailable', async () => {
    h.admin.messaging.mockImplementationOnce(() => { throw new Error('no messaging'); });
    const r = await fcm.sendToDevices('n1', ['d1', 'd2']);
    expect(r.failureCount).toBe(2);
    expect(r.results).toHaveLength(2);
  });
});

describe('sendToProfile', () => {
  it('resolves device ids and delegates to sendToDevices', async () => {
    push([{ id: 'd1' }]); // device id lookup
    push([makeNotif()], [makeDevice()], []); // sendToDevice for d1
    const r = await fcm.sendToProfile('n1', 'p1', 'org1');
    expect(r.successCount).toBe(1);
  });

  it('returns empty results when no devices exist', async () => {
    push([]);
    const r = await fcm.sendToProfile('n1', 'p1', 'org1');
    expect(r.successCount).toBe(0);
    expect(r.results).toHaveLength(0);
  });
});

describe('sendToUser', () => {
  it('sends a direct message to every enabled device across platforms', async () => {
    push([makeDevice({ platform: 'android' }), makeDevice({ id: 'd2', platform: 'ios' }), makeDevice({ id: 'd3', platform: 'web' })]);
    const r = await fcm.sendToUser({ userId: 'p1', title: 'Hi', body: 'There', data: { a: 1 }, priority: 'urgent', clickAction: '/x' });
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.success)).toBe(true);
  });

  it('returns an empty array when messaging is unavailable', async () => {
    h.admin.messaging.mockImplementationOnce(() => { throw new Error('no messaging'); });
    const r = await fcm.sendToUser({ userId: 'p1', title: 'Hi', body: 'There' });
    expect(r).toEqual([]);
  });

  it('returns an empty array when the user has no devices', async () => {
    push([]);
    const r = await fcm.sendToUser({ userId: 'p1', title: 'Hi', body: 'There' });
    expect(r).toEqual([]);
  });

  it('disables a device and reports failure on an invalid-token error', async () => {
    push([makeDevice()], []); // device lookup + disable update
    h.messagingMock.send.mockRejectedValueOnce({ code: 'messaging/invalid-registration-token', message: 'bad' });
    const r = await fcm.sendToUser({ userId: 'p1', title: 'Hi', body: 'There' });
    expect(r[0].success).toBe(false);
    expect(r[0].error?.code).toBe('messaging/invalid-registration-token');
  });
});

describe('sendToTopic', () => {
  it('sends a notification to a topic', async () => {
    const r = await fcm.sendToTopic(makeNotif() as never, 'news');
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('fcm-msg-id');
  });

  it('returns unavailable when messaging is not initialized', async () => {
    h.admin.messaging.mockImplementationOnce(() => { throw new Error('no messaging'); });
    const r = await fcm.sendToTopic(makeNotif({ priority: 'normal' }) as never, 'news');
    expect(r.error?.code).toBe('unavailable');
  });

  it('returns an error when sending fails', async () => {
    h.messagingMock.send.mockRejectedValueOnce({ code: 'messaging/internal-error', message: 'oops' });
    const r = await fcm.sendToTopic(makeNotif() as never, 'news');
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('messaging/internal-error');
  });
});

describe('subscribeToTopic / unsubscribeFromTopic', () => {
  it('subscribes device tokens to a topic', async () => {
    const r = await fcm.subscribeToTopic(['t1', 't2'], 'news');
    expect(r.successCount).toBe(2);
  });

  it('returns failures when subscribe messaging is unavailable', async () => {
    h.admin.messaging.mockImplementationOnce(() => { throw new Error('no messaging'); });
    const r = await fcm.subscribeToTopic(['t1', 't2'], 'news');
    expect(r.failureCount).toBe(2);
  });

  it('handles a subscribe error gracefully', async () => {
    h.messagingMock.subscribeToTopic.mockRejectedValueOnce(new Error('fail'));
    const r = await fcm.subscribeToTopic(['t1', 't2'], 'news');
    expect(r.failureCount).toBe(2);
    expect(r.errors).toEqual([]);
  });

  it('unsubscribes device tokens from a topic', async () => {
    const r = await fcm.unsubscribeFromTopic(['t1'], 'news');
    expect(r.successCount).toBe(1);
  });

  it('returns failures when unsubscribe messaging is unavailable', async () => {
    h.admin.messaging.mockImplementationOnce(() => { throw new Error('no messaging'); });
    const r = await fcm.unsubscribeFromTopic(['t1'], 'news');
    expect(r.failureCount).toBe(1);
  });

  it('handles an unsubscribe error gracefully', async () => {
    h.messagingMock.unsubscribeFromTopic.mockRejectedValueOnce(new Error('fail'));
    const r = await fcm.unsubscribeFromTopic(['t1'], 'news');
    expect(r.failureCount).toBe(1);
  });
});

describe('verifyToken', () => {
  it('returns true for a valid token', async () => {
    expect(await fcm.verifyToken('good')).toBe(true);
  });

  it('returns false when the dry-run send fails', async () => {
    h.messagingMock.send.mockRejectedValueOnce(new Error('bad'));
    expect(await fcm.verifyToken('bad')).toBe(false);
  });

  it('returns false when messaging is unavailable', async () => {
    h.admin.messaging.mockImplementationOnce(() => { throw new Error('no messaging'); });
    expect(await fcm.verifyToken('any')).toBe(false);
  });
});

describe('cleanupInvalidTokens', () => {
  it('disables devices whose tokens fail verification', async () => {
    push([{ id: 'd1', deviceToken: 't1' }, { id: 'd2', deviceToken: 't2' }]); // device lookup
    push([]); // update disable for d2
    h.messagingMock.send.mockResolvedValueOnce('ok'); // d1 valid
    h.messagingMock.send.mockRejectedValueOnce(new Error('bad')); // d2 invalid
    const count = await fcm.cleanupInvalidTokens('org1');
    expect(count).toBe(1);
  });
});

describe('updateDeliveryStatus', () => {
  it('sets deliveredAt for delivered status', async () => {
    push([]);
    await expect(fcm.updateDeliveryStatus('msg1', 'delivered')).resolves.toBeUndefined();
  });

  it('sets clickedAt for clicked status', async () => {
    push([]);
    await expect(fcm.updateDeliveryStatus('msg1', 'clicked', { x: 1 })).resolves.toBeUndefined();
  });

  it('sets dismissedAt for dismissed status', async () => {
    push([]);
    await expect(fcm.updateDeliveryStatus('msg1', 'dismissed')).resolves.toBeUndefined();
  });

  it('handles failed status', async () => {
    push([]);
    await expect(fcm.updateDeliveryStatus('msg1', 'failed')).resolves.toBeUndefined();
  });
});

describe('retryFailedDeliveries', () => {
  it('retries failed deliveries under the retry limit', async () => {
    push([{ id: 'fd1', deviceId: 'd1' }]); // failed deliveries
    push([]); // increment retry count
    push([makeNotif()], [makeDevice()], []); // sendToDevices -> sendToDevice
    const r = await fcm.retryFailedDeliveries('n1');
    expect(r.successCount).toBe(1);
  });

  it('returns empty results when there are no failed deliveries', async () => {
    push([]);
    const r = await fcm.retryFailedDeliveries('n1');
    expect(r.successCount).toBe(0);
    expect(r.results).toHaveLength(0);
  });
});
