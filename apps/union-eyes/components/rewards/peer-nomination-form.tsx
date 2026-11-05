'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { nominatePeer } from '@/actions/rewards-actions';
import { nominatePeerSchema } from '@/lib/validation/rewards-schemas';

export interface PeerAwardTypeOption {
  id: string;
  name: string;
  defaultCreditAmount: number;
}

/** A colleague a nomination can name: a name and the id the server resolves, nothing else about them. */
export interface PeerCandidate {
  userId: string;
  name: string;
}

interface PeerNominationFormProps {
  /** The peer award types of the active program. The server accepts nothing else, whatever the form sends. */
  awardTypes: PeerAwardTypeOption[];
  candidates: PeerCandidate[];
  currentUserId: string;
  onSuccess?: () => void;
}

const MAX_REASON_LENGTH = 500;
const SELECT_CLASS = 'w-full rounded-md border bg-background p-2 text-sm';

export function PeerNominationForm({ awardTypes, candidates, currentUserId, onSuccess }: PeerNominationFormProps) {
  const t = useTranslations('rewards.peer');
  const router = useRouter();
  const [awardTypeId, setAwardTypeId] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const colleagues = candidates.filter((candidate) => candidate.userId !== currentUserId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitted(false);

    // The same schema the action validates with: what is sent is exactly what the action accepts.
    const parsed = nominatePeerSchema.safeParse({ awardTypeId, recipientUserId, reason });
    if (!parsed.success) {
      setError(t('validation.allFieldsRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await nominatePeer(parsed.data);

      // A success is a row written: the action returns the nomination it stored, and without one nothing is reported as submitted.
      if (result.success && 'data' in result && result.data?.id) {
        setSubmitted(true);
        setAwardTypeId('');
        setRecipientUserId('');
        setReason('');
        onSuccess?.();
      } else {
        setError(('error' in result && result.error) || t('error.submit'));
      }
    } catch {
      setError(t('error.submit'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (awardTypes.length === 0) {
    return (
      <Alert>
        <AlertDescription>{t('noPeerAwards')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nomination-recipient">{t('recipient')}</Label>
            <select
              id="nomination-recipient"
              className={SELECT_CLASS}
              value={recipientUserId}
              onChange={(event) => setRecipientUserId(event.target.value)}
              disabled={isSubmitting || colleagues.length === 0}
            >
              <option value="">{colleagues.length === 0 ? t('noMembers') : t('selectRecipient')}</option>
              {colleagues.map((colleague) => (
                <option key={colleague.userId} value={colleague.userId}>
                  {colleague.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomination-award-type">{t('awardType')}</Label>
            <select
              id="nomination-award-type"
              className={SELECT_CLASS}
              value={awardTypeId}
              onChange={(event) => setAwardTypeId(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">{t('selectAwardType')}</option>
              {awardTypes.map((awardType) => (
                <option key={awardType.id} value={awardType.id}>
                  {awardType.name} ({awardType.defaultCreditAmount})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomination-reason">{t('message')}</Label>
            <Textarea
              id="nomination-reason"
              placeholder={t('messagePlaceholder')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={6}
              maxLength={MAX_REASON_LENGTH}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground text-right">
              {reason.length}/{MAX_REASON_LENGTH}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {submitted && (
            <Alert role="status">
              <AlertDescription className="text-green-700">{t('success')}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
