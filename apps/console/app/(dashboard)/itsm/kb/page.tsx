/**
 * ITSM Knowledge Base — browse and search articles
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Knowledge Base | ITSM',
}

const KB_CATEGORIES = [
  'Incident Response',
  'Troubleshooting',
  'How-to Guides',
  'Service Catalog',
  'Change Procedures',
  'Known Issues',
]

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams

  // TODO: search KB articles from DB scoped by orgId
  const articles: Array<{
    id: string
    title: string
    category: string | null
    status: string
    viewCount: number
    helpfulCount: number
    updatedAt: string
  }> = []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-1">Searchable articles, runbooks, and how-to guides</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + New Article
        </button>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search articles..."
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="category"
          defaultValue={params.category ?? ''}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {KB_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Search
        </button>
      </form>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {KB_CATEGORIES.map((cat) => (
          <a
            key={cat}
            href={`/itsm/kb?category=${encodeURIComponent(cat)}`}
            className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
              params.category === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </a>
        ))}
      </div>

      {/* Article list */}
      {articles.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-400">
            {params.q || params.category
              ? 'No articles match your search.'
              : 'No articles yet. Create the first one to build your knowledge base.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{article.title}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{article.viewCount} views</span>
                  <span>👍 {article.helpfulCount}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {article.category && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {article.category}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs ${article.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {article.status}
                </span>
                <span className="text-gray-400 text-xs">Updated {article.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
