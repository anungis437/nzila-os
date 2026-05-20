export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import GovernanceSnapshotViewer from '@/components/policy-governance/GovernanceSnapshotViewer'

export default function SnapshotPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading snapshot viewer…</div>}>
      <GovernanceSnapshotViewer />
    </Suspense>
  )
}
