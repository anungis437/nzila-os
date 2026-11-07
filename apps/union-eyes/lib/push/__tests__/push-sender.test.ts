// DEF-0B9-MOB-TWO-DEVICE-TABLES-NO-ROUTE-REMOVES-A-DEVICE-AND-NO-SENDER-READS-EITHER: the sender over push_devices never reports a delivery it
// did not make. Without a provider credential nothing is sent and the result says so.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const { pushProviderConfigured, sendPushToDevice } = await import('../push-sender');

const device = { id: 'd1', deviceToken: 'tok', enabled: true };
const message = { title: 't', body: 'b' };

describe('sendPushToDevice', () => {
  it('sends nothing and says so when no provider credential is configured', async () => {
    expect(pushProviderConfigured({})).toBe(false);
    expect(pushProviderConfigured({ FIREBASE_SERVICE_ACCOUNT: '  ' })).toBe(false);
    expect(await sendPushToDevice(device, message, { env: {} })).toMatchObject({ status: 'provider_not_configured' });
  });

  it('reports a credential that cannot be loaded as not configured, not as a delivery', async () => {
    expect(await sendPushToDevice(device, message, { env: { FIREBASE_SERVICE_ACCOUNT: 'not json' } })).toMatchObject({ status: 'provider_not_configured' });
  });

  it('never contacts the provider for a switched-off device', async () => {
    const transport = vi.fn();
    expect(await sendPushToDevice({ ...device, enabled: false }, message, { transport })).toMatchObject({ status: 'device_disabled' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('returns the provider message id only when the provider accepted the message', async () => {
    const transport = vi.fn(async () => 'projects/x/messages/1');
    expect(await sendPushToDevice(device, message, { transport })).toEqual({ status: 'sent', providerMessageId: 'projects/x/messages/1' });
    expect(transport).toHaveBeenCalledWith('tok', message);
  });

  it('separates a token the provider no longer accepts from any other failure', async () => {
    const refuse = (code: string) => vi.fn(async () => { throw Object.assign(new Error('x'), { code }); });
    expect(await sendPushToDevice(device, message, { transport: refuse('messaging/registration-token-not-registered') })).toMatchObject({ status: 'invalid_token' });
    expect(await sendPushToDevice(device, message, { transport: refuse('messaging/internal-error') })).toMatchObject({ status: 'failed' });
  });
});
