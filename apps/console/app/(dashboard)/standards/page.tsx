import {
  BookOpenIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// Static reference content — same for every viewer; revalidate hourly so
// edits to the chapter list propagate without a full deploy.
export const revalidate = 3600

export const metadata = {
  title: 'Standards | Nzila Console',
}

const chapters = [
  { title: 'Coding Standards', status: 'published' },
  { title: 'Security Protocols', status: 'published' },
  { title: 'AI Safety & Governance', status: 'published' },
  { title: 'Data Governance', status: 'draft' },
  { title: 'Deployment Playbook', status: 'draft' },
  { title: 'Incident Response', status: 'draft' },
]

export default function StandardsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Standards &amp; Scripts Book</h1>
      <p className="text-gray-500 mb-8">
        Living standards derived from the{' '}
        <code className="bg-gray-100 px-1 rounded text-sm">@nzila/scripts-book</code> package.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((ch) => (
          <div
            key={ch.title}
            className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-3"
          >
            <BookOpenIcon className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900">{ch.title}</h3>
              <span
                className={`inline-flex items-center gap-1 text-xs mt-1 ${
                  ch.status === 'published'
                    ? 'text-green-700'
                    : 'text-yellow-700'
                }`}
              >
                {ch.status === 'published' ? (
                  <CheckBadgeIcon className="h-3.5 w-3.5" />
                ) : (
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                )}
                {ch.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-400">
        <p className="font-medium text-gray-600">Full chapter viewer coming soon</p>
        <p className="text-sm mt-1">
          Chapter content will be rendered directly from the scripts-book package.
        </p>
      </div>
    </div>
  )
}
