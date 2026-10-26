type Envelope = { data?: Envelope } & Record<string, unknown>;

/** Handlers wrap plain objects as { data: ... }; direct responses use the same envelope. */
export function pick<T>(payload: unknown, key: string): T | undefined {
  const p = payload as Envelope | null;
  return (p?.data?.[key] ?? p?.[key] ?? p?.data?.data?.[key]) as T | undefined;
}

/** The machine-readable code of an error response, when it has one. */
export async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { code?: string } | string; code?: string } | null;
    if (body && typeof body.error === 'object' && body.error?.code) return body.error.code;
    return typeof body?.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

export type AssignmentProblem = 'assignmentGone' | 'assignmentClosed' | 'assignmentIneligible' | 'assignmentConflict' | 'assignmentFailed';

/** Maps a failed assignment response to copy; a 404 means the authority or the conversation is gone, not "not found". */
export async function assignmentProblem(response: Response): Promise<AssignmentProblem> {
  if (response.status === 404 || response.status === 403) return 'assignmentGone';
  const code = await errorCode(response);
  if (code === 'THREAD_CLOSED') return 'assignmentClosed';
  if (code === 'ASSIGNEE_NOT_ELIGIBLE') return 'assignmentIneligible';
  if (response.status === 409) return 'assignmentConflict';
  return 'assignmentFailed';
}

export const MAX_SUBJECT = 200;
export const MAX_BODY = 5000;
