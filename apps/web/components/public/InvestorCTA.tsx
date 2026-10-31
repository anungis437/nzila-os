'use client';

import { useLocale } from 'next-intl';
import ScrollReveal from './ScrollReveal';
import TrackedLink from './TrackedLink';
import type { Locale } from '@/lib/locales';

interface InvestorCTAProps {
  className?: string;
}

const investorCtaCopy: Record<Locale, {
  investorsBadge: string
  investorsTitle: string
  investorsBody: string
  investorsCta: string
  partnersBadge: string
  partnersTitle: string
  partnersBody: string
  partnersCta: string
}> = {
  'en-CA': {
    investorsBadge: 'For Institutions',
    investorsTitle: 'See where continuity needs attention',
    investorsBody: 'Explore how key-person dependencies, undocumented decisions and fragile handoffs can affect your organization.',
    investorsCta: 'Begin Assessment',
    partnersBadge: 'For Labor Organizations',
    partnersTitle: 'Union Eyes is the flagship validation path',
    partnersBody: 'Explore the proposed pilot journey for grievances, steward handoffs, governance evidence and member privacy.',
    partnersCta: 'Explore Union Eyes',
  },
  'fr-CA': {
    investorsBadge: 'Pour les institutions',
    investorsTitle: 'Repérez les risques de rupture de continuité',
    investorsBody: 'Explorez les risques liés aux dépendances individuelles, aux décisions peu documentées et aux transitions fragiles.',
    investorsCta: 'Commencer l évaluation',
    partnersBadge: 'Pour les organisations syndicales',
    partnersTitle: 'Union Eyes est le chemin de validation principal',
    partnersBody: 'Explorez un parcours pilote proposé pour les griefs, les transferts entre délégués, les preuves et la confidentialité des membres.',
    partnersCta: 'Explorer Union Eyes',
  },
};

export default function InvestorCTA({ className = '' }: InvestorCTAProps) {
  const locale = useLocale() as Locale;
  const copy = investorCtaCopy[locale] ?? investorCtaCopy['en-CA'];

  return (
    <section className={`relative overflow-hidden py-24 ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#0e1a2d]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-40 h-[34rem] w-[34rem] rounded-full bg-electric/25 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 left-[-8rem] h-[30rem] w-[30rem] rounded-full bg-violet/20 blur-[110px]" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <ScrollReveal direction="left">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-4">
              {copy.investorsBadge}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {copy.investorsTitle}
            </h2>
            <p className="text-gray-300 mb-6">
              {copy.investorsBody}
            </p>
            <TrackedLink
              href="/continuity-assessment"
              eventName="cta_continuity_assessment"
              eventProps={{ source: 'investor_cta' }}
              className="inline-flex items-center px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition-colors text-lg"
            >
              {copy.investorsCta}
            </TrackedLink>
          </ScrollReveal>

          <ScrollReveal direction="right">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-4">
              {copy.partnersBadge}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {copy.partnersTitle}
            </h2>
            <p className="text-gray-300 mb-6">
              {copy.partnersBody}
            </p>
            <TrackedLink
              href="/union-eyes"
              eventName="cta_union_eyes"
              eventProps={{ source: 'investor_cta' }}
              className="inline-flex items-center px-8 py-4 bg-white text-navy font-bold rounded-xl hover:bg-gray-100 transition-colors text-lg"
            >
              {copy.partnersCta}
            </TrackedLink>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}





