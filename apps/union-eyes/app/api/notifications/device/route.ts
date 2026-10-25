/**
 * POST DELETE /api/notifications/device
 *
 * Retired: registration never stored the device token (it only flipped the push channel flag and then echoed the token
 * back as if it had been registered). Devices are registered through /api/mobile/devices, which stores the token under
 * the caller's own profile, and the push channel is switched through /api/notifications/preferences.
 */
import { withApiAuth } from '@/lib/api-auth-guard';
import { retiredHandler } from '@/lib/api/retired-route';

export const dynamic = 'force-dynamic';

const retired = retiredHandler('/api/mobile/devices to register a device and /api/notifications/preferences to switch push notifications');

export const POST = withApiAuth(retired);
export const DELETE = withApiAuth(retired);
