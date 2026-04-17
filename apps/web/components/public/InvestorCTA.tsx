'use client';

import Image from 'next/image';
import { useLocale } from 'next-intl';
import ScrollReveal from './ScrollReveal';
import TrackedLink from './TrackedLink';
import { MARKETING_FACTS } from '@/lib/marketing-facts';
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
    investorsBadge: 'For Investors',
    investorsTitle: 'Series A - Join the Future of AI Infrastructure',
    investorsBody: `${MARKETING_FACTS.totalTamLabel} TAM. ${MARKETING_FACTS.productPlatforms} platforms. ${MARKETING_FACTS.flagshipPlatforms} flagships. One unified Backbone.`,
    investorsCta: 'View Investment Thesis',
    partnersBadge: 'For Partners',
    partnersTitle: 'Build With the APEX of AI',
    partnersBody: 'Deploy ethical AI solutions across healthcare, finance, agriculture, and beyond.',
    partnersCta: 'Partner With Us',
  },
  'fr-CA': {
    investorsBadge: 'Pour les investisseurs',
    investorsTitle: "Série A - Rejoignez le futur de l'infrastructure IA",
    investorsBody: `${MARKETING_FACTS.totalTamLabel} TAM. ${MARKETING_FACTS.productPlatforms} plateformes. ${MARKETING_FACTS.flagshipPlatforms} produits phares. Une seule Backbone unifiee.`,
    investorsCta: "Voir la thèse d'investissement",
    partnersBadge: 'Pour les partenaires',
    partnersTitle: 'Construisez avec l APEX de l IA',
    partnersBody: 'Deployez des solutions IA éthiques en sante, finance, agriculture et plus encore.',
    partnersCta: 'Devenir partenaire',
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
              href="/investors"
              eventName="cta_investor_thesis"
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
              href="/contact"
              eventName="cta_partner_contact"
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








