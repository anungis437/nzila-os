'use client';

import { useEffect, useId } from 'react';
import { browserErrorReference, recordBrowserError } from '@nzila/os-core/browser-diagnostics';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { useLocale, useTranslations } from 'next-intl';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations('errors.dashboardBoundary');
  const localReference = useId();
  const diagnosticReference = browserErrorReference(error.digest, localReference);
  useEffect(() => {
    recordBrowserError({ app: 'union-eyes', surface: 'dashboard', code: 'CLIENT_BOUNDARY_ERROR',
      reference: diagnosticReference.value, referenceOrigin: diagnosticReference.origin });
    // Retain the existing SDK capture, without treating it as a delivery receipt.
    try {
      Sentry.captureException(error, { tags: { boundary: 'dashboard', reference: diagnosticReference.value } });
    } catch { /* Reporting must not break the recovery controls. */ }
  }, [error, diagnosticReference.value, diagnosticReference.origin]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-100 p-4">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
          </div>

          <h1 className="mb-3 text-center text-2xl font-bold text-gray-900">
            {t('title')}
          </h1>

          <p className="mb-6 text-center text-gray-600">
            {t('description')}
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800 mb-2">
                {t('developmentDetails')}
              </p>
              <p className="text-xs text-red-700 font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-red-600 mt-2">
                  {t('reference', { reference: diagnosticReference.value })}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={reset}
              className="w-full"
              size="lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('retry')}
            </Button>

            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href={`/${locale}`}>
                <Home className="mr-2 h-4 w-4" />
                {t('home')}
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            {t(diagnosticReference.origin === 'local' ? 'localReference' : 'reference', { reference: diagnosticReference.value })}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('supportLead')}{' '}
          <Link href={`/${locale}/dashboard/help`}
            className="font-medium text-blue-600 hover:text-blue-700 underline"
          >
            {t('supportLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
