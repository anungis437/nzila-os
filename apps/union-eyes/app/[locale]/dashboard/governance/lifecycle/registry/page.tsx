export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import PolicyRegistry from '@/components/policy-governance/PolicyRegistry'

export default function RegistryPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading policy registry…</div>}>
      <PolicyRegistry />
    </Suspense>
  )
}
