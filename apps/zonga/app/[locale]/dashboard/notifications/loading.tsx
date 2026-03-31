/**
 * Notifications section — Loading skeleton.
 */
import { Card } from '@nzila/ui'

export default function NotificationsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-40 rounded bg-muted" />
      <div className="h-4 w-24 rounded bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-center gap-4 p-4">
            <div className="h-6 w-6 rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-72 rounded bg-muted" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
