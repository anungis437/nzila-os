import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getStandardsChapter, renderChapterHtml } from '@/lib/standards-book'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(props: Props) {
  const { slug } = await props.params
  const chapter = await getStandardsChapter(slug)
  return {
    title: chapter ? `${chapter.title} | Standards | Nzila Console` : 'Standards | Nzila Console',
  }
}

export default async function StandardsChapterPage(props: Props) {
  const { slug } = await props.params
  const chapter = await getStandardsChapter(slug)
  if (!chapter) notFound()

  const html = await renderChapterHtml(chapter.markdown)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href="/standards"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Standards
      </Link>

      <header className="mb-6">
        <span className="text-xs font-mono text-gray-400">Chapter {chapter.number}</span>
        <h1 className="text-3xl font-bold text-gray-900">{chapter.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Source:{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">
            packages/scripts-book/template/scripts-book/{chapter.slug}/README.md
          </code>
        </p>
      </header>

      {/* Chapter Markdown is sourced from a trusted in-repo package; the
          renderer (remark + remark-html) does not execute JS. */}
      <article
        className="prose prose-sm sm:prose-base max-w-none prose-headings:text-gray-900 prose-code:text-pink-600 prose-pre:bg-gray-900"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
