/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 */
/**
 * Locale-aware Story page
 * Accessible at /{locale}/story — provides the founding narrative.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Heart, Users, Shield, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.story' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/story'),
  };
}

export default async function LocaleStoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.story' });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.story}
        badge={
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 border border-white/30 rounded-full text-sm text-white font-medium backdrop-blur-sm">
            <Heart className="h-4 w-4" />
            <span>{t('badge')}</span>
          </div>
        }
        heading={t('heroHeading')}
        description={t('heroDescription')}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Origin Story */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">{t('originHeading')}</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-700 leading-relaxed mb-4">{t('originParagraph1')}</p>
            <p className="text-lg text-slate-700 leading-relaxed mb-4">{t('originParagraph2')}</p>
            <p className="text-lg text-slate-700 leading-relaxed mb-4">{t('originParagraph3')}</p>
            <p className="text-lg text-slate-700 leading-relaxed font-semibold">{t('originParagraph4')}</p>
          </div>
        </section>

        {/* Mission */}
        <section className="mb-16">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">{t('missionHeading')}</h3>
            <p className="text-lg text-slate-700 leading-relaxed">{t('missionBody')}</p>
          </div>
        </section>

        {/* Core Principles */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">{t('principlesHeading')}</h2>
          <div className="space-y-6">
            <PrincipleCard
              icon={<Users className="h-6 w-6" />}
              title={t('principle1Title')}
              description={t('principle1Description')}
            />
            <PrincipleCard
              icon={<Shield className="h-6 w-6" />}
              title={t('principle2Title')}
              description={t('principle2Description')}
            />
            <PrincipleCard
              icon={<Heart className="h-6 w-6" />}
              title={t('principle3Title')}
              description={t('principle3Description')}
            />
            <PrincipleCard
              icon={<Handshake className="h-6 w-6" />}
              title={t('principle4Title')}
              description={t('principle4Description')}
            />
          </div>
        </section>

        {/* Founders — named, attestable, no fabricated photos.
            Initials avatars used until real headshots are added. */}
        <section id="founders" className="mb-16 scroll-mt-24">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">{t('foundersHeading')}</h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-3xl">{t('foundersIntro')}</p>
          <div className="grid gap-6 md:grid-cols-2">
            <FounderCard
              initials="MN"
              name={t('founderMichelName')}
              role={t('founderMichelRole')}
              bio={t('founderMichelBio')}
            />
            <FounderCard
              initials="AN"
              name={t('founderAubertName')}
              role={t('founderAubertRole')}
              bio={t('founderAubertBio')}
            />
          </div>
          <p className="mt-6 text-sm text-slate-500 italic">{t('foundersNote')}</p>
        </section>

        {/* CTA */}
        <section className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">{t('ctaHeading')}</h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">{t('ctaBody')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href={`/${locale}/organizational-continuity-risk`}>{t('ctaPilot')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={`/${locale}/contact`}>{t('ctaContact')}</Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-slate-600">
            <Link
              href={`/${locale}/whitepaper`}
              className="inline-flex items-center gap-1 text-blue-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              {locale === 'fr-CA'
                ? 'Lire le livre blanc UnionEyes (~25 min)'
                : 'Read the UnionEyes whitepaper (~25 min read)'}
              <span aria-hidden="true">→</span>
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}

function PrincipleCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-6 bg-white border border-slate-200 rounded-lg">
      <div className="shrink-0 w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-700">{description}</p>
      </div>
    </div>
  );
}

function FounderCard({ initials, name, role, bio }: { initials: string; name: string; role: string; bio: string }) {
  return (
    <div className="flex flex-col gap-4 p-6 bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-navy to-electric text-white text-xl font-bold flex items-center justify-center"
        >
          {initials}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          <p className="text-sm text-electric font-medium">{role}</p>
        </div>
      </div>
      <p className="text-slate-700 leading-relaxed">{bio}</p>
    </div>
  );
}
