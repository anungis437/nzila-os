export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@nzila/platform-auth/entra/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import ScrollReveal from '@/components/public/scroll-reveal';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getUserRole } from '@/lib/auth/rbac-server';
import { getRoleLandingPath } from '@/lib/dashboard/role-experience';
import { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } from '@/lib/organization-utils';
import LocaleSiteNavigation from './(marketing)/locale-site-navigation';
import LocaleSiteFooter from './(marketing)/locale-site-footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.home' });

  return {
    title: `UnionEyes | ${t('badge')}`,
    description: t('heroDescription'),
    alternates: buildLocaleAlternates(locale),
  };
}

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();
  const t = await getTranslations({ locale, namespace: 'marketing.home' });

  if (userId) {
    let organizationId = DEFAULT_ORGANIZATION_ID;
    try {
      organizationId = await getOrganizationIdForUser(userId);
    } catch {
      // Fall back to the default org; the logged-in landing should still resolve.
    }

    const userRole = await getUserRole(userId, organizationId);

    redirect(`/${locale}${getRoleLandingPath(userRole)}`);
  }

  const outcomes = [
    { title: t('outcome1Title'), desc: t('outcome1Desc') },
    { title: t('outcome2Title'), desc: t('outcome2Desc') },
    { title: t('outcome3Title'), desc: t('outcome3Desc') },
    { title: t('outcome4Title'), desc: t('outcome4Desc') },
  ];

  const proofPoints = [
    { metric: '100%', label: t('pp1Label'), sub: t('pp1Sub') },
    { metric: '0', label: t('pp2Label'), sub: t('pp2Sub') },
    { metric: 'Canada', label: t('pp3Label'), sub: t('pp3Sub') },
    { metric: '24/7', label: t('pp4Label'), sub: t('pp4Sub') },
  ];

  const principles = [
    t('principle1'),
    t('principle2'),
    t('principle3'),
    t('principle4'),
  ];

  const translations = [
    { title: t('xlate1Title'), desc: t('xlate1Desc') },
    { title: t('xlate2Title'), desc: t('xlate2Desc') },
    { title: t('xlate3Title'), desc: t('xlate3Desc') },
    { title: t('xlate4Title'), desc: t('xlate4Desc') },
    { title: t('xlate5Title'), desc: t('xlate5Desc') },
  ];

  return (
    <>
      <LocaleSiteNavigation />

      <main className="min-h-screen pt-16 md:pt-20">
        <section className="relative min-h-[82vh] flex items-center overflow-hidden -mt-16 md:-mt-20">
          <Image
            src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920"
            alt=""
            aria-hidden="true"
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
                {t('badge')}
              </span>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
                {t('heroHeadingLine1')}<br />
                <span className="gradient-text">{t('heroHeadingLine2')}</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.16}>
              <p className="text-xl md:text-2xl text-white mb-10 max-w-3xl">
                {t('heroDescription')}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.24}>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/${locale}/organizational-continuity-risk`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  {t('ctaPrimary')}
                </Link>
                <Link
                  href={`/${locale}/solutions`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  {t('ctaSecondary')}
                </Link>
              </div>
              {/* Tertiary low-friction CTA — audit recommendation: give cold visitors a no-commitment entry point. */}
              <Link
                href={`/${locale}/whitepaper`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors"
              >
                {t('ctaTertiary')}
                <span aria-hidden="true">→</span>
              </Link>
            </ScrollReveal>
          </div>
        </section>

        <section className="py-10 bg-white border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-6">
              {t('proofSectionLabel')}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {proofPoints.map((item) => (
                <div key={item.metric} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-3xl font-extrabold text-electric mb-1">{item.metric}</div>
                  <div className="text-sm font-semibold text-navy mb-0.5">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Translation Layer — operational plain-language explainers for cold visitors.
          Sits between proof bar and outcomes so first-contact readers get a plain
          explanation of what UnionEyes does before encountering doctrine vocabulary. */}
        <section className="py-24 bg-gradient-to-b from-white to-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-12 max-w-3xl mx-auto">
                <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  {t('xlateBadge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                  {t('xlateHeading')}
                </h2>
                <p className="text-lg text-gray-700">
                  {t('xlateDescription')}
                </p>
              </div>
            </ScrollReveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {translations.map((item, idx) => (
                <ScrollReveal key={item.title} delay={0.05 * idx}>
                  <div className="h-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs font-bold tracking-widest uppercase text-electric mb-3">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <h3 className="text-lg font-bold text-navy mb-2 leading-tight">{item.title}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-12">                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                  {t('outcomesHeading')}
                </h2>
                <p className="text-lg text-gray-700 max-w-3xl mx-auto">
                  {t('outcomesDescription')}
                </p>
              </div>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-6">
              {outcomes.map((item) => (
                <ScrollReveal key={item.title}>
                  <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <h3 className="text-lg font-bold text-navy mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>                <h2 className="text-3xl md:text-4xl font-bold text-navy mb-5">
                  {t('govHeading')}
                </h2>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  {t('govDescription')}
                </p>
                <ul className="space-y-3">
                  {principles.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-electric mt-2" />
                      {item}
                    </li>
                  ))}
                </ul>
              </ScrollReveal>

              <ScrollReveal delay={0.1}>
                <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                  <Image
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800"
                    alt={t('govImageAlt')}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-navy/40 to-transparent" />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-20 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
                {t('finalCtaHeading')}
              </h2>
              <p className="text-xl text-gray-100 mb-9">
                {t('finalCtaDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={`/${locale}/organizational-continuity-risk`}
                  className="inline-flex items-center justify-center px-10 py-5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  {t('finalCtaPrimary')}
                </Link>
                <Link
                  href={`/${locale}/trust`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  {t('finalCtaSecondary')}
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
