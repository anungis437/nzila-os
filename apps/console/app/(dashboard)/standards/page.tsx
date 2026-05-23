import { BookOpenIcon, CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { listStandardsChapters } from '@/lib/standards-book'

// Static reference content — same for every viewer; revalidate hourly so
// edits in the scripts-book package propagate without a full deploy.
export const revalidate = 3600

export const metadata = {
  title: 'Standards | Nzila Console',
}

export default async function StandardsPage() {
  const chapters = await listStandardsChapters()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Standards &amp; Scripts Book</h1>
      <p className="text-gray-500 mb-8">
        Living standards derived from the{' '}
        <code className="bg-gray-100 px-1 rounded text-sm">@nzila/scripts-book</code> package.
      </p>

      {chapters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
          <p className="font-medium text-gray-700">No chapters found</p>
          <p className="text-sm mt-1">
            Expected chapter directories under{' '}
            <code className="bg-white px-1 rounded text-xs">
              packages/scripts-book/template/scripts-book
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((ch) => (
            <Link
              key={ch.slug}
              href={`/standards/${ch.slug}`}
              className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-3 hover:border-blue-400 hover:shadow-sm transition"
            >
              <BookOpenIcon className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">{ch.number}</span>
                  <h3 className="font-semibold text-gray-900 truncate">{ch.title}</h3>
                </div>
                {ch.summary && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-3">{ch.summary}</p>
                )}
                <span
                  className={`inline-flex items-center gap-1 text-xs mt-2 ${
                    ch.status === 'published' ? 'text-green-700' : 'text-yellow-700'
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
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
