'use client'
import { ErrorPanel } from '@/components/ui'
export default function ItsmError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      scope="console:itsm"
      {...props}
      title="Service Operations could not load"
      description="The ticket queue or related view returned an error. Retry — if it keeps failing, file a P2 incident."
      secondaryAction={{ label: 'Ops Dashboard', href: '/itsm/dashboard' }}
    />
  )
}
