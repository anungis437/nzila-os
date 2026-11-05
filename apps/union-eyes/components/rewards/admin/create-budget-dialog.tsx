'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createBudgetEnvelope } from '@/actions/rewards-actions';
import { createBudgetEnvelopeSchema } from '@/lib/validation/rewards-schemas';

export interface BudgetProgramOption {
  id: string;
  name: string;
}

interface CreateBudgetDialogProps {
  /** The programs a budget can be made for: the organization's own, archived ones left out. */
  programs: BudgetProgramOption[];
}

type Period = 'monthly' | 'quarterly' | 'annual';
const SELECT_CLASS = 'w-full rounded-md border bg-background p-2 text-sm';

/** The first instant of the first day and the last instant of the last day, in UTC, so that a budget covers whole days. */
const startOfDay = (date: string) => `${date}T00:00:00.000Z`;
const endOfDay = (date: string) => `${date}T23:59:59.999Z`;

export function CreateBudgetDialog({ programs }: CreateBudgetDialogProps) {
  const t = useTranslations('rewards.admin.budgets.create');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [programId, setProgramId] = useState('');
  const [name, setName] = useState('');
  const [period, setPeriod] = useState<Period>('annual');
  const [amount, setAmount] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const unavailable = programs.length === 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    // The same schema the action validates with; the budget is for the whole organization (a local, department or manager scope needs a reference this form has no way to pick).
    const parsed = createBudgetEnvelopeSchema.safeParse({
      programId,
      name: name.trim(),
      scopeType: 'org',
      period,
      amountLimit: Number(amount),
      startsAt: startsOn ? startOfDay(startsOn) : '',
      endsAt: endsOn ? endOfDay(endsOn) : '',
    });
    if (!parsed.success) {
      const endBeforeStart = parsed.error.issues.some((issue) => issue.path[0] === 'endsAt') && Boolean(startsOn) && Boolean(endsOn);
      setError(endBeforeStart ? t('endBeforeStart') : t('invalid'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await createBudgetEnvelope(parsed.data);
      if (!(result.success && 'data' in result && result.data?.id)) {
        setError(('error' in result && result.error) || t('failed'));
        return;
      }
      setOpen(false);
      setProgramId('');
      setName('');
      setAmount('');
      setStartsOn('');
      setEndsOn('');
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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="budget-program">{t('program')}</Label>
            <select id="budget-program" className={SELECT_CLASS} value={programId} onChange={(event) => setProgramId(event.target.value)} disabled={submitting}>
              <option value="">{t('selectProgram')}</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-name">{t('name')}</Label>
            <Input id="budget-name" value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-period">{t('period')}</Label>
              <select id="budget-period" className={SELECT_CLASS} value={period} onChange={(event) => setPeriod(event.target.value as Period)} disabled={submitting}>
                <option value="monthly">{t('periodMonthly')}</option>
                <option value="quarterly">{t('periodQuarterly')}</option>
                <option value="annual">{t('periodAnnual')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-amount">{t('amount')}</Label>
              <Input id="budget-amount" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-starts">{t('startsOn')}</Label>
              <Input id="budget-starts" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-ends">{t('endsOn')}</Label>
              <Input id="budget-ends" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} disabled={submitting} />
            </div>
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
