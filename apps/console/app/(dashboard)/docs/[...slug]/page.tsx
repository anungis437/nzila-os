import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInternalDocBySlug, getAllInternalDocSlugs } from '@/lib/docs'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { sanitizeHtml } from '@/lib/sanitize'

// Per-doc page reads from the file system; revalidate every 5 minutes.
// `generateStaticParams` below pre-renders all known slugs at build time.
export const revalidate = 300

interface Props {
  params: Promise<{ slug: string[] }>
}

export async function generateStaticParams() {
  const slugs = getAllInternalDocSlugs()
  return slugs.map((s) => ({ slug: s }))
}

export default async function InternalDocPage({ params }: Props) {
  const { slug } = await params
  const slugPath = slug.join('/')
  const doc = await getInternalDocBySlug(slugPath)

  if (!doc) notFound()

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Back to Docs
      </Link>

      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{doc.title}</h1>
          {doc.description && <p className="mt-2 text-gray-500">{doc.description}</p>}
          {doc.category && (
            <span className="inline-block mt-3 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {doc.category}
            </span>
          )}
        </header>

        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.htmlContent) }}
        />
      </article>
    </div>
  )
}
