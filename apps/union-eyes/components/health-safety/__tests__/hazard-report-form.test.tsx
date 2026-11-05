// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// Radix selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));

import { HazardReportForm } from '../HazardReportForm';

beforeEach(() => toast.mockClear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const DESCRIPTION = 'Oily rags are piled against the breaker panel on the loading dock';
const CONSEQUENCES = 'A fire could start and block the only exit';

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  const [hazardType, priority] = screen.getAllByRole('combobox');
  await user.click(hazardType);
  await user.click(await screen.findByRole('option', { name: 'Fire Hazard' }));
  await user.click(priority);
  await user.click(await screen.findByRole('option', { name: /High - Significant risk/ }));
  await user.type(screen.getByLabelText('Location *'), 'Loading dock');
  await user.type(screen.getByLabelText('Description *'), DESCRIPTION);
  await user.type(screen.getByLabelText('Potential Consequences *'), CONSEQUENCES);
  await user.type(screen.getByLabelText('Your Name *'), 'Ada Lovelace');
  await user.type(screen.getByLabelText('Your Contact *'), 'ada@union.example');
}

describe('HazardReportForm', () => {
  it('has no photo upload, because nothing stores the photos', () => {
    const { container } = render(<HazardReportForm onSubmit={vi.fn()} />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText('Photos')).toBeNull();
  });

  it('hands the typed report to the host, which owns saving it, and names no organization', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    render(<HazardReportForm onSubmit={onSubmit} />);
    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Submit Hazard Report' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      hazardType: 'fire',
      priority: 'high',
      location: 'Loading dock',
      description: DESCRIPTION,
      potentialConsequences: CONSEQUENCES,
      recommendedAction: '',
      reporterName: 'Ada Lovelace',
      reporterContact: 'ada@union.example',
      isAnonymous: false,
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows the host’s refusal, and stays editable, when saving fails', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new Error("Requires at least 'health_safety_rep' role");
    });
    render(<HazardReportForm onSubmit={onSubmit} />);
    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Submit Hazard Report' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      title: 'Error',
      description: "Requires at least 'health_safety_rep' role",
      variant: 'destructive',
    }));
    expect(screen.getByRole('button', { name: 'Submit Hazard Report' })).toBeEnabled();
    expect(screen.getByLabelText('Location *')).toHaveValue('Loading dock');
  });

  it('does not hand over a report that fails its own checks', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    render(<HazardReportForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Location *'), 'Loading dock');
    await user.type(screen.getByLabelText('Description *'), 'too short');
    await user.click(screen.getByRole('button', { name: 'Submit Hazard Report' }));

    expect(await screen.findByText('Description must be at least 30 characters')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for no reporter details when the report is anonymous', async () => {
    const user = userEvent.setup();
    render(<HazardReportForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Your Name *')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Report anonymously' }));
    expect(screen.queryByLabelText('Your Name *')).toBeNull();
  });

  it('shows Cancel only when the host gave it somewhere to go, and it goes there', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { unmount } = render(<HazardReportForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    unmount();

    render(<HazardReportForm onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
