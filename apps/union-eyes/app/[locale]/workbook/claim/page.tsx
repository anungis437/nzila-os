/**
 * /workbook/claim \u2014 buyer claim landing.
 *
 * After purchase, the buyer receives a link of the form
 *   /{locale}/workbook/claim?token=...&workbookId=...
 *
 * This page requires sign-in; after auth, the user POSTs the claim token
 * to /api/workbook/[id]/claim which binds the workbook to their account
 * and resolves to an organization.
 */

import Link from 'next/link';
import { auth } from '@nzila/platform-auth';
import ClaimWorkbookClient from './ClaimWorkbookClient';
import { isFrench } from '@/lib/workbook/copy';

export const dynamic = 'force-dynamic';

export default async function WorkbookClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const fr = isFrench(locale);
  const token = typeof sp.token === 'string' ? sp.token : null;
  const workbookId = typeof sp.workbookId === 'string' ? sp.workbookId : null;

  const session = await auth();
  const userId = session?.userId ?? null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <p className="text-[0.78rem] uppercase tracking-[0.32em] text-stone-500">
          {fr ? 'R\u00e9cup\u00e9rer votre cahier' : 'Claim your workbook'}
        </p>
        <h1 className="mt-4 text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
          {fr
            ? 'Liez le cahier \u00e0 votre compte institutionnel'
            : 'Bind the workbook to your institutional account'}
        </h1>

        {!token || !workbookId ? (
          <p className="mt-8 rounded border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            {fr
              ? 'Lien de r\u00e9cup\u00e9ration incomplet. V\u00e9rifiez le courriel re\u00e7u apr\u00e8s achat ou contactez-nous.'
              : 'Claim link incomplete. Check the email you received after purchase, or contact us.'}
          </p>
        ) : !userId ? (
          <div className="mt-8 space-y-5">
            <p className="text-base leading-relaxed text-stone-700">
              {fr
                ? 'Connectez-vous ou cr\u00e9ez votre compte pour finaliser la r\u00e9cup\u00e9ration.'
                : 'Sign in or create your account to finalize the claim.'}
            </p>
            <Link
              href={`/${locale}/sign-in?redirect=${encodeURIComponent(
                `/${locale}/workbook/claim?token=${token}&workbookId=${workbookId}`,
              )}`}
              className="inline-flex items-center rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
            >
              {fr ? 'Se connecter' : 'Sign in'}
            </Link>
          </div>
        ) : (
          <ClaimWorkbookClient
            workbookId={workbookId}
            token={token}
            locale={fr ? 'fr-CA' : 'en-CA'}
          />
        )}
      </div>
    </div>
  );
}
