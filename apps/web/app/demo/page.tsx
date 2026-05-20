import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Governance Review',
  description: 'Book a structured governance review for continuity assessment, Union Eyes pilot scoping, or Nzila OS procurement evaluation.',
  alternates: { canonical: '/demo' },
};

export default async function DemoPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Gouvernance' : 'Governance'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Demander une revue' : 'Request a governance review'}</h1>
          <p className="text-gray-300">
            {isFr
              ? 'Revue structurée pour évaluation de continuité, pilote Union Eyes ou documentation procurement Nzila OS.'
              : 'Structured review for continuity assessment, Union Eyes pilot scoping, or Nzila OS procurement documentation.'}
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <ol className="space-y-6 text-gray-700">
          <li className="flex gap-4">
            <span className="shrink-0 w-8 h-8 rounded-full bg-electric text-white font-bold flex items-center justify-center">1</span>
            <p>{isFr ? 'Écrivez à' : 'Email'} <a className="text-electric underline" href="mailto:hello@nzila.ca">hello@nzila.ca</a> {isFr ? 'avec votre contexte institutionnel' : 'with your institutional context'}.</p>
          </li>
          <li className="flex gap-4">
            <span className="shrink-0 w-8 h-8 rounded-full bg-electric text-white font-bold flex items-center justify-center">2</span>
            <p>{isFr ? 'Nous planifions une revue de 45 min sur continuité, gouvernance et preuve.' : 'We schedule a 45-minute review on continuity, governance, and evidence.'}</p>
          </li>
          <li className="flex gap-4">
            <span className="shrink-0 w-8 h-8 rounded-full bg-electric text-white font-bold flex items-center justify-center">3</span>
            <p>{isFr ? 'Si pertinent, nous cadrons un pilote Union Eyes ou une évaluation ICRA.' : 'If it fits, we scope a Union Eyes pilot or ICRA assessment.'}</p>
          </li>
        </ol>

        <div className="mt-10 flex gap-4">
          <a href="mailto:hello@nzila.ca" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">{isFr ? 'Écrire à Nzila' : 'Email Nzila'}</a>
          <Link href="/case-studies" className="px-6 py-3 border border-gray-300 text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition">{isFr ? 'Voir des études de cas' : 'See case studies'}</Link>
        </div>
      </section>
    </main>
  );
}
