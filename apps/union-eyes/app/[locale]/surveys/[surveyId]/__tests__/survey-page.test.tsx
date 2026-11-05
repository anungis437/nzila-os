// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../../../../messages/en-CA.json'

import SurveyResponsePage from '../page'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('survey response page', () => {
  it('says a survey cannot be answered, and reads and sends nothing', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(
      <NextIntlClientProvider locale="en-CA" messages={enCA}>
        <SurveyResponsePage />
      </NextIntlClientProvider>,
    )
    expect(screen.getByRole('heading', { name: enCA.surveyPage.surveyNotAvailableTitle })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Not available in this release')
    expect(screen.getByText('UE-SURVEYS-RESPOND')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('offers no way to submit a response and promises no results page', () => {
    render(
      <NextIntlClientProvider locale="en-CA" messages={enCA}>
        <SurveyResponsePage />
      </NextIntlClientProvider>,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(enCA.surveyPage.thankYouTitle)).not.toBeInTheDocument()
    expect(screen.queryByText(enCA.surveyPage.viewResultsButton)).not.toBeInTheDocument()
  })
})
