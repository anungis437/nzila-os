'use client'
import { ErrorPanel } from '@/components/ui'
export default function IntelligenceError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      scope="console:intelligence"
      {...props}
      title="Intelligence is temporarily unavailable"
      description="One of the upstream signals failed. The rest of the console is still operational — retry, or continue elsewhere."
      severity="warn"
      secondaryAction={{ label: 'Back to Today', href: '/today' }}
    />
  )
}
