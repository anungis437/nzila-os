export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import ConflictAnalysis from '@/components/policy-governance/ConflictAnalysis'

export default function ConflictsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading conflict analysis…</div>}>
      <ConflictAnalysis />
    </Suspense>
  )
}
