#!/usr/bin/env tsx
/**
 * @nzila/platform-growth-os — Operational report
 *
 * Reads every record from the file-backed store and prints a summary of:
 *   • engine version
 *   • brand voices, campaigns by status, content assets by approval
 *   • top latest lead scores per scope
 *   • proof requests by status
 *   • due founder topics
 *   • aggregate attribution by source (across all subjects)
 *
 * Pure local IO; safe in CI.
 *
 * Usage: `pnpm growthos:report`
 */
import { listAttributionEvents } from '../attribution/index'
import {
  listAudienceSegments,
  listBrandVoices,
  listCampaigns,
  listCampaignRuns,
  listCommercialOffers,
  listContentAssets,
} from '../campaigns/index'
import { listFounderTopics } from '../founder/index'
import { listProofRequests } from '../proof/index'
import { listLeadScores } from '../scoring/index'
import { GROWTH_OS_VERSION } from '../types'
import { LEAD_SCORE_MODEL_VERSION } from '../scoring/lead-score'
import { NBA_VERSION } from '../recommend/next-best-action'

function main(): void {
  console.log('# Growth OS Report')
  console.log(`Engine version:        ${GROWTH_OS_VERSION}`)
  console.log(`Lead score model:      ${LEAD_SCORE_MODEL_VERSION}`)
  console.log(`Next-best-action ver:  ${NBA_VERSION}`)
  console.log('')

  const voices = listBrandVoices()
  const segments = listAudienceSegments()
  const campaigns = listCampaigns()
  const runs = listCampaignRuns()
  const assets = listContentAssets()
  const offers = listCommercialOffers()
  const scores = listLeadScores()
  const events = listAttributionEvents()
  const proofs = listProofRequests()
  const topics = listFounderTopics()

  console.log('## Inventory')
  console.log(`  Brand voices:         ${voices.length}`)
  console.log(`  Audience segments:    ${segments.length}`)
  console.log(`  Campaigns:            ${campaigns.length}`)
  console.log(`  Campaign runs:        ${runs.length}`)
  console.log(`  Content assets:       ${assets.length}`)
  console.log(`  Commercial offers:    ${offers.length}`)
  console.log(`  Lead scores:          ${scores.length}`)
  console.log(`  Attribution events:   ${events.length}`)
  console.log(`  Proof requests:       ${proofs.length}`)
  console.log(`  Founder topics:       ${topics.length}`)
  console.log('')

  if (campaigns.length > 0) {
    const byStatus = bucket(campaigns, (c) => c.status)
    console.log('## Campaigns by status')
    for (const [s, n] of byStatus) console.log(`  ${s.padEnd(12)} ${n}`)
    console.log('')
  }

  if (assets.length > 0) {
    const byApproval = bucket(assets, (a) => a.approval)
    console.log('## Content assets by approval')
    for (const [s, n] of byApproval) console.log(`  ${s.padEnd(12)} ${n}`)
    console.log('')
  }

  if (scores.length > 0) {
    console.log('## Top 5 latest lead scores')
    const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 5)
    for (const s of top) {
      console.log(
        `  ${s.subjectKind}:${s.subjectId.padEnd(20)} ` +
          `score=${(s.score * 100).toFixed(1)}%  stage=${s.stage}  ` +
          `conf=${(s.confidence * 100).toFixed(0)}%`,
      )
    }
    console.log('')
  }

  if (events.length > 0) {
    const bySource = new Map<string, number>()
    for (const e of events) {
      const src = e.campaignRunId ?? e.partnerId ?? e.channel ?? 'organic'
      bySource.set(src, (bySource.get(src) ?? 0) + 1)
    }
    console.log('## Attribution events by source')
    for (const [src, n] of [...bySource].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${src.padEnd(28)} ${n}`)
    }
    console.log('')
  }

  if (proofs.length > 0) {
    const byStatus = bucket(proofs, (p) => p.status)
    console.log('## Proof requests by status')
    for (const [s, n] of byStatus) console.log(`  ${s.padEnd(20)} ${n}`)
    console.log('')
  }

  if (topics.length > 0) {
    const due = topics.filter((t) => {
      if (t.status !== 'active') return false
      if (!t.lastSurfacedAt) return true
      const ageDays = (Date.now() - Date.parse(t.lastSurfacedAt)) / 86_400_000
      return ageDays >= t.cadenceDays
    })
    console.log(`## Founder topics — ${due.length} due of ${topics.length}`)
    for (const t of due.slice(0, 5)) {
      console.log(`  • ${t.theme}  (cadence ${t.cadenceDays}d, audiences: ${t.audiences.join(', ')})`)
    }
    console.log('')
  }

  if (
    voices.length === 0 &&
    campaigns.length === 0 &&
    scores.length === 0 &&
    events.length === 0 &&
    proofs.length === 0 &&
    topics.length === 0
  ) {
    console.log('No growth-os records yet. Seed via the public APIs.')
  }
}

function bucket<T>(items: readonly T[], key: (t: T) => string): [string, number][] {
  const out = new Map<string, number>()
  for (const i of items) out.set(key(i), (out.get(key(i)) ?? 0) + 1)
  return [...out].sort((a, b) => b[1] - a[1])
}

main()
