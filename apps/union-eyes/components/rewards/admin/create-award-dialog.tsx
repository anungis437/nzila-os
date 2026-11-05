'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createAward } from '@/actions/rewards-actions';
import { createAwardSchema } from '@/lib/validation/rewards-schemas';

export interface AwardTypeOption {
  id: string;
  name: string;
  defaultCreditAmount: number;
}

/** An administrator sees members by name and e-mail address: the page that renders this checked that they may. */
export interface MemberOption {
  userId: string;
  name: string;
  email?: string;
}

interface CreateAwardDialogProps {
  /** The active program the award is created in; none, and there is nothing to create an award in. */
  programId: string | null;
  awardTypes: AwardTypeOption[];
  members: MemberOption[];
}

const SELECT_CLASS = 'w-full rounded-md border bg-background p-2 text-sm';

export function CreateAwardDialog({ programId, awardTypes, members }: CreateAwardDialogProps) {
  const t = useTranslations('rewards.review.create');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [awardTypeId, setAwardTypeId] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const unavailable = !programId || awardTypes.length === 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    // The same schema the action validates with.
    const parsed = createAwardSchema.safeParse({ programId, awardTypeId, recipientUserId, reason: reason.trim() });
    if (!parsed.success) {
      setError(t('invalid'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await createAward(parsed.data);
      if (!(result.success && 'data' in result && result.data?.id)) {
        setError(('error' in result && result.error) || t('failed'));
        return;
      }
      setOpen(false);
      setAwardTypeId('');
      setRecipientUserId('');
      setReason('');
      router.refresh();
    } catch {
      setError(t('failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={unavailable} title={unavailable ? t('unavailable') : undefined}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="create-award-recipient">{t('recipient')}</Label>
            <select
              id="create-award-recipient"
              className={SELECT_CLASS}
              value={recipientUserId}
              onChange={(event) => setRecipientUserId(event.target.value)}
              disabled={submitting}
            >
              <option value="">{t('selectRecipient')}</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.email ? `${member.name} (${member.email})` : member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-award-type">{t('awardType')}</Label>
            <select
              id="create-award-type"
              className={SELECT_CLASS}
              value={awardTypeId}
              onChange={(event) => setAwardTypeId(event.target.value)}
              disabled={submitting}
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
            <Label htmlFor="create-award-reason">{t('reason')}</Label>
            <Textarea
              id="create-award-reason"
              value={reason}
              placeholder={t('reasonPlaceholder')}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              disabled={submitting}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
