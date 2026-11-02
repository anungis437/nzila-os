import { describe, expect, it, vi } from 'vitest';
import { attendanceCsvCell, patchSessionAttendance } from '../attendance-client';

describe('attendance client evidence boundary', () => {
  it('uses the audited PATCH route with a registration id, never the nonexistent POST', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { id: 'reg-a', attended: true } }),
    });
    await patchSessionAttendance('session-a', 'reg-a', true, request as unknown as typeof fetch);
    expect(request).toHaveBeenCalledWith('/api/education/sessions/session-a/attendance',
      expect.objectContaining({
        method: 'PATCH', cache: 'no-store',
        body: JSON.stringify({ registrationId: 'reg-a', attended: true }),
      }));
  });

  it('refuses unsuccessful HTTP responses and unproven confirmations', async () => {
    for (const result of [
      { ok: false, json: async () => ({ data: { id: 'reg-a', attended: true } }) },
      { ok: true, json: async () => ({ message: 'success' }) },
      { ok: true, json: async () => ({ data: { id: 'reg-b', attended: true } }) },
      { ok: true, json: async () => ({ data: { id: 'reg-a', attended: false } }) },
    ]) {
      const request = vi.fn().mockResolvedValue(result);
      await expect(patchSessionAttendance('session-a', 'reg-a', true, request as unknown as typeof fetch))
        .rejects.toThrow();
    }
  });

  it('neutralizes CSV formulas and escapes quotes, commas and line breaks', () => {
    expect(attendanceCsvCell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
    expect(attendanceCsvCell('  +SUM(1,2)')).toBe('"\'  +SUM(1,2)"');
    expect(attendanceCsvCell('member,"name"')).toBe('"member,""name"""');
  });
});
