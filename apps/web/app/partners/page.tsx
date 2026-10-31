import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Partner access',
  description: 'Request or access the Nzila Ventures partner workspace through a governed sign-in experience.',
  robots: { index: false, follow: false },
};

export default async function PartnersSignIn() {
  // Never redirect visitors to a localhost/development fallback.
  const configured = process.env.NEXT_PUBLIC_PARTNERS_URL;
  let partnerUrl: URL | null = null;
  if (configured) {
    try {
      partnerUrl = new URL(configured);
    } catch {
      // Treat invalid destinations as unconfigured.
    }
  }
  const host = partnerUrl?.hostname.toLowerCase() ?? '';
  const isPublicHost = host !== 'localhost'
    && host !== '127.0.0.1'
    && host !== '[::1]'
    && !host.endsWith('.localhost')
    && !host.endsWith('.local');
  if (partnerUrl?.protocol === 'https:' && isPublicHost && !partnerUrl.username && !partnerUrl.password) {
    redirect(new URL('/sign-in', partnerUrl).toString());
  }

  const isFr = (await getLocale()) === 'fr-CA';
  return (
    <main className="min-h-screen bg-[#080e1c] px-4 pb-24 pt-36 text-white sm:px-6 sm:pt-44">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/15 bg-white/5 p-7 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">
          {isFr ? 'Accès partenaires' : 'Partner access'}
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          {isFr ? 'Un accès réservé aux partenaires autorisés.' : 'A workspace for authorized partners.'}
        </h1>
        <p className="mt-5 text-base leading-8 text-slate-300">
          {isFr
            ? 'Le lien sécurisé de connexion n’est pas disponible sur cette page. Communiquez avec notre équipe pour confirmer votre accès.'
            : 'A secure sign-in destination is not available from this page. Contact our team to confirm your access.'}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/contact?interest=portfolio" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-[#101a2c] hover:bg-[#f2d694]">
            {isFr ? 'Demander un accès' : 'Request access'}
          </Link>
          <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
            {isFr ? 'Retour à l’accueil' : 'Return home'}
          </Link>
        </div>
      </div>
    </main>
  );
}
