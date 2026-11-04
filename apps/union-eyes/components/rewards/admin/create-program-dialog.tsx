'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createRecognitionProgram } from '@/actions/rewards-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function CreateProgramDialog() {
  const t = useTranslations('rewards.admin.programs.create');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      status: (formData.get('status') as 'active' | 'draft') || 'draft',
    };

    try {
      const result = await createRecognitionProgram(data);
      
      if (!result.success) {
        setError(('error' in result && result.error) || t('error', { defaultValue: 'Failed to create program' }));
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message || t('errorUnknown', { defaultValue: 'An error occurred' }));
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('button', { defaultValue: 'Create Program' })}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title', { defaultValue: 'Create Recognition Program' })}</DialogTitle>
          <DialogDescription>
            {t('description', {
              defaultValue: 'Set up a new recognition program for your organization',
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              {t('fields.name', { defaultValue: 'Program Name' })} *
            </Label>
            <Input
              id="name"
              name="name"
              placeholder={t('fields.namePlaceholder', {
                defaultValue: 'e.g., Employee of the Month',
              })}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t('fields.description', { defaultValue: 'Description' })}
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder={t('fields.descriptionPlaceholder', {
                defaultValue: 'Describe the purpose and criteria of this program...',
              })}
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">
              {t('fields.status', { defaultValue: 'Status' })}
            </Label>
            <Select name="status" defaultValue="draft" disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  {t('fields.statusDraft', { defaultValue: 'Draft' })}
                </SelectItem>
                <SelectItem value="active">
                  {t('fields.statusActive', { defaultValue: 'Active' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {t('cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submit', { defaultValue: 'Create Program' })}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

