// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '../../../../../messages/en-CA.json';
import frCA from '../../../../../messages/fr-CA.json';
import { NewLetterComposer } from '../new-letter-composer';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function mount(locale: 'en-CA' | 'fr-CA') {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<NextIntlClientProvider locale={locale} messages={locale === 'fr-CA' ? frCA : enCA}>
    <NewLetterComposer onCreated={onCreated} onCancel={onCancel} userId="officer-1" canSign />
  </NextIntlClientProvider>);
  return { onCreated, onCancel };
}

describe('NewLetterComposer', () => {
  it.each(['en-CA', 'fr-CA'] as const)('creates the selected %s template without translating stored type or authority identifiers', async (locale) => {
    const c = (locale === 'fr-CA' ? frCA : enCA).correspondencePage.composer;
    const fetchMock = vi.fn().mockResolvedValue(json(201, { success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { onCreated } = mount(locale);
    const choice = screen.getByRole('button', { name: new RegExp(`^${c.templates.grievance_notification.label}`) });
    expect(choice.tagName).toBe('BUTTON');
    expect(screen.getAllByRole('button')).toHaveLength(10);
    fireEvent.click(choice);
    expect(screen.getByRole('textbox', { name: c.subject })).toHaveValue(c.templates.grievance_notification.subject);
    expect(screen.getByRole('textbox', { name: c.body })).toHaveValue(c.templates.grievance_notification.body);
    expect(screen.getByRole('button', { name: c.back })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: c.subject })).toBeRequired();
    fireEvent.change(screen.getByRole('textbox', { name: c.recipientName }), { target: { value: 'Controlled Recipient' } });
    fireEvent.change(screen.getByRole('textbox', { name: c.recipientEmail }), { target: { value: 'controlled@example.test' } });
    fireEvent.click(screen.getByRole('checkbox', { name: c.signMyself }));
    fireEvent.click(screen.getByRole('button', { name: c.create }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      subject: c.templates.grievance_notification.subject,
      body: c.templates.grievance_notification.body,
      type: 'letter', priority: 'high', assignedSignerId: 'officer-1',
      recipients: [{ name: 'Controlled Recipient', email: 'controlled@example.test', recipientType: 'to' }],
    });
    expect(toast.success).toHaveBeenCalledWith(c.created);
  });

  it('returns from compose using its named control and resets the blank draft', () => {
    const c = frCA.correspondencePage.composer;
    const { onCancel } = mount('fr-CA');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${c.templates.blank.label}`) }));
    expect(screen.getByRole('button', { name: c.create })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: c.subject }), { target: { value: 'Brouillon' } });
    fireEvent.click(screen.getByRole('button', { name: c.back }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${c.templates.blank.label}`) }));
    expect(screen.getByRole('textbox', { name: c.subject })).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: c.cancel }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it.each(['en-CA', 'fr-CA'] as const)('words a refused %s letter by the page language, and never shows an English sentence or exception text in French', async (locale) => {
    const c = (locale === 'fr-CA' ? frCA : enCA).correspondencePage.composer;
    const fetchMock = vi.fn().mockResolvedValue(json(422, { code: 'VALIDATION_ERROR', message: 'Recipient email is not valid' }));
    vi.stubGlobal('fetch', fetchMock);
    const { onCreated } = mount(locale);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${c.templates.blank.label}`) }));
    fireEvent.change(screen.getByRole('textbox', { name: c.subject }), { target: { value: 'Sujet' } });
    fireEvent.change(screen.getByRole('textbox', { name: c.body }), { target: { value: 'Texte' } });
    fireEvent.click(screen.getByRole('button', { name: c.create }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(toast.error).toHaveBeenCalledWith(locale === 'fr-CA' ? 'Certaines informations ne sont pas valides. Vérifiez-les, puis réessayez.' : 'Recipient email is not valid');
    expect(toast.success).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('keeps French failure and recovery text and requests a French AI draft', async () => {
    const c = frCA.correspondencePage.composer;
    const fetchMock = vi.fn().mockResolvedValue(json(503, { message: 'unavailable' }));
    vi.stubGlobal('fetch', fetchMock);
    mount('fr-CA');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${c.templates.blank.label}`) }));
    fireEvent.click(screen.getByRole('button', { name: c.aiAssist }));
    expect(toast.error).toHaveBeenCalledWith(c.aiSubjectRequired);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: c.subject }), { target: { value: 'Demande de rencontre' } });
    fireEvent.click(screen.getByRole('button', { name: c.aiAssist }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(c.aiUnavailable));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).query).toContain('Write in French.');
    expect(screen.getByRole('button', { name: c.aiAssist })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: c.body })).toHaveValue('');
  });
});
