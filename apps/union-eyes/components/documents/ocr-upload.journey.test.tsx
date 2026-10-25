// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { OCRUpload } from './ocr-upload';

const DOC = '11111111-1111-4111-8111-111111111111';
const language = vi.hoisted(() => ({ locale: 'en' }));

vi.mock('next-intl', () => ({
  useLocale: () => language.locale,
  useTranslations: () => (key: string) => key,
}));

const intake = {
  blobPath: 'documents/org-1/note.pdf',
  checksum: 'abc',
  size: 5,
  mimeType: 'application/pdf',
  filename: 'note.pdf',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  language.locale = 'en';
});

async function choose(file: File | File[]) {
  await userEvent.selectOptions(screen.getByLabelText('Classification'), 'team_confidential');
  await userEvent.upload(screen.getByLabelText('Choose or capture a document'), file);
}

describe('ocr upload canonical journey', () => {
  it('saves through intake and the repository, then shows unverified text', async () => {
    const calls: string[] = [];
    const onUploadComplete = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/api/documents/upload')) return json(intake, 201);
      if (url.endsWith('/api/documents/repository')) {
        const payload = JSON.parse(String(init?.body));
        expect(payload.fileUrl).toBeUndefined();
        expect(payload.privacyLabel).toBe('team_confidential');
        expect(payload.blobPath).toBe(intake.blobPath);
        return json({ data: { id: DOC, title: 'note.pdf', documentType: 'ocr_upload', privacyLabel: 'privileged', fileUrl: 'https://secret.example/raw.pdf' } }, 201);
      }
      return json({ data: { text: 'unverified draft', persisted: false, authoritative: false } });
    }));

    render(<OCRUpload organizationId="org-1" folderId="folder-1" onUploadComplete={onUploadComplete} />);
    expect(screen.getByText(/requested folder is not a field/)).toBeInTheDocument();
    await choose(new File(['hello'], 'note.pdf', { type: 'application/pdf' }));

    expect((await screen.findAllByText('Unverified extracted text. It does not become evidence.')).length).toBeGreaterThan(0);
    expect(screen.queryByText('https://secret.example/raw.pdf')).not.toBeInTheDocument();
    expect(onUploadComplete).toHaveBeenCalledWith([expect.objectContaining({ documentId: DOC })]);
    expect(calls).toEqual([
      'POST /api/documents/upload',
      'POST /api/documents/repository',
      `POST /api/documents/${DOC}/ocr`,
    ]);
    expect(screen.getByTestId('ocr-upload')).toHaveClass('flex-col');

    await userEvent.click(screen.getByRole('button', { name: 'Save correction' }));
    expect(screen.getByText(/cannot be saved/)).toBeInTheDocument();
    expect(calls.some((call) => call.includes('PATCH'))).toBe(false);
  });

  it('does not delete a blob when the repository refuses the record', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (init?.body instanceof FormData && init.body.get('discardBlobPath')) {
        throw new Error('discard must not be sent');
      }
      if (url.endsWith('/api/documents/upload')) return json(intake, 201);
      if (url.endsWith('/api/documents/repository')) return json({ code: 'FORBIDDEN' }, 403);
      return json({}, 204);
    }));
    const onUploadComplete = vi.fn();
    render(<OCRUpload organizationId="org-1" onUploadComplete={onUploadComplete} />);
    await choose(new File(['hello'], 'note.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/Stored objects cannot be deleted from this screen/)).toBeInTheDocument();
    expect(onUploadComplete).not.toHaveBeenCalled();
    expect(calls.filter((url) => url.endsWith('/api/documents/upload'))).toHaveLength(1);
    expect(calls.some((url) => url.endsWith('/ocr'))).toBe(false);
  });

  it('rejects bad files locally and reports an unavailable processor after the document is saved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<OCRUpload organizationId="org-1" />);
    const input = screen.getByLabelText('Choose or capture a document');
    await userEvent.upload(input, new File(['hello'], 'note.pdf', { type: 'application/pdf' }));
    expect(await screen.findByTestId('ocr-notice')).toHaveTextContent('Choose a classification');
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText('Classification'), 'privileged');
    const oversized = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: 50 * 1024 * 1024 + 1 });
    await userEvent.upload(input, oversized);
    expect(await screen.findByText('The file is larger than 50 MB.')).toBeInTheDocument();

    fireEvent.change(input, {
      target: { files: [new File(['x'], 'bad.exe', { type: 'application/x-msdownload' })] },
    });
    expect(await screen.findByText('This file type is not accepted.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the saved document when the OCR processor is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (inputUrl: RequestInfo | URL) => {
      const url = String(inputUrl);
      if (url.endsWith('/api/documents/upload')) return json(intake, 201);
      if (url.endsWith('/api/documents/repository')) {
        return json({ data: { id: DOC, title: 'note.pdf', privacyLabel: 'privileged', documentType: 'ocr_upload' } }, 201);
      }
      return json({ code: 'NOT_IMPLEMENTED' }, 501);
    }));
    const onUploadComplete = vi.fn();
    render(<OCRUpload organizationId="org-1" onUploadComplete={onUploadComplete} />);
    await choose(new File(['hello'], 'note.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('OCR is not available for this file.')).toBeInTheDocument();
    expect(screen.getByText('The canonical document is saved. OCR text is not evidence.')).toBeInTheDocument();
    expect(onUploadComplete).toHaveBeenCalledWith([expect.objectContaining({ documentId: DOC })]);
  });

  it('cancels an in-flight upload and ignores a duplicate selection', async () => {
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    render(<OCRUpload organizationId="org-1" />);
    const file = new File(['hello'], 'note.pdf', { type: 'application/pdf' });
    await choose([file, new File(['hello'], 'note.pdf', { type: 'application/pdf' })]);
    expect(await screen.findByText('This file is already being processed.')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Processing cancelled.')).toBeInTheDocument();
  });

  it('renders the French intake limits', async () => {
    language.locale = 'fr';
    render(<OCRUpload organizationId="org-1" />);
    expect(screen.getByRole('heading', { name: 'Versement OCR' })).toBeInTheDocument();
    expect(screen.getByLabelText('Choisir ou capturer un document')).toBeInTheDocument();
  });
});
