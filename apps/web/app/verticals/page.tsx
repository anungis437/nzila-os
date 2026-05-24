import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import AnimatedCounter from '@/components/public/AnimatedCounter';
import SectionHeading from '@/components/public/SectionHeading';
import InvestorCTA from '@/components/public/InvestorCTA';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Verticals',
  description: 'Trust-sensitive sectors where Nzila applies continuity, governance, operational memory, evidence, and sovereignty infrastructure.',
  openGraph: {
    title: 'Nzila Ventures Verticals',
    description: 'Continuity infrastructure across trust-sensitive sectors.',
    images: [{ url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Technology conference audience in a large auditorium with stage lighting' }],
  },
  alternates: { canonical: '/verticals' },
};

// Public sector map for continuity-critical product lines.
const verticals = [
  {
    slug: 'fintech',
    name: 'Fintech',
    photo: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
    alt: 'Financial trading terminal with stock charts and candlestick patterns',
    platforms: ['DiasporaCore V2', 'Insight CFO'],
    description: 'Banking, payments, stress testing, and virtual CFO services for individuals and enterprises.',
    tam: '$100B+', orgs: '617', status: '2 platforms',
  },
  {
    slug: 'agrotech',
    name: 'Agrotech',
    photo: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
    alt: 'Aerial view of green agricultural farmland with organized crop rows',
    platforms: ['CORA', 'Agrimo'],
    description: 'Farm management, supply chain, IoT intégration, and agricultural market intelligence. CORA scales Canadian market data; Agrimo serves the DRC and Central Africa.',
    tam: '$8.6B', orgs: '300+', status: 'Flagship + Production Ready',
  },
  {
    slug: 'uniontech',
    name: 'Uniontech',
    photo: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
    alt: 'Labor union workers raising hands together in solidarity',
    platforms: ['Union Eyes'],
    description: 'Organizational continuity, grievance lineage, steward handoffs, governance evidence, and CBA context.',
    tam: '$50B', orgs: '4,773', status: 'Flagship',
  },
  {
    slug: 'legaltech',
    name: 'Legaltech',
    photo: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800',
    alt: 'Scales of justice on a desk alongside legal reference books',
    platforms: ['Court Lens', 'FAIRCASE'],
    description: 'Case management, legal AI, tribunal databases, and eDiscovery services.',
    tam: '$13B+', orgs: '814', status: '2 platforms',
  },
  {
    slug: 'edtech',
    name: 'EdTech',
    photo: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
    alt: 'Students engaged in collaborative learning with digital devices',
    platforms: ['FAIRCASE', 'CyberLearn'],
    description: 'Learning management, certification, cybersecurity training, and gamified education.',
    tam: '$13B+', orgs: '162', status: '2 platforms',
  },
  {
    slug: 'commerce',
    name: 'Commerce',
    photo: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    alt: 'Customer completing a digital payment at a modern retail checkout',
    platforms: ['Flow', 'Trade OS'],
    description: 'Order-to-cash, procure-to-pay, inventory management, AI-powered quoting, and cross-border trade operations.',
    tam: '$100B+', orgs: '700+', status: 'Flagship + In Development',
  },
  {
    slug: 'entertainment',
    name: 'Music & Entertainment',
    photo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    alt: 'DJ performing live with colorful stage lights and sound equipment',
    platforms: ['Zonga'],
    description: 'Africa-first music distribution, artist onboarding, streaming analytics, event ticketing, and royalty management.',
    tam: '$70B', orgs: '1000+', status: 'Flagship + Production Ready',
  },
  {
    slug: 'healthtech',
    name: 'Healthtech',
    photo: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
    alt: 'Healthcare professional using a digital tablet for patient diagnostics',
    platforms: ['Memora'],
    description: 'Cognitive wellness, dementia care, caregiver support, and health monitoring.',
    tam: '$20B', orgs: '150', status: 'Modernizing',
  },
  {
    slug: 'insurtech',
    name: 'Insurtech',
    photo: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800',
    alt: 'Business professional signing insurance policy documents at a desk',
    platforms: ['SentryIQ360'],
    description: 'Insurance arbitrage, underwriting AI, policy lifecycle, and claims intelligence.',
    tam: '$30B', orgs: '79', status: 'In Development',
  },
  {
    slug: 'justice',
    name: 'Justice',
    photo: 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=800',
    alt: 'Symbolic raised fist representing social justice and equity advocacy',
    platforms: ['FAIRCASE'],
    description: 'Anti-racism training, DEI analytics, and equity impact measurement.',
    tam: '$1.5B', orgs: '132', status: 'Production Ready',
  },
];

const verticalFr: Record<string, { name: string; description: string; status: string }> = {
  Fintech: {
    name: 'Fintech',
    description: 'Banque, paiements, stress testing et services de CFO virtuel pour particuliers et entreprises.',
    status: '2 plateformes',
  },
  Agrotech: {
    name: 'Agrotech',
    description: 'Gestion agricole, chaine logistique, intégration IoT et intelligence de marché. CORA developpe le marché canadien; Agrimo sert la RDC et l Afrique centrale.',
    status: 'Phare + Pret pour production',
  },
  Uniontech: {
    name: 'Uniontech',
    description: 'Gestion syndicale, prevision des pensions, suivi des griefs et intelligence CBA.',
    status: 'Phare',
  },
  Legaltech: {
    name: 'Legaltech',
    description: 'Gestion des dossiers, IA juridique, bases de decisions de tribunal et services eDiscovery.',
    status: '2 plateformes',
  },
  EdTech: {
    name: 'EdTech',
    description: 'LMS, certification, formation cybersécurité et education gamifiee.',
    status: '2 plateformes',
  },
  Commerce: {
    name: 'Commerce',
    description: 'Order-to-cash, procure-to-pay, gestion des stocks, devis IA et operations commerciales transfrontalieres.',
    status: 'Phare + En developpement',
  },
  'Music & Entertainment': {
    name: 'Musique et divertissement',
    description: 'Distribution musicale africaine, onboarding artistes, analytics streaming, billetterie et gestion des redevances.',
    status: 'Phare + Pret pour production',
  },
  Healthtech: {
    name: 'Healthtech',
    description: 'Bien-etre cognitif, soins dementia, soutien aidants et suivi de sante.',
    status: 'Modernisation',
  },
  Insurtech: {
    name: 'Insurtech',
    description: 'Arbitrage assurance, IA de souscription, cycle de vie police et intelligence des sinistres.',
    status: 'En developpement',
  },
  Justice: {
    name: 'Justice',
    description: 'Formation antiracisme, analytics DEI et mesure d impact equitable.',
    status: 'Pret pour production',
  },
};

export default async function Verticals() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920"
          alt="Technology conference audience in a large auditorium with dramatic stage lighting"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              {isFr ? 'Couverture de marché' : 'Market Coverage'}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              {isFr ? '10+ verticales stratégiques' : '10+ Strategic Verticals'}
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              {isFr
                ? 'Des secteurs où la continuité, la mémoire opérationnelle, les preuves de gouvernance et la confiance institutionnelle deviennent matérielles.'
                : 'Sectors where continuity, operational memory, governance evidence, and organizational trust become materially important.'}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ STATS BAR ═══════════════════════ */}
      <section className="bg-navy py-8 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-10 text-center">
          {[
            { value: 15, suffix: '', label: isFr ? 'Plateformes' : 'Platforms' },
            { value: 10, suffix: '+', label: isFr ? 'Verticales' : 'Verticals' },
            { value: 100, prefix: '$', suffix: 'B+', label: 'TAM' },
            { value: 12000, suffix: '+', label: isFr ? 'Entités' : 'Entities' },
          ].map((s) => (
            <div key={s.label}>
              <span className="text-3xl font-bold gradient-text">
                <AnimatedCounter target={s.value} prefix={s.prefix} suffix={s.suffix} />
              </span>
              <span className="text-gray-400 ml-2 text-sm">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ VERTICALS GRID ═══════════════════════ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {verticals.map((v, i) => (
              <ScrollReveal key={v.name} delay={i * 0.05}>
                <Link href={`/verticals/${v.slug}`} className="block h-full">
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover-lift h-full flex flex-col cursor-pointer">
                  {/* Photo header */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={v.photo}
                      alt={v.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-navy/80 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">{isFr ? (verticalFr[v.name]?.name ?? v.name) : v.name}</h2>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white">
                          {isFr ? (verticalFr[v.name]?.status ?? v.status) : v.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-gray-600 mb-4">{isFr ? (verticalFr[v.name]?.description ?? v.description) : v.description}</p>

                    <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-lg font-bold text-electric">{v.platforms.length}</div>
                        <div className="text-xs text-gray-500">{isFr ? 'Plateformes' : 'Platforms'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-lg font-bold text-navy">{v.orgs}</div>
                        <div className="text-xs text-gray-500">{isFr ? 'Entités' : 'Entities'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-sm font-bold text-gold">{v.tam}</div>
                        <div className="text-xs text-gray-500">TAM</div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 mt-auto">
                      <h3 className="font-semibold text-navy text-sm mb-2">{isFr ? 'Plateformes' : 'Platforms'}</h3>
                      <div className="flex flex-wrap gap-2">
                        {v.platforms.map((p) => (
                          <span key={p} className="text-xs px-3 py-1 bg-electric/5 text-electric rounded-full font-medium">
                            {p}
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-electric">
                        {isFr ? 'Explorer les capacites ->' : 'Explore capabilities ->'}
                      </span>
                    </div>
                  </div>
                </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CROSS-VERTICAL IMPACT ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Infrastructure commune' : 'Shared Infrastructure'}
            title={isFr ? 'Nzila OS relie les lignes sans effacer leur contexte' : 'Nzila OS connects product lines without erasing their context'}
            subtitle={isFr ? 'Les primitives partagées servent la continuité, les preuves et la gouvernance tout en respectant les limites organisationnelles.' : 'Shared primitives serve continuity, evidence, and governance while respecting organizational boundaries.'}
          />

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { value: 80, suffix: '%+', label: isFr ? 'Reutilisation code' : 'Code Reuse', sub: isFr ? 'Services partages entre verticales' : 'Shared services across verticals' },
              { value: 56, suffix: '%', label: isFr ? 'Réduction pilote visée' : 'Pilot Reduction Target', sub: isFr ? 'Grâce à la migration Nzila OS' : 'Through Nzila OS migration' },
              { value: 5.7, prefix: '$', suffix: 'M', label: isFr ? 'Valeur PI' : 'IP Value', sub: isFr ? 'Secrets commerciaux et brevets' : 'Trade secrets & patents' },
              { value: 200, suffix: '+', label: isFr ? 'Prompts IA' : 'AI Prompts', sub: isFr ? 'Bibliotheque Companion Engine' : 'Companion Engine library' },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} delay={i * 0.1}>
                <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
                  <div className="text-4xl font-bold gradient-text mb-2">
                    <AnimatedCounter target={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </div>
                  <div className="font-semibold text-navy">{stat.label}</div>
                  <p className="text-sm text-gray-500 mt-1">{stat.sub}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <InvestorCTA />
    </main>
  );
}





