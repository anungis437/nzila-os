'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { initiateRedemption } from '@/actions/rewards-actions';
import { initiateRedemptionSchema } from '@/lib/validation/rewards-schemas';

interface RedemptionFormProps {
  balance: number;
  mode: 'shopify' | 'manual';
  /** The organization's active rewards program: the redemption is recorded against it. */
  programId: string;
  /** Where the member is sent to check out; the page leaves this out and the browser navigates. */
  navigate?: (url: string) => void;
}

const goTo = (url: string) => window.location.assign(url);

export function RedemptionForm({ balance, mode, programId, navigate = goTo }: RedemptionFormProps) {
  const t = useTranslations('rewards.redeem.form');
  const tr = useTranslations('rewards.redemption');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState('');
  const [notes, setNotes] = useState('');
  const [recorded, setRecorded] = useState<{ credits: number } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setRecorded(null);

    // Exactly what the action accepts, checked with the schema the action checks with.
    const parsed = initiateRedemptionSchema.safeParse({
      programId,
      creditsToSpend: Number(credits),
      providerDetails: notes.trim() ? { requestNotes: notes.trim() } : undefined,
    });
    if (!parsed.success) {
      setError(t('errors.invalidAmount'));
      return;
    }
    if (parsed.data.creditsToSpend > balance) {
      setError(t('errors.insufficientBalance'));
      return;
    }

    setLoading(true);
    try {
      const result = await initiateRedemption(parsed.data);

      // Credits were spent only when the action returns the redemption it recorded.
      if (!(result.success && 'data' in result && result.data?.id)) {
        setError(('error' in result && result.error) || t('errors.failed'));
        return;
      }

      const checkoutUrl = result.data.checkout_url;
      if (mode === 'shopify' && checkoutUrl) {
        // The server built this address on the configured store and checked it; it is not a value from the form.
        navigate(checkoutUrl);
        return;
      }

      setRecorded({ credits: parsed.data.creditsToSpend });
      setCredits('');
      setNotes('');
      router.refresh();
    } catch {
      setError(t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {recorded && (
        <Alert role="status">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{tr('recorded', { credits: recorded.credits.toLocaleString() })}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="credits">{t('creditsLabel')}</Label>
        <Input
          id="credits"
          type="number"
          min="1"
          max={balance}
          step="1"
          placeholder="0"
          value={credits}
          onChange={(event) => setCredits(event.target.value)}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">{t('creditsHelper', { balance: balance.toLocaleString() })}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{t('notesLabel')}</Label>
        <Textarea
          id="notes"
          placeholder={t('notesPlaceholder')}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={loading}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading || balance === 0} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === 'shopify' ? t('submitShopify') : t('submitManual')}
      </Button>

      {balance === 0 && <p className="text-sm text-center text-muted-foreground">{t('noBalance')}</p>}
    </form>
  );
}
