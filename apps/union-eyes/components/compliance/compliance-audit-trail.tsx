'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiShapeError, readApiError } from '@/lib/client/api-envelope';
import { readAuditTrail, summarizeAuditTrail, type AuditTrailEntry } from './audit-trail-readers';

type LoadState =
  | { status: 'loading' }
  | { status: 'failed'; reason: 'server'; message: string }
  | { status: 'failed'; reason: 'unexpected' | 'generic' }
  | { status: 'ready'; entries: AuditTrailEntry[] };

const severityVariant = (severity: string) =>
  severity === 'critical' || severity === 'error' ? 'destructive' : severity === 'warning' ? 'secondary' : 'outline';

const outcomeVariant = (outcome: string) => (outcome === 'success' ? 'outline' : 'destructive');

/** The audit entries recorded for the organization, read from /api/compliance/audit-logs; nothing on the page is computed from anything else. */
export function ComplianceAuditTrail() {
  const t = useTranslations('complianceAdminPage');
  const locale = useLocale();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const response = await fetch('/api/compliance/audit-logs', { cache: 'no-store' });
      if (!response.ok) {
        const message = await readApiError(response, '');
        setState(message ? { status: 'failed', reason: 'server', message } : { status: 'failed', reason: 'generic' });
        return;
      }
      setState({ status: 'ready', entries: readAuditTrail(await response.json()) });
    } catch (error) {
      setState({ status: 'failed', reason: error instanceof ApiShapeError ? 'unexpected' : 'generic' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formatWhen = (value: Date | null) =>
    value === null ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value);

  const summary = state.status === 'ready' ? summarizeAuditTrail(state.entries) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>{t('auditTrailTitle')}</CardTitle>
          <CardDescription>{t('auditTrailDescription')}</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={state.status === 'loading'}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('refresh')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === 'loading' && <p className="text-sm text-muted-foreground">{t('loading')}</p>}

        {state.status === 'failed' && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.reason === 'server' ? state.message : state.reason === 'unexpected' ? t('errors.unexpectedResponse') : t('errors.loadFailed')}
          </div>
        )}

        {state.status === 'ready' && summary && (
          <>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">{t('summary.shown')}</dt>
                <dd className="text-2xl font-bold">{summary.total}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('summary.unsuccessful')}</dt>
                <dd className="text-2xl font-bold">{summary.unsuccessful}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('summary.severe')}</dt>
                <dd className="text-2xl font-bold">{summary.severe}</dd>
              </div>
            </dl>

            {state.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.when')}</TableHead>
                    <TableHead>{t('columns.action')}</TableHead>
                    <TableHead>{t('columns.resource')}</TableHead>
                    <TableHead>{t('columns.actor')}</TableHead>
                    <TableHead>{t('columns.severity')}</TableHead>
                    <TableHead>{t('columns.outcome')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.entries.map((entry) => (
                    <TableRow key={entry.auditId}>
                      <TableCell className="whitespace-nowrap">{formatWhen(entry.recordedAt)}</TableCell>
                      <TableCell className="font-medium">{entry.action}</TableCell>
                      <TableCell>
                        {entry.resourceType}
                        {entry.resourceId ? <span className="ml-1 text-xs text-muted-foreground">{entry.resourceId.slice(0, 8)}</span> : null}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate" title={entry.actor ?? undefined}>
                        {entry.actor}
                      </TableCell>
                      <TableCell>{entry.severity ? <Badge variant={severityVariant(entry.severity)}>{entry.severity}</Badge> : null}</TableCell>
                      <TableCell>{entry.outcome ? <Badge variant={outcomeVariant(entry.outcome)}>{entry.outcome}</Badge> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
