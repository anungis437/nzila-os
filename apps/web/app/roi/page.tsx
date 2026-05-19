import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'ROI calculator',
  description: 'Estimate continuity, governance, and operational savings from Union Eyes, Flow, and FAIRCASE pilots.',
  alternates: { canonical: '/roi' },
};

const scenarios = [
  {
    en: { product: 'Union Eyes', driver: 'Reduce grievance handoff and reconstruction time by 40%', annualSaving: 'CA$120,000 (per 5 staff)' },
    fr: { product: 'Union Eyes', driver: 'Réduire le temps de transfert et reconstruction des griefs de 40%', annualSaving: '120 000 $ CA (par 5 employés)' },
  },
  {
    en: { product: 'Flow', driver: 'Cut order-to-cash cycle from 14 → 6 days', annualSaving: 'CA$80,000 (working capital)' },
    fr: { product: 'Flow', driver: 'Cycle commande-encaissement de 14 → 6 jours', annualSaving: '80 000 $ CA (fonds de roulement)' },
  },
  {
    en: { product: 'FAIRCASE', driver: 'Replace 2 external compliance audits/year', annualSaving: 'CA$60,000+' },
    fr: { product: 'FAIRCASE', driver: 'Remplacer 2 audits de conformité externes/an', annualSaving: '60 000 $ CA+' },
  },
];

export default async function RoiPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Commercial' : 'Commercial'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Calcul du ROI' : 'ROI calculator'}</h1>
          <p className="text-gray-300 max-w-2xl">
            {isFr ? 'Scénarios indicatifs — chiffres validés par produit pendant la phase de pilote.' : 'Indicative scenarios — exact numbers validated per product during the pilot phase.'}
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">{isFr ? 'Produit' : 'Product'}</th>
                <th className="px-4 py-3 text-left">{isFr ? 'Levier' : 'Driver'}</th>
                <th className="px-4 py-3 text-left">{isFr ? 'Économie annuelle' : 'Annual saving'}</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => {
                const c = isFr ? s.fr : s.en;
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.product}</td>
                    <td className="px-4 py-3 text-gray-700">{c.driver}</td>
                    <td className="px-4 py-3 text-gray-700">{c.annualSaving}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex gap-4">
          <Link href="/demo" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">{isFr ? 'Valider votre cas' : 'Validate your case'}</Link>
          <Link href="/pricing" className="px-6 py-3 border border-gray-300 text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition">{isFr ? 'Voir la tarification' : 'See pricing'}</Link>
        </div>
      </section>
    </main>
  );
}
