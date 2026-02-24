'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
 
import Link from 'next/link';

interface CreditExpirationBannerProps {
  userId: string;
  expiringCredits?: {
    amount: number;
    expiresAt: Date;
  } | null;
}

export function CreditExpirationBanner({ userId: _userId, expiringCredits }: CreditExpirationBannerProps) {
  if (!expiringCredits || expiringCredits.amount === 0) {
    return null;
  }

  const daysUntilExpiration = Math.ceil(
    // eslint-disable-next-line react-hooks/purity
    (new Date(expiringCredits.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const isUrgent = daysUntilExpiration <= 7;

  return (
    <Alert variant={isUrgent ? 'destructive' : 'default'} className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {isUrgent ? '⚠️ Urgent: Credits Expiring Soon!' : 'Credits Expiring Soon'}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <div>
          <p>
            You have <strong>{expiringCredits.amount} credits</strong> that will expire{' '}
            {formatDistanceToNow(new Date(expiringCredits.expiresAt), { addSuffix: true })}
            {daysUntilExpiration <= 3 && (
              <span className="font-bold text-red-600"> ({daysUntilExpiration} days left)</span>
            )}.
          </p>
          <p className="text-sm mt-1">
            Redeem them now to avoid losing your rewards!
          </p>
        </div>
        <Link href="/dashboard/rewards/redeem">
          <Button variant={isUrgent ? 'default' : 'outline'} size="sm" className="gap-2">
            Redeem Now
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}

