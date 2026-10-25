// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DocumentBrowser } from './document-browser';

const DOC = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SECRET = 'https://secret.example/raw.pdf';
const language = vi.hoisted(() => ({ locale: 'en' }));

vi.mock('next-intl', () => ({
  useLocale: () => language.locale,
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/documents/ocr-upload', () => ({
  OCRUpload: ({ onUploadComplete }: { onUploadComplete?: (files: Array<{ documentId?: string }>) => void }) => (
    <button type="button" onClick={() => onUploadComplete?.([{ documentId: '11111111-1111-4111-8111-111111111111' }])}>
      save-ocr-document
    </button>
  ),
}));

const listRow = {
  id: DOC,
  title: 'Case note',
  documentType: 'evidence',
  privacyLabel: 'privileged',
  fileUrl: SECRET,
  contentText: 'privileged transcript',
  storageKey: 'documents/org/raw.pdf',
  ocrText: 'extracted secret',
};

function installFetch(options?: { listStatus?: number; downloadStatus?: number; secondDownloadStatus?: number }) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/download')) {
      const status = url.includes(OTHER)
        ? (options?.secondDownloadStatus ?? 200)
        : (options?.downloadStatus ?? 200);
      if (status !== 200) {
        return new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status });
      }
      return new Response(JSON.stringify({
        success: true,
        data: { downloadUrl: 'https://storage.example/signed.pdf' },
      }), { status: 200 });
    }
    if (url.includes(`/repository/${DOC}`)) {
      return new Response(JSON.stringify({
        success: true,
        data: { ...listRow, fileUrl: SECRET },
      }), { status: 200 });
    }
    if ((options?.listStatus ?? 200) !== 200) {
      return new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: options?.listStatus });
    }
    return new Response(JSON.stringify({
      success: true,
      data: [listRow, { ...listRow, id: OTHER, title: 'Second note', documentType: 'policy' }],
    }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('open', vi.fn());
  return { fetchMock, calls };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  language.locale = 'en';
});

describe('document browser canonical journey', () => {
  it('lists the repository, hides storage urls, and downloads only through the audited route', async () => {
    const { calls } = installFetch();
    render(<DocumentBrowser selectionMode="multiple" />);

    expect(await screen.findByText('Case note')).toBeInTheDocument();
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    expect(screen.queryByText('privileged transcript')).not.toBeInTheDocument();
    expect(screen.queryByText('extracted secret')).not.toBeInTheDocument();
    expect(calls.some((call) => call.startsWith('GET /api/documents?'))).toBe(false);
    expect(calls.some((call) => call.startsWith('GET /api/documents/repository'))).toBe(true);
    expect(screen.getByText(/Sort and pages apply to the authorized result/)).toBeInTheDocument();
    expect(screen.getByText(/Size sort, folders, and tags are not filters/)).toBeInTheDocument();
    expect(screen.getByTestId('document-browser').querySelector('.flex-col')).toBeTruthy();

    await userEvent.click(screen.getAllByRole('button', { name: 'Download' })[1]);
    await waitFor(() => expect(window.open).toHaveBeenCalledWith(
      'https://storage.example/signed.pdf',
      '_blank',
      'noopener,noreferrer',
    ));
    expect(calls.some((call) => call === `GET /api/documents/${DOC}/download`)).toBe(true);
    expect(window.open).not.toHaveBeenCalledWith(SECRET, expect.anything(), expect.anything());
  });

  it('previews metadata only and fails share and delete closed', async () => {
    installFetch();
    render(<DocumentBrowser selectionMode="multiple" />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Preview' }))[0]);
    expect(await screen.findByText('Authorized metadata only. The file is not opened from the list.')).toBeInTheDocument();
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByTestId('browser-notice')).toHaveTextContent('Sharing is not available.');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByTestId('browser-notice')).toHaveTextContent('Delete is not available from this screen.');
  });

  it('shows a denial instead of an empty library and opens no url when any selected download is refused', async () => {
    const denied = installFetch({ listStatus: 403 });
    render(<DocumentBrowser />);
    expect(await screen.findByTestId('browser-notice')).toHaveTextContent(
      'You do not have permission to open this document.',
    );
    expect(screen.queryByText('No authorized documents.')).not.toBeInTheDocument();
    expect(denied.calls.some((call) => call.includes(SECRET))).toBe(false);

    cleanup();
    const bulk = installFetch({ secondDownloadStatus: 403 });
    render(<DocumentBrowser selectionMode="multiple" />);
    await screen.findByText('Second note');
    const boxes = screen.getAllByRole('checkbox');
    await userEvent.click(boxes[0]);
    await userEvent.click(boxes[1]);
    await userEvent.click(screen.getAllByRole('button', { name: 'Download' })[0]);
    await waitFor(() => expect(screen.getByTestId('browser-notice')).toBeInTheDocument());
    expect(window.open).not.toHaveBeenCalled();
    expect(bulk.calls.filter((call) => call.includes('/download'))).toHaveLength(2);
  });

  it('renders the French browser and keeps extra type filters on the authorized rows', async () => {
    language.locale = 'fr';
    const { calls } = installFetch();
    render(<DocumentBrowser filterByType={['evidence', 'missing']} />);
    expect(await screen.findByText('Case note')).toBeInTheDocument();
    expect(screen.queryByText('Second note')).not.toBeInTheDocument();
    expect(screen.queryByText('Aucun document autorise.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Apercu' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Le tri et la pagination/)).toBeInTheDocument();
    expect(calls.some((call) => call.includes('documentType='))).toBe(false);
  });

  it('reloads the repository after a saved OCR document', async () => {
    const { calls } = installFetch();
    render(<DocumentBrowser organizationId="org-1" />);
    await screen.findByText('Case note');
    const before = calls.filter((call) => call.startsWith('GET /api/documents/repository')).length;
    await userEvent.click(screen.getByRole('button', { name: 'save-ocr-document' }));
    await waitFor(() => {
      expect(calls.filter((call) => call.startsWith('GET /api/documents/repository')).length).toBeGreaterThan(before);
    });
  });
});
