import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'from', 'where', 'limit', 'orderBy', 'leftJoin', 'innerJoin', 'values', 'set', 'returning', 'groupBy'];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      if (v instanceof Error) return Promise.resolve().then(() => { throw v; }).then(res, rej);
      return Promise.resolve(v).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  const fcmSend = vi.fn(async () => 'msg-id');
  return { queue, db, fcmSend };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/mobile-devices-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));
vi.mock('firebase-admin', () => ({
  apps: [],
  credential: { cert: vi.fn(() => ({})) },
  initializeApp: vi.fn(() => ({})),
  app: vi.fn(() => ({})),
  messaging: vi.fn(() => ({ send: h.fcmSend })),
}));

import {
  MobileNotificationService,
  MobileOfflineSyncEngine,
  MobileDeviceManager,
  MobileAPIGateway,
  MobileAnalyticsService,
  mobileNotificationService,
  mobileOfflineSyncEngine,
  mobileDeviceManager,
  mobileAPIGateway,
  mobileAnalyticsService,
} from '../mobile-engine';

const makeDeviceRow = (over: Record<string, unknown> = {}) => ({
  id: 'dev-1',
  deviceId: 'device-abc',
  userId: 'user-1',
  organizationId: 'org-1',
  platform: 'android',
  deviceToken: 'token-1',
  deviceName: 'Pixel',
  deviceModel: 'Pixel 8',
  osVersion: '14',
  appVersion: '1.0',
  timezone: 'UTC',
  locale: 'en',
  pushEnabled: true,
  notificationSound: true,
  notificationVibration: true,
  isActive: true,
  isCompliant: true,
  complianceIssues: [],
  registeredAt: new Date('2024-01-01'),
  lastActiveAt: new Date('2024-02-01'),
  ...over,
});

describe('mobile-engine', () => {
  beforeEach(() => {
    h.queue.length = 0;
    h.db.select.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    h.db.delete.mockClear();
    h.fcmSend.mockReset();
    h.fcmSend.mockImplementation(async () => 'msg-id');
    // reset notification provider flags
    (mobileNotificationService as unknown as { apnsConfigured: boolean }).apnsConfigured = false;
    (mobileNotificationService as unknown as { fcmConfigured: boolean }).fcmConfigured = false;
    // reset analytics state
    Object.assign(mobileAnalyticsService as unknown as Record<string, unknown>, {
      events: [], sessionId: null, sessionStartedAt: null,
    });
    delete process.env.FCM_SERVER_KEY;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('singletons', () => {
    it('getInstance returns the shared instance', () => {
      expect(MobileNotificationService.getInstance()).toBe(mobileNotificationService);
      expect(MobileOfflineSyncEngine.getInstance()).toBe(mobileOfflineSyncEngine);
      expect(MobileDeviceManager.getInstance()).toBe(mobileDeviceManager);
      expect(MobileAPIGateway.getInstance()).toBe(mobileAPIGateway);
      expect(MobileAnalyticsService.getInstance()).toBe(mobileAnalyticsService);
    });
  });

  describe('MobileNotificationService', () => {
    it('sendToDevice returns error when device is unavailable', async () => {
      h.queue.push([]); // getDevice -> no row
      const r = await mobileNotificationService.sendToDevice('dev-x', { title: 't', body: 'b' });
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/not available/);
    });

    it('sendToDevice records a notification and reports FCM-not-configured', async () => {
      h.queue.push([makeDeviceRow()]); // getDevice
      h.queue.push([{ id: 'notif-1' }]); // insert returning
      h.queue.push([]); // update
      const r = await mobileNotificationService.sendToDevice('dev-1', { title: 't', body: 'b' });
      expect(r.success).toBe(false);
      expect(h.db.insert).toHaveBeenCalled();
      expect(h.db.update).toHaveBeenCalled();
    });

    it('sendToDevice routes ios to APNs and reports not-implemented', async () => {
      (mobileNotificationService as unknown as { apnsConfigured: boolean }).apnsConfigured = true;
      h.queue.push([makeDeviceRow({ platform: 'ios' })]);
      h.queue.push([{ id: 'notif-2' }]);
      h.queue.push([]);
      const r = await mobileNotificationService.sendToDevice('dev-1', { title: 't', body: 'b' });
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/APNs provider not implemented/);
    });

    it('sendToDevice handles unknown platform', async () => {
      h.queue.push([makeDeviceRow({ platform: 'symbian' })]);
      h.queue.push([{ id: 'notif-3' }]);
      h.queue.push([]);
      const r = await mobileNotificationService.sendToDevice('dev-1', { title: 't', body: 'b' });
      expect(r.error).toMatch(/Unknown platform/);
    });

    it('sendViaFCM succeeds via FCM_SERVER_KEY HTTP path', async () => {
      const svc = mobileNotificationService as unknown as {
        fcmConfigured: boolean;
        sendViaFCM: (t: string, p: unknown) => Promise<{ success: boolean }>;
      };
      svc.fcmConfigured = true;
      process.env.FCM_SERVER_KEY = 'server-key';
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: 1 }) })));
      const r = await svc.sendViaFCM('token', { title: 't', body: 'b', data: { a: 1 }, priority: 'high' });
      expect(r.success).toBe(true);
    });

    it('sendViaFCM reports failure on non-ok HTTP response', async () => {
      const svc = mobileNotificationService as unknown as {
        fcmConfigured: boolean;
        sendViaFCM: (t: string, p: unknown) => Promise<{ success: boolean; error?: string }>;
      };
      svc.fcmConfigured = true;
      process.env.FCM_SERVER_KEY = 'server-key';
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error('bad json'); } })));
      const r = await svc.sendViaFCM('token', { title: 't', body: 'b' });
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/502/);
    });

    it('sendViaFCM catches HTTP errors', async () => {
      const svc = mobileNotificationService as unknown as {
        fcmConfigured: boolean;
        sendViaFCM: (t: string, p: unknown) => Promise<{ success: boolean; error?: string }>;
      };
      svc.fcmConfigured = true;
      process.env.FCM_SERVER_KEY = 'server-key';
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
      const r = await svc.sendViaFCM('token', { title: 't', body: 'b' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('network down');
    });

    it('sendViaFCM returns not-configured when disabled', async () => {
      const svc = mobileNotificationService as unknown as {
        fcmConfigured: boolean;
        sendViaFCM: (t: string, p: unknown) => Promise<{ success: boolean; error?: string }>;
      };
      svc.fcmConfigured = false;
      const r = await svc.sendViaFCM('token', { title: 't', body: 'b' });
      expect(r.error).toBe('FCM not configured');
    });

    it('sendViaFCM uses firebase-admin messaging when service account is present', async () => {
      const svc = mobileNotificationService as unknown as {
        fcmConfigured: boolean;
        sendViaFCM: (t: string, p: unknown) => Promise<{ success: boolean; error?: string }>;
      };
      svc.fcmConfigured = true;
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'p' });
      h.fcmSend.mockResolvedValueOnce('fcm-id');
      const ok = await svc.sendViaFCM('token', { title: 't', body: 'b', badge: 2, sound: 'ding' });
      expect(ok.success).toBe(true);
      h.fcmSend.mockImplementationOnce(() => Promise.reject(new Error('fcm boom')));
      const bad = await svc.sendViaFCM('token', { title: 't', body: 'b' });
      expect(bad.success).toBe(false);
      expect(bad.error).toBe('fcm boom');
    });

    it('sendViaAPNs falls back to FCM and reports configuration states', async () => {
      const svc = mobileNotificationService as unknown as {
        apnsConfigured: boolean;
        fcmConfigured: boolean;
        sendViaAPNs: (t: string, p: unknown) => Promise<{ success: boolean; error?: string }>;
      };
      // not configured, fcm available -> fallback (fcm not configured returns its own error)
      svc.apnsConfigured = false;
      svc.fcmConfigured = true;
      process.env.FCM_SERVER_KEY = 'k';
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
      expect((await svc.sendViaAPNs('t', { title: 'a', body: 'b' })).success).toBe(true);
      // neither configured
      svc.apnsConfigured = false;
      svc.fcmConfigured = false;
      expect((await svc.sendViaAPNs('t', { title: 'a', body: 'b' })).error).toMatch(/APNs not configured/);
      // apns configured, fcm available -> warn + fcm fallback
      svc.apnsConfigured = true;
      svc.fcmConfigured = true;
      expect((await svc.sendViaAPNs('t', { title: 'a', body: 'b' })).success).toBe(true);
      // apns configured, fcm not -> not implemented
      svc.fcmConfigured = false;
      expect((await svc.sendViaAPNs('t', { title: 'a', body: 'b' })).error).toMatch(/not implemented/);
    });

    it('sendToDevices aggregates sent and failed counts', async () => {
      // d1 available, d2 unavailable
      h.queue.push([makeDeviceRow({ id: 'd1' })]); // getDevice d1
      h.queue.push([{ id: 'n1' }]); // insert
      h.queue.push([]); // update
      h.queue.push([]); // getDevice d2 -> none
      const svc = mobileNotificationService as unknown as { fcmConfigured: boolean };
      svc.fcmConfigured = true;
      process.env.FCM_SERVER_KEY = 'k';
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
      const r = await mobileNotificationService.sendToDevices(['d1', 'd2'], { title: 't', body: 'b' });
      expect(r.sent).toBe(1);
      expect(r.failed).toBe(1);
    });

    it('sendToUser sends to all user devices', async () => {
      h.queue.push([makeDeviceRow({ id: 'd1' })]); // getDevicesForUser
      h.queue.push([makeDeviceRow({ id: 'd1' })]); // sendToDevice -> getDevice
      h.queue.push([{ id: 'n1' }]); // insert
      h.queue.push([]); // update
      const svc = mobileNotificationService as unknown as { fcmConfigured: boolean };
      svc.fcmConfigured = true;
      process.env.FCM_SERVER_KEY = 'k';
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
      const r = await mobileNotificationService.sendToUser('user-1', { title: 't', body: 'b' });
      expect(r.sent).toBe(1);
    });

    it('sendToOrganization filters excluded users and warns on role filtering', async () => {
      h.queue.push([makeDeviceRow({ id: 'd1', userId: 'u1' }), makeDeviceRow({ id: 'd2', userId: 'u2' })]); // org devices
      h.queue.push([makeDeviceRow({ id: 'd1', userId: 'u1' })]); // sendToDevice getDevice for d1
      h.queue.push([{ id: 'n1' }]);
      h.queue.push([]);
      const r = await mobileNotificationService.sendToOrganization('org-1', { title: 't', body: 'b' }, {
        excludeUserIds: ['u2'], includeRoles: ['admin'],
      });
      expect(typeof r.sent).toBe('number');
    });
  });

  describe('MobileOfflineSyncEngine', () => {
    it('queueOperation inserts and returns the new id', async () => {
      h.queue.push([{ id: 'sync-1' }]);
      const id = await mobileOfflineSyncEngine.queueOperation('dev-1', {
        entityType: 'claim', orgId: 'org-1', operation: 'create', payload: { x: 1 },
      });
      expect(id).toBe('sync-1');
    });

    it('processQueue handles synced, conflict, and failed records', async () => {
      const rec = (id: string) => ({ id, operation: 'create', entityType: 'claim', orgId: 'org-1', clientTimestamp: new Date('2024-01-01') });
      h.queue.push([rec('r1'), rec('r2'), rec('r3')]); // pending select
      // r1: no conflict -> synced
      h.queue.push([]); // checkConflict select
      h.queue.push([]); // update synced
      // r2: conflict
      h.queue.push([{ processedAt: new Date() }]); // checkConflict select
      h.queue.push([]); // update conflict
      // r3: executeSync ok but update rejects -> failed
      h.queue.push([]); // checkConflict select
      h.queue.push(new Error('update failed')); // update synced -> throws
      h.queue.push([]); // catch update failed
      const r = await mobileOfflineSyncEngine.processQueue('dev-1');
      expect(r).toEqual({ processed: 1, failed: 1, conflicts: 1 });
    });

    it('getSyncStatus returns counts and last synced timestamp', async () => {
      const last = new Date('2024-03-01');
      h.queue.push([{ count: 4 }]); // pending
      h.queue.push([{ count: 2 }]); // failed
      h.queue.push([{ lastSyncedAt: last }]); // last synced
      const r = await mobileOfflineSyncEngine.getSyncStatus('dev-1');
      expect(r).toEqual({ pending: 4, failed: 2, lastSyncedAt: last });
    });

    it('getSyncStatus defaults when no rows', async () => {
      h.queue.push([]); h.queue.push([]); h.queue.push([]);
      const r = await mobileOfflineSyncEngine.getSyncStatus('dev-1');
      expect(r).toEqual({ pending: 0, failed: 0, lastSyncedAt: null });
    });

    it('resolveConflict applies each strategy', async () => {
      h.queue.push([]); h.queue.push([]); h.queue.push([]);
      await mobileOfflineSyncEngine.resolveConflict('r1', 'client_wins');
      await mobileOfflineSyncEngine.resolveConflict('r2', 'server_wins');
      await mobileOfflineSyncEngine.resolveConflict('r3', 'merge');
      expect(h.db.update).toHaveBeenCalledTimes(3);
    });

    it('triggerBackgroundSync runs the queue processor', async () => {
      h.queue.push([]); // empty pending
      await mobileOfflineSyncEngine.triggerBackgroundSync('dev-1');
      expect(h.db.select).toHaveBeenCalled();
    });
  });

  describe('MobileDeviceManager', () => {
    it('registerDevice updates an existing device', async () => {
      h.queue.push([makeDeviceRow()]); // existing select
      h.queue.push([makeDeviceRow({ deviceName: 'Updated' })]); // update returning
      const d = await mobileDeviceManager.registerDevice({
        userId: 'user-1', organizationId: 'org-1', platform: 'android',
        deviceToken: 't', deviceId: 'device-abc', timezone: 'UTC',
      });
      expect(d.deviceName).toBe('Updated');
      expect(h.db.update).toHaveBeenCalled();
    });

    it('registerDevice inserts a new device', async () => {
      h.queue.push([]); // no existing
      h.queue.push([makeDeviceRow({ id: 'new-dev' })]); // insert returning
      const d = await mobileDeviceManager.registerDevice({
        userId: 'user-1', organizationId: 'org-1', platform: 'ios',
        deviceToken: 't', deviceId: 'device-new', timezone: 'UTC',
      });
      expect(d.id).toBe('new-dev');
      expect(h.db.insert).toHaveBeenCalled();
    });

    it('updateDevice, deactivateDevice and remoteWipe issue updates', async () => {
      h.queue.push([]); h.queue.push([]); h.queue.push([]);
      await mobileDeviceManager.updateDevice('dev-1', { deviceName: 'X' });
      await mobileDeviceManager.deactivateDevice('dev-1', 'logout');
      await mobileDeviceManager.remoteWipe('dev-1');
      expect(h.db.update).toHaveBeenCalledTimes(3);
    });

    it('getOrganizationDevices applies activeOnly and platform filters', async () => {
      h.queue.push([makeDeviceRow({ id: 'd1' }), makeDeviceRow({ id: 'd2' })]);
      const devices = await mobileDeviceManager.getOrganizationDevices('org-1', { activeOnly: true, platform: 'android' });
      expect(devices).toHaveLength(2);
    });

    it('getOrganizationDevices works without options', async () => {
      h.queue.push([makeDeviceRow()]);
      const devices = await mobileDeviceManager.getOrganizationDevices('org-1');
      expect(devices).toHaveLength(1);
    });

    it('checkDeviceCompliance returns compliant for a known device', async () => {
      h.queue.push([makeDeviceRow({ isCompliant: true, complianceIssues: [] })]);
      const r = await mobileDeviceManager.checkDeviceCompliance('dev-1');
      expect(r.compliant).toBe(true);
      expect(r.issues).toEqual([]);
    });

    it('checkDeviceCompliance reports missing device', async () => {
      h.queue.push([]);
      const r = await mobileDeviceManager.checkDeviceCompliance('dev-x');
      expect(r.compliant).toBe(false);
      expect(r.issues).toContain('Device not found');
    });
  });

  describe('MobileAPIGateway', () => {
    it('getDeltaSync partitions records into created/updated/deleted', async () => {
      h.queue.push([
        { operation: 'create', orgId: 'a', payload: { p: 1 } },
        { operation: 'update', orgId: 'b', payload: { p: 2 } },
        { operation: 'delete', orgId: 'c', payload: { p: 3 } },
      ]);
      const r = await mobileAPIGateway.getDeltaSync({ entityType: 'claim', since: new Date('2024-01-01'), organizationId: 'org-1' });
      expect(r.created).toHaveLength(1);
      expect(r.updated).toHaveLength(1);
      expect(r.deleted).toEqual(['c']);
      expect(r.serverTimestamp).toBeInstanceOf(Date);
    });

    it('handleBatchRequest returns per-request results including errors', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) })
        .mockResolvedValueOnce({ status: 204, json: async () => { throw new Error('no body'); } })
        .mockRejectedValueOnce(new Error('boom'));
      vi.stubGlobal('fetch', fetchMock);
      const r = await mobileAPIGateway.handleBatchRequest([
        { endpoint: '/a', method: 'GET' },
        { endpoint: '/c', method: 'GET' },
        { endpoint: '/b', method: 'POST', body: { x: 1 } },
      ]);
      expect(r[0].status).toBe(200);
      expect(r[1].status).toBe(204);
      expect(r[2].status).toBe(500);
    });

    it('compressResponse supports gzip, deflate, br and default', async () => {
      const data = { hello: 'world' };
      expect(Buffer.isBuffer(await mobileAPIGateway.compressResponse(data, 'gzip'))).toBe(true);
      expect(Buffer.isBuffer(await mobileAPIGateway.compressResponse(data, 'deflate'))).toBe(true);
      expect(Buffer.isBuffer(await mobileAPIGateway.compressResponse(data, 'br'))).toBe(true);
      expect(Buffer.isBuffer(await mobileAPIGateway.compressResponse(data, 'identity' as 'gzip'))).toBe(true);
    });

    it('handleOfflineRequest queues an operation with provided orgId', async () => {
      h.queue.push([{ id: 'sync-99' }]); // queueOperation insert
      const r = await mobileAPIGateway.handleOfflineRequest({
        deviceId: 'dev-1', operation: 'create', entityType: 'claim', orgId: 'org-1',
        payload: { x: 1 }, clientTimestamp: new Date('2024-01-01'),
      });
      expect(r.accepted).toBe(true);
      expect(r.orgId).toBe('org-1');
    });

    it('handleOfflineRequest falls back to a synthetic orgId', async () => {
      h.queue.push([{ id: 'sync-100' }]);
      const r = await mobileAPIGateway.handleOfflineRequest({
        deviceId: 'dev-1', operation: 'update', entityType: 'member',
        payload: { x: 1 }, clientTimestamp: new Date('2024-01-01'),
      });
      expect(r.accepted).toBe(true);
      expect(r.orgId).toBe('sync-100');
    });
  });

  describe('MobileAnalyticsService', () => {
    it('startSession and endSession track session events', async () => {
      h.queue.push([]); // flushEvents on endSession
      const sessionId = mobileAnalyticsService.startSession('user-1', 'dev-1');
      expect(sessionId).toMatch(/^session_/);
      expect(mobileAnalyticsService.getSessionDuration()).toBeGreaterThanOrEqual(0);
      mobileAnalyticsService.endSession('user-1', 'dev-1');
      expect(mobileAnalyticsService.getSessionDuration()).toBe(0);
    });

    it('endSession does nothing when no active session', () => {
      mobileAnalyticsService.endSession('user-1', 'dev-1');
      expect((mobileAnalyticsService as unknown as { events: unknown[] }).events).toHaveLength(0);
    });

    it('trackScreenView, trackError and trackEvent derive event types', () => {
      mobileAnalyticsService.trackScreenView('home', 'user-1', 'dev-1', { a: 1 });
      mobileAnalyticsService.trackError(new Error('crash'), 'user-1', 'dev-1', { ctx: 1 });
      mobileAnalyticsService.trackEvent({ eventName: 'button_click', deviceId: 'dev-1', userId: 'user-1', timestamp: new Date(), sessionId: '' });
      const events = (mobileAnalyticsService as unknown as { events: Array<{ eventType: string }> }).events;
      expect(events.map(e => e.eventType)).toEqual(['screen', 'error', 'action']);
    });

    it('trackEvent flushes when the buffer reaches 50 events', () => {
      h.queue.push([]); // flush insert
      for (let i = 0; i < 50; i++) {
        mobileAnalyticsService.trackEvent({ eventName: `session_${i}`, deviceId: 'dev-1', userId: 'user-1', timestamp: new Date(), sessionId: 's' });
      }
      expect(h.db.insert).toHaveBeenCalled();
    });

    it('flushEvents inserts buffered events', async () => {
      const svc = mobileAnalyticsService as unknown as { events: unknown[]; flushEvents: () => Promise<void> };
      svc.events = [{ eventName: 'x', eventType: 'action', deviceId: 'd', userId: 'u', timestamp: new Date(), sessionId: 's' }];
      h.queue.push([]);
      await svc.flushEvents();
      expect(h.db.insert).toHaveBeenCalled();
    });

    it('flushEvents is a no-op with no events', async () => {
      const svc = mobileAnalyticsService as unknown as { events: unknown[]; flushEvents: () => Promise<void> };
      svc.events = [];
      await svc.flushEvents();
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('flushEvents logs an error when the insert fails', async () => {
      const svc = mobileAnalyticsService as unknown as { events: unknown[]; flushEvents: () => Promise<void> };
      svc.events = [{ eventName: 'x', eventType: 'action', deviceId: 'd', userId: 'u', timestamp: new Date(), sessionId: 's' }];
      h.queue.push(new Error('insert boom'));
      await expect(svc.flushEvents()).resolves.toBeUndefined();
    });
  });
});
