'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { useLocale } from 'next-intl';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  useEffect(() => {
    // Log error to console for container log visibility
    console.error('[DashboardError]', error.message, error.digest, error.stack);
    // Log error to Sentry
    Sentry.captureException(error, {
      tags: {
        boundary: 'dashboard',
      },
    });
  }, [error]);

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
            Something went wrong
          </h1>

          <p className="mb-6 text-center text-gray-600">
            We encountered an unexpected error while loading your dashboard. 
            Our team has been notified and is working to fix the issue.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800 mb-2">
                Error Details (Development Only):
              </p>
              <p className="text-xs text-red-700 font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-red-600 mt-2">
                  Error ID: {error.digest}
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
              Try again
            </Button>

            <Link href={`/${locale}`} className="w-full">
              <Button
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to homepage
              </Button>
            </Link>
          </div>

          {error.digest && (
            <p className="mt-6 text-center text-xs text-gray-500">
              Reference ID: {error.digest}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          If this problem persists, please{' '}
          <Link href={`/${locale}/dashboard/support`}
            className="font-medium text-blue-600 hover:text-blue-700 underline"
          >
            contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
