export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import GovernanceTimeline from '@/components/policy-governance/GovernanceTimeline'

export default function TimelinePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading governance timeline…</div>}>
      <GovernanceTimeline />
    </Suspense>
  )
}
