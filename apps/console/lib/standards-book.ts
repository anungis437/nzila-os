/**
 * Standards & Scripts Book — host-side loader
 *
 * Reads chapter content from the `@nzila/scripts-book` package
 * (`template/scripts-book/<NN>-<slug>/README.md`) so the Standards
 * surface in the console reflects the real, versioned standards
 * rather than a hard-coded placeholder list.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { cache } from 'react'

export interface StandardsChapter {
  slug: string // e.g. "01-repo-bootstrap"
  number: string // e.g. "01"
  title: string // first H1 from README (or slug fallback)
  summary: string | null // first paragraph
  status: 'published' | 'draft'
}

export interface StandardsChapterDetail extends StandardsChapter {
  markdown: string
}

const CHAPTER_ROOT = path.join(
  process.cwd(),
  '..',
  '..',
  'packages',
  'scripts-book',
  'template',
  'scripts-book',
)

const DRAFT_KEYWORDS = ['todo', 'draft', 'placeholder', 'coming soon']

async function readChapterDir(): Promise<string[]> {
  try {
    const entries = await fs.readdir(CHAPTER_ROOT, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

function parseChapter(slug: string, raw: string): StandardsChapter {
  const lines = raw.split(/\r?\n/)
  const h1 = lines.find((l) => l.startsWith('# '))
  const title = h1 ? h1.replace(/^#\s+/, '').trim() : slug
  const firstParaIdx = lines.findIndex(
    (l, i) => i > 0 && l.trim().length > 0 && !l.startsWith('#'),
  )
  let summary: string | null = null
  if (firstParaIdx >= 0) {
    const paragraph: string[] = []
    for (let i = firstParaIdx; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) break
      paragraph.push(line)
    }
    summary = paragraph.join(' ').slice(0, 220)
  }
  const lowered = raw.toLowerCase()
  const status: 'published' | 'draft' = DRAFT_KEYWORDS.some((k) => lowered.includes(k))
    ? 'draft'
    : 'published'
  return {
    slug,
    number: slug.slice(0, 2),
    title,
    summary,
    status,
  }
}

export const listStandardsChapters = cache(async (): Promise<StandardsChapter[]> => {
  const dirs = await readChapterDir()
  const chapters: StandardsChapter[] = []
  for (const slug of dirs) {
    try {
      const md = await fs.readFile(path.join(CHAPTER_ROOT, slug, 'README.md'), 'utf8')
      chapters.push(parseChapter(slug, md))
    } catch {
      // chapter without README — skip silently
    }
  }
  return chapters
})

export const getStandardsChapter = cache(
  async (slug: string): Promise<StandardsChapterDetail | null> => {
    // Reject path traversal: only allow exact "NN-kebab" form
    if (!/^\d{2}-[a-z0-9-]+$/i.test(slug)) return null
    try {
      const md = await fs.readFile(path.join(CHAPTER_ROOT, slug, 'README.md'), 'utf8')
      const summary = parseChapter(slug, md)
      return { ...summary, markdown: md }
    } catch {
      return null
    }
  },
)

export async function renderChapterHtml(markdown: string): Promise<string> {
  const { remark } = await import('remark')
  const remarkHtml = (await import('remark-html')).default
  const file = await remark().use(remarkHtml, { sanitize: false }).process(markdown)
  return String(file)
}
