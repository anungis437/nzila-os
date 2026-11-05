// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '../../../../../messages/en-CA.json';
import frCA from '../../../../../messages/fr-CA.json';
import { CorrespondenceDetailDialog } from '../correspondence-detail-dialog';
import { actionsFor, readCorrespondenceDetail, readCorrespondenceList, readSignatures } from '../correspondence-readers';

vi.mock('@/lib/correspondence/typed-signature', () => ({
  renderTypedSignature: vi.fn(async () => ({ imageUrl: 'data:image/png;base64,AAAA', imageHash: 'a'.repeat(64) })),
}));

// Radix dialog primitives measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);

const ID = '6f1b8e0a-4c2d-4e5f-9a7b-3d2c1b0a9f8e';
const SIGNATURE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const letter = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  referenceNumber: 'LTR-2026-0001',
  subject: 'Grievance notification',
  body: 'Dear Employer,\nA grievance has been filed.',
  type: 'letter',
  priority: 'high',
  status: 'draft',
  draftedBy: 'clerk-1',
  assignedSignerId: null,
  internalNotes: null,
  approvedAt: null,
  signedAt: null,
  dispatchedAt: null,
  dispatchMethod: null,
  createdAt: '2026-03-02T15:04:00.000Z',
  updatedAt: '2026-03-03T09:30:00.000Z',
  recipients: [{ id: 'r1', recipientType: 'to', name: 'Pat Doe', email: 'pat@acme.test', mailingAddress: null, organization: 'Acme Corp', title: null }],
  auditTrail: [{ id: 'a1', eventType: 'created', eventDescription: 'Correspondence created', actorName: 'Casey Archer', actorRole: 'clerk', timestamp: '2026-03-02T15:04:00.000Z' }],
  ...overrides,
});

const detailBody = (overrides: Record<string, unknown> = {}) => ({ success: true, data: { data: letter(overrides) } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers by "METHOD path"; a request nobody planned for fails the test instead of getting a made-up answer. */
function router(table: Record<string, () => Response | Promise<Response>>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = table[key];
    if (!handler) return Promise.reject(new Error(`unplanned request: ${key}`));
    return Promise.resolve(handler());
  });
}

const sent = (fetchMock: ReturnType<typeof router>, key: string) => {
  const call = fetchMock.mock.calls.find(([input, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${String(input)}` === key);
  const init = call?.[1] as RequestInit | undefined;
  return init?.body ? JSON.parse(init.body as string) : undefined;
};

function renderDialog(viewer: { userId: string; canSign: boolean }, locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <CorrespondenceDetailDialog letterId={ID} viewer={viewer} onClose={onClose} onChanged={onChanged} />
    </NextIntlClientProvider>,
  );
  return { onClose, onChanged };
}

const STEWARD = { userId: 'steward-1', canSign: false };
const OFFICER = { userId: 'officer-1', canSign: true };
const GET = `GET /api/correspondence/${ID}`;

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('the readers', () => {
  it('read the list and the letter the routes return, and refuse a shape they do not return', () => {
    const [first] = readCorrespondenceList({ success: true, data: { data: [letter()], count: 1 } });
    expect(first).toMatchObject({ id: ID, status: 'draft', assignedSignerId: null, referenceNumber: 'LTR-2026-0001' });

    const detail = readCorrespondenceDetail(detailBody({ status: 'dispatched', dispatchedAt: '2026-03-05T12:00:00.000Z', dispatchMethod: 'courier' }));
    expect(detail.recipients[0]).toMatchObject({ kind: 'to', name: 'Pat Doe', organization: 'Acme Corp' });
    expect(detail.history[0]).toMatchObject({ event: 'created', actorName: 'Casey Archer' });
    expect(detail.dispatchedAt?.toISOString()).toBe('2026-03-05T12:00:00.000Z');

    expect(() => readCorrespondenceList({ data: [letter()] })).toThrow(/Unexpected API response/);
    expect(() => readCorrespondenceList({ data: { data: [letter({ status: 'archived' })] } })).toThrow(/not a correspondence status/);
    expect(() => readCorrespondenceDetail({ data: { data: { ...letter(), recipients: undefined } } })).toThrow(/recipients is not a list/);
    expect(readSignatures({ data: { data: [{ id: SIGNATURE, displayName: 'Ada', displayTitle: null, isDefault: true }] } })).toEqual([
      { id: SIGNATURE, displayName: 'Ada', displayTitle: null, isDefault: true },
    ]);
  });

  it('say what a person may do with a letter, as the routes do', () => {
    const draft = { status: 'draft', draftedBy: 'clerk-1', assignedSignerId: null } as const;
    expect(actionsFor(draft, STEWARD)).toMatchObject({ edit: true, submit: false, claimSigner: false, cancel: true });
    expect(actionsFor(draft, OFFICER)).toMatchObject({ submit: false, claimSigner: true });
    expect(actionsFor({ ...draft, assignedSignerId: 'officer-1' }, STEWARD)).toMatchObject({ submit: true });

    const pending = { status: 'pending_review', draftedBy: 'officer-1', assignedSignerId: 'officer-1' } as const;
    expect(actionsFor(pending, OFFICER)).toMatchObject({ approve: false, requestRevision: true });
    expect(actionsFor({ ...pending, draftedBy: 'clerk-1' }, OFFICER)).toMatchObject({ approve: true });
    expect(actionsFor({ ...pending, draftedBy: 'clerk-1' }, STEWARD)).toMatchObject({ approve: false, requestRevision: false, cancel: true });

    const approved = { status: 'approved', draftedBy: 'clerk-1', assignedSignerId: 'officer-1' } as const;
    expect(actionsFor(approved, OFFICER)).toMatchObject({ sign: true });
    expect(actionsFor(approved, { userId: 'officer-2', canSign: true })).toMatchObject({ sign: false });
    expect(actionsFor({ ...approved, status: 'signed' }, STEWARD)).toMatchObject({ dispatch: true, cancel: true });
    expect(Object.values(actionsFor({ ...approved, status: 'dispatched' }, OFFICER)).some(Boolean)).toBe(false);
    expect(actionsFor({ ...approved, status: 'cancelled' }, OFFICER)).toMatchObject({ reopen: true });
    expect(actionsFor({ ...approved, status: 'cancelled' }, STEWARD)).toMatchObject({ reopen: false });
  });
});

describe('CorrespondenceDetailDialog: what it shows', () => {
  it('shows the letter, its recipients and its history as the server holds them', async () => {
    vi.stubGlobal('fetch', router({ [GET]: () => json(200, detailBody()) }));
    renderDialog(STEWARD);
    expect(await screen.findByText('Grievance notification')).toBeInTheDocument();
    expect(screen.getByText('LTR-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText(/A grievance has been filed\./)).toBeInTheDocument();
    expect(screen.getByText(/Pat Doe, Acme Corp <pat@acme\.test>/)).toBeInTheDocument();
    expect(screen.getByText(/Casey Archer \(clerk\)/)).toBeInTheDocument();
    expect(screen.getByText('None assigned')).toBeInTheDocument();
  });

  it('says plainly that the letter could not be loaded, and shows nothing of it', async () => {
    vi.stubGlobal('fetch', router({ [GET]: () => json(404, { code: 'NOT_FOUND', message: 'Correspondence not found' }) }));
    const { onClose } = renderDialog(STEWARD);
    expect(await screen.findByRole('alert')).toHaveTextContent('Correspondence not found');
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('refuses an answer that is not a letter instead of showing a blank one', async () => {
    vi.stubGlobal('fetch', router({ [GET]: () => json(200, { success: true, data: { data: { id: ID } } }) }));
    renderDialog(STEWARD);
    expect(await screen.findByRole('alert')).toHaveTextContent('not in a form this page understands');
  });

  it('is localized in French', async () => {
    vi.stubGlobal('fetch', router({ [GET]: () => json(200, detailBody({ status: 'pending_review' })) }));
    renderDialog(OFFICER, 'fr-CA');
    expect(await screen.findByText('En révision')).toBeInTheDocument();
    expect(screen.getByText('Historique')).toBeInTheDocument();
    expect(screen.getByText(/Créée — Casey Archer/)).toBeInTheDocument();
  });
});

describe('CorrespondenceDetailDialog: a draft', () => {
  it('cannot be submitted without a signer, and a steward is told to ask an officer', async () => {
    vi.stubGlobal('fetch', router({ [GET]: () => json(200, detailBody()) }));
    renderDialog(STEWARD);
    await screen.findByText('Grievance notification');
    expect(screen.queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take as signer' })).not.toBeInTheDocument();
    expect(screen.getByText(/Ask an officer to take it as its signer/)).toBeInTheDocument();
  });

  it('lets an officer take it as signer, then offers to submit it, reading the letter again each time', async () => {
    let signer: string | null = null;
    const fetchMock = router({
      [GET]: () => json(200, detailBody({ assignedSignerId: signer })),
      [`PATCH /api/correspondence/${ID}`]: () => {
        signer = 'officer-1';
        return json(200, { success: true, data: { data: letter({ assignedSignerId: 'officer-1' }) } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const { onChanged } = renderDialog(OFFICER);
    fireEvent.click(await screen.findByRole('button', { name: 'Take as signer' }));
    expect(await screen.findByRole('button', { name: 'Submit for review' })).toBeInTheDocument();
    expect(sent(fetchMock, `PATCH /api/correspondence/${ID}`)).toEqual({ assignedSignerId: 'officer-1' });
    expect(screen.getByText('You are now the signer.')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('is submitted for review, and what is shown afterwards is what the server then holds', async () => {
    let status = 'draft';
    const fetchMock = router({
      [GET]: () => json(200, detailBody({ status, assignedSignerId: 'officer-1' })),
      [`POST /api/correspondence/${ID}/submit`]: () => {
        status = 'pending_review';
        return json(200, { success: true, data: { data: letter({ status }) } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(STEWARD);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Submitted for review.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument();
  });

  it('is edited with the subject, text, type and priority the route accepts', async () => {
    const fetchMock = router({
      [GET]: () => json(200, detailBody()),
      [`PATCH /api/correspondence/${ID}`]: () => json(200, { success: true, data: { data: letter({ subject: 'Revised notice' }) } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(STEWARD);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: '  Revised notice ' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'urgent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(sent(fetchMock, `PATCH /api/correspondence/${ID}`)).toEqual({
      subject: 'Revised notice',
      body: 'Dear Employer,\nA grievance has been filed.',
      type: 'letter',
      priority: 'urgent',
    }));
  });

  it('is cancelled only with a reason of at least three characters, which is sent as given', async () => {
    const fetchMock = router({
      [GET]: () => json(200, detailBody()),
      [`POST /api/correspondence/${ID}/cancel`]: () => json(200, { success: true, data: { data: letter({ status: 'cancelled' }) } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(STEWARD);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel letter' }));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'ab' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: ' Sent in error ' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(sent(fetchMock, `POST /api/correspondence/${ID}/cancel`)).toEqual({ reason: 'Sent in error' }));
  });
});

describe('CorrespondenceDetailDialog: review and signing', () => {
  it('lets an officer who did not draft the letter approve it, and not the officer who did', async () => {
    vi.stubGlobal('fetch', router({ [GET]: () => json(200, detailBody({ status: 'pending_review', draftedBy: 'clerk-1', assignedSignerId: 'officer-1' })) }));
    renderDialog(OFFICER);
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send back for revision' })).toBeInTheDocument();
    cleanup();

    vi.stubGlobal('fetch', router({ [GET]: () => json(200, detailBody({ status: 'pending_review', draftedBy: 'officer-1', assignedSignerId: 'officer-1' })) }));
    renderDialog(OFFICER);
    await screen.findByText('Grievance notification');
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it("shows the server's refusal as it states it, and leaves the letter as it was", async () => {
    vi.stubGlobal(
      'fetch',
      router({
        [GET]: () => json(200, detailBody({ status: 'pending_review', draftedBy: 'clerk-1', assignedSignerId: 'officer-1' })),
        [`POST /api/correspondence/${ID}/approve`]: () => json(403, { code: 'FORBIDDEN', message: 'The drafter of a correspondence cannot approve it' }),
      }),
    );
    const { onChanged } = renderDialog(OFFICER);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByTestId('correspondence-action-error')).toHaveTextContent('The drafter of a correspondence cannot approve it');
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('says so when the request never reaches the server', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(json(200, detailBody({ status: 'pending_review', draftedBy: 'clerk-1' }))),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(OFFICER);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByTestId('correspondence-action-error')).toHaveTextContent('Check the connection');
  });

  it('sends a letter back for revision with the reason, and reopens a cancelled one through the same route', async () => {
    const fetchMock = router({
      [GET]: () => json(200, detailBody({ status: 'approved', draftedBy: 'clerk-1', assignedSignerId: 'officer-2' })),
      [`POST /api/correspondence/${ID}/revision`]: () => json(200, { success: true, data: { data: letter({ status: 'draft' }) } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(OFFICER);
    fireEvent.click(await screen.findByRole('button', { name: 'Send back for revision' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Wrong employer named' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(sent(fetchMock, `POST /api/correspondence/${ID}/revision`)).toEqual({ reason: 'Wrong employer named' }));
    cleanup();

    vi.stubGlobal('fetch', router({ [GET]: () => json(200, detailBody({ status: 'cancelled' })) }));
    renderDialog(OFFICER);
    expect(await screen.findByRole('button', { name: 'Reopen as draft' })).toBeInTheDocument();
  });

  it('signs with a saved signature, only for the signer', async () => {
    const fetchMock = router({
      [GET]: () => json(200, detailBody({ status: 'approved', draftedBy: 'clerk-1', assignedSignerId: 'officer-1' })),
      'GET /api/correspondence/signatures': () => json(200, { success: true, data: { data: [{ id: SIGNATURE, displayName: 'Ada Officer', displayTitle: 'President', isDefault: true }] } }),
      [`POST /api/correspondence/${ID}/sign`]: () => json(200, { success: true, data: { data: letter({ status: 'signed' }) } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(OFFICER);
    expect(await screen.findByRole('option', { name: 'Ada Officer — President' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign letter' }));
    await waitFor(() => expect(sent(fetchMock, `POST /api/correspondence/${ID}/sign`)).toEqual({ signatureId: SIGNATURE }));
    cleanup();

    // Another officer is told whom the letter waits for, and is offered no signature.
    const other = router({ [GET]: () => json(200, detailBody({ status: 'approved', draftedBy: 'clerk-1', assignedSignerId: 'officer-1' })) });
    vi.stubGlobal('fetch', other);
    renderDialog({ userId: 'officer-2', canSign: true });
    expect(await screen.findByText(/Waiting for the assigned signer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign letter' })).not.toBeInTheDocument();
    expect(other.mock.calls.some(([input]) => String(input).includes('signatures'))).toBe(false);
  });

  it('makes a typed signature when the signer has none, then offers it for signing', async () => {
    let saved = false;
    const fetchMock = router({
      [GET]: () => json(200, detailBody({ status: 'approved', draftedBy: 'clerk-1', assignedSignerId: 'officer-1' })),
      'GET /api/correspondence/signatures': () =>
        json(200, { success: true, data: { data: saved ? [{ id: SIGNATURE, displayName: 'Ada Officer', displayTitle: null, isDefault: true }] : [] } }),
      'POST /api/correspondence/signatures': () => {
        saved = true;
        return json(200, { success: true, data: { data: { id: SIGNATURE } } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(OFFICER);
    expect(await screen.findByText(/You have no saved signature/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save signature' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name on the signature'), { target: { value: ' Ada Officer ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save signature' }));
    expect(await screen.findByRole('button', { name: 'Sign letter' })).toBeInTheDocument();
    expect(sent(fetchMock, 'POST /api/correspondence/signatures')).toEqual({
      displayName: 'Ada Officer',
      source: 'typed',
      imageUrl: 'data:image/png;base64,AAAA',
      imageHash: 'a'.repeat(64),
    });
    expect(screen.getByText('Signature saved.')).toBeInTheDocument();
  });
});

describe('CorrespondenceDetailDialog: a signed letter', () => {
  it('is dispatched by the method chosen, and offers nothing once dispatched', async () => {
    let status = 'signed';
    const fetchMock = router({
      [GET]: () => json(200, detailBody({ status, assignedSignerId: 'officer-1', dispatchedAt: status === 'dispatched' ? '2026-03-05T12:00:00.000Z' : null, dispatchMethod: status === 'dispatched' ? 'courier' : null })),
      [`POST /api/correspondence/${ID}/dispatch`]: () => {
        status = 'dispatched';
        return json(200, { success: true, data: { data: letter({ status }) } });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog(STEWARD);
    fireEvent.change(await screen.findByLabelText('How it was sent'), { target: { value: 'courier' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as dispatched' }));
    expect(await screen.findByText(/\(Courier\)/)).toBeInTheDocument();
    expect(sent(fetchMock, `POST /api/correspondence/${ID}/dispatch`)).toEqual({ dispatchMethod: 'courier' });
    const next = screen.getByRole('region', { name: 'Next step' });
    expect(within(next).getByText('No further action is available for this letter.')).toBeInTheDocument();
  });
});
