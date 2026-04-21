import type { Metadata } from 'next';
import Link from 'next/link';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Trust Center',
  description: 'Nzila Ventures Trust Center — security posture, governance, reliability, and privacy commitments across the platform.',
  alternates: { canonical: '/trust' },
};

interface TrustListing {
  generatedAt: string;
  products: { slug: string; name: string; trustProfile: string; launchStage: string }[];
}

function loadListings(): TrustListing {
  try {
    const p = join(process.cwd(), '..', '..', 'platform', 'products', '_trust-listings.json');
    return JSON.parse(readFileSync(p, 'utf-8')) as TrustListing;
  } catch {
    return { generatedAt: '', products: [] };
  }
}

export default async function TrustCenter() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';
  const listings = loadListings();

  const sections = [
    { href: '/security', titleEn: 'Security', titleFr: 'Sécurité', descEn: 'Authentication, encryption, secrets, audit logging.', descFr: 'Authentification, chiffrement, secrets, journalisation.' },
    { href: '/privacy', titleEn: 'Privacy', titleFr: 'Confidentialité', descEn: 'Data residency, retention, subject rights.', descFr: 'Résidence des données, rétention, droits des personnes.' },
    { href: '/reliability', titleEn: 'Reliability', titleFr: 'Fiabilité', descEn: 'Uptime targets, incident response, change management.', descFr: 'Cibles de disponibilité, gestion des incidents et des changements.' },
    { href: '/legal/privacy', titleEn: 'Privacy Policy', titleFr: 'Politique de confidentialité', descEn: 'Full legal terms.', descFr: 'Conditions juridiques complètes.' },
  ];

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Confiance' : 'Trust'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Centre de confiance' : 'Trust Center'}</h1>
          <p className="text-gray-300 max-w-2xl">
            {isFr
              ? 'Comment Nzila construit, exploite et garantit chaque produit du portefeuille — sécurité, confidentialité, fiabilité et gouvernance.'
              : 'How Nzila builds, runs, and guarantees every product in the portfolio — security, privacy, reliability, and governance.'}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="block p-6 rounded-xl border border-gray-200 hover:border-electric hover:shadow-lg transition">
              <h2 className="text-xl font-bold text-gray-900 mb-2">{isFr ? s.titleFr : s.titleEn}</h2>
              <p className="text-gray-600 text-sm">{isFr ? s.descFr : s.descEn}</p>
            </Link>
          ))}
        </div>
      </section>

      {listings.products.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{isFr ? 'Profils de confiance par produit' : 'Per-product trust profiles'}</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">{isFr ? 'Produit' : 'Product'}</th>
                    <th className="px-4 py-3 text-left">{isFr ? 'Profil' : 'Profile'}</th>
                    <th className="px-4 py-3 text-left">{isFr ? 'Étape' : 'Stage'}</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.products.map((p) => (
                    <tr key={p.slug} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.trustProfile}</td>
                      <td className="px-4 py-3 text-gray-600">{p.launchStage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {isFr ? 'Source' : 'Source'}: <code>platform/products/_trust-listings.json</code>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
