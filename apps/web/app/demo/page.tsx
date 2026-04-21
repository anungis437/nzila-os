import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Request a demo',
  description: 'Book a guided demo of any Nzila Ventures product — Union Eyes, Flow, FAIRCASE, Zonga, or the platform shell.',
  alternates: { canonical: '/demo' },
};

export default async function DemoPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Commercial' : 'Commercial'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Demander une démo' : 'Request a demo'}</h1>
          <p className="text-gray-300">
            {isFr
              ? 'Démos guidées de Union Eyes, Flow, FAIRCASE, Zonga et de la plateforme.'
              : 'Guided walkthroughs of Union Eyes, Flow, FAIRCASE, Zonga and the platform shell.'}
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <ol className="space-y-6 text-gray-700">
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-electric text-white font-bold flex items-center justify-center">1</span>
            <p>{isFr ? 'Écrivez à' : 'Email'} <a className="text-electric underline" href="mailto:hello@nzila.ca">hello@nzila.ca</a> {isFr ? 'avec votre cas d usage' : 'with your use case'}.</p>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-electric text-white font-bold flex items-center justify-center">2</span>
            <p>{isFr ? 'Nous planifions un atelier de 45 min sur le produit le plus pertinent.' : 'We schedule a 45-min workshop on the most relevant product.'}</p>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-electric text-white font-bold flex items-center justify-center">3</span>
            <p>{isFr ? 'Si pertinent, nous lançons un pilote en 2 semaines.' : 'If it fits, we launch a pilot within 2 weeks.'}</p>
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
