'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import TrackedLink from './TrackedLink';
import type { Locale } from '@/lib/locales';

const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL;
const UNION_EYES_URL = process.env.NEXT_PUBLIC_UNION_EYES_URL;

// Never send a production visitor to a localhost or unconfigured environment.
const appLinks = [
  ...(CONSOLE_URL && /^https:\/\//.test(CONSOLE_URL) ? [{ name: 'Console', href: CONSOLE_URL }] : []),
  ...(UNION_EYES_URL && /^https:\/\//.test(UNION_EYES_URL) ? [{ name: 'Union Eyes', href: UNION_EYES_URL }] : []),
];

const footerCopy: Record<Locale, {
  columns: Array<{ category: string; links: Array<{ name: string; href: string }> }>
  blurb: string
  seriesA: string
  appsLabel: string
  copyright: string
  platformsLabel: string
  governedAppsLabel: string
  privacy: string
  terms: string
  ipGovernance: string
}> = {
  'en-CA': {
    columns: [
      {
        category: 'Platform',
        links: [
          { name: 'Organizational Continuity', href: '/organizational-continuity' },
          { name: 'Public Service (CIVIC)', href: '/public-service' },
          { name: 'Union Eyes', href: '/union-eyes' },
          { name: 'Platform', href: '/platform' },
          { name: 'Trust Center', href: '/trust' },
          { name: 'Contact', href: '/contact' },
        ],
      },
      {
        category: 'Doctrine',
        links: [
          { name: 'Continuity Assessment', href: '/continuity-assessment' },
          { name: 'Anti-Surveillance', href: '/anti-surveillance' },
          { name: 'Starter Kit', href: '/starter-kit' },
          { name: 'Insights', href: '/insights' },
        ],
      },
      {
        category: 'Company',
        links: [
          { name: 'About Us', href: '/about' },
          { name: 'Products', href: '/products' },
          { name: 'Portfolio', href: '/portfolio' },
          { name: 'Investors', href: '/investors' },
        ],
      },
      {
        category: 'Legal',
        links: [
          { name: 'Privacy Policy', href: '/legal/privacy' },
          { name: 'Terms of Service', href: '/legal/terms' },
          { name: 'IP Governance', href: '/legal/ip-governance' },
        ],
      },
    ],
    blurb: 'Nzila Ventures builds software to preserve institutional knowledge, connected decisions and accountable operations through change.',
    seriesA: 'Continuity Infrastructure',
    appsLabel: 'Apps',
    copyright: 'All rights reserved.',
    platformsLabel: 'platforms',
    governedAppsLabel: 'governed apps',
    privacy: 'Privacy',
    terms: 'Terms',
    ipGovernance: 'IP Governance',
  },
  'fr-CA': {
    columns: [
      {
        category: 'Plateforme',
        links: [
          { name: 'Continuité organisationnelle', href: '/organizational-continuity' },
          { name: 'Service public (CIVIC)', href: '/public-service' },
          { name: 'Union Eyes', href: '/union-eyes' },
          { name: 'Plateforme', href: '/platform' },
          { name: 'Centre de confiance', href: '/trust' },
          { name: 'Contact', href: '/contact' },
        ],
      },
      {
        category: 'Doctrine',
        links: [
          { name: 'Évaluation continuité', href: '/continuity-assessment' },
          { name: 'Anti-surveillance', href: '/anti-surveillance' },
          { name: 'Kit de démarrage', href: '/starter-kit' },
          { name: 'Analyses', href: '/insights' },
        ],
      },
      {
        category: 'Entreprise',
        links: [
          { name: 'À propos', href: '/about' },
          { name: 'Produits', href: '/products' },
          { name: 'Portefeuille', href: '/portfolio' },
          { name: 'Investisseurs', href: '/investors' },
        ],
      },
      {
        category: 'Juridique',
        links: [
          { name: 'Politique de confidentialité', href: '/legal/privacy' },
          { name: "Conditions d'utilisation", href: '/legal/terms' },
          { name: 'Gouvernance PI', href: '/legal/ip-governance' },
        ],
      },
    ],
    blurb: 'Nzila Ventures conçoit des logiciels pour préserver le savoir institutionnel, relier les décisions et soutenir des opérations responsables pendant les transitions.',
    seriesA: 'Infrastructure de continuité',
    appsLabel: 'Applications',
    copyright: 'Tous droits réservés.',
    platformsLabel: 'plateformes',
    governedAppsLabel: 'applications gouvernées',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    ipGovernance: 'Gouvernance PI',
  },
};

export default function Footer() {
  const locale = useLocale() as Locale;
  const copy = footerCopy[locale] ?? footerCopy['en-CA'];

  return (
    <footer className="bg-[#080e1c] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-7 lg:gap-x-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfbe70]/35 bg-[#18335d]">
                <span className="text-[#dfbe70] font-bold text-sm">NV</span>
              </div>
              <span className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Nzila Ventures</span>
            </div>
            <p className="text-gray-400 mb-6 max-w-sm">
              {copy.blurb}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-[#dfbe70]/25 bg-[#dfbe70]/10 px-3 py-1.5 text-xs font-semibold text-[#dfbe70]">
                {copy.seriesA}
              </span>
              <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                {locale === 'fr-CA' ? 'Union Eyes · Produit phare' : 'Union Eyes · Flagship'}
              </span>
            </div>
          </div>

          {/* Link Columns */}
          {copy.columns.map((column) => (
            <div key={column.category}>
              <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">
                {column.category}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-9 items-center rounded-sm text-sm text-slate-300 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70]"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Configured application destinations only */}
          {appLinks.length > 0 && <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">{copy.appsLabel}</h4>
            <ul className="space-y-3">
              {appLinks.map((link) => (
                <li key={link.name}>
                  <TrackedLink
                    href={link.href}
                    eventName="app_switch"
                    eventProps={{ app: link.name, source: 'footer' }}
                    external
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors text-sm inline-flex items-center gap-1"
                  >
                    {link.name}
                    <span className="text-gray-600 text-xs">↗</span>
                  </TrackedLink>
                </li>
              ))}
            </ul>
          </div>}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Nzila Ventures. {copy.copyright}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400 sm:gap-4">
            <Link href="/legal/privacy" className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70]">{copy.privacy}</Link>
            <span>·</span>
            <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">{copy.terms}</Link>
            <span>·</span>
            <Link href="/legal/ip-governance" className="hover:text-gray-300 transition-colors">{copy.ipGovernance}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}






