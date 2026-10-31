import Link from 'next/link';
import { CheckBadgeIcon, ShieldCheckIcon, SignalIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ScrollReveal from './ScrollReveal';
import TrackedLink from './TrackedLink';
import { securityControls } from '@/lib/security-controls';

type LedgerRow = {
  name: string;
  stage: { en: string; fr: string };
  note: { en: string; fr: string };
  href: string;
  tone: 'live' | 'pilot' | 'discovery' | 'explore';
};

const ledger: readonly LedgerRow[] = [
  {
    name: 'nzilaventures.com',
    stage: { en: 'Live', fr: 'En ligne' },
    note: { en: 'This website. Public health checks are refreshed every 30 seconds.', fr: 'Ce site Web. Les vérifications publiques de santé sont actualisées toutes les 30 secondes.' },
    href: '/status',
    tone: 'live',
  },
  {
    name: 'Union Eyes',
    stage: { en: 'Pilot validation', fr: 'Validation pilote' },
    note: { en: 'Journeys and design scope. Not every capability is claimed to be in production.', fr: 'Parcours et portée de conception. Nous n’affirmons pas que chaque capacité est en production.' },
    href: '/union-eyes',
    tone: 'pilot',
  },
  {
    name: 'CIVIC',
    stage: { en: 'Briefings and discovery', fr: 'Présentations et découverte' },
    note: { en: 'Institutional briefings. No live institutional data is shown.', fr: 'Présentations institutionnelles. Aucune donnée institutionnelle réelle n’est montrée.' },
    href: '/public-service',
    tone: 'discovery',
  },
  {
    name: 'Other portfolio initiatives',
    stage: { en: 'Exploration', fr: 'Exploration' },
    note: { en: 'Sectors we are exploring. Not customer references or commercial availability.', fr: 'Secteurs que nous explorons. Ni références clients ni disponibilité commerciale.' },
    href: '/portfolio',
    tone: 'explore',
  },
];

const toneClass: Record<LedgerRow['tone'], string> = {
  live: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  pilot: 'border-[#dfbe70]/45 bg-[#dfbe70]/10 text-[#f2d694]',
  discovery: 'border-blue-300/40 bg-blue-300/10 text-blue-100',
  explore: 'border-white/25 bg-white/5 text-slate-200',
};

export default function ProofLedger({ isFr }: { isFr: boolean }) {
  const language = isFr ? 'fr' : 'en';
  const controlCount = securityControls.length;

  const verify = [
    {
      href: '/security',
      icon: ShieldCheckIcon,
      title: isFr ? `${controlCount} contrôles de sécurité publiés` : `${controlCount} published security controls`,
      detail: isFr ? 'Authentification, isolation, audit et chaîne d’approvisionnement, avec la marche à suivre pour signaler une vulnérabilité.' : 'Authentication, isolation, audit and supply chain, plus how to report a vulnerability.',
    },
    {
      href: '/status',
      icon: SignalIcon,
      title: isFr ? 'État en direct' : 'Live status',
      detail: isFr ? 'Un service non déployé n’est jamais présenté comme opérationnel.' : 'A service that is not deployed is never shown as operational.',
    },
    {
      href: '/trust',
      icon: CheckBadgeIcon,
      title: isFr ? 'Centre de confiance' : 'Trust Center',
      detail: isFr ? 'Engagements en matière d’anti-surveillance, de vie privée, de gouvernance et de souveraineté.' : 'Anti-surveillance, privacy, governance and sovereignty commitments.',
    },
    {
      href: '/case-studies',
      icon: DocumentMagnifyingGlassIcon,
      title: isFr ? 'Études de cas' : 'Case studies',
      detail: isFr ? 'Des preuves de pilotes, sans logos inventés.' : 'Pilot evidence, without invented logos.',
    },
  ];

  return (
    <section id="proof" aria-labelledby="proof-title" className="relative overflow-hidden bg-[#0b1324] py-20 text-white sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute left-[-12rem] top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-electric/15 blur-[110px]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dfbe70]">
          {isFr ? 'Des preuves à vérifier' : 'Evidence you can check'}
        </p>
        <h2 id="proof-title" className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
          {isFr ? 'Nous montrons ce qui est réel aujourd’hui, y compris ce qui ne l’est pas encore.' : 'We show what is real today, including what is not live yet.'}
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          {isFr
            ? 'Pas de logos empruntés ni de témoignages fabriqués. Chaque ligne ci-dessous mène à la page qui la justifie.'
            : 'No borrowed logos or manufactured testimonials. Every line below links to the page that backs it up.'}
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <ScrollReveal>
            <div className="h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  {isFr ? 'Registre de maturité' : 'Maturity ledger'}
                </h3>
              </div>
              <ul>
                {ledger.map((row) => (
                  <li key={row.name} className="border-b border-white/10 last:border-0">
                    <Link
                      href={row.href}
                      className="group flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#dfbe70] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-white">{row.name}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{row.note[language]}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center self-start rounded-full border px-3 py-1 text-xs font-semibold sm:self-center ${toneClass[row.tone]}`}>
                        {row.stage[language]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {verify.map((item, index) => (
              <ScrollReveal key={item.href} delay={index * 0.05}>
                <Link
                  href={item.href}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition-colors hover:border-white/25 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70]"
                >
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#dfbe70]">
                    <item.icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-slate-300">{item.detail}</span>
                  </span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5 rounded-3xl border border-[#dfbe70]/30 bg-[#dfbe70]/[0.08] p-7 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold text-white sm:text-2xl">
              {isFr ? 'Mettez-le à l’épreuve de votre réalité.' : 'Test it against your reality.'}
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              {isFr
                ? 'Les pilotes Union Eyes et les présentations CIVIC sont définis avec chaque organisation, avec un examen humain à chaque étape assistée par l’IA.'
                : 'Union Eyes pilots and CIVIC briefings are scoped with each organization, with human review at every AI-assisted step.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <TrackedLink
              href="/contact?interest=union-eyes"
              eventName="home_proof_union_eyes_pilot"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-5 py-3 text-sm font-bold text-[#101a2c] transition-colors hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isFr ? 'Discuter d’un pilote Union Eyes' : 'Discuss a Union Eyes pilot'}
            </TrackedLink>
            <TrackedLink
              href="/contact?interest=civic"
              eventName="home_proof_civic_briefing"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isFr ? 'Demander une présentation CIVIC' : 'Request a CIVIC briefing'}
            </TrackedLink>
          </div>
        </div>
      </div>
    </section>
  );
}
