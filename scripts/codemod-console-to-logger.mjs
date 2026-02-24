/**
 * Codemod: Replace console.* with structured logger from @nzila/os-core.
 *
 * Strategy:
 * 1. For each file with console.* usage:
 *    - Add `import { createLogger } from '@nzila/os-core'` if not present
 *    - Add `const logger = createLogger('namespace')` if not present
 *    - Replace console.error(msg, data) → logger.error(msg, { error: data })
 *    - Replace console.warn(msg, data)  → logger.warn(msg, { detail: data })
 *    - Replace console.log(msg, data)   → logger.info(msg, { detail: data })
 *    - Replace console.info(msg, data)  → logger.info(msg, { detail: data })
 *    - Replace console.debug(msg, data) → logger.debug(msg, { detail: data })
 *
 * 2. CLI scripts (seeds, evidence scripts) are skipped — console is appropriate there.
 * 3. The web contact form (TSX client component) uses a no-op replacement.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { basename, dirname } from 'node:path'

// ── Files to skip (CLI scripts — console is appropriate) ──────────────────
const CLI_SCRIPTS = new Set([
  'apps/abr/scripts/evidence/collect.ts',
  'apps/abr/scripts/evidence/seal.ts',
  'apps/abr/scripts/evidence/verify.ts',
  'apps/union-eyes/db/seeds/seed-org-hierarchy.ts',
  'apps/union-eyes/db/seeds/seed-child-orgs.ts',
])

// ── Derive logger namespace from file path ────────────────────────────────
function deriveNamespace(filePath) {
  // apps/console/app/api/stripe/webhooks/route.ts → 'stripe:webhooks'
  // apps/union-eyes/lib/api-server.ts → 'api-server'
  // apps/orchestrator-api/src/dispatch.ts → 'dispatch'
  const parts = filePath.replace(/\\/g, '/').split('/')

  // For API routes: extract the meaningful path segments
  const apiIdx = parts.indexOf('api')
  if (apiIdx !== -1) {
    const routeParts = parts.slice(apiIdx + 1).filter(p => p !== 'route.ts' && p !== 'route.tsx')
    if (routeParts.length > 0) return routeParts.join(':')
  }

  // For lib files: use the filename
  const fileName = basename(filePath, '.ts').replace('.tsx', '')
  if (fileName === 'route') {
    // Fallback for routes
    const dir = basename(dirname(filePath))
    return dir
  }
  return fileName
}

// ── Check if file already imports createLogger ────────────────────────────
function hasLoggerImport(content) {
  return /import\s+.*createLogger.*from\s+['"]@nzila\/os-core['"]/.test(content) ||
         /import\s+.*logger.*from\s+['"]@nzila\/os-core['"]/.test(content)
}

// ── Check if file already has a logger declaration ────────────────────────
function hasLoggerDecl(content) {
  return /const\s+logger\s*=\s*createLogger/.test(content)
}

// ── Transform a file ──────────────────────────────────────────────────────
function transformFile(filePath) {
  let content = readFileSync(filePath, 'utf-8')
  const original = content

  // Skip client components (TSX with 'use client')
  if (content.includes("'use client'") || content.includes('"use client"')) {
    // For client components, just remove console.log calls
    content = content.replace(/\s*console\.log\([^)]*\);?\s*\n?/g, '\n')
    if (content !== original) {
      writeFileSync(filePath, content)
      console.log(`  [client] ${filePath} — removed console.log`)
      return true
    }
    return false
  }

  const namespace = deriveNamespace(filePath)
  let changed = false

  // 1. Add import if needed
  if (!hasLoggerImport(content)) {
    // Find the last import line
    const lines = content.split('\n')
    let lastImportIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i]) || /^} from\s/.test(lines[i])) {
        lastImportIdx = i
      }
      // Stop looking after we pass imports
      if (lastImportIdx !== -1 && !/^import\s/.test(lines[i]) && !/^} from\s/.test(lines[i]) && lines[i].trim() !== '' && !/^\s*\/\//.test(lines[i]) && !/^\s*\*/.test(lines[i]) && !/^\s*\/\*/.test(lines[i])) {
        if (i > lastImportIdx + 2) break
      }
    }

    const importLine = `import { createLogger } from '@nzila/os-core'`
    if (lastImportIdx === -1) {
      // No imports — add at top (after any comments/directives)
      let insertIdx = 0
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('/**') || lines[i].startsWith(' *') || lines[i].startsWith('//') || lines[i].trim() === '') {
          insertIdx = i + 1
        } else {
          break
        }
      }
      lines.splice(insertIdx, 0, importLine)
    } else {
      lines.splice(lastImportIdx + 1, 0, importLine)
    }
    content = lines.join('\n')
    changed = true
  }

  // 2. Add logger declaration if needed
  if (!hasLoggerDecl(content)) {
    const lines = content.split('\n')
    // Find insertion point: after all imports, before first real code
    let insertIdx = 0
    let pastImports = false
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i]) || /^} from\s/.test(lines[i])) {
        insertIdx = i + 1
        pastImports = true
      }
      if (pastImports && lines[i].trim() === '') {
        insertIdx = i + 1
        break
      }
    }
    lines.splice(insertIdx, 0, `const logger = createLogger('${namespace}')`, '')
    content = lines.join('\n')
    changed = true
  }

  // 3. Replace console.error(msg, err) → logger.error(msg, err)
  // For Error objects, the logger handles them natively
  content = content.replace(
    /console\.error\(([^,)]+),\s*([^)]+)\)/g,
    (match, msg, data) => {
      const d = data.trim()
      // If the second arg looks like an error variable, pass it directly
      if (/^(err|error|e|errorMessage|message)\b/.test(d)) {
        return `logger.error(${msg}, ${d} instanceof Error ? ${d} : { detail: ${d} })`
      }
      return `logger.error(${msg}, { detail: ${d} })`
    }
  )

  // console.error(msg) → logger.error(msg)
  content = content.replace(
    /console\.error\(([^)]+)\)/g,
    (match, args) => {
      // Skip if already replaced (has logger.)
      if (match.includes('logger.')) return match
      return `logger.error(${args})`
    }
  )

  // console.warn(msg, data) → logger.warn(msg, { detail: data })
  content = content.replace(
    /console\.warn\(([^,)]+),\s*([^)]+)\)/g,
    (match, msg, data) => {
      const d = data.trim()
      if (/^(err|error|e)\b/.test(d)) {
        return `logger.warn(${msg}, ${d} instanceof Error ? ${d} : { detail: ${d} })`
      }
      return `logger.warn(${msg}, { detail: ${d} })`
    }
  )

  // console.warn(msg) → logger.warn(msg)
  content = content.replace(
    /console\.warn\(([^)]+)\)/g,
    (match, args) => {
      if (match.includes('logger.')) return match
      return `logger.warn(${args})`
    }
  )

  // console.log(msg, data) → logger.info(msg, { detail: data })
  content = content.replace(
    /console\.log\(([^,)]+),\s*([^)]+)\)/g,
    (match, msg, data) => {
      return `logger.info(${msg}, { detail: ${data.trim()} })`
    }
  )

  // console.log(msg) → logger.info(msg)
  content = content.replace(
    /console\.log\(([^)]+)\)/g,
    (match, args) => {
      if (match.includes('logger.')) return match
      return `logger.info(${args})`
    }
  )

  if (content !== original) {
    writeFileSync(filePath, content)
    console.log(`  [fixed] ${filePath} (namespace: ${namespace})`)
    return true
  }
  return false
}

// ── Main ──────────────────────────────────────────────────────────────────
const files = execSync(
  'git grep -l "console\\.\\(log\\|error\\|warn\\|info\\|debug\\)" -- "apps/**/*.ts" "apps/**/*.tsx" ":!*.test.ts" ":!*.spec.ts" ":!*.test.tsx" ":!**/node_modules/**" ":!**/financial-service/**" ":!**/.venv/**"',
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean)

const runtimeFiles = files.filter(f => !CLI_SCRIPTS.has(f.replace(/\\/g, '/')))

console.log(`\nFound ${files.length} files with console.* usage`)
console.log(`  CLI scripts (skipped): ${files.length - runtimeFiles.length}`)
console.log(`  Runtime files to fix: ${runtimeFiles.length}\n`)

let fixed = 0
for (const file of runtimeFiles) {
  try {
    if (transformFile(file)) fixed++
  } catch (err) {
    console.error(`  [ERROR] ${file}: ${err.message}`)
  }
}

console.log(`\nDone. Fixed ${fixed}/${runtimeFiles.length} files.`)
