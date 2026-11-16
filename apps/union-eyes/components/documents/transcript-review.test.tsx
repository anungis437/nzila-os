// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { TranscriptReview } from './transcript-review';

const locale = vi.hoisted(() => ({ value: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => locale.value }));
const DOC = '11111111-1111-4111-8111-111111111111';
const VERSION = '22222222-2222-4222-8222-222222222222';
const head = (revisionNo = 1, state = 'machine_extraction', text = 'Machine text') => ({ documentId: DOC, versionId: VERSION, revisionNo, state, text });
const envelope = (data: unknown) => ({ success: true, data });
function install(options: { write?: boolean; publish?: boolean; reviewed?: boolean; putStatus?: number; malformed?: boolean } = {}) {
  let current = head(options.reviewed ? 2 : 1, options.reviewed ? 'human_reviewed' : 'machine_extraction');
  const history = [current]; let published = false;
  const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (options.putStatus) return new Response(JSON.stringify({ message: options.putStatus === 403 ? 'A transcript cannot be reviewed by the person who wrote the draft' : 'The transcript changed since it was loaded' }), { status: options.putStatus });
      const body = JSON.parse(String(init.body));
      const next = { ...head(current.revisionNo + 1, body.action === 'review' ? 'human_reviewed' : 'human_draft', body.text), baseRevisionNo: current.revisionNo };
      current = next; history.unshift(next);
      return new Response(JSON.stringify(envelope({ documentId: DOC, versionId: VERSION, revision: next })));
    }
    if (init?.method === 'POST') {
      published = true;
      return new Response(JSON.stringify(envelope({ documentId: DOC, versionId: VERSION, publication: { revisionNo: current.revisionNo } })));
    }
    return new Response(JSON.stringify(envelope({ documentId: options.malformed ? 'another-document' : DOC, versionId: VERSION, head: current, history,
      publishedAsEvidence: published ? { publishedAt: '2026-11-16T08:00:00Z' } : null,
      access: { canWrite: options.write !== false, canPublish: options.publish ?? false } })));
  });
  vi.stubGlobal('fetch', fetcher); return fetcher;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); locale.value = 'en-CA'; });

describe('transcript review from document preview', () => {
  it('reads text only on request, saves a revision with its parent, and confirms durable readback', async () => {
    const fetcher = install(); render(<TranscriptReview documentId={DOC} />);
    expect(fetcher).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Read transcript' }));
    const input = await screen.findByLabelText('Transcript text');
    await userEvent.clear(input); await userEvent.type(input, 'Corrected text');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Revision saved and read back.')).toBeInTheDocument();
    const request = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ action: 'draft', expectedRevisionNo: 1, text: 'Corrected text' });
    expect(screen.getByText('Revision 2 · Human draft — not reviewed', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish reviewed/ })).not.toBeInTheDocument();
  });

  it('requires an explicit original-document check before review and resets it on text changes', async () => {
    install(); render(<TranscriptReview documentId={DOC} />);
    await userEvent.click(screen.getByRole('button', { name: 'Read transcript' }));
    const review = await screen.findByRole('button', { name: 'Record review' }); expect(review).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox')); expect(review).toBeEnabled();
    await userEvent.type(screen.getByLabelText('Transcript text'), ' correction'); expect(review).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox')); await userEvent.click(review);
    expect(await screen.findByText('Revision saved and read back.')).toBeInTheDocument();
    expect(screen.getByText('Revision 2 · Human reviewed', { selector: 'p' })).toBeInTheDocument();
  });

  it('keeps edits after a stale write, blocks repeats, and requires an explicit refresh', async () => {
    const fetcher = install({ putStatus: 409 }); render(<TranscriptReview documentId={DOC} />);
    await userEvent.click(screen.getByRole('button', { name: 'Read transcript' }));
    await userEvent.type(await screen.findByLabelText('Transcript text'), ' correction');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(/Your edits are kept here/)).toBeInTheDocument();
    expect(screen.getByLabelText('Transcript text')).toHaveValue('Machine text correction');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reload latest transcript' }));
    expect(await screen.findByText(/Your edits were kept/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });

  it('explains a refused self-review without claiming success or publishing the draft', async () => {
    install({ putStatus: 403 }); render(<TranscriptReview documentId={DOC} />);
    await userEvent.click(screen.getByRole('button', { name: 'Read transcript' }));
    await userEvent.click(await screen.findByRole('checkbox')); await userEvent.click(screen.getByRole('button', { name: 'Record review' }));
    expect(await screen.findByText(/different authorized account/)).toBeInTheDocument();
    expect(screen.queryByText('Revision saved and read back.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish reviewed/ })).not.toBeInTheDocument();
  });

  it('publishes only an unchanged reviewed revision with separate evidence permission and purpose', async () => {
    const fetcher = install({ reviewed: true, publish: true, write: false }); render(<TranscriptReview documentId={DOC} />);
    await userEvent.click(screen.getByRole('button', { name: 'Read transcript' }));
    const publish = await screen.findByRole('button', { name: 'Publish reviewed transcript as case evidence' }); expect(publish).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Purpose of adding this transcript to case evidence'), 'Case preparation');
    await userEvent.click(publish); expect(await screen.findByText('Publication saved and read back.')).toBeInTheDocument();
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe(`/api/documents/${DOC}/transcript/publish`);
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ revisionNo: 2, purpose: 'Case preparation' });
  });

  it('refuses a successful response naming another document', async () => {
    install({ malformed: true }); render(<TranscriptReview documentId={DOC} />);
    await userEvent.click(screen.getByRole('button', { name: 'Read transcript' }));
    expect(await screen.findByText(/result could not be confirmed/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Machine text')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });

  it('shows French read-only text and no write or publication controls without their permissions', async () => {
    locale.value = 'fr-CA'; install({ write: false }); render(<TranscriptReview documentId={DOC} />);
    await userEvent.click(screen.getByRole('button', { name: 'Lire la transcription' }));
    expect(await screen.findByText('Vous disposez d’un accès en lecture à cette transcription.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Machine text')).toBeInTheDocument());
  });
});
