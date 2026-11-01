/**
 * GET POST /api/notifications
 * In-app notifications — list and create.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { createNotification, listNotifications } from '@/lib/notifications/inbox-handlers';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'List in-app notifications',
      description: 'Returns paginated in-app notifications for the authenticated user.',
    },
  },
  listNotifications,
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Create an in-app notification',
      description: 'Creates a new in-app notification for a specific user.',
    },
  },
  createNotification,
);
