'use client';

import Image from 'next/image';
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
    investorsTitle: 'Assess continuity risk before transition exposes it',
    investorsBody: 'Use the Institutional Continuity Risk Assessment to identify governance fragility, operational memory loss, trust debt, and sovereignty exposure.',
    investorsCta: 'Begin Assessment',
    partnersBadge: 'For Labor Organizations',
    partnersTitle: 'Union Eyes is the flagship validation path',
    partnersBody: 'Pilot continuity infrastructure for grievance history, steward handoffs, governance evidence, and anti-surveillance accountability.',
    partnersCta: 'Explore Union Eyes',
  },
  'fr-CA': {
    investorsBadge: 'Pour les institutions',
    investorsTitle: 'Évaluez le risque de continuité avant qu une transition ne l expose',
    investorsBody: 'L évaluation de continuité institutionnelle identifie fragilité de gouvernance, perte de mémoire opérationnelle, dette de confiance et exposition de souveraineté.',
    investorsCta: 'Commencer l évaluation',
    partnersBadge: 'Pour les organisations syndicales',
    partnersTitle: 'Union Eyes est le chemin de validation principal',
    partnersBody: 'Pilotez une infrastructure de continuité pour les griefs, les transitions de délégués, les preuves de gouvernance et l accountability anti-surveillance.',
    partnersCta: 'Explorer Union Eyes',
  },
};

export default function InvestorCTA({ className = '' }: InvestorCTAProps) {
  const locale = useLocale() as Locale;
  const copy = investorCtaCopy[locale] ?? investorCtaCopy['en-CA'];

  return (
    <section className={`relative overflow-hidden py-24 ${className}`}>
      <Image
        src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920"
        alt="Earth at night showing interconnected cities — Nzila Ventures global AI infrastructure"
        fill
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-linear-to-r from-navy/95 via-navy/85 to-electric/60" />
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





