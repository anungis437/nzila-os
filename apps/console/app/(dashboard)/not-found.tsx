/**
 * Dashboard not-found page.
 *
 * Rendered by Next.js when a route segment under (dashboard) calls
 * `notFound()` or matches no segment. Calm, in-shell — does NOT replace
 * the layout sidebar.
 */
import Link from 'next/link'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <MagnifyingGlassIcon className="h-7 w-7 text-gray-500" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          The view you&rsquo;re looking for may have been moved, renamed, or
          isn&rsquo;t available for your role yet.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/console"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Return to Console
          </Link>
          <Link
            href="/today"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Open Today
          </Link>
        </div>
      </div>
    </div>
  )
}
