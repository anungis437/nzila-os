// @vitest-environment jsdom
/**
 * The list view's per-item menu offers Delete only to a viewer who may delete and a screen that handles it, and hands the item to that handler. (It once referred to a handler
 * the list view was never given, which fails when the list renders.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { DocumentLibraryBrowser, type DocumentItem } from './document-library-browser'

const file = (overrides: Partial<DocumentItem> = {}): DocumentItem => ({
  id: 'doc-1',
  name: 'Grievance form.pdf',
  type: 'file',
  mimeType: 'application/pdf',
  size: 2048,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  parentId: null,
  path: [],
  permissions: { canView: true, canEdit: true, canDelete: true, canShare: false },
  ...overrides,
})

const openMenu = () => {
  const trigger = screen.getAllByRole('button').find((button) => button.getAttribute('aria-haspopup') === 'menu')
  if (!trigger) throw new Error('no item menu')
  fireEvent.keyDown(trigger, { key: 'Enter' })
}

afterEach(cleanup)

describe('DocumentLibraryBrowser list view', () => {
  it('renders without a delete handler, and offers no Delete', () => {
    render(<DocumentLibraryBrowser items={[file()]} currentFolderId={null} />)
    expect(screen.getByText('Grievance form.pdf')).toBeInTheDocument()
    openMenu()
    expect(screen.queryByText('Delete')).toBeNull()
  })

  it('hands the item to the delete handler when the viewer may delete it', () => {
    const onDelete = vi.fn()
    render(<DocumentLibraryBrowser items={[file()]} currentFolderId={null} onDelete={onDelete} />)
    openMenu()
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith([expect.objectContaining({ id: 'doc-1' })])
  })

  it('offers no Delete for an item the viewer may not delete', () => {
    render(<DocumentLibraryBrowser items={[file({ permissions: { canView: true, canEdit: false, canDelete: false, canShare: false } })]} currentFolderId={null} onDelete={vi.fn()} />)
    openMenu()
    expect(screen.queryByText('Delete')).toBeNull()
  })

  it('does not require who filed a document', () => {
    render(<DocumentLibraryBrowser items={[file({ createdBy: undefined })]} currentFolderId={null} />)
    expect(screen.queryByText(/^by /)).toBeNull()
  })
})
