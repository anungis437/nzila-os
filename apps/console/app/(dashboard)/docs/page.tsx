import Link from 'next/link'
import { getAllInternalDocs } from '@/lib/docs'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

// Internal docs are file-system content (content/internal/*.md). Revalidate
// every 5 minutes so newly merged docs surface without redeploy.
export const revalidate = 300

export const metadata = {
  title: 'Internal Docs | Nzila Console',
}

export default function DocsListPage() {
  const docs = getAllInternalDocs()

  const grouped = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    const cat = doc.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Internal Documentation</h1>
      <p className="text-gray-500 mb-8">
        Curated guides and reference material for the Nzila team.
      </p>

      {docs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <DocumentTextIcon className="h-12 w-12 mx-auto mb-4" />
          <p>No internal docs published yet.</p>
          <p className="text-sm mt-1">
            Add markdown files to <code className="bg-gray-100 px-1 rounded">content/internal/</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4">{cat}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[cat]
                  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                  .map((doc) => (
                    <Link
                      key={doc.slug}
                      href={`/docs/${doc.slug}`}
                      className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow hover:border-blue-300 transition"
                    >
                      <h3 className="font-semibold text-gray-900 mb-1">{doc.title}</h3>
                      {doc.description && (
                        <p className="text-sm text-gray-500 line-clamp-2">{doc.description}</p>
                      )}
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
