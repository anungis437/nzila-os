'use client'
import { ErrorPanel } from '@/components/ui'
export default function CapitalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      scope="console:capital"
      {...props}
      title="Capital view failed to load"
      description="A cost rollup or breach query errored. Cash data is unchanged — retry to refresh the view."
      secondaryAction={{ label: 'Back to Today', href: '/today' }}
    />
  )
}
