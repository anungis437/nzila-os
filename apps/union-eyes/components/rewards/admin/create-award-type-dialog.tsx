'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createRecognitionAwardType } from '@/actions/rewards-actions';
import { createAwardTypeSchema } from '@/lib/validation/rewards-schemas';

interface CreateAwardTypeDialogProps {
  programId: string;
  programName: string;
  onClose: () => void;
}

const SELECT_CLASS = 'w-full rounded-md border bg-background p-2 text-sm';

/**
 * Adds an award type to a program. Peer types are what members nominate colleagues for; admin types are what administrators award.
 * Milestone and automated types are created by the automation rules, not here.
 */
export function CreateAwardTypeDialog({ programId, programName, onClose }: CreateAwardTypeDialogProps) {
  const t = useTranslations('rewards.admin.programs.awardType');
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'peer' | 'admin'>('peer');
  const [credits, setCredits] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    // The same schema the action validates with.
    const parsed = createAwardTypeSchema.safeParse({
      programId,
      name: name.trim(),
      kind,
      defaultCreditAmount: Number(credits),
      requiresApproval,
    });
    if (!parsed.success) {
      setError(t('invalid'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await createRecognitionAwardType(parsed.data);
      if (!(result.success && 'data' in result && result.data?.id)) {
        setError(('error' in result && result.error) || t('failed'));
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError(t('failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title', { program: programName })}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="award-type-name">{t('name')}</Label>
            <Input
              id="award-type-name"
              value={name}
              placeholder={t('namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="award-type-kind">{t('kind')}</Label>
            <select
              id="award-type-kind"
              className={SELECT_CLASS}
              value={kind}
              onChange={(event) => setKind(event.target.value as 'peer' | 'admin')}
              disabled={submitting}
            >
              <option value="peer">{t('kindPeer')}</option>
              <option value="admin">{t('kindAdmin')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="award-type-credits">{t('credits')}</Label>
            <Input
              id="award-type-credits"
              type="number"
              min="1"
              step="1"
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="award-type-approval"
              type="checkbox"
              checked={requiresApproval}
              onChange={(event) => setRequiresApproval(event.target.checked)}
              disabled={submitting}
            />
            <Label htmlFor="award-type-approval">{t('requiresApproval')}</Label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
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
