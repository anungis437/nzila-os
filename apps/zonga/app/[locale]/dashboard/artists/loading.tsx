/**
 * Artists section — Loading skeleton.
 */
import { Card } from '@nzila/ui'

export default function ArtistsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-44 rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="p-5 space-y-3">
              <div className="h-5 w-32 rounded bg-muted" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <div className="h-10 w-10 rounded bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <div className="p-5 space-y-3">
              <div className="h-5 w-20 rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
