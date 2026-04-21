import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Nzila Ventures privacy commitments — data residency, retention, subject rights, and the full Privacy Policy.',
  alternates: { canonical: '/privacy' },
};

export default async function PrivacyPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Confiance' : 'Trust'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Confidentialité' : 'Privacy'}</h1>
          <p className="text-gray-300 max-w-2xl">
            {isFr ? 'Résidence des données, rétention et droits des personnes concernées.' : 'Data residency, retention, and subject rights.'}
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-slate">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? 'Résidence des données' : 'Data residency'}</h2>
        <p className="text-gray-700">
          {isFr
            ? 'Toutes les données de production sont hébergées au Canada (régions Azure Canada Central et East US 2 pour les modèles vocaux). Le routage de sortie est limité par une liste blanche.'
            : 'All production data is hosted in Canada (Azure Canada Central and East US 2 for voice models). Outbound routing is allow-listed.'}
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">{isFr ? 'Rétention' : 'Retention'}</h2>
        <p className="text-gray-700">
          {isFr
            ? 'Les classes de rétention (90 jours, 1 an, 7 ans, permanent) sont déclarées par produit dans le registre canonique des applications.'
            : 'Retention classes (90 days, 1 year, 7 years, permanent) are declared per-product in the canonical app registry.'}
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">{isFr ? 'Droits des personnes' : 'Subject rights'}</h2>
        <p className="text-gray-700">
          {isFr ? 'Accès, rectification, suppression et portabilité — voir' : 'Access, rectification, deletion and portability — see'}{' '}
          <Link href="/legal/privacy" className="text-electric underline">{isFr ? 'la politique complète' : 'the full Privacy Policy'}</Link>.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">{isFr ? 'Conformité' : 'Compliance'}</h2>
        <ul className="list-disc pl-6 text-gray-700 space-y-2">
          <li>PIPEDA (Canada)</li>
          <li>Loi 25 (Québec)</li>
          <li>GDPR (UE — sur demande)</li>
        </ul>
      </section>
    </main>
  );
}
