'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';
import { useLocale } from 'next-intl';

export default function NotFound() {
  const locale = useLocale();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-blue-100 p-3">
            <FileQuestion className="h-12 w-12 text-blue-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Page Not Found</h1>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="default">
            <Link href={`/${locale}`}>Go to Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/dashboard`}>Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
