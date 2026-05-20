export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import ReplayCenter from '@/components/policy-governance/ReplayCenter'

export default function ReplayPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading replay center…</div>}>
      <ReplayCenter />
    </Suspense>
  )
}
