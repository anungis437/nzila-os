'use client';

/**
 * LocaleSiteFooter — Locale-aware marketing footer for Union Eyes
 * Used inside app/[locale]/(marketing)/ where NextIntlClientProvider is active.
 */

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Linkedin, Twitter, Github, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

const NZILA_URL = process.env.NEXT_PUBLIC_NZILA_URL ?? 'https://nzilaventures.com';

const socials = [
  { name: 'LinkedIn',    href: 'https://linkedin.com/company/union-eyes', icon: Linkedin },
  { name: 'X (Twitter)', href: 'https://x.com/unioneyes',                  icon: Twitter  },
  { name: 'GitHub',      href: 'https://github.com/nzila-ventures',        icon: Github   },
  { name: 'Email',       href: 'mailto:hello@unioneyes.com',               icon: Mail     },
];



export default function LocaleSiteFooter() {
  const t  = useTranslations('marketing.footer');
  const params = useParams();
  const locale = (params?.locale as string) || 'en-CA';

  const footerLinks = {
    [t('platform')]: [
      { name: t('grievanceTracking'),  href: `/${locale}/features/grievance-tracking` },
      { name: t('memberPortal'),       href: `/${locale}/features/member-portal` },
      { name: t('aiWorkbench'),        href: `/${locale}/features/ai-workbench` },
      { name: t('analyticsReporting'), href: `/${locale}/features/analytics` },
      { name: t('pricing'),            href: `/${locale}/pricing` },
      { name: t('systemStatus'),       href: `/${locale}/trust#system-status` },
    ],
    [t('resources')]: [
      { name: t('caseStudies'),  href: `/${locale}/case-studies` },
      { name: t('story'),        href: `/${locale}/story` },
      { name: t('pilotProgram'), href: `/${locale}/pilot-request` },
      { name: t('contact'),      href: `/${locale}/contact` },
    ],
    [t('legal')]: [
      { name: t('privacy'),       href: `/${locale}/legal/privacy` },
      { name: t('terms'),         href: `/${locale}/legal/terms` },
      { name: t('security'),      href: `/${locale}/legal/security` },
      { name: t('accessibility'), href: `/${locale}/legal/accessibility` },
    ],
  };

  return (
    <footer className="bg-navy text-gray-200">
      {/* Pre-footer CTA */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left max-w-xl">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {t('tagline')}
            </h3>
            <p className="text-gray-200 text-lg">{t('description')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/25 btn-press text-sm"
            >
              {t('pilotRequest')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-sm btn-press"
            >
              {t('contact')}
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link href={`/${locale}`} className="flex items-center gap-3 group">
              <Image
                src="/images/brand/icon.png"
                alt="Union Eyes"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg shadow-lg shadow-electric/20 group-hover:shadow-electric/40 transition-shadow"
              />
              <span className="text-2xl font-bold text-white">Union Eyes</span>
            </Link>

            <p className="text-gray-200 max-w-sm leading-relaxed">{t('description')}</p>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald mr-1.5 animate-pulse" />
                {locale === 'fr-CA' ? 'Pilote actif' : 'Pilot Active'}
              </span>
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-gold/20 text-gold">
                {locale === 'fr-CA' ? 'Fait au Canada' : 'Canadian Made'}
              </span>
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-electric/20 text-electric-light">
                PIPEDA
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {socials.map((s) => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.name}
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-all">
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-5 text-xs tracking-[0.15em] uppercase">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-gray-300 hover:text-white transition-colors text-sm leading-relaxed">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Union Eyes. {t('rights')}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap justify-center">
            <a href={NZILA_URL} target="_blank" rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transition-colors font-medium">
              Nzila Ventures
            </a>
            <span className="text-gray-500">·</span>
            <Link href={`/${locale}/legal/privacy`} className="hover:text-gray-200 transition-colors">{t('privacy')}</Link>
            <span className="text-gray-500">·</span>
            <Link href={`/${locale}/legal/terms`} className="hover:text-gray-200 transition-colors">{t('terms')}</Link>
            <span className="text-gray-500">·</span>
            <Link href={`/${locale}/contact`} className="hover:text-gray-200 transition-colors">{t('contact')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
