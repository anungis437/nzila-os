/**
 * Events section — Loading skeleton.
 */
import { Card } from '@nzila/ui'

export default function EventsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="h-4 w-56 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <div className="p-5 space-y-3">
              <div className="h-5 w-28 rounded bg-muted" />
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
