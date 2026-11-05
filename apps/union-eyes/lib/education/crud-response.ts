/**
 * The generic CRUD factory returns {data: rows, pagination} inside withApi's
 * {success: true, data: ...} envelope. Never mistake a successful HTTP status
 * or an empty fallback for proof that records were loaded or written.
 */
export function readEducationCrudRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object' || !('success' in payload) ||
      payload.success !== true || !('data' in payload) ||
      !payload.data || typeof payload.data !== 'object' ||
      !('data' in payload.data) || !Array.isArray(payload.data.data)) {
    throw new Error('Invalid education CRUD list response');
  }
  return payload.data.data as Record<string, unknown>[];
}

export function assertEducationRegistrationCreated(
  payload: unknown, courseId: string, sessionId: string,
): void {
  if (!payload || typeof payload !== 'object' || !('success' in payload) ||
      payload.success !== true || !('data' in payload) ||
      !payload.data || typeof payload.data !== 'object' ||
      !('data' in payload.data) || !payload.data.data ||
      typeof payload.data.data !== 'object') {
    throw new Error('Registration was not confirmed');
  }
  const row = payload.data.data;
  if (!('id' in row) || typeof row.id !== 'string' ||
      !('courseId' in row) || row.courseId !== courseId ||
      !('sessionId' in row) || row.sessionId !== sessionId) {
    throw new Error('Registration identity mismatch');
  }
}
