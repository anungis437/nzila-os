// @vitest-environment jsdom
import { createElement, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import messages from '@/messages/en-CA.json';
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
vi.mock('@/components/dashboard/page-heading', () => ({ PageHeading: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const lookup = (path: string): unknown =>
  path.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages);
const msg = (path: string): string => {
  const text = lookup(path);
  if (typeof text !== 'string') throw new Error(`missing message ${path}`);
  return text;
};

vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
  useTranslations: () => (key: string) => {
    const text = lookup(key);
    if (typeof text !== 'string') throw new Error(`missing message ${key}`);
    return text;
  },
}));

import OrgSettingsContent from '../org-settings-content';

/** What GET /api/settings/organization answers inside withApi's envelope (app/api/settings/organization/route.ts). */
const organization = (values: Record<string, unknown> = {}, settings: Record<string, unknown> = {}) => ({
  id: 'org-1',
  name: 'Local 1000',
  shortName: 'L1000',
  provinceTerritory: 'ON',
  organizationType: 'local',
  status: 'active',
  memberCount: 41,
  subscriptionTier: 'Standard',
  featuresEnabled: [],
  fiscalYearEnd: null,
  settings,
  ...values,
});
const loadBody = (org: unknown, notEnforced: string[] = []): Answer => ({ status: 200, body: { success: true, data: { organization: org, notEnforced }, timestamp: '2026-03-04T00:00:00.000Z' } });
const saved = (extra: Record<string, unknown> = {}): Answer => ({ status: 200, body: { success: true, data: { updated: true, ...extra }, timestamp: '2026-03-04T00:00:00.000Z' } });
const refused = (status: number, message: string): Answer => ({ status, body: { code: 'VALIDATION_ERROR', message } });

let load: Answer;
let save: Answer;
let calls: Call[];

beforeEach(() => {
  load = loadBody(organization());
  save = saved();
  calls = installFetch(({ method }) => (method === 'PUT' ? save : load));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const puts = () => calls.filter((call) => call.method === 'PUT');
const section = async (user: ReturnType<typeof userEvent.setup>, key: string) => user.click(screen.getByRole('button', { name: msg(`settings.sections.${key}`) }));
const renderLoaded = async () => {
  render(<OrgSettingsContent />);
  await screen.findByDisplayValue('Local 1000');
};

describe('OrgSettingsContent: what it shows', () => {
  it('reads the settings of the organization from the settings route, and shows its name, short name and region', async () => {
    await renderLoaded();

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/settings/organization']);
    expect(screen.getByDisplayValue('L1000')).toBeInTheDocument();
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('ON');
  });

  it('shows a province the form has no name for as itself, not as Ontario, and shows no region when none is stored', async () => {
    load = loadBody(organization({ provinceTerritory: 'NS' }));
    await renderLoaded();

    const region = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(region.value).toBe('NS');
    expect(within(region).getByRole('option', { name: 'NS' })).toBeInTheDocument();

    cleanup();
    load = loadBody(organization({ provinceTerritory: '' }));
    await renderLoaded();
    const unset = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(unset.value).toBe('');
    expect(unset.selectedOptions[0]).toHaveTextContent('—');
  });

  it('shows a provider nobody chose as not set, not as SendGrid, Twilio and S3, and a stored one as stored', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await section(user, 'integrations');

    for (const label of ['Email provider selection', 'SMS provider selection', 'Storage provider selection']) {
      const select = screen.getByLabelText(label) as HTMLSelectElement;
      expect(select.value, label).toBe('');
      expect(select.selectedOptions[0]).toHaveTextContent('—');
    }

    cleanup();
    load = loadBody(organization({}, { emailProvider: 'mailgun', smsProvider: 'postmark', storageProvider: 'azure' }));
    await renderLoaded();
    await section(user, 'integrations');
    expect((screen.getByLabelText('Email provider selection') as HTMLSelectElement).value).toBe('mailgun');
    // A value the form has no name for is still shown, so that the select never claims another one.
    expect((screen.getByLabelText('SMS provider selection') as HTMLSelectElement).value).toBe('postmark');
    expect((screen.getByLabelText('Storage provider selection') as HTMLSelectElement).value).toBe('azure');
  });

  it('shows a stored alert threshold of zero as zero', async () => {
    const user = userEvent.setup();
    load = loadBody(organization({}, { alertThreshold: 0 }));
    await renderLoaded();
    await section(user, 'notifications');

    expect(screen.getByLabelText('Alert threshold percentage')).toHaveValue(0);
  });

  it('shows allowed domains saved as text, and an IP list saved as a list', async () => {
    const user = userEvent.setup();
    load = loadBody(organization({}, { allowedDomains: 'a.example, b.example;c.example', ipWhitelist: ['10.0.0.1', '10.0.0.2'] }));
    await renderLoaded();
    await section(user, 'security');

    expect(screen.getByRole('button', { name: 'Remove a.example' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove b.example' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove c.example' })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/10\.0\.0\.1/)).toHaveValue('10.0.0.1\n10.0.0.2');
  });

  it('names the settings the route says are not enforced', async () => {
    const user = userEvent.setup();
    load = loadBody(organization({}, { requireMFA: true }), ['requireMFA']);
    await renderLoaded();
    await section(user, 'security');

    expect(screen.getByText(/Saved but unenforced fields: requireMFA/)).toBeInTheDocument();
  });

  it('has no logo upload button, which uploaded nothing, and a logo address field in its place', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await section(user, 'branding');

    expect(screen.queryByRole('button', { name: msg('settings.uploadLogo') })).toBeNull();
    expect(screen.getByLabelText('Logo URL (https)')).toBeInTheDocument();
  });
});

describe('OrgSettingsContent: saving', () => {
  it('sends only what was changed, so that defaults on the screen are not written as choices', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    const name = screen.getByDisplayValue('Local 1000');
    await user.clear(name);
    await user.type(name, 'Local 1001');
    await user.click(screen.getByRole('button', { name: msg('settings.saveChanges') }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].body).toEqual({ name: 'Local 1001' });
    await waitFor(() => expect(screen.queryByText('You have unsaved changes')).toBeNull());
  });

  it('sends a changed setting under settings, and a changed column under its own name', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.type(screen.getByDisplayValue('L1000'), 'X');
    await section(user, 'integrations');
    await user.selectOptions(screen.getByLabelText('Email provider selection'), 'mailgun');
    await user.click(screen.getByRole('button', { name: msg('settings.saveChanges') }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].body).toEqual({ shortName: 'L1000X', settings: { emailProvider: 'mailgun' } });
  });

  it('sends the logo address', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await section(user, 'branding');
    await user.type(screen.getByLabelText('Logo URL (https)'), 'https://cdn.example/logo.png');
    await user.click(screen.getByRole('button', { name: msg('settings.saveChanges') }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].body).toEqual({ settings: { logoUrl: 'https://cdn.example/logo.png' } });
  });

  // DEF-0B11-IDS-SETTINGS-SECURITY-POLICY-VALUES-ARE-SAVED-AS-UPDATED-TRUE-AND-ENFORCED-BY-NO-CODE: the route refuses a save of any
  // security setting no code enforces, so the screen shows what is stored and offers no control (domains, IP list, MFA, passwords,
  // session) that could only be refused. These replace the tests that added and removed allowed domains.
  it('offers no way to change a security setting that no code enforces, and sends none of them', async () => {
    const user = userEvent.setup();
    load = loadBody(organization({}, { allowedDomains: ['a.example', 'b.example'], ipWhitelist: '10.0.0.1', requireMFA: true }), ['requireMFA', 'ipWhitelist', 'allowedDomains']);
    await renderLoaded();
    await section(user, 'security');

    expect(screen.getByText(/the platform refuses to save a control it does not enforce/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove a.example' })).toBeDisabled();
    expect(screen.getByLabelText('Add an allowed email domain')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByLabelText('IP allowlist')).toBeDisabled();
    expect(screen.getByLabelText('Session timeout duration')).toBeDisabled();
    expect(screen.getByLabelText('Require multi-factor authentication')).toBeDisabled();
    expect(screen.getByLabelText('Enforce strong passwords')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Remove a.example' }));
    expect(screen.getByRole('button', { name: 'Remove a.example' })).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
  });

  it('shows the route\'s reason when it refused the settings, and keeps the changes and the save bar', async () => {
    save = refused(400, 'Settings were not saved (invalid value: sessionTimeout)');
    const user = userEvent.setup();
    await renderLoaded();

    await user.type(screen.getByDisplayValue('L1000'), 'X');
    await user.click(screen.getByRole('button', { name: msg('settings.saveChanges') }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Settings were not saved (invalid value: sessionTimeout)');
    expect(screen.getByDisplayValue('L1000X')).toBeInTheDocument();
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  });

  it('does not call a response saved that did not say so', async () => {
    save = { status: 200, body: { success: true, data: { updated: false, message: 'No fields to update' } } };
    const user = userEvent.setup();
    await renderLoaded();

    await user.type(screen.getByDisplayValue('L1000'), 'X');
    await user.click(screen.getByRole('button', { name: msg('settings.saveChanges') }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No fields to update');
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  });

  it('shows a request that never reached the server', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    await user.type(screen.getByDisplayValue('L1000'), 'X');
    await user.click(screen.getByRole('button', { name: msg('settings.saveChanges') }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });

  it('refuses an alert threshold that is not a whole number from 1 to 100 before asking the route', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await section(user, 'notifications');

    await user.clear(screen.getByLabelText('Alert threshold percentage'));
    await user.click(screen.getByRole('button', { name: msg('settings.saveChanges') }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The alert threshold must be a whole number from 1 to 100.');
    expect(puts()).toEqual([]);
  });

  it('reads the settings of the route again for Discard', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.type(screen.getByDisplayValue('L1000'), 'X');
    await user.click(screen.getByRole('button', { name: msg('settings.discard') }));

    expect(await screen.findByDisplayValue('L1000')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2);
  });
});

describe('OrgSettingsContent: when the settings cannot be shown', () => {
  it('says why the route refused, and Retry reads them again', async () => {
    load = refused(403, 'Forbidden: requires admin role');
    const user = userEvent.setup();
    render(<OrgSettingsContent />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(msg('settings.loadUnavailable'));
    expect(alert).toHaveTextContent('Forbidden: requires admin role');

    load = loadBody(organization());
    await user.click(within(alert).getByRole('button', { name: msg('settings.retryLoad') }));

    expect(await screen.findByDisplayValue('Local 1000')).toBeInTheDocument();
  });

  it('says no organization is selected when the route has none', async () => {
    load = loadBody(null);
    render(<OrgSettingsContent />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No organization is selected, so there are no settings to show.');
  });

  it.each([
    ['a body with no data', { success: true }, 'Unexpected API response: no data'],
    ['an organization that is not a record', { success: true, data: { organization: 'Local 1000' } }, 'Unexpected API response: no organization'],
  ])('reports %s instead of showing blank settings', async (_what, body, message) => {
    load = { status: 200, body };
    render(<OrgSettingsContent />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByDisplayValue('Local 1000')).toBeNull();
  });
});
