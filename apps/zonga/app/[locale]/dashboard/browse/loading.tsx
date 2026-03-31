/**
 * Browse section — Loading skeleton.
 */
import { Card } from '@nzila/ui'

export default function BrowseLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-40 rounded-2xl bg-muted" />
      <div className="h-6 w-40 rounded bg-muted" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i}>
            <div className="p-4 space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-muted" />
              <div className="h-4 w-20 mx-auto rounded bg-muted" />
              <div className="h-3 w-16 mx-auto rounded bg-muted" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
