/**
 * AI Contract Check — detects app-local AI fragmentation.
 *
 * Scans target apps for suspicious AI implementations that bypass
 * the platform-ai-* package architecture.
 *
 * Usage: pnpm exec tsx scripts/ai-contract-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const TARGET_APPS = [
  'abr',
  'cfo',
  'console',
  'flow',
  'nacp-exams',
  'partners',
  'union-eyes',
  'zonga',
] as const

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

function scanAppFiles(app: string): string[] {
  try {
    const output = execFileSync('git', ['ls-files', `apps/${app}`], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((file) => SCAN_DIRS.some((dir) => file.startsWith(`apps/${app}/${dir}/`)))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.spec.ts'))
  } catch {
    return []
  }
}

function isAllowed(filePath: string): boolean {
  const rel = filePath.replace(/\\/g, '/')
  return ALLOWED_PATTERNS.some((p) => p.test(rel))
}

const violations: Violation[] = []

for (const app of TARGET_APPS) {
  const files = scanAppFiles(app)

  for (const file of files) {
    const rel = file.replace(/\\/g, '/')
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

violations.sort((left, right) => {
  return `${left.app}:${left.file}:${left.issue}`.localeCompare(`${right.app}:${right.file}:${right.issue}`)
})

// ── Report ──────────────────────────────────────────

process.stdout.write('\nAI Contract Check\n\n')
process.stdout.write(`  Apps scanned: ${TARGET_APPS.length}\n`)
process.stdout.write(`  Violations:   ${violations.length}\n\n`)

if (violations.length > 0) {
  for (const v of violations) {
    process.stderr.write(`  [${v.app}] ${v.file}\n    ${v.issue}\n\n`)
  }
  process.stderr.write('  Apps must use @nzila/platform-ai-* packages for AI capabilities.\n')
  process.stderr.write('  See docs/AI_PLATFORM_CONTRACT.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  No app-local AI fragmentation detected\n\n')
}
