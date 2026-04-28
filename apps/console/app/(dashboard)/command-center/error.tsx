'use client'
import { ErrorPanel } from '@/components/ui'
export default function CommandCenterError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      scope="console:command-center"
      {...props}
      title="Command Center is temporarily unavailable"
      description="Live operating snapshot failed. Retry — or open Today for the cash and pipeline summary."
      secondaryAction={{ label: 'Back to Today', href: '/today' }}
    />
  )
}
