'use client'
import { ErrorPanel } from '@/components/primitives/ErrorPanel'
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel {...props} scope="reports/board-pack" />
}
