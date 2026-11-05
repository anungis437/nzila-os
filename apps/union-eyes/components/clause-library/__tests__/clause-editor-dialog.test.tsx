// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ClauseEditorDialog } from '../ClauseEditorDialog';

// Radix dialog primitives measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function render_(props: Partial<React.ComponentProps<typeof ClauseEditorDialog>> = {}) {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  render(<ClauseEditorDialog open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />);
  return { onSaved, onOpenChange };
}

describe('ClauseEditorDialog: adding a clause', () => {
  it('cannot be saved without a title and a text', () => {
    render_();
    expect(screen.getByRole('button', { name: 'Add clause' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Overtime' } });
    expect(screen.getByRole('button', { name: 'Add clause' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Clause text'), { target: { value: 'Overtime is paid at 1.5x.' } });
    expect(screen.getByRole('button', { name: 'Add clause' })).toBeEnabled();
  });

  it('posts what the route accepts, and reports the id of the clause it created', async () => {
    const fetchMock = vi.fn(() => reply(200, { success: true, data: { success: true, clause: { id: 'clause-9' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const { onSaved, onOpenChange } = render_();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Overtime  ' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'overtime' } });
    fireEvent.change(screen.getByLabelText('Clause text'), { target: { value: 'Overtime is paid at 1.5x.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add clause' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('clause-9'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/clause-library');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ clauseTitle: 'Overtime', clauseText: 'Overtime is paid at 1.5x.', clauseType: 'overtime', clauseNumber: null });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the server\'s refusal, keeps the dialog open and reports nothing saved', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(403, { code: 'FORBIDDEN', message: 'Sharing a clause with every organization requires an officer role' })));
    const { onSaved, onOpenChange } = render_();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Overtime' } });
    fireEvent.change(screen.getByLabelText('Clause text'), { target: { value: 'Text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add clause' }));
    expect(await screen.findByTestId('clause-editor-error')).toHaveTextContent('requires an officer role');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('says so when the request never reaches the server', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render_();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Overtime' } });
    fireEvent.change(screen.getByLabelText('Clause text'), { target: { value: 'Text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add clause' }));
    expect(await screen.findByTestId('clause-editor-error')).toHaveTextContent('Check the connection');
  });
});

describe('ClauseEditorDialog: changing a clause', () => {
  const clause = { id: 'clause-1', clauseTitle: 'Vacation', clauseText: 'Four weeks.', clauseType: 'vacation', clauseNumber: '14.02' };

  it('starts from the clause and patches it by id', async () => {
    const fetchMock = vi.fn(() => reply(200, { success: true, data: { success: true, clause: { id: 'clause-1' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const { onSaved } = render_({ clause });
    expect(screen.getByLabelText('Title')).toHaveValue('Vacation');
    expect(screen.getByLabelText('Clause number (optional)')).toHaveValue('14.02');
    fireEvent.change(screen.getByLabelText('Clause text'), { target: { value: 'Five weeks.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('clause-1'));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/clause-library/clause-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ clauseTitle: 'Vacation', clauseText: 'Five weeks.', clauseType: 'vacation', clauseNumber: '14.02' });
  });
});
