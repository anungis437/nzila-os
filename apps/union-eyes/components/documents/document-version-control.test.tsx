// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DocumentVersionControl, type DocumentVersion } from './document-version-control';

afterEach(cleanup);

const document = { id: 'd1', name: 'Seniority list', currentVersion: 2, totalVersions: 2 };

const current: DocumentVersion = {
  id: 'v2',
  versionNumber: 2,
  createdAt: new Date('2026-03-04T15:00:00Z'),
  createdBy: { id: 'u1', name: 'Alice Steward' },
  contentHash: 'sha256:aaaa',
  isCurrent: true,
  downloadUrl: '',
};
const earlier: DocumentVersion = {
  id: 'v1',
  versionNumber: 1,
  createdAt: new Date('2026-01-02T15:00:00Z'),
  contentHash: 'sha256:bbbb',
  isCurrent: false,
  downloadUrl: '',
};

describe('DocumentVersionControl', () => {
  it('shows who filed a version only when that is known, never the id, and a size only when the record carries one', () => {
    render(<DocumentVersionControl document={document} versions={[current, earlier]} />);

    expect(screen.getByText('Alice Steward')).toBeInTheDocument();
    expect(screen.queryByText('u1')).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0 B\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/KB|MB/)).not.toBeInTheDocument();
  });

  it('shows the recorded checksum as a checksum, not as a comment or a change', () => {
    render(<DocumentVersionControl document={document} versions={[current, earlier]} />);

    expect(screen.getByText('sha256:aaaa')).toBeInTheDocument();
    expect(screen.getByText('sha256:bbbb')).toBeInTheDocument();
    expect(screen.getAllByText(/Content hash:/)).toHaveLength(2);
    expect(screen.queryByText('Updated')).not.toBeInTheDocument();
  });

  it('shows a size when the version has one', () => {
    render(<DocumentVersionControl document={document} versions={[{ ...current, size: 2048 }]} />);

    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });

  it('offers no compare, preview, download or restore when nothing was given to do them with', () => {
    render(<DocumentVersionControl document={document} versions={[current, earlier]} />);

    expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument();
  });

  it('offers a download only for the versions the caller says can be downloaded', () => {
    const onDownload = vi.fn();
    render(<DocumentVersionControl document={document} versions={[current, earlier]} onDownload={onDownload} canDownload={(version) => version.isCurrent} />);

    const downloads = screen.getAllByRole('button', { name: /download/i });
    expect(downloads).toHaveLength(1);
    fireEvent.click(downloads[0]);
    expect(onDownload).toHaveBeenCalledWith(current);
  });

  it('offers restore for an earlier version only, and compare once the caller can compare', () => {
    render(
      <DocumentVersionControl document={document} versions={[current, earlier]} onRestore={vi.fn(async () => {})} onCompare={vi.fn()} />,
    );

    expect(screen.getAllByRole('button', { name: /restore/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /compare versions/i })).toBeEnabled();
  });
});
