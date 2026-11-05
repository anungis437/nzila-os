// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import { MemberProfile } from './member-profile'

afterEach(cleanup)

function renderProfile(locale: 'en-CA' | 'fr-CA', onSignOut = vi.fn()) {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <MemberProfile name="QA Member" email="member@nzila.test" phone="" organization="UE QA Primary Local" role="Member" onSignOut={onSignOut} />
    </NextIntlClientProvider>,
  )
  return onSignOut
}

describe('MemberProfile', () => {
  it('shows only the member\'s own identity, read-only', () => {
    renderProfile('en-CA')
    expect(screen.getByText('QA Member')).toBeInTheDocument()
    expect(screen.getByText('member@nzila.test')).toBeInTheDocument()
    expect(screen.getByText('UE QA Primary Local')).toBeInTheDocument()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('offers no delete, export, security, privacy or save controls', () => {
    renderProfile('en-CA')
    for (const control of [/delete/i, /download/i, /two-factor/i, /password/i, /visibility/i, /save/i, /change photo/i]) {
      expect(screen.queryByText(control)).not.toBeInTheDocument()
    }
    expect(screen.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Sign Out'])
  })

  it('tells the member whom to contact instead of showing inert controls', () => {
    renderProfile('en-CA')
    expect(screen.getByText(/contact your union administrator/i)).toBeInTheDocument()
  })

  it('is localized in French and signs out', () => {
    const onSignOut = renderProfile('fr-CA')
    expect(screen.getByText(/administrateur de votre syndicat/i)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('lists the pages that really manage something, as links, and nothing when none is given', () => {
    render(
      <NextIntlClientProvider locale="en-CA" messages={enCA}>
        <MemberProfile
          name="Staff"
          email="staff@nzila.test"
          phone=""
          organization="UE QA Primary Local"
          role="Steward"
          onSignOut={vi.fn()}
          manage={[
            { href: '/en-CA/settings/mfa', title: 'Two-factor authentication', description: 'Protect your sign-in.' },
          ]}
        />
      </NextIntlClientProvider>,
    )
    expect(screen.getByRole('link', { name: /Two-factor authentication/ })).toHaveAttribute('href', '/en-CA/settings/mfa')
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    cleanup()
    renderProfile('en-CA')
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
