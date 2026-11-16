// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import RepresentativeMatchingProfiles from '../representative-matching-profiles'

const language = vi.hoisted(() => ({ locale: 'en-CA' }))
vi.mock('next-intl', () => ({ useLocale: () => language.locale }))
const person = { userId: '11111111-1111-4111-8111-111111111111', label: 'Synthetic representative' }
let profiles: Array<Record<string, unknown>>
let calls: Record<string, unknown>[]
let accept: boolean
beforeEach(() => {
  language.locale = 'en-CA'; profiles = []; calls = []; accept = true
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body); calls.push(body)
      if (!accept) return Response.json({ error: 'Capacity conflict' }, { status: 409 })
      profiles = [{ ...body, id: 'profile', openCases: 2 }]
      return Response.json(profiles[0])
    }
    return Response.json({ profiles, representatives: [person], specializations: ['general', 'safety'] })
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('representative matching administration', () => {
  it('saves recorded expertise and capacity, then reads the saved workload back', async () => {
    render(<RepresentativeMatchingProfiles />)
    await userEvent.selectOptions(await screen.findByLabelText('Representative'), person.userId)
    await userEvent.selectOptions(screen.getByLabelText('Expertise'), 'safety')
    await userEvent.clear(screen.getByLabelText('Maximum open cases'))
    await userEvent.type(screen.getByLabelText('Maximum open cases'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.')
    expect(calls).toEqual([{ userId: person.userId, specialization: 'safety', maxCaseload: 5, active: true }])
    await waitFor(() => expect(screen.getByText('Workplace safety · 2/5 · Available')).toBeVisible())
    expect(screen.queryByText(person.userId)).toBeNull()
  })
  it('retains a refused edit without reporting success', async () => {
    accept = false; render(<RepresentativeMatchingProfiles />)
    await userEvent.selectOptions(await screen.findByLabelText('Representative'), person.userId)
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded or saved')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByLabelText('Representative')).toHaveValue(person.userId)
  })
  it('edits an unavailable representative in French so the profile can be disabled', async () => {
    language.locale = 'fr-CA'
    profiles = [{ id: 'old', userId: 'unavailable', specialization: 'safety', maxCaseload: 5, openCases: 2, active: true }]
    render(<RepresentativeMatchingProfiles />)
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    expect(screen.getByLabelText('Représentant')).toHaveValue('unavailable')
    await userEvent.click(screen.getByLabelText('Disponible'))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Profil enregistré.')
    expect(calls[0]).toMatchObject({ active: false, specialization: 'safety' })
  })
  it('reports an unavailable roster instead of presenting an empty successful form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Forbidden' }, { status: 403 })))
    render(<RepresentativeMatchingProfiles />)
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull()
  })
  it('rejects malformed successful metadata instead of showing invalid capacity as a usable profile', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ profiles: [{ id: 'profile', userId: person.userId, active: true, specialization: 'safety', maxCaseload: '5', openCases: 1 }], representatives: [person], specializations: ['safety'] })))
    render(<RepresentativeMatchingProfiles />)
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull()
  })
})
