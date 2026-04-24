import { describe, expect, it } from 'vitest'
import { buildShareLinks } from '../social-share'

describe('buildShareLinks', () => {
  it('creates encoded social links', () => {
    const links = buildShareLinks({
      title: 'Listen to Diaspora Rising',
      text: 'Check this release',
      url: 'https://zonga.example/releases/abc',
    })

    expect(links.x).toContain('x.com/intent/tweet')
    expect(links.facebook).toContain('facebook.com/sharer')
    expect(links.whatsapp).toContain('wa.me')
    expect(links.linkedin).toContain('linkedin.com/sharing')
  })

  it('falls back to title when text is absent', () => {
    const links = buildShareLinks({
      title: 'Afro-House Weekly',
      url: 'https://zonga.example/playlists/weekly',
    })

    expect(decodeURIComponent(links.x)).toContain('Afro-House Weekly')
  })
})
