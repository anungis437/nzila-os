'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, Gift } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { approveAward, issueAward, rejectAward } from '@/actions/rewards-actions';

export interface QueuedAward {
  id: string;
  recipientUserId: string;
  issuerUserId: string | null;
  reason: string;
  createdAt: Date | string;
  awardType?: { name: string; defaultCreditAmount: number } | null;
  awardTypeId: string;
}

interface AwardsQueueProps {
  awards: QueuedAward[];
  status: 'pending_approval' | 'approved' | 'issued';
  /** Member names by user id: a person is shown by name, and by id only when they are not a member any more. */
  names?: Record<string, string>;
}

type Decision = 'approve' | 'issue' | 'reject';

export function AwardsQueue({ awards, status, names = {} }: AwardsQueueProps) {
  const t = useTranslations('rewards.admin.awards');
  const tr = useTranslations('rewards.review');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  const who = (userId: string | null) => (userId ? (names[userId] ?? userId) : '—');

  async function decide(award: QueuedAward, decision: Decision, reason?: string) {
    setBusyId(award.id);
    setFailure(null);
    try {
      const result =
        decision === 'approve'
          ? await approveAward({ awardId: award.id })
          : decision === 'issue'
            ? await issueAward({ awardId: award.id })
            : await rejectAward({ awardId: award.id, reason });

      if (!result.success) {
        setFailure({ id: award.id, message: ('error' in result && result.error) || tr('failed') });
        return;
      }
      setRejecting(null);
      router.refresh();
    } catch {
      setFailure({ id: award.id, message: tr('failed') });
    } finally {
      setBusyId(null);
    }
  }

  if (awards.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('queue.empty')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('queue.columns.recipient')}</TableHead>
            <TableHead>{tr('nominatedBy')}</TableHead>
            <TableHead>{t('queue.columns.award')}</TableHead>
            <TableHead>{t('queue.columns.credits')}</TableHead>
            <TableHead>{tr('reason')}</TableHead>
            <TableHead>{t('queue.columns.date')}</TableHead>
            <TableHead className="text-right">{t('queue.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {awards.map((award) => {
            const busy = busyId === award.id;
            const rejectingThis = rejecting?.id === award.id;
            return (
              <TableRow key={award.id}>
                <TableCell className="font-medium">{who(award.recipientUserId)}</TableCell>
                <TableCell>{who(award.issuerUserId)}</TableCell>
                <TableCell>{award.awardType?.name ?? award.awardTypeId}</TableCell>
                <TableCell>{award.awardType?.defaultCreditAmount ?? '—'}</TableCell>
                <TableCell className="max-w-xs whitespace-pre-wrap break-words text-sm">{award.reason}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(award.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  {status === 'pending_approval' && !rejectingThis && (
                    <>
                      <Button size="sm" variant="default" disabled={busy} onClick={() => decide(award, 'approve')}>
                        <CheckCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                        {t('queue.actions.approve')}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting({ id: award.id, reason: '' })}>
                        <XCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                        {t('queue.actions.reject')}
                      </Button>
                    </>
                  )}
                  {status === 'pending_approval' && rejectingThis && rejecting && (
                    <form
                      className="flex items-end justify-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void decide(award, 'reject', rejecting.reason.trim());
                      }}
                    >
                      <div className="text-left">
                        <Label htmlFor={`reject-reason-${award.id}`} className="text-xs">
                          {tr('rejectReason')}
                        </Label>
                        <Input
                          id={`reject-reason-${award.id}`}
                          value={rejecting.reason}
                          placeholder={tr('rejectReasonPlaceholder')}
                          onChange={(event) => setRejecting({ id: award.id, reason: event.target.value })}
                          disabled={busy}
                          required
                        />
                      </div>
                      <Button size="sm" type="submit" variant="destructive" disabled={busy || !rejecting.reason.trim()}>
                        {tr('confirmReject')}
                      </Button>
                      <Button size="sm" type="button" variant="outline" disabled={busy} onClick={() => setRejecting(null)}>
                        {tr('cancel')}
                      </Button>
                    </form>
                  )}
                  {status === 'approved' && (
                    <Button size="sm" variant="default" disabled={busy} onClick={() => decide(award, 'issue')}>
                      <Gift className="h-4 w-4 mr-1" aria-hidden="true" />
                      {t('queue.actions.issue')}
                    </Button>
                  )}
                  {failure?.id === award.id && (
                    <p role="alert" className="text-sm text-destructive text-left">
                      {failure.message}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
