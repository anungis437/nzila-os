import fs from 'node:fs/promises';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { buildLocaleAlternates } from '@/lib/marketing-seo';
import {
  WHITEPAPER_LIBRARY,
  getWhitepaperBySlug,
  resolveWhitepaperSourcePath,
} from '@/lib/whitepaper/library';
import { renderWhitepaperMarkdown } from '@/lib/whitepaper/markdown-renderer';

type Params = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return WHITEPAPER_LIBRARY.filter((entry) => entry.sourceFile).map((entry) => ({
    slug: entry.slug,
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const entry = getWhitepaperBySlug(slug);
  if (!entry) {
    return {};
  }
  return {
    title: `${entry.title} | UnionEyes`,
    description: entry.subtitle,
    alternates: buildLocaleAlternates(locale, entry.href),
  };
}

export default async function MarkdownWhitepaperPage({ params }: Params) {
  const { locale, slug } = await params;
  const entry = getWhitepaperBySlug(slug);
  if (!entry) {
    notFound();
  }
  // Bespoke routes (continuity gap) are surfaced through their own page.
  if (!entry.sourceFile) {
    redirect(`/${locale}${entry.href}`);
  }

  const markdown = await fs.readFile(resolveWhitepaperSourcePath(entry.sourceFile), 'utf8');
  const rendered = renderWhitepaperMarkdown(markdown);

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#0f2133]">
        <Image
          aria-hidden="true"
          src={entry.heroImage}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover opacity-40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#0f2133]/85 via-[#123451]/75 to-[#0f2133]/90"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
              {entry.format} · {entry.version}
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white drop-shadow-md sm:text-5xl lg:text-6xl">
              {entry.title}
            </h1>
            <p className="mt-4 text-base text-white/90 drop-shadow sm:text-lg lg:text-xl">
              {entry.subtitle}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/${locale}/whitepapers`}
                className="inline-flex items-center justify-center rounded-lg border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                ← All whitepapers
              </Link>
              <Link
                href={`/${locale}/insights`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
              >
                Read Insights Library
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="whitepaper-abstract" className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2
                id="whitepaper-abstract"
                className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1f5b84]"
              >
                Abstract
              </h2>
              <span className="text-xs font-medium text-slate-500">{entry.readingTime}</span>
            </div>
            <p className="mt-5 text-base leading-relaxed text-slate-700 sm:text-lg">
              {entry.abstract}
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              {entry.abstractCallouts.map((point) => (
                <li
                  key={point}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 leading-snug"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <section className="grid gap-8 xl:grid-cols-12">
          <aside className="space-y-4 xl:col-span-3 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                On this page
              </h3>
              <ol className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1 text-sm text-slate-700">
                {rendered.tocItems.map((item, index) => (
                  <li key={item.slug}>
                    <a
                      href={`#${item.slug}`}
                      className="group inline-flex items-start gap-2 transition-colors hover:text-[#1f5b84]"
                    >
                      <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 group-hover:bg-[#1f5b84]/10 group-hover:text-[#1f5b84]">
                        {index + 1}
                      </span>
                      <span>{item.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Quick actions
              </h3>
              <div className="mt-3 space-y-2">
                {rendered.tocItems[0] ? (
                  <a
                    href={`#${rendered.tocItems[0].slug}`}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    Start reading
                  </a>
                ) : null}
                <Link
                  href={`/${locale}/whitepapers`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Browse the library
                </Link>
              </div>
            </div>
          </aside>

          <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 xl:col-span-9">
            {rendered.nodes}
          </article>
        </section>
      </main>
    </div>
  );
}
