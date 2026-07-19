'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import TrackedLink from './TrackedLink';
import { MARKETING_FACTS, platformCoverageLabel } from '@/lib/marketing-facts';
import type { Locale } from '@/lib/locales';

const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001';
const UNION_EYES_URL = process.env.NEXT_PUBLIC_UNION_EYES_URL ?? 'http://localhost:3003';

const appLinks = [
  { name: 'Console', href: CONSOLE_URL, external: true },
  { name: 'Union Eyes', href: UNION_EYES_URL, external: true },
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
    blurb: 'Nzila Ventures builds organizational continuity infrastructure across {platformCoverage}.',
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
    blurb: "Nzila Ventures construit une infrastructure de continuité organisationnelle dans {platformCoverage}.",
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
  const platformCoverage = locale === 'fr-CA'
    ? `plus de ${MARKETING_FACTS.verticalsLabel.replace('+', '')} secteurs sensibles a la confiance`
    : platformCoverageLabel();
  const blurb = copy.blurb.replace('{platformCoverage}', platformCoverage);

  return (
    <footer className="bg-navy text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center">
                <span className="text-white font-bold text-sm">NV</span>
              </div>
              <span className="text-2xl font-bold text-white">Nzila Ventures</span>
            </div>
            <p className="text-gray-400 mb-6 max-w-sm">
              {blurb}
            </p>
            <div className="flex items-center gap-3">
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-gold/20 text-gold">
                {copy.seriesA}
              </span>
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
                Union Eyes Flagship
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
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Apps Column */}
          <div>
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
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Nzila Ventures. {copy.copyright}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="hidden lg:inline text-gray-600">
              {MARKETING_FACTS.governedApplications} {copy.governedAppsLabel}
            </span>
            <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">{copy.privacy}</Link>
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






