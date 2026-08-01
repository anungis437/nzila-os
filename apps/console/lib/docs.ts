import fs from 'fs'
import path from 'path'
import { remark } from 'remark'
import html from 'remark-html'

export interface DocMeta {
  slug: string
  title: string
  description?: string
  date?: string
  category?: string
  order?: number
  [key: string]: unknown
}

export interface Doc extends DocMeta {
  content: string
  htmlContent: string
}

function parseFrontMatter(raw: string): { data: Record<string, unknown>; content: string } {
  if (!raw.startsWith('---\n')) return { data: {}, content: raw }

  const end = raw.indexOf('\n---\n', 4)
  if (end === -1) return { data: {}, content: raw }

  const frontMatter = raw.slice(4, end)
  const content = raw.slice(end + 5)
  const data: Record<string, unknown> = {}

  for (const line of frontMatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!match) continue

    const key = match[1]
    let value: unknown = match[2].trim()

    if (
      (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) ||
      (typeof value === 'string' && value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else if (/^-?\d+(\.\d+)?$/.test(String(value))) {
      value = Number(value)
    } else if (value === 'true' || value === 'false') {
      value = value === 'true'
    }

    data[key] = value
  }

  return { data, content }
}

function resolveContentDir(): string {
  return path.join(process.cwd(), '..', '..', 'content', 'internal')
}

function walkDir(dir: string, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...walkDir(path.join(dir, entry.name), rel))
    } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(rel)
    }
  }
  return files
}

export function getAllInternalDocs(): DocMeta[] {
  const contentDir = resolveContentDir()
  const files = walkDir(contentDir)
  return files.map((file) => {
    const fullPath = path.join(contentDir, file)
    const raw = fs.readFileSync(fullPath, 'utf-8')
    const { data } = parseFrontMatter(raw)
    const slug = file.replace(/\.md$/, '')
    return {
      slug,
      title: (data.title as string) || slugToTitle(slug),
      description: data.description as string | undefined,
      date: data.date as string | undefined,
      category: data.category as string | undefined,
      order: data.order as number | undefined,
      ...data,
    }
  })
}

export async function getInternalDocBySlug(slug: string): Promise<Doc | null> {
  const contentDir = resolveContentDir()
  const filePath = path.join(contentDir, `${slug}.md`)
  // Prevent path traversal — resolved path must stay within contentDir
  const resolvedContent = path.resolve(contentDir)
  const resolvedFile = path.resolve(filePath)
  if (!resolvedFile.startsWith(resolvedContent + path.sep)) return null
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = parseFrontMatter(raw)
  const result = await remark().use(html).process(content)
  return {
    slug,
    title: (data.title as string) || slugToTitle(slug),
    description: data.description as string | undefined,
    date: data.date as string | undefined,
    category: data.category as string | undefined,
    order: data.order as number | undefined,
    content,
    htmlContent: result.toString(),
    ...data,
  }
}

export function getAllInternalDocSlugs(): string[][] {
  const docs = getAllInternalDocs()
  return docs.map((doc) => doc.slug.split('/'))
}

function slugToTitle(slug: string): string {
  const last = slug.split('/').pop() || slug
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
