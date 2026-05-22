/**
 * ARTIFACT TYPE: Marketing Landing Page (standalone)
 * DOCTRINE_VERSION: 1.0.0
 * ROUTE: /[locale]/governance-entropy-workbook
 *
 * Governance Entropy Workbook\u2122 \u2014 the P2 (Mapping) layer of the OCI
 * product ladder. Editorial, institutional, dignified. Mirrors the ICRA
 * landing pattern but anchored on the Institutional Memory Holders module.
 *
 * Tone: calm, fieldwork-energy, never dashboard energy. No urgency. No
 * scarcity. No AI language. The page reads as an instrument, not a
 * product.
 *
 * Bilingual: EN-CA / FR-CA via inline ternary.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { WORKBOOK_COPY, isFrench, type Locale } from '@/lib/workbook/copy';

const HERO_IMAGE_URL =
  'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1920&q=80&auto=format'; // hand writing in notebook
const MEMORY_HOLDERS_IMAGE_URL =
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1400&q=80&auto=format'; // hands writing ledger
const FIELDWORK_IMAGE_URL =
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1920&q=80&auto=format'; // analog mapping

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const fr = isFrench(locale);
  return {
    title: fr
      ? 'Cahier d\u2019entropie de gouvernance | UnionEyes'
      : 'Governance Entropy Workbook | UnionEyes',
    description: fr
      ? 'Cartographiez les personnes qui portent votre institution. L\u2019instrument de cartographie de la continuit\u00e9 dans l\u2019\u00e9chelle OCI.'
      : 'Map the people who carry your institution. The continuity mapping instrument in the OCI ladder.',
    alternates: buildLocaleAlternates(locale, '/governance-entropy-workbook'),
  };
}

export default async function GovernanceEntropyWorkbookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const fr = isFrench(locale);
  const l: Locale = fr ? 'fr-CA' : 'en-CA';
  const c = WORKBOOK_COPY;

  return (
    <div className="bg-stone-50 text-stone-900 font-sans">
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="relative isolate flex min-h-[78vh] items-end overflow-hidden bg-stone-900"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(28,25,23,0.55) 0%, rgba(28,25,23,0.85) 100%), url(${HERO_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-20 pt-32 sm:pb-28">
          <p className="text-[0.78rem] uppercase tracking-[0.32em] text-stone-300">
            {c.hero.eyebrow[l]}
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-light leading-tight text-stone-50 sm:text-5xl md:text-6xl">
            {c.hero.title[l]}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-stone-200 sm:text-xl">
            {c.hero.lede[l]}
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href={`/${locale}/workbook/start`}
              className="inline-flex items-center rounded-md bg-stone-50 px-7 py-3.5 text-sm font-medium tracking-wide text-stone-900 transition hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
            >
              {c.hero.primaryCta[l]}
            </Link>
            <Link
              href="/contact?topic=workbook-facilitated"
              className="inline-flex items-center rounded-md border border-stone-400/40 px-7 py-3.5 text-sm font-medium tracking-wide text-stone-100 transition hover:border-stone-300 hover:bg-stone-50/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
            >
              {c.hero.secondaryCta[l]}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Positioning ─────────────────────────────────────────────── */}
      <section className="border-b border-stone-200 bg-stone-50 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
            {c.positioning.title[l]}
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-stone-700">
            {c.positioning.body[l]}
          </p>
        </div>
      </section>

      {/* ─── Modules ─────────────────────────────────────────────────── */}
      <section className="border-b border-stone-200 bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
              {c.modules.title[l]}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-stone-600">
              {c.modules.intro[l]}
            </p>
          </div>
          <ul className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 md:grid-cols-2 lg:grid-cols-3">
            {c.modules.items.map((m) => (
              <li
                key={m.id}
                className={`flex flex-col bg-white p-7 ${m.unlockedInSelfGuided ? 'ring-2 ring-stone-900 ring-offset-0' : ''}`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-medium text-stone-900">{m.title[l]}</h3>
                  {m.unlockedInSelfGuided ? (
                    <span className="rounded bg-stone-900 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-stone-50">
                      {fr ? 'Autonome' : 'Self-Guided'}
                    </span>
                  ) : (
                    <span className="text-[0.65rem] font-medium uppercase tracking-wider text-stone-400">
                      {fr ? 'Facilit\u00e9' : 'Facilitated'}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-stone-600">{m.body[l]}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Memory Holders interstitial ─────────────────────────────── */}
      <section
        className="relative isolate min-h-[44vh] overflow-hidden bg-stone-900"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(28,25,23,0.92) 0%, rgba(28,25,23,0.45) 100%), url(${MEMORY_HOLDERS_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 mx-auto flex h-full max-w-3xl flex-col justify-center px-6 py-24 sm:py-32">
          <p className="text-[0.78rem] uppercase tracking-[0.32em] text-stone-300">
            {fr ? 'Module fondateur' : 'Foundational module'}
          </p>
          <h2 className="mt-6 text-3xl font-light leading-tight text-stone-50 sm:text-4xl">
            {fr
              ? 'Les Porteurs de m\u00e9moire institutionnelle.'
              : 'Institutional Memory Holders.'}
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-200">
            {fr
              ? 'Le module entier est d\u00e9verrouill\u00e9 dans l\u2019\u00e9dition autonome. Nommer les porteurs. Classer leur criticit\u00e9. Marquer ceux pour qui aucun successeur n\u2019est identifi\u00e9. La carte appara\u00eet en parall\u00e8le, au fur et \u00e0 mesure.'
              : 'The entire module is unlocked in the Self-Guided Edition. Name the carriers. Classify their criticality. Mark those without an identified successor. The map appears in parallel as you go.'}
          </p>
        </div>
      </section>

      {/* ─── Frameworks ──────────────────────────────────────────────── */}
      <section className="border-b border-stone-200 bg-stone-50 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-3xl text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
            {c.frameworks.title[l]}
          </h2>
          <ul className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {c.frameworks.items.map((f) => (
              <li key={f.id} className="border-l-2 border-stone-300 pl-6">
                <h3 className="text-base font-medium text-stone-900">{f.title[l]}</h3>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">{f.body[l]}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Pricing / Tiers ─────────────────────────────────────────── */}
      <section className="border-b border-stone-200 bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-3xl text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
            {c.pricing.title[l]}
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {Object.values(c.pricing.tiers).map((t) => {
              const isSelfGuided = t.id === 'workbook_self_guided';
              return (
                <div
                  key={t.id}
                  className={`flex flex-col rounded-lg border bg-white p-7 ${
                    isSelfGuided ? 'border-stone-900 shadow-sm' : 'border-stone-200'
                  }`}
                >
                  <h3 className="text-lg font-medium text-stone-900">{t.name}</h3>
                  <p className="mt-2 text-2xl font-light text-stone-900">{t.priceLabel}</p>
                  <p className="mt-4 text-sm leading-relaxed text-stone-600">{t.tagline}</p>
                  <ul className="mt-6 space-y-2 text-sm text-stone-700">
                    {t.includes.map((inc, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 inline-block h-[3px] w-[3px] flex-shrink-0 rounded-full bg-stone-400" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <Link
                      href={`/${locale}${t.ctaHref.startsWith('/') ? t.ctaHref : '/' + t.ctaHref}`}
                      className={`inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-sm font-medium transition ${
                        isSelfGuided
                          ? 'bg-stone-900 text-stone-50 hover:bg-stone-700'
                          : 'border border-stone-300 text-stone-900 hover:bg-stone-100'
                      }`}
                    >
                      {t.ctaLabel}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Closing ─────────────────────────────────────────────────── */}
      <section
        className="relative isolate overflow-hidden bg-stone-900 px-6 py-24 sm:py-32"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(28,25,23,0.88), rgba(28,25,23,0.95)), url(${FIELDWORK_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-light leading-tight text-stone-50 sm:text-4xl">
            {c.closing.title[l]}
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-stone-200">{c.closing.body[l]}</p>
          <div className="mt-12">
            <Link
              href={`/${locale}/workbook/start`}
              className="inline-flex items-center rounded-md bg-stone-50 px-8 py-4 text-sm font-medium tracking-wide text-stone-900 transition hover:bg-stone-200"
            >
              {c.hero.primaryCta[l]}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
