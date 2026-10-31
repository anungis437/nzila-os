import Link from 'next/link';

type Audience = 'home' | 'union' | 'civic';
type Props = { isFr: boolean; audience?: Audience };

const copy = {
  en: {
    eyebrow: 'Our approach to responsible AI',
    title: 'Technology should strengthen human judgment. Not replace it.',
    description: 'The most useful intelligence helps people see the context, understand their options, and remain accountable for the outcome. That is the direction shaping Nzila’s product design.',
    bridge: 'From information to accountable action',
    steps: [
      { number: '01', name: 'Understand the context', detail: 'Preserve the relevant history, people, decisions and limits of the available evidence.' },
      { number: '02', name: 'Make assistance explainable', detail: 'Recommendations should reveal their basis, uncertainty and paths for correction.' },
      { number: '03', name: 'Keep people in authority', detail: 'Authorized humans assess, decide, and retain the ability to question or override.' },
    ],
    promise: 'Human authority is a design requirement — not an optional setting.',
    note: 'These are product design principles, not a certification or a claim that every proposed AI capability is live.',
    more: 'Read our governance commitments',
    context: {
      home: 'Institutions deserve technology that remembers without watching people.',
      union: 'Members and representatives deserve assistance without profiling or productivity surveillance.',
      civic: 'Public institutions must retain legitimate human decision-making and review.',
    },
  },
  fr: {
    eyebrow: 'Notre approche de l’IA responsable',
    title: 'La technologie doit renforcer le jugement humain. Pas le remplacer.',
    description: 'Une intelligence utile aide les personnes à comprendre le contexte, à examiner les options et à demeurer responsables des résultats. Cette conviction guide la conception des produits Nzila.',
    bridge: 'De l’information à l’action responsable',
    steps: [
      { number: '01', name: 'Comprendre le contexte', detail: 'Préserver les faits, les personnes, les décisions et les limites des preuves disponibles.' },
      { number: '02', name: 'Expliquer l’assistance', detail: 'Montrer les fondements, les incertitudes et les moyens de corriger les recommandations.' },
      { number: '03', name: 'Garder l’autorité humaine', detail: 'Permettre aux personnes autorisées d’examiner, de décider, de contester et de réviser.' },
    ],
    promise: 'L’autorité humaine est une exigence de conception, pas un réglage facultatif.',
    note: 'Il s’agit de principes de conception, et non d’une certification ou d’une affirmation que toutes les fonctions d’IA envisagées sont en service.',
    more: 'Lire nos engagements de gouvernance',
    context: {
      home: 'Les institutions méritent une technologie qui conserve le savoir sans surveiller les personnes.',
      union: 'Les membres et les représentants méritent une assistance sans profilage ni surveillance du rendement.',
      civic: 'Les institutions publiques doivent conserver le pouvoir légitime de décider et de réviser.',
    },
  },
} as const;

export default function HumanCenteredAI({ isFr, audience = 'home' }: Props) {
  const c = copy[isFr ? 'fr' : 'en'];

  return (
    <section aria-labelledby={`human-centered-ai-${audience}`} className="relative isolate overflow-hidden bg-[#f5f7fa] py-20 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute right-[-12rem] top-[-14rem] h-[30rem] w-[30rem] rounded-full bg-[#dfbe70]/10 blur-[100px]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-20 lg:px-8">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#365b9d]">{c.eyebrow}</p>
          <h2 id={`human-centered-ai-${audience}`} className="mt-5 text-3xl font-semibold leading-[1.15] tracking-[-0.035em] text-[#101a2c] sm:text-4xl lg:text-5xl">
            {c.title}
          </h2>
          <p className="mt-6 text-base leading-8 text-slate-600">{c.description}</p>
          <div className="mt-8 rounded-2xl border-l-4 border-[#bf9945] bg-white px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold leading-7 text-[#18263c]">{c.context[audience]}</p>
          </div>
          <Link href="/doctrine" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#234e94] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#234e94]">
            {c.more} <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-[#ccd6e4] bg-white shadow-[0_22px_75px_-40px_rgba(12,27,58,0.38)]">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-[#101a2c] px-5 py-5 text-white sm:px-7">
            <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfbe70]/40 bg-[#dfbe70]/10">
              <svg viewBox="0 0 32 32" width="24" height="24" fill="none" aria-hidden="true">
                <circle cx="16" cy="8" r="4" stroke="#dfbe70" strokeWidth="2" />
                <path d="M6 27v-4a10 10 0 0 1 20 0v4" stroke="#dfbe70" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold tracking-tight sm:text-base">{c.bridge}</p>
          </div>
          <ol className="relative space-y-0 p-5 sm:p-7">
            {c.steps.map((step, i) => (
              <li key={step.number} className="relative flex gap-4 pb-7 last:pb-0 sm:gap-5">
                {i !== c.steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[1.21rem] top-11 w-px bg-[#b9c9de]" />}
                <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${i === c.steps.length - 1 ? 'border-[#c9a659] bg-[#f6edd7] text-[#654c1c]' : 'border-[#cfdaea] bg-[#eff4fc] text-[#365b9d]'}`}>
                  {step.number}
                </span>
                <div className="min-w-0 pt-1">
                  <h3 className="text-base font-semibold text-[#101a2c]">{step.name}</h3>
                  <p className="mt-1.5 text-sm leading-7 text-slate-600">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mx-5 mb-5 rounded-xl bg-[#f5f7fa] px-4 py-4 sm:mx-7 sm:mb-7">
            <p className="text-sm font-semibold leading-6 text-[#101a2c]">{c.promise}</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">{c.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
