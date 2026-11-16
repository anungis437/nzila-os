// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import OrganizationInvitations from '../organization-invitations';

const settings = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => settings.locale }));
vi.mock('../representative-matching-profiles', () => ({ default: () => null }));
const invite = { id: 'invite-id', email: 'new@example.invalid', role: 'member', expiresAt: '2030-01-01', acceptedAt: null, revokedAt: null };
let delivery: string;
let invitations: typeof invite[];
let calls: Array<{ url: string; body: Record<string, string> }>;
beforeEach(() => {
  settings.locale = 'en-CA'; delivery = 'failed'; invitations = []; calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.method) return Response.json({ invitations });
    const body = JSON.parse(String(init.body)); calls.push({ url, body });
    if (body.action === 'revoke') {
      invitations = [{ ...invite, revokedAt: '2026-11-15' }];
      return Response.json({ success: true });
    }
    invitations = [invite];
    return Response.json({ inviteId: invite.id, delivery }, { status: 201 });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function create() {
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create invitation' })).toBeEnabled());
  await user.type(screen.getByLabelText('Email'), 'new@example.invalid');
  await user.click(screen.getByRole('button', { name: 'Create invitation' }));
}

describe('organization invitations', () => {
  it('does not call a failed email sent, retains the pending invite and offers reissue', async () => {
    render(<OrganizationInvitations />); await create();
    expect(await screen.findByRole('status')).toHaveTextContent('email submission could not be confirmed');
    expect(screen.getByText(/Pending acceptance/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Reissue: new@example.invalid' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({ url: '/api/auth/invite/manage', body: { action: 'reissue', inviteId: invite.id } });
    expect(calls[0].body).toEqual({ email: 'new@example.invalid', role: 'member' });
  });

  it('distinguishes provider submission from inbox receipt', async () => {
    delivery = 'sent'; render(<OrganizationInvitations />); await create();
    expect(await screen.findByRole('status')).toHaveTextContent('Inbox receipt has not been confirmed');
  });

  it('revokes the selected invite and removes its recovery controls after reloading', async () => {
    invitations = [invite]; render(<OrganizationInvitations />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke: new@example.invalid' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reissue: new@example.invalid' })).toBeNull());
    expect(screen.getByRole('status')).toHaveTextContent('can no longer be accepted');
  });

  it('shows French controls and never offers actions for accepted or revoked invitations', async () => {
    settings.locale = 'fr-CA'; invitations = [{ ...invite, acceptedAt: '2026-11-15' }];
    render(<OrganizationInvitations />);
    expect(await screen.findByText(/Acceptée/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Créer une invitation' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Réémettre/ })).toBeNull();
  });

  it('shows a denied listing as an error instead of an empty successful roster', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Forbidden' }, { status: 403 })));
    render(<OrganizationInvitations />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invitations could not be loaded');
    expect(screen.queryByText('No invitations on file.')).toBeNull();
  });
  it('does not announce invitation creation from an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => Response.json(init?.method ? {} : { invitations: [] })));
    render(<OrganizationInvitations />); await create();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be completed');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
