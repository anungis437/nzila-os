/**
 * /api/mobile/notifications
 *
 * The mobile inbox is the in-app inbox. This path was a generic-CRUD copy over the scheduled-notification queue table
 * (`notifications`), so a mobile client listed a different, internal table, and a steward could store a row addressed to any
 * user id with a chosen status of sent although the processor that would send scheduled rows answers 501. It now runs the same
 * handlers as /api/notifications (own rows only, recipients checked as organization members, input validated), each behind
 * its own visible guard so the two paths cannot drift apart.
 */
import { withApi } from '@/lib/api/framework';
import { createNotification, listNotifications } from '@/lib/notifications/inbox-handlers';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Notifications'], summary: 'List in-app notifications (mobile)', description: 'The in-app inbox of the authenticated user.' },
  },
  listNotifications,
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Notifications'], summary: 'Create an in-app notification (mobile)', description: 'Creates an in-app notification for a member of the organization.' },
  },
  createNotification,
);
