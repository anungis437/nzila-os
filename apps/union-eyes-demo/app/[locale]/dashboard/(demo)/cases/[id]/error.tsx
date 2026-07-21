'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import * as Sentry from '@sentry/nextjs';

export default function CaseDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'case-detail' },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-red-100 bg-white p-8 shadow-md">
          <div className="mb-5 flex justify-center">
            <div className="rounded-full bg-red-50 p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <h1 className="mb-2 text-center text-xl font-semibold text-gray-900">
            Unable to load case
          </h1>

          <p className="mb-6 text-center text-sm text-gray-600">
            An error occurred while loading this case. Your data is safe — this is a display issue only.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-5 rounded-lg bg-red-50 p-3">
              <p className="text-xs font-mono text-red-800 break-all">{error.message}</p>
              {error.digest && (
                <p className="mt-1 text-xs text-red-600">ID: {error.digest}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>

            <Link href={`/${locale}/dashboard/cases`} className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to cases
              </Button>
            </Link>
          </div>

          {error.digest && (
            <p className="mt-5 text-center text-xs text-gray-400">
              Reference: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
