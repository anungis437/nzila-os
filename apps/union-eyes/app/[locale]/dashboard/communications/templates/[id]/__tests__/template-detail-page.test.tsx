// @vitest-environment jsdom
// jsdom tests of the template detail page against a mocked fetch: what it reads from the template item route, what it sends when saving
// (PATCH, the edited columns only) and what it shows when the server refuses. They prove nothing about the real route.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
const intl = vi.hoisted(() => ({ locale: 'en-CA' }));

vi.mock('next-intl', () => ({
  useLocale: () => intl.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
  useParams: () => ({ id: 'tpl-1' }),
}));

import TemplateDetailPage from '../page';

const row = {
  id: 'tpl-1',
  organizationId: 'org-1',
  name: 'Dues reminder',
  description: null,
  type: 'email',
  category: 'campaign',
  subject: 'Your dues',
  body: 'Hello {{firstName}}',
  preheader: null,
  htmlContent: null,
  plainTextContent: null,
  variables: [],
  tags: ['dues'],
  metadata: {},
  isActive: true,
  isDefault: false,
  createdBy: 'user-1',
  updatedBy: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

type Reply = { status?: number; body?: unknown };
type Routes = Record<string, () => Reply>;

function mockServer(overrides: Routes = {}) {
  const calls: Array<{ key: string; body: unknown }> = [];
  const routes: Routes = {
    'GET /api/communications/templates/tpl-1': () => ({ body: { success: true, data: { data: row } } }),
    ...overrides,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const { status = 200, body = {} } = routes[key]?.() ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return { calls, called: (key: string) => calls.filter((call) => call.key === key) };
}

beforeEach(() => {
  nav.push.mockReset();
  intl.locale = 'en-CA';
  // Radix measures the category select with ResizeObserver, which jsdom does not provide.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const EDITED_COLUMNS = ['body', 'category', 'description', 'htmlContent', 'isActive', 'name', 'plainTextContent', 'preheader', 'subject', 'tags', 'variables'];

describe('TemplateDetailPage (jsdom, mocked server)', () => {
  it('shows the template the item route returns, however many times the envelope wraps it', async () => {
    mockServer();
    render(<TemplateDetailPage />);
    expect(await screen.findByDisplayValue('Dues reminder')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Your dues')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hello {{firstName}}')).toBeInTheDocument();
  });

  it('saves with PATCH, sending the columns the form edits and nothing that belongs to the record', async () => {
    const saved = { ...row, name: 'Dues notice', updatedAt: '2026-10-03T00:00:00.000Z' };
    const server = mockServer({ 'PATCH /api/communications/templates/tpl-1': () => ({ body: { success: true, data: { data: saved } } }) });
    render(<TemplateDetailPage />);
    fireEvent.change(await screen.findByDisplayValue('Dues reminder'), { target: { value: 'Dues notice' } });
    fireEvent.click(screen.getByRole('button', { name: /saveChangesButton/ }));

    await waitFor(() => expect(server.called('PATCH /api/communications/templates/tpl-1')).toHaveLength(1));
    const { body } = server.called('PATCH /api/communications/templates/tpl-1')[0];
    expect(Object.keys(body as object).sort()).toEqual(EDITED_COLUMNS);
    expect(body).toMatchObject({ name: 'Dues notice', description: null, tags: ['dues'], isActive: true });
    for (const owned of ['id', 'organizationId', 'type', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'isDefault', 'metadata']) {
      expect(body).not.toHaveProperty(owned);
    }
    expect(server.calls.some((call) => call.key.startsWith('PUT '))).toBe(false);
    expect(await screen.findByText('templateSavedMessage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dues notice')).toBeInTheDocument();
  });

  it('shows what the server said when a save is refused, and keeps the edit on screen', async () => {
    mockServer({
      'PATCH /api/communications/templates/tpl-1': () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" } }),
    });
    render(<TemplateDetailPage />);
    fireEvent.change(await screen.findByDisplayValue('Dues reminder'), { target: { value: 'Dues notice' } });
    fireEvent.click(screen.getByRole('button', { name: /saveChangesButton/ }));
    expect(await screen.findByText("Requires at least 'steward' role")).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dues notice')).toBeInTheDocument();
    expect(screen.queryByText('templateSavedMessage')).not.toBeInTheDocument();
  });

  it('refuses a template with no name, no body or (for email) no subject before any request, as the form’s required marks say', async () => {
    const server = mockServer();
    render(<TemplateDetailPage />);
    const nameInput = await screen.findByDisplayValue('Dues reminder');
    fireEvent.change(nameInput, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: /saveChangesButton/ }));
    expect(await screen.findByText('Template name is required.')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Dues reminder' } });
    fireEvent.change(screen.getByDisplayValue('Your dues'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /saveChangesButton/ }));
    expect(await screen.findByText('An email template needs a subject line.')).toBeInTheDocument();
    expect(server.called('PATCH /api/communications/templates/tpl-1')).toHaveLength(0);
  });

  it('says the template was not found, and says it could not be read when the body is not a template, instead of showing a blank form', async () => {
    mockServer({ 'GET /api/communications/templates/tpl-1': () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'message template not found' } }) });
    render(<TemplateDetailPage />);
    expect(await screen.findByText('Template not found')).toBeInTheDocument();
    cleanup();

    mockServer({ 'GET /api/communications/templates/tpl-1': () => ({ body: { success: true, data: { saved: true } } }) });
    render(<TemplateDetailPage />);
    expect(await screen.findByText('The template could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Dues reminder')).not.toBeInTheDocument();
  });

  it('shows the server’s message when the read is refused, and says it could not be loaded when the server says nothing', async () => {
    mockServer({ 'GET /api/communications/templates/tpl-1': () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }) });
    render(<TemplateDetailPage />);
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    cleanup();

    mockServer({ 'GET /api/communications/templates/tpl-1': () => ({ status: 500, body: {} }) });
    render(<TemplateDetailPage />);
    expect(await screen.findByText('The template could not be loaded.')).toBeInTheDocument();
  });

  it('says in the reader’s language that the template was not found, or could not be saved or deleted, when the server says nothing', async () => {
    intl.locale = 'fr-CA';
    mockServer({ 'GET /api/communications/templates/tpl-1': () => ({ status: 404, body: {} }) });
    render(<TemplateDetailPage />);
    expect(await screen.findByText('Modèle introuvable')).toBeInTheDocument();
    cleanup();

    mockServer({ 'PATCH /api/communications/templates/tpl-1': () => ({ status: 500, body: {} }), 'DELETE /api/communications/templates/tpl-1': () => ({ status: 500, body: {} }) });
    render(<TemplateDetailPage />);
    fireEvent.change(await screen.findByDisplayValue('Dues reminder'), { target: { value: 'Dues reminder 2' } });
    fireEvent.click(screen.getByRole('button', { name: /saveChangesButton/ }));
    expect(await screen.findByText('Le modèle n’a pas pu être enregistré.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button').find((button) => button.className.includes('destructive')) as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: /deleteTemplateButton/ }));
    expect(await screen.findByText('Le modèle n’a pas pu être supprimé.')).toBeInTheDocument();
  });

  it('removes the template with DELETE and returns to the list, or shows why it could not', async () => {
    const server = mockServer({ 'DELETE /api/communications/templates/tpl-1': () => ({ body: { success: true, data: { data: { ...row, isActive: false } } } }) });
    render(<TemplateDetailPage />);
    await screen.findByDisplayValue('Dues reminder');
    fireEvent.click(screen.getAllByRole('button').find((button) => button.className.includes('destructive')) as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: /deleteTemplateButton/ }));
    await waitFor(() => expect(server.called('DELETE /api/communications/templates/tpl-1')).toHaveLength(1));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard/communications/templates'));
    cleanup();

    nav.push.mockReset();
    mockServer({ 'DELETE /api/communications/templates/tpl-1': () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'admin' role" } }) });
    render(<TemplateDetailPage />);
    await screen.findByDisplayValue('Dues reminder');
    fireEvent.click(screen.getAllByRole('button').find((button) => button.className.includes('destructive')) as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: /deleteTemplateButton/ }));
    expect(await screen.findByText("Requires at least 'admin' role")).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });
});
