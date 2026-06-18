import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: h.info, warn: h.warn, error: h.error },
}));

import { createFCMProvider, FCMProvider, FCMTemplates } from '../fcm-provider';

const fetchMock = vi.fn();

function provider() {
  return new FCMProvider({ serverKey: 'key-123', projectId: 'p1' });
}

function jsonResponse(body: unknown, status = 200) {
  return { status, json: vi.fn().mockResolvedValue(body) };
}

beforeEach(() => {
  h.info.mockReset();
  h.warn.mockReset();
  h.error.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FCM_SERVER_KEY;
  delete process.env.FCM_PROJECT_ID;
});

describe('FCMProvider.send', () => {
  it('returns messageId on success and builds full payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: 1, message_id: 'm1' }));
    const result = await provider().send('device-token-value', {
      title: 'T', body: 'B', icon: 'i', badge: 3, sound: 's',
      color: '#fff', tag: 'tg', priority: 'high', ttl: 60, data: { x: 1 },
    });
    expect(result).toEqual({ success: true, messageId: 'm1' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.notification.badge).toBe('3');
    expect(body.android.ttl).toBe('60s');
    expect(body.data).toEqual({ x: 1 });
  });

  it('uses default sound and normal priority when omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: 1, message_id: 'm2' }));
    await provider().send('dev', { title: 'T' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.notification.sound).toBe('default');
    expect(body.android.priority).toBe('normal');
  });

  it('returns error when FCM reports failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: 0, error: 'InvalidToken' }));
    const result = await provider().send('dev', { title: 'T' });
    expect(result).toEqual({ success: false, error: 'InvalidToken' });
  });

  it('handles thrown errors', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const result = await provider().send('dev', { title: 'T' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('network down');
  });
});

describe('FCMProvider.sendBatch', () => {
  it('aggregates success, failure and errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      success: 2, failure: 1, results: [{}, { error: 'BadToken' }],
    }));
    const result = await provider().sendBatch(['a', 'b', 'c'], { title: 'T' });
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([{ index: 1, error: 'BadToken' }]);
  });

  it('returns all-failed on thrown error', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const result = await provider().sendBatch(['a', 'b'], { title: 'T' });
    expect(result.failed).toBe(2);
    expect(result.errors[0].index).toBe(-1);
  });
});

describe('FCMProvider.sendToTopic / sendToDeviceGroup', () => {
  it('sendToTopic returns success and failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: 1, message_id: 'm' }));
    expect((await provider().sendToTopic('news', { title: 'T' })).success).toBe(true);
    fetchMock.mockResolvedValue(jsonResponse({ success: 0, error: 'e' }));
    expect((await provider().sendToTopic('news', { title: 'T' })).success).toBe(false);
    fetchMock.mockRejectedValue(new Error('x'));
    expect((await provider().sendToTopic('news', { title: 'T' })).success).toBe(false);
  });

  it('sendToDeviceGroup returns success and failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: 1, message_id: 'm' }));
    expect((await provider().sendToDeviceGroup('key', { title: 'T' })).success).toBe(true);
    fetchMock.mockResolvedValue(jsonResponse({ success: 0, error: 'e' }));
    expect((await provider().sendToDeviceGroup('key', { title: 'T' })).success).toBe(false);
    fetchMock.mockRejectedValue(new Error('x'));
    expect((await provider().sendToDeviceGroup('key', { title: 'T' })).success).toBe(false);
  });
});

describe('FCMProvider helpers', () => {
  it('isValidToken validates token length', () => {
    expect(provider().isValidToken('a'.repeat(40))).toBe(true);
    expect(provider().isValidToken('short')).toBe(false);
    expect(provider().isValidToken('a'.repeat(500))).toBe(false);
  });

  it('checkConnection returns true for non-401 and false on throw', async () => {
    fetchMock.mockResolvedValue({ status: 200 });
    expect(await provider().checkConnection()).toBe(true);
    fetchMock.mockResolvedValue({ status: 401 });
    expect(await provider().checkConnection()).toBe(false);
    fetchMock.mockRejectedValue(new Error('x'));
    expect(await provider().checkConnection()).toBe(false);
  });
});

describe('createFCMProvider', () => {
  it('returns null without server key', () => {
    expect(createFCMProvider()).toBeNull();
    expect(h.warn).toHaveBeenCalled();
  });

  it('builds a provider when configured', () => {
    process.env.FCM_SERVER_KEY = 'env-key';
    expect(createFCMProvider()).toBeInstanceOf(FCMProvider);
  });
});

describe('FCMTemplates', () => {
  it('builds each template payload', () => {
    expect(FCMTemplates.claimUpdate('C1', 'approved').data).toMatchObject({ type: 'claim_update' });
    expect(FCMTemplates.duesReminder('$10', '2025-01-01').data).toMatchObject({ type: 'dues_reminder' });
    expect(FCMTemplates.meetingReminder('M', '9am').data).toMatchObject({ type: 'meeting_reminder' });
    expect(FCMTemplates.strikeVote('tomorrow').data).toMatchObject({ type: 'strike_vote' });
    expect(FCMTemplates.general('T', 'B').data).toMatchObject({ type: 'general' });
  });
});
