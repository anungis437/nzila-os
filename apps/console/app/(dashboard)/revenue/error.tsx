'use client'
import { ErrorPanel } from '@/components/ui'
export default function RevenueError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      scope="console:revenue"
      {...props}
      title="Revenue surface failed to load"
      description="One of the pipeline queries errored. Retry — pipeline data is read-only and will not be impacted."
      secondaryAction={{ label: 'Back to Today', href: '/today' }}
    />
  )
}
