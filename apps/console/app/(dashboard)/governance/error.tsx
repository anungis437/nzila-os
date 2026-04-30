'use client'
import { ErrorPanel } from '@/components/ui'
export default function GovernanceError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      scope="console:governance"
      {...props}
      title="Governance view failed to load"
      description="Audit trail and policy data are unaffected. Retry to refresh — if the failure persists, file a governance review ticket."
      secondaryAction={{ label: 'Back to Today', href: '/today' }}
    />
  )
}
