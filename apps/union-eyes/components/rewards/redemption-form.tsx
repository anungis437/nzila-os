'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
 
 
import { initiateRedemption } from '@/actions/rewards-actions';
import { validateRedirectUrl } from '@/lib/utils/sanitize';

interface RedemptionFormProps {
  balance: number;
  mode: 'shopify' | 'manual';
  userId: string;
  orgId: string;
}

export function RedemptionForm({ balance, mode, userId: _userId, orgId: _orgId }: RedemptionFormProps) {
  const t = useTranslations('rewards.redeem.form');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const creditsNum = parseInt(credits, 10);

    if (isNaN(creditsNum) || creditsNum <= 0) {
      setError(t('errors.invalidAmount', { defaultValue: 'Please enter a valid amount' }));
      return;
    }

    if (creditsNum > balance) {
      setError(
        t('errors.insufficientBalance', {
          defaultValue: 'You do not have enough credits',
        })
      );
      return;
    }

    setLoading(true);

    try {
      const result = await initiateRedemption({
        credits_to_redeem: creditsNum,
        request_notes: notes || undefined,
      });

      if (!result.success) {
        setError(result.error || t('errors.failed', { defaultValue: 'Failed to initiate redemption' }));
        setLoading(false);
        return;
      }

      // If Shopify mode, redirect to catalog/checkout
      if (mode === 'shopify' && result.data?.checkout_url) {
        // Redirect to Shopify checkout with pre-applied discount
        const safeUrl = validateRedirectUrl(result.data.checkout_url);
        if (!safeUrl) { setError('Untrusted checkout URL'); setLoading(false); return; }
        window.location.href = safeUrl;
      } else {
        // Manual mode or no checkout URL: redirect to wallet with success message
        router.push('/dashboard/rewards?redemption=success');
      }
    } catch (err) {
      setError((err as Error).message || t('errors.unknown', { defaultValue: 'An error occurred' }));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="credits">
          {t('creditsLabel', { defaultValue: 'Credits to Redeem' })}
        </Label>
        <Input
          id="credits"
          type="number"
          min="1"
          max={balance}
          placeholder="0"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(t as any)('creditsHelper', {
            defaultValue: 'Maximum: {balance} credits',
            values: { balance: balance.toLocaleString() },
          })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          {t('notesLabel', { defaultValue: 'Notes (Optional)' })}
        </Label>
        <Textarea
          id="notes"
          placeholder={t('notesPlaceholder', {
            defaultValue: 'Add any special requests or notes...',
          })}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading || balance === 0} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === 'shopify'
          ? t('submitShopify', { defaultValue: 'Continue to Shop Moi Ça' })
          : t('submitManual', { defaultValue: 'Submit Redemption Request' })}
      </Button>

      {balance === 0 && (
        <p className="text-sm text-center text-muted-foreground">
          {t('noBalance', { defaultValue: 'You need credits to redeem' })}
        </p>
      )}
    </form>
  );
}

