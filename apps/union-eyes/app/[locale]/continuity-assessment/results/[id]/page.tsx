/**
 * ARTIFACT TYPE: Next.js Page (Results / Enterprise)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Results page — fetches the institutional continuity profile from the DB and
 * presents it with an enterprise-grade hero, contextual metadata, and the
 * shared ICRAProfile body. Lives outside the (marketing) route group so it
 * carries its own non-marketing chrome (see ./layout.tsx).
 *
 * Fully public. No auth. Accessible via the unique link issued at submission.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getIcraProfile } from '@/actions/icra/get-profile';
import { getIcraAdaptiveResolution } from '@/actions/icra/get-adaptive-resolution';
import { ICRAProfile } from '@/components/icra/ICRAProfile';
import PrintReportButton from '@/components/icra/PrintReportButton';
import { EmailResultsCard } from '@/components/icra/EmailResultsCard';
import { AdaptiveInterpretationBlock } from '@/components/icra/AdaptiveInterpretationBlock';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Empty boardroom — institutional, deliberate, not marketing-y. Reused from
// the institutional-continuity-risk landing so the visual language is coherent
// from intake → assessment → results.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=2400&q=80&auto=format';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  return {
    title: 'Your Continuity Profile | UnionEyes',
    description: 'Your Institutional Continuity Risk Assessment results.',
    alternates: buildLocaleAlternates(locale, `/continuity-assessment/results/${id}`),
    robots: { index: false, follow: false },
  };
}

const COPY = {
  'en-CA': {
    overline: 'Institutional Continuity Profile',
    headline: 'Your Continuity Reflection',
    subhead:
      'A calm, explainable read of your institution\u2019s continuity posture. Every number traces to a question, a weight, and a published doctrine.',
    generated: 'Issued',
    assessmentRef: 'Reference',
    doctrine: 'Doctrine',
    print: 'Print or save as PDF',
    back: 'About this assessment',
    confidentialBadge: 'Confidential \u00b7 Issued to the holder of this link',
    tierUnlocked: 'unlocked. Your full report is now available below.',
  },
  'fr-CA': {
    overline: 'Profil de continuit\u00e9 institutionnelle',
    headline: 'Votre lecture de continuit\u00e9',
    subhead:
      'Une lecture posée et explicable de la posture de continuit\u00e9 de votre institution. Chaque chiffre est traçable \u00e0 une question, un poids et une doctrine publi\u00e9e.',
    generated: 'Émise le',
    assessmentRef: 'R\u00e9f\u00e9rence',
    doctrine: 'Doctrine',
    print: 'Imprimer ou enregistrer en PDF',
    back: 'À propos de cette évaluation',
    confidentialBadge: 'Confidentiel \u00b7 Émis au porteur de ce lien',
    tierUnlocked: 'débloqué. Votre rapport complet est maintenant disponible ci-dessous.',
  },
} as const;

const TIER_LABEL: Record<string, { 'en-CA': string; 'fr-CA': string }> = {
  executive_continuity_brief: {
    'en-CA': 'Executive Continuity Brief',
    'fr-CA': 'Note exécutive de continuité',
  },
  institutional_continuity_diagnostic: {
    'en-CA': 'Institutional Continuity Diagnostic',
    'fr-CA': 'Diagnostic de continuité institutionnelle',
  },
};

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const { id, locale } = await params;
  const sp = await searchParams;
  const tierUnlocked = typeof sp.tier_unlocked === 'string' ? sp.tier_unlocked : null;

  if (!id || !UUID_RE.test(id)) notFound();

  const profile = await getIcraProfile(id);
  if (!profile) notFound();

  const adaptiveResolution = await getIcraAdaptiveResolution(id);

  const copy = COPY[locale as 'en-CA' | 'fr-CA'] ?? COPY['en-CA'];
  const tierLabel = tierUnlocked ? TIER_LABEL[tierUnlocked] : null;

  const issuedAt = new Date();
  const issuedLabel = issuedAt.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const shortRef = id.slice(0, 8).toUpperCase();

  return (
    <>
      {/* ── Enterprise hero ─────────────────────────────────────────────── */}
      <section
        className="relative isolate overflow-hidden bg-stone-900 text-white print:bg-white print:text-stone-900"
        aria-labelledby="results-hero-headline"
      >
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-40 print:hidden"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          aria-hidden
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-stone-900/70 via-stone-900/80 to-stone-900 print:hidden"
          aria-hidden
        />

        <div className="mx-auto max-w-5xl px-6 pb-16 pt-14 md:pb-20 md:pt-20">
          <div className="flex items-center justify-between gap-4">
            <Link
              href={`/${locale}/continuity-assessment`}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white print:hidden"
            >
              <span aria-hidden>&larr;</span> {copy.back}
            </Link>
            <PrintReportButton label={copy.print} />
          </div>

          <div className="mt-10 max-w-3xl space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 print:text-stone-500">
              {copy.overline}
            </p>
            <h1
              id="results-hero-headline"
              className="font-sans text-4xl font-semibold tracking-tight text-white md:text-5xl print:text-stone-900"
            >
              {copy.headline}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/75 md:text-lg print:text-stone-600">
              {copy.subhead}
            </p>
          </div>

          {/* Metadata chips */}
          <dl className="mt-10 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 backdrop-blur-sm print:border-stone-200 print:bg-white">
              <dt className="text-[10px] font-medium uppercase tracking-widest text-white/50 print:text-stone-400">
                {copy.generated}
              </dt>
              <dd className="mt-1 font-medium text-white/90 print:text-stone-900">
                {issuedLabel}
              </dd>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 backdrop-blur-sm print:border-stone-200 print:bg-white">
              <dt className="text-[10px] font-medium uppercase tracking-widest text-white/50 print:text-stone-400">
                {copy.assessmentRef}
              </dt>
              <dd className="mt-1 font-mono text-sm tracking-wide text-white/90 print:text-stone-900">
                {shortRef}
              </dd>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 backdrop-blur-sm print:border-stone-200 print:bg-white">
              <dt className="text-[10px] font-medium uppercase tracking-widest text-white/50 print:text-stone-400">
                {copy.doctrine}
              </dt>
              <dd className="mt-1 font-medium text-white/90 print:text-stone-900">
                v1.0.0 &middot; Question bank v{profile.questionBankVersion}
              </dd>
            </div>
          </dl>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] tracking-wide text-white/60 print:border-stone-200 print:bg-white print:text-stone-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            {copy.confidentialBadge}
          </p>
        </div>
      </section>

      {/* ── Tier unlocked banner ────────────────────────────────────────── */}
      {tierLabel && (
        <div className="mx-auto mt-8 max-w-5xl px-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-900">
            <span className="font-semibold">{tierLabel[locale as 'en-CA' | 'fr-CA'] ?? tierLabel['en-CA']}</span>{' '}
            {copy.tierUnlocked}
          </div>
        </div>
      )}
      {/* ── Email me my results link ──────────────────────────────────────── */}
      <div className="mx-auto mt-8 max-w-5xl px-6">
        <EmailResultsCard assessmentId={id} locale={locale} />
      </div>
      {/* ── Adaptive interpretation context ──────────────────────────────── */}
      {adaptiveResolution && (
        <div className="mx-auto mt-8 max-w-5xl px-6">
          <AdaptiveInterpretationBlock
            resolution={adaptiveResolution}
            locale={(locale === 'fr-CA' ? 'fr-CA' : 'en-CA') as 'en-CA' | 'fr-CA'}
          />
        </div>
      )}
      {/* ── Report body ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <ICRAProfile profile={profile} tierId={profile.reportTierId} />
      </section>
    </>
  );
}
