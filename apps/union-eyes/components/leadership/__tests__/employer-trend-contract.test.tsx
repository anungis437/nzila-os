// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { buildLeadershipDashboard } from '@/lib/services/dashboard-kpi-service'
import { EmployerHotspotsTable } from '../employer-hotspots-table'
import en from '@/messages/en.json'
import fr from '@/messages/fr.json'

// Infrastructure is unused by the real pure aggregation function. Keep the
// producer and the rendering consumer real so an incompatible enum cannot be
// hidden by a page-level component double.
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }))
vi.mock('@/lib/services/cache-service', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }))
afterEach(cleanup)

describe('leadership metric producer to real employer table', () => {
  for (const [locale, messages] of [['en', en], ['fr', fr]] as const) {
    it.each(['up', 'down', 'stable'] as const)(`${locale}: renders the actual %s aggregate`, expected => {
      // Monthly dashboards compare two full chart windows, not adjacent months.
      const dates = expected === 'up' ? ['2026-11-15'] : expected === 'down' ? ['2025-01-15'] : ['2025-01-15', '2026-11-15']
      const rows = dates.map((date, index) => ({ id: `synthetic-${index}`, organizationId: 'synthetic-org',
        employerId: 'synthetic-employer', employerName: 'Synthetic employer', status: 'investigating',
        filedDate: new Date(date), createdAt: new Date(date), updatedAt: new Date(date),
        type: 'contract', step: 'step_1', timeline: null, unionRepId: null, responseDeadline: null,
      })) as Parameters<typeof buildLeadershipDashboard>[0]
      const payload = buildLeadershipDashboard(rows, [], 'monthly', new Date('2026-11-17T12:00:00Z'))
      expect(payload.employers).toHaveLength(1)
      expect(payload.employers[0].trend).toBe(expected)
      render(<NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <EmployerHotspotsTable employers={payload.employers} />
      </NextIntlClientProvider>)
      expect(screen.getByText('Synthetic employer')).toBeTruthy()
      expect(screen.getByText(messages.leadershipDashboard.employerHotspots.trend[
        expected === 'up' ? 'increasing' : expected === 'down' ? 'decreasing' : 'stable'
      ])).toBeTruthy()
    })
  }
})
