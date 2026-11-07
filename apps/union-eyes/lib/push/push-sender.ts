/**
 * Push sender over push_devices: the one device table (registered at /api/mobile/devices, removed at /api/mobile/devices/[id]).
 *
 * Delivery goes through Firebase Cloud Messaging and needs FIREBASE_SERVICE_ACCOUNT. Without it nothing is sent and the result says so
 * (`provider_not_configured`); a caller turns that into 501, never into a report of delivery. A token the provider reports as invalid or
 * unregistered is returned as such so the caller can switch the device off instead of retrying it for ever.
 */
import type { pushDevices } from '@/db/schema';
import { logger } from '@/lib/logger';

export type PushDevice = Pick<typeof pushDevices.$inferSelect, 'id' | 'deviceToken' | 'enabled'>;

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export type PushSendResult =
  | { status: 'sent'; providerMessageId: string }
  | { status: 'provider_not_configured'; reason: string }
  | { status: 'device_disabled'; reason: string }
  | { status: 'invalid_token'; reason: string }
  | { status: 'failed'; reason: string };

/** The provider call, injectable for tests. Throws on a provider refusal with the provider's error code on `code`. */
export type PushTransport = (token: string, message: PushMessage) => Promise<string>;

const APP_NAME = 'union-eyes-push-devices';
const INVALID_TOKEN_CODES = new Set(['messaging/invalid-registration-token', 'messaging/registration-token-not-registered', 'messaging/invalid-argument']);

/** Whether a provider credential is present. It does not prove the credential works: only a send does. */
export function pushProviderConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return typeof env.FIREBASE_SERVICE_ACCOUNT === 'string' && env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0;
}

async function firebaseTransport(): Promise<PushTransport> {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getMessaging } = await import('firebase-admin/messaging');
  const app = getApps().find((existing) => existing.name === APP_NAME)
    ?? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string)) }, APP_NAME);
  const messaging = getMessaging(app);
  return (token, message) => messaging.send({ token, notification: { title: message.title, body: message.body }, data: message.data });
}

export async function sendPushToDevice(
  device: PushDevice,
  message: PushMessage,
  options: { transport?: PushTransport; env?: NodeJS.ProcessEnv } = {},
): Promise<PushSendResult> {
  if (!device.enabled) return { status: 'device_disabled', reason: 'Push notifications are switched off for this device' };
  if (!options.transport && !pushProviderConfigured(options.env)) {
    return { status: 'provider_not_configured', reason: 'Push delivery is not configured (FIREBASE_SERVICE_ACCOUNT is not set): nothing was sent' };
  }
  let transport: PushTransport;
  try {
    transport = options.transport ?? await firebaseTransport();
  } catch (error) {
    logger.error('Push provider could not be initialized', { error: error instanceof Error ? error.message : String(error) });
    return { status: 'provider_not_configured', reason: 'The push provider credential could not be loaded: nothing was sent' };
  }
  try {
    const providerMessageId = await transport(device.deviceToken, message);
    return { status: 'sent', providerMessageId };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (typeof code === 'string' && INVALID_TOKEN_CODES.has(code)) {
      return { status: 'invalid_token', reason: 'The push provider no longer accepts this device token' };
    }
    logger.warn('Push delivery failed', { deviceId: device.id, code: typeof code === 'string' ? code : undefined });
    return { status: 'failed', reason: 'The push provider refused or failed the delivery' };
  }
}
