// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DocumentsConsole } from './documents-console';

const DOC = '11111111-1111-4111-8111-111111111111';
const language = vi.hoisted(() => ({ locale: 'en' }));

vi.mock('next-intl', () => ({
  useLocale: () => language.locale,
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/hooks/use-organization', () => ({
  useOrganizationId: () => 'org-1',
}));

vi.mock('@/components/documents/document-library-browser', () => ({
  DocumentLibraryBrowser: ({ onDownload }: { onDownload?: (item: { id: string }) => void }) => (
    <button type="button" onClick={() => onDownload?.({ id: DOC })}>library-download</button>
  ),
}));

vi.mock('@/components/documents/document-bulk-operations', () => ({
  DocumentBulkOperations: ({
    onBulkShare,
    onBulkDownload,
  }: {
    onBulkShare?: (permission: string) => void;
    onBulkDownload?: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onBulkShare?.('view')}>share-probe</button>
      <button type="button" onClick={() => onBulkDownload?.()}>bulk-download-probe</button>
    </div>
  ),
}));

vi.mock('@/components/documents/document-retention-policy', () => ({
  DocumentRetentionPolicy: ({
    onReleaseHold,
    onExecuteRetention,
  }: {
    onReleaseHold?: (id: string) => void;
    onExecuteRetention?: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onReleaseHold?.('hold-1')}>release-probe</button>
      <button type="button" onClick={() => onExecuteRetention?.()}>retention-probe</button>
    </div>
  ),
}));

vi.mock('@/components/documents/document-version-control', () => ({
  DocumentVersionControl: () => null,
}));
vi.mock('@/components/documents/document-approval-workflow', () => ({
  DocumentApprovalWorkflow: () => null,
}));
vi.mock('@/components/documents/document-template-manager', () => ({
  DocumentTemplateManager: () => null,
}));
vi.mock('@/components/documents/document-search-advanced', () => ({
  DocumentSearchAdvanced: () => null,
}));
vi.mock('@/components/documents/ocr-upload', () => ({
  OCRUpload: () => null,
}));

const listBody = {
  success: true,
  data: [{
    id: DOC,
    title: 'Case note',
    fileUrl: 'https://secret.example/raw.pdf',
    privacyLabel: 'privileged',
    documentType: 'evidence',
  }],
};

function installFetch(uploadStatus = 403) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/download')) {
      return new Response(JSON.stringify({
        success: true,
        data: { downloadUrl: 'https://storage.example/signed.pdf' },
      }), { status: 200 });
    }
    if (method === 'POST') {
      return new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: uploadStatus });
    }
    if (method === 'PATCH') {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify(listBody), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('open', vi.fn());
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  language.locale = 'en';
});

describe('documents console canonical journey', () => {
  it('downloads through the audited route and does not open the list file url', async () => {
    const fetchMock = installFetch();
    render(<DocumentsConsole />);
    await userEvent.click(await screen.findByRole('button', { name: 'library-download' }));
    await waitFor(() => expect(window.open).toHaveBeenCalledWith(
      'https://storage.example/signed.pdf',
      '_blank',
      'noopener,noreferrer',
    ));
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain(`/api/documents/${DOC}/download`);
    expect(urls.some((url) => url.includes('secret.example'))).toBe(false);
  });

  it('keeps the upload form when the canonical create route rejects it', async () => {
    installFetch(403);
    render(<DocumentsConsole />);
    await screen.findByRole('button', { name: 'library-download' });
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.repository' }));
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.title'), 'Privileged note');
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.filename'), 'note.pdf');
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.fileUrl'), 'https://files.example/note.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'repository.uploadGoverned' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to open this document.');
    expect(screen.getByPlaceholderText('repository.uploadFields.title')).toHaveValue('Privileged note');
  });

  it('shows the french denial and stacks the header on small screens', async () => {
    language.locale = 'fr-CA';
    installFetch(409);
    render(<DocumentsConsole />);
    expect(document.querySelector('.flex-col')).toBeTruthy();
    expect(document.querySelector('.sm\\:flex-row')).toBeTruthy();
    await screen.findByRole('button', { name: 'library-download' });
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.repository' }));
    expect(await screen.findByRole('button', { name: 'Telecharger' })).toBeVisible();
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.title'), 'Note');
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.filename'), 'note.pdf');
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.fileUrl'), 'https://files.example/note.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'repository.uploadGoverned' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le document a change');
  });

  it('does not rewrite privacy labels for share, hold release, or retention', async () => {
    const fetchMock = installFetch();
    render(<DocumentsConsole />);
    await screen.findByRole('button', { name: 'library-download' });
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.bulk' }));
    await userEvent.click(screen.getByRole('button', { name: 'share-probe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Changing a privacy label does not grant access.');
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.retention' }));
    await userEvent.click(screen.getByRole('button', { name: 'release-probe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Classification and retention rules cannot be changed');
    await userEvent.click(screen.getByRole('button', { name: 'retention-probe' }));
    const methods = fetchMock.mock.calls.map((call) => (call[1] as RequestInit | undefined)?.method ?? 'GET');
    expect(methods).not.toContain('PATCH');
  });
});
