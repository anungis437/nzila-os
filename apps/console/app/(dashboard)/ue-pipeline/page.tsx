import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Canonical route migration:
 * - /ue-pipeline now forwards to /workspace/sales
 * - /workspace/sales is the unified pipeline command surface
 */
export default function UEPipelinePage() {
  redirect('/workspace/sales')
}
