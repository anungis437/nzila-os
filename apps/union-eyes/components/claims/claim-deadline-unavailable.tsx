'use client';

import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Deadline calculation is not available in this build: there is no jurisdiction or
 * deadline service behind it. This states that plainly and never shows a computed date.
 */
export function ClaimDeadlineUnavailable() {
  const t = useTranslations('claimsPage');
  return (
    <Card data-testid="claim-deadline-unavailable">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Info size={16} className="text-gray-500" aria-hidden="true" />
          {t('deadlineUnavailableTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">{t('deadlineUnavailableBody')}</p>
      </CardContent>
    </Card>
  );
}
