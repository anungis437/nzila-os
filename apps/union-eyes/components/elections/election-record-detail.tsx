'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { api, ApiRequestError, type CouncilElectionRecord } from '@/lib/api/index';
import { ELECTION_VOTING_CAPABILITY, electionCopy, type ElectionCopy } from './election-copy';
import { ElectionLoadError } from './election-load-error';
import { electionPaths, formatElectionDate, hasRecordedResults, isCertified, readEntry } from './election-records';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; record: CouncilElectionRecord }
  | { status: 'error'; httpStatus: number | null };

/** A per-entry vote count is a recorded result, so it is shown only when the record has recorded results. */
function EntryList({ entries, copy, showVotes }: { entries: unknown[]; copy: ElectionCopy['detail']; showVotes: boolean }) {
  return (
    <ul className="space-y-3">
      {entries.map((entry, index) => {
        const item = readEntry(entry);
        const details = [
          item.union ? `${copy.union}: ${item.union}` : null,
          showVotes && item.votes !== undefined ? copy.votes(item.votes) : null,
          item.termStart && item.termEnd ? copy.term(item.termStart, item.termEnd) : null,
        ].filter((detail): detail is string => detail !== null);
        return (
          <li key={index} className="border-l-4 border-primary pl-4">
            <p className="font-medium">{item.name}</p>
            {details.length > 0 ? <p className="text-sm text-muted-foreground">{details.join(' · ')}</p> : null}
            {item.platform ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.platform}: {item.platform}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/**
 * One council election record. There is no ballot, "already voted" banner, turnout bar or results export: the vote
 * route answers 501 and no results route exists, so the voting section says it is unavailable instead of offering it.
 * Winners, votes and participation are shown only as figures staff recorded.
 */
export function ElectionRecordDetail({ electionId }: { electionId: string }) {
  const locale = useLocale();
  const copy = electionCopy(locale);
  const paths = electionPaths(locale);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.elections.get(electionId).then(
      (record) => {
        if (!cancelled) setState({ status: 'ready', record });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', httpStatus: error instanceof ApiRequestError ? error.status : null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [electionId, attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  };

  const back = (
    <Button asChild variant="ghost" size="sm">
      <Link href={paths.list}>
        <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
        {copy.detail.back}
      </Link>
    </Button>
  );

  if (state.status === 'loading') {
    return (
      <div className="container mx-auto py-6">
        <p role="status" className="text-muted-foreground">
          {copy.shared.loading}
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="container mx-auto py-6 space-y-4">
        {back}
        <ElectionLoadError copy={copy.shared} httpStatus={state.httpStatus} onRetry={retry} />
      </div>
    );
  }

  const { record } = state;
  const certified = isCertified(record);
  const resultsRecorded = hasRecordedResults(record);
  const participation = record.participationRate ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{copy.detail.heading(record.electionYear)}</h1>
          <Badge variant={certified ? 'success' : 'outline'}>
            {certified ? copy.shared.certified : copy.shared.notCertified}
          </Badge>
          {record.contestedResults ? <Badge variant="destructive">{copy.shared.contested}</Badge> : null}
        </div>
        {record.contestedResults ? <p className="text-sm text-muted-foreground">{copy.detail.contestedNotice}</p> : null}
      </div>

      <Card className="p-6">
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Fact label={copy.detail.electionDate}>{formatElectionDate(record.electionDate, locale)}</Fact>
          <Fact label={copy.detail.positions}>{record.positionsAvailable}</Fact>
          <Fact label={copy.detail.candidatesEntered}>{record.candidates.length}</Fact>
          <Fact label={copy.detail.verifiedBy}>{record.verifiedBy || copy.shared.notRecorded}</Fact>
          <Fact label={copy.detail.verificationDate}>
            {record.verificationDate ? formatElectionDate(record.verificationDate, locale) : copy.shared.notRecorded}
          </Fact>
        </dl>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{copy.detail.candidates}</h2>
        {record.candidates.length > 0 ? (
          <EntryList entries={record.candidates} copy={copy.detail} showVotes={resultsRecorded} />
        ) : (
          <p className="text-muted-foreground">{copy.detail.noCandidates}</p>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{copy.detail.results}</h2>
        {resultsRecorded ? (
          <>
            <p className="text-sm text-muted-foreground">{copy.detail.resultsNote}</p>
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Fact label={copy.detail.totalVotes}>{record.totalVotes > 0 ? record.totalVotes : copy.shared.notRecorded}</Fact>
              <Fact label={copy.detail.participation}>
                {participation > 0 ? `${participation}%` : copy.shared.notRecorded}
              </Fact>
            </dl>
            <h3 className="font-medium">{copy.detail.winners}</h3>
            {record.winners.length > 0 ? (
              <EntryList entries={record.winners} copy={copy.detail} showVotes />
            ) : (
              <p className="text-muted-foreground">{copy.detail.noWinners}</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">{copy.detail.noResults}</p>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{copy.detail.voting}</h2>
        <CapabilityUnavailable locale={locale} capability={ELECTION_VOTING_CAPABILITY} />
      </Card>
    </div>
  );
}
