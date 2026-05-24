/**
 * Smoke tests for doctrine whitepaper seeds.
 *
 * Guards:
 *   - Continuity Gap v3 is present, marked active, and tagged correctly.
 *   - Binary master path and canonical Markdown path resolve and are non-empty
 *     so silent ingestion regressions surface immediately.
 */
import { describe, expect, it } from 'vitest'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DOCTRINE_WHITEPAPERS,
  getDoctrineWhitepaper,
  seedDoctrineWhitepapers,
  createInMemoryKnowledgeStore,
  searchKnowledgeAssets,
} from './index'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')

describe('doctrine whitepapers — seed registry', () => {
  it('contains the Continuity Gap v3 whitepaper', () => {
    const wp = getDoctrineWhitepaper('wp.continuity-gap.v3')
    expect(wp).toBeDefined()
    expect(wp?.title).toMatch(/Continuity Gap/i)
    expect(wp?.edition).toMatch(/Evidence-Enhanced/i)
    expect(wp?.tags).toContain('oci')
    expect(wp?.tags).toContain('ocra')
    expect(wp?.introduces).toContain('Organizational Continuity Infrastructure (OCI)')
  })

  it('every seed has a binary master file present on disk', async () => {
    for (const wp of DOCTRINE_WHITEPAPERS) {
      const abs = join(REPO_ROOT, wp.binaryMaster)
      const s = await stat(abs)
      expect(s.isFile(), `${wp.id} binary master missing: ${wp.binaryMaster}`).toBe(true)
      expect(s.size).toBeGreaterThan(1024)
    }
  })

  it('every seed has a canonical Markdown file present and substantial', async () => {
    for (const wp of DOCTRINE_WHITEPAPERS) {
      const abs = join(REPO_ROOT, wp.canonicalMarkdown)
      const md = await readFile(abs, 'utf8')
      expect(md.length, `${wp.id} canonical Markdown too short`).toBeGreaterThan(4_000)
      expect(md).toContain(wp.title.split('—')[0].trim())
    }
  })

  it('seedDoctrineWhitepapers registers every seed as an active knowledge asset', async () => {
    const store = createInMemoryKnowledgeStore()
    const assets = await seedDoctrineWhitepapers(store)
    expect(assets.length).toBe(DOCTRINE_WHITEPAPERS.length)
    for (const a of assets) {
      expect(a.status).toBe('active')
      expect(a.knowledgeType).toBe('policy')
      expect(a.domainScope).toBe('doctrine.continuity')
    }
    const found = await searchKnowledgeAssets(store, { tags: ['whitepaper'] })
    expect(found.length).toBe(DOCTRINE_WHITEPAPERS.length)
  })
})
