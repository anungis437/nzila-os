import { requireRole } from '@/lib/rbac'
import { Card } from '@nzila/ui'

export const dynamic = 'force-dynamic'

export default async function PilotReadinessPage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Healthcare Discovery Pilot Readiness</h1>
      <p className="text-sm text-gray-600">
        Discovery comes before pilot: one local, one unit, anonymous survey, and one tiny governed workflow wedge.
      </p>

      <Card>
        <Card.Body className="space-y-2 text-sm text-gray-700">
          <p>1. Run short anonymous survey with strict no-identifying-details guardrails.</p>
          <p>2. Review low-response and privacy risk signals before action.</p>
          <p>3. Select one tiny workflow wedge (not a broad scheduling product).</p>
          <p>4. Confirm governance boundaries before launch.</p>
        </Card.Body>
      </Card>
    </div>
  )
}
