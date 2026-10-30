/**
 * /api/mobile/push/subscribe
 *
 * Web push subscription is not implemented. This path used to be the push-campaign CRUD over push_notifications: the browser's
 * PushSubscription (or { endpoint }) names none of that table's required columns, so a steward request failed at insert and a
 * member request was refused, nothing was ever stored or removed, and the client marked itself subscribed regardless. The same table
 * also exposed unpublished campaigns, with their targeting, to every member and let a steward create a row that reads as sent
 * with delivery figures although nothing in the application sends a push. No subscription store and no sender exist, so every
 * method answers 501 and no row is read or written.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const options = {
  auth: { required: true, minRole: 'member' as const },
  openapi: {
    tags: ['Notifications'],
    summary: 'Web push subscribe (not implemented)',
    description: 'Not implemented: answers 501.',
  },
};
const refuse = async () => {
  throw ApiError.notImplemented('Web push subscription is not implemented: no subscription is stored and no push is sent.');
};

export const GET = withApi(options, refuse);
export const POST = withApi(options, refuse);