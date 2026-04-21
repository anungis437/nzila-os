/**
 * Chief of Staff v2 — multi-agent synthesis.
 *
 * Unlike v1 (which reads raw signals), v2 reads the RECENT INSIGHTS produced
 * by all other ExecutiveOS agents and synthesizes an executive briefing:
 *
 * - Cross-domain criticals (count + top 5)
 * - Domains currently silent (no runs in the window) → blind spots
 * - Duplicate themes across agents (keyword clustering)
 * - "What changed since last synthesis" — net-new criticals
 *
 * Pure function over a pre-fetched digest of executive_agent_insights.
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
  ExecutiveDomain,
  Severity,
} from '../contract.js'

export interface RecentInsight {
  agentKey: string
  domain: ExecutiveDomain
  title: string
  severity: Severity
  confidence: number
  createdAt: string // ISO
}

export interface AgentRunSummary {
  agentKey: string
  domain: ExecutiveDomain
  lastRunAt: string | null
  ageDays: number | null // null if never run
}

export interface CosV2Signal {
  /** Insights produced in the synthesis window (e.g. last 7 days). */
  recentInsights: ReadonlyArray<RecentInsight>
  /** Last-run summary for every registered agent. */
  agentRuns: ReadonlyArray<AgentRunSummary>
  /** Previous synthesis's critical titles, for "what changed". */
  previousCriticalTitles?: ReadonlyArray<string>
  /** Days beyond which an agent is considered silent. Default 7. */
  silentAgentDays?: number
}

const TOP_N = 5

export const chiefOfStaffV2Agent: ExecutiveAgent<CosV2Signal> = {
  key: 'chief-of-staff-v2',
  name: 'Chief of Staff v2',
  domain: 'executive',
  mission: 'Synthesize every agent\'s output into one executive briefing.',
  version: '0.2.0',

  async run(req): Promise<AgentResult> {
    const signal: CosV2Signal = req.input ?? { recentInsights: [], agentRuns: [] }
    const silentDays = signal.silentAgentDays ?? 7

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    const criticals = signal.recentInsights
      .filter((i) => i.severity === 'critical')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    const warns = signal.recentInsights.filter((i) => i.severity === 'warn')

    // Top criticals
    if (criticals.length > 0) {
      insights.push({
        domain: 'executive',
        title: `${criticals.length} critical signal${criticals.length === 1 ? '' : 's'} across the stack`,
        body: criticals
          .slice(0, TOP_N)
          .map((c) => `- [${c.domain}/${c.agentKey}] ${c.title}`)
          .join('\n'),
        severity: 'critical',
        confidence: 0.95,
        evidence: { byDomain: countByDomain(criticals) },
        recommendedNextStep: 'Walk through each in today\'s operating sync; assign owners.',
      })
      actions.push({
        actionClass: 'recommendation',
        title: 'Operating-review agenda',
        description: `Review ${Math.min(criticals.length, TOP_N)} criticals in today's leadership sync.`,
        payload: {
          topTitles: criticals.slice(0, TOP_N).map((c) => c.title),
        },
        requiresApproval: true,
        confidence: 0.9,
        riskLevel: 'medium',
      })
    }

    // Warn load
    if (warns.length > 10) {
      insights.push({
        domain: 'executive',
        title: `${warns.length} warnings open across the stack`,
        body: 'High warning load degrades signal-to-noise. Consider a triage sweep.',
        severity: 'warn',
        confidence: 0.7,
        evidence: { byDomain: countByDomain(warns) },
        recommendedNextStep: 'Batch-triage warnings by domain owner this week.',
      })
    }

    // Silent agents (blind spots)
    const silent = signal.agentRuns.filter(
      (r) => r.ageDays === null || r.ageDays > silentDays,
    )
    if (silent.length > 0) {
      insights.push({
        domain: 'executive',
        title: `${silent.length} agent${silent.length === 1 ? '' : 's'} silent >${silentDays}d (blind spots)`,
        body: silent.slice(0, 10).map((r) => `- ${r.agentKey} (${r.domain}) — ${r.ageDays == null ? 'never run' : `${r.ageDays}d ago`}`).join('\n'),
        severity: 'warn',
        confidence: 0.9,
        evidence: { agents: silent.map((r) => r.agentKey) },
        recommendedNextStep: 'Schedule runs or remove unused agents.',
      })
    }

    // Duplicate themes (simple keyword overlap)
    const clusters = clusterByKeyword(criticals.concat(warns))
    const hot = clusters.filter((c) => c.count >= 2).sort((a, b) => b.count - a.count)
    if (hot.length > 0) {
      insights.push({
        domain: 'executive',
        title: `${hot.length} recurring theme${hot.length === 1 ? '' : 's'} across agents`,
        body: hot
          .slice(0, 5)
          .map((c) => `- "${c.keyword}" × ${c.count} (${c.domains.join(', ')})`)
          .join('\n'),
        severity: 'info',
        confidence: 0.6,
        evidence: { themes: hot.slice(0, 10) },
        recommendedNextStep: 'These themes cross domains; pick one owner to drive resolution.',
      })
    }

    // What changed
    if (signal.previousCriticalTitles && signal.previousCriticalTitles.length > 0) {
      const prev = new Set(signal.previousCriticalTitles)
      const netNew = criticals.filter((c) => !prev.has(c.title))
      if (netNew.length > 0) {
        insights.push({
          domain: 'executive',
          title: `${netNew.length} new critical${netNew.length === 1 ? '' : 's'} since last synthesis`,
          body: netNew.slice(0, TOP_N).map((c) => `- [${c.domain}] ${c.title}`).join('\n'),
          severity: 'warn',
          confidence: 0.85,
          evidence: { netNewTitles: netNew.map((c) => c.title) },
        })
      }
    }

    const summary =
      insights.length === 0
        ? 'All agents green. No executive action required.'
        : `${criticals.length} critical · ${warns.length} warn · ${silent.length} silent.`
    return { summary, insights, actions }
  },
}

function countByDomain(items: ReadonlyArray<RecentInsight>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const i of items) out[i.domain] = (out[i.domain] ?? 0) + 1
  return out
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'has', 'have', 'is', 'are', 'no', 'not', 'this', 'that', 'these', 'those',
  'at', 'by', 'as', 'it', 'its', 'be', 'been', 'was', 'were', 'but', 'per',
  'one', 'two', 'three', 'four', 'five', 'six', 'open', 'still',
])

interface Cluster { keyword: string; count: number; domains: string[] }

function clusterByKeyword(items: ReadonlyArray<RecentInsight>): Cluster[] {
  const counts = new Map<string, { count: number; domains: Set<string> }>()
  for (const it of items) {
    const tokens = it.title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    for (const t of new Set(tokens)) {
      const prev = counts.get(t) ?? { count: 0, domains: new Set<string>() }
      prev.count++
      prev.domains.add(it.domain)
      counts.set(t, prev)
    }
  }
  return Array.from(counts.entries()).map(([keyword, v]) => ({
    keyword,
    count: v.count,
    domains: Array.from(v.domains),
  }))
}
