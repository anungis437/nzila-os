/**
 * Locale-aware role-page content (server component).
 * Reads strings from `marketing.rolePages.{role}.*` so all 5 for-* pages
 * render correctly in every supported locale.
 *
 * Mirrors the structure of `app/(marketing)/components/role-page-content.tsx`
 * but is i18n-driven. Use this component from `app/[locale]/(marketing)/for-*` pages.
 */
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  Inbox, FileText, Scale, TrendingUp,
  BarChart3, AlertTriangle, Users, Target,
  Network, Building2, Shield,
  Globe, Megaphone, ClipboardList,
  Search, Upload, MessageSquare, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import ScrollReveal from '@/components/public/scroll-reveal';

export type RoleKey = 'representatives' | 'leadership' | 'federations' | 'clc' | 'members';

// Icon registry per role (icons cannot be serialized through translations).
const ROLE_ICONS: Record<RoleKey, LucideIcon[]> = {
  representatives: [Inbox, FileText, Scale, TrendingUp],
  leadership: [BarChart3, AlertTriangle, Users, Target],
  federations: [Network, Building2, BarChart3, Shield],
  clc: [Globe, Megaphone, TrendingUp, ClipboardList],
  members: [Search, Upload, MessageSquare, BookOpen],
};

export default async function LocaleRolePageContent({
  role,
  locale,
}: {
  role: RoleKey;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: `marketing.rolePages.${role}` });
  const tShared = await getTranslations({ locale, namespace: 'marketing.rolePages' });
  const icons = ROLE_ICONS[role];

  const dailyFlow = [1, 2, 3, 4].map((i) => ({
    Icon: icons[i - 1],
    step: t(`flow${i}Step`),
    detail: t(`flow${i}Detail`),
  }));

  const beforeAfter = [1, 2, 3, 4].map((i) => ({
    before: t(`ba${i}Before`),
    after: t(`ba${i}After`),
  }));

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-20 bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 mb-6">
              {t('badge')}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {t('headlineLine1')}<br />
              <span className="gradient-text">{t('headlineAccent')}</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">{t('subtitle')}</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Daily Flow */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl font-bold text-navy text-center mb-14">{t('flowTitle')}</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {dailyFlow.map(({ Icon, step, detail }) => (
              <ScrollReveal key={step}>
                <div className="text-center p-6 rounded-2xl border border-gray-100 hover:border-electric/30 transition-colors">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-electric" />
                  </div>
                  <h3 className="font-bold text-navy mb-2">{step}</h3>
                  <p className="text-sm text-gray-600">{detail}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl font-bold text-navy text-center mb-14">
              {tShared('beforeAfterHeading')}
            </h2>
          </ScrollReveal>
          <div className="space-y-6">
            {beforeAfter.map((row) => (
              <ScrollReveal key={row.before}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-white border border-gray-200">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{tShared('beforeLabel')}</span>
                    <p className="text-gray-600 mt-1 line-through decoration-gray-300">{row.before}</p>
                  </div>
                  <div className="p-5 rounded-xl bg-electric/5 border border-electric/20">
                    <span className="text-xs font-semibold text-electric uppercase tracking-wider">{tShared('afterLabel')}</span>
                    <p className="text-navy font-medium mt-1">{row.after}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-navy text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-3xl font-bold mb-4">{t('ctaHeadline')}</h2>
            <p className="text-lg text-white/80 mb-8">{t('ctaSubtitle')}</p>
            <Link
              href={`/${locale}/institutional-continuity-risk`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              {tShared('ctaPilot')} <ArrowRight className="w-5 h-5" />
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
