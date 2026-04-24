import type { Metadata } from 'next'
import Link from 'next/link'
import { blogPosts } from '@/lib/content/blog-posts'
import { NewsletterSignup, TemplateDownloadCta } from '@/components/marketing/lead-forms'
import { TrackedCtaLink } from '@/components/marketing/tracked-cta-link'
import { WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

export const metadata: Metadata = {
  title: 'WeekOne Blog | Founder execution systems',
  description: 'Guides for founders and operators on weekly execution, focus, scorecards, and momentum.',
  openGraph: {
    title: 'WeekOne Blog',
    description: 'Weekly execution guides for founders and operators.',
    type: 'website',
  },
}

export default async function BlogIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-navy sm:text-5xl">Founder execution guides</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Practical content for operators who need calm Mondays and shipped outcomes.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {blogPosts.map((post) => (
          <article key={post.slug} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">{post.publishedAt} - {post.readMinutes} min read</p>
            <h2 className="mt-2 text-lg font-semibold text-navy">{post.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
            <TrackedCtaLink
              href={`/${locale}/blog/${post.slug}`}
              eventName={WEEKONE_ANALYTICS_EVENTS.BLOG_CONVERSION}
              context={{ source: 'blog_index', slug: post.slug }}
              className="mt-4 inline-flex text-sm font-semibold text-electric"
            >
              Read article
            </TrackedCtaLink>
          </article>
        ))}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <NewsletterSignup />
        <TemplateDownloadCta />
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        <Link href={`/${locale}/pricing`} className="font-semibold text-electric">See pricing</Link> to upgrade from content to execution.
      </div>
    </main>
  )
}
