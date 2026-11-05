'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateRecognitionProgram } from '@/actions/rewards-actions';
import { updateProgramSchema } from '@/lib/validation/rewards-schemas';

export interface EditableProgram {
  id: string;
  name: string;
  description: string | null;
}

interface EditProgramDialogProps {
  program: EditableProgram;
  onClose: () => void;
}

/** Renamed and described by an administrator; the status is changed by archiving or activating the program, not here. */
export function EditProgramDialog({ program, onClose }: EditProgramDialogProps) {
  const t = useTranslations('rewards.admin.programs.edit');
  const router = useRouter();
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    // The same schema the action validates with.
    const parsed = updateProgramSchema.safeParse({ name: name.trim(), description: description.trim() });
    if (!parsed.success) {
      setError(t('invalid'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await updateRecognitionProgram(program.id, parsed.data);
      if (!(result.success && 'data' in result && result.data)) {
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
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="edit-program-name">{t('name')}</Label>
            <Input id="edit-program-name" value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-program-description">{t('descriptionLabel')}</Label>
            <Textarea
              id="edit-program-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              disabled={submitting}
            />
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
