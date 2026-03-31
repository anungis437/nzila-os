/**
 * Tracks section — Loading skeleton.
 */
import { Card } from '@nzila/ui'

export default function TracksLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-48 rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="p-5 space-y-3">
              <div className="h-16 rounded bg-muted" />
              <div className="h-8 w-24 rounded bg-muted" />
            </div>
          </Card>
          <Card>
            <div className="p-5 space-y-3">
              <div className="h-5 w-28 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <div className="p-5 space-y-3">
              <div className="h-5 w-20 rounded bg-muted" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded bg-muted" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
