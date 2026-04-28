'use client'
import { ErrorPanel } from '@/components/ui'
export default function BusinessError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      scope="console:business"
      {...props}
      title="We hit an error in this view"
      description="Your finance and business operations data is safe. Retry below or jump back to your dashboard."
      secondaryAction={{ label: 'Back to Today', href: '/today' }}
    />
  )
}
