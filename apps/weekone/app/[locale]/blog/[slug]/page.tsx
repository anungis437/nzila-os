import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { blogPosts, getBlogPost } from '@/lib/content/blog-posts'
import { TemplateDownloadCta } from '@/components/marketing/lead-forms'
import { TrackedCtaLink } from '@/components/marketing/tracked-cta-link'
import { WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) {
    return { title: 'Article not found' }
  }

  return {
    title: `${post.title} | WeekOne Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
    },
    keywords: post.keywords,
  }
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Organization',
      name: 'WeekOne',
    },
  }
  const schemaJson = JSON.stringify(schema).replace(/</g, '\\u003c')

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <script type="application/ld+json">{schemaJson}</script>

      <p className="text-xs text-muted-foreground">{post.publishedAt} - {post.readMinutes} min read</p>
      <h1 className="mt-2 text-3xl font-bold text-navy sm:text-5xl">{post.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{post.description}</p>

      <article className="prose prose-sm mt-8 max-w-none text-foreground">
        {post.body.map((paragraph) => (
          <p key={paragraph} className="mb-4 leading-7 text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </article>

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-navy">Ready to run this in your business?</p>
        <p className="mt-1 text-sm text-muted-foreground">Start your first WeekOne operating cycle in minutes.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TrackedCtaLink
            href={`/${locale}/onboarding`}
            eventName={WEEKONE_ANALYTICS_EVENTS.BLOG_CONVERSION}
            context={{ source: 'blog_article_cta', slug }}
            className="rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white"
          >
            Start free
          </TrackedCtaLink>
          <TrackedCtaLink
            href={`/${locale}/pricing`}
            eventName={WEEKONE_ANALYTICS_EVENTS.BLOG_CONVERSION}
            context={{ source: 'blog_article_pricing', slug }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
          >
            View pricing
          </TrackedCtaLink>
        </div>
      </div>

      <div className="mt-8">
        <TemplateDownloadCta />
      </div>

      <Link href={`/${locale}/blog`} className="mt-8 inline-flex text-sm font-semibold text-electric">
        Back to blog
      </Link>
    </main>
  )
}
