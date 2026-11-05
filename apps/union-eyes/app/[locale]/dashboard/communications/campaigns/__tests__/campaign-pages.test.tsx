// @vitest-environment jsdom
// The campaign detail page and the campaign wizard against a mocked fetch. They prove that the detail page reads the campaign from the shape the item
// route answers, shows "—" for a figure the record does not hold and never a rate whose base is zero, and offers nothing the application cannot do
// (send, edit, delete); and that the wizard saves a draft with only the fields and enum values the create route accepts, with a segment taken from
// the organization's real segments, shows the server's message when the save is refused, and says plainly that nothing is sent. The request body is
// checked against the route's own list of writable fields and the table's enums, read from their sources. They prove nothing about the routes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// Radix selects measure and scroll elements that jsdom does not implement.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const translate = vi.hoisted(() => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const logError = vi.hoisted(() => vi.fn());
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en-CA' }));
vi.mock('next/navigation', () => ({ useRouter: () => router, useParams: () => ({ locale: 'en-CA', id: 'c1' }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { isRecord } from '@/lib/client/api-envelope';
import CampaignDetailPage from '../[id]/page';
import NewCampaignPage from '../new/page';

type User = ReturnType<typeof userEvent.setup>;
type Reply = { status?: number; body?: unknown };
type Requests = { key: string; body: unknown }[];

const APP = join(__dirname, '..', '..', '..', '..', '..', '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The create route's own list of fields it accepts, and the table's enums, read from where they are declared.
function quoted(source: string, pattern: RegExp): string[] {
  const match = pattern.exec(source);
  if (!match) throw new Error(`not found: ${pattern}`);
  return [...match[1].matchAll(/'([A-Za-z_]+)'/g)].map((found) => found[1]);
}
const routeSource = readFileSync(join(APP, 'app', 'api', 'communications', 'campaigns', 'route.ts'), 'utf8');
const schemaSource = readFileSync(join(APP, 'db', 'schema', 'domains', 'communications', 'campaigns.ts'), 'utf8');
const writableFields = quoted(routeSource, /writableFields:\s*\[([^\]]*)\]/);
const campaignTypes = quoted(schemaSource, /pgEnum\('campaign_type',\s*\[([^\]]*)\]/);
const campaignChannels = quoted(schemaSource, /pgEnum\('campaign_channel',\s*\[([^\]]*)\]/);

/** What the create route and the table accept: nothing the delivery side owns, no field outside the writable list, only enum values that exist. */
function assertAcceptedByRoute(body: unknown) {
  if (!isRecord(body)) throw new Error('the request has no JSON object body');
  for (const key of Object.keys(body)) expect(writableFields, `${key} is not a writable field`).toContain(key);
  expect(campaignTypes).toContain(body.type);
  expect(campaignChannels).toContain(body.channel);
  if ('segmentId' in body) expect(body.segmentId).toMatch(UUID);
  if ('templateId' in body) expect(body.templateId).toMatch(UUID);
  for (const owned of ['status', 'sentAt', 'completedAt', 'stats', 'audienceCount', 'sendImmediately', 'scheduledAt', 'testMode']) {
    expect(body, `${owned} is the delivery side's`).not.toHaveProperty(owned);
  }
}

const SEGMENT_ID = '5b0f0c1e-3f0a-4d7e-9a58-2f4c9e1a7d10';
const EMAIL_TEMPLATE_ID = 'c4a8d1f2-7b36-4e19-8f0d-6a2b3c9e5f41';
const SMS_TEMPLATE_ID = '0a7e55c3-92d4-4b18-b6f1-8e3d2c4a9b57';
const CREATED_ID = 'e7d2a9b4-1c58-4f63-a0b9-3d8c5e2f7a16';

const zeros = { queued: 0, sent: 0, delivered: 0, bounced: 0, failed: 0, opened: 0, clicked: 0, unsubscribed: 0 };
// A campaign as GET /api/communications/campaigns/[id] answers it: the table's row, with the defaults a new draft takes.
const campaign = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  organizationId: 'org-1',
  name: 'Dues drive',
  description: 'Remind members',
  type: 'broadcast',
  channel: 'email',
  status: 'draft',
  templateId: null,
  segmentId: null,
  segmentQuery: null,
  audienceCount: 0,
  subject: 'Dues are due',
  body: 'Please pay by Friday',
  variables: {},
  scheduledAt: null,
  sendImmediately: false,
  timezone: 'America/Toronto',
  sentAt: null,
  completedAt: null,
  stats: zeros,
  settings: { trackOpens: true, trackClicks: false, respectQuietHours: true, quietHoursStart: '22:00', quietHoursEnd: '08:00', maxRetriesOnFail: 3, batchSize: 100 },
  metadata: {},
  tags: null,
  createdBy: 'user-1',
  updatedBy: null,
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-05T10:00:00Z',
  ...over,
});
const item = (record: unknown) => ({ success: true, data: { data: record }, timestamp: 'now' });
const list = (rows: unknown[]) => ({
  success: true,
  data: { data: rows, pagination: { page: 1, limit: 100, total: rows.length, totalPages: Math.ceil(rows.length / 100) } },
  timestamp: 'now',
});

const segment = { id: SEGMENT_ID, organizationId: 'org-1', name: 'Active members', description: null, filters: {}, isActive: true, isPublic: false };
const emailTemplate = { id: EMAIL_TEMPLATE_ID, organizationId: 'org-1', name: 'Welcome', type: 'email', category: 'welcome', subject: 'Welcome aboard', body: 'Hello and welcome', isActive: true };
const smsTemplate = { id: SMS_TEMPLATE_ID, organizationId: 'org-1', name: 'Reminder', type: 'sms', category: null, subject: null, body: 'Dues are due', isActive: true };

function mockServer(routes: Record<string, (body: unknown) => Reply>): Requests {
  const requests: Requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      const sent: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      requests.push({ key, body: sent });
      const { status = 200, body = {} } = routes[key]?.(sent) ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return requests;
}

const ITEM = 'GET /api/communications/campaigns/c1';
const SEGMENTS = 'GET /api/members/segments?limit=100&page=1';
const TEMPLATES = 'GET /api/communications/templates?limit=100&page=1';
const CREATE = 'POST /api/communications/campaigns';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** The card of a figure: the heading's header's card. */
function statCard(title: string): HTMLElement {
  const card = screen.getByRole('heading', { name: title }).parentElement?.parentElement;
  if (!card) throw new Error(`no card for ${title}`);
  return card;
}
const rowValue = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe('campaign detail page (jsdom, mocked server)', () => {
  it('shows the campaign as stored, from the shape the item route answers, with the id the router gave', async () => {
    const requests = mockServer({ [ITEM]: () => ({ body: item(campaign({ audienceCount: 120 })) }) });
    render(<CampaignDetailPage />);

    expect(await screen.findByRole('heading', { name: /Dues drive/ })).toBeInTheDocument();
    expect(screen.getByText('Remind members')).toBeInTheDocument();
    expect(screen.getByText('Dues are due')).toBeInTheDocument();
    expect(screen.getByText('Please pay by Friday')).toBeInTheDocument();
    expect(screen.getByText('statuses.draft')).toBeInTheDocument();
    expect(screen.getByText('types.broadcast')).toBeInTheDocument();
    expect(screen.getByText('channels.email')).toBeInTheDocument();
    expect(within(statCard('stats.audience.title')).getByText('120')).toBeInTheDocument();
    expect(screen.getByText('content.trackingOpens')).toBeInTheDocument();
    expect(screen.queryByText('content.trackingClicks')).not.toBeInTheDocument();
    expect(requests.map((request) => request.key)).toEqual([ITEM]);
  });

  it('labels a multi-channel campaign and a transactional one with the words for their enum values', async () => {
    mockServer({ [ITEM]: () => ({ body: item(campaign({ type: 'transactional', channel: 'multi_channel' })) }) });
    render(<CampaignDetailPage />);

    expect(await screen.findByText('types.transactional')).toBeInTheDocument();
    expect(screen.getByText('channels.multi_channel')).toBeInTheDocument();
  });

  it('works rates out from the counters where their base is positive', async () => {
    mockServer({ [ITEM]: () => ({ body: item(campaign({ status: 'sent', stats: { ...zeros, sent: 10, delivered: 8, opened: 4, clicked: 1 } })) }) });
    render(<CampaignDetailPage />);

    expect(await screen.findByText('stats.sent.description {"rate":"80.0"}')).toBeInTheDocument();
    expect(screen.getByText('stats.opened.description {"rate":"50.0"}')).toBeInTheDocument();
    expect(screen.getByText('stats.clicked.description {"rate":"25.0"}')).toBeInTheDocument();
  });

  it('leaves out the open and click rates, not NaN, when nothing was delivered or opened', async () => {
    mockServer({ [ITEM]: () => ({ body: item(campaign({ status: 'sent', stats: { ...zeros, sent: 10, delivered: 0 } })) }) });
    render(<CampaignDetailPage />);

    expect(await screen.findByText('stats.sent.description {"rate":"0.0"}')).toBeInTheDocument();
    expect(screen.queryByText(/stats\.opened\.description/)).not.toBeInTheDocument();
    expect(screen.queryByText(/stats\.clicked\.description/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('shows — for every figure the record does not hold, and for an audience nothing has counted, never 0', async () => {
    mockServer({ [ITEM]: () => ({ body: item(campaign({ stats: null, audienceCount: 0 })) }) });
    render(<CampaignDetailPage />);

    await screen.findByRole('heading', { name: /Dues drive/ });
    for (const title of ['stats.audience.title', 'stats.sent.title', 'stats.opened.title', 'stats.clicked.title']) {
      expect(within(statCard(title)).getByText('—'), title).toBeInTheDocument();
    }
    for (const label of ['delivery.queued', 'delivery.sent', 'delivery.delivered', 'delivery.failed', 'delivery.bounced', 'delivery.unsubscribed']) {
      expect(rowValue(label), label).toBe('—');
    }
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('UE-ACTION-CAMPAIGN-SEND');
  });

  it('shows the counters the record holds and — for the rest', async () => {
    mockServer({ [ITEM]: () => ({ body: item(campaign({ stats: { sent: 5, failed: 1 } })) }) });
    render(<CampaignDetailPage />);

    await screen.findByRole('heading', { name: /Dues drive/ });
    expect(rowValue('delivery.sent')).toBe('5');
    expect(rowValue('delivery.failed')).toBe('1');
    expect(rowValue('delivery.delivered')).toBe('—');
    expect(rowValue('delivery.queued')).toBe('—');
  });

  it('offers no send, edit, delete or preview, only a way back and a refresh, and says that nothing is sent', async () => {
    const requests = mockServer({ [ITEM]: () => ({ body: item(campaign()) }) });
    render(<CampaignDetailPage />);

    await screen.findByRole('heading', { name: /Dues drive/ });
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'backButton' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actions\.|send|edit|delete|preview/i })).not.toBeInTheDocument();
    expect(screen.getByText('UE-ACTION-CAMPAIGN-SEND')).toBeInTheDocument();
    expect(screen.getByText('Not available in this release')).toBeInTheDocument();
    expect(requests.map((request) => request.key)).toEqual([ITEM]);
  });

  it('goes back to the campaigns of the same locale', async () => {
    mockServer({ [ITEM]: () => ({ body: item(campaign()) }) });
    render(<CampaignDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'backButton' }));

    expect(router.push).toHaveBeenCalledWith('/en-CA/dashboard/communications/campaigns');
  });

  it('reads the campaign again when asked to refresh', async () => {
    const requests = mockServer({ [ITEM]: () => ({ body: item(campaign()) }) });
    render(<CampaignDetailPage />);

    await screen.findByRole('heading', { name: /Dues drive/ });
    const [, refresh] = screen.getAllByRole('button');
    fireEvent.click(refresh);

    await waitFor(() => expect(requests.filter((request) => request.key === ITEM)).toHaveLength(2));
  });

  it.each([
    ['the whole envelope in place of the record', { success: true, data: { data: { success: true } }, timestamp: 'now' }],
    ['a body with no data', { success: true }],
    ['a record with no name', item({ id: 'c1' })],
    ['a record with no created time', item({ id: 'c1', name: 'Dues drive', type: 'broadcast', channel: 'email', status: 'draft' })],
  ])('shows an error when the answer is %s', async (_what, body) => {
    mockServer({ [ITEM]: () => ({ body }) });
    render(<CampaignDetailPage />);

    expect(await screen.findByText('errors.fetchFailed')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Dues drive/ })).not.toBeInTheDocument();
  });

  it('tells a missing campaign from a failed read', async () => {
    mockServer({ [ITEM]: () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'Not found' } }) });
    render(<CampaignDetailPage />);

    expect(await screen.findByText('errors.notFound')).toBeInTheDocument();
  });

  it("shows the message the API gave when the read is refused", async () => {
    mockServer({ [ITEM]: () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" } }) });
    render(<CampaignDetailPage />);

    expect(await screen.findByText("Requires at least 'steward' role")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Dues drive/ })).not.toBeInTheDocument();
  });

  it('shows an error, not a blank page, when the request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<CampaignDetailPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });
});

describe('campaign wizard (jsdom, mocked server)', () => {
  const next = (user: User) => user.click(screen.getByRole('button', { name: /nextButton/ }));
  const name = (value: string) => fireEvent.change(screen.getByLabelText(/campaignNameLabel/), { target: { value } });
  const body = (value: string) => fireEvent.change(screen.getByLabelText(/messageLabel/), { target: { value } });
  const subject = (value: string) => fireEvent.change(screen.getByLabelText(/subjectLineLabel/), { target: { value } });
  async function choose(user: User, select: string, option: string) {
    const trigger = await screen.findByRole('combobox', { name: select });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: option }));
  }
  const reply = (over: Record<string, (b: unknown) => Reply> = {}) =>
    mockServer({
      [SEGMENTS]: () => ({ body: list([segment]) }),
      [TEMPLATES]: () => ({ body: list([emailTemplate, smsTemplate]) }),
      [CREATE]: () => ({ status: 201, body: item(campaign({ id: CREATED_ID })) }),
      ...over,
    });
  const posted = (requests: Requests) => requests.find((request) => request.key === CREATE)?.body;

  it('reads the organization\'s own segments and templates from the list shape the routes answer', async () => {
    const requests = reply();
    render(<NewCampaignPage />);

    await waitFor(() => expect(requests.map((request) => request.key)).toEqual(expect.arrayContaining([SEGMENTS, TEMPLATES])));
  });

  it('offers only the types and channels a campaign can have and this form can describe', async () => {
    reply();
    render(<NewCampaignPage />);

    const values = screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'));
    expect(values).toEqual(['broadcast', 'transactional', 'email', 'sms', 'push', 'multi_channel']);
    for (const value of values.slice(0, 2)) expect(campaignTypes).toContain(value);
    for (const value of values.slice(2)) expect(campaignChannels).toContain(value);
  });

  it('says on every step that campaigns are saved as drafts, and offers no way to send, schedule or test', async () => {
    reply();
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    const everyStep: string[] = [];
    expect(screen.getByText('draftNotice')).toBeInTheDocument();
    name('Dues drive');
    everyStep.push(document.body.textContent ?? '');
    await next(user);
    await screen.findByText('selectAudienceTitle');
    everyStep.push(document.body.textContent ?? '');
    await next(user);
    await screen.findByText('campaignContentTitle');
    subject('Dues are due');
    body('Please pay by Friday');
    everyStep.push(document.body.textContent ?? '');
    await next(user);
    await screen.findByText('reviewCampaignTitle');
    everyStep.push(document.body.textContent ?? '');

    expect(screen.getByText('draftNotice')).toBeInTheDocument();
    for (const text of everyStep) expect(text).not.toMatch(/schedule|sendNow|sendImmediately|testMode|estimatedAudience/i);
    expect(screen.getByText('UE-ACTION-CAMPAIGN-SEND')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /createCampaignButton/ })).toBeInTheDocument();
  });

  it('keeps Next disabled until the step has what the route needs', async () => {
    reply();
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    expect(screen.getByRole('button', { name: /nextButton/ })).toBeDisabled();
    name('Dues drive');
    expect(screen.getByRole('button', { name: /nextButton/ })).toBeEnabled();
    await next(user);
    await next(user);
    await screen.findByText('campaignContentTitle');
    expect(screen.getByRole('button', { name: /nextButton/ })).toBeDisabled();
    body('Please pay by Friday');
    expect(screen.getByRole('button', { name: /nextButton/ })).toBeDisabled();
    subject('Dues are due');
    expect(screen.getByRole('button', { name: /nextButton/ })).toBeEnabled();
  });

  it('saves a draft with only the fields the route accepts, the real segment id and the template chosen, and opens it', async () => {
    const requests = reply();
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    await choose(user, 'segmentLabel', 'Active members');
    await next(user);
    await user.click(await screen.findByRole('combobox', { name: 'templateLabel' }));
    await screen.findByRole('option', { name: 'Welcome' });
    expect(screen.queryByRole('option', { name: 'Reminder' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Welcome' }));
    expect(screen.getByLabelText(/subjectLineLabel/)).toHaveValue('Welcome aboard');
    expect(screen.getByLabelText(/messageLabel/)).toHaveValue('Hello and welcome');
    await next(user);
    expect(await screen.findByText('Active members')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /createCampaignButton/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/en-CA/dashboard/communications/campaigns/${CREATED_ID}`));
    expect(posted(requests)).toEqual({
      name: 'Dues drive',
      type: 'broadcast',
      channel: 'email',
      body: 'Hello and welcome',
      segmentId: SEGMENT_ID,
      templateId: EMAIL_TEMPLATE_ID,
      subject: 'Welcome aboard',
    });
    assertAcceptedByRoute(posted(requests));
  });

  it('offers exactly the segments the organization has, and an explicit choice of none', async () => {
    reply();
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    const trigger = await screen.findByRole('combobox', { name: 'segmentLabel' });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['segmentOptionNone', 'Active members']);
  });

  it('saves with no segment, not a made-up one, when the organization has none, and says so', async () => {
    const requests = reply({ [SEGMENTS]: () => ({ body: list([]) }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    expect(await screen.findByText('segmentsNone')).toBeInTheDocument();
    await next(user);
    await screen.findByText('campaignContentTitle');
    subject('Dues are due');
    body('Please pay by Friday');
    await next(user);
    await user.click(await screen.findByRole('button', { name: /createCampaignButton/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(screen.queryByText('Active members')).not.toBeInTheDocument();
    expect(posted(requests)).toEqual({ name: 'Dues drive', type: 'broadcast', channel: 'email', body: 'Please pay by Friday', subject: 'Dues are due' });
    expect(posted(requests)).not.toHaveProperty('segmentId');
    assertAcceptedByRoute(posted(requests));
  });

  it('says the segments could not be read, with the server\'s message, and logs why; the draft can still be saved without an audience', async () => {
    const requests = reply({ [SEGMENTS]: () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Segments are not available to you' } }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);

    expect(await screen.findByText(/segmentsLoadError.*Segments are not available to you/)).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith('Failed to read /api/members/segments', expect.any(Error));
    expect(screen.getByRole('combobox', { name: 'segmentLabel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /nextButton/ })).toBeEnabled();
    expect(requests.some((request) => request.key === CREATE)).toBe(false);
  });

  it('says so, instead of offering none, when the segments answer is not a list', async () => {
    reply({ [SEGMENTS]: () => ({ body: { success: true, data: { data: { id: 'x' } } } }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);

    expect(await screen.findByText('segmentsLoadError')).toBeInTheDocument();
    expect(screen.queryByText('segmentsNone')).not.toBeInTheDocument();
  });

  it('says the templates could not be read, and logs why, when the route refuses', async () => {
    reply({ [TEMPLATES]: () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: 'no' } }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    await next(user);

    expect(await screen.findByText(/fetchTemplatesError.*no/)).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith('Failed to read /api/communications/templates', expect.any(Error));
    expect(screen.getByLabelText(/messageLabel/)).toBeEnabled();
  });

  it('says so, instead of failing to render, when the templates answer is not a list', async () => {
    reply({ [TEMPLATES]: () => ({ body: { success: true, data: { data: { id: 'x' } } } }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    await next(user);

    expect(await screen.findByText('fetchTemplatesError')).toBeInTheDocument();
    expect(screen.getByText('campaignContentTitle')).toBeInTheDocument();
  });

  it('offers a template only for the channel it is written for, and says when there is none', async () => {
    reply({ [TEMPLATES]: () => ({ body: list([emailTemplate]) }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await user.click(screen.getByRole('radio', { name: /channelOptionSms/ }));
    await next(user);
    await next(user);

    expect(await screen.findByText('templatesNone')).toBeInTheDocument();
  });

  it('saves an sms campaign with no subject, and a transactional one as transactional', async () => {
    const requests = reply();
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues reminder');
    await user.click(screen.getByRole('radio', { name: /typeOptionTransactional/ }));
    await user.click(screen.getByRole('radio', { name: /channelOptionSms/ }));
    await next(user);
    await next(user);
    await screen.findByText('campaignContentTitle');
    expect(screen.queryByLabelText(/subjectLineLabel/)).not.toBeInTheDocument();
    body('Dues are due Friday');
    await next(user);
    await user.click(await screen.findByRole('button', { name: /createCampaignButton/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(posted(requests)).toEqual({ name: 'Dues reminder', type: 'transactional', channel: 'sms', body: 'Dues are due Friday' });
    assertAcceptedByRoute(posted(requests));
  });

  it('does not carry a template chosen for one channel to a campaign of another', async () => {
    const requests = reply();
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    await next(user);
    await user.click(await screen.findByRole('combobox', { name: 'templateLabel' }));
    await user.click(await screen.findByRole('option', { name: 'Welcome' }));
    await user.click(screen.getByRole('button', { name: /previousButton/ }));
    await user.click(screen.getByRole('button', { name: /previousButton/ }));
    await user.click(screen.getByRole('radio', { name: /channelOptionSms/ }));
    await next(user);
    await next(user);
    body('Dues are due Friday');
    await next(user);
    await user.click(await screen.findByRole('button', { name: /createCampaignButton/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(posted(requests)).toEqual({ name: 'Dues drive', type: 'broadcast', channel: 'sms', body: 'Dues are due Friday' });
    assertAcceptedByRoute(posted(requests));
  });

  it('sends the tracking settings only when a switch was turned off, since a body that carries them replaces the table\'s defaults', async () => {
    const requests = reply();
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    await next(user);
    await screen.findByText('campaignContentTitle');
    subject('Dues are due');
    body('Please pay by Friday');
    await user.click(screen.getByLabelText(/trackOpensLabel/));
    await next(user);
    await user.click(await screen.findByRole('button', { name: /createCampaignButton/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(posted(requests)).toMatchObject({ settings: { trackOpens: false, trackClicks: true } });
    assertAcceptedByRoute(posted(requests));
  });

  it.each([
    [400, { code: 'VALIDATION_ERROR', message: 'type must be one of: broadcast, sequence, triggered, transactional' }, 'type must be one of: broadcast, sequence, triggered, transactional'],
    [403, { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" }, "Requires at least 'steward' role"],
    [500, {}, 'createCampaignError'],
  ])('shows what the server said when the save is refused (%s), stays on the page and lets the user try again', async (status, answer, shown) => {
    reply({ [CREATE]: () => ({ status, body: answer }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    await next(user);
    await screen.findByText('campaignContentTitle');
    subject('Dues are due');
    body('Please pay by Friday');
    await next(user);
    await user.click(await screen.findByRole('button', { name: /createCampaignButton/ }));

    expect(await screen.findByText(shown)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /createCampaignButton/ })).toBeEnabled();
  });

  it('treats a created answer that names no campaign as a failure, not a page to open', async () => {
    reply({ [CREATE]: () => ({ status: 201, body: { success: true, data: { data: {} } } }) });
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    name('Dues drive');
    await next(user);
    await next(user);
    await screen.findByText('campaignContentTitle');
    subject('Dues are due');
    body('Please pay by Friday');
    await next(user);
    await user.click(await screen.findByRole('button', { name: /createCampaignButton/ }));

    expect(await screen.findByText('createCampaignError')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('the contract the wizard is held to', () => {
  it('reads what the route and the table declare, so the checks above are not vacuous', () => {
    expect(writableFields).toEqual(expect.arrayContaining(['name', 'type', 'channel', 'body', 'segmentId', 'templateId', 'subject', 'settings']));
    expect(writableFields).not.toEqual(expect.arrayContaining(['status']));
    expect(campaignTypes).toEqual(['broadcast', 'sequence', 'triggered', 'transactional']);
    expect(campaignChannels).toEqual(['email', 'sms', 'push', 'multi_channel']);
  });
});
