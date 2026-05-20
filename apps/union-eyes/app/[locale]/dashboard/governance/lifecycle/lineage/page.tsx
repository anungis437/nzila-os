export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import PolicyLineage from '@/components/policy-governance/PolicyLineage'

export default function LineagePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading lineage graph…</div>}>
      <PolicyLineage />
    </Suspense>
  )
}
