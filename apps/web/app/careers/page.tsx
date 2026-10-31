import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import TrackedLink from '@/components/public/TrackedLink';
import ScrollReveal from '@/components/public/ScrollReveal';
import type { Locale } from '@/lib/locales';

export async function generateMetadata(): Promise<Metadata> {
  const isFr = (await getLocale()) === 'fr-CA';
  return {
    title: isFr ? 'Carrières' : 'Careers',
    description: isFr
      ? 'Comment nous travaillons chez Nzila Ventures, et comment nous dire que vous souhaitez contribuer.'
      : 'How we work at Nzila Ventures, and how to tell us you would like to contribute.',
    alternates: { canonical: '/careers' },
  };
}

const principles = {
  en: [
    { title: 'People hold final authority', detail: 'We build assistance that explains itself and leaves decisions with the people accountable for them.' },
    { title: 'Evidence over claims', detail: 'We label what is a concept, a pilot or available, and we would rather under-promise than imply maturity we have not earned.' },
    { title: 'Bilingual by default', detail: 'Public experiences are designed for English and French Canada from the start, not translated at the end.' },
    { title: 'Remote-first, accountable', detail: 'Our teams work across time zones, so decisions and context are written down where the next person can find them.' },
  ],
  fr: [
    { title: 'Les personnes gardent l’autorité finale', detail: 'Nous concevons une assistance qui s’explique et laisse les décisions aux personnes qui en répondent.' },
    { title: 'Des preuves plutôt que des promesses', detail: 'Nous indiquons ce qui est un concept, un pilote ou disponible, et préférons promettre moins que suggérer une maturité non acquise.' },
    { title: 'Bilingue dès le départ', detail: 'Les expériences publiques sont pensées pour le Canada anglais et français dès la conception, pas traduites à la fin.' },
    { title: 'Télétravail d’abord, responsabilité partagée', detail: 'Nos équipes travaillent dans plusieurs fuseaux horaires : décisions et contexte sont consignés là où la prochaine personne les trouvera.' },
  ],
} as const;

const helpful = {
  en: [
    'The kind of work you do best, and something you have built or improved that you are proud of',
    'Which problem draws you in: continuity, governance, labour organizations, public institutions or something adjacent',
    'Languages you work in, and the time zone you are in',
  ],
  fr: [
    'Le type de travail où vous excellez, et une réalisation dont vous êtes fier ou fière',
    'Le problème qui vous attire : continuité, gouvernance, organisations syndicales, institutions publiques ou autre',
    'Les langues dans lesquelles vous travaillez et votre fuseau horaire',
  ],
} as const;

export default async function CareersPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';
  const language = isFr ? 'fr' : 'en';

  return (
    <main className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-[#080e1c] pb-20 pt-36 text-white md:pb-24 md:pt-44">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-10%] h-[30rem] w-[30rem] rounded-full bg-electric/20 blur-[110px]" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            <span aria-hidden="true" className="h-px w-9 bg-[#dfbe70]" />
            {isFr ? 'Carrières' : 'Careers'}
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-[-0.035em] sm:text-5xl md:text-6xl">
            {isFr ? 'Aidez-nous à bâtir des logiciels qui gardent les personnes aux commandes.' : 'Help us build software that keeps people in control.'}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">
            {isFr
              ? 'Nous sommes une petite équipe qui travaille sur la continuité institutionnelle pour les organisations syndicales et les institutions publiques.'
              : 'We are a small team working on institutional continuity for labour organizations and public institutions.'}
          </p>
        </div>
      </section>

      <section className="py-20" aria-labelledby="careers-principles">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 id="careers-principles" className="text-3xl font-semibold tracking-tight text-navy md:text-4xl">
            {isFr ? 'Notre façon de travailler' : 'How we work'}
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {principles[language].map((item, index) => (
              <ScrollReveal key={item.title} delay={index * 0.05}>
                <article className="h-full rounded-3xl border border-slate-200 bg-slate-50 p-7">
                  <h3 className="text-lg font-semibold text-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.detail}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8fb] py-20" aria-labelledby="careers-roles">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <h2 id="careers-roles" className="text-3xl font-semibold tracking-tight text-navy md:text-4xl">
              {isFr ? 'Postes ouverts' : 'Open roles'}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              {isFr
                ? 'Aucun poste n’est affiché pour le moment. Si notre travail vous parle, écrivez-nous : nous lisons chaque message et vous répondrons lorsqu’un besoin correspond à votre profil.'
                : 'No roles are posted right now. If our work resonates, write to us. We read every message and will respond when a need matches your profile.'}
            </p>
            <TrackedLink
              href="/contact?interest=careers"
              eventName="careers_expression_of_interest"
              className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-[#193d7a] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#102b58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193d7a]"
            >
              {isFr ? 'Dites-nous comment vous aimeriez contribuer' : 'Tell us how you would like to contribute'}
              <span aria-hidden="true" className="ml-2">→</span>
            </TrackedLink>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-7">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-electric">
              {isFr ? 'Ce qui nous aide à vous répondre' : 'What helps us respond'}
            </h3>
            <ul className="mt-5 space-y-4">
              {helpful[language].map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#dfbe70]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
