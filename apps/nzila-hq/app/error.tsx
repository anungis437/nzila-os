'use client'

import { ErrorPanel } from '@/components/primitives/ErrorPanel'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorPanel error={error} reset={reset} scope="root" />
}
