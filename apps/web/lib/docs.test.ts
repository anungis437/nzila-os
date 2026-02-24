import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getAllDocs, getDocBySlug, getAllDocSlugs } from './docs'

/**
 * Tests for the docs utility. We override process.cwd() to point at a
 * temp directory so resolveContentDir resolves to our fixture data.
 */

let tmpRoot: string

beforeEach(() => {
  // Create a temp directory tree:  <tmpRoot>/apps/web  +  <tmpRoot>/content/public
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nzila-docs-test-'))
  const appDir = path.join(tmpRoot, 'apps', 'web')
  const contentDir = path.join(tmpRoot, 'content', 'public')
  fs.mkdirSync(appDir, { recursive: true })
  fs.mkdirSync(contentDir, { recursive: true })

  // Write fixture markdown
  fs.writeFileSync(
    path.join(contentDir, 'getting-started.md'),
    '---\ntitle: Getting Started\ndescription: How to begin\norder: 1\n---\nHello world\n',
  )
  fs.writeFileSync(
    path.join(contentDir, 'dated-doc.md'),
    '---\ntitle: Dated Doc\ndate: 2026-02-01\n---\nContent with a date\n',
  )
  fs.writeFileSync(
    path.join(contentDir, 'README.md'),
    '# Readme\nThis should be excluded\n',
  )

  const subDir = path.join(contentDir, 'guides')
  fs.mkdirSync(subDir, { recursive: true })
  fs.writeFileSync(
    path.join(subDir, 'advanced.md'),
    '---\ntitle: Advanced Guide\ncategory: guides\n---\nAdvanced content\n',
  )

  // Override cwd so resolveContentDir resolves correctly
  vi.spyOn(process, 'cwd').mockReturnValue(appDir)
})

describe('getAllDocs', () => {
  it('returns metadata for all markdown files', () => {
    const docs = getAllDocs('public')
    expect(docs.length).toBe(3)
  })

  it('excludes README.md', () => {
    const docs = getAllDocs('public')
    const slugs = docs.map((d) => d.slug)
    expect(slugs).not.toContain('README')
  })

  it('extracts frontmatter title', () => {
    const docs = getAllDocs('public')
    const gs = docs.find((d) => d.slug === 'getting-started')
    expect(gs?.title).toBe('Getting Started')
  })

  it('handles nested directories', () => {
    const docs = getAllDocs('public')
    const advanced = docs.find((d) => d.slug === 'guides/advanced')
    expect(advanced).toBeDefined()
    expect(advanced?.title).toBe('Advanced Guide')
  })

  it('coerces YAML date scalars to ISO string — not a Date object (regression: [object Date] React error)', () => {
    // gray-matter parses `date: 2026-02-01` as a JS Date — must be coerced to string
    const docs = getAllDocs('public')
    const dated = docs.find((d) => d.slug === 'dated-doc')
    expect(dated).toBeDefined()
    expect(typeof dated?.date).toBe('string')
    expect(dated?.date).toBe('2026-02-01')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((dated?.date as any) instanceof Date).toBe(false)
  })
})

describe('getDocBySlug', () => {
  it('returns doc with HTML content', async () => {
    const doc = await getDocBySlug('getting-started', 'public')
    expect(doc).not.toBeNull()
    expect(doc?.title).toBe('Getting Started')
    expect(doc?.htmlContent).toContain('Hello world')
  })

  it('returns null for non-existent slug', async () => {
    const doc = await getDocBySlug('does-not-exist', 'public')
    expect(doc).toBeNull()
  })

  it('coerces YAML date scalar to ISO string in single-doc fetch (regression: [object Date] React error)', async () => {
    const doc = await getDocBySlug('dated-doc', 'public')
    expect(doc).not.toBeNull()
    expect(typeof doc?.date).toBe('string')
    expect(doc?.date).toBe('2026-02-01')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((doc?.date as any) instanceof Date).toBe(false)
  })
})

describe('getAllDocSlugs', () => {
  it('returns slug arrays for static params', () => {
    const slugs = getAllDocSlugs('public')
    expect(slugs).toContainEqual(['getting-started'])
    expect(slugs).toContainEqual(['guides', 'advanced'])
  })
})
