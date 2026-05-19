import type { Metadata } from 'next';
import Link from 'next/link';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Nzila Ventures pricing — packaging tiers, what is included, and how to get a custom quote.',
  alternates: { canonical: '/pricing' },
};

interface PricingMatrix {
  generatedAt: string;
  byPricingTier: Record<string, string[]>;
}

function loadMatrix(): PricingMatrix {
  try {
    const p = join(process.cwd(), '..', '..', 'platform', 'products', '_pricing-matrix.json');
    return JSON.parse(readFileSync(p, 'utf-8')) as PricingMatrix;
  } catch {
    return { generatedAt: '', byPricingTier: {} };
  }
}

const tiers = [
  {
    id: 'enterprise',
    en: { name: 'Enterprise', desc: 'Multi-organization, multi-region deployments with full governance, audit, and dedicated success.', price: 'Custom' },
    fr: { name: 'Entreprise', desc: 'Déploiements multi-organisation, multi-régions avec gouvernance, audit et succès dédié.', price: 'Sur mesure' },
  },
  {
    id: 'growth',
    en: { name: 'Growth', desc: 'For organizations standardizing operations across teams. Includes platform-shell, audit, and integrations.', price: 'From CA$2,400/mo' },
    fr: { name: 'Croissance', desc: 'Pour les organisations qui standardisent leurs opérations. Inclut shell, audit et intégrations.', price: 'À partir de 2 400 $ CA/mois' },
  },
  {
    id: 'consumer',
    en: { name: 'Consumer / Creator', desc: 'For Zonga and creator-economy surfaces — usage-based with platform fees.', price: 'Usage-based' },
    fr: { name: 'Consommateur / Créateur', desc: 'Pour Zonga et les surfaces créateurs — basé sur l usage avec frais de plateforme.', price: 'Basé sur l usage' },
  },
];

export default async function PricingPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';
  const matrix = loadMatrix();

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Commercial' : 'Commercial'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Tarification' : 'Pricing'}</h1>
          <p className="text-gray-300 max-w-2xl">
            {isFr
              ? 'Trois paliers — Entreprise, Croissance, Consommateur. Le packaging détaillé est documenté dans la stratégie GTM.'
              : 'Three tiers — Enterprise, Growth, Consumer. Detailed packaging lives in the GTM strategy docs.'}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => {
            const slugs = matrix.byPricingTier[t.id] ?? [];
            const copy = isFr ? t.fr : t.en;
            return (
              <div key={t.id} className="rounded-xl border border-gray-200 p-6 flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{copy.name}</h2>
                <p className="text-2xl font-extrabold text-electric mb-3">{copy.price}</p>
                <p className="text-gray-600 text-sm mb-4 flex-1">{copy.desc}</p>
                {slugs.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{isFr ? 'Produits inclus' : 'Products in tier'}</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {slugs.map((s) => <li key={s}>· {s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex gap-4">
          <Link href="/demo" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">
            {isFr ? 'Demander une démo' : 'Request a demo'}
          </Link>
          <Link href="/roi" className="px-6 py-3 border border-gray-300 text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition">
            {isFr ? 'Calculer le ROI' : 'Calculate ROI'}
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          {isFr ? 'Source' : 'Source'}: <code>governance/business/PRICING_AND_PACKAGING.md</code> · <code>platform/products/_pricing-matrix.json</code>
        </p>
      </section>
    </main>
  );
}
