// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemberSessionJoin } from '../MemberSessionJoin';

const sessionId = '11111111-1111-4111-8111-111111111111';
const response = (data: unknown, ok = true) => ({
  ok, json: async () => ({ success: true, data }),
});
const valid = { sessionId, joinUrl: 'https://meeting.example.test/room?token=PRIVATE', accessCode: 'SECRET' };

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('member registration-scoped virtual joining', () => {
  it('does not request or reveal joining credentials before explicit member action', async () => {
    render(<MemberSessionJoin sessionId={sessionId} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText(/SECRET/)).toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce(response(valid) as Response);
    fireEvent.click(screen.getByRole('button', { name: /get virtual joining details/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: /join virtual session/i })).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith(
      `/api/education/registrations/join?sessionId=${sessionId}`,
      { method: 'GET', cache: 'no-store', credentials: 'same-origin' },
    );
    const link = screen.getByRole('link', { name: /join virtual session/i });
    expect(link.getAttribute('href')).toBe(valid.joinUrl);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(screen.getByText('SECRET')).toBeTruthy();
  });

  it('fails closed for refusal, foreign session, malformed envelope and unsafe URL', async () => {
    const cases = [
      response(null, false),
      response({ ...valid, sessionId: 'foreign' }),
      response({ ...valid, joinUrl: 'javascript:alert(1)' }),
      response({ ...valid, joinUrl: 'https://user:pass@meeting.example.test/' }),
      { ok: true, json: async () => ({ data: valid }) },
    ];
    for (const reply of cases) {
      cleanup();
      vi.mocked(fetch).mockResolvedValueOnce(reply as Response);
      render(<MemberSessionJoin sessionId={sessionId} />);
      fireEvent.click(screen.getByRole('button', { name: /get virtual joining details/i }));
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByText('SECRET')).toBeNull();
    }
  });

  it('never fetches when registration has no session identity', () => {
    render(<MemberSessionJoin sessionId={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears previously revealed credentials when the selected session changes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(valid) as Response);
    const view = render(<MemberSessionJoin sessionId={sessionId} />);
    fireEvent.click(screen.getByRole('button', { name: /get virtual joining details/i }));
    await waitFor(() => expect(screen.getByText('SECRET')).toBeTruthy());
    view.rerender(<MemberSessionJoin sessionId="22222222-2222-4222-8222-222222222222" />);
    await waitFor(() => expect(screen.queryByText('SECRET')).toBeNull());
    expect(screen.queryByRole('link')).toBeNull();
  });
});
