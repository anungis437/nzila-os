export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import DriftDetection from '@/components/policy-governance/DriftDetection'

export default function DriftPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading drift detection…</div>}>
      <DriftDetection />
    </Suspense>
  )
}
