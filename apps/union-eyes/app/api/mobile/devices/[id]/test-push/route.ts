/**
 * POST /api/mobile/devices/[id]/test-push
 *
 * The owner of a registered push device sends a test notification to it, through the sender over push_devices (lib/push/push-sender.ts).
 * Only the caller's own device in their organization is found (another member's device, or one of another organization, is 404). With no
 * push provider configured nothing is sent and the answer is 501; a switched-off device is 409; a provider failure is 502; a token the
 * provider no longer accepts switches the device off. Every attempt is audited with its outcome, never with the token.
 */
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pushDevices } from '@/db/schema';
import { sendPushToDevice, type PushSendResult, type PushTransport } from '@/lib/push/push-sender';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The handler, with the provider call injectable for tests. */
export async function sendTestPush(
  args: { organizationId: string; userId: string; deviceId: string },
  transport?: PushTransport,
): Promise<{ sent: true; providerMessageId: string }> {
  const { organizationId, userId, deviceId } = args;
  if (!UUID.test(deviceId)) throw ApiError.notFound('Device');
  const [device] = await withRLSContext({ organizationId, userId }, (tx) =>
    tx.select({ id: pushDevices.id, deviceToken: pushDevices.deviceToken, enabled: pushDevices.enabled })
      .from(pushDevices)
      .where(and(eq(pushDevices.id, deviceId), eq(pushDevices.organizationId, organizationId), eq(pushDevices.profileId, userId)))
      .limit(1),
  );
  if (!device) throw ApiError.notFound('Device');

  const result: PushSendResult = await sendPushToDevice(device, { title: 'Union Eyes', body: 'Test notification: push delivery to this device works.' }, transport ? { transport } : {});

  // The outcome is recorded after the external call; an invalid token also switches the device off in the same transaction.
  await withRLSContext({ organizationId, userId }, async (tx) => {
    if (result.status === 'invalid_token') {
      await tx.update(pushDevices).set({ enabled: false, updatedAt: new Date() })
        .where(and(eq(pushDevices.id, device.id), eq(pushDevices.organizationId, organizationId), eq(pushDevices.profileId, userId)));
    }
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'mobile.device.test_push',
      resourceType: 'push_devices',
      resourceId: device.id,
      details: { outcome: result.status },
    }, result.status === 'sent' ? 'success' : 'failure');
  });

  switch (result.status) {
    case 'sent': return { sent: true, providerMessageId: result.providerMessageId };
    case 'provider_not_configured': throw ApiError.capabilityUnavailable(result.reason);
    case 'device_disabled': throw ApiError.conflict(result.reason);
    case 'invalid_token': throw ApiError.conflict(`${result.reason}; the device has been switched off. Register it again from the app.`);
    default: throw ApiError.externalService('Push provider', result.reason);
  }
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Send a test push to one of the caller\'s devices',
      description: 'Sends a test notification to the caller\'s own registered device. Answers 501 when no push provider is configured.',
    },
  },
  async ({ params, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.forbidden('Organization context required');
    const { id } = await params;
    return sendTestPush({ organizationId, userId, deviceId: id });
  },
);
