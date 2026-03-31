/**
 * Zonga — Notifications page.
 *
 * In-app notification center: activity feed for the current user.
 * Mark single or all notifications as read.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { listNotifications } from '@/lib/actions/notification-actions'
import { MarkReadButton, MarkAllReadButton } from '@/components/dashboard/notification-buttons'

const typeIcons: Record<string, string> = {
  'payout.completed': '💸',
  'release.published': '📀',
  'asset.approved': '✅',
  'social.followed': '👤',
  'social.tipped': '🎁',
  'event.ticket.purchased': '🎟️',
  'comment': '💬',
  'system': '🔔',
}

export default async function NotificationsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const notifications = await listNotifications()

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <p className="text-4xl">🔔</p>
            <p className="mt-3 text-sm font-medium text-foreground">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You&apos;ll see updates about your releases, payouts, and social activity here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id}>
              <div
                className={`flex items-start gap-4 p-4 ${
                  !n.read ? 'bg-electric/5 border-l-2 border-electric' : ''
                }`}
              >
                <span className="text-xl mt-0.5">
                  {typeIcons[n.type] ?? typeIcons.system}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-electric" />
                    )}
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
                {!n.read && (
                  <MarkReadButton notificationId={n.id} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
