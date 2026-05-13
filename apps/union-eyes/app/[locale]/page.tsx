export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import ScrollReveal from '@/components/public/scroll-reveal';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import LocaleSiteNavigation from './(marketing)/locale-site-navigation';
import LocaleSiteFooter from './(marketing)/locale-site-footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homePage' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: buildLocaleAlternates(locale),
  };
}

type ContinuitySvgLabels = {
  ariaLabel: string;
  stewardA: string;
  handoff: string;
  stewardB: string;
  stewardC: string;
  caption: string;
};

type FederationSvgLabels = {
  ariaLabel: string;
  federation: string;
  council: string;
};

type EvidenceSvgLabels = {
  ariaLabel: string;
  evidence: string;
  stepPrefix: string;
  caption: string;
};

type CoexistenceSvgLabels = {
  ariaLabel: string;
  existingCrm: string;
  existingCase: string;
  existingRecords: string;
  layerTitle: string;
  layerSubtitle: string;
};

function ContinuityTimeline({ labels }: { labels: ContinuitySvgLabels }) {
  return (
    <svg viewBox="0 0 480 200" className="w-full h-auto" role="img" aria-label={labels.ariaLabel}>
      <defs>
        <linearGradient id="ueLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#0a2540" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#0a2540" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <line x1="40" y1="100" x2="440" y2="100" stroke="url(#ueLine)" strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${60 + i * 90}, 100)`}>
          <circle r="10" fill="#1d4ed8" opacity={0.85} />
          <circle r="20" fill="none" stroke="#1d4ed8" strokeOpacity="0.25" />
        </g>
      ))}
      <text x="60" y="140" textAnchor="middle" className="fill-gray-600" fontSize="11">{labels.stewardA}</text>
      <text x="150" y="140" textAnchor="middle" className="fill-gray-600" fontSize="11">{labels.handoff}</text>
      <text x="240" y="140" textAnchor="middle" className="fill-gray-600" fontSize="11">{labels.stewardB}</text>
      <text x="330" y="140" textAnchor="middle" className="fill-gray-600" fontSize="11">{labels.handoff}</text>
      <text x="420" y="140" textAnchor="middle" className="fill-gray-600" fontSize="11">{labels.stewardC}</text>
      <text x="240" y="40" textAnchor="middle" className="fill-navy" fontSize="13" fontWeight="600">{labels.caption}</text>
    </svg>
  );
}

function FederationTopology({ labels }: { labels: FederationSvgLabels }) {
  return (
    <svg viewBox="0 0 480 280" className="w-full h-auto" role="img" aria-label={labels.ariaLabel}>
      <g stroke="#1d4ed8" strokeOpacity="0.4" strokeWidth="1.5" fill="none">
        <line x1="240" y1="60" x2="100" y2="180" />
        <line x1="240" y1="60" x2="240" y2="180" />
        <line x1="240" y1="60" x2="380" y2="180" />
        <line x1="100" y1="180" x2="60" y2="240" />
        <line x1="100" y1="180" x2="160" y2="240" />
        <line x1="240" y1="180" x2="200" y2="240" />
        <line x1="240" y1="180" x2="280" y2="240" />
        <line x1="380" y1="180" x2="320" y2="240" />
        <line x1="380" y1="180" x2="420" y2="240" />
      </g>
      <g fill="#0a2540">
        <circle cx="240" cy="60" r="22" />
      </g>
      <text x="240" y="64" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">{labels.federation}</text>
      <g fill="#1d4ed8">
        <circle cx="100" cy="180" r="16" />
        <circle cx="240" cy="180" r="16" />
        <circle cx="380" cy="180" r="16" />
      </g>
      <text x="100" y="183" textAnchor="middle" fill="#fff" fontSize="10">{labels.council}</text>
      <text x="240" y="183" textAnchor="middle" fill="#fff" fontSize="10">{labels.council}</text>
      <text x="380" y="183" textAnchor="middle" fill="#fff" fontSize="10">{labels.council}</text>
      <g fill="#60a5fa">
        {[60, 160, 200, 280, 320, 420].map((x) => (
          <circle key={x} cx={x} cy={240} r="10" />
        ))}
      </g>
    </svg>
  );
}

function EvidenceChain({ labels }: { labels: EvidenceSvgLabels }) {
  return (
    <svg viewBox="0 0 480 160" className="w-full h-auto" role="img" aria-label={labels.ariaLabel}>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${30 + i * 90}, 60)`}>
          <rect width="70" height="50" rx="8" fill="#fff" stroke="#1d4ed8" strokeWidth="1.5" />
          <text x="35" y="22" textAnchor="middle" fill="#0a2540" fontSize="10" fontWeight="600">{labels.evidence}</text>
          <text x="35" y="38" textAnchor="middle" fill="#475569" fontSize="9">{labels.stepPrefix} {i + 1}</text>
          {i < 4 && <path d="M70 25 L90 25" stroke="#1d4ed8" strokeWidth="1.5" markerEnd="url(#ueArrow)" />}
        </g>
      ))}
      <defs>
        <marker id="ueArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#1d4ed8" />
        </marker>
      </defs>
      <text x="240" y="140" textAnchor="middle" fill="#475569" fontSize="11">{labels.caption}</text>
    </svg>
  );
}

function CoexistenceOverlay({ labels }: { labels: CoexistenceSvgLabels }) {
  return (
    <svg viewBox="0 0 480 220" className="w-full h-auto" role="img" aria-label={labels.ariaLabel}>
      <g fontSize="11" fill="#475569">
        <rect x="40" y="140" width="120" height="50" rx="6" fill="#e2e8f0" stroke="#94a3b8" />
        <text x="100" y="170" textAnchor="middle">{labels.existingCrm}</text>
        <rect x="180" y="140" width="120" height="50" rx="6" fill="#e2e8f0" stroke="#94a3b8" />
        <text x="240" y="170" textAnchor="middle">{labels.existingCase}</text>
        <rect x="320" y="140" width="120" height="50" rx="6" fill="#e2e8f0" stroke="#94a3b8" />
        <text x="380" y="170" textAnchor="middle">{labels.existingRecords}</text>
      </g>
      <rect x="40" y="40" width="400" height="60" rx="10" fill="#0a2540" />
      <text x="240" y="68" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600">{labels.layerTitle}</text>
      <text x="240" y="86" textAnchor="middle" fill="#cbd5e1" fontSize="10">{labels.layerSubtitle}</text>
      <g stroke="#1d4ed8" strokeWidth="1.5" strokeDasharray="4 3" fill="none">
        <line x1="100" y1="100" x2="100" y2="140" />
        <line x1="240" y1="100" x2="240" y2="140" />
        <line x1="380" y1="100" x2="380" y2="140" />
      </g>
    </svg>
  );
}

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();

  if (userId) {
    redirect(`/${locale}/dashboard/priorities`);
  }

  const t = await getTranslations({ locale, namespace: 'homePage' });

  const continuityPillars = t.raw('continuity.pillars') as Array<{ title: string; desc: string }>;
  const proofPoints = t.raw('posture.points') as Array<{ metric: string; label: string; sub: string }>;
  const coexistencePoints = t.raw('coexistence.points') as string[];
  const labourSafeAiPrinciples = t.raw('labourSafeAi.principles') as string[];
  const canadianPillars = t.raw('canadian.pillars') as Array<{ title: string; desc: string }>;

  const continuitySvgLabels = t.raw('svg.continuity') as ContinuitySvgLabels;
  const federationSvgLabels = t.raw('svg.federation') as FederationSvgLabels;
  const evidenceSvgLabels = t.raw('svg.evidence') as EvidenceSvgLabels;
  const coexistenceSvgLabels = t.raw('svg.coexistence') as CoexistenceSvgLabels;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: t('jsonLd.name'),
    description: t('jsonLd.description'),
    url: 'https://unioneyes.ca',
    areaServed: 'CA',
  };

  return (
    <>
      <LocaleSiteNavigation />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen pt-16 md:pt-20">
        {/* HERO — Institutional Identity */}
        <section className="relative min-h-[82vh] flex items-center overflow-hidden -mt-16 md:-mt-20">
          <Image
            src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920"
            alt={t('hero.imageAlt')}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-linear-to-b from-navy/90 via-navy/85 to-navy/95" />
          <div className="absolute inset-0 bg-mesh opacity-60" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28">
            <ScrollReveal>
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white mb-6">
                {t('hero.eyebrow')}
              </span>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                {t('hero.headlineLine1')}<br />
                <span className="gradient-text">{t('hero.headlineLine2')}</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.16}>
              <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-3xl leading-relaxed">
                {t('hero.subhead')}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.24}>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/${locale}/pilot-request`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  {t('hero.ctaPrimary')}
                </Link>
                <Link
                  href={`/${locale}/institutional-continuity`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  {t('hero.ctaSecondary')}
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Posture strip */}
        <section className="py-10 bg-white border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-6">
              {t('posture.eyebrow')}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {proofPoints.map((item) => (
                <div key={item.metric} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-2xl font-extrabold text-electric mb-1">{item.metric}</div>
                  <div className="text-sm font-semibold text-navy mb-0.5">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 1 — Institutional Continuity */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-12 max-w-3xl mx-auto">
                <p className="text-xs font-semibold tracking-widest uppercase text-electric mb-3">{t('continuity.eyebrow')}</p>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4 leading-tight">
                  {t('continuity.heading')}
                </h2>
                <p className="text-lg text-gray-700">
                  {t('continuity.lede')}
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="mb-14 rounded-2xl bg-gray-50 border border-gray-100 p-6 md:p-10">
                <ContinuityTimeline labels={continuitySvgLabels} />
              </div>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-6">
              {continuityPillars.map((item) => (
                <ScrollReveal key={item.title}>
                  <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-navy mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2 — Federated Governance & Coordination */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <p className="text-xs font-semibold tracking-widest uppercase text-electric mb-3">{t('federation.eyebrow')}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-5 leading-tight">
                {t('federation.heading')}
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                {t('federation.body1')}
              </p>
              <p className="text-base text-gray-700 leading-relaxed">
                {t('federation.body2')}
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-10">
                <FederationTopology labels={federationSvgLabels} />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* SECTION 3 — Procedural Trust & Auditability */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-6 md:p-10">
                <EvidenceChain labels={evidenceSvgLabels} />
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-xs font-semibold tracking-widest uppercase text-electric mb-3">{t('procedural.eyebrow')}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-5 leading-tight">
                {t('procedural.heading')}
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                {t('procedural.body1')}
              </p>
              <p className="text-base text-gray-700 leading-relaxed">
                {t('procedural.body2')}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* SECTION 4 — Non-disruptive modernization */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-12 max-w-3xl mx-auto">
                <p className="text-xs font-semibold tracking-widest uppercase text-electric mb-3">{t('coexistence.eyebrow')}</p>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4 leading-tight">
                  {t('coexistence.heading')}
                </h2>
                <p className="text-lg text-gray-700">
                  {t('coexistence.lede')}
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="mb-12 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-10">
                <CoexistenceOverlay labels={coexistenceSvgLabels} />
              </div>
            </ScrollReveal>

            <ul className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {coexistencePoints.map((item) => (
                <li key={item} className="p-5 rounded-xl bg-white border border-gray-100 text-sm text-gray-700 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* SECTION 5 — Labour-safe AI */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-start">
            <ScrollReveal>
              <p className="text-xs font-semibold tracking-widest uppercase text-electric mb-3">{t('labourSafeAi.eyebrow')}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-5 leading-tight">
                {t('labourSafeAi.heading')}
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                {t('labourSafeAi.body1')}
              </p>
              <p className="text-base text-gray-700 leading-relaxed">
                {t('labourSafeAi.body2')}
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <ul className="space-y-3">
                {labourSafeAiPrinciples.map((item) => (
                  <li key={item} className="flex items-start gap-3 p-5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-electric mt-2 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </section>

        {/* SECTION 6 — Canadian institutional infrastructure */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-12 max-w-3xl mx-auto">
                <p className="text-xs font-semibold tracking-widest uppercase text-electric mb-3">{t('canadian.eyebrow')}</p>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4 leading-tight">
                  {t('canadian.heading')}
                </h2>
                <p className="text-lg text-gray-700">
                  {t('canadian.lede')}
                </p>
              </div>
            </ScrollReveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {canadianPillars.map((item) => (
                <ScrollReveal key={item.title}>
                  <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm h-full">
                    <h3 className="text-base font-bold text-navy mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 7 — Strategic Discovery */}
        <section className="py-20 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
                {t('finalCta.heading')}
              </h2>
              <p className="text-xl text-gray-100 mb-9">
                {t('finalCta.body')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={`/${locale}/pilot-request`}
                  className="inline-flex items-center justify-center px-10 py-5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  {t('finalCta.ctaPrimary')}
                </Link>
                <Link
                  href={`/${locale}/trust`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  {t('finalCta.ctaSecondary')}
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <LocaleSiteFooter />
    </>
  );
}
