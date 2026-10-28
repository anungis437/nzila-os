import { sql, type SQL } from 'drizzle-orm';
import { exitInterviews, knowledgeBase } from '@/db/schema';
import { readableSensitivityLevels } from './consent-controls';

/**
 * Who may read an exit interview, and what of it.
 *
 * An interview carries the retiring employee's name, their reasons, the full narrative, an AI summary, a risk score and
 * attachments. Its sensitivity level says which offices may read it (SENSITIVITY_MIN_ROLE) and its consent flag says
 * whether it may be shared at all. Both follow the interview wherever a copy or a derivative of it is read.
 *
 * An interview with no recorded level is read as `restricted`, never as public.
 */
export const UNRECORDED_LEVEL = 'restricted';

export interface InterviewReader {
  userId: string | null;
  stewardPlus: boolean;
  /** Sensitivity levels this reader's role may read. */
  levels: ReadonlySet<string>;
}

export async function resolveInterviewReader(
  userId: string | null,
  stewardPlus: boolean,
  hasMinRole: (role: string) => Promise<boolean>,
): Promise<InterviewReader> {
  return { userId, stewardPlus, levels: new Set(await readableSensitivityLevels(hasMinRole)) };
}

export interface InterviewAccessFacts {
  status: string;
  createdBy: string | null;
  sensitivityLevel: string | null;
  consentGranted: boolean | null;
}

export function canReadInterview(row: InterviewAccessFacts, reader: InterviewReader): boolean {
  const isOwner = row.createdBy !== null && row.createdBy === reader.userId;
  const level = row.sensitivityLevel ?? UNRECORDED_LEVEL;
  // The author may read their own draft whatever its level; nobody else reads above their office.
  if (!isOwner && !reader.levels.has(level)) return false;
  const finished = row.status === 'published' || row.status === 'archived';
  if (!finished) return isOwner || reader.stewardPlus;
  // A finished interview is shared with the organization only with the retiring employee's consent.
  return isOwner || reader.stewardPlus || row.consentGranted === true;
}

/** The same decision as a list predicate, so a list never returns a row the item route would refuse. */
export function interviewListCondition(reader: InterviewReader): SQL {
  const levels = [...reader.levels];
  const levelOk = levels.length
    ? sql`coalesce(${exitInterviews.sensitivityLevel}::text, ${UNRECORDED_LEVEL}) IN (${sql.join(levels.map((l) => sql`${l}`), sql`, `)})`
    : sql`false`;
  const owner = reader.userId ? sql`${exitInterviews.createdBy} = ${reader.userId}` : sql`false`;
  const finished = sql`${exitInterviews.status}::text IN ('published', 'archived')`;
  const visibleState = reader.stewardPlus ? sql`true` : sql`(${finished} AND ${exitInterviews.consentGranted} = true)`;
  return sql`((${owner}) OR (${levelOk} AND ${visibleState}))`;
}

/** What a reader below steward receives of an interview: the content they are entitled to, not the workflow around it. */
const PUBLIC_FIELDS = [
  'id', 'title', 'summary', 'topics', 'keyLessons', 'bestPractices', 'bargainingAdvice', 'mediationAdvice',
  'incomingOfficerAdvice', 'roleInUnion', 'yearsOfService', 'status', 'publishedAt', 'sensitivityLevel',
] as const;

export function projectInterview<T extends Record<string, unknown>>(row: T, reader: InterviewReader, isOwner: boolean): Partial<T> {
  if (reader.stewardPlus || isOwner) return row;
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_FIELDS) if (field in row) out[field] = row[field];
  return out as Partial<T>;
}

/**
 * The classification of an interview follows its knowledge-base copy. A row that was made from an interview is returned
 * only to the organization that owns the interview (never to a child organization through the parent link), and only when
 * the caller may read that interview's sensitivity level and the interview has consent. Other rows are unaffected.
 */
export function knowledgeBaseSourceCondition(reader: InterviewReader, organizationId: string): SQL {
  const levels = [...reader.levels];
  const levelList = levels.length ? sql.join(levels.map((l) => sql`${l}`), sql`, `) : sql`''`;
  return sql`(${knowledgeBase.sourceType} <> 'exit_interview' OR (
    ${knowledgeBase.organizationId} = ${organizationId}::uuid
    AND ${knowledgeBase.sourceId} IN (
      SELECT id::text FROM exit_interviews
      WHERE organization_id = ${organizationId}::uuid AND consent_granted = true
        AND coalesce(sensitivity_level::text, ${UNRECORDED_LEVEL}) IN (${levelList})
    )
  ))`;
}
