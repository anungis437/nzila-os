/**
 * The page-link census (UE-CONV-H-020): every link, redirect and navigation entry in the frontend, judged against the pages that exist.
 *
 * The frontend-to-API census proves that what a screen fetches is served; this proves that where a screen sends the user is a page. A link to a path no page
 * serves is a button that ends in a 404, and nothing but a person clicking it can tell (see lib/frontend-census/page-links.ts for what counts as a link and
 * how a path is judged). Read-only: it reads source files and file names, and needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/page-link-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { extractPageLinks, judgeLink, pageRoutesOf, type PageRoute } from '../lib/frontend-census/page-links'
import { APP_ROOT, sourceFiles } from './frontend-api-census'

export interface PageLinkSite {
  file: string
  line: number
  via: string
}

export interface PageLinkFinding {
  /** The path as written, with unknown parts shown as `{}` and the locale as `{locale}`. */
  target: string
  sites: PageLinkSite[]
}

export interface PageLinkReport {
  pages: number
  files: number
  links: number
  distinctTargets: number
  /** Links made only of unknown parts, which cannot be judged. */
  unanalyzed: number
  findings: PageLinkFinding[]
}

/** The files under app/ that serve a URL, relative to app/. */
export function appFiles(root: string = APP_ROOT): string[] {
  const out: string[] = []
  const base = path.join(root, 'app')
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name !== 'node_modules') walk(full)
      } else out.push(path.relative(base, full).replace(/\\/g, '/'))
    }
  }
  walk(base)
  return out.sort()
}

/** The locales the application serves, read from its i18n configuration. */
export function loadLocales(root: string = APP_ROOT): string[] {
  const text = readFileSync(path.join(root, 'i18n', 'config.ts'), 'utf8')
  const list = /export const locales\s*=\s*\[([^\]]*)\]/.exec(text)?.[1]
  if (!list) throw new Error('i18n/config.ts does not export `locales`')
  return [...list.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
}

export const show = (target: string): string => target.replace(/\u0002/g, '{locale}').replace(/\u0001/g, '{}')

export function runCensus(root: string = APP_ROOT, pages: PageRoute[] = pageRoutesOf(appFiles(root)), locales: string[] = loadLocales(root)): PageLinkReport {
  const files = sourceFiles(root)
  const grouped = new Map<string, PageLinkFinding>()
  const targets = new Set<string>()
  let links = 0
  let unanalyzed = 0
  for (const file of files) {
    for (const link of extractPageLinks(file, readFileSync(path.join(root, file), 'utf8'))) {
      links += 1
      // The page is the path; a query or a fragment is not a different page.
      const target = link.path.split(/[?#]/)[0]
      targets.add(target)
      const verdict = judgeLink(link.path, pages, locales)
      if (verdict === 'UNANALYZED') unanalyzed += 1
      if (verdict !== 'PAGE_MISSING') continue
      const finding = grouped.get(target) ?? { target: show(target), sites: [] }
      finding.sites.push({ file, line: link.line, via: link.via })
      grouped.set(target, finding)
    }
  }
  const findings = [...grouped.values()].sort((a, b) => b.sites.length - a.sites.length || a.target.localeCompare(b.target))
  return { pages: pages.length, files: files.length, links, distinctTargets: targets.size, unanalyzed, findings }
}

export function toMarkdown(report: PageLinkReport): string {
  const lines = [
    '# Page-link census (UE-CONV-H-020)',
    '',
    `${report.files} frontend files, ${report.links} links (${report.distinctTargets} distinct paths) judged against ${report.pages} pages; ${report.unanalyzed} made only of unknown parts could not be judged.`,
    '',
    `${report.findings.length} paths no page serves.`,
    '',
  ]
  for (const finding of report.findings) {
    lines.push(`- \`${finding.target}\``)
    for (const site of finding.sites.slice(0, 6)) lines.push(`  - ${site.file}:${site.line} (${site.via})`)
    if (finding.sites.length > 6) lines.push(`  - … ${finding.sites.length - 6} more`)
  }
  return `${lines.join('\n')}\n`
}

function main(): void {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const report = runCensus()
  const json = option('write')
  if (json) writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`)
  const markdown = option('markdown')
  if (markdown) writeFileSync(markdown, toMarkdown(report))
  if (!args.includes('--quiet')) {
    console.log(`${report.files} files, ${report.links} links (${report.distinctTargets} distinct), ${report.pages} pages, ${report.unanalyzed} not judged`)
    console.log(`${report.findings.length} paths no page serves`)
    for (const finding of report.findings) console.log(`  ${finding.target}  ${finding.sites[0].file}:${finding.sites[0].line}${finding.sites.length > 1 ? ` (+${finding.sites.length - 1})` : ''}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
