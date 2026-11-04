// @vitest-environment jsdom
// jsdom test of the new-template page against a mocked fetch: after a template is created the page goes to the template it was given, read
// from the collection route's enveloped { data: template } answer. It proves nothing about the real route.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }));

import NewTemplatePage from '../page';

const reply = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

const fill = () => {
  fireEvent.change(document.getElementById('name') as HTMLInputElement, { target: { value: 'Dues reminder' } });
  fireEvent.change(document.getElementById('subject') as HTMLInputElement, { target: { value: 'Your dues' } });
  fireEvent.change(document.getElementById('body') as HTMLTextAreaElement, { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: /actions\.createTemplate/ }));
};

beforeEach(() => {
  nav.push.mockReset();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('NewTemplatePage (jsdom, mocked server)', () => {
  it('goes to the template that was created, not to "undefined"', async () => {
    const fetchMock = vi.fn(() => reply(201, { success: true, data: { data: { id: 'tpl-9', name: 'Dues reminder' } } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<NewTemplatePage />);
    fill();

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard/communications/templates/tpl-9'));
    expect(fetchMock).toHaveBeenCalledWith('/api/communications/templates', expect.objectContaining({ method: 'POST' }));
  });

  it('shows what the server said when the create is refused, and does not navigate', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(403, { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" })));
    render(<NewTemplatePage />);
    fill();
    expect(await screen.findByText("Requires at least 'steward' role")).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('does not navigate when the answer is not a template', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, { success: true, data: { created: true } })));
    render(<NewTemplatePage />);
    fill();
    expect(await screen.findByText('errors.createFailed')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });
});
