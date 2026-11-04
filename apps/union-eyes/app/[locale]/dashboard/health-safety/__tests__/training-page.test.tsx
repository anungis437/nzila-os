// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const state = vi.hoisted(() => ({ locale: 'en-CA', organizationId: 'org-1' as string | null }));

vi.mock('next-intl', () => ({ useLocale: () => state.locale, useTranslations: () => (key: string) => key }));
vi.mock('@/lib/hooks/use-organization', () => ({ useOrganizationId: () => state.organizationId }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('framer-motion', () => {
  const Plain = ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;
  Plain.displayName = 'Plain';
  return { motion: { div: Plain } };
});

import TrainingPage from '../training/page';

// What GET /api/health-safety/stats sends inside withApi's envelope (app/api/health-safety/stats/route.ts).
const stats = (data: Record<string, unknown>) => ({ status: 200, body: { success: true, data, timestamp: '2026-03-04T00:00:00.000Z' } });

interface Answer {
  status: number;
  body: unknown;
}

const calls: string[] = [];
let answer: Answer;

beforeEach(() => {
  calls.length = 0;
  state.locale = 'en-CA';
  state.organizationId = 'org-1';
  answer = stats({ trainingDue: 3, trainingRecordsHeld: 12 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = (title: string) => screen.getByText(title).closest('.rounded-lg') as HTMLElement;

describe('health & safety training page', () => {
  it('shows the training figures the route sends, from the envelope, and asks for them without parameters the route ignores', async () => {
    render(<TrainingPage />);
    expect(await screen.findByText('12 training records are on file. This release has no screen that lists them.')).toBeInTheDocument();
    expect(card('stats.totalRecords.title')).toHaveTextContent('12');
    expect(card('stats.expiringSoon.title')).toHaveTextContent('3');
    expect(calls).toEqual(['/api/health-safety/stats']);
  });

  it('shows no records held as a measured zero, and the due count as unknown, because with none held nothing was measured', async () => {
    answer = stats({ trainingDue: null, trainingRecordsHeld: 0 });
    render(<TrainingPage />);
    expect(await screen.findByText('No safety training records are on file for this organization.')).toBeInTheDocument();
    expect(card('stats.totalRecords.title')).toHaveTextContent('0');
    expect(card('stats.expiringSoon.title')).toHaveTextContent('—');
  });

  it('offers no search, filter, export or list, and no figure it has no source for', async () => {
    render(<TrainingPage />);
    await screen.findByText(/training records are on file/);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('stats.certifiedMembers.title')).toBeNull();
    expect(screen.queryByText('stats.overdue.title')).toBeNull();
    // The one link goes back to the health & safety overview.
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/dashboard/health-safety']);
  });

  it('shows a failed read as an error with a retry, with dashes and not zeros, and recovers', async () => {
    answer = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } };
    const user = userEvent.setup();
    render(<TrainingPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(card('stats.totalRecords.title')).toHaveTextContent('—');
    expect(card('stats.expiringSoon.title')).toHaveTextContent('—');
    expect(screen.queryByText(/training record/)).toBeNull();

    answer = stats({ trainingDue: 1, trainingRecordsHeld: 1 });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1 training record is on file. This release has no screen that lists them.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['figures that are not inside the envelope, where the page used to look for them', { trainingDue: 3, trainingRecordsHeld: 12 }],
    ['a count that is missing', { success: true, data: { trainingDue: 3 } }],
    ['a count that is not a number', { success: true, data: { trainingDue: 3, trainingRecordsHeld: '12' } }],
    ['a due count that is not a number', { success: true, data: { trainingDue: '3', trainingRecordsHeld: 12 } }],
  ])('treats %s as an error instead of showing zeros', async (_label, body) => {
    answer = { status: 200, body };
    render(<TrainingPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(card('stats.totalRecords.title')).toHaveTextContent('—');
  });

  it('says so in French on a French locale', async () => {
    state.locale = 'fr-CA';
    answer = stats({ trainingDue: 0, trainingRecordsHeld: 2 });
    render(<TrainingPage />);
    expect(await screen.findByText('2 dossiers de formation sont enregistrés. Cette version n’a aucun écran qui les affiche.')).toBeInTheDocument();
  });

  it('asks for nothing without an organization', async () => {
    state.organizationId = null;
    render(<TrainingPage />);
    expect(screen.getByText('states.noOrganizationSelectedTitle')).toBeInTheDocument();
    expect(calls).toEqual([]);
  });
});
