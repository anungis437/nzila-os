/**
 * AI Contract Check — detects app-local AI fragmentation.
 *
 * Scans target apps for suspicious AI implementations that bypass
 * the platform-ai-* package architecture.
 *
 * Usage: pnpm ai:contract:check
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const TARGET_APPS = ['union-eyes', 'flow', 'zonga', 'cfo', 'partners', 'web']

// Suspicious file names for app-local AI
const SUSPICIOUS_FILES = [
  'ai-helper.ts',
  'ai-helpers.ts',
  'ai-utils.ts',
  'ai-service.ts',
  'llm-helper.ts',
  'llm-service.ts',
  'prompt-builder.ts',
  'model-client.ts',
  'openai-client.ts',
  'anthropic-client.ts',
]

// Suspicious import patterns — direct AI provider calls from apps
const SUSPICIOUS_IMPORTS = [
  /from\s+['"]openai['"]/,
  /from\s+['"]@anthropic-ai\/sdk['"]/,
  /from\s+['"]@google-ai\/generativelanguage['"]/,
  /from\s+['"]cohere-ai['"]/,
  /require\(\s*['"]openai['"]\s*\)/,
]

// Suspicious inline patterns
const SUSPICIOUS_PATTERNS = [
  /new\s+OpenAI\s*\(/,
  /openai\.chat\.completions\.create/,
  /openai\.completions\.create/,
  /anthropic\.messages\.create/,
  /\.generate\(\s*\{[\s\S]*?model:/,
]

// Directories to scan within each app
const SCAN_DIRS = ['lib', 'server', 'app', 'components']

// Allowed files — thin adapters, presentation helpers, pre-existing tracked files
const ALLOWED_PATTERNS = [
  /lib\/ai-adapter\.ts$/,
  /lib\/ai-display\.ts$/,
  /lib\/ai-format\.ts$/,
  /components\/ai-/,
  /components\/.*insight/i,
  /components\/.*recommendation/i,
  // Pre-existing: tracked for migration, see AI_PLATFORM_CONTRACT.md
  /union-eyes\/lib\/ai\/chatbot-service\.ts$/,
]

interface Violation {
  app: string
  file: string
  issue: string
}

function scanDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.turbo') continue
      results.push(...scanDir(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.spec.ts')) {
      results.push(full)
    }
  }
  return results
}

function isAllowed(filePath: string): boolean {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
  return ALLOWED_PATTERNS.some((p) => p.test(rel))
}

const violations: Violation[] = []

for (const app of TARGET_APPS) {
  const appDir = path.join(ROOT, 'apps', app)
  if (!fs.existsSync(appDir)) continue

  for (const subDir of SCAN_DIRS) {
    const dir = path.join(appDir, subDir)
    const files = scanDir(dir)

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      const basename = path.basename(file)

      // Check suspicious file names
      if (SUSPICIOUS_FILES.includes(basename) && !isAllowed(file)) {
        violations.push({ app, file: rel, issue: `Suspicious AI file: ${basename}` })
      }

      // Check file contents
      const content = fs.readFileSync(file, 'utf-8')

      for (const pattern of SUSPICIOUS_IMPORTS) {
        if (pattern.test(content) && !isAllowed(file)) {
          violations.push({ app, file: rel, issue: `Direct AI provider import detected` })
          break
        }
      }

      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(content) && !isAllowed(file)) {
          violations.push({ app, file: rel, issue: `Inline AI provider call detected` })
          break
        }
      }
    }
  }
}

// ── Report ──────────────────────────────────────────

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  AI Contract Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Apps scanned: ${TARGET_APPS.length}\n`)
process.stdout.write(`  Violations:   ${violations.length}\n\n`)

if (violations.length > 0) {
  for (const v of violations) {
    process.stderr.write(`  ✗ [${v.app}] ${v.file}\n    ${v.issue}\n\n`)
  }
  process.stderr.write('  Apps must use @nzila/platform-ai-* packages for AI capabilities.\n')
  process.stderr.write('  See docs/AI_PLATFORM_CONTRACT.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ No app-local AI fragmentation detected\n\n')
}
