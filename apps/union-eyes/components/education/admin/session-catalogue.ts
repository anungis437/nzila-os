/**
 * Strict adapter for the generic tenant-scoped education-session collection.
 * An HTTP 2xx with a malformed/truncated page is not a valid session catalogue.
 * Do not infer that a 100-row page is the complete catalogue.
 */
export interface EducationSessionSummary {
  id: string;
  organizationId: string;
  sessionCode: string;
  sessionName: string;
  startDate: string;
}

export interface EducationSessionPage {
  sessions: EducationSessionSummary[];
  page: number;
  totalPages: number;
}

export async function loadEducationSessionPage(
  organizationId: string,
  page: number,
  request: typeof fetch = fetch,
): Promise<EducationSessionPage> {
  if (!organizationId || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
    throw new Error('Invalid session catalogue scope or page');
  }
  const response = await request(`/api/education/sessions?page=${page}&limit=100`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Session catalogue unavailable');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('Session catalogue envelope missing');
  }
  const body = (payload as { data: unknown }).data;
  if (!body || typeof body !== 'object' || !('data' in body) || !('pagination' in body)) {
    throw new Error('Session catalogue body missing');
  }
  const rows = (body as { data: unknown }).data;
  const pagination = (body as { pagination: unknown }).pagination;
  if (!Array.isArray(rows) || !pagination || typeof pagination !== 'object') {
    throw new Error('Session catalogue pagination missing');
  }
  const metadata = pagination as Record<string, unknown>;
  const total = metadata.total;
  const totalPages = metadata.totalPages;
  if (metadata.page !== page || metadata.limit !== 100 ||
    !Number.isSafeInteger(total) || (total as number) < 0 ||
    !Number.isSafeInteger(totalPages) || (totalPages as number) < 0 ||
    totalPages !== Math.ceil((total as number) / 100) ||
    rows.length > 100 || rows.length > (total as number)) {
    throw new Error('Session catalogue pagination invalid');
  }
  const sessions: EducationSessionSummary[] = rows.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Session catalogue row invalid');
    const record = row as Record<string, unknown>;
    if (record.organizationId !== organizationId ||
      typeof record.id !== 'string' || !record.id ||
      typeof record.sessionCode !== 'string' ||
      typeof record.sessionName !== 'string' ||
      typeof record.startDate !== 'string') {
      throw new Error('Session catalogue row is incomplete or from another organization');
    }
    return {
      id: record.id,
      organizationId,
      sessionCode: record.sessionCode,
      sessionName: record.sessionName,
      startDate: record.startDate,
    };
  });
  return { sessions, page, totalPages: totalPages as number };
}
