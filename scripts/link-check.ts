#!/usr/bin/env tsx

/**
 * link-check.ts — Validate internal links across Markdown docs
 *
 * Usage:
 *   pnpm link-check              # check all docs
 *   pnpm link-check docs/        # check specific directory
 *
 * Checks:
 *   - Relative markdown links ([text](relative/path.md))
 *   - Anchor links ([text](#heading))
 *   - Image references (![alt](path/to/image.png))
 *
 * Returns non-zero exit code if broken links found.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname ?? __dirname, '..');

function isWithin(base: string, candidate: string): boolean {
  // nosemgrep
  const rel = relative(resolve(base), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !rel.includes('..\\') && !rel.includes('../'));
}

function safeResolve(base: string, ...parts: string[]): string | null {
  // nosemgrep
  const fullPath = resolve(base, ...parts);
  return isWithin(ROOT, fullPath) ? fullPath : null;
}

const requestedDirs = process.argv.slice(2);
const DIRS = requestedDirs.length > 0
  ? requestedDirs
      .map(d => safeResolve(ROOT, d) ?? safeResolve(ROOT, `./${d}`))
      .filter((d): d is string => Boolean(d))
  : [join(ROOT, 'docs'), join(ROOT, 'content'), ROOT]; // root for README.md etc.

// ── .linkcheckignore ────────────────────────────────────
function loadIgnorePatterns(): string[] {
  const ignorePath = join(ROOT, '.linkcheckignore');
  if (!existsSync(ignorePath)) return [];
  return readFileSync(ignorePath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

const IGNORE_PATTERNS = loadIgnorePatterns();

function isIgnored(filePath: string): boolean {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  return IGNORE_PATTERNS.some(p => rel.startsWith(p) || rel === p);
}

interface BrokenLink {
  file: string;
  line: number;
  link: string;
  reason: string;
}

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = safeResolve(dir, entry.name);
    if (!full) continue;
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'coverage', '.git', '.vale', '.venv', '__pycache__'].includes(entry.name)) continue;
      if (isIgnored(full)) continue;
      files.push(...findMarkdownFiles(full));
    } else if (extname(entry.name) === '.md') {
      if (!isIgnored(full)) files.push(full);
    }
  }
  return files;
}

function extractHeadings(content: string): Set<string> {
  const headings = new Set<string>();
  for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug = match[1]!
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    headings.add(slug);
  }
  return headings;
}

function checkFile(filePath: string): BrokenLink[] {
  // nosemgrep
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headings = extractHeadings(content);
  const broken: BrokenLink[] = [];

  // Match markdown links: [text](url) — skip http/https/mailto
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let match: RegExpExecArray | null;
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(line)) !== null) {
      const rawLink = match[2]!.trim();

      // Skip external links
      if (/^https?:\/\/|^mailto:|^#\s*$/.test(rawLink)) continue;

      // Skip absolute SPA route links (Next.js routes like /command-center,
      // /portfolio) — these are application URLs, not files.
      if (rawLink.startsWith('/')) continue;

      // Skip references to runtime/generated artifact directories that are
      // gitignored and only exist on a developer machine or after a build.
      if (
        rawLink.includes('proof-artifacts/') ||
        rawLink.includes('demo-output/') ||
        rawLink.includes('coverage/') ||
        rawLink.includes('coverage_html/')
      ) {
        continue
      }

      // Anchor-only link
      if (rawLink.startsWith('#')) {
        const anchor = rawLink.slice(1);
        if (!headings.has(anchor)) {
          broken.push({ file: filePath, line: i + 1, link: rawLink, reason: 'anchor not found' });
        }
        continue;
      }

      // Split path and anchor
      const [pathPart, anchorPart] = rawLink.split('#');
      if (!pathPart) continue;

      const target = safeResolve(dirname(filePath), pathPart);

      if (!target) {
        broken.push({ file: filePath, line: i + 1, link: rawLink, reason: 'path escapes workspace root' });
        continue;
      }

      if (!existsSync(target)) {
        broken.push({ file: filePath, line: i + 1, link: rawLink, reason: 'file not found' });
        continue;
      }

      // Check anchor in target file if provided
      if (anchorPart && extname(target) === '.md') {
        // nosemgrep
        const targetContent = readFileSync(target, 'utf-8');
        const targetHeadings = extractHeadings(targetContent);
        if (!targetHeadings.has(anchorPart)) {
          broken.push({ file: filePath, line: i + 1, link: rawLink, reason: `anchor #${anchorPart} not found in target` });
        }
      }
    }
  }

  return broken;
}

// ── Main ────────────────────────────────────────────────

const allFiles: string[] = [];
for (const dir of DIRS) {
  if (existsSync(dir) && statSync(dir).isDirectory()) {
    allFiles.push(...findMarkdownFiles(dir));
  } else if (extname(dir) === '.md') {
    const safeFile = safeResolve(ROOT, dir) ?? safeResolve(ROOT, `./${dir}`);
    if (safeFile && !isIgnored(safeFile)) allFiles.push(safeFile);
  }
}

// Deduplicate
const uniqueFiles = [...new Set(allFiles)];
console.log(`\n  Checking ${uniqueFiles.length} markdown files...\n`);

const allBroken: BrokenLink[] = [];
for (const file of uniqueFiles) {
  allBroken.push(...checkFile(file));
}

if (allBroken.length === 0) {
  console.log('  ✓ All links valid.\n');
  process.exit(0);
} else {
  console.log(`  ✗ Found ${allBroken.length} broken link(s):\n`);
  for (const b of allBroken) {
    const rel = b.file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    console.log(`    ${rel}:${b.line} → ${b.link}`);
    console.log(`      ${b.reason}\n`);
  }
  process.exit(1);
}
