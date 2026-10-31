import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listPage } from '@/lib/api/list-page'
import { assertOwnStorageUrl } from '@/lib/services/own-storage-reference'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

describe('S4 code closure of partial fixes', () => {
  describe('list paging', () => {
    const page = (query: string, max?: number, def?: number) => listPage({ url: `http://localhost/api/x${query}` }, max, def)
    it('defaults to the cap, so a caller that sends nothing gets what the route always returned', () => {
      expect(page('', 200)).toEqual({ limit: 200, offset: 0 })
    })
    it('bounds a limit and an offset and turns a bad value into the default', () => {
      expect(page('?limit=9999&offset=40', 200)).toEqual({ limit: 200, offset: 40 })
      expect(page('?limit=0', 200)).toEqual({ limit: 1, offset: 0 })
      expect(page('?limit=abc&offset=-5', 200)).toEqual({ limit: 200, offset: 0 })
      expect(page('?offset=99999999', 200).offset).toBe(1_000_000)
    })
    it('honours a smaller default', () => {
      expect(page('', 100, 20)).toEqual({ limit: 20, offset: 0 })
    })
    it('is applied by all six pension list reads', () => {
      for (const name of ['plans', 'trustees', 'members', 'benefits', 'contributions', 't4a']) {
        const source = read(`app/api/pension/${name}/route.ts`)
        expect(source).toContain('listPage(request, LIST_LIMIT)')
        expect(source).toContain('.offset(page.offset)')
      }
    })
  })

  describe('a linked committee file URL', () => {
    const saved = { name: process.env.AZURE_STORAGE_ACCOUNT_NAME, endpoint: process.env.AZURE_STORAGE_BLOB_ENDPOINT, container: process.env.AZURE_BLOB_CONTAINER }
    beforeEach(() => {
      delete process.env.AZURE_STORAGE_BLOB_ENDPOINT
      delete process.env.AZURE_BLOB_CONTAINER
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'ueaccount'
    })
    afterEach(() => {
      for (const [key, value] of [['AZURE_STORAGE_ACCOUNT_NAME', saved.name], ['AZURE_STORAGE_BLOB_ENDPOINT', saved.endpoint], ['AZURE_BLOB_CONTAINER', saved.container]] as const) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    const own = (org: string) => `https://ueaccount.blob.core.windows.net/union-eyes/documents/${org}/minutes/a.pdf`

    it('accepts none, and a pointer into the organization\'s own storage', () => {
      expect(() => assertOwnStorageUrl(undefined, ORG)).not.toThrow()
      expect(() => assertOwnStorageUrl(own(ORG), ORG)).not.toThrow()
    })
    it('refuses another host, another organization\'s folder, a credential and a traversal', () => {
      for (const url of [
        'https://evil.example/union-eyes/documents/' + ORG + '/minutes/a.pdf',
        own(OTHER),
        'https://user:pw@ueaccount.blob.core.windows.net/union-eyes/documents/' + ORG + '/minutes/a.pdf',
        'https://ueaccount.blob.core.windows.net/union-eyes/documents/' + ORG + '/../' + OTHER + '/a.pdf',
        'http://169.254.169.254/latest/meta-data',
      ]) {
        expect(() => assertOwnStorageUrl(url, ORG), url).toThrow()
      }
    })
    it('is applied by the committee document link route', () => {
      expect(read('app/api/committees/[id]/documents/route.ts')).toContain('assertOwnStorageUrl(body.fileUrl, organizationId)')
    })
  })

  it('keeps the event update from re-pointing an event at another calendar: the patch schema is strict and has no calendarId', () => {
    const source = read('app/api/calendar/events/[id]/route.ts')
    const schema = source.slice(source.indexOf('const patchSchema'), source.indexOf('export const PATCH'))
    expect(schema).not.toContain('calendarId')
    expect(schema).toContain('.strict()')
  })

  it('reads the wallet balance and the ledger page from one repeatable-read snapshot', () => {
    expect(read('lib/services/rewards/wallet-service.ts')).toContain("isolationLevel: 'repeatable read'")
    expect(read('app/api/rewards/wallet/route.ts')).toContain('getWalletSnapshot(organizationId, userId, limit, offset)')
  })
})
