// @vitest-environment jsdom
import { createElement, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

vi.mock('framer-motion', () => {
  // One component per tag, so that a re-render does not look like a different component and remount the form.
  const components = new Map<string, ComponentType<Record<string, unknown>>>();
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => {
          let component = components.get(tag);
          if (!component) {
            component = function Motion({ initial: _initial, animate: _animate, transition: _transition, ...props }: Record<string, unknown>) {
              return createElement(tag as unknown as ComponentType, props);
            };
            components.set(tag, component);
          }
          return component;
        },
      },
    ),
  };
});
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import PlatformSettingsContent, { type PlatformSettingsData, type PlatformSettingsValues } from '../platform-settings-content';

/** The settings as the settings page hands them over: yes/no where the route's policy takes yes/no. */
const data = (values: Partial<PlatformSettingsValues> = {}): PlatformSettingsData => ({
  settings: {
    sessionTimeout: 30,
    mfaEnforcement: true,
    passwordMinLength: 12,
    requireMixedCase: true,
    requireSymbol: true,
    rateLimitPerMin: 100,
    emailDigest: true,
    digestFrequency: 'daily',
    pushNotifications: true,
    smsAlerts: true,
    webhookNotifications: false,
    webhookUrl: '',
    voiceGrievance: true,
    aiClauseAnalysis: true,
    mobileAccess: true,
    crossUnionAnalytics: false,
    defaultLanguage: 'en',
    dateFormat: 'YYYY-MM-DD',
    currency: 'CAD',
    ...values,
  },
  apiKeys: [{ id: 'key-1', keyName: 'CI key', keyPrefix: 'ue_live_ab12', status: 'active', scopes: ['read'], requestCount: 12345 }],
  integrations: [{ label: 'Database', status: 'healthy', detail: 'healthy' }],
  featuresEnabled: ['claims'],
});

const saved = (extra: Record<string, unknown> = {}): Answer => ({ status: 200, body: { success: true, data: { updated: true, ...extra }, timestamp: '2026-03-04T00:00:00.000Z' } });
const refused = (status: number, message: string): Answer => ({ status, body: { code: 'VALIDATION_ERROR', message } });

let save: Answer;
let calls: Call[];

beforeEach(() => {
  save = saved();
  calls = installFetch(() => save);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const puts = () => calls.filter((call) => call.method === 'PUT');
const section = (user: ReturnType<typeof userEvent.setup>, name: string) => user.click(screen.getByRole('button', { name }));
const saveButton = () => screen.getByRole('button', { name: 'Save Changes' });

describe('PlatformSettingsContent: what it offers', () => {
  it('says the security options are stored preferences that no mechanism reads', () => {
    render(<PlatformSettingsContent initialData={data()} />);

    expect(screen.getByText('Stored preferences, not enforced controls')).toBeInTheDocument();
    expect(screen.getByText(/do not read them/)).toBeInTheDocument();
  });

  it('offers multi-factor authentication and SMS alerts as yes/no, since the route takes yes/no for both', async () => {
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data({ mfaEnforcement: false, smsAlerts: true })} />);

    expect(screen.getByRole('checkbox', { name: 'Require multi-factor authentication' })).not.toBeChecked();
    expect(screen.queryByText('MFA enforcement')).toBeNull();
    await section(user, 'Notifications');
    expect(screen.getByRole('checkbox', { name: 'SMS alerts' })).toBeChecked();
    expect(screen.queryByText(/Critical only|All alerts/)).toBeNull();
  });

  it('says a webhook is saved only, since nothing sends it', async () => {
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);
    await section(user, 'Notifications');

    expect(screen.queryByText(/no webhook is sent/)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Webhook notifications' }));
    expect(screen.getByText('Saved only: no webhook is sent from this setting yet.')).toBeInTheDocument();
  });
});

describe('PlatformSettingsContent: saving', () => {
  it('sends only what was changed, and a yes/no as a yes/no', async () => {
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);

    await user.click(screen.getByRole('checkbox', { name: 'Require multi-factor authentication' }));
    await user.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(calls[0].url).toBe('/api/settings/organization');
    expect(puts()[0].body).toEqual({ settings: { mfaEnforcement: false } });
    await waitFor(() => expect(screen.queryByText('You have unsaved changes')).toBeNull());
  });

  it('sends each setting that was changed, whichever section it is in', async () => {
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);

    await user.selectOptions(screen.getAllByRole('combobox')[0], '60');
    await section(user, 'Localization');
    await user.selectOptions(screen.getAllByRole('combobox')[2], 'USD');
    await user.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].body).toEqual({ settings: { sessionTimeout: 60, currency: 'USD' } });
  });

  it('shows what the route says about a saved setting that nothing enforces', async () => {
    save = saved({ message: 'Saved. These settings are stored but not yet enforced by the platform: mfaEnforcement' });
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);

    await user.click(screen.getByRole('checkbox', { name: 'Require multi-factor authentication' }));
    await user.click(saveButton());

    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('stored but not yet enforced by the platform: mfaEnforcement'))).toBe(true));
  });

  it('shows the route\'s reason when it refused the settings, and keeps the change and the save bar', async () => {
    save = refused(400, 'Settings were not saved (invalid value: passwordMinLength)');
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);

    await user.click(screen.getByRole('checkbox', { name: 'Require mixed case' }));
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Settings were not saved (invalid value: passwordMinLength)');
    expect(screen.getByRole('checkbox', { name: 'Require mixed case' })).not.toBeChecked();
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

    // The change is still unsaved, so it is sent again.
    save = saved();
    await user.click(saveButton());
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1].body).toEqual({ settings: { requireMixedCase: false } });
    await waitFor(() => expect(screen.queryByText('You have unsaved changes')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not call a response saved that did not say so', async () => {
    save = { status: 200, body: { success: true, data: { updated: false, message: 'No fields to update' } } };
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);

    await user.click(screen.getByRole('checkbox', { name: 'Require symbols' }));
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('The server did not confirm that the settings were saved.');
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  });

  it('shows a request that never reached the server', async () => {
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    await user.click(screen.getByRole('checkbox', { name: 'Require symbols' }));
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  });

  it('sends a value that was changed back to what it was before the last save, since that save changed it', async () => {
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);
    const mixedCase = screen.getByRole('checkbox', { name: 'Require mixed case' });

    await user.click(mixedCase);
    await user.click(saveButton());
    await waitFor(() => expect(puts()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('You have unsaved changes')).toBeNull());

    await user.click(screen.getByRole('checkbox', { name: 'Require mixed case' }));
    await user.click(saveButton());
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[0].body).toEqual({ settings: { requireMixedCase: false } });
    expect(puts()[1].body).toEqual({ settings: { requireMixedCase: true } });
  });

  it('asks nothing when a change was undone before saving', async () => {
    const user = userEvent.setup();
    render(<PlatformSettingsContent initialData={data()} />);

    await user.click(screen.getByRole('checkbox', { name: 'Require symbols' }));
    await user.click(screen.getByRole('checkbox', { name: 'Require symbols' }));
    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByText('You have unsaved changes')).toBeNull());
    expect(calls).toEqual([]);
  });
});

describe('PlatformSettingsContent: API keys', () => {
  it('copies the key prefix, and says so only when it was copied', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<PlatformSettingsContent initialData={data()} />);
    await section(user, 'API Keys');

    await user.click(screen.getByRole('button', { name: 'Copy key prefix' }));

    expect(writeText).toHaveBeenCalledWith('ue_live_ab12');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the prefix could not be copied when the browser refused', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    render(<PlatformSettingsContent initialData={data()} />);
    await section(user, 'API Keys');

    await user.click(screen.getByRole('button', { name: 'Copy key prefix' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The key prefix could not be copied.');
  });
});
