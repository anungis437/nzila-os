// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import en from '../../messages/en.json'
import fr from '../../messages/fr.json'
import itIT from '../../messages/it.json'
import pt from '../../messages/pt.json'
import { MemberCaseList, claimLabelKey } from './member-case-list'
import type { ClaimRow } from './claim-list-table'

afterEach(cleanup)

const rows: ClaimRow[] = [
  { claimId: 'claim-1', claimNumber: 'UE-QA-0001', memberName: '', claimType: 'grievance_pay', status: 'submitted',
    priority: 'medium', incidentDate: new Date('2026-04-27'), createdAt: new Date('2026-04-30T12:00:00Z') },
  { claimId: 'claim-2', claimNumber: 'UE-QA-0002', memberName: '', claimType: 'grievance_discipline', status: 'under_review',
    priority: 'critical', incidentDate: new Date('2026-04-27'), createdAt: new Date('2026-04-30T12:00:00Z') },
  { claimId: 'claim-3', claimNumber: 'UE-QA-0003', memberName: '', claimType: 'some_new_type', status: 'mystery_state',
    priority: 'weird', incidentDate: new Date('2026-04-27'), createdAt: new Date('2026-04-30T12:00:00Z') },
]

function renderList(locale: 'en-CA' | 'fr-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <MemberCaseList data={rows} />
    </NextIntlClientProvider>,
  )
}

describe('MemberCaseList', () => {
  it('shows localized English labels and no staff controls', () => {
    renderList('en-CA')
    expect(screen.getAllByText('Grievance – Pay').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Under Review').length).toBeGreaterThan(0)
    expect(screen.queryByText('Grievance_pay')).not.toBeInTheDocument()
    expect(screen.queryByText(/grievance_pay/i)).not.toBeInTheDocument()
    for (const staffControl of [/^member$/i, /export/i, /columns/i, /filters/i, /select (all|row)/i, /assigned to/i]) {
      expect(screen.queryByText(staffControl)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(staffControl)).not.toBeInTheDocument()
    }
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.trim()).filter(Boolean))
      .toEqual(['Case #', 'Type', 'Status', 'Priority', 'Submitted', 'View case'])
  })

  it('shows localized French labels', () => {
    renderList('fr-CA')
    expect(screen.getAllByText('Grief – Rémunération').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Grief – Discipline').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Urgente').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.trim()).filter(Boolean))
      .toEqual(['N° de dossier', 'Type', 'Statut', 'Priorité', 'Soumis le', 'Voir le dossier'])
  })

  it('humanizes unknown values instead of printing raw identifiers', () => {
    renderList('en-CA')
    expect(screen.getAllByText('Some new type').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mystery state').length).toBeGreaterThan(0)
    expect(screen.queryByText('some_new_type')).not.toBeInTheDocument()
  })

  it('links each case to its own detail page with the locale prefix', () => {
    renderList('en-CA')
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/en-CA/dashboard/claims/claim-1')
    expect(hrefs).toContain('/en-CA/dashboard/claims/claim-2')
  })

  it('maps claim identifiers to message keys', () => {
    expect(claimLabelKey('grievance_pay')).toBe('grievancePay')
    expect(claimLabelKey('pending_documentation')).toBe('pendingDocumentation')
    expect(claimLabelKey('submitted')).toBe('submitted')
  })
})

describe('claimsPage locale parity', () => {
  it('defines the same claimsPage keys, all non-empty, in every locale', () => {
    const base = Object.keys(en.claimsPage).sort()
    for (const messages of [enCA, fr, frCA, itIT, pt]) {
      expect(Object.keys(messages.claimsPage).sort()).toEqual(base)
    }
    for (const messages of [en, enCA, fr, frCA, itIT, pt]) {
      for (const value of Object.values(messages.claimsPage)) expect(String(value).trim()).not.toBe('')
    }
  })
})
