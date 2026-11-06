/**
 * /continuity-assessment/claim — ICRA buyer claim landing (DEF-0B8-ICRA-CLAIM-TOKEN-HAS-NO-ICRA-ISSUER-SO-CLAIM-CANNOT-SUCCEED).
 *
 * After a paid tier upgrade the buyer is e-mailed a link of the form
 *   /{locale}/continuity-assessment/claim?assessmentId=...&token=...
 * This page requires sign-in; the signed-in buyer then POSTs the token to /api/icra/[assessmentId]/claim, which binds the assessment to
 * their organization only when the account's e-mail is the purchaser's and the account administers the organization.
 */

import Link from 'next/link';
import { auth } from '@nzila/platform-auth/entra/server';
import { isAssessmentId } from '@/lib/icra/assessment-id';
import ClaimIcraClient from './ClaimIcraClient';

export const dynamic = 'force-dynamic';

export default async function IcraClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const fr = locale.toLowerCase().startsWith('fr');
  const token = typeof sp.token === 'string' && sp.token.length >= 16 ? sp.token : null;
  const assessmentId = typeof sp.assessmentId === 'string' && isAssessmentId(sp.assessmentId) ? sp.assessmentId : null;

  const session = await auth();
  const userId = session?.userId ?? null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <p className="text-[0.78rem] uppercase tracking-[0.32em] text-stone-500">
          {fr ? 'Récupérer votre rapport' : 'Claim your report'}
        </p>
        <h1 className="mt-4 text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
          {fr
            ? 'Liez le rapport de continuité à votre compte institutionnel'
            : 'Bind the continuity report to your institutional account'}
        </h1>

        {!token || !assessmentId ? (
          <p className="mt-8 rounded border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            {fr
              ? 'Lien de récupération incomplet. Vérifiez le courriel reçu après l’achat ou contactez-nous.'
              : 'Claim link incomplete. Check the e-mail you received after purchase, or contact us.'}
          </p>
        ) : !userId ? (
          <div className="mt-8 space-y-5">
            <p className="text-base leading-relaxed text-stone-700">
              {fr
                ? 'Connectez-vous avec l’adresse courriel utilisée pour l’achat afin de finaliser la récupération.'
                : 'Sign in with the e-mail address you purchased with to finalize the claim.'}
            </p>
            <Link
              href={`/${locale}/sign-in?redirect=${encodeURIComponent(
                `/${locale}/continuity-assessment/claim?${new URLSearchParams({ assessmentId, token }).toString()}`,
              )}`}
              className="inline-flex items-center rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
            >
              {fr ? 'Se connecter' : 'Sign in'}
            </Link>
          </div>
        ) : (
          <ClaimIcraClient assessmentId={assessmentId} token={token} locale={fr ? 'fr-CA' : 'en-CA'} />
        )}
      </div>
    </div>
  );
}
