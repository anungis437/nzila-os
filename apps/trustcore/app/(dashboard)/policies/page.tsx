import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcorePolicies } from '@nzila/db/queries/trustcore'
import { DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

export default async function PoliciesPage() {
  const ctx = await getAuthContext()
  const policies = await listTrustcorePolicies(ctx.orgId)

  const privacyPolicies = policies.filter((p) => p.type === 'privacy_policy')
  const governancePolicies = policies.filter((p) => p.type === 'data_governance')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generated compliance policies for your organization.
        </p>
      </div>

      {policies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <DocumentTextIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No policies generated yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Complete the{' '}
            <a href="/onboarding" className="text-teal-600 underline">
              onboarding wizard
            </a>{' '}
            to generate your Privacy Policy and Data Governance Policy.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <PolicySection title="Privacy Policy" policies={privacyPolicies} />
          <PolicySection title="Data Governance Policy" policies={governancePolicies} />
        </div>
      )}
    </div>
  )
}

function PolicySection({
  title,
  policies,
}: {
  title: string
  policies: Awaited<ReturnType<typeof listTrustcorePolicies>>
}) {
  if (policies.length === 0) return null

  const latest = policies[0]!
  const older = policies.slice(1)

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-800 mb-3">{title}</h2>
      <PolicyCard policy={latest} isLatest />
      {older.map((p) => (
        <PolicyCard key={p.id} policy={p} />
      ))}
    </section>
  )
}

function PolicyCard({
  policy,
  isLatest,
}: {
  policy: Awaited<ReturnType<typeof listTrustcorePolicies>>[number]
  isLatest?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Version {policy.version}</span>
          {isLatest && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              Latest
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <ClockIcon className="h-3.5 w-3.5" />
          {new Date(policy.createdAt).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </div>
      </div>
      <div className="px-5 py-4">
        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
          {policy.content}
        </pre>
      </div>
    </div>
  )
}

