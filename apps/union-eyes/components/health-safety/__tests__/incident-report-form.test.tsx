// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// Radix selects and popovers measure elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));

import { IncidentReportForm, type IncidentFormData } from '../IncidentReportForm';

const valid: Partial<IncidentFormData> = {
  incidentDate: new Date(2026, 2, 4),
  incidentTime: '14:30',
  location: 'Loading dock',
  department: '',
  incidentType: 'injury',
  severity: 'major',
  description: 'A pallet slid off the forks and struck a worker on the left leg while it was being stacked',
  immediateCause: 'The forks were not fully under the pallet',
  rootCause: '',
  injuriesOccurred: false,
  injuryDetails: '',
  witnessesPresent: false,
  witnessNames: '',
  witnessContacts: '',
  correctiveActions: '',
  preventiveMeasures: '',
  isAnonymous: false,
  reportedBy: 'Ada Lovelace',
  reporterContact: 'ada@union.example',
};

beforeEach(() => {
  toast.mockClear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('IncidentReportForm', () => {
  it('has no attachment input and no Save Draft button: no route stores a file and nothing restores a draft', () => {
    const { container } = render(<IncidentReportForm onSubmit={vi.fn()} />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText('Attachments')).toBeNull();
    expect(screen.queryByRole('button', { name: /draft/i })).toBeNull();
  });

  it('keeps nothing of the report in the browser while it is typed', async () => {
    const user = userEvent.setup();
    render(<IncidentReportForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/^Location/), 'Loading dock');
    expect(localStorage.length).toBe(0);
  });

  it('hands the typed report to the host, which owns saving it', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    render(<IncidentReportForm initialData={valid} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Submit Report' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ incidentType: 'injury', severity: 'major', incidentTime: '14:30', location: 'Loading dock', reportedBy: 'Ada Lovelace' });
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows the host’s refusal, and stays editable, when saving fails', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new Error("Requires at least 'health_safety_rep' role");
    });
    render(<IncidentReportForm initialData={valid} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Submit Report' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      title: 'Error',
      description: "Requires at least 'health_safety_rep' role",
      variant: 'destructive',
    }));
    expect(screen.getByRole('button', { name: 'Submit Report' })).toBeEnabled();
    expect(screen.getByLabelText(/^Location/)).toHaveValue('Loading dock');
  });

  it('does not hand over a report that fails its own checks', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    render(<IncidentReportForm initialData={{ ...valid, description: 'too short' }} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Submit Report' }));
    expect(await screen.findByText('Description must be at least 50 characters')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows Cancel only when the host gave it somewhere to go', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { unmount } = render(<IncidentReportForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    unmount();

    render(<IncidentReportForm onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
