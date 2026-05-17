import { requireRole } from '@/lib/rbac'
import { NewSurveyForm } from './new-survey-form'

export const dynamic = 'force-dynamic'

export default async function NewHealthcareSurveyPage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Create Healthcare Discovery Survey</h1>
      <p className="text-sm text-gray-600">
        First Nzila Healthcare discovery seed: one local, one unit, anonymous discovery, one tiny workflow wedge.
      </p>
      <NewSurveyForm />
    </div>
  )
}
