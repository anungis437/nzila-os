#!/usr/bin/env tsx
/**
 * Flow — Lockdown Check
 *
 * CI guard that statically detects patterns that violate the Flow system
 * integrity rules. Fails with exit code 1 if any violations are found.
 *
 * Rules enforced:
 * 1. No direct lifecycle status mutations outside the command bus
 * 2. No direct integration adapter imports outside the side-effect dispatcher
 * 3. No server action that bypasses executeCommand for critical mutations
 * 4. All critical handlers must be covered in the handler registry
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname ?? __dirname, '..')

// ── File collection ────────────────────────────────────────────────────────

function collectTsFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (['node_modules', '.next', 'dist', '.turbo'].includes(entry)) continue
      collectTsFiles(full, files)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(full)
    }
  }
  return files
}

// ── Violation types ────────────────────────────────────────────────────────

interface Violation {
  rule: string
  file: string
  line: number
  content: string
}

const violations: Violation[] = []

function addViolation(rule: string, file: string, line: number, content: string) {
  violations.push({ rule, file: relative(ROOT, file), line, content: content.trim() })
}

// ── Rule 1: Direct status mutations outside command bus ────────────────────
//
// Patterns that indicate a raw status column write bypassing the control layer:
//   - db.update(commerceOrders).set({ status: ... })  [outside command handlers]
//   - orderRepo.update({ status: ... })                [outside command handlers]
//
// EXEMPT: lib/control/handlers/**  (these ARE the authorised mutation sites)
//         lib/repositories/**      (these are the persistence layer called BY handlers)

const STATUS_MUTATION_PATTERNS = [
  /\.set\(\{[^}]*\bstatus\s*:/,
  /orderRepo\.update\([^)]*status/,
  /quoteRepo\.update\([^)]*status/,
]

const STATUS_MUTATION_BLOCK_PATTERNS = [
  /orderRepo\.update\(\s*[^,]+,\s*[^,]+,\s*\{[\s\S]{0,140}?\bstatus\s*:/g,
  /quoteRepo\.update\(\s*[^,]+,\s*\{[\s\S]{0,140}?\bstatus\s*:/g,
  /purchaseOrderRepo\.update\(\s*[^,]+,\s*[^,]+,\s*\{[\s\S]{0,140}?\bstatus\s*:/g,
  /invoiceRepo\.update\(\s*[^,]+,\s*[^,]+,\s*\{[\s\S]{0,140}?\bstatus\s*:/g,
  /paymentRepo\.update\(\s*[^,]+,\s*[^,]+,\s*\{[\s\S]{0,140}?\bstatus\s*:/g,
]

const STATUS_MUTATION_EXEMPT_PATHS = [
  'lib/control/handlers/',
  'lib/repositories/',
  'lib/migrations/',
  'lib/seed',
  'scripts/',
  'tests/',
  'e2e/',
]

// Transitional exemptions for legacy orchestration services pending full command-handler migration.
const STATUS_MUTATION_EXEMPT_FILES = new Set([
  'lib/services/production-gating-service.ts',
  'lib/services/quote-approval-service.ts',
  'lib/services/quote-to-po-service.ts',
  'lib/services/share-link-service.ts',
  'lib/production-service.ts',
])

// ── Rule 2: Direct integration adapter imports outside dispatcher ──────────
//
// Integration clients (Zoho, Shopify, Canva) must only be instantiated/called
// from within side-effect-dispatcher.ts or their own adapter files.
//
// EXEMPT: lib/control/dispatch/side-effect-dispatcher.ts
//         lib/zoho/**, lib/shopify/**, lib/canva/**   (adapter implementations)

const DIRECT_INTEGRATION_PATTERNS = [
  /from ['"]\.\.\/zoho\/books-client['"]/,
  /from ['"]@\/lib\/zoho\/books-client['"]/,
  /from ['"]\.\.\/shopify['"]/,
  /from ['"]@\/lib\/shopify['"]/,
  /new ZohoBooksClient\(/,
  /new ShopifyClient\(/,
]

const DIRECT_INTEGRATION_EXEMPT_PATHS = [
  'lib/control/dispatch/',
  'lib/integrations/',
  'lib/zoho/',
  'lib/shopify/',
  'lib/canva/',
  'lib/supplier',
  'tests/',
  'e2e/',
  'scripts/',
]

// ── Rule 3: Server actions calling createPurchaseOrder directly ────────────

const DIRECT_COMMERCE_DB_CREATE_PATTERNS = [
  /createPurchaseOrder\s*\(/,
  /createOrder\s*\(/,
  /createQuote\s*\(/,
]

const DIRECT_COMMERCE_DB_EXEMPT_PATHS = [
  'lib/control/handlers/',
  'lib/repositories/',
  'lib/seed',
  'tests/',
  'e2e/',
  'scripts/',
  'node_modules/',
]

const DIRECT_COMMERCE_DB_EXEMPT_FILES = new Set([
  'app/actions/orders.ts',
])

// ── Rule 4: Critical handlers must emit at least one domain event ─────────

const CRITICAL_COMMAND_TYPES = new Set([
  'send_quote',
  'accept_quote',
  'convert_quote_to_order',
  'confirm_order',
  'require_deposit',
  'record_payment',
  'confirm_payment',
  'create_purchase_order',
  'send_purchase_order',
  'confirm_purchase_order',
  'start_production',
  'complete_production',
  'create_shipment',
  'mark_shipment_shipped',
  'mark_shipment_delivered',
])

function indexToLine(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

function addBlockPatternViolations(rule: string, file: string, content: string, patterns: RegExp[]): void {
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const line = indexToLine(content, match.index)
      addViolation(rule, file, line, match[0].slice(0, 160).replace(/\s+/g, ' '))
    }
    pattern.lastIndex = 0
  }
}

// ── Scan ──────────────────────────────────────────────────────────────────

const allFiles = collectTsFiles(ROOT)

for (const file of allFiles) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Rule 1: direct status mutations
    if (!STATUS_MUTATION_EXEMPT_PATHS.some(p => rel.includes(p)) && !STATUS_MUTATION_EXEMPT_FILES.has(rel)) {
      for (const pattern of STATUS_MUTATION_PATTERNS) {
        if (pattern.test(line)) {
          addViolation('DIRECT_STATUS_MUTATION', file, i + 1, line)
        }
      }
    }

    // Rule 2: direct integration adapter imports
    if (!DIRECT_INTEGRATION_EXEMPT_PATHS.some(p => rel.includes(p))) {
      for (const pattern of DIRECT_INTEGRATION_PATTERNS) {
        if (pattern.test(line)) {
          addViolation('DIRECT_INTEGRATION_IMPORT', file, i + 1, line)
        }
      }
    }

    // Rule 3: direct commerce-db create calls in app/actions
    if (
      rel.startsWith('app/actions/') &&
      !DIRECT_COMMERCE_DB_EXEMPT_PATHS.some(p => rel.includes(p)) &&
      !DIRECT_COMMERCE_DB_EXEMPT_FILES.has(rel)
    ) {
      for (const pattern of DIRECT_COMMERCE_DB_CREATE_PATTERNS) {
        if (pattern.test(line)) {
          addViolation('DIRECT_COMMERCE_DB_CREATE', file, i + 1, line)
        }
      }
    }
  }

  // Rule 1b: multiline direct status mutations (repo.update with status object)
  if (!STATUS_MUTATION_EXEMPT_PATHS.some(p => rel.includes(p)) && !STATUS_MUTATION_EXEMPT_FILES.has(rel)) {
    addBlockPatternViolations('DIRECT_STATUS_MUTATION', file, content, STATUS_MUTATION_BLOCK_PATTERNS)
  }

  // Rule 4: critical handlers must emit at least one domain event
  if (rel.startsWith('lib/control/handlers/') && rel.endsWith('.handler.ts')) {
    const commandTypeMatch = content.match(/commandType:\s*'([^']+)'/)
    const commandType = commandTypeMatch?.[1]
    if (commandType && CRITICAL_COMMAND_TYPES.has(commandType) && !content.includes('dispatchDomainEvent(')) {
      const line = commandTypeMatch?.index != null ? indexToLine(content, commandTypeMatch.index) : 1
      addViolation(
        'CRITICAL_HANDLER_NO_DOMAIN_EVENT',
        file,
        line,
        `commandType '${commandType}' is critical but handler has no dispatchDomainEvent() call`,
      )
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────

if (violations.length === 0) {
  console.log('✅  Flow Lockdown Check: 0 violations — system integrity confirmed')
  process.exit(0)
} else {
  console.error(`\n❌  Flow Lockdown Check: ${violations.length} violation(s) found\n`)

  const byRule = new Map<string, Violation[]>()
  for (const v of violations) {
    const list = byRule.get(v.rule) ?? []
    list.push(v)
    byRule.set(v.rule, list)
  }

  for (const [rule, vs] of byRule) {
    console.error(`\n  Rule: ${rule} (${vs.length} violation${vs.length > 1 ? 's' : ''})`)
    for (const v of vs) {
      console.error(`    ${v.file}:${v.line}`)
      console.error(`      ${v.content}`)
    }
  }

  console.error('\n  Fix violations before merging to main.\n')
  process.exit(1)
}
