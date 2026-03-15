import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import NotificationsConsole from '@/components/notifications/notifications-console';

export const dynamic = 'force-dynamic';

export default async function NotificationsDashboardPage() {
  await requireUser();
  await hasMinRole('member');

  return <NotificationsConsole />;
}
