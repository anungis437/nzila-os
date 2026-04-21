import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Case studies',
  description: 'Pilots, deployments, and outcomes across the Nzila portfolio.',
  alternates: { canonical: '/case-studies' },
};

const studies = [
  {
    slug: 'shopmoica-flow',
    en: { product: 'Flow', customer: 'Shopmoica', headline: 'End-to-end commerce ops in 30 days', metric: 'Time-to-first-order: 28 days' },
    fr: { product: 'Flow', customer: 'Shopmoica', headline: 'Opérations e-commerce de bout en bout en 30 jours', metric: 'Première commande : 28 jours' },
  },
  {
    slug: 'cupe-pilot-union-eyes',
    en: { product: 'Union Eyes', customer: 'CUPE pilot', headline: 'Grievance + claims in one source of truth', metric: '> 100 cases tracked, hash-chained audit trail' },
    fr: { product: 'Union Eyes', customer: 'Pilote SCFP', headline: 'Griefs + réclamations dans une seule source de vérité', metric: '> 100 dossiers suivis, journal d audit chaîné' },
  },
  {
    slug: 'zonga-launch',
    en: { product: 'Zonga', customer: 'Internal launch', headline: 'Africa-first creator distribution', metric: 'Pre-launch artist onboarding live' },
    fr: { product: 'Zonga', customer: 'Lancement interne', headline: 'Distribution créateur axée Afrique', metric: 'Inscription pré-lancement des artistes en cours' },
  },
];

export default async function CaseStudiesPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Commercial' : 'Commercial'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Études de cas' : 'Case studies'}</h1>
          <p className="text-gray-300 max-w-2xl">
            {isFr ? 'Pilotes et déploiements en cours — preuves vérifiables, pas de noms inventés.' : 'Pilots and deployments in flight — verifiable proof, no fabricated logos.'}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {studies.map((s) => {
            const c = isFr ? s.fr : s.en;
            return (
              <article key={s.slug} className="rounded-xl border border-gray-200 p-6 flex flex-col">
                <p className="text-xs font-semibold text-electric uppercase tracking-wider mb-2">{c.product}</p>
                <h2 className="text-lg font-bold text-gray-900 mb-2">{c.customer}</h2>
                <p className="text-gray-700 text-sm mb-3 flex-1">{c.headline}</p>
                <p className="text-xs text-gray-500 border-t pt-3">{c.metric}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-12">
          <Link href="/demo" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">
            {isFr ? 'Voir une démo' : 'See a demo'}
          </Link>
        </div>
      </section>
    </main>
  );
}
