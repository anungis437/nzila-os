import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import AnimatedCounter from '@/components/public/AnimatedCounter';
import SectionHeading from '@/components/public/SectionHeading';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'About Us — Nzila Ventures',
  description: 'Nzila Ventures is the operating company behind Nzila OS, building institutional continuity infrastructure for trust-sensitive organizations.',
  openGraph: {
    title: 'About Nzila Ventures',
    description: 'The operating company behind Nzila OS, Union Eyes, and governed continuity product lines.',
    images: [{ url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Nzila Ventures — Technology with soul' }],
  },
  alternates: { canonical: '/about' },
};

const values = [
  {
    title: 'Intelligence with Memory',
    color: 'from-electric to-violet',
    description:
      'AI that earns trust through comprehension, not just automation. Our systems learn and remember in service of care, learning, and decision-making.',
  },
  {
    title: 'Consent by Design',
    color: 'from-gold to-gold-light',
    description:
      'Privacy is not a patch — it\'s a foundation. Users control their data, their story, and how systems remember them.',
  },
  {
    title: 'Generational Span',
    color: 'from-violet to-coral',
    description:
      'We design for both the dementia patient and the child discovering how to think. Our ventures span the full arc of life.',
  },
  {
    title: 'Multilingual Equity',
    color: 'from-emerald to-cyan-400',
    description:
      'Care doesn\'t pause for language. Built for Canada\'s clinics and for those without Wi-Fi. Prompts speak to volunteers, elders, and the forgotten.',
  },
  {
    title: 'Shared Ethical Core',
    color: 'from-emerald to-electric',
    description:
      'Every venture draws from one foundation: CareAI systems, consent architecture, transparency layers, and studio-aligned orchestration.',
  },
];

const timeline = [
  { year: '2025', title: 'Nzila is Born', description: 'From the Kikongo concept of Nzila — "path" — we consolidate into a studio model. Eight ventures unified. One ethical core. A new name. A chosen way forward.' },
  { year: '2025–2026', title: 'Walking the Path', description: 'Union Eyes, Zonga, Flow, FAIRCASE, and more. Each platform speaks with the others. Each voice carries memory, consent, and governance for builders and communities across all sectors.' },
  { year: '2025+', title: 'Generational Impact', description: 'From Canada to Global Impact — our dream: an ecosystem where technology remembers who we are and helps us become who we\'re meant to be. Not just an app. A new operating system for dignity.' },
];

const valuesFr: Record<string, { title: string; description: string }> = {
  'Intelligence with Memory': {
    title: 'L\'intelligence avec mémoire',
    description: 'L\'IA gagne la confiance par la compréhension, pas seulement par l\'automatisation. Nos systèmes apprennent et mémorisent au service des soins, de l\'apprentissage et de la prise de décision.',
  },
  'Consent by Design': {
    title: 'Consentement par conception',
    description: 'La confidentialité n\'est pas un correctif — c\'est une fondation. Les utilisateurs contrôlent leurs données, leur histoire et comment les systèmes les mémorisent.',
  },
  'Generational Span': {
    title: 'Portée générationnelle',
    description: 'Nous concevons pour le patient atteint de démence et pour l\'enfant qui découvre comment penser. Nos projets couvrent tout l\'arc de la vie.',
  },
  'Multilingual Equity': {
    title: 'Équité multilingue',
    description: 'Les soins ne s\'arrêtent pas pour la langue. Conçu pour les cliniques du Canada et pour ceux sans Wi-Fi. Les invites parlent aux bénévoles, aux aînés et aux oubliés.',
  },
  'Shared Ethical Core': {
    title: 'Noyau éthique partagé',
    description: 'Chaque projet puise dans une fondation : systèmes CareAI, architecture de consentement, couches de transparence et orchestration alignée sur le studio.',
  },
};

const timelineFr: Record<string, { title: string; description: string }> = {
  'Nzila is Born': {
    title: 'Nzila naît',
    description: 'Du concept kikongo de Nzila — « chemin » — nous consolidons en un modèle de studio. Huit projets unifiés. Un noyau éthique. Un nouveau nom. Une manière choisie d\'avancer.',
  },
  'Walking the Path': {
    title: 'Marcher le chemin',
    description: 'Union Eyes, Zonga, Flow, FAIRCASE, et plus. Chaque plateforme parle avec les autres. Chaque voix porte la mémoire, le consentement et la gouvernance pour les constructeurs et les communautés de tous les secteurs.',
  },
  'Generational Impact': {
    title: 'Impact générationnel',
    description: 'Du Canada à l\'impact mondial — notre rêve : un écosystème où la technologie se souvient de qui nous sommes et nous aide à devenir ce que nous sommes destinés à être. Pas seulement une application. Un nouveau système d\'exploitation pour la dignité.',
  },
};

export default async function About() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920"
          alt="Diverse team of professionals collaborating around laptops in a bright modern workspace"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-50" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              {isFr ? 'Société d exploitation' : 'Operating Company'}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {isFr ? 'Construire la continuité' : 'Building continuity'}<br />
              <span className="gradient-text">{isFr ? 'pour les institutions' : 'for institutions'}</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl">
              {isFr
                ? 'Nzila Ventures est la société d exploitation derrière Nzila OS, Union Eyes et des lignes produit gouvernées pour les organisations où continuité, preuves et confiance comptent.'
                : 'Nzila Ventures is the operating company behind Nzila OS, Union Eyes, and governed product lines for organizations where continuity, evidence, and trust matter.'}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ MISSION & VISION ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <ScrollReveal direction="left">
              <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full bg-linear-to-b from-electric to-violet" />
                <div className="pl-8">
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                    {isFr ? 'Mission' : 'Mission'}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
                    {isFr ? 'Générationnel par conception' : 'Generational by Design'}
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {isFr
                      ? 'Construire une infrastructure opérationnelle gouvernée qui aide les institutions sensibles à la confiance à préserver mémoire opérationnelle, preuves, décisions et continuité pendant les transitions.'
                      : 'To build governed operational infrastructure that helps trust-sensitive institutions preserve operational memory, evidence, decision rationale, and continuity across transitions.'}
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full bg-linear-to-b from-gold to-gold-light" />
                <div className="pl-8">
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/10 text-gold mb-4">
                    {isFr ? 'Vision' : 'Vision'}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
                    {isFr ? 'Un écosystème de dignité' : 'An Ecosystem of Dignity'}
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {isFr
                      ? 'Un écosystème où les institutions restent gouvernables, explicables et opérationnellement continues même quand les personnes, systèmes ou dirigeants changent.'
                      : 'An ecosystem where institutions remain governable, explainable, and operationally continuous when people, systems, or leadership change.'}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CORE VALUES ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Éthique' : 'Ethics'}
            title={isFr ? 'Les fondations de Nzila' : 'The Foundations of Nzila'}
            subtitle={isFr ? 'Comment nous rejetons la technologie extractive et construisons avec l\'âme' : 'How we reject extractive tech and build with soul'}
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, i) => (
              <ScrollReveal key={value.title} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-8 border border-gray-100 hover-lift">
                  <div className={`w-12 h-1.5 rounded-full bg-linear-to-r ${value.color} mb-6`} />
                  <h3 className="text-xl font-bold text-navy mb-3">{isFr ? (valuesFr[value.title]?.title ?? value.title) : value.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{isFr ? (valuesFr[value.title]?.description ?? value.description) : value.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TIMELINE ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Chemin' : 'Journey'}
            title={isFr ? 'Du Canada à l\'impact mondial' : 'From Canada to Global Impact'}
            subtitle={isFr ? 'Comment Nzila a marché le sentier depuis une question jusqu\'à un studio d\'impact intégré, enraciné au Canada et ouvert au monde' : 'How Nzila has walked the path from a question to an integrated studio of impact, rooted in Canada and built for the world'}
            light
          />

          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-linear-to-b from-electric via-violet to-gold hidden md:block" />

            <div className="space-y-10">
              {timeline.map((milestone, i) => (
                <ScrollReveal key={milestone.year} delay={i * 0.15}>
                  <div className="flex gap-6 md:gap-10 items-start">
                    <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/20 shrink-0 z-10">
                      <span className="text-xs font-bold text-gold">{milestone.year.slice(0, 4)}</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex-1 hover-lift">
                      <h3 className="text-xl font-bold text-white mb-2">
                        {isFr ? (timelineFr[milestone.title]?.title ?? milestone.title) : milestone.title} <span className="text-sm font-normal text-gray-400">• {milestone.year}</span>
                      </h3>
                      <p className="text-gray-400">{isFr ? (timelineFr[milestone.title]?.description ?? milestone.description) : milestone.description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ STATS BANNER ═══════════════════════ */}
      <section className="py-16 bg-navy-light relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { target: 8, label: isFr ? 'Ventures connectés' : 'Interconnected Ventures' },
              { target: 3, label: isFr ? 'Domaines d\'impact' : 'Impact Domains' },
              { target: 1, prefix: '∞', label: isFr ? 'Générations servies' : 'Generations Served' },
              { target: 100, suffix: '%', label: isFr ? 'Noyau éthique partagé' : 'Shared Ethical Core' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {stat.prefix || ''}{stat.target !== 100 && stat.target !== 1 ? <AnimatedCounter target={stat.target} /> : stat.target === 1 ? '♾️' : '100'}{stat.suffix || ''}
                </div>
                <div className="text-gray-400 font-medium text-sm tracking-wider uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CLOSING + CTA ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
              {isFr ? 'Nzila est une infrastructure de continuité' : 'Nzila is continuity infrastructure'}
            </h2>
            <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
              {isFr
                ? 'La société, la plateforme et les produits existent pour préserver mémoire opérationnelle, gouvernance, preuves et confiance institutionnelle.'
                : 'The company, platform, and products exist to preserve operational memory, governance, evidence, and institutional trust.'}
            </p>
            <div className="inline-flex items-center gap-3 bg-emerald/5 border border-emerald/20 rounded-xl px-6 py-4 mb-10">
              <span className="text-2xl">N</span>
              <div className="text-left">
                <div className="text-sm font-bold text-navy">{isFr ? 'Une société, une plateforme, plusieurs lignes' : 'One company, one platform, multiple lines'}</div>
                <div className="text-xs text-gray-500">{isFr ? 'Nzila Ventures opère Nzila OS. Union Eyes valide la catégorie.' : 'Nzila Ventures operates Nzila OS. Union Eyes validates the category.'}</div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/investors"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg"
              >
                {isFr ? 'Notre thèse' : 'Our Thesis'}
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-navy text-white font-bold rounded-xl hover:bg-navy-light transition-all text-lg"
              >
                {isFr ? 'Parlons' : 'Let\'s Talk'}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}




