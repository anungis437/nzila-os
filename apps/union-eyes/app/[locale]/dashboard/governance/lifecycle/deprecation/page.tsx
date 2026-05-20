export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import DeprecationWatch from '@/components/policy-governance/DeprecationWatch'

export default function DeprecationPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading deprecation watch…</div>}>
      <DeprecationWatch />
    </Suspense>
  )
}
