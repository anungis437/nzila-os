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

const DOC_2 = '22222222-2222-4222-8222-222222222222';

vi.mock('@/components/documents/document-library-browser', () => ({
  DocumentLibraryBrowser: ({
    onDownload,
    onSelectionChange,
  }: {
    onDownload?: (item: { id: string }) => void;
    onSelectionChange?: (items: Array<{ id: string; name: string }>) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onDownload?.({ id: DOC })}>library-download</button>
      <button
        type="button"
        onClick={() => onSelectionChange?.([{ id: DOC, name: 'Case note' }, { id: DOC_2, name: 'Second note' }])}
      >
        select-two
      </button>
    </div>
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

const retentionProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('@/components/documents/document-retention-policy', () => ({
  DocumentRetentionPolicy: (props: Record<string, unknown>) => {
    retentionProps.last = props;
    return <div data-testid="retention-probe">{String(props.unavailableNotice ?? '')}</div>;
  },
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

  it('does not rewrite privacy labels for share', async () => {
    const fetchMock = installFetch();
    render(<DocumentsConsole />);
    await screen.findByRole('button', { name: 'library-download' });
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.bulk' }));
    await userEvent.click(screen.getByRole('button', { name: 'share-probe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Changing a privacy label does not grant access.');
    const methods = fetchMock.mock.calls.map((call) => (call[1] as RequestInit | undefined)?.method ?? 'GET');
    expect(methods).not.toContain('PATCH');
  });

  it('presents legal hold and retention status as unavailable, not derived from privacy labels', async () => {
    const fetchMock = installFetch();
    render(<DocumentsConsole />);
    await screen.findByRole('button', { name: 'library-download' });
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.retention' }));
    const props = retentionProps.last as Record<string, unknown>;
    // The list holds a "privileged" document; a label must never become a hold, a count or a rule in force.
    expect(props.legalHolds).toBeNull();
    expect(props.stats).toMatchObject({ documentsOnHold: null, documentsUnderRetention: null, scheduledForArchival: null, scheduledForDeletion: null });
    expect(props.onReleaseHold).toBeUndefined();
    expect(props.onExecuteRetention).toBeUndefined();
    expect(props.onSavePolicy).toBeUndefined();
    expect(props.existingPolicy).toBeUndefined();
    expect(screen.getByTestId('retention-probe')).toHaveTextContent('No canonical document retention record exists yet');
    const methods = fetchMock.mock.calls.map((call) => (call[1] as RequestInit | undefined)?.method ?? 'GET');
    expect(methods).not.toContain('PATCH');
  });

  it('offers no external URL import, which the repository would refuse', async () => {
    installFetch();
    render(<DocumentsConsole />);
    await screen.findByRole('button', { name: 'library-download' });
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.repository' }));
    expect(screen.queryByText(/Migration Import/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import URLs' })).toBeNull();
  });

  it('never invents a content hash when saving a document', async () => {
    const fetchMock = installFetch(201);
    render(<DocumentsConsole />);
    await screen.findByRole('button', { name: 'library-download' });
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.repository' }));
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.title'), 'Note');
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.filename'), 'note.pdf');
    await userEvent.type(screen.getByPlaceholderText('repository.uploadFields.fileUrl'), 'https://x.blob.core.windows.net/union-eyes/documents/org/n.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'repository.uploadGoverned' }));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === 'POST')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).not.toHaveProperty('contentHash');
  });

  it('reports a partial bulk download per document and opens only the links that were issued', async () => {
    const report = {
      success: true,
      data: {
        atomic: false,
        status: 'partial',
        requested: 2,
        issued: 1,
        failed: 1,
        items: [
          { documentId: DOC, outcome: 'issued', downloadUrl: 'https://storage.example/one.pdf' },
          { documentId: DOC_2, outcome: 'denied' },
        ],
      },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/documents/repository/downloads') return new Response(JSON.stringify(report), { status: 200 });
      if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify(listBody), { status: 200 });
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('open', vi.fn());

    render(<DocumentsConsole />);
    await userEvent.click(await screen.findByRole('button', { name: 'select-two' }));
    await userEvent.click(screen.getByRole('tab', { name: 'tabs.bulk' }));
    await userEvent.click(screen.getByRole('button', { name: 'bulk-download-probe' }));

    const summary = await screen.findByTestId('document-bulk-report');
    expect(summary).toHaveTextContent('1 of 2 links were issued; 1 were not.');
    expect(summary).toHaveTextContent('Links already issued stay valid');
    expect(summary).toHaveTextContent('Second note');
    expect(summary).toHaveTextContent('You do not have permission to open this document.');
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('https://storage.example/one.pdf', '_blank', 'noopener,noreferrer');
    const call = fetchMock.mock.calls.find((c) => String(c[0]) === '/api/documents/repository/downloads')!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ documentIds: [DOC, DOC_2] });
  });
});
