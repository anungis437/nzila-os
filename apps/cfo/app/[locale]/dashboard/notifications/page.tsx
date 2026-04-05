/**
 * CFO — Notifications Page.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Bell } from 'lucide-react'
import { listNotifications } from '@/lib/actions/notification-actions'
import { NotificationList } from '@/components/notification-list'

export default async function NotificationsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('notifications:view')

  const { notifications, unreadCount } = await listNotifications()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Bell className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">All clear</p>
          <p className="mt-1 text-sm text-muted-foreground">No notifications.</p>
        </div>
      ) : (
        <NotificationList initial={notifications} />
      )}
    </div>
  )
}
