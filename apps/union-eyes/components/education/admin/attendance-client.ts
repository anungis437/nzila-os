/**
 * Only the audited, registration-scoped PATCH route can record attendance.
 * An HTTP 2xx without the matching persisted row is not proof of success.
 */
export async function patchSessionAttendance(
  sessionId: string,
  registrationId: string,
  attended: boolean,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(`/api/education/sessions/${encodeURIComponent(sessionId)}/attendance`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ registrationId, attended }),
  });
  if (!response.ok) throw new Error('Attendance update refused');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('Attendance confirmation missing');
  }
  const record = (payload as { data: unknown }).data;
  if (!record || typeof record !== 'object' ||
    (record as { id?: unknown }).id !== registrationId ||
    (record as { attended?: unknown }).attended !== attended) {
    throw new Error('Attendance confirmation does not match the requested registration');
  }
}

export function attendanceCsvCell(value: string): string {
  // Neutralize spreadsheet formulas, then escape quotes and delimiters.
  const neutralized = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}
