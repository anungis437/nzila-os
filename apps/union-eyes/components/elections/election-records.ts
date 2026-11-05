import type { CouncilElectionRecord } from '@/lib/api/index';
import { formatDay } from '@/lib/client/day';

type Certifiable = Pick<CouncilElectionRecord, 'verifiedBy' | 'verificationDate'>;
type Resultable = Certifiable & Pick<CouncilElectionRecord, 'winners' | 'totalVotes' | 'participationRate'>;

/** The rule the server applies before it locks a record's results (lib/voting/election-certification.ts). */
export function isCertified(record: Certifiable): boolean {
  return Boolean(record.verifiedBy) || Boolean(record.verificationDate);
}

/**
 * A new record starts with no winners and zero votes, which means "nothing recorded", not "nobody voted". Participation
 * is written as 0 by one of the entry forms when it is left blank, so only a positive value counts as recorded.
 */
export function hasRecordedResults(record: Resultable): boolean {
  return (
    isCertified(record) ||
    record.winners.length > 0 ||
    record.totalVotes > 0 ||
    (record.participationRate ?? 0) > 0
  );
}

export function electionPaths(locale: string) {
  const list = `/${locale}/dashboard/elections`;
  return { list, create: `${list}/new`, detail: (id: string) => `${list}/${encodeURIComponent(id)}` };
}

/** `YYYY-MM-DD` as the day it names. Parsing it as UTC would show the previous day west of Greenwich. */
export function formatElectionDate(value: string, locale: string): string {
  return formatDay(value, locale, 'long');
}

export interface RecordedEntry {
  name: string;
  union?: string;
  platform?: string;
  votes?: number;
  termStart?: string;
  termEnd?: string;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Candidates and winners are free-form JSON. An entry that has no readable name is shown as the JSON it is, so
 * nothing stored is hidden and nothing is invented.
 */
export function readEntry(entry: unknown): RecordedEntry {
  if (typeof entry === 'string') return { name: entry };
  if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
    const fields = entry as Record<string, unknown>;
    const name = text(fields.name);
    if (name) {
      return {
        name,
        union: text(fields.union),
        platform: text(fields.platform),
        votes: count(fields.votes),
        termStart: text(fields.term_start) ?? text(fields.termStart),
        termEnd: text(fields.term_end) ?? text(fields.termEnd),
      };
    }
  }
  return { name: JSON.stringify(entry) };
}
