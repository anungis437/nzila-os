import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center px-4">
        <h1 className="text-8xl font-bold text-navy mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          {isFr ? 'Page introuvable' : 'Page Not Found'}
        </h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          {isFr
            ? 'La page que vous cherchez n existe pas ou a été deplacee.'
            : 'The page you\'re looking for doesn\'t exist or has been moved.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition text-lg shadow-lg shadow-electric/25"
        >
          {isFr ? "Retour à l'accueil" : 'Back to Home'}
        </Link>
      </div>
    </main>
  );
}








