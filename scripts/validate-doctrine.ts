#!/usr/bin/env npx tsx

/**
 * Doctrine consistency regression check.
 *
 * Prevents portfolio doctrine drift on two heritage products:
 *   - NACP Exams is DRC-native national education & examination infrastructure.
 *     Integrity / anti-corruption controls are CAPABILITIES within the
 *     education product, not its market category.
 *   - 3CUO / DiasporaCore is banking / financial-services heritage — NOT a
 *     "Three-Tier Capital Utilisation Optimiser", and NOT replaced by Trade.
 *
 * See:
 *   - governance/portfolio/product-catalog.json (source of truth)
 *   - docs/categories/platform-and-operations/migration/app-alignment/3cuo.md
 *   - apps/nacp-exams/README.md
 *   - apps/trade/README.md
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { findRepoRoot } from './lib/portfolio-governance'

interface DoctrineCheck {
  id: string
  description: string
  run: (root: string) => string | null // returns error message or null
}

const CHECKS: DoctrineCheck[] = [
  {
    id: 'nacp-drc-education-heritage',
    description:
      'NACP strategic_role must frame the product as DRC-native national education infrastructure.',
    run: (root) => {
      const catalog = JSON.parse(
        readFileSync(join(root, 'governance/portfolio/product-catalog.json'), 'utf8'),
      ) as { products: Array<{ id: string; strategic_role?: string }> }
      const nacp = catalog.products.find((p) => p.id === 'nacp-exams')
      if (!nacp) return 'nacp-exams not found in product-catalog.json'
      const role = (nacp.strategic_role ?? '').toLowerCase()
      const mentionsDrc = role.includes('drc') || role.includes('congo')
      const mentionsEducation = role.includes('education')
      if (!mentionsDrc || !mentionsEducation) {
        return `nacp-exams.strategic_role must mention BOTH the DRC/Congolese heritage and "education" (found: "${nacp.strategic_role}")`
      }
      return null
    },
  },
  {
    id: 'nacp-integrity-is-capability',
    description:
      'NACP strategic_role must not describe the product as a generic "anti-corruption exams" product.',
    run: (root) => {
      const catalog = JSON.parse(
        readFileSync(join(root, 'governance/portfolio/product-catalog.json'), 'utf8'),
      ) as { products: Array<{ id: string; strategic_role?: string }> }
      const nacp = catalog.products.find((p) => p.id === 'nacp-exams')
      if (!nacp) return null
      const role = (nacp.strategic_role ?? '').toLowerCase()
      // Reject: framing anti-corruption/integrity as the product's category.
      const badPhrases = [
        'anti-corruption programme',
        'anti-corruption program',
        'anti-corruption exams',
        'certification programme for anti-corruption',
      ]
      const hit = badPhrases.find((p) => role.includes(p))
      if (hit) {
        return `nacp-exams.strategic_role reintroduces category drift ("${hit}"). Integrity is a capability within the education product, not its category.`
      }
      return null
    },
  },
  {
    id: 'trade-not-3cuo-replacement',
    description:
      'Trade strategic_role must not claim to replace 3CUO/DiasporaCore banking heritage.',
    run: (root) => {
      const catalog = JSON.parse(
        readFileSync(join(root, 'governance/portfolio/product-catalog.json'), 'utf8'),
      ) as { products: Array<{ id: string; strategic_role?: string }> }
      const trade = catalog.products.find((p) => p.id === 'trade')
      if (!trade) return 'trade not found in product-catalog.json'
      const role = (trade.strategic_role ?? '').toLowerCase()
      const bad = ['replaces 3cuo', 'replacement for 3cuo', 'supersedes 3cuo', 'replaces diasporacore']
      const hit = bad.find((p) => role.includes(p))
      if (hit) {
        return `trade.strategic_role improperly frames Trade as replacing 3CUO/DiasporaCore ("${hit}"). Trade sits alongside the banking heritage.`
      }
      return null
    },
  },
  {
    id: 'no-capital-utilisation-optimiser-identity',
    description:
      'No governed doc surface may reintroduce the "Three-Tier Capital Utilisation Optimiser" as a live product identity.',
    run: (root) => {
      const surfaces = [
        'governance/portfolio/product-catalog.json',
        'README.md',
        'README.business.md',
        'apps/trade/README.md',
        'apps/nacp-exams/README.md',
      ]
      const forbidden = /three[- ]tier capital utilisation optimiser/i
      for (const rel of surfaces) {
        const path = join(root, rel)
        let text: string
        try {
          text = readFileSync(path, 'utf8')
        } catch {
          continue
        }
        if (forbidden.test(text)) {
          return `Forbidden identity phrase "Three-Tier Capital Utilisation Optimiser" found in ${rel}. Only permitted inside the drift-notice section of docs/categories/platform-and-operations/migration/app-alignment/3cuo.md.`
        }
      }
      return null
    },
  },
  {
    id: '3cuo-alignment-doc-preserves-heritage',
    description:
      '3cuo.md alignment doc must contain the DOCTRINE CORRECTION notice and reference the banking heritage.',
    run: (root) => {
      const path = join(
        root,
        'docs/categories/platform-and-operations/migration/app-alignment/3cuo.md',
      )
      let text: string
      try {
        text = readFileSync(path, 'utf8')
      } catch {
        return `Missing alignment doc: ${path}`
      }
      if (!/DOCTRINE CORRECTION/i.test(text)) {
        return '3cuo.md must contain a "DOCTRINE CORRECTION" notice.'
      }
      if (!/banking|financial[- ]services|diasporacore/i.test(text)) {
        return '3cuo.md must reference the 3CUO/DiasporaCore banking / financial-services heritage.'
      }
      return null
    },
  },
]

function main(): void {
  const root = findRepoRoot()
  const failures: string[] = []
  for (const check of CHECKS) {
    const err = check.run(root)
    if (err) failures.push(`[${check.id}] ${err}`)
  }

  if (failures.length > 0) {
    console.log('\n[validate-doctrine] FAIL')
    for (const f of failures) console.log(` - ${f}`)
    process.exit(1)
  }

  console.log('\n[validate-doctrine] PASS')
  console.log(`Ran ${CHECKS.length} doctrine consistency checks.`)
}

main()
