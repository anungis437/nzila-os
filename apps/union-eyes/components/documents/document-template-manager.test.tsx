// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DocumentTemplateManager, type DocumentTemplate } from './document-template-manager';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
});

afterEach(cleanup);

const template = (over: Partial<DocumentTemplate> = {}): DocumentTemplate => ({
  id: 't1',
  name: 'Grievance form',
  category: 'forms',
  description: 'form.pdf',
  createdAt: new Date('2026-01-02T12:00:00Z'),
  updatedAt: new Date('2026-02-03T12:00:00Z'),
  ...over,
});

const categories = [{ id: 'forms', name: 'forms', count: 1 }];
const card = () =>
  screen
    .getAllByText('Grievance form')
    .map((node) => node.closest('[class*="hover:shadow-md"]'))
    .find(Boolean) as HTMLElement;

describe('DocumentTemplateManager', () => {
  it('lists the documents filed as templates and offers only what the caller can do: use and preview', () => {
    render(<DocumentTemplateManager templates={[template()]} categories={categories} onUseTemplate={vi.fn()} onPreviewTemplate={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /new template/i })).not.toBeInTheDocument();
    // Use and preview: no edit and no delete, because nothing was given to edit or delete a template with.
    expect(within(card()).getAllByRole('button')).toHaveLength(2);
    expect(within(card()).getByRole('button', { name: /use/i })).toBeInTheDocument();
  });

  it('offers new, edit and delete when the caller can create, update and delete templates', () => {
    render(
      <DocumentTemplateManager
        templates={[template()]}
        categories={categories}
        onCreateTemplate={vi.fn(async () => {})}
        onUpdateTemplate={vi.fn(async () => {})}
        onDeleteTemplate={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByRole('button', { name: /new template/i })).toBeInTheDocument();
    expect(within(card()).getAllByRole('button')).toHaveLength(4);
  });

  it('shows no usage figure for templates whose uses nothing counts, and no count of variables nobody read', () => {
    render(<DocumentTemplateManager templates={[template()]} categories={categories} />);

    expect(screen.getByText('Total Templates')).toBeInTheDocument();
    expect(screen.queryByText('Total Usage')).not.toBeInTheDocument();
    expect(screen.queryByText(/Most Used/)).not.toBeInTheDocument();
    expect(within(card()).queryByText(/times/)).not.toBeInTheDocument();
    expect(within(card()).queryByText('Variables:')).not.toBeInTheDocument();
  });

  it('shows the usage it is given', () => {
    render(
      <DocumentTemplateManager
        templates={[template({ usageCount: 3, variables: ['member', 'date'] }), template({ id: 't2', name: 'Other form', usageCount: 1 })]}
        categories={categories}
      />,
    );

    expect(screen.getByText('Total Usage')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Most Used (3 times)')).toBeInTheDocument();
    expect(within(card()).getByText('3 times')).toBeInTheDocument();
    expect(within(card()).getAllByText('Variables:').length).toBeGreaterThan(0);
  });

  it('says where templates come from, and offers no button to create one, when it cannot create them', () => {
    render(<DocumentTemplateManager templates={[]} categories={[]} />);

    expect(screen.getByText('Documents filed as templates in the repository appear here')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create template/i })).not.toBeInTheDocument();
  });

  it('invites the first template, with a button, when it can create them', () => {
    render(<DocumentTemplateManager templates={[]} categories={[]} onCreateTemplate={vi.fn(async () => {})} />);

    expect(screen.getByText('Create your first template to get started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create template/i })).toBeInTheDocument();
  });
});
