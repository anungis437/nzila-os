/**
 * One exit interview as a signed-in person may read it, for the interview page.
 *
 * The page used to read the row through the module-level handle with no organization set (the runtime role saw nothing, so every interview
 * was "not found"), and, had it seen the row, it showed every field of every interview of the organization to anyone signed in. The API
 * route for the same record applies the interview's sensitivity floor, its consent flag and its workflow state, and withholds the workflow
 * fields from readers below steward; this applies exactly that (lib/knowledge-transfer/governance/interview-access.ts) so the page and the
 * route cannot disagree. An interview the caller may not read does not exist for them: the answer is null.
 */
import { and, eq } from 'drizzle-orm';
import { exitInterviews } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isUuid } from '@/lib/page-data/uuid';
import { canReadInterview, projectInterview, resolveInterviewReader } from './interview-access';

export type ExitInterviewRow = typeof exitInterviews.$inferSelect;

export async function readExitInterview(input: {
  organizationId: string;
  userId: string;
  interviewId: string;
  /** Whether the caller holds the steward floor or above. */
  stewardPlus: boolean;
  hasMinRole: (role: string) => Promise<boolean>;
}): Promise<Partial<ExitInterviewRow> | null> {
  const { organizationId, userId, interviewId } = input;
  if (!isUuid(interviewId)) return null;

  // The caller's offices are decided first, outside the interview's transaction.
  const reader = await resolveInterviewReader(userId, input.stewardPlus, input.hasMinRole);

  const row = await withRLSContext({ organizationId }, async (tx) => {
    const [found] = await tx
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, interviewId), eq(exitInterviews.organizationId, organizationId)))
      .limit(1);
    return found ?? null;
  });
  if (!row || !canReadInterview(row, reader)) return null;

  return projectInterview(row, reader, row.createdBy === userId);
}
