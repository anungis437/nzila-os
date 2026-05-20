export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import ApprovalQueue from '@/components/policy-governance/ApprovalQueue'

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading approval queue…</div>}>
      <ApprovalQueue />
    </Suspense>
  )
}
