#!/usr/bin/env npx tsx

import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'

import { findRepoRoot } from '../lib/portfolio-governance'

interface DocEntry {
  path: string
  category: string
  lastValidated: string
  stale: boolean
}

function walkMarkdown(root: string, currentDir: string, entries: DocEntry[]): void {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue
    // nosemgrep
    const absolutePath = safeJoin(currentDir, entry.name)
    if (entry.isDirectory()) {
      walkMarkdown(root, absolutePath, entries)
      continue
    }
    if (extname(entry.name).toLowerCase() !== '.md') continue
    const relPath = relative(root, absolutePath).replace(/\\/g, '/')
    const stats = statSync(absolutePath)
    const ageDays = Math.floor((Date.now() - stats.mtimeMs) / 86_400_000)
    const normalized = relPath.startsWith('docs/') ? relPath.slice('docs/'.length) : relPath
    entries.push({
      path: relPath,
      category: relPath.startsWith('docs/') ? normalized.split('/')[0] : 'root',
      lastValidated: stats.mtime.toISOString().slice(0, 10),
      stale: ageDays > 90,
    })
  }
}

function writeText(root: string, relativePath: string, content: string): void {
  const absolutePath = safeJoin(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function safeJoin(root: string, relativePath: string): string {
  // nosemgrep
  const absolutePath = resolve(root, relativePath)
  // nosemgrep
  const normalizedRoot = `${resolve(root)}\\`
  // nosemgrep
  if (!absolutePath.startsWith(normalizedRoot) && absolutePath !== resolve(root)) {
    throw new Error(`Unsafe path outside allowed root: ${relativePath}`)
  }
  return absolutePath
}

function main(): void {
  const root = findRepoRoot()
  const entries: DocEntry[] = []

  walkMarkdown(root, join(root, 'docs'), entries)
  for (const fileName of ['README.md', 'ARCHITECTURE.md', 'SECURITY.md', 'CHANGELOG.md']) {
    const absolutePath = join(root, fileName)
    const stats = statSync(absolutePath)
    const ageDays = Math.floor((Date.now() - stats.mtimeMs) / 86_400_000)
    entries.push({
      path: fileName,
      category: 'root',
      lastValidated: stats.mtime.toISOString().slice(0, 10),
      stale: ageDays > 90,
    })
  }

  entries.sort((left, right) => left.path.localeCompare(right.path))
  const categories = [...new Set(entries.map((entry) => entry.category))].sort().map((category) => ({
    category,
    count: entries.filter((entry) => entry.category === category).length,
    staleCount: entries.filter((entry) => entry.category === category && entry.stale).length,
  }))

  const report = {
    generatedAt: new Date().toISOString(),
    totalDocuments: entries.length,
    staleDocuments: entries.filter((entry) => entry.stale).length,
    categories,
    entries,
  }

  writeText(root, 'reports/documentation-index.json', `${JSON.stringify(report, null, 2)}\n`)

  const markdown = [
    '# Documentation Index',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Total documents indexed: ${report.totalDocuments}`,
    `Stale documents (>90 days since repo validation): ${report.staleDocuments}`,
    '',
    '## Category Summary',
    '',
    '| Category | Count | Stale |',
    '| --- | ---: | ---: |',
    ...categories.map((category) => `| ${category.category} | ${category.count} | ${category.staleCount} |`),
    '',
    '## Documents',
    '',
    '| Path | Category | Last Validated | Status |',
    '| --- | --- | --- | --- |',
    ...entries.map((entry) => `| [${entry.path}](${entry.path}) | ${entry.category} | ${entry.lastValidated} | ${entry.stale ? 'stale' : 'current'} |`),
    '',
  ].join('\n') + '\n'

  writeText(root, 'docs/documentation-index.md', markdown)
  console.log(markdown)
}

main()