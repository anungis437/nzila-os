import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { platformDb } from '@nzila/db/platform'
import { decisionScorebacks } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { resendAdapter, sendgridAdapter, mailgunAdapter } from '@nzila/comms-email'
import { slackAdapter } from '@nzila/chatops-slack'
import { getWeeklyBriefingData } from '../lib/executive-intelligence'
import { generateAutopilotRecommendations } from '../lib/autopilot-engine'
import { getForecastOutput } from '../lib/forecast-engine'
import { getDataFreshnessSummary } from '../lib/data-freshness'

interface DigestBundle {
  title: string
  markdown: string
  text: string
  generatedAt: string
  orgId: string
}

function isSchemaCompatibilityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybePg = error as { code?: string; message?: string }
  if (maybePg.code === '42P01' || maybePg.code === '42703') return true
  return typeof maybePg.message === 'string' && maybePg.message.includes('does not exist')
}

function getArgFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag)
}

function toHtmlFromMarkdown(markdown: string): string {
  const escaped = markdown
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return `<pre style=\"font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; line-height: 1.4;\">${escaped}</pre>`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getEnv(key: string, fallback = ''): string {
  return process.env[key]?.trim() || fallback
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function loadDigestBundle(): Promise<DigestBundle> {
  const briefing = await getWeeklyBriefingData()

  const [recommendationsResult, forecastResult, freshnessResult] = await Promise.allSettled([
    generateAutopilotRecommendations(),
    getForecastOutput(),
    getDataFreshnessSummary(),
  ])

  const recommendations = recommendationsResult.status === 'fulfilled' ? recommendationsResult.value : []
  if (recommendationsResult.status === 'rejected') {
    console.warn('[console-weekly-digest] recommendations unavailable; continuing with empty recommendations list')
  }

  const forecast = forecastResult.status === 'fulfilled'
    ? forecastResult.value
    : {
        generatedAt: new Date(),
        pipelineWeightedUsd: 0,
        closeSignals: { draft: 0, sent: 0, accepted: 0 },
        scenarios: [],
        rankingShiftSignals: [],
      }
  if (forecastResult.status === 'rejected') {
    console.warn('[console-weekly-digest] forecast unavailable; continuing with fallback forecast values')
  }

  const freshness = freshnessResult.status === 'fulfilled'
    ? freshnessResult.value
    : {
        overallScore: 0,
        modules: [],
      }
  if (freshnessResult.status === 'rejected') {
    console.warn('[console-weekly-digest] data freshness unavailable; continuing with unknown freshness state')
  }

  if (!briefing.executiveOrgId) {
    throw new Error('Cannot generate weekly digest: no executive org id was resolved.')
  }

  const scorebacks = await platformDb
    .select({
      accuracyScore: decisionScorebacks.accuracyScore,
      confidenceAtDecision: decisionScorebacks.confidenceAtDecision,
      outcomeStatus: decisionScorebacks.outcomeStatus,
    })
    .from(decisionScorebacks)
    .where(eq(decisionScorebacks.orgId, briefing.executiveOrgId))
    .catch((error) => {
      if (isSchemaCompatibilityError(error)) {
        console.warn('[console-weekly-digest] decision_scorebacks unavailable; continuing without scoreback metrics')
        return []
      }
      throw error
    })

  const scored = scorebacks.filter((row) => row.accuracyScore != null)
  const avgAccuracy = scored.length > 0
    ? scored.reduce((sum, row) => sum + Number(row.accuracyScore ?? 0), 0) / scored.length
    : null

  const confidenceGapRows = scorebacks
    .filter((row) => row.accuracyScore != null && row.confidenceAtDecision != null)
    .map((row) => Math.abs(Number(row.accuracyScore) - Number(row.confidenceAtDecision) * 100))
  const confidenceGap = confidenceGapRows.length > 0
    ? confidenceGapRows.reduce((sum, value) => sum + value, 0) / confidenceGapRows.length
    : null

  const pendingScorebacks = scorebacks.filter((row) => row.outcomeStatus === 'pending').length

  const baseScenario = forecast.scenarios.find((scenario) => scenario.name === 'base')
  const topRecs = recommendations.slice(0, 3)
  const topRisks = briefing.risksRising.slice(0, 3)

  const generatedAt = new Date().toISOString()
  const title = `Console Weekly Digest - ${generatedAt.slice(0, 10)}`

  const markdown = [
    `# ${title}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Executive summary',
    `- ${briefing.summarySentence}`,
    `- Data freshness: ${freshness.overallScore}%`,
    `- Base runway: ${baseScenario ? `${baseScenario.runwayMonths.toFixed(1)} months` : 'N/A'}`,
    `- Decision accuracy trend: ${avgAccuracy == null ? 'N/A' : `${avgAccuracy.toFixed(0)}%`}`,
    `- Confidence gap trend: ${confidenceGap == null ? 'N/A' : `${confidenceGap.toFixed(1)} pts`}`,
    `- Pending scorebacks: ${pendingScorebacks}`,
    '',
    '## Top autopilot actions',
    ...topRecs.map((rec, idx) => `- ${idx + 1}. ${rec.action} (${Math.round(clamp(rec.confidence, 0, 1) * 100)}% confidence, ${rec.urgency})`),
    '',
    '## Top risks rising',
    ...(topRisks.length > 0 ? topRisks.map((risk) => `- ${risk}`) : ['- No high-confidence risk signal captured this cycle.']),
    '',
    '## Forecast',
    ...forecast.scenarios.map((scenario) =>
      `- ${scenario.name.toUpperCase()}: runway ${scenario.runwayMonths.toFixed(1)}m, 30d revenue $${scenario.expectedRevenue30d.toFixed(0)}, overload ${scenario.founderOverloadRiskPct.toFixed(0)}%`
    ),
    '',
    '## Decision-learning pulse',
    '- Keep scoreback updates current so forecast confidence calibration improves weekly.',
  ].join('\n')

  const text = markdown

  return {
    title,
    markdown,
    text,
    generatedAt,
    orgId: briefing.executiveOrgId,
  }
}

async function sendEmailDigest(bundle: DigestBundle): Promise<number> {
  const provider = getEnv('WEEKLY_DIGEST_EMAIL_PROVIDER').toLowerCase()
  const recipients = splitCsv(getEnv('WEEKLY_DIGEST_EMAIL_TO'))
  if (!provider || recipients.length === 0) return 0

  const adapter = provider === 'resend'
    ? resendAdapter
    : provider === 'sendgrid'
      ? sendgridAdapter
      : provider === 'mailgun'
        ? mailgunAdapter
        : null

  if (!adapter) {
    throw new Error(`Unsupported WEEKLY_DIGEST_EMAIL_PROVIDER: ${provider}`)
  }

  const credentials = provider === 'resend'
    ? {
        apiKey: getEnv('WEEKLY_DIGEST_RESEND_API_KEY', getEnv('RESEND_API_KEY')),
        fromAddress: getEnv('WEEKLY_DIGEST_EMAIL_FROM', getEnv('RESEND_FROM')),
      }
    : provider === 'sendgrid'
      ? {
          apiKey: getEnv('WEEKLY_DIGEST_SENDGRID_API_KEY', getEnv('SENDGRID_API_KEY')),
          fromAddress: getEnv('WEEKLY_DIGEST_EMAIL_FROM', getEnv('SENDGRID_FROM')),
        }
      : {
          apiKey: getEnv('WEEKLY_DIGEST_MAILGUN_API_KEY', getEnv('MAILGUN_API_KEY')),
          domain: getEnv('WEEKLY_DIGEST_MAILGUN_DOMAIN', getEnv('MAILGUN_DOMAIN')),
          fromAddress: getEnv('WEEKLY_DIGEST_EMAIL_FROM', getEnv('MAILGUN_FROM')),
          region: getEnv('WEEKLY_DIGEST_MAILGUN_REGION', getEnv('MAILGUN_REGION', 'us')),
        }

  let delivered = 0
  for (const recipient of recipients) {
    const result = await adapter.send(
      {
        orgId: bundle.orgId,
        channel: 'email',
        to: recipient,
        subject: bundle.title,
        body: toHtmlFromMarkdown(bundle.markdown),
        correlationId: randomUUID(),
        metadata: { digest: 'console-weekly' },
      },
      credentials,
    )

    if (result.ok) delivered += 1
    else console.error(`[console-weekly-digest] email delivery failed for ${recipient}: ${result.error ?? 'unknown error'}`)
  }

  return delivered
}

async function sendSlackDigest(bundle: DigestBundle): Promise<boolean> {
  const webhookUrl = getEnv('WEEKLY_DIGEST_SLACK_WEBHOOK_URL')
  const botToken = getEnv('WEEKLY_DIGEST_SLACK_BOT_TOKEN')
  const channel = getEnv('WEEKLY_DIGEST_SLACK_CHANNEL')
  if (!webhookUrl) return false

  const result = await slackAdapter.send(
    {
      orgId: bundle.orgId,
      channel: 'chatops',
      to: channel || 'weekly-digest',
      subject: bundle.title,
      body: bundle.text,
      correlationId: randomUUID(),
      metadata: { digest: 'console-weekly' },
    },
    {
      webhookUrl,
      botToken,
      defaultChannel: channel,
    },
  )

  if (!result.ok) {
    console.error(`[console-weekly-digest] slack delivery failed: ${result.error ?? 'unknown error'}`)
    return false
  }

  return true
}

function persistDigestReport(bundle: DigestBundle): void {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const root = path.resolve(__dirname, '..', '..', '..')
  const outDir = path.join(root, 'reports')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'console-weekly-digest-latest.md'), bundle.markdown, 'utf8')
}

async function main() {
  const shouldSend = getArgFlag('--send')
  const bundle = await loadDigestBundle()
  persistDigestReport(bundle)

  console.log(bundle.markdown)

  if (!shouldSend) {
    console.log('[console-weekly-digest] generated only (use --send to deliver).')
    return
  }

  const [emailDelivered, slackDelivered] = await Promise.all([
    sendEmailDigest(bundle),
    sendSlackDigest(bundle),
  ])

  const sentAnything = emailDelivered > 0 || slackDelivered
  if (!sentAnything) {
    throw new Error('Digest send requested, but no configured delivery channel succeeded. Configure email or slack env vars.')
  }

  console.log(`[console-weekly-digest] delivered: email=${emailDelivered}, slack=${slackDelivered ? 1 : 0}`)
}

main().catch((error) => {
  console.error('[console-weekly-digest] failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
