/**
 * @nzila/platform-knowledge-registry — Doctrine Whitepaper Seeds
 *
 * Foundational research whitepapers ingested into Nzila OS doctrine.
 * Mirrors docs/doctrine/whitepapers/whitepapers.registry.json.
 *
 * Consumed by:
 *   - Cognition / grounded-AI retrieval layer (for citation + context grounding)
 *   - Reasoning engine (as background institutional knowledge)
 *   - Tests asserting doctrine-source visibility
 *
 * The binary master PDF remains the immutable artifact; the canonical
 * Markdown edition is the citable surface. This module exposes both
 * paths plus structured metadata so downstream systems can resolve them
 * without re-parsing the registry file.
 */
import type { CreateKnowledgeAssetInput, KnowledgeAsset, KnowledgeStore } from './types'
import { registerKnowledgeAsset } from './operations'

export interface DoctrineWhitepaperSeed {
  readonly id: string
  readonly title: string
  readonly edition: string
  readonly publisher: string
  readonly publishedDate: string
  readonly ingestedDate: string
  readonly binaryMaster: string
  readonly canonicalMarkdown: string
  readonly extractedText?: string
  readonly tags: readonly string[]
  readonly relatedDoctrine: readonly string[]
  readonly introduces: readonly string[]
  readonly assetInput: CreateKnowledgeAssetInput
}

export const DOCTRINE_WHITEPAPERS: readonly DoctrineWhitepaperSeed[] = [
  {
    id: 'wp.continuity-gap.v3',
    title: 'The Continuity Gap — Master Whitepaper',
    edition: 'Evidence-Enhanced Canadian Edition v3.0',
    publisher: 'Nzila Ventures / Nzila OS Research Initiative',
    publishedDate: '2026-05-21',
    ingestedDate: '2026-05-22',
    binaryMaster: 'apps/union-eyes/public/whitepapers/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
    canonicalMarkdown: 'docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md',
    extractedText: 'infotech/_continuity_gap.txt',
    tags: [
      'continuity',
      'oci',
      'ocra',
      'governance',
      'institutional-memory',
      'canada',
      'research',
      'whitepaper',
    ],
    relatedDoctrine: [
      'docs/doctrine/DOCTRINE.md',
      'docs/doctrine/frameworks.md',
      'docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md',
      'docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md',
    ],
    introduces: [
      'Organizational Continuity Infrastructure (OCI)',
      'OCRA multi-dimensional continuity sensing',
      'Continuity Debt',
      'Governance Entropy',
      'Operational Trust',
      'Runtime Truth',
      'Continuity-Aware AI',
      'Continuity Transformation',
    ],
    assetInput: {
      tenantScope: 'platform',
      domainScope: 'doctrine.continuity',
      title: 'The Continuity Gap — Master Whitepaper (v3, Evidence-Enhanced Canadian Edition)',
      knowledgeType: 'policy',
      source: 'docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md',
      effectiveDate: '2026-05-22',
      tags: [
        'continuity',
        'oci',
        'ocra',
        'governance',
        'institutional-memory',
        'canada',
        'research',
        'whitepaper',
      ],
      structuredPayload: {
        whitepaperId: 'wp.continuity-gap.v3',
        binaryMaster: 'apps/union-eyes/public/whitepapers/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
        canonicalMarkdown: 'docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md',
        edition: 'Evidence-Enhanced Canadian Edition v3.0',
        publisher: 'Nzila Ventures / Nzila OS Research Initiative',
      },
      textPayload:
        'The Continuity Gap (v3) introduces Organizational Continuity Infrastructure (OCI) and the OCRA continuity sensing model. ' +
        'Central thesis: modern institutions are losing continuity faster than they preserve it. ' +
        'Canadian evidence base: 5.2M boomers already exited, 2.7M aged 60-64 exiting in 5 years, 76% of Canadian SME owners plan to exit within a decade with only 9% holding a formalized succession plan. ' +
        'Defines: Continuity Debt, Governance Entropy, Operational Trust, Runtime Truth, Continuity-Aware AI, Continuity Transformation. ' +
        'Distinguishes succession planning (who comes next) from institutional continuity (what must survive the transition).',
    },
  },
]

/**
 * Seed the given knowledge store with all canonized doctrine whitepapers.
 * Idempotent at the store level if the store guards against duplicate IDs;
 * otherwise callers should clear/reset before re-seeding.
 *
 * Returns the registered `KnowledgeAsset[]` in seed order.
 */
export async function seedDoctrineWhitepapers(
  store: KnowledgeStore,
): Promise<readonly KnowledgeAsset[]> {
  const assets: KnowledgeAsset[] = []
  for (const seed of DOCTRINE_WHITEPAPERS) {
    const asset = await registerKnowledgeAsset(store, seed.assetInput)
    assets.push(asset)
  }
  return assets
}

/**
 * Lookup a whitepaper seed by its stable registry id (e.g. "wp.continuity-gap.v3").
 */
export function getDoctrineWhitepaper(id: string): DoctrineWhitepaperSeed | undefined {
  return DOCTRINE_WHITEPAPERS.find((wp) => wp.id === id)
}
