'use client';

import { useLocale } from 'next-intl';
import ScrollReveal from './ScrollReveal';
import TrackedLink from './TrackedLink';
import type { Locale } from '@/lib/locales';

interface InvestorCTAProps {
  className?: string;
}

const copy: Record<Locale, {
  eyebrow: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  note: string;
}> = {
  'en-CA': {
    eyebrow: 'Let’s begin with people',
    title: 'Better systems begin with better conversations.',
    body: 'Tell us what your organization is trying to achieve, where context gets lost, and what responsible technology could meaningfully improve. We’ll start by listening.',
    primary: 'Start a conversation',
    secondary: 'Our commitments',
    note: 'Exploring a Union Eyes pilot or a CIVIC briefing? Tell us in your inquiry.',
  },
  'fr-CA': {
    eyebrow: 'Commençons par les personnes',
    title: 'De meilleurs systèmes commencent par de meilleures conversations.',
    body: 'Parlez-nous de vos objectifs, des situations où le contexte se perd et de ce que la technologie pourrait améliorer de manière responsable. Nous commencerons par vous écouter.',
    primary: 'Entamer une conversation',
    secondary: 'Nos engagements',
    note: 'Vous souhaitez explorer un pilote Union Eyes ou une présentation CIVIC? Précisez-le dans votre demande.',
  },
};

export default function InvestorCTA({ className = '' }: InvestorCTAProps) {
  const locale = useLocale() as Locale;
  const c = copy[locale] ?? copy['en-CA'];

  return (
    <section className={`relative isolate overflow-hidden bg-[#080e1c] py-20 text-white sm:py-28 ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-blue-500/20 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-60 -left-40 h-[30rem] w-[30rem] rounded-full bg-[#dfbe70]/10 blur-[110px]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.7fr] lg:gap-16 lg:px-8">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dfbe70]">{c.eyebrow}</p>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">{c.title}</h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{c.body}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TrackedLink
              href="/contact"
              eventName="cta_human_conversation"
              eventProps={{ source: 'public_home_final' }}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-[#101a2c] transition-colors hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {c.primary} <span aria-hidden="true" className="ml-2">↗</span>
            </TrackedLink>
            <TrackedLink
              href="/doctrine"
              eventName="cta_governance_doctrine"
              eventProps={{ source: 'public_home_final' }}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {c.secondary}
            </TrackedLink>
          </div>
        </ScrollReveal>

        <div className="rounded-3xl border border-white/15 bg-white/[0.045] p-6 sm:p-8">
          <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#dfbe70]/30 bg-[#dfbe70]/10">
            <svg viewBox="0 0 44 44" fill="none" width="35" height="35">
              <circle cx="16" cy="13" r="6" stroke="#dfbe70" strokeWidth="2" />
              <path d="M4 35v-3a12 12 0 0 1 24 0v3" stroke="#dfbe70" strokeWidth="2" strokeLinecap="round"/>
              <path d="M31 14h8M35 10v8M31 26h8" stroke="#9ebbe4" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="mt-6 text-lg font-medium leading-8 text-white">{c.note}</p>
          <p className="mt-5 border-t border-white/10 pt-5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            Union Eyes <span aria-hidden="true" className="mx-2 text-[#dfbe70]">·</span> CIVIC <span aria-hidden="true" className="mx-2 text-[#dfbe70]">·</span> Nzila OS
          </p>
        </div>
      </div>
    </section>
  );
}
