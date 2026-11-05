// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import AdminPaymentsList from '../admin/dues/payments/page';
import PaymentDetailPage from '../admin/dues/payments/[id]/page';
import OrganizerImpactPage from '../organizer/impact/page';
import FieldNotesPage from '../organizing/notes/page';
import NewFieldNotePage from '../organizing/notes/new/page';
import ScheduledReportsPage from '../admin/scheduled-reports/page';
import TrusteePortalPage from '@/components/pension/trustee-portal-page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Surface {
  name: string;
  Page: ComponentType;
  capability: string;
  heading: { en: string; fr: string };
}

// Each of these surfaces was wired to a route that answers HTTP 501 (or to a trustee check that proves nothing). They
// say so, offer no action, and ask the server for nothing.
const SURFACES: Surface[] = [
  {
    name: 'admin payments list',
    Page: AdminPaymentsList,
    capability: 'UE-FIN-DUES-ADMIN-PAYMENTS',
    heading: { en: enCA.adminPaymentsPage.pageTitle, fr: frCA.adminPaymentsPage.pageTitle },
  },
  {
    name: 'admin payment detail',
    Page: PaymentDetailPage,
    capability: 'UE-FIN-DUES-ADMIN-PAYMENTS',
    heading: { en: enCA.adminDuesPaymentDetailPage.title, fr: frCA.adminDuesPaymentDetailPage.title },
  },
  {
    name: 'organizer impact',
    Page: OrganizerImpactPage,
    capability: 'UE-ORGANIZER-IMPACT',
    heading: { en: enCA.organizerImpactPage.title, fr: frCA.organizerImpactPage.title },
  },
  {
    name: 'organizing field notes',
    Page: FieldNotesPage,
    capability: 'UE-ORGANIZING-FIELD-NOTES',
    heading: { en: enCA.organizingNotesPage.title, fr: frCA.organizingNotesPage.title },
  },
  {
    name: 'new organizing field note',
    Page: NewFieldNotePage,
    capability: 'UE-ORGANIZING-FIELD-NOTES',
    heading: { en: enCA.organizingNotesNewPage.pageTitle, fr: frCA.organizingNotesNewPage.pageTitle },
  },
  {
    name: 'scheduled reports',
    Page: ScheduledReportsPage,
    capability: 'UE-ANALYTICS-SCHEDULED-REPORTS-UI',
    heading: { en: enCA.adminScheduledReportsPage.title, fr: frCA.adminScheduledReportsPage.title },
  },
  {
    name: 'pension trustee portal',
    Page: TrusteePortalPage,
    capability: 'UE-FIN-PENSION-TRUSTEE-ADMIN',
    heading: { en: enCA.pensionTrusteePortalPage.title, fr: frCA.pensionTrusteePortalPage.title },
  },
];

function renderSurface(Page: ComponentType, locale: 'en-CA' | 'fr-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <Page />
    </NextIntlClientProvider>,
  );
}

describe.each(SURFACES)('$name', ({ Page, capability, heading }) => {
  it('states in English that the capability is not available, naming it', () => {
    const fetchMock = vi.fn(() => {
      throw new Error('a surface that is not available must not ask the server for anything');
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSurface(Page, 'en-CA');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading.en);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Not available in this release');
    expect(alert).toHaveTextContent(capability);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('states it in French in a French locale', () => {
    renderSurface(Page, 'fr-CA');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading.fr);
    expect(screen.getByRole('alert')).toHaveTextContent('Non disponible dans cette version');
  });

  it('offers no button, link or field that could appear to do the work', () => {
    renderSurface(Page, 'en-CA');

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});
