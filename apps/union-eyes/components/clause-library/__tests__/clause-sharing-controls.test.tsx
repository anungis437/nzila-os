// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ClauseSharingControls } from '../ClauseSharingControls';

// Radix dialog and radio primitives measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);

afterEach(() => cleanup());

type Level = 'private' | 'federation' | 'congress' | 'public';

function open(level: Level, onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ClauseSharingControls
      open
      onOpenChange={() => {}}
      clauseId="clause-1"
      currentSettings={{ sharingLevel: level, isAnonymized: false }}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe('ClauseSharingControls: sharing levels', () => {
  it('offers private and public, and shows federation and congress as unavailable with the reason', () => {
    open('private');
    expect(screen.getByRole('radio', { name: /Private/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Public/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Federation/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Congress/ })).toBeDisabled();
    expect(screen.getAllByText(/Not available yet: no other organization can read a clause at this level/)).toHaveLength(2);
    // The two levels are no longer described as reaching other organizations.
    expect(screen.queryByText(/Shared with all organizations in your federation/)).toBeNull();
    expect(screen.queryByText(/Shared with all CLC member organizations/)).toBeNull();
  });

  it('saves a level the owner can choose, and never one that is unavailable', async () => {
    const onSave = open('private');
    fireEvent.click(screen.getByRole('radio', { name: /Public/ }));
    expect(screen.getByRole('radio', { name: /Public/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Federation/ }));
    expect(screen.getByRole('radio', { name: /Federation/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Public/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ sharingLevel: 'public' });
  });

  it('tells the owner of a clause stored at a withdrawn level that only their organization sees it', () => {
    open('federation');
    expect(screen.getByTestId('withdrawn-level-notice')).toHaveTextContent(/stored at the federation level, which no other organization can read/);
    expect(screen.getByRole('radio', { name: /Federation/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Federation/ })).toBeDisabled();
  });

  it('gives no withdrawn-level notice for a clause at a level that is offered', () => {
    open('public');
    expect(screen.queryByTestId('withdrawn-level-notice')).toBeNull();
  });

  it('warns only about public access, and does not promise congress-wide access', () => {
    open('public');
    expect(screen.getByText(/accessible to all users, including those outside the CLC/)).toBeInTheDocument();
    cleanup();
    open('congress');
    expect(screen.queryByText(/all CLC member organizations/)).toBeNull();
    expect(screen.queryByText(/Privacy Notice/)).toBeNull();
  });
});
