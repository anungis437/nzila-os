'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiRequestError, type CouncilElectionRecord } from '@/lib/api/index';
import { electionCopy } from './election-copy';
import { ElectionLoadError } from './election-load-error';
import { electionPaths, formatElectionDate, hasRecordedResults, isCertified } from './election-records';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; elections: CouncilElectionRecord[] }
  | { status: 'error'; httpStatus: number | null };

/**
 * Council election records as stored. There is no turnout, "active" status or eligible-voter count: the table has none,
 * and a figure the data cannot supply is not shown. The create action appears only once the records have loaded, because
 * the same platform-staff gate protects both: a person who cannot read them is not offered a form that will be refused.
 */
export function ElectionRecordsList() {
  const locale = useLocale();
  const copy = electionCopy(locale);
  const paths = electionPaths(locale);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.elections.list().then(
      (elections) => {
        if (!cancelled) setState({ status: 'ready', elections });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', httpStatus: error instanceof ApiRequestError ? error.status : null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{copy.list.title}</h1>
          <p className="text-muted-foreground">{copy.list.subtitle}</p>
        </div>
        {state.status === 'ready' ? (
          <Button asChild>
            <Link href={paths.create}>
              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
              {copy.list.create}
            </Link>
          </Button>
        ) : null}
      </div>

      <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {copy.list.notice}
      </div>

      {state.status === 'loading' ? (
        <p role="status" className="text-muted-foreground">
          {copy.shared.loading}
        </p>
      ) : null}

      {state.status === 'error' ? (
        <ElectionLoadError copy={copy.shared} httpStatus={state.httpStatus} onRetry={retry} />
      ) : null}

      {state.status === 'ready' && state.elections.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">{copy.list.empty}</Card>
      ) : null}

      {state.status === 'ready' && state.elections.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.list.year}</TableHead>
                <TableHead>{copy.list.date}</TableHead>
                <TableHead>{copy.list.positions}</TableHead>
                <TableHead>{copy.list.candidates}</TableHead>
                <TableHead>{copy.list.certification}</TableHead>
                <TableHead>{copy.list.votes}</TableHead>
                <TableHead>{copy.list.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.elections.map((election) => (
                <TableRow key={election.id}>
                  <TableCell className="font-medium">{election.electionYear}</TableCell>
                  <TableCell>{formatElectionDate(election.electionDate, locale)}</TableCell>
                  <TableCell>{election.positionsAvailable}</TableCell>
                  <TableCell>{election.candidates.length}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={isCertified(election) ? 'success' : 'outline'}>
                        {isCertified(election) ? copy.shared.certified : copy.shared.notCertified}
                      </Badge>
                      {election.contestedResults ? <Badge variant="destructive">{copy.shared.contested}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>{hasRecordedResults(election) ? election.totalVotes : copy.shared.notRecorded}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={paths.detail(election.id)}>{copy.list.view}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
