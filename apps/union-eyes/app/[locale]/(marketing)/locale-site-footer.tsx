'use client';

/**
 * LocaleSiteFooter — Locale-aware marketing footer for UnionEyes
 * Used inside app/[locale]/(marketing)/ where NextIntlClientProvider is active.
 */

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Linkedin, Instagram, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

const NZILA_URL = process.env.NEXT_PUBLIC_NZILA_URL ?? 'https://nzilaventures.com';

const socials = [
  { name: 'LinkedIn',    href: 'https://linkedin.com/company/unioneyes-nzilaventures/', icon: Linkedin },
  { name: 'Instagram',   href: 'https://www.instagram.com/unioneyes.nzila?igsh=MTlldGdhMWs0dzJnYQ%3D%3D', icon: Instagram },
  { name: 'Email',       href: 'mailto:hello@unioneyes.app',               icon: Mail     },
];

const FOOTER_COPY: Record<string, {
  pilotBadge: string;
  canadaBadge: string;
}> = {
  'en-CA': { pilotBadge: 'Founding Partner Program',     canadaBadge: 'Canadian Made'   },
  en:      { pilotBadge: 'Founding Partner Program',     canadaBadge: 'Canadian Made'   },
  'fr-CA': { pilotBadge: 'Programme partenaires fondateurs', canadaBadge: 'Fait au Canada' },
  fr:      { pilotBadge: 'Programme partenaires fondateurs', canadaBadge: 'Fait au Canada' },
  it:      { pilotBadge: 'Programma partner fondatori',  canadaBadge: 'Creato in Canada' },
  pt:      { pilotBadge: 'Programa Parceiros Fundadores', canadaBadge: 'Feito no Canadá' },
};



export default function LocaleSiteFooter() {
  const t  = useTranslations('marketing.footer');
  const tNav = useTranslations('marketing.nav.platformItems');
  const params = useParams();
  const locale = (params?.locale as string) || 'en-CA';
  const copy = FOOTER_COPY[locale] ?? FOOTER_COPY['en-CA'];
  const whitepaperLabel = locale === 'fr-CA' ? 'Livre blanc' : 'Whitepaper';

  const footerLinks = {
    [t('platform') as string]: [
      { name: tNav('inbox.name'),        href: `/${locale}/platform#inbox` },
      { name: tNav('work.name'),         href: `/${locale}/platform#work` },
      { name: tNav('priorities.name'),   href: `/${locale}/platform#priorities` },
      { name: tNav('intelligence.name'), href: `/${locale}/platform#intelligence` },
      { name: tNav('cognition.name'),    href: `/${locale}/platform#cognition` },
      { name: tNav('governance.name'),   href: `/${locale}/platform#governance` },
      { name: tNav('memory.name'),       href: `/${locale}/platform#institutional-memory` },
      { name: tNav('trust.name'),        href: `/${locale}/platform#trust` },
    ],
    [t('solutions') as string]: [
      { name: t('executiveLeadership'),   href: `/${locale}/solutions/executive-leadership` },
      { name: t('governanceLeadership'),  href: `/${locale}/solutions/governance-leadership` },
      { name: t('operationsLeadership'),  href: `/${locale}/solutions/operations-leadership` },
      { name: t('technologyLeadership'),  href: `/${locale}/solutions/technology-leadership` },
      { name: t('policyAndLabour'),       href: `/${locale}/solutions/labour-leadership` },
      { name: t('procurement'),           href: `/${locale}/solutions/procurement` },
    ],
    [t('trustAndStewardship') as string]: [
      { name: t('trustCenter'),               href: `/${locale}/trust` },
      { name: t('stewardshipAppendix'),       href: `/${locale}/trust/stewardship-appendix` },
      { name: t('labourSafeAi'),              href: `/${locale}/trust#labour-safe` },
      { name: t('explainabilityStandards'),   href: `/${locale}/trust#explainability` },
    ],
    [t('company') as string]: [
      { name: t('story'),        href: `/${locale}/story` },
      { name: t('insights'),     href: `/${locale}/insights` },
      { name: whitepaperLabel,   href: `/${locale}/whitepaper` },
      { name: t('institutionalProof'), href: `/${locale}/proof` },
      // Case studies hidden until pilots complete — re-enable via CASE_STUDIES_VISIBLE flag.
      // { name: t('caseStudies'),  href: `/${locale}/case-studies` },
      { name: t('pricing'),      href: `/${locale}/pricing` },
      { name: t('contact'),      href: `/${locale}/contact` },
      { name: t('systemStatus'), href: `/${locale}/trust#system-status` },
    ],
    [t('legal') as string]: [
      { name: t('privacy'),       href: `/${locale}/legal/privacy` },
      { name: t('terms'),         href: `/${locale}/legal/terms` },
      { name: t('security'),      href: `/${locale}/legal/security` },
      { name: t('accessibility'), href: `/${locale}/legal/accessibility` },
    ],
  };

  return (
    <footer className="bg-navy text-gray-200">
      {/* Pre-footer CTA removed — each page now owns its single closing CTA. Duplicate site-wide layer was creating dual-CTA stacking. */}

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link href={`/${locale}`} className="flex items-center gap-3 group">
              <Image
                src="/images/brand/icon.png"
                alt="UnionEyes"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-2xl font-bold text-white">UnionEyes</span>
            </Link>

            <p className="text-gray-200 max-w-sm leading-relaxed">{t('description')}</p>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald mr-1.5 animate-pulse" />
                {copy.pilotBadge}
              </span>
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-gold/20 text-gold">
                {copy.canadaBadge}
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
            &copy; {new Date().getFullYear()} UnionEyes. {t('rights')}
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
            <Link href={`/${locale}/trust/stewardship-appendix`} className="hover:text-gray-200 transition-colors">{t('corporateStewardship')}</Link>
            <span className="text-gray-500">·</span>
            <Link href={`/${locale}/contact`} className="hover:text-gray-200 transition-colors">{t('contact')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
