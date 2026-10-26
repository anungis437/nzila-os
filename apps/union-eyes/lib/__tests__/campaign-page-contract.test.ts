import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP = join(__dirname, '..', '..')
const PAGE = join(APP, 'app', '[locale]', 'dashboard', 'communications', 'campaigns', '[id]', 'page.tsx')

describe('campaign detail page', () => {
  const source = readFileSync(PAGE, 'utf8')

  it('calls only the campaign API that exists, never a message-thread path or a send endpoint', () => {
    expect(source).toContain('/api/communications/campaigns/${params.id}')
    expect(source).not.toMatch(/\/api\/messages\/threads/)
    expect(source).not.toMatch(/\/send`/)
  })

  it('has no delivery capability and says so in every locale instead of failing silently', () => {
    expect(source).toContain("t('errors.sendUnavailable')")
    for (const locale of ['en-CA', 'en', 'fr-CA', 'fr', 'it', 'pt']) {
      const messages = JSON.parse(readFileSync(join(APP, 'messages', `${locale}.json`), 'utf8'))
      expect(messages.communicationsCampaignDetailPage.errors.sendUnavailable, locale).toEqual(expect.any(String))
    }
  })
})
