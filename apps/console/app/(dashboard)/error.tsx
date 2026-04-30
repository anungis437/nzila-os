'use client'
import { ErrorPanel } from '@/components/ui'
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel scope="console:dashboard" {...props} secondaryAction={{ label: 'Back to Today', href: '/today' }} fullPage />
}
